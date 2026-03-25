//! LuaJIT Worker Stress Tests — mirrors effect-bench cart patterns
//!
//! Matches the stress test patterns from carts/effect-bench/:
//! 1. Bridge stress: escalating message passing (like StressJS setState calls)
//! 2. Compute stress: escalating off-thread compute (like ComputeJS heavy_compute)
//! 3. JSON stress: real-world json.lua from love2d (encode/decode escalation)
//! 4. Multi-worker stress: parallel compute across N threads
//!
//! Each test escalates every 3 seconds and reports per-frame timing.
//!
//! Build: zig build-exe bench_lua_stress.zig -I/usr/include/luajit-2.1 -L/usr/lib/x86_64-linux-gnu -lluajit-5.1 -lm -ldl -OReleaseFast

const std = @import("std");

const c = @cImport({
    @cInclude("lua.h");
    @cInclude("lauxlib.h");
    @cInclude("lualib.h");
});

// ── Lua helpers ─────────────────────────────────────────────────────────

fn luaDoString(L: *c.lua_State, code: [*:0]const u8) c_int {
    const load_ret = c.luaL_loadstring(L, code);
    if (load_ret != 0) return load_ret;
    return c.lua_pcall(L, 0, c.LUA_MULTRET, 0);
}

fn luaError(L: *c.lua_State) void {
    var len: usize = 0;
    const err = c.lua_tolstring(L, -1, &len);
    if (err != null) {
        const msg: []const u8 = @as([*]const u8, @ptrCast(err))[0..len];
        std.debug.print("  Lua error: {s}\n", .{msg});
    }
}

// ── Message queue ───────────────────────────────────────────────────────

const Message = struct {
    data: [512]u8 = undefined,
    len: usize = 0,

    fn fromSlice(s: []const u8) Message {
        var m = Message{};
        const copy_len = @min(s.len, 512);
        @memcpy(m.data[0..copy_len], s[0..copy_len]);
        m.len = copy_len;
        return m;
    }

    fn slice(self: *const Message) []const u8 {
        return self.data[0..self.len];
    }
};

const MessageQueue = struct {
    buf: [4096]Message = undefined,
    head: usize = 0,
    tail: usize = 0,
    mutex: std.Thread.Mutex = .{},

    fn push(self: *MessageQueue, msg: Message) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        const next = (self.tail + 1) % 4096;
        if (next == self.head) return false;
        self.buf[self.tail] = msg;
        self.tail = next;
        return true;
    }

    fn pop(self: *MessageQueue) ?Message {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.head == self.tail) return null;
        const msg = self.buf[self.head];
        self.head = (self.head + 1) % 4096;
        return msg;
    }
};

// ── Worker ──────────────────────────────────────────────────────────────

const WorkerCtx = struct {
    inbox: MessageQueue = .{},
    outbox: MessageQueue = .{},
    script: [*:0]const u8,
    running: std.atomic.Value(bool) = std.atomic.Value(bool).init(true),
    lua_path: ?[*:0]const u8 = null,
};

var tl_worker_ctx: ?*WorkerCtx = null;

fn luaHostRecv(L: ?*c.lua_State) callconv(.c) c_int {
    const ctx = tl_worker_ctx orelse return 0;
    if (ctx.inbox.pop()) |msg| {
        c.lua_pushlstring(L, &msg.data, msg.len);
        return 1;
    }
    return 0;
}

fn luaHostSend(L: ?*c.lua_State) callconv(.c) c_int {
    const ctx = tl_worker_ctx orelse return 0;
    var len: usize = 0;
    const ptr = c.lua_tolstring(L, 1, &len);
    if (ptr != null and len > 0) {
        const s: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
        _ = ctx.outbox.push(Message.fromSlice(s));
    }
    return 0;
}

fn luaHostRunning(L: ?*c.lua_State) callconv(.c) c_int {
    const ctx = tl_worker_ctx orelse {
        c.lua_pushboolean(L, 0);
        return 1;
    };
    c.lua_pushboolean(L, if (ctx.running.load(.monotonic)) 1 else 0);
    return 1;
}

const WorkerArgs = struct {
    ctx: *WorkerCtx,
    L: *c.lua_State,
};

fn workerThreadWithState(args: WorkerArgs) void {
    tl_worker_ctx = args.ctx;
    const L = args.L;
    defer c.lua_close(L);

    if (luaDoString(L, args.ctx.script) != 0) luaError(L);
}

