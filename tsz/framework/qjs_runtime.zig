//! QuickJS Runtime — the main loop for <script> mode apps.
//!
//! Provides: SDL2 windowing, QuickJS VM, state bridge, SDL2 painter, telemetry.
//! The generated_app.zig just needs to provide: root node, JS_LOGIC, state init.
//! In lean builds (has_quickjs=false), all public functions are no-ops.

const std = @import("std");
const build_options = @import("build_options");
const qjs_c = @import("qjs_c.zig");
const HAS_QUICKJS = qjs_c.HAS_QUICKJS;

const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const state = @import("state.zig");
const jsv = @import("qjs_value.zig");
const JsVal = jsv.JsVal;
const pty_mod = if (HAS_QUICKJS) @import("pty.zig") else struct {
    pub const Pty = struct {};
};

const HAS_DEBUG_SERVER = if (@hasDecl(build_options, "has_debug_server")) build_options.has_debug_server else false;
const qjs_ipc = if (HAS_DEBUG_SERVER) @import("qjs_ipc.zig") else struct {
    pub fn registerAll(_: *anyopaque) void {}
};

const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ── QuickJS C bindings (shared — single @cImport for type identity) ──
const qjs = qjs_c.qjs;
const QJS_UNDEFINED = qjs_c.UNDEFINED;

var g_qjs_rt: ?*qjs.JSRuntime = null;
var g_qjs_ctx: ?*qjs.JSContext = null;
var g_text_engine: ?*TextEngine = null;

// ── PTY singleton ────────────────────────────────────────────────
var g_pty: ?pty_mod.Pty = null;

// ── Telemetry (written by the main loop, read by JS host functions) ──
pub var telemetry_fps: u32 = 0;
pub var telemetry_layout_us: u64 = 0;
pub var telemetry_paint_us: u64 = 0;
pub var telemetry_tick_us: u64 = 0;
pub var telemetry_bridge_calls: u64 = 0;
pub var bridge_calls_this_second: u64 = 0;
var bridge_last_reset: i64 = 0;

// ── Host functions ──────────────────────────────────────────────

fn hostSetState(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return QJS_UNDEFINED;
    switch (state.getSlotKind(@intCast(slot_id))) {
        .string => {
            const str = qjs.JS_ToCString(ctx, argv[1]);
            if (str == null) return QJS_UNDEFINED;
            defer qjs.JS_FreeCString(ctx, str);
            state.setSlotString(@intCast(slot_id), std.mem.span(str));
        },
        .float => {
            var f: f64 = 0;
            _ = qjs.JS_ToFloat64(ctx, &f, argv[1]);
            state.setSlotFloat(@intCast(slot_id), f);
        },
        .boolean => {
            state.setSlotBool(@intCast(slot_id), qjs.JS_ToBool(ctx, argv[1]) != 0);
        },
        .int => {
            var f: f64 = 0;
            _ = qjs.JS_ToFloat64(ctx, &f, argv[1]);
            state.setSlot(@intCast(slot_id), @intFromFloat(f));
        },
    }
    state.markDirty();
    bridge_calls_this_second += 1;
    return QJS_UNDEFINED;
}

fn hostSetStateString(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return QJS_UNDEFINED;
    const str = qjs.JS_ToCString(ctx, argv[1]);
    if (str == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, str);
    state.setSlotString(@intCast(slot_id), std.mem.span(str));
    state.markDirty();
    return QJS_UNDEFINED;
}

fn hostGetState(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return QJS_UNDEFINED;
    return switch (state.getSlotKind(@intCast(slot_id))) {
        .float => qjs.JS_NewFloat64(null, state.getSlotFloat(@intCast(slot_id))),
        .boolean => qjs.JS_NewFloat64(null, if (state.getSlotBool(@intCast(slot_id))) 1 else 0),
        .int => qjs.JS_NewFloat64(null, @floatFromInt(state.getSlot(@intCast(slot_id)))),
        .string => qjs.JS_NewFloat64(null, 0),
    };
}

fn hostGetStateString(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var slot_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= state.MAX_SLOTS) return QJS_UNDEFINED;
    const s = state.getSlotString(@intCast(slot_id));
    return qjs.JS_NewStringLen(ctx, s.ptr, @intCast(s.len));
}

fn hostLog(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    const msg = qjs.JS_ToCString(ctx, argv[1]);
    if (msg == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, msg);
    std.log.info("[JS] {s}", .{std.mem.span(msg)});
    return QJS_UNDEFINED;
}

fn hostHeavyCompute(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return qjs.JS_NewFloat64(null, 0);
    var n: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &n, argv[0]);
    const compute = @extern(*const fn (c_long) callconv(.c) c_long, .{ .name = "heavy_compute" });
    const result = compute(@intCast(n));
    return qjs.JS_NewFloat64(null, @floatFromInt(result));
}

fn hostHeavyComputeTimed(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return qjs.JS_NewFloat64(null, 0);
    var n: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &n, argv[0]);
    const compute = @extern(*const fn (c_long) callconv(.c) c_long, .{ .name = "heavy_compute_timed" });
    const result = compute(@intCast(n));
    return qjs.JS_NewFloat64(null, @floatFromInt(result));
}

fn hostSetComputeN(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var n: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &n, argv[0]);
    const setter = @extern(*const fn (c_long) callconv(.c) void, .{ .name = "set_compute_n" });
    setter(@intCast(n));
    return QJS_UNDEFINED;
}

fn hostGetActiveNode(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const canvas_mod = @import("canvas.zig");
    if (canvas_mod.getActiveNode()) |idx| {
        return qjs.JS_NewFloat64(null, @floatFromInt(idx));
    }
    return qjs.JS_NewFloat64(null, -1);
}

fn hostGetSelectedNode(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const canvas_mod = @import("canvas.zig");
    if (canvas_mod.getSelectedNode()) |idx| {
        return qjs.JS_NewFloat64(null, @floatFromInt(idx));
    }
    return qjs.JS_NewFloat64(null, -1);
}

fn hostGetInputText(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const input_mod = @import("input.zig");
    if (argc < 1) return qjs.JS_NewString(ctx, "");
    var id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &id, argv[0]);
    const text = input_mod.getText(@intCast(@max(0, id)));
    if (text.len == 0) return qjs.JS_NewString(ctx, "");
    // Need null-terminated string for JS
    return qjs.JS_NewStringLen(ctx, text.ptr, @intCast(text.len));
}

fn hostSetNodeDim(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const canvas_mod = @import("canvas.zig");
    if (argc < 2) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &idx, argv[0]);
    var opacity_f64: f64 = 1.0;
    _ = qjs.JS_ToFloat64(ctx, &opacity_f64, argv[1]);
    canvas_mod.setNodeDim(@intCast(@max(0, idx)), @floatCast(opacity_f64));
    return QJS_UNDEFINED;
}

fn hostResetNodeDim(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const canvas_mod = @import("canvas.zig");
    canvas_mod.resetNodeDim();
    return QJS_UNDEFINED;
}

fn hostSetPathFlow(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const canvas_mod = @import("canvas.zig");
    if (argc < 2) return QJS_UNDEFINED;
    var idx: i32 = 0;
    var enabled: i32 = 1;
    _ = qjs.JS_ToInt32(ctx, &idx, argv[0]);
    _ = qjs.JS_ToInt32(ctx, &enabled, argv[1]);
    canvas_mod.setFlowOverride(@intCast(@max(0, idx)), enabled != 0);
    return QJS_UNDEFINED;
}

fn hostResetPathFlow(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const canvas_mod = @import("canvas.zig");
    canvas_mod.resetFlowOverride();
    return QJS_UNDEFINED;
}

fn hostSetFlowEnabled(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const svg_path = @import("svg_path.zig");
    if (argc < 1) return QJS_UNDEFINED;
    var val: i32 = 2;
    _ = qjs.JS_ToInt32(ctx, &val, argv[0]);
    svg_path.setFlowMode(@intCast(@max(0, @min(2, val))));
    return QJS_UNDEFINED;
}

