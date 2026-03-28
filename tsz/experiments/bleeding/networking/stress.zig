//! Networking Stress Test — simulates UI + networking contention
//!
//! Spawns:
//!   1. A local TCP server that serves JSON payloads (configurable size)
//!   2. A "UI thread" that does simulated layout + paint work at 60fps
//!   3. A "network thread" that fires HTTP-like fetches and parses JSON
//!   4. A "bridge thread" that moves parsed results into a shared queue
//!
//! Measures: FPS, frame time jitter, network throughput, parse latency,
//! and how they degrade as networking load increases.
//!
//! Build: zig build-exe -OReleaseFast stress.zig
//! Run:   ./stress

const std = @import("std");
const net = std.net;
const time = std.time;
const posix = std.posix;
const fs = std.fs;

// ── Configuration ──

const TARGET_FPS = 60;
const FRAME_BUDGET_US: i64 = 16667; // 16.67ms
const TEST_DURATION_SEC = 12;
const RAMP_INTERVAL_SEC = 2; // escalate every 2s
const MAX_CONCURRENT_FETCHES = 64;

// Simulated UI work per frame (microseconds of busy-wait)
const UI_LAYOUT_WORK_US = 800; // ~0.8ms layout
const UI_PAINT_WORK_US = 2000; // ~2ms paint
const UI_STATE_UPDATES = 24; // state slot mutations per frame

// ── Shared state ──

const Stats = struct {
    // UI thread
    frame_count: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    frame_time_us: std.atomic.Value(i64) = std.atomic.Value(i64).init(0),
    frame_overrun_count: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    max_frame_us: std.atomic.Value(i64) = std.atomic.Value(i64).init(0),
    // Network thread
    fetch_count: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    parse_count: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    total_parse_us: std.atomic.Value(i64) = std.atomic.Value(i64).init(0),
    total_bytes: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    // Control
    running: std.atomic.Value(bool) = std.atomic.Value(bool).init(true),
    level: std.atomic.Value(u32) = std.atomic.Value(u32).init(1),
};

var g_stats = Stats{};

// ── Simulated JSON parse (approximates QuickJS JSON.parse cost) ──
// We can't embed QuickJS in this standalone test, so we simulate the
// parse cost by doing real std.json parse + field extraction.
// Our benchmarks showed std.json is ~3-6x slower than JSON.parse,
// so the numbers here are PESSIMISTIC for the QuickJS path.

fn simulateJsonParse(allocator: std.mem.Allocator, payload: []const u8) !f64 {
    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, payload, .{});
    defer parsed.deinit();

    // Extract fields like a real component would
    var total: f64 = 0;
    if (parsed.value.object.get("items")) |items| {
        if (items == .array) {
            for (items.array.items) |item| {
                if (item.object.get("price")) |price| {
                    switch (price) {
                        .integer => |i| total += @floatFromInt(i),
                        .float => |f| total += f,
                        else => {},
                    }
                }
            }
        }
    }
    return total;
}

// ── Busy-wait to simulate work ──

fn busyWaitUs(us: i64) void {
    const start = time.microTimestamp();
    while (time.microTimestamp() - start < us) {
        std.atomic.spinLoopHint();
    }
}

// ── JSON payload server ──

fn serverThread(port: u16) void {
    // Read payload files
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Read the medium payload (10KB — realistic API response)
    const payload = fs.cwd().readFileAlloc(allocator, "payloads/medium.json", 1024 * 1024) catch |err| {
        std.debug.print("Server: cannot read payload: {}\n", .{err});
        return;
    };
    defer allocator.free(payload);

    const header_fmt = "HTTP/1.1 200 OK\r\nContent-Length: {d}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n";
    var header_buf: [256]u8 = undefined;
    const header = std.fmt.bufPrint(&header_buf, header_fmt, .{payload.len}) catch return;

    const address = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
    var server = address.listen(.{ .reuse_address = true }) catch |err| {
        std.debug.print("Server: listen failed: {}\n", .{err});
        return;
    };
    defer server.deinit();

    while (g_stats.running.load(.acquire)) {
        const conn = server.accept() catch continue;
        defer conn.stream.close();

        // Read request (discard)
        var req_buf: [1024]u8 = undefined;
        _ = conn.stream.read(&req_buf) catch continue;

        // Send response
        conn.stream.writeAll(header) catch continue;
        conn.stream.writeAll(payload) catch continue;
    }
}

// ── Network thread — fires fetches, parses responses ──