fn workerThread(ctx: *WorkerCtx) void {
    tl_worker_ctx = ctx;

    const L = c.luaL_newstate() orelse return;
    defer c.lua_close(L);
    c.luaL_openlibs(L);

    if (ctx.lua_path) |path| {
        _ = c.lua_getglobal(L, "package");
        c.lua_pushstring(L, path);
        c.lua_setfield(L, -2, "path");
        c.lua_pop(L, 1);
    }

    c.lua_pushcclosure(L, &luaHostRecv, 0);
    c.lua_setglobal(L, "host_recv");
    c.lua_pushcclosure(L, &luaHostSend, 0);
    c.lua_setglobal(L, "host_send");
    c.lua_pushcclosure(L, &luaHostRunning, 0);
    c.lua_setglobal(L, "host_running");

    if (luaDoString(L, ctx.script) != 0) luaError(L);
}

// ── Stress Test 1: Bridge (like StressJS — escalating setState calls) ──

fn stressBridge() void {
    std.debug.print("\n╔═══════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  STRESS 1: Bridge Throughput (like StressJS)      ║\n", .{});
    std.debug.print("║  Escalating message passing, doubles every 3s    ║\n", .{});
    std.debug.print("╚═══════════════════════════════════════════════════╝\n\n", .{});

    const script =
        \\local count = 0
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    count = count + 1
        \\    host_send("ack")
        \\  end
        \\end
    ;

    var ctx = WorkerCtx{ .script = script };
    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch return;

    var N: u64 = 10;
    var last_escalation = std.time.microTimestamp();
    var frame: u32 = 0;

    // Simulate 60fps frames for 15 seconds
    const start = std.time.microTimestamp();
    while (std.time.microTimestamp() - start < 15_000_000) {
        const frame_start = std.time.microTimestamp();

        // Send N messages this "frame"
        var sent: u64 = 0;
        for (0..N) |_| {
            if (ctx.inbox.push(Message.fromSlice("ping"))) sent += 1;
        }

        // Drain replies
        var received: u64 = 0;
        // Give worker a moment to process
        std.Thread.sleep(100_000); // 0.1ms
        while (ctx.outbox.pop()) |_| received += 1;

        const frame_us = std.time.microTimestamp() - frame_start;
        frame += 1;

        // Report every 30 frames (~0.5s)
        if (frame % 30 == 0) {
            std.debug.print("  N={d: >8}  sent={d: >8}  recv={d: >8}  frame={d}us\n", .{ N, sent, received, frame_us });
        }

        // Escalate every 3 seconds
        if (std.time.microTimestamp() - last_escalation > 3_000_000) {
            N *= 2;
            last_escalation = std.time.microTimestamp();
            std.debug.print("  >>> Escalating to N={d}\n", .{N});
        }
    }

    ctx.running.store(false, .monotonic);
    thread.join();
}

// ── Stress Test 2: Compute (like ComputeJS — heavy off-thread work) ──

fn stressCompute() void {
    std.debug.print("\n╔═══════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  STRESS 2: Off-thread Compute (like ComputeJS)   ║\n", .{});
    std.debug.print("║  Escalating loop iterations, doubles every 3s    ║\n", .{});
    std.debug.print("╚═══════════════════════════════════════════════════╝\n\n", .{});

    const script =
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    local n = tonumber(msg) or 1000
        \\    -- Heavy compute: tight numeric loop (same as heavy_compute FFI)
        \\    local sum = 0
        \\    for i = 1, n do
        \\      sum = sum + math.sin(i * 0.001) * math.cos(i * 0.002)
        \\    end
        \\    host_send(string.format("%.6f", sum))
        \\  end
        \\end
    ;

    var ctx = WorkerCtx{ .script = script };
    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch return;

    var N: u64 = 1000;
    var last_escalation = std.time.microTimestamp();
    var frame: u32 = 0;

    const start = std.time.microTimestamp();
    while (std.time.microTimestamp() - start < 15_000_000) {
        const frame_start = std.time.microTimestamp();

        // Send compute request
        var buf: [32]u8 = undefined;
        const num_str = std.fmt.bufPrint(&buf, "{d}", .{N}) catch "0";
        _ = ctx.inbox.push(Message.fromSlice(num_str));

        // Wait for result (simulates main thread doing other work)
        var result: ?Message = null;
        var poll_count: u32 = 0;
        while (result == null and poll_count < 100000) : (poll_count += 1) {
            result = ctx.outbox.pop();
        }

        const frame_us = std.time.microTimestamp() - frame_start;
        frame += 1;

        if (frame % 10 == 0) {
            const res_str = if (result) |r| r.slice() else "pending";
            std.debug.print("  N={d: >10}  compute={d: >8}us  result={s}\n", .{ N, frame_us, res_str });
        }

        if (std.time.microTimestamp() - last_escalation > 3_000_000) {
            N *= 2;
            last_escalation = std.time.microTimestamp();
            std.debug.print("  >>> Escalating to N={d}\n", .{N});
        }
    }

    ctx.running.store(false, .monotonic);
    thread.join();
}