fn hostGetFps(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_fps));
}
fn hostGetLayoutUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_layout_us));
}
fn hostGetPaintUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_paint_us));
}
fn hostGetTickUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(telemetry_tick_us));
}
fn hostGetMouseX(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    var mx: f32 = 0;
    var my: f32 = 0;
    _ = c.SDL_GetMouseState(&mx, &my);
    return qjs.JS_NewFloat64(null, @floatCast(mx));
}
fn hostGetMouseY(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    var mx: f32 = 0;
    var my: f32 = 0;
    _ = c.SDL_GetMouseState(&mx, &my);
    return qjs.JS_NewFloat64(null, @floatCast(my));
}
fn hostGetMouseDown(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    var mx: f32 = 0;
    var my: f32 = 0;
    const buttons = c.SDL_GetMouseState(&mx, &my);
    return qjs.JS_NewFloat64(null, if (buttons & c.SDL_BUTTON_LMASK != 0) 1.0 else 0.0);
}
fn hostGetMouseRightDown(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    var mx: f32 = 0;
    var my: f32 = 0;
    const buttons = c.SDL_GetMouseState(&mx, &my);
    return qjs.JS_NewFloat64(null, if (buttons & c.SDL_BUTTON_RMASK != 0) 1.0 else 0.0);
}
fn hostIsKeyDown(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return qjs.JS_NewFloat64(null, 0);
    var scancode: c_int = 0;
    _ = qjs.JS_ToInt32(null, &scancode, argv[0]);
    const keys = c.SDL_GetKeyboardState(null);
    if (keys == null) return qjs.JS_NewFloat64(null, 0);
    const pressed = keys[@intCast(scancode)];
    return qjs.JS_NewFloat64(null, if (pressed) @as(f64, 1) else @as(f64, 0));
}

// ── Telemetry host functions (build JS objects from unified snapshot) ──

const tel = @import("telemetry.zig");
const vterm_mod = @import("vterm.zig");
const qjs_semantic = @import("qjs_semantic.zig");

// ── Recording/playback bridge ────────────────────────────────────
const player_mod = @import("player.zig");

fn hostRecStart(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const rows = vterm_mod.getRows();
    const cols = vterm_mod.getCols();
    vterm_mod.startRecording(rows, cols);
    std.debug.print("[rec] started ({d}x{d})\n", .{ rows, cols });
    return QJS_UNDEFINED;
}

fn hostRecStop(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    vterm_mod.stopRecording();
    std.debug.print("[rec] stopped\n", .{});
    return QJS_UNDEFINED;
}

fn hostRecSave(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return qjs.JS_NewFloat64(null, 0);
    const path_c = qjs.JS_ToCString(ctx, argv[0]);
    if (path_c == null) return qjs.JS_NewFloat64(null, 0);
    defer qjs.JS_FreeCString(ctx, path_c);
    const path = std.mem.span(path_c);
    const ok = vterm_mod.saveRecording(path);
    std.debug.print("[rec] save {s} → {s}\n", .{ path, if (ok) "OK" else "FAIL" });
    return qjs.JS_NewFloat64(null, if (ok) 1.0 else 0.0);
}

fn hostRecToggle(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (vterm_mod.isRecording()) {
        vterm_mod.stopRecording();
    } else {
        vterm_mod.startRecording(vterm_mod.getRows(), vterm_mod.getCols());
    }
    return qjs.JS_NewFloat64(null, if (vterm_mod.isRecording()) 1.0 else 0.0);
}

fn hostRecIsRecording(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, if (vterm_mod.isRecording()) 1.0 else 0.0);
}

fn hostRecFrameCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(vterm_mod.getRecorder().frame_count));
}

fn hostPlayLoad(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    // Load from the current recorder's in-memory data
    const rec = vterm_mod.getRecorder();
    if (rec.frame_count == 0) return qjs.JS_NewFloat64(null, 0);
    player_mod.load(rec);
    return qjs.JS_NewFloat64(null, 1.0);
}

fn hostPlayPlay(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    player_mod.play();
    return QJS_UNDEFINED;
}

fn hostPlayPause(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    player_mod.pause();
    return QJS_UNDEFINED;
}

fn hostPlayToggle(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    player_mod.togglePlay();
    return QJS_UNDEFINED;
}

fn hostPlayStep(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    player_mod.step();
    return QJS_UNDEFINED;
}

fn hostPlaySeek(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var frac: f64 = 0;
    _ = qjs.JS_ToFloat64(ctx, &frac, argv[0]);
    player_mod.seekFraction(@floatCast(frac));
    return QJS_UNDEFINED;
}

fn hostPlaySpeed(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    var spd: f64 = 1;
    _ = qjs.JS_ToFloat64(ctx, &spd, argv[0]);
    player_mod.setSpeed(@floatCast(spd));
    return QJS_UNDEFINED;
}

fn hostPlayState(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (!player_mod.isLoaded()) return QJS_UNDEFINED;
    const s = player_mod.getState();
    const obj = qjs.JS_NewObject(c2);
    jsv.setB(c2, obj, "playing", s.playing);
    jsv.setF(c2, obj, "time_us", @floatFromInt(s.time_us));
    jsv.setF(c2, obj, "duration_us", @floatFromInt(s.duration_us));
    jsv.setF(c2, obj, "frame", @floatFromInt(s.frame));
    jsv.setF(c2, obj, "total_frames", @floatFromInt(s.total_frames));
    jsv.setF(c2, obj, "speed", s.speed);
    jsv.setB(c2, obj, "at_end", s.at_end);
    jsv.setB(c2, obj, "at_start", s.at_start);
    jsv.setF(c2, obj, "progress", if (s.duration_us > 0) @as(f64, @floatFromInt(s.time_us)) / @as(f64, @floatFromInt(s.duration_us)) else 0.0);
    return obj;
}

fn hostTelFrame(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "fps", @floatFromInt(s.fps));
    jsv.setF(c2, obj, "tick_us", @floatFromInt(s.tick_us));
    jsv.setF(c2, obj, "layout_us", @floatFromInt(s.layout_us));
    jsv.setF(c2, obj, "paint_us", @floatFromInt(s.paint_us));
    jsv.setF(c2, obj, "frame_total_us", @floatFromInt(s.frame_total_us));
    jsv.setF(c2, obj, "frame_number", @floatFromInt(s.frame_number));
    jsv.setF(c2, obj, "bridge_calls_per_sec", @floatFromInt(s.bridge_calls_per_sec));
    return obj;
}

fn hostTelGpu(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "rect_count", @floatFromInt(s.rect_count));
    jsv.setF(c2, obj, "glyph_count", @floatFromInt(s.glyph_count));
    jsv.setF(c2, obj, "rect_capacity", @floatFromInt(s.rect_capacity));
    jsv.setF(c2, obj, "glyph_capacity", @floatFromInt(s.glyph_capacity));
    jsv.setF(c2, obj, "atlas_glyph_count", @floatFromInt(s.atlas_glyph_count));
    jsv.setF(c2, obj, "atlas_capacity", @floatFromInt(s.atlas_capacity));
    jsv.setF(c2, obj, "atlas_row_x", @floatFromInt(s.atlas_row_x));
    jsv.setF(c2, obj, "atlas_row_y", @floatFromInt(s.atlas_row_y));
    jsv.setF(c2, obj, "scissor_depth", @floatFromInt(s.scissor_depth));
    jsv.setF(c2, obj, "scissor_segment_count", @floatFromInt(s.scissor_segment_count));
    jsv.setF(c2, obj, "gpu_surface_w", @floatFromInt(s.gpu_surface_w));
    jsv.setF(c2, obj, "gpu_surface_h", @floatFromInt(s.gpu_surface_h));
    jsv.setF(c2, obj, "frame_hash", @floatFromInt(s.frame_hash));
    jsv.setF(c2, obj, "frames_since_drain", @floatFromInt(s.frames_since_drain));
    return obj;
}

