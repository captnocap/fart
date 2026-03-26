//! Web engine — thin GPU terminal + v86 serial bridge.
//!
//! Per WEB_ARCHITECTURE.md: the browser-side wasm is a dumb renderer.
//! It receives draw commands (currently: local layout, will become VM serial).
//! It sends back input events (click, key, resize).
//!
//! Phase 1: local layout + v86 serial → terminal text node.
//! Phase 2: VM sends serialized node tree → browser just paints.

const std = @import("std");
const builtin = @import("builtin");
const layout = @import("layout.zig");
const gpu = @import("gpu/gpu.zig");
const wgpu = @import("wgpu");
const Node = layout.Node;
const Color = layout.Color;

const c = @import("c.zig").imports;

// ── Emscripten C API ────────────────────────────────────────────────

extern "env" fn emscripten_console_log(msg: [*:0]const u8) void;
extern "c" fn emscripten_set_main_loop(func: *const fn () callconv(.c) void, fps: c_int, sim_infinite: c_int) void;
extern "c" fn emscripten_webgpu_get_device() ?*anyopaque;
extern "c" fn emscripten_get_canvas_element_size(target: [*:0]const u8, width: *c_int, height: *c_int) c_int;

fn webLog(comptime fmt_str: []const u8, args: anytype) void {
    var buf: [512]u8 = undefined;
    const msg = std.fmt.bufPrint(&buf, fmt_str ++ "\x00", args) catch return;
    emscripten_console_log(@ptrCast(msg.ptr));
}

// ── AppConfig (same interface as engine.zig) ────────────────────────

pub const AppConfig = struct {
    title: [*:0]const u8 = "tsz app",
    width: u32 = 1280,
    height: u32 = 800,
    min_width: u32 = 320,
    min_height: u32 = 240,
    root: *Node,
    js_logic: []const u8 = "",
    lua_logic: []const u8 = "",
    init: ?*const fn () void = null,
    tick: ?*const fn (now_ms: u32) void = null,
    check_reload: ?*const fn (*AppConfig) bool = null,
    post_reload: ?*const fn () void = null,
};

// ── Terminal buffer (v86 serial → text) ─────────────────────────────

const TERM_BUF_SIZE = 32 * 1024;
var g_term_buf: [TERM_BUF_SIZE]u8 = undefined;
var g_term_len: usize = 0;
var g_term_dirty: bool = false;
var g_term_node: ?*Node = null;

/// Exported to JS — receive a chunk of serial data (append).
export fn web_serial_write(ptr: [*]const u8, len: usize) void {
    const avail = TERM_BUF_SIZE - g_term_len;
    const to_copy = @min(len, avail);
    if (to_copy > 0) {
        @memcpy(g_term_buf[g_term_len .. g_term_len + to_copy], ptr[0..to_copy]);
        g_term_len += to_copy;
        g_term_dirty = true;
    }
}

/// Exported to JS — single byte from v86 serial0-output-byte.
export fn web_serial_char(byte: u8) void {
    if (g_term_len < TERM_BUF_SIZE) {
        g_term_buf[g_term_len] = byte;
        g_term_len += 1;
        g_term_dirty = true;
    }
}

/// Exported to JS — click at canvas coordinates.
export fn web_click(x: f32, y: f32) void {
    _ = x;
    _ = y;
    // Phase 1: click handling is done in JS (boot button detection).
    // Phase 2: hit test against last node tree, send event to VM.
}

// ── Text measurement (for layout — Phase 1 only, moves to VM later) ─

var g_measure_face: c.FT_Face = null;

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, _: f32, _: f32, _: u16, _: bool) layout.TextMetrics {
    const face = g_measure_face orelse return .{};
    if (font_size == 0) return .{};

    _ = c.FT_Set_Pixel_Sizes(face, 0, font_size);
    const line_h: f32 = @as(f32, @floatFromInt(face.*.size.*.metrics.height)) / 64.0;

    var pen_x: f32 = 0;
    var max_line_w: f32 = 0;
    var lines: f32 = 1;
    var i: usize = 0;

    while (i < t.len) {
        var cp: u32 = t[i];
        var len: usize = 1;
        if (cp >= 0xC0 and i + 1 < t.len) {
            if (cp < 0xE0) { cp = ((cp & 0x1F) << 6) | (t[i + 1] & 0x3F); len = 2; } else if (cp < 0xF0 and i + 2 < t.len) { cp = ((cp & 0x0F) << 12) | (@as(u32, t[i + 1] & 0x3F) << 6) | (t[i + 2] & 0x3F); len = 3; } else if (i + 3 < t.len) { cp = ((cp & 0x07) << 18) | (@as(u32, t[i + 1] & 0x3F) << 12) | (@as(u32, t[i + 2] & 0x3F) << 6) | (t[i + 3] & 0x3F); len = 4; }
        }
        i += len;
        if (cp == '\n') { if (pen_x > max_line_w) max_line_w = pen_x; pen_x = 0; lines += 1; continue; }
        if (c.FT_Load_Char(face, cp, c.FT_LOAD_DEFAULT) == 0) {
            const advance: f32 = @as(f32, @floatFromInt(face.*.glyph.*.advance.x)) / 64.0;
            if (max_width > 0 and pen_x + advance > max_width and pen_x > 0) { if (pen_x > max_line_w) max_line_w = pen_x; pen_x = 0; lines += 1; }
            pen_x += advance;
        }
    }
    if (pen_x > max_line_w) max_line_w = pen_x;
    return .{ .width = if (max_width > 0) @min(max_line_w, max_width) else max_line_w, .height = lines * line_h };
}

