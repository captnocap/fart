//! Retained-mode compositor for tsz
//!
//! Every node gets an SDL texture. Content is rendered to each texture,
//! then children are composited bottom-up into parent textures.
//! Root texture is blitted to screen.
//!
//! This enables:
//! - Transforms (rotation, scale) via SDL_RenderCopyEx
//! - Per-node opacity via SDL_SetTextureAlphaMod
//! - Free overflow clipping (texture IS the clip rect)
//! - Future: dirty tracking (only re-render changed nodes)
//!
//! Replaces the immediate-mode Painter.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const image_mod = @import("image.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;
const ImageCache = image_mod.ImageCache;

// ════════════════════════════════════════════════════════════════════════
// Layer management
// ════════════════════════════════════════════════════════════════════════

const MAX_LAYERS = 512;

const Layer = struct {
    node: ?*Node = null,
    texture: ?*c.SDL_Texture = null,
    width: i32 = 0,
    height: i32 = 0,
};

var layers: [MAX_LAYERS]Layer = [_]Layer{.{}} ** MAX_LAYERS;
var layer_count: usize = 0;

// Renderer + engines (set during init)
var g_renderer: ?*c.SDL_Renderer = null;
var g_text_engine: ?*TextEngine = null;
var g_image_cache: ?*ImageCache = null;

// Hover state (set externally per frame)
var g_hovered_node: ?*Node = null;

// Rounded rect texture (shared with main)
var g_circle_tex: ?*c.SDL_Texture = null;
const CIRCLE_TEX_SIZE = 32;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

pub fn init(renderer: *c.SDL_Renderer, text_engine: *TextEngine, image_cache: *ImageCache) void {
    g_renderer = renderer;
    g_text_engine = text_engine;
    g_image_cache = image_cache;
    initCircleTexture(renderer);
}

pub fn deinit() void {
    for (0..layer_count) |i| {
        if (layers[i].texture) |tex| {
            c.SDL_DestroyTexture(tex);
        }
        layers[i] = .{};
    }
    layer_count = 0;
    if (g_circle_tex) |t| {
        c.SDL_DestroyTexture(t);
        g_circle_tex = null;
    }
}

pub fn setHoveredNode(node: ?*Node) void {
    g_hovered_node = node;
}

/// Composite the entire tree and present to screen.
/// Call this instead of painter.paintTree + painter.present.
pub fn frame(root: *Node, win_w: f32, win_h: f32, bg_color: Color) void {
    const renderer = g_renderer orelse return;

    // Ensure all nodes have correctly-sized textures
    syncTextures(root);

    // Bottom-up: render content + composite children
    compositeNode(root);

    // Blit root texture to screen
    _ = c.SDL_SetRenderTarget(renderer, null);
    _ = c.SDL_SetRenderDrawColor(renderer, bg_color.r, bg_color.g, bg_color.b, bg_color.a);
    _ = c.SDL_RenderClear(renderer);

    const root_layer = findLayer(root) orelse return;
    const root_tex = root_layer.texture orelse return;
    _ = c.SDL_SetTextureBlendMode(root_tex, c.SDL_BLENDMODE_BLEND);
    var dst = c.SDL_Rect{
        .x = @intFromFloat(root.computed.x),
        .y = @intFromFloat(root.computed.y),
        .w = @intFromFloat(root.computed.w),
        .h = @intFromFloat(root.computed.h),
    };

    // Apply root transforms if any
    if (root.style.rotation != 0 or root.style.scale_x != 1 or root.style.scale_y != 1) {
        dst.w = @intFromFloat(@as(f32, @floatFromInt(dst.w)) * root.style.scale_x);
        dst.h = @intFromFloat(@as(f32, @floatFromInt(dst.h)) * root.style.scale_y);
        _ = c.SDL_RenderCopyEx(renderer, root_tex, null, &dst, @as(f64, root.style.rotation), null, c.SDL_FLIP_NONE);
    } else {
        _ = c.SDL_RenderCopy(renderer, root_tex, null, &dst);
    }

    // Fill remaining screen area with bg color (already cleared above)
    _ = win_w;
    _ = win_h;

    c.SDL_RenderPresent(renderer);
}

// ════════════════════════════════════════════════════════════════════════
// Texture sync — ensure every node has a correctly-sized texture
// ════════════════════════════════════════════════════════════════════════

