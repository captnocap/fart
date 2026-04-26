//! Raw socket host bindings — V8 FFI bridge for net/tcp.zig and net/udp.zig.
//!
//! JS surface (mirrors runtime/hooks/useHost.ts kind:'tcp'|'udp'):
//!   __tcp_connect(id, host, port)
//!   __tcp_send(id, data)
//!   __tcp_close(id)
//!   __udp_open(id, host, port)
//!   __udp_send(id, data)
//!   __udp_close(id)
//!
//! Events fire via __ffiEmit each frame:
//!   __ffiEmit('tcp:data:<id>', data)
//!   __ffiEmit('tcp:close:<id>', '{}')
//!   __ffiEmit('tcp:error:<id>', message)
//!   __ffiEmit('udp:packet:<id>', data)
//!   __ffiEmit('udp:error:<id>', message)
//!
//! Data is passed as binary — V8 Strings are UTF-8 so callers binding to
//! protocols with non-UTF-8 bytes (Valve RCON, A2S) should encode/decode at
//! the JS layer (e.g. base64 wrappers). For the Smith-stack / love2d-port
//! happy path we keep it simple: text protocols get string events, binary
//! protocols get bytes-as-latin1-string and re-encode in JS.

const std = @import("std");
const v8 = @import("v8");
const v8_runtime = @import("v8_runtime.zig");
const tcp = @import("net/tcp.zig");
const udp = @import("net/udp.zig");
const socks5 = @import("net/socks5.zig");
const tor_lib = @import("net/tor.zig");

const alloc = std.heap.c_allocator;

// ── Registries ─────────────────────────────────────────────────────

const TcpEntry = struct { id: u32, client: *tcp.TcpClient };
const UdpEntry = struct { id: u32, sock: *udp.UdpSocket };
const Socks5Spec = struct {
    id: u32,
    host: []u8,
    port: u16,
    user: ?[]u8 = null,
    pass: ?[]u8 = null,
};

var g_tcp: std.ArrayList(TcpEntry) = .{};
var g_udp: std.ArrayList(UdpEntry) = .{};
var g_socks5: std.ArrayList(Socks5Spec) = .{};

fn findSocks5(id: u32) ?*Socks5Spec {
    for (g_socks5.items) |*e| if (e.id == id) return e;
    return null;
}

fn removeSocks5(id: u32) void {
    var i: usize = g_socks5.items.len;
    while (i > 0) {
        i -= 1;
        if (g_socks5.items[i].id == id) {
            const e = g_socks5.items[i];
            alloc.free(e.host);
            if (e.user) |u| alloc.free(u);
            if (e.pass) |p| alloc.free(p);
            _ = g_socks5.orderedRemove(i);
            return;
        }
    }
}

fn findTcp(id: u32) ?*TcpEntry {
    for (g_tcp.items) |*e| if (e.id == id) return e;
    return null;
}
fn findUdp(id: u32) ?*UdpEntry {
    for (g_udp.items) |*e| if (e.id == id) return e;
    return null;
}

