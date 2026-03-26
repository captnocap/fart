//! Web entry point — Emscripten + WebGPU.
//!
//! Build: zig build web
//!
//! This is the wasm32-emscripten entry point for the full tsz runtime.
//! Emscripten provides the WebGPU device (via emdawnwebgpu) and the
//! requestAnimationFrame loop. The same GPU pipelines, layout engine,
//! and QuickJS runtime run here as on native — just with a different
//! init path and main loop.

const std = @import("std");
const builtin = @import("builtin");
const layout = @import("framework/layout.zig");
const gpu = @import("framework/gpu/gpu.zig");
const wgpu = @import("wgpu");

// ── Emscripten C API ────────────────────────────────────────────────

const em = @cImport({
    @cInclude("emscripten.h");
    @cInclude("emscripten/html5.h");
    // emscripten_webgpu_get_device() is declared in webgpu.h (emdawnwebgpu)
    @cInclude("webgpu/webgpu.h");
});

// ── State ───────────────────────────────────────────────────────────

var g_initialized: bool = false;
var g_width: u32 = 800;
var g_height: u32 = 600;

// ── Frame callback (called by requestAnimationFrame) ────────────────

fn frameCallback(_: f64, _: ?*anyopaque) callconv(.c) em.EM_BOOL {
    if (!g_initialized) return true; // keep requesting frames

    // Draw test rects to prove the pipeline works
    // drawRect(x, y, w, h, r, g, b, a, border_radius, border_width, br, bg, bb, ba)
    const w_f: f32 = @floatFromInt(g_width);
    const h_f: f32 = @floatFromInt(g_height);

    // Large centered card
    gpu.drawRect(w_f * 0.1, h_f * 0.1, w_f * 0.8, h_f * 0.8, 0.12, 0.14, 0.18, 1.0, 12, 1, 0.34, 0.40, 0.49, 1.0);

    // Blue accent bar
    gpu.drawRect(w_f * 0.1, h_f * 0.1, w_f * 0.8, 4, 0.34, 0.65, 1.0, 1.0, 12, 0, 0, 0, 0, 0);

    // Three content boxes
    var i: u32 = 0;
    while (i < 3) : (i += 1) {
        const fi: f32 = @floatFromInt(i);
        gpu.drawRect(w_f * 0.15 + fi * (w_f * 0.22), h_f * 0.3, w_f * 0.18, h_f * 0.4, 0.16 + fi * 0.04, 0.18, 0.22, 1.0, 8, 1, 0.25, 0.28, 0.33, 1.0);
    }

    gpu.frame(0.05, 0.07, 0.09);

    return true;
}

// ── Exports for JS to call ──────────────────────────────────────────

/// Called from JS after WebGPU device is acquired.
export fn web_init(width: u32, height: u32) void {
    // Get WebGPU device from Emscripten's JS-side acquisition
    const device: *wgpu.Device = @ptrCast(em.emscripten_webgpu_get_device());
    const queue = device.getQueue() orelse return;

    gpu.initWeb(device, queue, width, height) catch return;

    g_width = width;
    g_height = height;
    g_initialized = true;

    // Start the rAF loop
    _ = em.emscripten_request_animation_frame_loop(&frameCallback, null);
}

/// Called from JS on canvas resize.
export fn web_resize(width: u32, height: u32) void {
    g_width = width;
    g_height = height;
    gpu.resize(width, height);
}

// ── Emscripten main (required, can be empty) ────────────────────────

pub fn main() void {
    // Emscripten main returns immediately. Rendering is driven by
    // requestAnimationFrame via web_init().
}