fn syncTextures(node: *Node) void {
    if (node.style.display == .none) return;

    const w = @max(1, @as(i32, @intFromFloat(node.computed.w)));
    const h = @max(1, @as(i32, @intFromFloat(node.computed.h)));
    const layer = getOrCreateLayer(node);

    // Recreate texture if dimensions changed
    if (layer.width != w or layer.height != h) {
        if (layer.texture) |old| c.SDL_DestroyTexture(old);
        layer.texture = createTargetTexture(w, h);
        layer.width = w;
        layer.height = h;
    }

    for (node.children) |*child| {
        syncTextures(child);
    }
}

fn createTargetTexture(w: i32, h: i32) ?*c.SDL_Texture {
    const renderer = g_renderer orelse return null;
    const tex = c.SDL_CreateTexture(
        renderer,
        c.SDL_PIXELFORMAT_RGBA8888,
        c.SDL_TEXTUREACCESS_TARGET,
        w,
        h,
    );
    if (tex) |t| {
        _ = c.SDL_SetTextureBlendMode(t, c.SDL_BLENDMODE_BLEND);
    }
    return tex;
}

// ════════════════════════════════════════════════════════════════════════
// Bottom-up compositing
// ════════════════════════════════════════════════════════════════════════

fn compositeNode(node: *Node) void {
    if (node.style.display == .none) return;
    const renderer = g_renderer orelse return;
    const layer = findLayer(node) orelse return;
    const tex = layer.texture orelse return;

    // ── Step 1: Render this node's own content to its texture ────────
    _ = c.SDL_SetRenderTarget(renderer, tex);
    // Clear to transparent
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_NONE);
    _ = c.SDL_SetRenderDrawColor(renderer, 0, 0, 0, 0);
    _ = c.SDL_RenderClear(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    renderContent(node);

    // ── Step 2: Composite children (bottom-up) ──────────────────────
    // Z-index sort
    var needs_zsort = false;
    for (node.children) |*child| {
        if (child.style.z_index != 0) {
            needs_zsort = true;
            break;
        }
    }

    const scroll_x: f32 = if (node.style.overflow != .visible) node.scroll_x else 0;
    const scroll_y: f32 = if (node.style.overflow != .visible) node.scroll_y else 0;

    if (needs_zsort and node.children.len <= 512) {
        var indices: [512]u16 = undefined;
        for (0..node.children.len) |ci| indices[ci] = @intCast(ci);
        // Insertion sort by z_index (stable, small N)
        var si: usize = 1;
        while (si < node.children.len) : (si += 1) {
            const key_idx = indices[si];
            const key_z = node.children[key_idx].style.z_index;
            var sj: usize = si;
            while (sj > 0 and node.children[indices[sj - 1]].style.z_index > key_z) : (sj -= 1) {
                indices[sj] = indices[sj - 1];
            }
            indices[sj] = key_idx;
        }
        for (0..node.children.len) |ci| {
            compositeChild(node, &node.children[indices[ci]], scroll_x, scroll_y);
        }
    } else {
        for (node.children) |*child| {
            compositeChild(node, child, scroll_x, scroll_y);
        }
    }
}

fn compositeChild(parent: *Node, child: *Node, scroll_x: f32, scroll_y: f32) void {
    if (child.style.display == .none) return;
    const renderer = g_renderer orelse return;

    // Recurse — child's texture now has its content + its children
    compositeNode(child);

    // Restore render target to parent's texture
    const parent_layer = findLayer(parent) orelse return;
    _ = c.SDL_SetRenderTarget(renderer, parent_layer.texture);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    const child_layer = findLayer(child) orelse return;
    const child_tex = child_layer.texture orelse return;

    // Child position relative to parent
    const cx = child.computed.x - parent.computed.x - scroll_x;
    const cy = child.computed.y - parent.computed.y - scroll_y;

    // Box shadow — rendered to parent texture (extends outside child bounds)
    renderShadow(child, cx, cy);

    // Opacity
    const alpha: u8 = @intFromFloat(@min(255.0, @max(0.0, child.style.opacity * 255.0)));
    _ = c.SDL_SetTextureAlphaMod(child_tex, alpha);

    // Destination rect (may be scaled)
    var dw: f32 = @floatFromInt(child_layer.width);
    var dh: f32 = @floatFromInt(child_layer.height);
    var dx = cx;
    var dy = cy;

    // Scale: adjust size and re-center
    if (child.style.scale_x != 1.0 or child.style.scale_y != 1.0) {
        const new_w = dw * child.style.scale_x;
        const new_h = dh * child.style.scale_y;
        dx += (dw - new_w) / 2.0; // center
        dy += (dh - new_h) / 2.0;
        dw = new_w;
        dh = new_h;
    }

    var dst = c.SDL_Rect{
        .x = @intFromFloat(dx),
        .y = @intFromFloat(dy),
        .w = @intFromFloat(dw),
        .h = @intFromFloat(dh),
    };

    // Blit with rotation if needed
    if (child.style.rotation != 0) {
        _ = c.SDL_RenderCopyEx(renderer, child_tex, null, &dst, @as(f64, child.style.rotation), null, c.SDL_FLIP_NONE);
    } else {
        _ = c.SDL_RenderCopy(renderer, child_tex, null, &dst);
    }

    // Reset alpha mod
    _ = c.SDL_SetTextureAlphaMod(child_tex, 255);
}