fn removeTcp(id: u32) void {
    var i: usize = g_tcp.items.len;
    while (i > 0) {
        i -= 1;
        if (g_tcp.items[i].id == id) {
            g_tcp.items[i].client.close();
            alloc.destroy(g_tcp.items[i].client);
            _ = g_tcp.orderedRemove(i);
            return;
        }
    }
}
fn removeUdp(id: u32) void {
    var i: usize = g_udp.items.len;
    while (i > 0) {
        i -= 1;
        if (g_udp.items[i].id == id) {
            g_udp.items[i].sock.close();
            alloc.destroy(g_udp.items[i].sock);
            _ = g_udp.orderedRemove(i);
            return;
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────

fn argToStringAlloc(info: v8.FunctionCallbackInfo, idx: u32) ?[]u8 {
    if (idx >= info.length()) return null;
    const iso = info.getIsolate();
    const ctx = iso.getCurrentContext();
    const s = info.getArg(idx).toString(ctx) catch return null;
    const n = s.lenUtf8(iso);
    const buf = alloc.alloc(u8, n) catch return null;
    _ = s.writeUtf8(iso, buf);
    return buf;
}

fn argToU32(info: v8.FunctionCallbackInfo, idx: u32) ?u32 {
    if (idx >= info.length()) return null;
    const ctx = info.getIsolate().getCurrentContext();
    const v = info.getArg(idx).toI32(ctx) catch return null;
    return if (v >= 0) @intCast(v) else null;
}

fn emitEvent(channel: []const u8, payload: []const u8) void {
    var chan_buf: std.ArrayList(u8) = .{};
    defer chan_buf.deinit(alloc);
    chan_buf.appendSlice(alloc, channel) catch return;
    chan_buf.append(alloc, 0) catch return;
    const chan_z = chan_buf.items[0 .. chan_buf.items.len - 1 :0];

    var payload_buf: std.ArrayList(u8) = .{};
    defer payload_buf.deinit(alloc);
    payload_buf.appendSlice(alloc, payload) catch return;
    payload_buf.append(alloc, 0) catch return;
    const payload_z = payload_buf.items[0 .. payload_buf.items.len - 1 :0];

    v8_runtime.callGlobal2Str("__ffiEmit", chan_z, payload_z);
}

// ── TCP host fns ───────────────────────────────────────────────────

fn hostTcpConnect(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 3) return;
    const id = argToU32(info, 0) orelse return;
    const host = argToStringAlloc(info, 1) orelse return;
    defer alloc.free(host);
    const port = argToU32(info, 2) orelse return;

    if (findTcp(id) != null) return;

    // Optional 4th arg: via JSON like {"id":N,"kind":"tor"|"socks5"}.
    // When present, route the connection through that transport instead of
    // dialing direct. Tor → uses tor.getProxyPort() as a SOCKS5 endpoint.
    // SOCKS5 → looks up the registered SOCKS5 spec for that id.
    const via_json: ?[]u8 = if (info.length() >= 4) argToStringAlloc(info, 3) else null;
    defer if (via_json) |v| alloc.free(v);

    const client = alloc.create(tcp.TcpClient) catch return;
    client.* = blk: {
        if (via_json) |vj| if (vj.len > 0) {
            // Parse via.kind and via.id
            var kind_buf: [16]u8 = undefined;
            const kind_len = jsonField(vj, "kind", &kind_buf) orelse 0;
            const kind = kind_buf[0..kind_len];
            const via_id_u = jsonFieldU32(vj, "id") orelse 0;

            if (std.mem.eql(u8, kind, "tor")) {
                if (!tor_lib.isRunning()) {
                    emitTcpError(id, "via tor: not running");
                    alloc.destroy(client);
                    return;
                }
                const proxy_port = tor_lib.getProxyPort();
                const stream = socks5.connect("127.0.0.1", proxy_port, host, @intCast(port), null, null) catch |e| {
                    alloc.destroy(client);
                    var msg_buf: [128]u8 = undefined;
                    const msg = std.fmt.bufPrint(&msg_buf, "via tor: {s}", .{@errorName(e)}) catch "via tor failed";
                    emitTcpError(id, msg);
                    return;
                };
                break :blk tcp.TcpClient.fromStream(stream);
            } else if (std.mem.eql(u8, kind, "socks5")) {
                const spec = findSocks5(via_id_u) orelse {
                    emitTcpError(id, "via socks5: handle not registered");
                    alloc.destroy(client);
                    return;
                };
                const stream = socks5.connect(spec.host, spec.port, host, @intCast(port), spec.user, spec.pass) catch |e| {
                    alloc.destroy(client);
                    var msg_buf: [128]u8 = undefined;
                    const msg = std.fmt.bufPrint(&msg_buf, "via socks5: {s}", .{@errorName(e)}) catch "via socks5 failed";
                    emitTcpError(id, msg);
                    return;
                };
                break :blk tcp.TcpClient.fromStream(stream);
            }
            // Unknown via.kind — fall through to direct connect rather than fail
            // hard; the caller's hook will see the connection succeed and the
            // via field can be wired backend-by-backend without breaking carts.
        };
        break :blk tcp.TcpClient.connect(host, @intCast(port)) catch |e| {
            alloc.destroy(client);
            var msg_buf: [128]u8 = undefined;
            const msg = std.fmt.bufPrint(&msg_buf, "connect: {s}", .{@errorName(e)}) catch "connect failed";
            emitTcpError(id, msg);
            return;
        };
    };
    g_tcp.append(alloc, .{ .id = id, .client = client }) catch {
        client.close();
        alloc.destroy(client);
        return;
    };
}

fn emitTcpError(id: u32, msg: []const u8) void {
    var chan_buf: [64]u8 = undefined;
    const chan = std.fmt.bufPrint(&chan_buf, "tcp:error:{d}", .{id}) catch return;
    emitEvent(chan, msg);
}

// ── SOCKS5 spec registry — the JS side calls these so a `via:` lookup
// finds the proxy host/port/auth without re-sending them on every connect.

fn hostSocks5Register(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 3) return;
    const id = argToU32(info, 0) orelse return;
    const host = argToStringAlloc(info, 1) orelse return;
    const port = argToU32(info, 2) orelse {
        alloc.free(host);
        return;
    };
    const user_opt: ?[]u8 = if (info.length() >= 4) argToStringAlloc(info, 3) else null;
    const pass_opt: ?[]u8 = if (info.length() >= 5) argToStringAlloc(info, 4) else null;

    removeSocks5(id);
    g_socks5.append(alloc, .{
        .id = id,
        .host = host,
        .port = @intCast(port),
        .user = if (user_opt) |u| (if (u.len > 0) u else blk: {
            alloc.free(u);
            break :blk null;
        }) else null,
        .pass = if (pass_opt) |p| (if (p.len > 0) p else blk: {
            alloc.free(p);
            break :blk null;
        }) else null,
    }) catch {
        alloc.free(host);
        if (user_opt) |u| alloc.free(u);
        if (pass_opt) |p| alloc.free(p);
        return;
    };
}

fn hostSocks5Unregister(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const id = argToU32(info, 0) orelse return;
    removeSocks5(id);
}

// Minimal JSON field extraction — matches v8_bindings_tor.zig style.
// Avoids pulling a JSON parser into this hot binding path.
fn jsonField(json: []const u8, key: []const u8, out: []u8) ?usize {
    var pat_buf: [64]u8 = undefined;
    const pat = std.fmt.bufPrint(&pat_buf, "\"{s}\"", .{key}) catch return null;
    const k = std.mem.indexOf(u8, json, pat) orelse return null;
    var i = k + pat.len;
    while (i < json.len and json[i] != ':') i += 1;
    if (i >= json.len) return null;
    i += 1;
    while (i < json.len and (json[i] == ' ' or json[i] == '\t')) i += 1;
    if (i >= json.len or json[i] != '"') return null;
    i += 1;
    var n: usize = 0;
    while (i < json.len and json[i] != '"' and n < out.len) : (i += 1) {
        out[n] = json[i];
        n += 1;
    }
    return n;
}

fn jsonFieldU32(json: []const u8, key: []const u8) ?u32 {
    var pat_buf: [64]u8 = undefined;
    const pat = std.fmt.bufPrint(&pat_buf, "\"{s}\"", .{key}) catch return null;
    const k = std.mem.indexOf(u8, json, pat) orelse return null;
    var i = k + pat.len;
    while (i < json.len and json[i] != ':') i += 1;
    if (i >= json.len) return null;
    i += 1;
    while (i < json.len and (json[i] == ' ' or json[i] == '\t')) i += 1;
    var n: u32 = 0;
    var any = false;
    while (i < json.len and json[i] >= '0' and json[i] <= '9') : (i += 1) {
        n = n * 10 + (json[i] - '0');
        any = true;
    }
    return if (any) n else null;
}

fn hostTcpSend(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const id = argToU32(info, 0) orelse return;
    const data = argToStringAlloc(info, 1) orelse return;
    defer alloc.free(data);
    const e = findTcp(id) orelse return;
    e.client.send(data);
}

fn hostTcpClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const id = argToU32(info, 0) orelse return;
    removeTcp(id);
}

