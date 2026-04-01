//! WASM Runtime — QuickJS + flex layout + WebGPU in one module.
//!
//! Build: zig build wasm-rt
//! Output: zig-out/bin/tsz-runtime.wasm
//!
//! QuickJS runs inside WASM. JS code drives the layout tree.
//! Layout computed in Zig. Rects rendered via WebGPU (browser-side).
//! Alpine Linux sits behind for OS services (apk, fs, net).

const std = @import("std");
const layout = @import("framework/layout.zig");
const Node = layout.Node;

// ── QuickJS C API ───────────────────────────────────────────────────────
const qjs = @cImport({
    @cInclude("quickjs.h");
});

// ── JS import shim (provided by browser importObject) ───────────────────
extern "env" fn gpu_begin_frame() void;
extern "env" fn gpu_draw_rect(x: f32, y: f32, w: f32, h: f32, r: f32, g: f32, b: f32, a: f32) void;
extern "env" fn gpu_draw_text(x: f32, y: f32, ptr: [*]const u8, len: u32, size: f32, r: f32, g: f32, b: f32, a: f32) void;
extern "env" fn gpu_end_frame() void;
extern "env" fn gpu_log(ptr: [*]const u8, len: u32) void;
extern "env" fn gpu_canvas_width() f32;
extern "env" fn gpu_canvas_height() f32;

fn log(msg: []const u8) void {
    gpu_log(msg.ptr, @intCast(msg.len));
}

// ── Node pool ───────────────────────────────────────────────────────────

const MAX_NODES = 4096;
const MAX_CHILDREN = 32;

var nodes: [MAX_NODES]Node = [_]Node{.{}} ** MAX_NODES;
var node_count: u32 = 0;

var child_indices: [MAX_NODES][MAX_CHILDREN]u32 = undefined;
var child_counts: [MAX_NODES]u32 = [_]u32{0} ** MAX_NODES;

var tree_nodes: [MAX_NODES]Node = undefined;
var tree_children: [MAX_NODES][MAX_CHILDREN]Node = undefined;

const Color = struct { r: f32 = 0, g: f32 = 0, b: f32 = 0, a: f32 = 0 };
var node_colors: [MAX_NODES]Color = [_]Color{.{}} ** MAX_NODES;

// ── Per-node text ───────────────────────────────────────────────────────
const TEXT_BUF_SIZE = 65536;
const TextInfo = struct {
    offset: u32 = 0,
    len: u32 = 0,
    font_size: f32 = 14,
    color: Color = .{ .r = 0.9, .g = 0.93, .b = 0.95, .a = 1 },
    padding_left: f32 = 0,
    padding_top: f32 = 0,
};
var text_buf: [TEXT_BUF_SIZE]u8 = undefined;
var text_buf_used: u32 = 0;
var node_text: [MAX_NODES]TextInfo = [_]TextInfo{.{}} ** MAX_NODES;

fn nodeSetText(idx: u32, ptr: [*]const u8, len: u32) void {
    if (idx >= node_count) return;
    if (text_buf_used + len > TEXT_BUF_SIZE) return;
    @memcpy(text_buf[text_buf_used .. text_buf_used + len], ptr[0..len]);
    node_text[idx].offset = text_buf_used;
    node_text[idx].len = len;
    text_buf_used += len;
}

fn nodeSetFontSize(idx: u32, size: f32) void {
    if (idx >= node_count) return;
    node_text[idx].font_size = size;
}

fn nodeSetTextColor(idx: u32, r: f32, g: f32, b: f32, a: f32) void {
    if (idx >= node_count) return;
    node_text[idx].color = .{ .r = r, .g = g, .b = b, .a = a };
}

fn nodeSetTextPadding(idx: u32, left: f32, top: f32) void {
    if (idx >= node_count) return;
    node_text[idx].padding_left = left;
    node_text[idx].padding_top = top;
}