fn networkThread(port: u16) void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var recv_buf: [64 * 1024]u8 = undefined;

    while (g_stats.running.load(.acquire)) {
        const level = g_stats.level.load(.acquire);
        // At level 1: 1 fetch per iteration, level 6: 32 fetches
        const fetches_per_burst: u32 = @as(u32, 1) << @intCast(@min(level, 6) - 1);

        var burst: u32 = 0;
        while (burst < fetches_per_burst and g_stats.running.load(.acquire)) : (burst += 1) {
            const addr = net.Address.initIp4(.{ 127, 0, 0, 1 }, port);
            const stream = net.tcpConnectToAddress(addr) catch continue;
            defer stream.close();

            // Send HTTP GET
            stream.writeAll("GET /data HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n") catch continue;

            // Read response
            var total_read: usize = 0;
            while (true) {
                const n = stream.read(recv_buf[total_read..]) catch break;
                if (n == 0) break;
                total_read += n;
            }

            _ = g_stats.fetch_count.fetchAdd(1, .monotonic);
            _ = g_stats.total_bytes.fetchAdd(total_read, .monotonic);

            // Find body (after \r\n\r\n)
            const response = recv_buf[0..total_read];
            if (std.mem.indexOf(u8, response, "\r\n\r\n")) |body_start| {
                const body = response[body_start + 4 ..];

                // Parse JSON and push result through bridge queue
                const t0 = time.microTimestamp();
                const result = simulateJsonParse(allocator, body) catch continue;
                const parse_us = time.microTimestamp() - t0;

                // Bridge: push parsed result to UI thread
                const parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch continue;
                var item_count: u32 = 0;
                if (parsed.value.object.get("items")) |items| {
                    if (items == .array) item_count = @intCast(items.array.items.len);
                }
                parsed.deinit();
                bridgePush(result, item_count);

                _ = g_stats.parse_count.fetchAdd(1, .monotonic);
                _ = g_stats.total_parse_us.fetchAdd(parse_us, .monotonic);
            }
        }

        // Small sleep to not totally saturate CPU between bursts
        std.Thread.sleep(1_000_000); // 1ms
    }
}

// ── Result queue (simulates bridge: network thread → UI thread) ──

const BridgeSlot = struct {
    total: f64 = 0,
    item_count: u32 = 0,
    populated: bool = false,
};

const BRIDGE_QUEUE_SIZE = 256;
var g_bridge_queue: [BRIDGE_QUEUE_SIZE]BridgeSlot = [_]BridgeSlot{.{}} ** BRIDGE_QUEUE_SIZE;
var g_bridge_head = std.atomic.Value(usize).init(0);
var g_bridge_tail = std.atomic.Value(usize).init(0);
var g_bridge_cost_us = std.atomic.Value(i64).init(0); // total bridge overhead

fn bridgePush(total: f64, count: u32) void {
    const t0 = time.microTimestamp();
    const tail = g_bridge_tail.load(.acquire);
    const next = (tail + 1) % BRIDGE_QUEUE_SIZE;
    if (next == g_bridge_head.load(.acquire)) return; // full, drop
    g_bridge_queue[tail] = .{ .total = total, .item_count = count, .populated = true };
    g_bridge_tail.store(next, .release);
    _ = g_bridge_cost_us.fetchAdd(time.microTimestamp() - t0, .monotonic);
}

fn bridgePop() ?BridgeSlot {
    const t0 = time.microTimestamp();
    const head = g_bridge_head.load(.acquire);
    if (head == g_bridge_tail.load(.acquire)) return null;
    const slot = g_bridge_queue[head];
    g_bridge_head.store((head + 1) % BRIDGE_QUEUE_SIZE, .release);
    _ = g_bridge_cost_us.fetchAdd(time.microTimestamp() - t0, .monotonic);
    return slot;
}

// ── UI thread — simulates 60fps render loop ──
// mode=false: threaded (parsing on network thread, UI just drains bridge queue)
// mode=true: same-thread (UI also does inline JSON parsing from a pre-loaded payload)

var g_same_thread_mode = std.atomic.Value(bool).init(false);
var g_inline_payload: []const u8 = &[_]u8{};

