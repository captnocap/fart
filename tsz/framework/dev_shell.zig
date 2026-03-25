//! Hot-reload development shell for tsz apps.
//!
//! Loads a compiled .tsz app from a shared library (.so), runs the engine,
//! and hot-reloads when the .so is recompiled. The window stays open, GPU
//! context is preserved, and only the app code (node tree, state, handlers)
//! is swapped.
//!
//! Usage: tsz-dev <path-to-app.so>

const std = @import("std");
const layout = @import("layout.zig");
const engine = @import("engine.zig");
const Node = layout.Node;

// ── Function pointer types matching the C ABI exports from generated code ──

const GetRootFn = *const fn () callconv(.c) *Node;
const GetInitFn = *const fn () callconv(.c) ?*const fn () void;
const GetTickFn = *const fn () callconv(.c) ?*const fn (u32) void;
const GetTitleFn = *const fn () callconv(.c) [*:0]const u8;
const GetJsLogicFn = *const fn () callconv(.c) [*]const u8;
const GetJsLogicLenFn = *const fn () callconv(.c) usize;

// ── Module-level state for the hot-reload mechanism ──

var g_lib: ?std.DynLib = null;
var g_lib_path: []const u8 = "";
var g_last_mtime: i128 = 0;
var g_shadow_counter: u32 = 0;
var g_shadow_buf: [256]u8 = undefined;

// ── Entry point ──

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    if (args.len < 2) {
        std.debug.print("Usage: tsz-dev <path-to-app.so>\n", .{});
        std.debug.print("\nHot-reload development shell. Loads a .tsz app from a shared library\n", .{});
        std.debug.print("and automatically reloads when the .so is recompiled.\n", .{});
        std.debug.print("\nBuild the .so with: zig build app-lib\n", .{});
        return;
    }

    g_lib_path = args[1];

    // Initial load
    loadLibrary() catch |err| {
        std.debug.print("[dev-shell] Failed to load {s}: {}\n", .{ g_lib_path, err });
        return;
    };

    // Record initial mtime
    if (std.fs.cwd().statFile(g_lib_path)) |stat| {
        g_last_mtime = stat.mtime;
    } else |_| {}

    // Build AppConfig from .so symbols
    var config = buildConfig() catch |err| {
        std.debug.print("[dev-shell] Symbol lookup failed: {}\n", .{err});
        return;
    };
    config.check_reload = &checkReload;

    std.debug.print("[dev-shell] Loaded {s}\n", .{g_lib_path});
    std.debug.print("[dev-shell] Watching for changes... (rebuild .so to hot-reload)\n", .{});

    try engine.run(config);
}

// ── Library loading ──

fn loadLibrary() !void {
    // Close existing library
    if (g_lib) |*lib| lib.close();

    // Shadow copy to a temp file — avoids file lock conflicts during rebuild.
    // Each reload gets a new temp path so dlopen sees a fresh library.
    const shadow_path = std.fmt.bufPrint(&g_shadow_buf, "/tmp/tsz_hot_{d}.so", .{g_shadow_counter}) catch
        return error.FileNotFound;
    g_shadow_counter += 1;

    // Copy the .so to the shadow path
    const src = std.fs.cwd().openFile(g_lib_path, .{}) catch return error.FileNotFound;
    defer src.close();

    const dst_path_abs = shadow_path;
    const dst = std.fs.createFileAbsolute(dst_path_abs, .{}) catch return error.FileNotFound;
    defer dst.close();

    // Read and write in chunks
    var buf: [65536]u8 = undefined;
    while (true) {
        const n = src.read(&buf) catch return error.FileNotFound;
        if (n == 0) break;
        dst.writeAll(buf[0..n]) catch return error.FileNotFound;
    }

    // Open the shadow copy as a dynamic library
    g_lib = std.DynLib.open(dst_path_abs) catch |err| {
        std.debug.print("[dev-shell] dlopen failed for {s}: {}\n", .{ dst_path_abs, err });
        return error.FileNotFound;
    };
}

// ── Symbol lookup ──

fn buildConfig() !engine.AppConfig {
    var lib = g_lib orelse return error.FileNotFound;

    const get_root = lib.lookup(GetRootFn, "app_get_root") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_root\n", .{});
        return error.FileNotFound;
    };
    const get_init = lib.lookup(GetInitFn, "app_get_init") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_init\n", .{});
        return error.FileNotFound;
    };
    const get_tick = lib.lookup(GetTickFn, "app_get_tick") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_tick\n", .{});
        return error.FileNotFound;
    };
    const get_title = lib.lookup(GetTitleFn, "app_get_title") orelse {
        std.debug.print("[dev-shell] Missing symbol: app_get_title\n", .{});
        return error.FileNotFound;
    };

    var config = engine.AppConfig{
        .title = get_title(),
        .root = get_root(),
        .init = get_init(),
        .tick = get_tick(),
    };

    // JS logic (optional — may not be present in all apps)
    const maybe_js = lib.lookup(GetJsLogicFn, "app_get_js_logic");
    const maybe_js_len = lib.lookup(GetJsLogicLenFn, "app_get_js_logic_len");
    if (maybe_js) |get_js| {
        if (maybe_js_len) |get_len| {
            const ptr = get_js();
            const len = get_len();
            if (len > 0) {
                config.js_logic = ptr[0..len];
            }
        }
    }

    // Update the stored lib handle (we may have used a local copy)
    g_lib = lib;

    return config;
}

// ── Hot-reload check (called every frame by the engine) ──

fn checkReload(config: *engine.AppConfig) bool {
    // Poll the .so file's modification time
    const stat = std.fs.cwd().statFile(g_lib_path) catch return false;
    if (stat.mtime == g_last_mtime) return false;

    // Modification detected — wait briefly for the file to be fully written
    std.Thread.sleep(100 * std.time.ns_per_ms);

    // Re-check mtime (in case it changed again during the wait)
    const stat2 = std.fs.cwd().statFile(g_lib_path) catch return false;
    g_last_mtime = stat2.mtime;

    // Load the new library
    loadLibrary() catch |err| {
        std.debug.print("[hot-reload] Load failed: {}\n", .{err});
        return false;
    };

    // Look up new symbols and update the config
    const new_config = buildConfig() catch |err| {
        std.debug.print("[hot-reload] Symbol lookup failed: {}\n", .{err});
        return false;
    };

    config.root = new_config.root;
    config.init = new_config.init;
    config.tick = new_config.tick;
    // Keep the same title and check_reload callback

    return true;
}