// ── UDP host fns ───────────────────────────────────────────────────

fn hostUdpOpen(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 3) return;
    const id = argToU32(info, 0) orelse return;
    const host = argToStringAlloc(info, 1) orelse return;
    defer alloc.free(host);
    const port = argToU32(info, 2) orelse return;

    if (findUdp(id) != null) return;

    const sock = alloc.create(udp.UdpSocket) catch return;
    sock.* = udp.UdpSocket.openConnected(host, @intCast(port)) catch |e| {
        alloc.destroy(sock);
        var chan_buf: [64]u8 = undefined;
        const chan = std.fmt.bufPrint(&chan_buf, "udp:error:{d}", .{id}) catch return;
        var msg_buf: [128]u8 = undefined;
        const msg = std.fmt.bufPrint(&msg_buf, "open: {s}", .{@errorName(e)}) catch "open failed";
        emitEvent(chan, msg);
        return;
    };
    g_udp.append(alloc, .{ .id = id, .sock = sock }) catch {
        sock.close();
        alloc.destroy(sock);
        return;
    };
}

fn hostUdpSend(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const id = argToU32(info, 0) orelse return;
    const data = argToStringAlloc(info, 1) orelse return;
    defer alloc.free(data);
    const e = findUdp(id) orelse return;
    e.sock.send(data);
}