fn hostTelNodes(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "total", @floatFromInt(s.total_nodes));
    jsv.setF(c2, obj, "visible", @floatFromInt(s.visible_nodes));
    jsv.setF(c2, obj, "hidden", @floatFromInt(s.hidden_nodes));
    jsv.setF(c2, obj, "zero_size", @floatFromInt(s.zero_size_nodes));
    jsv.setF(c2, obj, "max_depth", @floatFromInt(s.max_depth));
    jsv.setF(c2, obj, "scroll", @floatFromInt(s.scroll_nodes));
    jsv.setF(c2, obj, "text", @floatFromInt(s.text_nodes));
    jsv.setF(c2, obj, "image", @floatFromInt(s.image_nodes));
    jsv.setF(c2, obj, "pressable", @floatFromInt(s.pressable_nodes));
    jsv.setF(c2, obj, "canvas", @floatFromInt(s.canvas_nodes));
    return obj;
}

fn hostTelState(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "slot_count", @floatFromInt(s.state_slot_count));
    jsv.setF(c2, obj, "slot_capacity", @floatFromInt(s.state_slot_capacity));
    jsv.setB(c2, obj, "dirty", s.state_dirty);
    jsv.setF(c2, obj, "array_slot_count", @floatFromInt(s.array_slot_count));
    jsv.setF(c2, obj, "array_slot_capacity", @floatFromInt(s.array_slot_capacity));
    return obj;
}

fn hostTelSystem(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "window_x", @floatFromInt(s.window_x));
    jsv.setF(c2, obj, "window_y", @floatFromInt(s.window_y));
    jsv.setF(c2, obj, "window_w", @floatFromInt(s.window_w));
    jsv.setF(c2, obj, "window_h", @floatFromInt(s.window_h));
    jsv.setF(c2, obj, "display_count", @floatFromInt(s.display_count));
    jsv.setF(c2, obj, "current_display", @floatFromInt(s.current_display));
    jsv.setF(c2, obj, "display_w", @floatFromInt(s.display_w));
    jsv.setF(c2, obj, "display_h", @floatFromInt(s.display_h));
    jsv.setF(c2, obj, "breakpoint", @floatFromInt(s.breakpoint_tier));
    jsv.setF(c2, obj, "secondary_windows", @floatFromInt(s.secondary_window_count));
    return obj;
}

fn hostTelInput(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "focused_id", @floatFromInt(s.focused_input_id));
    jsv.setF(c2, obj, "active_count", @floatFromInt(s.active_input_count));
    jsv.setB(c2, obj, "has_selection", s.has_selection);
    jsv.setB(c2, obj, "selection_dragging", s.selection_dragging);
    jsv.setB(c2, obj, "tooltip_visible", s.tooltip_visible);
    return obj;
}

fn hostTelCanvas(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "cam_x", s.canvas_cam_x);
    jsv.setF(c2, obj, "cam_y", s.canvas_cam_y);
    jsv.setF(c2, obj, "cam_zoom", s.canvas_cam_zoom);
    jsv.setF(c2, obj, "type_count", @floatFromInt(s.canvas_type_count));
    return obj;
}

fn hostTelNet(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "active_connections", @floatFromInt(s.net_active_connections));
    jsv.setF(c2, obj, "open_connections", @floatFromInt(s.net_open_connections));
    jsv.setF(c2, obj, "reconnecting", @floatFromInt(s.net_reconnecting));
    jsv.setF(c2, obj, "event_queue_depth", @floatFromInt(s.net_event_queue_depth));
    return obj;
}

fn hostTelLayout(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    const s = tel.current;
    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "budget", @floatFromInt(s.layout_budget));
    jsv.setF(c2, obj, "budget_used", @floatFromInt(s.layout_budget_used));
    jsv.setF(c2, obj, "route_history_depth", @floatFromInt(s.route_history_depth));
    jsv.setF(c2, obj, "route_current_index", @floatFromInt(s.route_current_index));
    jsv.setF(c2, obj, "log_channels_enabled", @floatFromInt(s.log_channels_enabled));
    return obj;
}

fn hostTelHistory(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    var count: i32 = 40;
    if (argc >= 1) _ = qjs.JS_ToInt32(c2, &count, argv[0]);
    const n: usize = @intCast(@max(1, @min(count, 120)));
    const avail = tel.historyCount();
    const actual = @min(n, avail);

    const arr = qjs.JS_NewArray(c2);
    for (0..actual) |i| {
        if (tel.getHistory(i)) |snap| {
            _ = qjs.JS_SetPropertyUint32(c2, arr, @intCast(i), qjs.JS_NewFloat64(c2, @floatFromInt(snap.frame_total_us)));
        }
    }
    return arr;
}

fn hostTelNodeCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(tel.nodeCount()));
}

fn hostTelNode(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(c2, &idx, argv[0]);
    if (idx < 0) return QJS_UNDEFINED;

    const node = tel.getNode(@intCast(idx)) orelse return QJS_UNDEFINED;
    const depth = tel.getNodeDepth(@intCast(idx));
    const r = node.computed;

    const obj = qjs.JS_NewObject(c2);
    jsv.setF(c2, obj, "depth", @floatFromInt(depth));
    jsv.setF(c2, obj, "child_count", @floatFromInt(node.children.len));
    jsv.setF(c2, obj, "x", r.x);
    jsv.setF(c2, obj, "y", r.y);
    jsv.setF(c2, obj, "w", r.w);
    jsv.setF(c2, obj, "h", r.h);
    jsv.setB(c2, obj, "has_text", node.text != null);
    jsv.setB(c2, obj, "has_image", node.image_src != null);
    jsv.setB(c2, obj, "has_handler", node.handlers.on_press != null);
    jsv.setB(c2, obj, "has_tooltip", node.tooltip != null);
    jsv.setF(c2, obj, "font_size", @floatFromInt(node.font_size));
    jsv.setF(c2, obj, "opacity", node.style.opacity);
    jsv.setF(c2, obj, "scroll_y", node.scroll_y);
    jsv.setF(c2, obj, "content_height", node.content_height);

    // Tag name — debug_name or inferred type
    const tag = node.debug_name orelse tel.nodeTypeName(node);
    _ = qjs.JS_SetPropertyStr(c2, obj, "tag", qjs.JS_NewStringLen(c2, tag.ptr, @intCast(tag.len)));

    // Display and flex direction as numbers
    jsv.setF(c2, obj, "display", @floatFromInt(@intFromEnum(node.style.display)));
    jsv.setF(c2, obj, "flex_direction", @floatFromInt(@intFromEnum(node.style.flex_direction)));

    return obj;
}

