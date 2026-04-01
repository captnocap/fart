//! Handler Test Harness — Headless handler validator
//!
//! Builds with the app, walks the node tree, fires every handler,
//! and reports segfaults / exceptions / state changes.
//!
//! Usage: zig build test-handlers -Dtest-app=generated_app.zig

const std = @import("std");

// Import the app under test - provides: root, JS_LOGIC, and framework imports
const app = @import("generated_app.zig");

// Re-export what we need from the app
const root = app.root;
const JS_LOGIC = if (@hasDecl(app, "JS_LOGIC")) app.JS_LOGIC else "";

// Signal handling for catching segfaults
const c = @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cInclude("signal.h");
    @cInclude("setjmp.h");
});

var g_jump_buffer: c.sigjmp_buf = undefined;
var g_segfault_caught: bool = false;

const HandlerType = enum {
    zig_on_press,
    js_on_press,
    lua_on_press,
};

const HandlerInfo = struct {
    name: []const u8,
    path: []const u8,
    handler_type: HandlerType,
    zig_handler: ?*const fn () void,
    js_expr: ?[:0]const u8,
    lua_expr: ?[:0]const u8,
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

    try stdout.print("App imported successfully.\n", .{});
    try stdout.print("JS_LOGIC length: {d} bytes\n", .{JS_LOGIC.len});
    
    // Note: We can't easily access the framework modules from the app
    // without complex re-exports. For now, report what we can.
    
    try stdout.print("\nNote: Full handler testing requires framework initialization.\n", .{});
    try stdout.print("This skeleton validates the build integration.\n", .{});
    try stdout.print("\nTo test handlers fully, the app needs to export:\n", .{});
    try stdout.print("  - state module (for state tracking)\n", .{});
    try stdout.print("  - qjs_runtime module (for JS handler execution)\n", .{});
    try stdout.print("  - Node type (for tree walking)\n", .{});

    return 0;
}