fn hostUdpClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const id = argToU32(info, 0) orelse return;
    removeUdp(id);
}

// ── Tick drain ─────────────────────────────────────────────────────
// Same lesson as wsserver: keep the per-call read scratch off the native
// stack so V8's __jsTick budget isn't squeezed.

var g_tcp_ev_buf: [1]tcp.Event = undefined;
var g_udp_ev_buf: [1]udp.Event = undefined;

pub fn tickDrain() void {
    // TCP
    var i: usize = 0;
    while (i < g_tcp.items.len) {
        const e = g_tcp.items[i];
        var chan_buf: [64]u8 = undefined;
        // Drain until WouldBlock (n==0).
        while (true) {
            const n = e.client.update(&g_tcp_ev_buf);
            if (n == 0) break;
            const ev = g_tcp_ev_buf[0];
            switch (ev) {
                .data => |bytes| {
                    const chan = std.fmt.bufPrint(&chan_buf, "tcp:data:{d}", .{e.id}) catch continue;
                    emitEvent(chan, bytes);
                },
                .closed => {
                    const chan = std.fmt.bufPrint(&chan_buf, "tcp:close:{d}", .{e.id}) catch break;
                    emitEvent(chan, "{}");
                    break;
                },
                .err => |msg| {
                    const chan = std.fmt.bufPrint(&chan_buf, "tcp:error:{d}", .{e.id}) catch break;
                    emitEvent(chan, msg);
                    break;
                },
            }
        }
        if (e.client.closed) {
            removeTcp(e.id);
            continue;
        }
        i += 1;
    }

    // UDP
    var j: usize = 0;
    while (j < g_udp.items.len) {
        const e = g_udp.items[j];
        var chan_buf: [64]u8 = undefined;
        while (true) {
            const n = e.sock.update(&g_udp_ev_buf);
            if (n == 0) break;
            const ev = g_udp_ev_buf[0];
            switch (ev) {
                .packet => |bytes| {
                    const chan = std.fmt.bufPrint(&chan_buf, "udp:packet:{d}", .{e.id}) catch continue;
                    emitEvent(chan, bytes);
                },
                .err => |msg| {
                    const chan = std.fmt.bufPrint(&chan_buf, "udp:error:{d}", .{e.id}) catch break;
                    emitEvent(chan, msg);
                    break;
                },
            }
        }
        j += 1;
    }
}

// ── Registration ───────────────────────────────────────────────────

pub fn registerNet(_: anytype) void {
    v8_runtime.registerHostFn("__tcp_connect", hostTcpConnect);
    v8_runtime.registerHostFn("__tcp_send", hostTcpSend);
    v8_runtime.registerHostFn("__tcp_close", hostTcpClose);
    v8_runtime.registerHostFn("__udp_open", hostUdpOpen);
    v8_runtime.registerHostFn("__udp_send", hostUdpSend);
    v8_runtime.registerHostFn("__udp_close", hostUdpClose);
    v8_runtime.registerHostFn("__socks5_register", hostSocks5Register);
    v8_runtime.registerHostFn("__socks5_unregister", hostSocks5Unregister);
}
