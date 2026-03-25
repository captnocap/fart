//! LuaJIT Worker Thread Benchmark
//!
//! Tests: embedding LuaJIT in Zig, spawning worker threads, message passing throughput.
//! Build: zig build-exe bench_lua_worker.zig -I/usr/include/luajit-2.1 -L/usr/lib/x86_64-linux-gnu -lluajit-5.1 -lm -ldl
//! Run:   ./bench_lua_worker

const std = @import("std");

const c = @cImport({
    @cInclude("lua.h");
    @cInclude("lauxlib.h");
    @cInclude("lualib.h");
});

// ── Lua helpers (luaL_dostring is a macro that Zig can't always translate) ──

fn luaDoString(L: *c.lua_State, code: [*:0]const u8) c_int {
    const load_ret = c.luaL_loadstring(L, code);
    if (load_ret != 0) return load_ret;
    return c.lua_pcall(L, 0, c.LUA_MULTRET, 0);
}

// ── Message queue (thread-safe) ─────────────────────────────────────────

const Message = struct {
    data: [256]u8 = undefined,
    len: usize = 0,

    fn fromSlice(s: []const u8) Message {
        var m = Message{};
        const copy_len = @min(s.len, 256);
        @memcpy(m.data[0..copy_len], s[0..copy_len]);
        m.len = copy_len;
        return m;
    }

    fn slice(self: *const Message) []const u8 {
        return self.data[0..self.len];
    }
};

const MessageQueue = struct {
    buf: [1024]Message = undefined,
    head: usize = 0,
    tail: usize = 0,
    mutex: std.Thread.Mutex = .{},

    fn push(self: *MessageQueue, msg: Message) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        const next = (self.tail + 1) % 1024;
        if (next == self.head) return false; // full
        self.buf[self.tail] = msg;
        self.tail = next;
        return true;
    }

    fn pop(self: *MessageQueue) ?Message {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.head == self.tail) return null; // empty
        const msg = self.buf[self.head];
        self.head = (self.head + 1) % 1024;
        return msg;
    }

    fn count(self: *MessageQueue) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.tail >= self.head) return self.tail - self.head;
        return 1024 - self.head + self.tail;
    }
};

// ── Worker context ──────────────────────────────────────────────────────

const WorkerCtx = struct {
    inbox: MessageQueue = .{},
    outbox: MessageQueue = .{},
    script: [*:0]const u8,
    running: std.atomic.Value(bool) = std.atomic.Value(bool).init(true),
    lua_path: ?[*:0]const u8 = null,
};

// ── Host functions exposed to Lua ───────────────────────────────────────

var g_worker_ctx: ?*WorkerCtx = null;

fn luaHostRecv(L: ?*c.lua_State) callconv(.c) c_int {
    const ctx = g_worker_ctx orelse return 0;
    if (ctx.inbox.pop()) |msg| {
        c.lua_pushlstring(L, &msg.data, msg.len);
        return 1;
    }
    return 0; // nil = no message
}

fn luaHostSend(L: ?*c.lua_State) callconv(.c) c_int {
    const ctx = g_worker_ctx orelse return 0;
    var len: usize = 0;
    const ptr = c.lua_tolstring(L, 1, &len);
    if (ptr != null and len > 0) {
        const s: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
        _ = ctx.outbox.push(Message.fromSlice(s));
    }
    return 0;
}

fn luaHostRunning(L: ?*c.lua_State) callconv(.c) c_int {
    const ctx = g_worker_ctx orelse {
        c.lua_pushboolean(L, 0);
        return 1;
    };
    c.lua_pushboolean(L, if (ctx.running.load(.monotonic)) 1 else 0);
    return 1;
}

// ── Worker thread ───────────────────────────────────────────────────────