// ── Input event handlers (QuickJS callbacks) ────────────────────────────
const MAX_HANDLERS = 256;
const HandlerEntry = struct { node_idx: u32 = 0, js_func: qjs.JSValue = qjs.JS_UNDEFINED, active: bool = false };
var click_handlers: [MAX_HANDLERS]HandlerEntry = [_]HandlerEntry{.{}} ** MAX_HANDLERS;
var click_handler_count: u32 = 0;

fn registerClickHandler(node_idx: u32, func: qjs.JSValue) void {
    if (click_handler_count >= MAX_HANDLERS) return;
    // Dup the function so it doesn't get GC'd
    click_handlers[click_handler_count] = .{
        .node_idx = node_idx,
        .js_func = qjs.JS_DupValue(g_ctx, func),
        .active = true,
    };
    click_handler_count += 1;
}

fn hitTest(x: f32, y: f32) ?u32 {
    // Walk nodes in reverse order (last painted = on top)
    var i: u32 = node_count;
    while (i > 0) {
        i -= 1;
        const n = nodes[i];
        const c = node_colors[i];
        // Only test visible nodes (has color or text)
        if (c.a > 0 or node_text[i].len > 0) {
            if (x >= n.computed.x and x < n.computed.x + n.computed.w and
                y >= n.computed.y and y < n.computed.y + n.computed.h)
            {
                return i;
            }
        }
    }
    return null;
}

// ── Layout functions (same as wasm_gpu.zig) ─────────────────────────────

fn nodeCreate() u32 {
    if (node_count >= MAX_NODES) return 0xFFFFFFFF;
    const idx = node_count;
    nodes[idx] = .{};
    child_counts[idx] = 0;
    node_colors[idx] = .{};
    node_text[idx] = .{};
    node_count += 1;
    return idx;
}

fn nodeReset() void {
    node_count = 0;
    text_buf_used = 0;
    // Free any JS handler references
    for (0..click_handler_count) |i| {
        if (click_handlers[i].active and g_ctx != null) {
            qjs.JS_FreeValue(g_ctx, click_handlers[i].js_func);
        }
        click_handlers[i] = .{};
    }
    click_handler_count = 0;
}

fn nodeSetWidth(idx: u32, w: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.width = w;
}

fn nodeSetHeight(idx: u32, h: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.height = h;
}

fn nodeSetFlexDirection(idx: u32, dir: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.flex_direction = @enumFromInt(dir);
}

fn nodeSetFlexGrow(idx: u32, grow: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.flex_grow = grow;
}

fn nodeSetFlexBasis(idx: u32, basis: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.flex_basis = basis;
}

fn nodeSetPadding(idx: u32, top: f32, right: f32, bottom: f32, left: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.padding_top = top;
    nodes[idx].style.padding_right = right;
    nodes[idx].style.padding_bottom = bottom;
    nodes[idx].style.padding_left = left;
}

fn nodeSetMargin(idx: u32, top: f32, right: f32, bottom: f32, left: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.margin_top = top;
    nodes[idx].style.margin_right = right;
    nodes[idx].style.margin_bottom = bottom;
    nodes[idx].style.margin_left = left;
}

fn nodeSetGap(idx: u32, gap: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.gap = gap;
}

fn nodeSetAlignItems(idx: u32, val: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.align_items = @enumFromInt(val);
}

fn nodeSetJustifyContent(idx: u32, justify: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.justify_content = @enumFromInt(justify);
}

fn nodeSetDisplay(idx: u32, val: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.display = @enumFromInt(val);
}

fn nodeSetColor(idx: u32, r: f32, g: f32, b: f32, a: f32) void {
    if (idx >= node_count) return;
    node_colors[idx] = .{ .r = r, .g = g, .b = b, .a = a };
}

fn nodeAddChild(parent_idx: u32, child_idx: u32) void {
    if (parent_idx >= node_count or child_idx >= node_count) return;
    const cc = child_counts[parent_idx];
    if (cc >= MAX_CHILDREN) return;
    child_indices[parent_idx][cc] = child_idx;
    child_counts[parent_idx] = cc + 1;
}