fn uiThread() void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    while (g_stats.running.load(.acquire)) {
        const frame_start = time.microTimestamp();

        // Simulate state updates
        var state_sink: u64 = 0;
        const level = g_stats.level.load(.acquire);
        const state_count: u64 = @as(u64, UI_STATE_UPDATES) * @as(u64, @min(level, 4));
        for (0..state_count) |i| {
            state_sink +%= i *% 7 +% @as(u64, @intCast(frame_start));
        }
        std.mem.doNotOptimizeAway(&state_sink);

        // Simulate layout
        busyWaitUs(@as(i64, UI_LAYOUT_WORK_US) * @as(i64, @intCast(@min(level, 3))));

        // Simulate paint
        busyWaitUs(UI_PAINT_WORK_US);

        // Network result consumption
        if (g_same_thread_mode.load(.acquire)) {
            // SAME THREAD: parse JSON inline (simulates QuickJS JSON.parse on main thread)
            const parse_count = @min(level, 6);
            for (0..parse_count) |_| {
                if (g_inline_payload.len > 0) {
                    const pt0 = time.microTimestamp();
                    const result = simulateJsonParse(allocator, g_inline_payload) catch continue;
                    const parse_us = time.microTimestamp() - pt0;
                    std.mem.doNotOptimizeAway(&result);
                    _ = g_stats.parse_count.fetchAdd(1, .monotonic);
                    _ = g_stats.total_parse_us.fetchAdd(parse_us, .monotonic);
                }
            }
        } else {
            // THREADED: just drain the bridge queue (results already parsed)
            while (bridgePop()) |slot| {
                std.mem.doNotOptimizeAway(&slot.total);
            }
        }

        const frame_time = time.microTimestamp() - frame_start;
        g_stats.frame_time_us.store(frame_time, .release);
        _ = g_stats.frame_count.fetchAdd(1, .monotonic);

        if (frame_time > FRAME_BUDGET_US) {
            _ = g_stats.frame_overrun_count.fetchAdd(1, .monotonic);
        }

        var current_max = g_stats.max_frame_us.load(.acquire);
        while (frame_time > current_max) {
            const result = g_stats.max_frame_us.cmpxchgWeak(current_max, frame_time, .release, .acquire);
            if (result) |v| {
                current_max = v;
            } else break;
        }

        const remaining = FRAME_BUDGET_US - frame_time;
        if (remaining > 0) {
            std.Thread.sleep(@intCast(remaining * 1000));
        }
    }
}

fn getRssKb() u64 {
    const file = fs.openFileAbsolute("/proc/self/status", .{}) catch return 0;
    defer file.close();
    var buf: [8192]u8 = undefined;
    const n = file.readAll(&buf) catch return 0;
    var lines = std.mem.splitScalar(u8, buf[0..n], '\n');
    while (lines.next()) |line| {
        if (std.mem.startsWith(u8, line, "VmRSS:")) {
            var it = std.mem.tokenizeScalar(u8, line, ' ');
            _ = it.next();
            if (it.next()) |val| return std.fmt.parseInt(u64, val, 10) catch 0;
        }
    }
    return 0;
}

fn resetStats() void {
    g_stats = Stats{};
    g_bridge_head.store(0, .release);
    g_bridge_tail.store(0, .release);
    g_bridge_cost_us.store(0, .release);
}

