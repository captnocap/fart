//! Process host bindings — V8 FFI bridge for framework/process.zig spawnPiped.
//!
//! Implements the contract documented by runtime/hooks/process.ts:
//!   __proc_spawn(specJson) → pid (0 on failure)
//!   __proc_kill(pid, signalName) → bool
//!   __proc_stdin_write(pid, data) → bool
//!   __proc_stdin_close(pid) → void
//!   __env_get(name) → string|null
//!   __env_set(name, value) → void
//!
//! Spec JSON: {"cmd":"...","args":["..."],"cwd":"...","env":{"K":"V"},"stdin":"pipe|inherit|ignore"}
//!
//! Events (line-buffered, fired each frame from tickDrain):
//!   __ffiEmit('proc:stdout:<pid>', line)
//!   __ffiEmit('proc:stderr:<pid>', line)
//!   __ffiEmit('proc:exit:<pid>', '{"code":N,"signal":null}')

const std = @import("std");
const v8 = @import("v8");
const v8_runtime = @import("v8_runtime.zig");
const process = @import("process.zig");

const alloc = std.heap.c_allocator;

extern fn write(fd: c_int, buf: [*]const u8, count: usize) isize;
extern fn close(fd: c_int) c_int;
extern fn read(fd: c_int, buf: [*]u8, count: usize) isize;

// ── Registry ───────────────────────────────────────────────────────

const STDOUT_BUF = 65536;
const STDERR_BUF = 65536;

const Entry = struct {
    pid: c_int,
    piped: process.PipedProcess,
    out_buf: [STDOUT_BUF]u8 = undefined,
    out_len: usize = 0,
    err_buf: [STDERR_BUF]u8 = undefined,
    err_len: usize = 0,
};

var g_entries: std.ArrayList(*Entry) = .{};

fn findEntry(pid: c_int) ?*Entry {
    for (g_entries.items) |e| {
        if (e.pid == pid) return e;
    }
    return null;
}

fn removeEntry(pid: c_int) void {
    var i: usize = g_entries.items.len;
    while (i > 0) {
        i -= 1;
        if (g_entries.items[i].pid == pid) {
            const e = g_entries.items[i];
            if (e.piped.stdin_fd >= 0) _ = close(e.piped.stdin_fd);
            if (e.piped.stdout_fd >= 0) _ = close(e.piped.stdout_fd);
            if (e.piped.stderr_fd >= 0) _ = close(e.piped.stderr_fd);
            e.piped.process.closeProccess();
            alloc.destroy(e);
            _ = g_entries.orderedRemove(i);
            return;
        }
    }
}

// ── Helpers (mirror v8_bindings_httpserver) ────────────────────────

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