// ════════════════════════════════════════════════════════════════════════
// Content rendering — draws a single node's content to its texture
// ════════════════════════════════════════════════════════════════════════

fn renderContent(node: *Node) void {
    const renderer = g_renderer orelse return;
    const w = @as(i32, @intFromFloat(node.computed.w));
    const h = @as(i32, @intFromFloat(node.computed.h));

    // ── Background ──────────────────────────────────────────────────
    if (node.style.background_color) |color| {
        const is_hovered = (g_hovered_node != null and g_hovered_node.? == node);
        const paint_color = if (is_hovered) brighten(color) else color;

        if (node.style.gradient_color_end != null and node.style.gradient_direction != .none) {
            renderGradient(node, paint_color, w, h);
        } else if (node.style.border_radius > 0) {
            fillRoundedRect(renderer, 0, 0, w, h, node.style.border_radius, paint_color, 255);
        } else {
            _ = c.SDL_SetRenderDrawColor(renderer, paint_color.r, paint_color.g, paint_color.b, paint_color.a);
            var rect = c.SDL_Rect{ .x = 0, .y = 0, .w = w, .h = h };
            _ = c.SDL_RenderFillRect(renderer, &rect);
        }
    }

    // ── Border ──────────────────────────────────────────────────────
    if (node.style.border_width > 0) {
        const bw = @as(i32, @intFromFloat(node.style.border_width));
        const bc = node.style.border_color orelse Color.rgb(255, 255, 255);
        _ = c.SDL_SetRenderDrawColor(renderer, bc.r, bc.g, bc.b, bc.a);
        var top_r = c.SDL_Rect{ .x = 0, .y = 0, .w = w, .h = bw };
        _ = c.SDL_RenderFillRect(renderer, &top_r);
        var bot_r = c.SDL_Rect{ .x = 0, .y = h - bw, .w = w, .h = bw };
        _ = c.SDL_RenderFillRect(renderer, &bot_r);
        var lft_r = c.SDL_Rect{ .x = 0, .y = bw, .w = bw, .h = h - bw * 2 };
        _ = c.SDL_RenderFillRect(renderer, &lft_r);
        var rgt_r = c.SDL_Rect{ .x = w - bw, .y = bw, .w = bw, .h = h - bw * 2 };
        _ = c.SDL_RenderFillRect(renderer, &rgt_r);
    }

    // ── Image ───────────────────────────────────────────────────────
    if (node.image_src) |src| {
        if (g_image_cache) |cache| {
            if (cache.load(src)) |img| {
                var dst = c.SDL_Rect{ .x = 0, .y = 0, .w = w, .h = h };
                _ = c.SDL_RenderCopy(renderer, img.texture, null, &dst);
            }
        }
    }

    // ── Text ────────────────────────────────────────────────────────
    if (node.text) |txt| {
        if (g_text_engine) |te| {
            const pad_l = node.style.padLeft();
            const pad_r = node.style.padRight();
            const pad_t = node.style.padTop();
            const color = node.text_color orelse Color.rgb(255, 255, 255);
            const text_max_w = node.computed.w - pad_l - pad_r;
            te.drawTextWrappedFull(
                txt,
                pad_l,
                pad_t,
                node.font_size,
                text_max_w,
                color,
                node.style.text_align,
                node.letter_spacing,
                node.line_height,
                node.number_of_lines,
            );
        }
    }
}

// ════════════════════════════════════════════════════════════════════════
// Shadow rendering — rendered to parent texture (extends outside node)
// ════════════════════════════════════════════════════════════════════════

