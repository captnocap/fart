//! Handler Test Harness — Headless handler validator
//!
//! Builds with the app, walks the node tree, fires every handler,
//! and reports segfaults / exceptions / state changes.
//!
//! Usage: zig build test-handlers -Dtest-app=generated_app.zig

const std = @import("std");
const builtin = @import("builtin");

// Import the app under test - path set at compile time via build options
const app = @import("app_under_test");

// Signal handling for catching segfaults
const c = @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cInclude("signal.h");
    @cInclude("setjmp.h");
});

// Global state for signal handling  
var g_jump_buffer: c.sigjmp_buf = undefined;
var g_segfault_caught: bool = false;

const HandlerInfo = struct {
    name: []const u8,
    path: []const u8,
    handler_type: HandlerType,
    zig_handler: ?*const fn () void,
    js_expr: ?[:0]const u8,
    lua_expr: ?[:0]const u8,
};

const HandlerType = enum {
    zig_on_press,
    js_on_press,
    lua_on_press,
};

const TestResult = struct {
    name: []const u8,
    path: []const u8,
    handler_type: HandlerType,
    passed: bool,
    error_msg: ?[]const u8,
    state_changed: bool,
    duration_us: i64,
};

// Signal handler for segfaults
fn segfaultHandler(sig: c_int, info: *c.siginfo_t, _: ?*anyopaque) callconv(.C) void {
    _ = info;
    if (sig == c.SIGSEGV or sig == c.SIGBUS or sig == c.SIGILL or sig == c.SIGFPE) {
        g_segfault_caught = true;
        _ = c.siglongjmp(&g_jump_buffer, 1);
    }
}

fn setupSignalHandlers() void {
    var sa: c.struct_sigaction = std.mem.zeroes(c.struct_sigaction);
    sa.sa_flags = c.SA_SIGINFO;
    sa.sa_sigaction = @ptrCast(&segfaultHandler);
    _ = c.sigemptyset(&sa.sa_mask);

    _ = c.sigaction(c.SIGSEGV, &sa, null);
    _ = c.sigaction(c.SIGBUS, &sa, null);
    _ = c.sigaction(c.SIGILL, &sa, null);
    _ = c.sigaction(c.SIGFPE, &sa, null);
}

fn restoreDefaultHandlers() void {
    var sa: c.struct_sigaction = std.mem.zeroes(c.struct_sigaction);
    sa.sa_handler = c.SIG_DFL;
    _ = c.sigemptyset(&sa.sa_mask);

    _ = c.sigaction(c.SIGSEGV, &sa, null);
    _ = c.sigaction(c.SIGBUS, &sa, null);
    _ = c.sigaction(c.SIGILL, &sa, null);
    _ = c.sigaction(c.SIGFPE, &sa, null);
}

// ═════════════════════════════════════════════════════════════════════════════
// State snapshot for detecting changes
// ═════════════════════════════════════════════════════════════════════════════