fn buildTree(idx: u32) void {
    tree_nodes[idx] = nodes[idx];
    tree_nodes[idx].computed = .{};
    const cc = child_counts[idx];
    if (cc == 0) {
        tree_nodes[idx].children = &.{};
        return;
    }
    for (0..cc) |ci| {
        const child_idx = child_indices[idx][ci];
        buildTree(child_idx);
        tree_children[idx][ci] = tree_nodes[child_idx];
    }
    tree_nodes[idx].children = tree_children[idx][0..cc];
}

fn copyChildResults(idx: u32, tree_node: *const Node) void {
    nodes[idx].computed = tree_node.computed;
    const cc = child_counts[idx];
    for (0..cc) |ci| {
        const child_idx = child_indices[idx][ci];
        if (ci < tree_node.children.len) {
            copyChildResults(child_idx, &tree_node.children[ci]);
        }
    }
}

fn layoutCompute(root_idx: u32, container_w: f32, container_h: f32) void {
    if (root_idx >= node_count) return;
    buildTree(root_idx);
    layout.layout(&tree_nodes[root_idx], 0, 0, container_w, container_h);
    nodes[root_idx].computed = tree_nodes[root_idx].computed;
    const cc = child_counts[root_idx];
    for (0..cc) |ci| {
        const child_idx = child_indices[root_idx][ci];
        copyChildResults(child_idx, &tree_nodes[root_idx].children[ci]);
    }
}

fn doRender() void {
    gpu_begin_frame();
    for (0..node_count) |i| {
        const c = node_colors[i];
        if (c.a > 0) {
            const n = nodes[i];
            gpu_draw_rect(n.computed.x, n.computed.y, n.computed.w, n.computed.h, c.r, c.g, c.b, c.a);
        }
        // Emit text for this node
        const t = node_text[i];
        if (t.len > 0) {
            const n = nodes[i];
            const tx = n.computed.x + t.padding_left;
            const ty = n.computed.y + t.padding_top + t.font_size; // baseline offset
            gpu_draw_text(tx, ty, text_buf[t.offset..].ptr, t.len, t.font_size, t.color.r, t.color.g, t.color.b, t.color.a);
        }
    }
    gpu_end_frame();
}

// ── QuickJS ↔ Layout bridge ─────────────────────────────────────────────
// These C callbacks are registered as global JS functions in the QuickJS context.
// JS code calls them to build the layout tree, compute, and render.

fn toF32(ctx: ?*qjs.JSContext, val: qjs.JSValue) f32 {
    var d: f64 = 0;
    _ = qjs.JS_ToFloat64(ctx, &d, val);
    return @floatCast(d);
}

fn toU32(ctx: ?*qjs.JSContext, val: qjs.JSValue) u32 {
    var i: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &i, val);
    return @intCast(@max(i, 0));
}

fn jsNodeCreate(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewInt32(null, @intCast(nodeCreate()));
}