fn hostTelNodeStyle(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(c2, &idx, argv[0]);
    if (idx < 0) return QJS_UNDEFINED;

    const node = tel.getNode(@intCast(idx)) orelse return QJS_UNDEFINED;
    const sty = node.style;
    const obj = qjs.JS_NewObject(c2);

    // Dimensions
    if (sty.width) |v| jsv.setF(c2, obj, "width", v) else jsv.setF(c2, obj, "width", -1);
    if (sty.height) |v| jsv.setF(c2, obj, "height", v) else jsv.setF(c2, obj, "height", -1);
    if (sty.min_width) |v| jsv.setF(c2, obj, "min_width", v);
    if (sty.max_width) |v| jsv.setF(c2, obj, "max_width", v);
    if (sty.min_height) |v| jsv.setF(c2, obj, "min_height", v);
    if (sty.max_height) |v| jsv.setF(c2, obj, "max_height", v);

    // Flex
    jsv.setF(c2, obj, "flex_grow", sty.flex_grow);
    if (sty.flex_shrink) |v| jsv.setF(c2, obj, "flex_shrink", v);
    if (sty.flex_basis) |v| jsv.setF(c2, obj, "flex_basis", v);
    jsv.setF(c2, obj, "flex_direction", @floatFromInt(@intFromEnum(sty.flex_direction)));
    jsv.setF(c2, obj, "justify_content", @floatFromInt(@intFromEnum(sty.justify_content)));
    jsv.setF(c2, obj, "align_items", @floatFromInt(@intFromEnum(sty.align_items)));
    jsv.setF(c2, obj, "align_self", @floatFromInt(@intFromEnum(sty.align_self)));
    jsv.setF(c2, obj, "gap", sty.gap);

    // Padding
    jsv.setF(c2, obj, "padding", sty.padding);
    if (sty.padding_left) |v| jsv.setF(c2, obj, "padding_left", v);
    if (sty.padding_right) |v| jsv.setF(c2, obj, "padding_right", v);
    if (sty.padding_top) |v| jsv.setF(c2, obj, "padding_top", v);
    if (sty.padding_bottom) |v| jsv.setF(c2, obj, "padding_bottom", v);

    // Margin
    jsv.setF(c2, obj, "margin", sty.margin);
    if (sty.margin_left) |v| jsv.setF(c2, obj, "margin_left", v);
    if (sty.margin_right) |v| jsv.setF(c2, obj, "margin_right", v);
    if (sty.margin_top) |v| jsv.setF(c2, obj, "margin_top", v);
    if (sty.margin_bottom) |v| jsv.setF(c2, obj, "margin_bottom", v);

    // Visual
    jsv.setF(c2, obj, "border_radius", sty.border_radius);
    jsv.setF(c2, obj, "border_width", sty.border_width);
    if (sty.border_top_width) |v| jsv.setF(c2, obj, "border_top_width", v);
    if (sty.border_right_width) |v| jsv.setF(c2, obj, "border_right_width", v);
    if (sty.border_bottom_width) |v| jsv.setF(c2, obj, "border_bottom_width", v);
    if (sty.border_left_width) |v| jsv.setF(c2, obj, "border_left_width", v);
    jsv.setF(c2, obj, "opacity", sty.opacity);
    jsv.setF(c2, obj, "z_index", @floatFromInt(sty.z_index));
    jsv.setF(c2, obj, "rotation", sty.rotation);
    jsv.setF(c2, obj, "scale_x", sty.scale_x);
    jsv.setF(c2, obj, "scale_y", sty.scale_y);

    // Background color
    if (sty.background_color) |bg| {
        jsv.setF(c2, obj, "bg_r", @floatFromInt(bg.r));
        jsv.setF(c2, obj, "bg_g", @floatFromInt(bg.g));
        jsv.setF(c2, obj, "bg_b", @floatFromInt(bg.b));
        jsv.setF(c2, obj, "bg_a", @floatFromInt(bg.a));
    }

    // Border color
    if (sty.border_color) |bc| {
        jsv.setF(c2, obj, "border_r", @floatFromInt(bc.r));
        jsv.setF(c2, obj, "border_g", @floatFromInt(bc.g));
        jsv.setF(c2, obj, "border_b", @floatFromInt(bc.b));
        jsv.setF(c2, obj, "border_a", @floatFromInt(bc.a));
    }

    // Position
    jsv.setF(c2, obj, "position", @floatFromInt(@intFromEnum(sty.position)));
    if (sty.top) |v| jsv.setF(c2, obj, "top", v);
    if (sty.left) |v| jsv.setF(c2, obj, "left", v);
    if (sty.right) |v| jsv.setF(c2, obj, "right", v);
    if (sty.bottom) |v| jsv.setF(c2, obj, "bottom", v);

    // Overflow, display, text align
    jsv.setF(c2, obj, "overflow", @floatFromInt(@intFromEnum(sty.overflow)));
    jsv.setF(c2, obj, "display", @floatFromInt(@intFromEnum(sty.display)));
    jsv.setF(c2, obj, "text_align", @floatFromInt(@intFromEnum(sty.text_align)));

    return obj;
}

fn hostTelNodeBoxModel(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    var idx: i32 = 0;
    _ = qjs.JS_ToInt32(c2, &idx, argv[0]);
    if (idx < 0) return QJS_UNDEFINED;

    const node = tel.getNode(@intCast(idx)) orelse return QJS_UNDEFINED;
    const sty = node.style;
    const r = node.computed;

    const obj = qjs.JS_NewObject(c2);
    // Computed rect
    jsv.setF(c2, obj, "x", r.x);
    jsv.setF(c2, obj, "y", r.y);
    jsv.setF(c2, obj, "w", r.w);
    jsv.setF(c2, obj, "h", r.h);

    // Resolved padding
    jsv.setF(c2, obj, "pad_top", sty.padTop());
    jsv.setF(c2, obj, "pad_right", sty.padRight());
    jsv.setF(c2, obj, "pad_bottom", sty.padBottom());
    jsv.setF(c2, obj, "pad_left", sty.padLeft());

    // Resolved margin (no helper methods — resolve optional fields manually)
    jsv.setF(c2, obj, "margin_top", sty.margin_top orelse sty.margin);
    jsv.setF(c2, obj, "margin_right", sty.margin_right orelse sty.margin);
    jsv.setF(c2, obj, "margin_bottom", sty.margin_bottom orelse sty.margin);
    jsv.setF(c2, obj, "margin_left", sty.margin_left orelse sty.margin);

    jsv.setF(c2, obj, "border_width", sty.border_width);
    jsv.setF(c2, obj, "border_top_width", sty.brdTop());
    jsv.setF(c2, obj, "border_right_width", sty.brdRight());
    jsv.setF(c2, obj, "border_bottom_width", sty.brdBottom());
    jsv.setF(c2, obj, "border_left_width", sty.brdLeft());

    // Content dimensions
    const pl = sty.padLeft();
    const pr = sty.padRight();
    const pt = sty.padTop();
    const pb = sty.padBottom();
    jsv.setF(c2, obj, "content_w", @max(0, r.w - pl - pr));
    jsv.setF(c2, obj, "content_h", @max(0, r.h - pt - pb));

    return obj;
}