const StateSnapshot = struct {
    slots: [16]i64,
    dirty: bool,

    fn capture() StateSnapshot {
        const state = @import("framework/state.zig");
        var s: StateSnapshot = undefined;
        for (0..16) |i| {
            s.slots[i] = state.getSlot(i);
        }
        s.dirty = state.isDirty();
        return s;
    }

    fn equals(self: StateSnapshot, other: StateSnapshot) bool {
        if (self.dirty != other.dirty) return false;
        for (0..16) |i| {
            if (self.slots[i] != other.slots[i]) return false;
        }
        return true;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// Handler testing
// ═════════════════════════════════════════════════════════════════════════════

fn testHandler(allocator: std.mem.Allocator, info: HandlerInfo) !TestResult {
    const before = StateSnapshot.capture();
    var error_msg: ?[]const u8 = null;
    var passed = true;
    g_segfault_caught = false;

    const start = std.time.microTimestamp();

    const qjs_runtime = @import("framework/qjs_runtime.zig");

    // Use sigsetjmp to recover from segfaults
    if (c.sigsetjmp(&g_jump_buffer, 1) == 0) {
        switch (info.handler_type) {
            .zig_on_press => {
                if (info.zig_handler) |handler| {
                    handler();
                }
            },
            .js_on_press => {
                if (info.js_expr) |expr| {
                    const expr_slice = std.mem.span(expr);
                    // Extract function name (everything before '(')
                    if (std.mem.indexOf(u8, expr_slice, "(")) |paren_idx| {
                        const func_name = expr_slice[0..paren_idx];
                        qjs_runtime.callGlobal(func_name);
                    } else {
                        // Just eval the expression directly
                        qjs_runtime.evalExpr(expr_slice);
                    }
                }
            },
            .lua_on_press => {
                // Lua handlers not tested in headless mode (would need LuaJIT)
                error_msg = "Lua handlers skipped in headless mode";
                passed = false;
            },
        }
    } else {
        // We got here via longjmp from segfault handler
        if (g_segfault_caught) {
            error_msg = "SEGFAULT (signal caught)";
        } else {
            error_msg = "Signal caught";
        }
        passed = false;
    }

    const duration = std.time.microTimestamp() - start;
    const after = StateSnapshot.capture();
    const state_changed = !before.equals(after);

    return .{
        .name = try allocator.dupe(u8, info.name),
        .path = try allocator.dupe(u8, info.path),
        .handler_type = info.handler_type,
        .passed = passed,
        .error_msg = if (error_msg) |msg| try allocator.dupe(u8, msg) else null,
        .state_changed = state_changed,
        .duration_us = duration,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Handler discovery
// ═════════════════════════════════════════════════════════════════════════════

fn collectHandlers(
    allocator: std.mem.Allocator,
    node: anytype,
    path: []const u8,
    handlers: *std.ArrayList(HandlerInfo),
) !void {
    const layout = @import("framework/layout.zig");
    const Node = layout.Node;
    
    const node_ptr: *Node = if (@TypeOf(node) == *Node) node else @constCast(node);
    const h = &node_ptr.handlers;

    // Check for Zig handler (on_press function pointer)
    if (h.on_press) |zig_handler| {
        const name = node_ptr.debug_name orelse "unnamed";
        const full_path = try std.fmt.allocPrint(allocator, "{s}.on_press", .{path});
        try handlers.append(.{
            .name = name,
            .path = full_path,
            .handler_type = .zig_on_press,
            .zig_handler = zig_handler,
            .js_expr = null,
            .lua_expr = null,
        });
    }

    // Check for JS handler (js_on_press string)
    if (h.js_on_press) |js_expr| {
        const name = node_ptr.debug_name orelse "unnamed";
        const full_path = try std.fmt.allocPrint(allocator, "{s}.js_on_press", .{path});
        try handlers.append(.{
            .name = name,
            .path = full_path,
            .handler_type = .js_on_press,
            .zig_handler = null,
            .js_expr = js_expr,
            .lua_expr = null,
        });
    }

    // Check for Lua handler (lua_on_press string)
    if (h.lua_on_press) |lua_expr| {
        const name = node_ptr.debug_name orelse "unnamed";
        const full_path = try std.fmt.allocPrint(allocator, "{s}.lua_on_press", .{path});
        try handlers.append(.{
            .name = name,
            .path = full_path,
            .handler_type = .lua_on_press,
            .zig_handler = null,
            .js_expr = null,
            .lua_expr = lua_expr,
        });
    }

    // Recurse into children
    for (node_ptr.children, 0..) |*child, i| {
        const child_path = try std.fmt.allocPrint(allocator, "{s}.children[{d}]", .{ path, i });
        defer allocator.free(child_path);
        try collectHandlers(allocator, child, child_path, handlers);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Main entry point
// ═════════════════════════════════════════════════════════════════════════════

pub fn main() !u8 {
    const stdout = std.io.getStdOut().writer();
    const stderr = std.io.getStdErr().writer();

    try stdout.print("\n═══════════════════════════════════════════════════════════════\n", .{});
    try stdout.print("  Handler Test Harness\n", .{});
    try stdout.print("═══════════════════════════════════════════════════════════════\n\n", .{});

    // Setup signal handlers to catch segfaults
    setupSignalHandlers();
    defer restoreDefaultHandlers();

    // Initialize state
    const state = @import("framework/state.zig");
    state.reset();

    // Initialize QuickJS
    const qjs_runtime = @import("framework/qjs_runtime.zig");
    qjs_runtime.initVM();
    defer qjs_runtime.deinit();

    // Load JS_LOGIC from the app
    if (@hasDecl(app, "JS_LOGIC")) {
        try stdout.print("Loading JS_LOGIC...\n", .{});
        qjs_runtime.evalScript(app.JS_LOGIC);
    } else {
        try stdout.print("Warning: No JS_LOGIC found in app\n", .{});
    }

    // Get root node from app
    if (!@hasDecl(app, "root")) {
        try stderr.print("Error: App must export 'root' node\n", .{});
        return 1;
    }
    const root = &app.root;

    // Collect all handlers
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

    var handlers = std.ArrayList(HandlerInfo).init(allocator);
    defer {
        for (handlers.items) |h| {
            allocator.free(h.path);
        }
        handlers.deinit();
    }

    try stdout.print("Collecting handlers from node tree...\n", .{});
    try collectHandlers(allocator, root, "root", &handlers);

    try stdout.print("Found {d} handlers\n\n", .{handlers.items.len});

    if (handlers.items.len == 0) {
        try stdout.print("No handlers to test.\n", .{});
        return 0;
    }

    // Test each handler
    var results = std.ArrayList(TestResult).init(allocator);
    defer {
        for (results.items) |r| {
            allocator.free(r.name);
            allocator.free(r.path);
            if (r.error_msg) |msg| allocator.free(msg);
        }
        results.deinit();
    }

    var passed_count: usize = 0;
    var failed_count: usize = 0;

    for (handlers.items, 0..) |info, i| {
        const type_str = switch (info.handler_type) {
            .zig_on_press => "Zig ",
            .js_on_press => "JS  ",
            .lua_on_press => "Lua ",
        };

        try stdout.print("[{d}/{d}] {s} {s} ... ", .{ i + 1, handlers.items.len, type_str, info.path });

        const result = try testHandler(allocator, info);
        try results.append(result);

        if (result.passed) {
            try stdout.print("PASS", .{});
            passed_count += 1;
        } else {
            try stdout.print("FAIL", .{});
            failed_count += 1;
        }

        if (result.state_changed) {
            try stdout.print(" [state changed]", .{});
        }

        if (result.error_msg) |msg| {
            try stdout.print(" - {s}", .{msg});
        }

        try stdout.print(" ({d}µs)\n", .{result.duration_us});
    }

    // Summary
    try stdout.print("\n═══════════════════════════════════════════════════════════════\n", .{});
    try stdout.print("Results: {d} passed, {d} failed\n", .{ passed_count, failed_count });
    try stdout.print("═══════════════════════════════════════════════════════════════\n", .{});

    if (failed_count > 0) {
        try stdout.print("\nFailed handlers:\n", .{});
        for (results.items) |r| {
            if (!r.passed) {
                try stdout.print("  - {s} ({s})\n", .{ r.path, r.error_msg orelse "unknown error" });
            }
        }
    }

    return if (failed_count == 0) 0 else 1;
}