fn runMode(port: u16, mode_name: []const u8, same_thread: bool, duration: u32) !void {
    resetStats();
    g_same_thread_mode.store(same_thread, .release);

    std.debug.print("\n=== {s} ===\n", .{mode_name});
    if (same_thread) {
        std.debug.print("JSON parsing on UI thread (simulates QuickJS main-thread parse)\n", .{});
    } else {
        std.debug.print("JSON parsing on network thread, bridge queue to UI\n", .{});
    }
    std.debug.print("{s:<4} {s:>5} {s:>5} {s:>8} {s:>8} {s:>8} {s:>8} {s:>7} {s:>9} {s:>6}\n", .{
        "Sec", "Lvl", "FPS", "Frame", "Max", "Fetch/s", "Parse/s", "AvgP", "Bridge", "RSS",
    });
    std.debug.print("{s:<4} {s:>5} {s:>5} {s:>8} {s:>8} {s:>8} {s:>8} {s:>7} {s:>9} {s:>6}\n", .{
        "---", "---", "---", "------", "------", "-------", "-------", "-----", "-------", "----",
    });

    const ui_thread = try std.Thread.spawn(.{}, uiThread, .{});
    var net_thread: ?std.Thread = null;
    if (!same_thread) {
        net_thread = try std.Thread.spawn(.{}, networkThread, .{port});
    }

    var last_escalation = time.microTimestamp();
    var last_frames: u64 = 0;
    var last_fetches: u64 = 0;
    var last_parses: u64 = 0;
    var last_bridge: i64 = 0;
    var second: u32 = 0;

    while (second < duration) {
        std.Thread.sleep(1_000_000_000);
        second += 1;
        const now = time.microTimestamp();

        if (now - last_escalation >= RAMP_INTERVAL_SEC * 1_000_000) {
            _ = g_stats.level.fetchAdd(1, .monotonic);
            last_escalation = now;
        }

        const frames = g_stats.frame_count.load(.acquire);
        const fetches = g_stats.fetch_count.load(.acquire);
        const parses = g_stats.parse_count.load(.acquire);
        const total_parse = g_stats.total_parse_us.load(.acquire);
        const frame_time = g_stats.frame_time_us.load(.acquire);
        const max_frame = g_stats.max_frame_us.load(.acquire);
        const level = g_stats.level.load(.acquire);
        const bridge_us = g_bridge_cost_us.load(.acquire);

        const fps = frames - last_frames;
        const fetches_s = fetches - last_fetches;
        const parses_s = parses - last_parses;
        const avg_p = if (parses > 0) @divTrunc(total_parse, @as(i64, @intCast(parses))) else 0;
        const bridge_delta = bridge_us - last_bridge;

        std.debug.print("{d:<4} {d:>5} {d:>5} {d:>7}μ {d:>7}μ {d:>8} {d:>8} {d:>6}μ {d:>8}μ {d:>5}K\n", .{
            second, level, fps, frame_time, max_frame, fetches_s, parses_s, avg_p, bridge_delta, getRssKb(),
        });

        g_stats.max_frame_us.store(0, .release);
        last_frames = frames;
        last_fetches = fetches;
        last_parses = parses;
        last_bridge = bridge_us;
    }

    g_stats.running.store(false, .release);
    ui_thread.join();
    if (net_thread) |nt| nt.join();

    const total_frames = g_stats.frame_count.load(.acquire);
    const total_overruns = g_stats.frame_overrun_count.load(.acquire);
    const total_fetches = g_stats.fetch_count.load(.acquire);
    const total_parses = g_stats.parse_count.load(.acquire);
    const total_bytes = g_stats.total_bytes.load(.acquire);
    const total_bridge = g_bridge_cost_us.load(.acquire);

    std.debug.print("\nSummary: {d} frames ({d:.0} fps), {d} overruns ({d:.1}%), {d} fetches, {d} parses, {d:.1}MB, bridge {d}μs total, RSS {d}KB\n", .{
        total_frames,
        @as(f64, @floatFromInt(total_frames)) / @as(f64, @floatFromInt(duration)),
        total_overruns,
        @as(f64, @floatFromInt(total_overruns)) / @as(f64, @floatFromInt(@max(total_frames, 1))) * 100,
        total_fetches,
        total_parses,
        @as(f64, @floatFromInt(total_bytes)) / (1024 * 1024),
        total_bridge,
        getRssKb(),
    });
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const port: u16 = 9500;

    // Load payload for same-thread mode
    const payload = try fs.cwd().readFileAlloc(allocator, "payloads/medium.json", 1024 * 1024);
    defer allocator.free(payload);
    g_inline_payload = payload;

    std.debug.print("\n=== Networking Stress Test ===\n", .{});
    std.debug.print("UI work/frame: layout ~{d}μs + paint ~{d}μs + {d} state updates\n", .{ UI_LAYOUT_WORK_US, UI_PAINT_WORK_US, UI_STATE_UPDATES });
    std.debug.print("Payload: {d} bytes (medium.json)\n", .{payload.len});
    std.debug.print("Parser: std.json (pessimistic — QuickJS JSON.parse is 3-6× faster)\n", .{});

    // Start payload server
    const server_thread = try std.Thread.spawn(.{}, serverThread, .{port});
    std.Thread.sleep(200_000_000); // 200ms for bind

    // MODE 1: Threaded — network parsing off-thread, bridge to UI
    try runMode(port, "MODE 1: Threaded (parse off-thread + bridge)", false, TEST_DURATION_SEC);

    // Reset for mode 2
    std.Thread.sleep(500_000_000); // 500ms cooldown

    // MODE 2: Same-thread — parsing inline on UI thread (no network fetch, just parse)
    try runMode(port, "MODE 2: Same-thread (parse on UI thread)", true, TEST_DURATION_SEC);

    server_thread.detach();
}