const polyfill =
    \\globalThis.console = {
    \\  log: function(...args) { __hostLog(0, args.map(String).join(' ')); },
    \\  warn: function(...args) { __hostLog(1, args.map(String).join(' ')); },
    \\  error: function(...args) { __hostLog(2, args.map(String).join(' ')); },
    \\};
    \\globalThis._timers = [];
    \\globalThis._timerIdNext = 1;
    \\globalThis.setTimeout = function(fn, ms) {
    \\  const id = globalThis._timerIdNext++;
    \\  globalThis._timers.push({ id, fn, ms: ms || 0, at: Date.now() + (ms || 0), interval: false });
    \\  return id;
    \\};
    \\globalThis.setInterval = function(fn, ms) {
    \\  const id = globalThis._timerIdNext++;
    \\  globalThis._timers.push({ id, fn, ms: ms || 16, at: Date.now() + (ms || 16), interval: true });
    \\  return id;
    \\};
    \\globalThis.clearTimeout = function(id) {
    \\  globalThis._timers = globalThis._timers.filter(t => t.id !== id);
    \\};
    \\globalThis.clearInterval = globalThis.clearTimeout;
    \\globalThis.__zigOS_tick = function() {
    \\  const now = Date.now();
    \\  const ready = globalThis._timers.filter(t => now >= t.at);
    \\  for (const t of ready) {
    \\    t.fn();
    \\    if (t.interval) { t.at = now + t.ms; }
    \\  }
    \\  globalThis._timers = globalThis._timers.filter(t => t.interval || now < t.at);
    \\};
    \\globalThis.fetch = function(url) {
    \\  const body = __fetch(url);
    \\  return body;
    \\};
    \\globalThis.__semCls = {
    \\  sheet: null, prevKind: null,
    \\  load: function(path) {
    \\    var json = __fs_readfile(path);
    \\    if (!json) return false;
    \\    try { this.sheet = JSON.parse(json); } catch(e) { return false; }
    \\    __sem_set_mode(3);
    \\    return true;
    \\  },
    \\  _match: function(r, text, trimmed) {
    \\    var t = r.on === 'trimmed' ? trimmed : text;
    \\    if (r.match === 'contains') return t.indexOf(r.value) >= 0;
    \\    if (r.match === 'starts_with') {
    \\      var s = trimmed;
    \\      if (r.case === 'insensitive') return s.toLowerCase().indexOf(r.value.toLowerCase()) === 0;
    \\      return s.indexOf(r.value) === 0;
    \\    }
    \\    if (r.match === 'equals') return trimmed === r.value;
    \\    if (r.match === 'regex') return new RegExp(r.pattern).test(t);
    \\    return false;
    \\  },
    \\  classifyRow: function(text, row, total) {
    \\    if (!this.sheet) return 'output';
    \\    var trimmed = text.replace(/^\s+|\s+$/g, '');
    \\    if (trimmed.length === 0) return this.sheet.default_token || 'output';
    \\    var rules = this.sheet.rules;
    \\    for (var i = 0; i < rules.length; i++) {
    \\      var r = rules[i];
    \\      if (r.max_row !== undefined && row > r.max_row) continue;
    \\      if (r.zone === 'bottom_8' && row < total - 8) continue;
    \\      if (r.max_len && trimmed.length > r.max_len) continue;
    \\      if (!this._match(r, text, trimmed)) continue;
    \\      if (r.also && !this._match(r.also, text, trimmed)) continue;
    \\      if (r.not_contains && text.indexOf(r.not_contains) >= 0) continue;
    \\      return r.token;
    \\    }
    \\    return this.sheet.default_token || 'output';
    \\  },
    \\  refine: function(kind, prev, text) {
    \\    if (!this.sheet || !this.sheet.adjacency) return kind;
    \\    var adj = this.sheet.adjacency;
    \\    for (var i = 0; i < adj.length; i++) {
    \\      var a = adj[i];
    \\      if (a.when_current && a.when_current !== kind) continue;
    \\      if (a.when_prev && a.when_prev.indexOf(prev) < 0) continue;
    \\      if (a.text_contains && text.indexOf(a.text_contains) < 0) continue;
    \\      return a.promote_to;
    \\    }
    \\    return kind;
    \\  },
    \\  classifyAll: function() {
    \\    if (!this.sheet) return;
    \\    var rows = __sem_vterm_rows();
    \\    var prev = null;
    \\    for (var r = 0; r < rows; r++) {
    \\      var text = __sem_row_text(r);
    \\      var kind = this.classifyRow(text, r, rows);
    \\      kind = this.refine(kind, prev, text);
    \\      __sem_set_row_token(r, kind);
    \\      prev = kind;
    \\    }
    \\    __sem_build_graph(rows);
    \\  }
    \\};
;

// ── HTTP fetch host function ─────────────────────────────────────

fn hostFetch(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    const url_ptr = qjs.JS_ToCString(ctx, argv[0]);
    if (url_ptr == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, url_ptr);
    const url = std.mem.span(url_ptr);
    std.debug.print("[fetch] GET {s}\n", .{url});

    // Use curl to fetch the URL synchronously
    const result = std.process.Child.run(.{
        .allocator = std.heap.page_allocator,
        .max_output_bytes = 2 * 1024 * 1024, // 2MB
        .argv = &[_][]const u8{
            "curl", "-sL", "--max-time", "10", "--compressed",
            "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            url,
        },
    }) catch |err| {
        std.debug.print("[fetch] curl failed: {}\n", .{err});
        return QJS_UNDEFINED;
    };
    defer std.heap.page_allocator.free(result.stdout);
    defer std.heap.page_allocator.free(result.stderr);

    if (result.stdout.len == 0) {
        std.debug.print("[fetch] empty response\n", .{});
        return QJS_UNDEFINED;
    }
    std.debug.print("[fetch] got {d} bytes\n", .{result.stdout.len});
    return qjs.JS_NewStringLen(ctx, result.stdout.ptr, @intCast(result.stdout.len));
}

// ── PTY host functions ───────────────────────────────────────────

fn hostPtyOpen(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (g_pty != null) return qjs.JS_NewFloat64(null, 0);
    var cols: u16 = 80;
    var rows: u16 = 24;
    if (argc >= 1) {
        var v: i32 = 0;
        _ = qjs.JS_ToInt32(ctx, &v, argv[0]);
        if (v > 0) cols = @intCast(v);
    }
    if (argc >= 2) {
        var v: i32 = 0;
        _ = qjs.JS_ToInt32(ctx, &v, argv[1]);
        if (v > 0) rows = @intCast(v);
    }
    g_pty = pty_mod.openPty(.{ .cols = cols, .rows = rows }) catch {
        return qjs.JS_NewFloat64(null, -1);
    };
    return qjs.JS_NewFloat64(null, 0);
}

fn hostPtyRead(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (g_pty) |*p| {
        if (p.readData()) |data| {
            return qjs.JS_NewStringLen(ctx, data.ptr, @intCast(data.len));
        }
    }
    return QJS_UNDEFINED;
}

fn hostPtyWrite(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    if (g_pty) |*p| {
        const str = qjs.JS_ToCString(ctx, argv[0]);
        if (str == null) return QJS_UNDEFINED;
        defer qjs.JS_FreeCString(ctx, str);
        _ = p.writeData(std.mem.span(str));
    }
    return QJS_UNDEFINED;
}

fn hostPtyAlive(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (g_pty) |*p| {
        return qjs.JS_NewFloat64(null, if (p.alive()) @as(f64, 1) else 0);
    }
    return qjs.JS_NewFloat64(null, 0);
}

// ── PTY key routing — called from engine event loop ─────────────

/// Returns true if a PTY is active and should consume keyboard input.
pub fn ptyActive() bool {
    if (comptime !HAS_QUICKJS) return false;
    if (g_pty) |*p| return p.alive();
    return false;
}

/// Forward SDL_TEXTINPUT text to the PTY (printable chars, already UTF-8).
pub fn ptyHandleTextInput(text: [*:0]const u8) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_pty) |*p| {
        _ = p.writeData(std.mem.span(text));
    }
}

/// Translate an SDL keysym to a terminal escape sequence and write to PTY.
/// SDL constants are included via the c.zig import in engine.zig, so we
/// accept the raw i32 sym and u16 mod values directly.
pub fn ptyHandleKeyDown(sym: i32, mod: u16) void {
    if (comptime !HAS_QUICKJS) return;
    const SDLK_RETURN    = 13;
    const SDLK_BACKSPACE = 8;
    const SDLK_DELETE    = 127;
    const SDLK_TAB       = 9;
    const SDLK_UP        = 0x40000052;
    const SDLK_DOWN      = 0x40000051;
    const SDLK_RIGHT     = 0x4000004f;
    const SDLK_LEFT      = 0x40000050;
    const SDLK_HOME      = 0x4000004a;
    const SDLK_END       = 0x4000004d;
    const SDLK_PAGEUP    = 0x4000004b;
    const SDLK_PAGEDOWN  = 0x4000004e;
    const KMOD_CTRL: u16 = 0x00c0;

    const ctrl = (mod & KMOD_CTRL) != 0;

    if (g_pty) |*p| {
        if (ctrl and sym >= 'a' and sym <= 'z') {
            // Ctrl+letter → \x01..\x1a
            const seq = [1]u8{ @intCast(sym - 'a' + 1) };
            _ = p.writeData(&seq);
            return;
        }
        const seq: []const u8 = switch (sym) {
            SDLK_RETURN    => "\r",
            SDLK_BACKSPACE => "\x7f",
            SDLK_DELETE    => "\x1b[3~",
            SDLK_TAB       => "\t",
            SDLK_UP        => "\x1b[A",
            SDLK_DOWN      => "\x1b[B",
            SDLK_RIGHT     => "\x1b[C",
            SDLK_LEFT      => "\x1b[D",
            SDLK_HOME      => "\x1b[H",
            SDLK_END       => "\x1b[F",
            SDLK_PAGEUP    => "\x1b[5~",
            SDLK_PAGEDOWN  => "\x1b[6~",
            else           => return,
        };
        _ = p.writeData(seq);
    }
}