fn renderShadow(node: *Node, cx: f32, cy: f32) void {
    const renderer = g_renderer orelse return;
    const shadow_col = node.style.shadow_color orelse return;
    if (node.style.shadow_blur <= 0) return;

    const blur = node.style.shadow_blur;
    const off_x = node.style.shadow_offset_x;
    const off_y = node.style.shadow_offset_y;
    const sx = @as(i32, @intFromFloat(cx));
    const sy = @as(i32, @intFromFloat(cy));
    const sw = @as(i32, @intFromFloat(node.computed.w));
    const sh = @as(i32, @intFromFloat(node.computed.h));
    var steps: i32 = @intFromFloat(@ceil(blur));
    if (steps > 10) steps = 10;
    if (steps < 1) steps = 1;

    var step: i32 = steps;
    while (step >= 1) : (step -= 1) {
        const expand: i32 = step;
        const alpha_f = @as(f32, @floatFromInt(shadow_col.a)) *
            (1.0 - @as(f32, @floatFromInt(step)) / @as(f32, @floatFromInt(steps + 1)));
        const sa: u8 = @intFromFloat(@max(0, @min(255, alpha_f)));
        _ = c.SDL_SetRenderDrawColor(renderer, shadow_col.r, shadow_col.g, shadow_col.b, sa);
        var sr = c.SDL_Rect{
            .x = sx + @as(i32, @intFromFloat(off_x)) - expand,
            .y = sy + @as(i32, @intFromFloat(off_y)) - expand,
            .w = sw + expand * 2,
            .h = sh + expand * 2,
        };
        _ = c.SDL_RenderFillRect(renderer, &sr);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Gradient rendering
// ════════════════════════════════════════════════════════════════════════

fn renderGradient(node: *Node, start_color: Color, w: i32, h: i32) void {
    const renderer = g_renderer orelse return;
    const end_color = node.style.gradient_color_end orelse return;
    const dir = node.style.gradient_direction;

    const steps: i32 = if (dir == .vertical) h else w;
    if (steps <= 0) return;

    var i: i32 = 0;
    while (i < steps) : (i += 1) {
        const t: f32 = @as(f32, @floatFromInt(i)) / @as(f32, @floatFromInt(@max(1, steps - 1)));
        const r_val: u8 = @intFromFloat(@as(f32, @floatFromInt(start_color.r)) + (@as(f32, @floatFromInt(end_color.r)) - @as(f32, @floatFromInt(start_color.r))) * t);
        const g_val: u8 = @intFromFloat(@as(f32, @floatFromInt(start_color.g)) + (@as(f32, @floatFromInt(end_color.g)) - @as(f32, @floatFromInt(start_color.g))) * t);
        const b_val: u8 = @intFromFloat(@as(f32, @floatFromInt(start_color.b)) + (@as(f32, @floatFromInt(end_color.b)) - @as(f32, @floatFromInt(start_color.b))) * t);
        _ = c.SDL_SetRenderDrawColor(renderer, r_val, g_val, b_val, start_color.a);
        var rect: c.SDL_Rect = if (dir == .vertical)
            .{ .x = 0, .y = i, .w = w, .h = 1 }
        else
            .{ .x = i, .y = 0, .w = 1, .h = h };
        _ = c.SDL_RenderFillRect(renderer, &rect);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Rounded rectangle support
// ════════════════════════════════════════════════════════════════════════

fn initCircleTexture(renderer: *c.SDL_Renderer) void {
    const surface = c.SDL_CreateRGBSurfaceWithFormat(0, CIRCLE_TEX_SIZE, CIRCLE_TEX_SIZE, 32, c.SDL_PIXELFORMAT_ARGB8888);
    if (surface == null) return;
    defer c.SDL_FreeSurface(surface);

    const pixels: [*]u8 = @ptrCast(surface.*.pixels);
    const pitch: usize = @intCast(surface.*.pitch);
    const r: f32 = @as(f32, CIRCLE_TEX_SIZE) / 2.0;

    for (0..CIRCLE_TEX_SIZE) |row| {
        for (0..CIRCLE_TEX_SIZE) |col| {
            const dx = @as(f32, @floatFromInt(col)) + 0.5 - r;
            const dy = @as(f32, @floatFromInt(row)) + 0.5 - r;
            const dist = @sqrt(dx * dx + dy * dy);
            const alpha: u8 = if (dist <= r - 0.5) 255 else if (dist <= r + 0.5) @intFromFloat((r + 0.5 - dist) * 255.0) else 0;
            const off = row * pitch + col * 4;
            pixels[off + 0] = 255; // B
            pixels[off + 1] = 255; // G
            pixels[off + 2] = 255; // R
            pixels[off + 3] = alpha; // A
        }
    }

    const tex = c.SDL_CreateTextureFromSurface(renderer, surface);
    if (tex) |t| {
        _ = c.SDL_SetTextureBlendMode(t, c.SDL_BLENDMODE_BLEND);
        g_circle_tex = t;
    }
}

fn fillRoundedRect(renderer: *c.SDL_Renderer, ix: i32, iy: i32, iw: i32, ih: i32, radius_raw: f32, col: Color, opacity: u8) void {
    const tex = g_circle_tex orelse {
        _ = c.SDL_SetRenderDrawColor(renderer, col.r, col.g, col.b, opacity);
        var r = c.SDL_Rect{ .x = ix, .y = iy, .w = iw, .h = ih };
        _ = c.SDL_RenderFillRect(renderer, &r);
        return;
    };

    const radius = @min(radius_raw, @as(f32, @floatFromInt(@min(iw, ih))) / 2.0);
    const ri: i32 = @intFromFloat(radius);
    if (ri <= 0) {
        _ = c.SDL_SetRenderDrawColor(renderer, col.r, col.g, col.b, opacity);
        var r = c.SDL_Rect{ .x = ix, .y = iy, .w = iw, .h = ih };
        _ = c.SDL_RenderFillRect(renderer, &r);
        return;
    }

    _ = c.SDL_SetRenderDrawColor(renderer, col.r, col.g, col.b, opacity);
    _ = c.SDL_SetTextureColorMod(tex, col.r, col.g, col.b);
    _ = c.SDL_SetTextureAlphaMod(tex, opacity);

    // Center rect
    var center = c.SDL_Rect{ .x = ix, .y = iy + ri, .w = iw, .h = ih - ri * 2 };
    _ = c.SDL_RenderFillRect(renderer, &center);
    // Top strip
    var top_r = c.SDL_Rect{ .x = ix + ri, .y = iy, .w = iw - ri * 2, .h = ri };
    _ = c.SDL_RenderFillRect(renderer, &top_r);
    // Bottom strip
    var bot_r = c.SDL_Rect{ .x = ix + ri, .y = iy + ih - ri, .w = iw - ri * 2, .h = ri };
    _ = c.SDL_RenderFillRect(renderer, &bot_r);

    const half = CIRCLE_TEX_SIZE / 2;
    var tl_src = c.SDL_Rect{ .x = 0, .y = 0, .w = half, .h = half };
    var tl_dst = c.SDL_Rect{ .x = ix, .y = iy, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &tl_src, &tl_dst);
    var tr_src = c.SDL_Rect{ .x = half, .y = 0, .w = half, .h = half };
    var tr_dst = c.SDL_Rect{ .x = ix + iw - ri, .y = iy, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &tr_src, &tr_dst);
    var bl_src = c.SDL_Rect{ .x = 0, .y = half, .w = half, .h = half };
    var bl_dst = c.SDL_Rect{ .x = ix, .y = iy + ih - ri, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &bl_src, &bl_dst);
    var br_src = c.SDL_Rect{ .x = half, .y = half, .w = half, .h = half };
    var br_dst = c.SDL_Rect{ .x = ix + iw - ri, .y = iy + ih - ri, .w = ri, .h = ri };
    _ = c.SDL_RenderCopy(renderer, tex, &br_src, &br_dst);
}

// ════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════

fn brighten(color: Color) Color {
    return .{
        .r = @min(255, @as(u16, color.r) + 30),
        .g = @min(255, @as(u16, color.g) + 30),
        .b = @min(255, @as(u16, color.b) + 30),
        .a = color.a,
    };
}

// ════════════════════════════════════════════════════════════════════════
// Layer lookup — linear scan by node pointer
// ════════════════════════════════════════════════════════════════════════

fn findLayer(node: *Node) ?*Layer {
    for (0..layer_count) |i| {
        if (layers[i].node == node) return &layers[i];
    }
    return null;
}

fn getOrCreateLayer(node: *Node) *Layer {
    // Try to find existing
    if (findLayer(node)) |layer| return layer;

    // Allocate new
    std.debug.assert(layer_count < MAX_LAYERS);
    layers[layer_count] = .{ .node = node };
    const layer = &layers[layer_count];
    layer_count += 1;
    return layer;
}
