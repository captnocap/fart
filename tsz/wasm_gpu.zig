//! WASM engine — layout + WebGPU rect rendering in one module.
//!
//! Build: zig build wasm-gpu
//! Output: zig-out/bin/tsz-gpu.wasm
//!
//! Combines the flex layout engine with WebGPU rendering.
//! JS provides the GPU importObject shim; Zig does layout math and emits rects.

const std = @import("std");
const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;

// ── JS import shim (provided by importObject) ──────────────────────
extern "env" fn gpu_begin_frame() void;
extern "env" fn gpu_draw_rect(x: f32, y: f32, w: f32, h: f32, r: f32, g: f32, b: f32, a: f32) void;
extern "env" fn gpu_end_frame() void;
extern "env" fn gpu_log(ptr: [*]const u8, len: u32) void;

fn log(msg: []const u8) void {
    gpu_log(msg.ptr, @intCast(msg.len));
}

// ── Node pool ───────────────────────────────────────────────────────

const MAX_NODES = 4096;
const MAX_CHILDREN = 32;

var nodes: [MAX_NODES]Node = [_]Node{.{}} ** MAX_NODES;
var node_count: u32 = 0;

var child_indices: [MAX_NODES][MAX_CHILDREN]u32 = undefined;
var child_counts: [MAX_NODES]u32 = [_]u32{0} ** MAX_NODES;

var tree_nodes: [MAX_NODES]Node = undefined;
var tree_children: [MAX_NODES][MAX_CHILDREN]Node = undefined;

// Per-node color (layout engine doesn't store RGBA, we track it separately)
const Color = struct { r: f32 = 0, g: f32 = 0, b: f32 = 0, a: f32 = 0 };
var node_colors: [MAX_NODES]Color = [_]Color{.{}} ** MAX_NODES;

export fn node_create() u32 {
    if (node_count >= MAX_NODES) return 0xFFFFFFFF;
    const idx = node_count;
    nodes[idx] = .{};
    child_counts[idx] = 0;
    node_colors[idx] = .{};
    node_count += 1;
    return idx;
}

export fn node_reset() void {
    node_count = 0;
}

// ── Style setters ───────────────────────────────────────────────────

export fn node_set_width(idx: u32, w: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.width = w;
}

export fn node_set_height(idx: u32, h: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.height = h;
}

export fn node_set_flex_direction(idx: u32, dir: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.flex_direction = @enumFromInt(dir);
}

export fn node_set_flex_grow(idx: u32, grow: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.flex_grow = grow;
}

export fn node_set_flex_basis(idx: u32, basis: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.flex_basis = basis;
}

export fn node_set_padding(idx: u32, top: f32, right: f32, bottom: f32, left: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.padding_top = top;
    nodes[idx].style.padding_right = right;
    nodes[idx].style.padding_bottom = bottom;
    nodes[idx].style.padding_left = left;
}

export fn node_set_margin(idx: u32, top: f32, right: f32, bottom: f32, left: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.margin_top = top;
    nodes[idx].style.margin_right = right;
    nodes[idx].style.margin_bottom = bottom;
    nodes[idx].style.margin_left = left;
}

export fn node_set_gap(idx: u32, gap: f32) void {
    if (idx >= node_count) return;
    nodes[idx].style.gap = gap;
}

export fn node_set_align_items(idx: u32, val: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.align_items = @enumFromInt(val);
}

export fn node_set_justify_content(idx: u32, justify: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.justify_content = @enumFromInt(justify);
}

export fn node_set_display(idx: u32, val: u32) void {
    if (idx >= node_count) return;
    nodes[idx].style.display = @enumFromInt(val);
}

export fn node_set_color(idx: u32, r: f32, g: f32, b: f32, a: f32) void {
    if (idx >= node_count) return;
    node_colors[idx] = .{ .r = r, .g = g, .b = b, .a = a };
}

export fn node_add_child(parent_idx: u32, child_idx: u32) void {
    if (parent_idx >= node_count or child_idx >= node_count) return;
    const cc = child_counts[parent_idx];
    if (cc >= MAX_CHILDREN) return;
    child_indices[parent_idx][cc] = child_idx;
    child_counts[parent_idx] = cc + 1;
}

// ── Layout tree builder ─────────────────────────────────────────────

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

export fn layout_compute(root_idx: u32, container_w: f32, container_h: f32) void {
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

// ── Result getters ──────────────────────────────────────────────────

export fn node_get_x(idx: u32) f32 {
    if (idx >= node_count) return 0;
    return nodes[idx].computed.x;
}

export fn node_get_y(idx: u32) f32 {
    if (idx >= node_count) return 0;
    return nodes[idx].computed.y;
}

export fn node_get_w(idx: u32) f32 {
    if (idx >= node_count) return 0;
    return nodes[idx].computed.w;
}

export fn node_get_h(idx: u32) f32 {
    if (idx >= node_count) return 0;
    return nodes[idx].computed.h;
}

export fn get_node_count() u32 {
    return node_count;
}

// ── Render ──────────────────────────────────────────────────────────
// Walk all nodes, emit a rect for each one that has a color with a > 0.

export fn render() void {
    gpu_begin_frame();
    for (0..node_count) |i| {
        const c = node_colors[i];
        if (c.a > 0) {
            const n = nodes[i];
            gpu_draw_rect(n.computed.x, n.computed.y, n.computed.w, n.computed.h, c.r, c.g, c.b, c.a);
        }
    }
    gpu_end_frame();
}