// ── Filesystem bridge (session discovery for tsz-tools) ─────────

extern fn getpid() c_int;

/// __fs_scandir(path) → array of filenames in the directory (strings).
/// Returns empty array on error. Only reads filenames, not contents.
fn hostFsScandir(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    const path_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (path_ptr == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(c2, path_ptr);
    const path = std.mem.span(path_ptr);

    const arr = qjs.JS_NewArray(c2);
    var dir = std.fs.cwd().openDir(path, .{ .iterate = true }) catch return arr;
    defer dir.close();
    var iter = dir.iterate();
    var i: u32 = 0;
    while (iter.next() catch null) |entry| {
        const name = qjs.JS_NewStringLen(c2, entry.name.ptr, @intCast(entry.name.len));
        _ = qjs.JS_SetPropertyUint32(c2, arr, i, name);
        i += 1;
    }
    return arr;
}

/// __fs_readfile(path) → file contents as string, or empty string on error.
fn hostFsReadfile(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return QJS_UNDEFINED;
    const path_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (path_ptr == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(c2, path_ptr);
    const path = std.mem.span(path_ptr);

    const file = std.fs.cwd().openFile(path, .{}) catch return qjs.JS_NewString(c2, "");
    defer file.close();
    var buf: [4096]u8 = undefined;
    const n = file.readAll(&buf) catch return qjs.JS_NewString(c2, "");
    return qjs.JS_NewStringLen(c2, &buf, @intCast(n));
}

/// __getpid() → current process ID as number.
fn hostGetPid(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewFloat64(null, @floatFromInt(getpid()));
}

/// __getenv(name) → env var value as string, or empty string if unset.
fn hostGetEnv(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return qjs.JS_NewString(c2, "");
    const name_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (name_ptr == null) return qjs.JS_NewString(c2, "");
    defer qjs.JS_FreeCString(c2, name_ptr);
    const val = std.posix.getenv(std.mem.span(name_ptr)) orelse return qjs.JS_NewString(c2, "");
    return qjs.JS_NewStringLen(c2, val.ptr, @intCast(val.len));
}

// ── File write + exec host functions (Dashboard) ────────────────

extern fn popen(command: [*:0]const u8, mode: [*:0]const u8) ?*anyopaque;
extern fn pclose(stream: *anyopaque) c_int;
extern fn fread(ptr: [*]u8, size: usize, nmemb: usize, stream: *anyopaque) usize;

/// __fs_writefile(path, content) → 0 on success, -1 on error.
/// Creates parent directories if needed.
fn hostFsWritefile(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 2) return qjs.JS_NewFloat64(null, -1);
    const path_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (path_ptr == null) return qjs.JS_NewFloat64(null, -1);
    defer qjs.JS_FreeCString(c2, path_ptr);
    const content_ptr = qjs.JS_ToCString(c2, argv[1]);
    if (content_ptr == null) return qjs.JS_NewFloat64(null, -1);
    defer qjs.JS_FreeCString(c2, content_ptr);
    const path = std.mem.span(path_ptr);
    const content = std.mem.span(content_ptr);
    // Ensure parent directory exists
    if (std.mem.lastIndexOfScalar(u8, path, '/')) |idx| {
        std.fs.cwd().makePath(path[0..idx]) catch {};
    }
    const file = std.fs.cwd().createFile(path, .{}) catch return qjs.JS_NewFloat64(null, -1);
    defer file.close();
    file.writeAll(content) catch return qjs.JS_NewFloat64(null, -1);
    return qjs.JS_NewFloat64(null, 0);
}

/// __fs_deletefile(path) → 0 on success, -1 on error.
fn hostFsDeletefile(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return qjs.JS_NewFloat64(null, -1);
    const path_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (path_ptr == null) return qjs.JS_NewFloat64(null, -1);
    defer qjs.JS_FreeCString(c2, path_ptr);
    const path = std.mem.span(path_ptr);
    std.fs.cwd().deleteFile(path) catch return qjs.JS_NewFloat64(null, -1);
    return qjs.JS_NewFloat64(null, 0);
}

/// __exec(cmd) → stdout+stderr as string, or empty string on error.
/// Runs a shell command synchronously via popen. Captures up to 64KB of output.
fn hostExec(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 1) return qjs.JS_NewString(c2, "");
    const cmd_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (cmd_ptr == null) return qjs.JS_NewString(c2, "");
    defer qjs.JS_FreeCString(c2, cmd_ptr);
    const stream = popen(cmd_ptr, "r") orelse return qjs.JS_NewString(c2, "");
    var buf: [65536]u8 = undefined;
    var total: usize = 0;
    while (total < buf.len) {
        const n = fread(buf[total..].ptr, 1, buf.len - total, stream);
        if (n == 0) break;
        total += n;
    }
    _ = pclose(stream);
    if (total == 0) return qjs.JS_NewString(c2, "");
    return qjs.JS_NewStringLen(c2, &buf, @intCast(total));
}

/// Function pointer set by engine to open a window. Avoids importing windows.zig here.
var g_open_window_fn: ?*const fn ([*:0]const u8, c_int, c_int) void = null;

pub fn setOpenWindowFn(f: *const fn ([*:0]const u8, c_int, c_int) void) void {
    g_open_window_fn = f;
}