fn workerThread(ctx: *WorkerCtx) void {
    // Thread-local context for host functions
    g_worker_ctx = ctx;

    const L = c.luaL_newstate() orelse {
        std.debug.print("[lua-worker] Failed to create Lua state\n", .{});
        return;
    };
    defer c.lua_close(L);

    c.luaL_openlibs(L);

    // Set package.path to find love2d modules
    if (ctx.lua_path) |path| {
        _ = c.lua_getglobal(L, "package");
        c.lua_pushstring(L, path);
        c.lua_setfield(L, -2, "path");
        c.lua_pop(L, 1);
    }

    // Register host functions
    c.lua_pushcclosure(L, &luaHostRecv, 0);
    c.lua_setglobal(L, "host_recv");

    c.lua_pushcclosure(L, &luaHostSend, 0);
    c.lua_setglobal(L, "host_send");

    c.lua_pushcclosure(L, &luaHostRunning, 0);
    c.lua_setglobal(L, "host_running");

    // Load and run script
    const ret = luaDoString(L, ctx.script);
    if (ret != 0) {
        var len: usize = 0;
        const err = c.lua_tolstring(L, -1, &len);
        if (err != null) {
            const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
            std.debug.print("[lua-worker] Error: {s}\n", .{msg});
        }
    }
}

// ── Benchmarks ──────────────────────────────────────────────────────────

fn benchVMStartup() void {
    std.debug.print("\n=== Benchmark: LuaJIT VM startup ===\n", .{});
    const N = 10000;
    const t0 = std.time.microTimestamp();

    for (0..N) |_| {
        const L = c.luaL_newstate() orelse continue;
        c.luaL_openlibs(L);
        _ = luaDoString(L, "return 1+1");
        c.lua_close(L);
    }

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const per_vm = @divTrunc(total_us, N);
    std.debug.print("  {d} VMs created+destroyed in {d}ms\n", .{ N, @divTrunc(total_us, 1000) });
    std.debug.print("  {d}us per VM lifecycle\n", .{per_vm});
}

fn benchMessageThroughput() void {
    std.debug.print("\n=== Benchmark: Message passing throughput ===\n", .{});

    const script =
        \\local count = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    count = count + 1
        \\    host_send("ack:" .. count)
        \\  end
        \\end
        \\host_send("done:" .. count)
    ;

    var ctx = WorkerCtx{ .script = script };

    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch {
        std.debug.print("  Failed to spawn thread\n", .{});
        return;
    };

    // Send messages as fast as possible for 1 second
    const t0 = std.time.microTimestamp();
    var sent: u64 = 0;
    var received: u64 = 0;

    while (std.time.microTimestamp() - t0 < 1_000_000) {
        // Send batch
        for (0..100) |_| {
            if (ctx.inbox.push(Message.fromSlice("ping"))) {
                sent += 1;
            }
        }
        // Drain replies
        while (ctx.outbox.pop()) |_| {
            received += 1;
        }
    }

    // Signal stop and drain remaining
    ctx.running.store(false, .monotonic);
    std.Thread.sleep(10_000_000); // 10ms for worker to finish
    while (ctx.outbox.pop()) |_| {
        received += 1;
    }

    thread.join();

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const msgs_per_sec = @divTrunc(sent * 1_000_000, @as(u64, @intCast(total_us)));

    std.debug.print("  Sent: {d}, Received: {d}\n", .{ sent, received });
    std.debug.print("  {d} msgs/sec round-trip\n", .{msgs_per_sec});
}

