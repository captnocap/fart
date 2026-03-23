//! WASM exports — layout engine for browser target.
//!
//! Build: zig build wasm
//! Output: zig-out/bin/tsz-layout.wasm
//!
//! Exports the flex layout engine so it can be called from JavaScript.
//! No SDL2, no wgpu, no C deps — pure Zig math.

const std = @import("std");
const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;

// ── Node pool ───────────────────────────────────────────────────────

const MAX_NODES = 4096;
const MAX_CHILDREN = 32;

var nodes: [MAX_NODES]Node = [_]Node{.{}} ** MAX_NODES;
var node_count: u32 = 0;

// Parent-child relationships stored as indices (not copies).
// Built into actual Node.children slices at layout_compute time.
var child_indices: [MAX_NODES][MAX_CHILDREN]u32 = undefined;
var child_counts: [MAX_NODES]u32 = [_]u32{0} ** MAX_NODES;

// Scratch space for building the tree — layout mutates children in-place.
var tree_nodes: [MAX_NODES]Node = undefined;
var tree_children: [MAX_NODES][MAX_CHILDREN]Node = undefined;

export fn node_create() u32 {
    if (node_count >= MAX_NODES) return 0xFFFFFFFF;
    const idx = node_count;
    nodes[idx] = .{};
    child_counts[idx] = 0;
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

export fn node_add_child(parent_idx: u32, child_idx: u32) void {
    if (parent_idx >= node_count or child_idx >= node_count) return;
    const cc = child_counts[parent_idx];
    if (cc >= MAX_CHILDREN) return;
    child_indices[parent_idx][cc] = child_idx;
    child_counts[parent_idx] = cc + 1;
}

// ── Layout computation ──────────────────────────────────────────────
// Three phases:
// 1. Copy current node styles into tree_nodes (snapshot)
// 2. Build children slices from index relationships
// 3. Run layout, then copy computed results back to nodes[]

fn buildTree(idx: u32) void {
    tree_nodes[idx] = nodes[idx];
    tree_nodes[idx].computed = .{};
    const cc = child_counts[idx];
    if (cc == 0) {
        tree_nodes[idx].children = &.{};
        return;
    }
    // Build children recursively
    for (0..cc) |ci| {
        const child_idx = child_indices[idx][ci];
        buildTree(child_idx);
        tree_children[idx][ci] = tree_nodes[child_idx];
    }
    tree_nodes[idx].children = tree_children[idx][0..cc];
}

fn copyResultsBack(idx: u32) void {
    nodes[idx].computed = tree_nodes[idx].computed;
    const cc = child_counts[idx];
    for (0..cc) |ci| {
        const child_idx = child_indices[idx][ci];
        // The layout engine wrote results into tree_children[idx][ci]
        tree_nodes[child_idx].computed = tree_children[idx][ci].computed;
        // Copy grandchildren results recursively
        copyChildResults(child_idx, &tree_children[idx][ci]);
    }
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
    // Copy computed results back — root
    nodes[root_idx].computed = tree_nodes[root_idx].computed;
    // Copy children results
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