fn jsNodeReset(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    nodeReset();
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetWidth(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetWidth(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetHeight(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetHeight(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetFlexDir(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetFlexDirection(toU32(ctx, argv.?[0]), toU32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetFlexGrow(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetFlexGrow(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetFlexBasis(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetFlexBasis(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetPadding(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 5 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetPadding(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]), toF32(ctx, argv.?[2]), toF32(ctx, argv.?[3]), toF32(ctx, argv.?[4]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetMargin(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 5 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetMargin(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]), toF32(ctx, argv.?[2]), toF32(ctx, argv.?[3]), toF32(ctx, argv.?[4]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetGap(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetGap(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetAlignItems(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetAlignItems(toU32(ctx, argv.?[0]), toU32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetJustifyContent(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetJustifyContent(toU32(ctx, argv.?[0]), toU32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetDisplay(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetDisplay(toU32(ctx, argv.?[0]), toU32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetColor(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 5 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetColor(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]), toF32(ctx, argv.?[2]), toF32(ctx, argv.?[3]), toF32(ctx, argv.?[4]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeAddChild(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeAddChild(toU32(ctx, argv.?[0]), toU32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsLayoutCompute(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc >= 3 and argv != null) {
        layoutCompute(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]), toF32(ctx, argv.?[2]));
    } else {
        // Auto: use canvas dimensions
        const w = gpu_canvas_width();
        const h = gpu_canvas_height();
        if (node_count > 0) layoutCompute(0, w, h);
    }
    return qjs.JS_UNDEFINED;
}

fn jsRender(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    doRender();
    return qjs.JS_UNDEFINED;
}

fn jsNodeGetX(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1 or argv == null) return qjs.JS_UNDEFINED;
    const idx = toU32(ctx, argv.?[0]);
    if (idx >= node_count) return qjs.JS_NewFloat64(ctx, 0);
    return qjs.JS_NewFloat64(ctx, @floatCast(nodes[idx].computed.x));
}

fn jsNodeGetY(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1 or argv == null) return qjs.JS_UNDEFINED;
    const idx = toU32(ctx, argv.?[0]);
    if (idx >= node_count) return qjs.JS_NewFloat64(ctx, 0);
    return qjs.JS_NewFloat64(ctx, @floatCast(nodes[idx].computed.y));
}

fn jsNodeGetW(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1 or argv == null) return qjs.JS_UNDEFINED;
    const idx = toU32(ctx, argv.?[0]);
    if (idx >= node_count) return qjs.JS_NewFloat64(ctx, 0);
    return qjs.JS_NewFloat64(ctx, @floatCast(nodes[idx].computed.w));
}

fn jsNodeGetH(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1 or argv == null) return qjs.JS_UNDEFINED;
    const idx = toU32(ctx, argv.?[0]);
    if (idx >= node_count) return qjs.JS_NewFloat64(ctx, 0);
    return qjs.JS_NewFloat64(ctx, @floatCast(nodes[idx].computed.h));
}

fn jsGetNodeCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    return qjs.JS_NewInt32(null, @intCast(node_count));
}

fn jsLog(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1 or argv == null) return qjs.JS_UNDEFINED;
    const str = qjs.JS_ToCString(ctx, argv.?[0]);
    if (str != null) {
        const slice: []const u8 = std.mem.sliceTo(str, 0);
        log(slice);
        qjs.JS_FreeCString(ctx, str);
    }
    return qjs.JS_UNDEFINED;
}

// ── Text + input JS bindings ────────────────────────────────────────────

fn jsNodeSetText(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    const idx = toU32(ctx, argv.?[0]);
    const str = qjs.JS_ToCString(ctx, argv.?[1]);
    if (str != null) {
        const slice: []const u8 = std.mem.sliceTo(str, 0);
        nodeSetText(idx, slice.ptr, @intCast(slice.len));
        qjs.JS_FreeCString(ctx, str);
    }
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetFontSize(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetFontSize(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetTextColor(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 5 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetTextColor(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]), toF32(ctx, argv.?[2]), toF32(ctx, argv.?[3]), toF32(ctx, argv.?[4]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeSetTextPadding(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 3 or argv == null) return qjs.JS_UNDEFINED;
    nodeSetTextPadding(toU32(ctx, argv.?[0]), toF32(ctx, argv.?[1]), toF32(ctx, argv.?[2]));
    return qjs.JS_UNDEFINED;
}

fn jsNodeOnClick(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: ?[*]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2 or argv == null) return qjs.JS_UNDEFINED;
    const idx = toU32(ctx, argv.?[0]);
    registerClickHandler(idx, argv.?[1]);
    return qjs.JS_UNDEFINED;
}

// ── Runtime state ───────────────────────────────────────────────────────

var g_rt: ?*qjs.JSRuntime = null;
var g_ctx: ?*qjs.JSContext = null;

fn registerFn(name: [*:0]const u8, func: qjs.JSCFunction, argc: c_int) void {
    const global = qjs.JS_GetGlobalObject(g_ctx);
    const f = qjs.JS_NewCFunction(g_ctx, func, name, argc);
    _ = qjs.JS_SetPropertyStr(g_ctx, global, name, f);
    qjs.JS_FreeValue(g_ctx, global);
}

// ── Exported WASM API ───────────────────────────────────────────────────

export fn rt_init() i32 {
    g_rt = qjs.JS_NewRuntime();
    if (g_rt == null) return -1;
    g_ctx = qjs.JS_NewContext(g_rt);
    if (g_ctx == null) return -2;

    // Register all native functions into JS global scope
    registerFn("__node_create", jsNodeCreate, 0);
    registerFn("__node_reset", jsNodeReset, 0);
    registerFn("__node_set_width", jsNodeSetWidth, 2);
    registerFn("__node_set_height", jsNodeSetHeight, 2);
    registerFn("__node_set_flex_direction", jsNodeSetFlexDir, 2);
    registerFn("__node_set_flex_grow", jsNodeSetFlexGrow, 2);
    registerFn("__node_set_flex_basis", jsNodeSetFlexBasis, 2);
    registerFn("__node_set_padding", jsNodeSetPadding, 5);
    registerFn("__node_set_margin", jsNodeSetMargin, 5);
    registerFn("__node_set_gap", jsNodeSetGap, 2);
    registerFn("__node_set_align_items", jsNodeSetAlignItems, 2);
    registerFn("__node_set_justify_content", jsNodeSetJustifyContent, 2);
    registerFn("__node_set_display", jsNodeSetDisplay, 2);
    registerFn("__node_set_color", jsNodeSetColor, 5);
    registerFn("__node_add_child", jsNodeAddChild, 2);
    registerFn("__layout_compute", jsLayoutCompute, 3);
    registerFn("__node_get_x", jsNodeGetX, 1);
    registerFn("__node_get_y", jsNodeGetY, 1);
    registerFn("__node_get_w", jsNodeGetW, 1);
    registerFn("__node_get_h", jsNodeGetH, 1);
    registerFn("__get_node_count", jsGetNodeCount, 0);
    registerFn("__render", jsRender, 0);
    registerFn("__log", jsLog, 1);
    registerFn("__node_set_text", jsNodeSetText, 2);
    registerFn("__node_set_font_size", jsNodeSetFontSize, 2);
    registerFn("__node_set_text_color", jsNodeSetTextColor, 5);
    registerFn("__node_set_text_padding", jsNodeSetTextPadding, 3);
    registerFn("__node_on_click", jsNodeOnClick, 2);

    // Inject a JS prelude that provides a nice API
    const prelude =
        \\const ROW = 0, COL = 1;
        \\const ALIGN_START = 0, ALIGN_CENTER = 1, ALIGN_END = 2, ALIGN_STRETCH = 3;
        \\const JUSTIFY_START = 0, JUSTIFY_CENTER = 1, JUSTIFY_END = 2, JUSTIFY_BETWEEN = 3;
        \\
        \\const Node = {
        \\  create: __node_create,
        \\  reset: __node_reset,
        \\  setWidth: __node_set_width,
        \\  setHeight: __node_set_height,
        \\  setFlexDirection: __node_set_flex_direction,
        \\  setFlexGrow: __node_set_flex_grow,
        \\  setFlexBasis: __node_set_flex_basis,
        \\  setPadding: __node_set_padding,
        \\  setMargin: __node_set_margin,
        \\  setGap: __node_set_gap,
        \\  setAlignItems: __node_set_align_items,
        \\  setJustifyContent: __node_set_justify_content,
        \\  setDisplay: __node_set_display,
        \\  setColor: __node_set_color,
        \\  addChild: __node_add_child,
        \\  getX: __node_get_x,
        \\  getY: __node_get_y,
        \\  getW: __node_get_w,
        \\  getH: __node_get_h,
        \\  count: __get_node_count,
        \\  setText: __node_set_text,
        \\  setFontSize: __node_set_font_size,
        \\  setTextColor: __node_set_text_color,
        \\  setTextPadding: __node_set_text_padding,
        \\  onClick: __node_on_click,
        \\};
        \\
        \\const Layout = { compute: __layout_compute };
        \\const Render = { frame: __render };
        \\const console = { log: __log };
        \\
    ;
    const pval = qjs.JS_Eval(g_ctx, prelude.ptr, prelude.len, "<prelude>", qjs.JS_EVAL_TYPE_GLOBAL);
    qjs.JS_FreeValue(g_ctx, pval);

    log("QuickJS runtime initialized");
    return 0;
}

export fn rt_eval(ptr: [*]const u8, len: u32) i32 {
    if (g_ctx == null) return -1;
    const val = qjs.JS_Eval(g_ctx, ptr, len, "<eval>", qjs.JS_EVAL_TYPE_GLOBAL);
    const is_err = qjs.JS_IsException(val);
    if (is_err) {
        const exc = qjs.JS_GetException(g_ctx);
        const str = qjs.JS_ToCString(g_ctx, exc);
        if (str != null) {
            const slice: []const u8 = std.mem.sliceTo(str, 0);
            log(slice);
            qjs.JS_FreeCString(g_ctx, str);
        }
        qjs.JS_FreeValue(g_ctx, exc);
        return -2;
    }
    qjs.JS_FreeValue(g_ctx, val);
    return 0;
}

export fn rt_destroy() void {
    if (g_ctx != null) qjs.JS_FreeContext(g_ctx);
    if (g_rt != null) qjs.JS_FreeRuntime(g_rt);
    g_ctx = null;
    g_rt = null;
}

// WASI libc requires a main symbol
export fn main() callconv(.c) c_int { return 0; }

// Also export the raw layout/render functions for direct WASM calls
export fn node_create() u32 { return nodeCreate(); }
export fn node_reset() void { nodeReset(); }
export fn render() void { doRender(); }
export fn layout_compute(root_idx: u32, w: f32, h: f32) void { layoutCompute(root_idx, w, h); }
export fn get_node_count() u32 { return node_count; }

// ── Input events (called by browser) ────────────────────────────────────
// type: 0=move, 1=down, 2=up
export fn rt_mouse_event(x: f32, y: f32, event_type: u32) void {
    if (g_ctx == null) return;
    if (event_type == 1) { // mouse down = click
        if (hitTest(x, y)) |node_idx| {
            // Dispatch to registered click handlers
            for (0..click_handler_count) |i| {
                if (click_handlers[i].active and click_handlers[i].node_idx == node_idx) {
                    const global = qjs.JS_GetGlobalObject(g_ctx);
                    const args = [_]qjs.JSValue{
                        qjs.JS_NewInt32(g_ctx, @intCast(node_idx)),
                        qjs.JS_NewFloat64(g_ctx, @floatCast(x)),
                        qjs.JS_NewFloat64(g_ctx, @floatCast(y)),
                    };
                    const ret = qjs.JS_Call(g_ctx, click_handlers[i].js_func, global, 3, @constCast(&args));
                    qjs.JS_FreeValue(g_ctx, ret);
                    qjs.JS_FreeValue(g_ctx, global);
                }
            }
        }
    }
}

// keycode: browser keyCode, type: 0=down, 1=up
export fn rt_key_event(keycode: u32, event_type: u32) void {
    if (g_ctx == null) return;
    // Dispatch to QuickJS — call globalThis.__onKey if defined
    const global = qjs.JS_GetGlobalObject(g_ctx);
    const handler = qjs.JS_GetPropertyStr(g_ctx, global, "__onKey");
    if (!qjs.JS_IsUndefined(handler) and !qjs.JS_IsNull(handler)) {
        const args = [_]qjs.JSValue{
            qjs.JS_NewInt32(g_ctx, @intCast(keycode)),
            qjs.JS_NewInt32(g_ctx, @intCast(event_type)),
        };
        const ret = qjs.JS_Call(g_ctx, handler, global, 2, @constCast(&args));
        qjs.JS_FreeValue(g_ctx, ret);
    }
    qjs.JS_FreeValue(g_ctx, handler);
    qjs.JS_FreeValue(g_ctx, global);
}