fn benchComputeOffThread() void {
    std.debug.print("\n=== Benchmark: Off-thread compute (JSON encode/decode) ===\n", .{});

    const script =
        \\-- Simple JSON-like serialization (no external deps)
        \\local function serialize(t)
        \\  if type(t) == "table" then
        \\    local parts = {}
        \\    for k, v in pairs(t) do
        \\      parts[#parts+1] = '"' .. tostring(k) .. '":' .. serialize(v)
        \\    end
        \\    return '{' .. table.concat(parts, ',') .. '}'
        \\  elseif type(t) == "string" then
        \\    return '"' .. t .. '"'
        \\  else
        \\    return tostring(t)
        \\  end
        \\end
        \\
        \\local count = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    -- Simulate compute: build a table, serialize it
        \\    local data = {
        \\      id = count,
        \\      name = "user_" .. count,
        \\      score = count * 17 % 100,
        \\      active = count % 2 == 0,
        \\      tags = { "lua", "worker", "bench" }
        \\    }
        \\    local result = serialize(data)
        \\    host_send(result)
        \\    count = count + 1
        \\  end
        \\end
    ;

    var ctx = WorkerCtx{ .script = script };

    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch {
        std.debug.print("  Failed to spawn thread\n", .{});
        return;
    };

    const t0 = std.time.microTimestamp();
    var sent: u64 = 0;
    var received: u64 = 0;

    // Run for 1 second
    while (std.time.microTimestamp() - t0 < 1_000_000) {
        for (0..50) |_| {
            if (ctx.inbox.push(Message.fromSlice("compute"))) {
                sent += 1;
            }
        }
        while (ctx.outbox.pop()) |_| {
            received += 1;
        }
    }

    ctx.running.store(false, .monotonic);
    std.Thread.sleep(10_000_000);
    while (ctx.outbox.pop()) |_| {
        received += 1;
    }

    thread.join();

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const ops_per_sec = @divTrunc(received * 1_000_000, @as(u64, @intCast(total_us)));

    std.debug.print("  Sent: {d}, Computed+Received: {d}\n", .{ sent, received });
    std.debug.print("  {d} compute ops/sec (serialize table → JSON string)\n", .{ops_per_sec});
}

fn benchMultiWorker() void {
    std.debug.print("\n=== Benchmark: Multiple workers (4 threads) ===\n", .{});

    const script =
        \\local sum = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    -- Simulate CPU work: tight loop
        \\    local n = 0
        \\    for i = 1, 1000 do
        \\      n = n + i * i
        \\    end
        \\    sum = sum + n
        \\    host_send(tostring(sum))
        \\  end
        \\end
    ;

    const NUM_WORKERS = 4;
    var contexts: [NUM_WORKERS]WorkerCtx = undefined;
    var threads: [NUM_WORKERS]std.Thread = undefined;

    for (0..NUM_WORKERS) |i| {
        contexts[i] = WorkerCtx{ .script = script };
        threads[i] = std.Thread.spawn(.{}, workerThread, .{&contexts[i]}) catch {
            std.debug.print("  Failed to spawn worker {d}\n", .{i});
            return;
        };
    }

    const t0 = std.time.microTimestamp();
    var total_sent: u64 = 0;
    var total_received: u64 = 0;

    // Run for 1 second
    while (std.time.microTimestamp() - t0 < 1_000_000) {
        for (0..NUM_WORKERS) |i| {
            for (0..20) |_| {
                if (contexts[i].inbox.push(Message.fromSlice("work"))) {
                    total_sent += 1;
                }
            }
            while (contexts[i].outbox.pop()) |_| {
                total_received += 1;
            }
        }
    }

    // Stop all workers
    for (0..NUM_WORKERS) |i| {
        contexts[i].running.store(false, .monotonic);
    }
    std.Thread.sleep(10_000_000);
    for (0..NUM_WORKERS) |i| {
        while (contexts[i].outbox.pop()) |_| {
            total_received += 1;
        }
        threads[i].join();
    }

    const t1 = std.time.microTimestamp();
    const total_us = t1 - t0;
    const ops_per_sec = @divTrunc(total_received * 1_000_000, @as(u64, @intCast(total_us)));

    std.debug.print("  {d} workers, Sent: {d}, Received: {d}\n", .{ NUM_WORKERS, total_sent, total_received });
    std.debug.print("  {d} total ops/sec across all workers\n", .{ops_per_sec});
    std.debug.print("  {d} ops/sec per worker\n", .{@divTrunc(ops_per_sec, NUM_WORKERS)});
}

fn benchLoveModuleLoad() void {
    std.debug.print("\n=== Benchmark: Load love2d modules (json, http, crypto) ===\n", .{});

    const lua_path = "/home/siah/creative/reactjit/love2d/lua/?.lua;/home/siah/creative/reactjit/love2d/lua/?/init.lua";

    // Test loading json.lua
    {
        const L = c.luaL_newstate() orelse {
            std.debug.print("  Failed to create state\n", .{});
            return;
        };
        defer c.lua_close(L);
        c.luaL_openlibs(L);

        _ = c.lua_getglobal(L, "package");
        c.lua_pushlstring(L, lua_path.ptr, lua_path.len);
        c.lua_setfield(L, -2, "path");
        c.lua_pop(L, 1);

        const t0 = std.time.microTimestamp();
        const ret = luaDoString(L,
            \\local json = require("json")
            \\local encoded = json.encode({name="test", value=42, tags={"a","b","c"}})
            \\local decoded = json.decode(encoded)
            \\return decoded.name
        );
        const t1 = std.time.microTimestamp();

        if (ret != 0) {
            var len: usize = 0;
            const err = c.lua_tolstring(L, -1, &len);
            if (err != null) {
                const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
                std.debug.print("  json.lua: FAIL — {s}\n", .{msg});
            }
        } else {
            std.debug.print("  json.lua: OK ({d}us) — require + encode + decode\n", .{t1 - t0});
        }
    }

    // Test loading math_utils.lua
    {
        const L = c.luaL_newstate() orelse return;
        defer c.lua_close(L);
        c.luaL_openlibs(L);

        _ = c.lua_getglobal(L, "package");
        c.lua_pushlstring(L, lua_path.ptr, lua_path.len);
        c.lua_setfield(L, -2, "path");
        c.lua_pop(L, 1);

        const t0 = std.time.microTimestamp();
        const ret = luaDoString(L,
            \\local mu = require("math_utils")
            \\return type(mu)
        );
        const t1 = std.time.microTimestamp();

        if (ret != 0) {
            var len: usize = 0;
            const err = c.lua_tolstring(L, -1, &len);
            if (err != null) {
                const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
                std.debug.print("  math_utils.lua: FAIL — {s}\n", .{msg});
            }
        } else {
            std.debug.print("  math_utils.lua: OK ({d}us)\n", .{t1 - t0});
        }
    }

    // Test loading color.lua
    {
        const L = c.luaL_newstate() orelse return;
        defer c.lua_close(L);
        c.luaL_openlibs(L);

        _ = c.lua_getglobal(L, "package");
        c.lua_pushlstring(L, lua_path.ptr, lua_path.len);
        c.lua_setfield(L, -2, "path");
        c.lua_pop(L, 1);

        const t0 = std.time.microTimestamp();
        const ret = luaDoString(L,
            \\local color = require("color")
            \\return type(color)
        );
        const t1 = std.time.microTimestamp();

        if (ret != 0) {
            var len: usize = 0;
            const err = c.lua_tolstring(L, -1, &len);
            if (err != null) {
                const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
                std.debug.print("  color.lua: FAIL — {s}\n", .{msg});
            }
        } else {
            std.debug.print("  color.lua: OK ({d}us)\n", .{t1 - t0});
        }
    }
}

fn benchMemoryFootprint() void {
    std.debug.print("\n=== Benchmark: Memory footprint ===\n", .{});

    const NUM_VMS = 100;
    var states: [NUM_VMS]?*c.lua_State = undefined;

    const t0 = std.time.microTimestamp();
    for (0..NUM_VMS) |i| {
        states[i] = c.luaL_newstate();
        if (states[i]) |L| {
            c.luaL_openlibs(L);
            _ = luaDoString(L, "local t = {}; for i=1,100 do t[i] = i*i end; return t");
        }
    }
    const t1 = std.time.microTimestamp();

    std.debug.print("  {d} VMs created in {d}us ({d}us each)\n", .{
        NUM_VMS,
        t1 - t0,
        @divTrunc(t1 - t0, NUM_VMS),
    });

    // Cleanup
    for (0..NUM_VMS) |i| {
        if (states[i]) |L| c.lua_close(L);
    }

    // Note: LuaJIT base VM is ~100KB, with openlibs ~400KB
    std.debug.print("  Estimated: ~{d}MB for {d} VMs (LuaJIT base ~400KB each)\n", .{
        NUM_VMS * 400 / 1024,
        NUM_VMS,
    });
}

pub fn main() !void {
    std.debug.print("╔════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  LuaJIT Worker Benchmark (Zig + LuaJIT)   ║\n", .{});
    std.debug.print("╚════════════════════════════════════════════╝\n", .{});

    benchVMStartup();
    benchMessageThroughput();
    benchComputeOffThread();
    benchMultiWorker();
    benchLoveModuleLoad();
    benchMemoryFootprint();

    std.debug.print("\n=== Done ===\n", .{});
}