// ── Stress Test 3: JSON (real love2d/lua/json.lua) ──────────────────

fn stressJSON() void {
    std.debug.print("\n╔═══════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  STRESS 3: JSON encode/decode (love2d json.lua)  ║\n", .{});
    std.debug.print("║  Escalating object complexity, doubles every 3s  ║\n", .{});
    std.debug.print("╚═══════════════════════════════════════════════════╝\n\n", .{});

    const script =
        \\local json = require("json")
        \\
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    local n = tonumber(msg) or 10
        \\    -- Build a table with N entries
        \\    local data = { users = {} }
        \\    for i = 1, n do
        \\      data.users[i] = {
        \\        id = i,
        \\        name = "user_" .. i,
        \\        email = "user" .. i .. "@example.com",
        \\        score = i * 17 % 100,
        \\        active = i % 3 ~= 0,
        \\        tags = { "tag1", "tag2", "tag3" }
        \\      }
        \\    end
        \\    -- Encode then decode (round-trip)
        \\    local encoded = json.encode(data)
        \\    local decoded = json.decode(encoded)
        \\    host_send(tostring(#encoded) .. ":" .. tostring(#decoded.users))
        \\  end
        \\end
    ;

    const lua_path = "/home/siah/creative/reactjit/love2d/lua/?.lua;/home/siah/creative/reactjit/love2d/lua/?/init.lua";

    var ctx = WorkerCtx{ .script = script, .lua_path = lua_path };
    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch return;

    var N: u64 = 10;
    var last_escalation = std.time.microTimestamp();
    var frame: u32 = 0;

    const start = std.time.microTimestamp();
    while (std.time.microTimestamp() - start < 15_000_000) {
        const frame_start = std.time.microTimestamp();

        var buf: [32]u8 = undefined;
        const num_str = std.fmt.bufPrint(&buf, "{d}", .{N}) catch "0";
        _ = ctx.inbox.push(Message.fromSlice(num_str));

        var result: ?Message = null;
        var poll_count: u32 = 0;
        while (result == null and poll_count < 1000000) : (poll_count += 1) {
            result = ctx.outbox.pop();
        }

        const frame_us = std.time.microTimestamp() - frame_start;
        frame += 1;

        if (frame % 10 == 0) {
            const res_str = if (result) |r| r.slice() else "pending";
            std.debug.print("  N={d: >6} objects  json_roundtrip={d: >8}us  result={s}\n", .{ N, frame_us, res_str });
        }

        if (std.time.microTimestamp() - last_escalation > 3_000_000) {
            N *= 2;
            last_escalation = std.time.microTimestamp();
            std.debug.print("  >>> Escalating to N={d} objects\n", .{N});
        }
    }

    ctx.running.store(false, .monotonic);
    thread.join();
}

// ── Stress Test 4: Multi-worker parallel (4 workers, escalating) ────

fn stressMultiWorker() void {
    std.debug.print("\n╔═══════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  STRESS 4: Multi-worker parallel (4 threads)     ║\n", .{});
    std.debug.print("║  Each worker does escalating compute              ║\n", .{});
    std.debug.print("╚═══════════════════════════════════════════════════╝\n\n", .{});

    const script =
        \\while host_running() do
        \\  local msg = host_recv()
        \\  if msg then
        \\    local n = tonumber(msg) or 1000
        \\    local sum = 0
        \\    for i = 1, n do
        \\      sum = sum + i * i
        \\    end
        \\    host_send(tostring(sum))
        \\  end
        \\end
    ;

    const NUM_WORKERS = 4;
    var contexts: [NUM_WORKERS]WorkerCtx = undefined;
    var threads: [NUM_WORKERS]std.Thread = undefined;

    for (0..NUM_WORKERS) |i| {
        contexts[i] = WorkerCtx{ .script = script };
        threads[i] = std.Thread.spawn(.{}, workerThread, .{&contexts[i]}) catch return;
    }

    var N: u64 = 1000;
    var last_escalation = std.time.microTimestamp();
    var frame: u32 = 0;

    const start = std.time.microTimestamp();
    while (std.time.microTimestamp() - start < 15_000_000) {
        const frame_start = std.time.microTimestamp();

        // Send one job to each worker
        var buf: [32]u8 = undefined;
        const num_str = std.fmt.bufPrint(&buf, "{d}", .{N}) catch "0";
        for (0..NUM_WORKERS) |i| {
            _ = contexts[i].inbox.push(Message.fromSlice(num_str));
        }

        // Wait for all results
        var got: u32 = 0;
        var poll_count: u32 = 0;
        while (got < NUM_WORKERS and poll_count < 1000000) : (poll_count += 1) {
            for (0..NUM_WORKERS) |i| {
                if (contexts[i].outbox.pop()) |_| got += 1;
            }
        }

        const frame_us = std.time.microTimestamp() - frame_start;
        frame += 1;

        if (frame % 10 == 0) {
            std.debug.print("  N={d: >10}  workers={d}  all_done={d: >8}us  got={d}/{d}\n", .{
                N, NUM_WORKERS, frame_us, got, NUM_WORKERS,
            });
        }

        if (std.time.microTimestamp() - last_escalation > 3_000_000) {
            N *= 2;
            last_escalation = std.time.microTimestamp();
            std.debug.print("  >>> Escalating to N={d}\n", .{N});
        }
    }

    for (0..NUM_WORKERS) |i| {
        contexts[i].running.store(false, .monotonic);
    }
    for (0..NUM_WORKERS) |i| {
        threads[i].join();
    }
}

// ── Stress Test 5: Main-thread impact (does Lua worker affect 60fps?) ──

fn stressMainThreadImpact() void {
    std.debug.print("\n╔═══════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  STRESS 5: Main-thread impact (simulated 60fps)  ║\n", .{});
    std.debug.print("║  Worker does heavy compute while main runs at    ║\n", .{});
    std.debug.print("║  60fps. Shows: does the worker affect the main?  ║\n", .{});
    std.debug.print("╚═══════════════════════════════════════════════════╝\n\n", .{});

    const script =
        \\-- Continuously do heavy work without waiting for messages
        \\local iter = 0
        \\while host_running() do
        \\  local sum = 0
        \\  for i = 1, 100000 do
        \\    sum = sum + math.sin(i * 0.001) * math.cos(i * 0.002)
        \\  end
        \\  iter = iter + 1
        \\  if iter % 100 == 0 then
        \\    host_send("iter:" .. iter)
        \\  end
        \\end
    ;

    var ctx = WorkerCtx{ .script = script };
    const thread = std.Thread.spawn(.{}, workerThread, .{&ctx}) catch return;

    // Simulate 60fps main loop for 5 seconds
    var frame: u32 = 0;
    var max_frame_us: i64 = 0;
    var total_frame_us: i64 = 0;
    var worker_iters: u64 = 0;

    const start = std.time.microTimestamp();
    while (std.time.microTimestamp() - start < 5_000_000) {
        const frame_start = std.time.microTimestamp();

        // Simulate main-thread work: layout + paint (~2ms of work)
        var dummy: f64 = 0;
        for (0..50000) |i| {
            dummy += @sin(@as(f64, @floatFromInt(i)) * 0.001);
        }
        std.mem.doNotOptimizeAway(dummy);

        // Poll worker results (non-blocking)
        while (ctx.outbox.pop()) |_| {
            worker_iters += 1;
        }

        const frame_us = std.time.microTimestamp() - frame_start;
        total_frame_us += frame_us;
        if (frame_us > max_frame_us) max_frame_us = frame_us;
        frame += 1;

        // Sleep to simulate 60fps frame budget (16.6ms)
        const remaining = 16_600 - frame_us;
        if (remaining > 0) {
            std.Thread.sleep(@intCast(remaining * 1000));
        }
    }

    ctx.running.store(false, .monotonic);
    thread.join();

    const avg_frame_us = @divTrunc(total_frame_us, @as(i64, frame));
    std.debug.print("  Frames: {d}\n", .{frame});
    std.debug.print("  Avg frame: {d}us\n", .{avg_frame_us});
    std.debug.print("  Max frame: {d}us (jitter)\n", .{max_frame_us});
    std.debug.print("  Effective FPS: {d}\n", .{@divTrunc(@as(i64, frame) * 1_000_000, std.time.microTimestamp() - start)});
    std.debug.print("  Worker iterations (100K sin/cos each): {d}\n", .{worker_iters});
    std.debug.print("  Verdict: {s}\n", .{
        if (max_frame_us < 20_000) "NO IMPACT — worker is invisible to main thread" else "SOME JITTER — check CPU contention",
    });
}

pub fn main() !void {
    std.debug.print("╔════════════════════════════════════════════════════╗\n", .{});
    std.debug.print("║  LuaJIT Worker Stress Tests (mirrors effect-bench) ║\n", .{});
    std.debug.print("╚════════════════════════════════════════════════════╝\n", .{});

    stressBridge();
    stressCompute();
    stressJSON();
    // stressMultiWorker(); — LuaJIT threadlocal + Zig ReleaseFast needs investigation
    stressMainThreadImpact();

    std.debug.print("\n=== All stress tests complete ===\n", .{});
}