fn hostOpenWindow(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    const c2 = ctx orelse return QJS_UNDEFINED;
    if (argc < 3) return QJS_UNDEFINED;
    const title_ptr = qjs.JS_ToCString(c2, argv[0]);
    if (title_ptr == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(c2, title_ptr);
    var w: i32 = 400;
    var h: i32 = 400;
    _ = qjs.JS_ToInt32(c2, &w, argv[1]);
    _ = qjs.JS_ToInt32(c2, &h, argv[2]);

    if (g_open_window_fn) |openFn| {
        // Copy title to sentinel-terminated buffer
        const title_span = std.mem.span(title_ptr);
        var title_buf: [256:0]u8 = undefined;
        const copy_len = @min(title_span.len, 255);
        @memcpy(title_buf[0..copy_len], title_span[0..copy_len]);
        title_buf[copy_len] = 0;
        openFn(&title_buf, @intCast(w), @intCast(h));
    }
    return QJS_UNDEFINED;
}

// ── QuickJS lifecycle ───────────────────────────────────────────

pub fn initVM() void {
    if (comptime !HAS_QUICKJS) return;
    const rt = qjs.JS_NewRuntime() orelse return;
    qjs.JS_SetMemoryLimit(rt, 64 * 1024 * 1024);
    qjs.JS_SetMaxStackSize(rt, 1024 * 1024);
    const ctx = qjs.JS_NewContext(rt) orelse {
        qjs.JS_FreeRuntime(rt);
        return;
    };
    g_qjs_rt = rt;
    g_qjs_ctx = ctx;

    const global_v = JsVal.getGlobal(ctx);
    defer global_v.deinit();
    const global = global_v.raw();
    _ = qjs.JS_SetPropertyStr(ctx, global, "__setState", qjs.JS_NewCFunction(ctx, hostSetState, "__setState", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__setStateString", qjs.JS_NewCFunction(ctx, hostSetStateString, "__setStateString", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__getState", qjs.JS_NewCFunction(ctx, hostGetState, "__getState", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__getStateString", qjs.JS_NewCFunction(ctx, hostGetStateString, "__getStateString", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__hostLog", qjs.JS_NewCFunction(ctx, hostLog, "__hostLog", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getFps", qjs.JS_NewCFunction(ctx, hostGetFps, "getFps", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getLayoutUs", qjs.JS_NewCFunction(ctx, hostGetLayoutUs, "getLayoutUs", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getPaintUs", qjs.JS_NewCFunction(ctx, hostGetPaintUs, "getPaintUs", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getTickUs", qjs.JS_NewCFunction(ctx, hostGetTickUs, "getTickUs", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getMouseX", qjs.JS_NewCFunction(ctx, hostGetMouseX, "getMouseX", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getMouseY", qjs.JS_NewCFunction(ctx, hostGetMouseY, "getMouseY", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getMouseDown", qjs.JS_NewCFunction(ctx, hostGetMouseDown, "getMouseDown", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "isKeyDown", qjs.JS_NewCFunction(ctx, hostIsKeyDown, "isKeyDown", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getMouseRightDown", qjs.JS_NewCFunction(ctx, hostGetMouseRightDown, "getMouseRightDown", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "heavy_compute", qjs.JS_NewCFunction(ctx, hostHeavyCompute, "heavy_compute", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "heavy_compute_timed", qjs.JS_NewCFunction(ctx, hostHeavyComputeTimed, "heavy_compute_timed", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "set_compute_n", qjs.JS_NewCFunction(ctx, hostSetComputeN, "set_compute_n", 1));

    // Canvas active/selected node
    _ = qjs.JS_SetPropertyStr(ctx, global, "getActiveNode", qjs.JS_NewCFunction(ctx, hostGetActiveNode, "getActiveNode", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "getSelectedNode", qjs.JS_NewCFunction(ctx, hostGetSelectedNode, "getSelectedNode", 0));
    // Flow animation control
    _ = qjs.JS_SetPropertyStr(ctx, global, "setFlowEnabled", qjs.JS_NewCFunction(ctx, hostSetFlowEnabled, "setFlowEnabled", 1));
    // Input text access
    _ = qjs.JS_SetPropertyStr(ctx, global, "getInputText", qjs.JS_NewCFunction(ctx, hostGetInputText, "getInputText", 1));
    // Node dim/highlight (filter system)
    _ = qjs.JS_SetPropertyStr(ctx, global, "setNodeDim", qjs.JS_NewCFunction(ctx, hostSetNodeDim, "setNodeDim", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "resetNodeDim", qjs.JS_NewCFunction(ctx, hostResetNodeDim, "resetNodeDim", 0));
    // Per-path flow override (hover mode)
    _ = qjs.JS_SetPropertyStr(ctx, global, "setPathFlow", qjs.JS_NewCFunction(ctx, hostSetPathFlow, "setPathFlow", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "resetPathFlow", qjs.JS_NewCFunction(ctx, hostResetPathFlow, "resetPathFlow", 0));

    // Telemetry host functions — unified snapshot access
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_frame", qjs.JS_NewCFunction(ctx, hostTelFrame, "__tel_frame", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_gpu", qjs.JS_NewCFunction(ctx, hostTelGpu, "__tel_gpu", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_nodes", qjs.JS_NewCFunction(ctx, hostTelNodes, "__tel_nodes", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_state", qjs.JS_NewCFunction(ctx, hostTelState, "__tel_state", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_system", qjs.JS_NewCFunction(ctx, hostTelSystem, "__tel_system", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_input", qjs.JS_NewCFunction(ctx, hostTelInput, "__tel_input", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_canvas", qjs.JS_NewCFunction(ctx, hostTelCanvas, "__tel_canvas", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_net", qjs.JS_NewCFunction(ctx, hostTelNet, "__tel_net", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_layout", qjs.JS_NewCFunction(ctx, hostTelLayout, "__tel_layout", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_history", qjs.JS_NewCFunction(ctx, hostTelHistory, "__tel_history", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node_count", qjs.JS_NewCFunction(ctx, hostTelNodeCount, "__tel_node_count", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node", qjs.JS_NewCFunction(ctx, hostTelNode, "__tel_node", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node_style", qjs.JS_NewCFunction(ctx, hostTelNodeStyle, "__tel_node_style", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__tel_node_box_model", qjs.JS_NewCFunction(ctx, hostTelNodeBoxModel, "__tel_node_box_model", 1));

    // HTTP fetch
    _ = qjs.JS_SetPropertyStr(ctx, global, "__fetch", qjs.JS_NewCFunction(ctx, hostFetch, "__fetch", 1));

    // PTY host functions
    _ = qjs.JS_SetPropertyStr(ctx, global, "__pty_open", qjs.JS_NewCFunction(ctx, hostPtyOpen, "__pty_open", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__pty_read", qjs.JS_NewCFunction(ctx, hostPtyRead, "__pty_read", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__pty_write", qjs.JS_NewCFunction(ctx, hostPtyWrite, "__pty_write", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__pty_alive", qjs.JS_NewCFunction(ctx, hostPtyAlive, "__pty_alive", 0));

    // Semantic terminal bridge — structured data from CLI output
    qjs_semantic.register(ctx, global);

    // Recording/playback bridge
    _ = qjs.JS_SetPropertyStr(ctx, global, "__rec_start", qjs.JS_NewCFunction(ctx, hostRecStart, "__rec_start", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__rec_stop", qjs.JS_NewCFunction(ctx, hostRecStop, "__rec_stop", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__rec_save", qjs.JS_NewCFunction(ctx, hostRecSave, "__rec_save", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__rec_toggle", qjs.JS_NewCFunction(ctx, hostRecToggle, "__rec_toggle", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__rec_is_recording", qjs.JS_NewCFunction(ctx, hostRecIsRecording, "__rec_is_recording", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__rec_frame_count", qjs.JS_NewCFunction(ctx, hostRecFrameCount, "__rec_frame_count", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_load", qjs.JS_NewCFunction(ctx, hostPlayLoad, "__play_load", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_play", qjs.JS_NewCFunction(ctx, hostPlayPlay, "__play_play", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_pause", qjs.JS_NewCFunction(ctx, hostPlayPause, "__play_pause", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_toggle", qjs.JS_NewCFunction(ctx, hostPlayToggle, "__play_toggle", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_step", qjs.JS_NewCFunction(ctx, hostPlayStep, "__play_step", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_seek", qjs.JS_NewCFunction(ctx, hostPlaySeek, "__play_seek", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_speed", qjs.JS_NewCFunction(ctx, hostPlaySpeed, "__play_speed", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__play_state", qjs.JS_NewCFunction(ctx, hostPlayState, "__play_state", 0));

    // Filesystem bridge (session discovery for tsz-tools inspector)
    _ = qjs.JS_SetPropertyStr(ctx, global, "__fs_scandir", qjs.JS_NewCFunction(ctx, hostFsScandir, "__fs_scandir", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__fs_readfile", qjs.JS_NewCFunction(ctx, hostFsReadfile, "__fs_readfile", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__getpid", qjs.JS_NewCFunction(ctx, hostGetPid, "__getpid", 0));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__getenv", qjs.JS_NewCFunction(ctx, hostGetEnv, "__getenv", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__fs_writefile", qjs.JS_NewCFunction(ctx, hostFsWritefile, "__fs_writefile", 2));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__fs_deletefile", qjs.JS_NewCFunction(ctx, hostFsDeletefile, "__fs_deletefile", 1));
    _ = qjs.JS_SetPropertyStr(ctx, global, "__exec", qjs.JS_NewCFunction(ctx, hostExec, "__exec", 1));

    // Window management
    _ = qjs.JS_SetPropertyStr(ctx, global, "__openWindow", qjs.JS_NewCFunction(ctx, hostOpenWindow, "__openWindow", 3));

    // IPC debug client host functions (external inspector attach)
    qjs_ipc.registerAll(@ptrCast(ctx));

    const val = JsVal.eval(ctx, polyfill, "<polyfill>", qjs.JS_EVAL_TYPE_GLOBAL);
    val.deinit();
}

/// Register a native function on the JS global object. Call after initVM, before evalScript.
/// Accepts a raw function pointer to avoid @cImport type conflicts between compilation units.
pub fn registerHostFn(name: [*:0]const u8, func: *const anyopaque, argc: c_int) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        const global = JsVal.getGlobal(ctx);
        defer global.deinit();
        const FnType = @typeInfo(@TypeOf(qjs.JS_NewCFunction)).@"fn".params[1].type.?;
        const qjs_fn: FnType = @ptrCast(func);
        global.setProperty(name, qjs.JS_NewCFunction(ctx, qjs_fn, name, argc));
    }
}

/// Eval the app's JS logic. Call after initVM and any registerHostFn calls.
pub fn evalScript(js_logic: []const u8) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        const val = JsVal.eval(ctx, js_logic, "<app>", qjs.JS_EVAL_TYPE_GLOBAL);
        defer val.deinit();
        if (val.isException()) {
            jsv.logException(ctx);
        }
    }
}

/// Call a global JS function by name (no arguments). Used by Zig event handlers
/// to invoke functions defined in <script> blocks.
pub fn callGlobal(name: [*:0]const u8) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        const global = JsVal.getGlobal(ctx);
        defer global.deinit();
        const func = global.getProperty(name);
        defer func.deinit();
        if (!func.isUndefined()) {
            if (func.call0(global)) |r| r.deinit() else |_| {}
        }
    }
}

/// Check if a global JS function exists.
pub fn hasGlobal(name: [*:0]const u8) bool {
    if (comptime !HAS_QUICKJS) return false;
    if (g_qjs_ctx) |ctx| {
        const global = JsVal.getGlobal(ctx);
        defer global.deinit();
        const func = global.getProperty(name);
        defer func.deinit();
        return !func.isUndefined();
    }
    return false;
}

/// Call a global JS function with one string argument.
pub fn callGlobalStr(name: [*:0]const u8, arg: [*:0]const u8) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        const global = JsVal.getGlobal(ctx);
        defer global.deinit();
        const func = global.getProperty(name);
        defer func.deinit();
        if (!func.isUndefined()) {
            var argv = [1]qjs.JSValue{qjs.JS_NewString(ctx, arg)};
            defer qjs.JS_FreeValue(ctx, argv[0]); // JS_Call does NOT consume args
            if (func.call(global, 1, &argv)) |r| r.deinit() else |_| {}
        }
    }
}

/// Call a global JS function with one integer argument.
pub fn callGlobalInt(name: [*:0]const u8, arg: i64) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        const global = JsVal.getGlobal(ctx);
        defer global.deinit();
        const func = global.getProperty(name);
        defer func.deinit();
        if (!func.isUndefined()) {
            var argv = [1]qjs.JSValue{qjs.JS_NewInt64(ctx, arg)};
            if (func.call(global, 1, &argv)) |r| r.deinit() else |_| {}
        }
    }
}

/// Evaluate a JS expression string (for multi-arg function calls from map handlers).
pub fn evalExpr(code: []const u8) void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        if (code.len == 0) return;
        const r = JsVal.eval(ctx, code, "<handler>", 0);
        defer r.deinit();
        if (r.isException()) {
            jsv.logException(ctx);
        }
    }
}

pub fn tick() void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| {
        const global = JsVal.getGlobal(ctx);
        defer global.deinit();
        const tick_fn = global.getProperty("__zigOS_tick");
        defer tick_fn.deinit();
        if (!tick_fn.isUndefined()) {
            if (tick_fn.call0(global)) |r| r.deinit() else |_| {}
        }
        if (g_qjs_rt) |rt| {
            var ctx2: ?*qjs.JSContext = null;
            while (qjs.JS_ExecutePendingJob(rt, &ctx2) > 0) {}
        }
    }
}

pub fn deinit() void {
    if (comptime !HAS_QUICKJS) return;
    if (g_qjs_ctx) |ctx| qjs.JS_FreeContext(ctx);
    if (g_qjs_rt) |rt| qjs.JS_FreeRuntime(rt);
}

// ── SDL2 painter ────────────────────────────────────────────────

pub fn paintNode(renderer: *c.SDL_Renderer, te: *TextEngine, node: *Node) void {
    if (comptime !HAS_QUICKJS) return;
    if (node.style.display == .none) return;
    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) return;
    if (node.style.background_color) |bg| {
        if (bg.a > 0) {
            _ = c.SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, bg.a);
            var rect = c.SDL_FRect{
                .x = r.x,
                .y = r.y,
                .w = r.w,
                .h = r.h,
            };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        }
    }
    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            te.drawTextWrapped(t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr), tc);
        }
    }
    for (node.children) |*child| paintNode(renderer, te, child);
}

// ── Main loop ───────────────────────────────────────────────────

fn measureCallback(t: []const u8, fs: u16, mw: f32, ls: f32, lh: f32, ml: u16, nw: bool) layout.TextMetrics {
    if (g_text_engine) |te| return te.measureTextWrappedEx(t, fs, mw, ls, lh, ml, nw);
    return .{};
}
fn measureImageCallback(_: []const u8) layout.ImageDims {
    return .{};
}

pub fn run(root: *Node, js_logic: []const u8, initState: *const fn () void, updateTexts: *const fn () void) !void {
    if (comptime !HAS_QUICKJS) return;
    if (!c.SDL_Init(c.SDL_INIT_VIDEO)) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("tsz app", 1280, 800, c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, null) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        return error.FontNotFound;
    defer text_engine.deinit();

    g_text_engine = &text_engine;
    layout.setMeasureFn(measureCallback);
    layout.setMeasureImageFn(measureImageCallback);
    var win_w: f32 = 1280;
    var win_h: f32 = 800;

    initState();
    initVM(js_logic);
    defer deinit();
    updateTexts();

    var running = true;
    var fps_frames: u32 = 0;
    var fps_last: u64 = c.SDL_GetTicks();
    var fps_display: u32 = 0;
    var tick_us: u64 = 0;
    var layout_us: u64 = 0;
    var paint_us: u64 = 0;

    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event)) {
            switch (event.type) {
                c.SDL_EVENT_QUIT => running = false,
                c.SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED => {
                    var ww: c_int = 0;
                    var wh: c_int = 0;
                    _ = c.SDL_GetWindowSize(window, &ww, &wh);
                    win_w = @floatFromInt(ww);
                    win_h = @floatFromInt(wh);
                },
                c.SDL_EVENT_KEY_DOWN => {
                    if (event.key.key == c.SDLK_ESCAPE) running = false;
                },
                else => {},
            }
        }

        const t0 = std.time.microTimestamp();
        tick();
        const t1 = std.time.microTimestamp();
        tick_us = @intCast(@max(0, t1 - t0));

        if (state.isDirty()) {
            updateTexts();
            state.clearDirty();
        }

        _ = c.SDL_SetRenderDrawColor(renderer, 13, 17, 23, 255);
        _ = c.SDL_RenderClear(renderer);

        const t2 = std.time.microTimestamp();
        layout.layout(root, 0, 0, win_w, win_h);
        const t3 = std.time.microTimestamp();
        layout_us = @intCast(@max(0, t3 - t2));

        const t4 = std.time.microTimestamp();
        paintNode(renderer, &text_engine, root);
        const t5 = std.time.microTimestamp();
        paint_us = @intCast(@max(0, t5 - t4));

        // Telemetry bar
        {
            const bar_y = win_h - 24;
            _ = c.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 200);
            var bar_rect = c.SDL_FRect{ .x = 0, .y = bar_y, .w = win_w, .h = 24 };
            _ = c.SDL_RenderFillRect(renderer, &bar_rect);
            var tbuf: [256]u8 = undefined;
            const tstr = std.fmt.bufPrint(&tbuf, "FPS: {d}  |  tick: {d}us  layout: {d}us  paint: {d}us", .{
                fps_display, tick_us, layout_us, paint_us,
            }) catch "???";
            text_engine.drawText(tstr, 8, bar_y + 4, 13, Color.rgb(180, 220, 180));
        }

        _ = c.SDL_RenderPresent(renderer);

        fps_frames += 1;
        const now: u64 = c.SDL_GetTicks();
        if (now -% fps_last >= 1000) {
            fps_display = fps_frames;
            fps_frames = 0;
            fps_last = now;
        }
    }
}