fn argToI32(info: v8.FunctionCallbackInfo, idx: u32) ?i32 {
    if (idx >= info.length()) return null;
    const ctx = info.getIsolate().getCurrentContext();
    return info.getArg(idx).toI32(ctx) catch null;
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

// ── Spec JSON parsing ──────────────────────────────────────────────
//
// Hand-rolled (same shape as v8_bindings_httpserver.parseRoutes). Looks for
// "cmd", "args", "cwd", "stdin" — env is currently dropped (TODO: implement
// nested object parsing if a cart needs per-process env injection).

fn extractStringField(obj: []const u8, key: []const u8) ?[]const u8 {
    var search_buf: [64]u8 = undefined;
    const needle = std.fmt.bufPrint(&search_buf, "\"{s}\"", .{key}) catch return null;
    const k_pos = std.mem.indexOf(u8, obj, needle) orelse return null;
    var p = k_pos + needle.len;
    while (p < obj.len and (obj[p] == ' ' or obj[p] == ':')) p += 1;
    if (p >= obj.len or obj[p] != '"') return null;
    p += 1;
    const start = p;
    while (p < obj.len and obj[p] != '"') {
        if (obj[p] == '\\') p += 1;
        p += 1;
    }
    if (p >= obj.len) return null;
    return obj[start..p];
}

/// Parse the args array into a heap-allocated null-terminated argv slice
/// (caller frees each string + the slice itself).
fn parseArgsArray(json: []const u8) ?[][:0]u8 {
    const k_pos = std.mem.indexOf(u8, json, "\"args\"") orelse return null;
    var p = k_pos + "\"args\"".len;
    while (p < json.len and (json[p] == ' ' or json[p] == ':')) p += 1;
    if (p >= json.len or json[p] != '[') return null;
    p += 1;

    var list: std.ArrayList([:0]u8) = .{};
    defer list.deinit(alloc);

    while (p < json.len) {
        while (p < json.len and (json[p] == ' ' or json[p] == ',')) p += 1;
        if (p >= json.len) break;
        if (json[p] == ']') break;
        if (json[p] != '"') break;
        p += 1;
        const start = p;
        while (p < json.len and json[p] != '"') {
            if (json[p] == '\\') p += 1;
            p += 1;
        }
        if (p >= json.len) break;
        const s_buf = alloc.allocSentinel(u8, p - start, 0) catch return null;
        @memcpy(s_buf[0 .. p - start], json[start..p]);
        list.append(alloc, s_buf) catch return null;
        p += 1;
    }

    const out = alloc.alloc([:0]u8, list.items.len) catch return null;
    @memcpy(out, list.items);
    return out;
}

// ── Host callbacks ─────────────────────────────────────────────────

fn hostSpawn(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const spec_json = argToStringAlloc(info, 0) orelse return;
    defer alloc.free(spec_json);

    const cmd_slice = extractStringField(spec_json, "cmd") orelse return;
    const cmd_z = alloc.allocSentinel(u8, cmd_slice.len, 0) catch return;
    @memcpy(cmd_z[0..cmd_slice.len], cmd_slice);
    defer alloc.free(cmd_z);

    const cwd_slice = extractStringField(spec_json, "cwd");
    const cwd_z: ?[:0]u8 = if (cwd_slice) |c| blk: {
        const z = alloc.allocSentinel(u8, c.len, 0) catch break :blk null;
        @memcpy(z[0..c.len], c);
        break :blk z;
    } else null;
    defer if (cwd_z) |z| alloc.free(z);

    const args = parseArgsArray(spec_json);
    defer if (args) |a| {
        for (a) |s| alloc.free(s);
        alloc.free(a);
    };

    // Build a null-terminated argv pointer array (excluding argv[0]; spawnPiped adds exe).
    var argv_buf: [33]?[*:0]const u8 = undefined;
    var argv_count: usize = 0;
    if (args) |a| {
        for (a) |s| {
            if (argv_count >= 32) break;
            argv_buf[argv_count] = s.ptr;
            argv_count += 1;
        }
    }
    argv_buf[argv_count] = null;

    const stdin_mode = extractStringField(spec_json, "stdin") orelse "pipe";
    const pipe_stdin = std.mem.eql(u8, stdin_mode, "pipe");

    const piped = process.spawnPiped(.{
        .exe = cmd_z.ptr,
        .args = if (argv_count > 0) @as([*]const ?[*:0]const u8, &argv_buf) else null,
        .cwd = if (cwd_z) |z| z.ptr else null,
        .pipe_stdin = pipe_stdin,
        .pipe_stdout = true,
        .pipe_stderr = true,
    }) catch {
        const ret = info.getReturnValue();
        ret.set(v8.Integer.initI32(info.getIsolate(), 0));
        return;
    };

    const e = alloc.create(Entry) catch {
        // Best effort cleanup; the process is already spawned.
        const ret = info.getReturnValue();
        ret.set(v8.Integer.initI32(info.getIsolate(), 0));
        return;
    };
    e.* = .{ .pid = piped.process.pid, .piped = piped };
    g_entries.append(alloc, e) catch {
        alloc.destroy(e);
        const ret = info.getReturnValue();
        ret.set(v8.Integer.initI32(info.getIsolate(), 0));
        return;
    };

    const ret = info.getReturnValue();
    ret.set(v8.Integer.initI32(info.getIsolate(), piped.process.pid));
}

fn hostKill(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const pid = argToI32(info, 0) orelse return;
    const sig_name = if (info.length() >= 2) (argToStringAlloc(info, 1) orelse @constCast("SIGTERM")) else @constCast("SIGTERM");
    defer if (info.length() >= 2) alloc.free(sig_name);

    const e = findEntry(pid) orelse {
        const ret = info.getReturnValue();
        ret.set(v8.Boolean.init(info.getIsolate(), false));
        return;
    };
    const sig: process.Signal = if (std.mem.eql(u8, sig_name, "SIGKILL")) .kill_ else .term;
    e.piped.process.sendSignal(sig);
    const ret = info.getReturnValue();
    ret.set(v8.Boolean.init(info.getIsolate(), true));
}

fn hostStdinWrite(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return;
    const pid = argToI32(info, 0) orelse return;
    const data = argToStringAlloc(info, 1) orelse return;
    defer alloc.free(data);

    const e = findEntry(pid) orelse {
        const ret = info.getReturnValue();
        ret.set(v8.Boolean.init(info.getIsolate(), false));
        return;
    };
    if (e.piped.stdin_fd < 0) {
        const ret = info.getReturnValue();
        ret.set(v8.Boolean.init(info.getIsolate(), false));
        return;
    }
    const n = write(e.piped.stdin_fd, data.ptr, data.len);
    const ret = info.getReturnValue();
    ret.set(v8.Boolean.init(info.getIsolate(), n >= 0));
}

fn hostStdinClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return;
    const pid = argToI32(info, 0) orelse return;
    const e = findEntry(pid) orelse return;
    if (e.piped.stdin_fd >= 0) {
        _ = close(e.piped.stdin_fd);
        e.piped.stdin_fd = -1;
    }
}