// ── State ───────────────────────────────────────────────────────────

var g_config: AppConfig = undefined;
var g_initialized: bool = false;
var g_width: u32 = 800;
var g_height: u32 = 600;
var g_frame_count: u32 = 0;

// ── Paint ───────────────────────────────────────────────────────────

fn paintNode(node: *Node) void {
    if (node.style.display == .none) return;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;

    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            gpu.drawRect(
                r.x, r.y, r.w, r.h,
                @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0,
                node.style.border_radius, node.style.brdTop(),
                @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0,
            );
        }
    }

    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            _ = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, @as(f32, @floatFromInt(tc.a)) / 255.0,
                node.number_of_lines,
            );
        }
    }

    for (node.children) |*child| paintNode(child);
}

/// Find the terminal text node: root → child[1] (terminal box) → child[0] (text).
fn findTermNode(root: *Node) ?*Node {
    if (root.children.len > 1) {
        const term_box = &root.children[1];
        if (term_box.children.len > 0) {
            return &term_box.children[0];
        }
    }
    return null;
}

// ── Frame callback ──────────────────────────────────────────────────

fn webFrame() callconv(.c) void {
    if (!g_initialized) return;
    g_frame_count += 1;

    // Update terminal text node with serial buffer
    if (g_term_dirty) {
        if (g_term_node) |tn| {
            tn.text = g_term_buf[0..g_term_len];
        }
        g_term_dirty = false;
    }

    const w_f: f32 = @floatFromInt(g_width);
    const h_f: f32 = @floatFromInt(g_height);

    if (g_config.tick) |tick_fn| tick_fn(g_frame_count);

    const root = g_config.root;
    if (root.style.width == null or root.style.width.? < 0) root.style.width = w_f;
    if (root.style.height == null or root.style.height.? < 0) root.style.height = h_f;
    layout.layout(root, 0, 0, w_f, h_f);

    paintNode(root);
    gpu.frame(0.051, 0.067, 0.090);
}

// ── Run ─────────────────────────────────────────────────────────────

pub fn run(config: AppConfig) !void {
    g_config = config;

    var cw: c_int = 0;
    var ch: c_int = 0;
    _ = emscripten_get_canvas_element_size("#canvas", &cw, &ch);
    g_width = if (cw > 0) @intCast(cw) else 800;
    g_height = if (ch > 0) @intCast(ch) else 600;

    webLog("[engine_web] starting: {s} ({d}x{d})", .{ config.title, g_width, g_height });

    // WebGPU
    const raw_device = emscripten_webgpu_get_device();
    const device: *wgpu.Device = @ptrCast(raw_device orelse return error.GPUInitFailed);
    const queue = device.getQueue() orelse return error.GPUInitFailed;
    gpu.initWeb(device, queue, g_width, g_height) catch return error.GPUInitFailed;

    // FreeType (Phase 1 — text measurement + rendering in browser)
    var library: c.FT_Library = null;
    if (c.FT_Init_FreeType(&library) != 0) return error.FontNotFound;
    var face: c.FT_Face = null;
    if (c.FT_New_Face(library, "/font.ttf", 0, &face) != 0) return error.FontNotFound;
    gpu.initText(library, face, @as([*]const c.FT_Face, &.{}), 0);
    g_measure_face = face;
    layout.setMeasureFn(measureCallback);

    // App init
    if (config.init) |init_fn| init_fn();

    // Find terminal text node for serial output
    g_term_node = findTermNode(config.root);
    @memcpy(g_term_buf[0..30], "Waiting for v86 boot...\n\n$ _\x00\x00");
    g_term_len = 28;
    if (g_term_node) |tn| tn.text = g_term_buf[0..g_term_len];

    g_initialized = true;
    webLog("[engine_web] ready — terminal node: {any}", .{g_term_node != null});

    emscripten_set_main_loop(&webFrame, 0, 0);
}