// ── Tick drain ─────────────────────────────────────────────────────

/// Drain pipe into entry buffer, emit complete lines on the given channel.
fn drainPipe(fd: c_int, buf: []u8, len: *usize, channel: []const u8) void {
    if (fd < 0) return;
    while (true) {
        if (len.* >= buf.len) {
            // Buffer full with no newline — flush as-is to keep moving.
            emitEvent(channel, buf[0..len.*]);
            len.* = 0;
        }
        const n = read(fd, buf.ptr + len.*, buf.len - len.*);
        if (n <= 0) break;
        len.* += @intCast(n);

        // Emit each complete line.
        while (true) {
            const slice = buf[0..len.*];
            const nl = std.mem.indexOfScalar(u8, slice, '\n') orelse break;
            emitEvent(channel, buf[0..nl]);
            const remaining = len.* - (nl + 1);
            if (remaining > 0) std.mem.copyForwards(u8, buf[0..remaining], buf[nl + 1 .. len.*]);
            len.* = remaining;
        }
    }
}

pub fn tickDrain() void {
    var i: usize = 0;
    while (i < g_entries.items.len) {
        const e = g_entries.items[i];
        var chan_buf: [64]u8 = undefined;

        if (std.fmt.bufPrint(&chan_buf, "proc:stdout:{d}", .{e.pid})) |chan| {
            drainPipe(e.piped.stdout_fd, &e.out_buf, &e.out_len, chan);
        } else |_| {}

        if (std.fmt.bufPrint(&chan_buf, "proc:stderr:{d}", .{e.pid})) |chan| {
            drainPipe(e.piped.stderr_fd, &e.err_buf, &e.err_len, chan);
        } else |_| {}

        // Check if the process has exited. alive() reaps zombie if so.
        if (!e.piped.process.alive()) {
            // Flush any trailing data without trailing newlines.
            if (e.out_len > 0) {
                if (std.fmt.bufPrint(&chan_buf, "proc:stdout:{d}", .{e.pid})) |chan| {
                    emitEvent(chan, e.out_buf[0..e.out_len]);
                } else |_| {}
                e.out_len = 0;
            }
            if (e.err_len > 0) {
                if (std.fmt.bufPrint(&chan_buf, "proc:stderr:{d}", .{e.pid})) |chan| {
                    emitEvent(chan, e.err_buf[0..e.err_len]);
                } else |_| {}
                e.err_len = 0;
            }

            const code = e.piped.process.exitCode();
            var pl: [64]u8 = undefined;
            if (std.fmt.bufPrint(&chan_buf, "proc:exit:{d}", .{e.pid})) |chan| {
                if (std.fmt.bufPrint(&pl, "{{\"code\":{d},\"signal\":null}}", .{code})) |payload| {
                    emitEvent(chan, payload);
                } else |_| {}
            } else |_| {}

            removeEntry(e.pid);
            // Don't increment i; next entry shifted into position.
            continue;
        }
        i += 1;
    }
}

// ── Registration ───────────────────────────────────────────────────

pub fn registerProcess(_: anytype) void {
    v8_runtime.registerHostFn("__proc_spawn", hostSpawn);
    v8_runtime.registerHostFn("__proc_kill", hostKill);
    v8_runtime.registerHostFn("__proc_stdin_write", hostStdinWrite);
    v8_runtime.registerHostFn("__proc_stdin_close", hostStdinClose);
    // __env_get / __env_set are owned by v8_bindings_fs.registerFs; do not
    // re-register here — the names collide and clobber the fs versions.
}
