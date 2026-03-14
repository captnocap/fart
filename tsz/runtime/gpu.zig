//! wgpu-native GPU backend for tsz
//!
//! Replaces SDL_Renderer with wgpu for GPU-accelerated rendering.
//! SDL2 is still used for windowing and events — wgpu gets the
//! native window handle from SDL to create its surface.

const std = @import("std");
const wgpu = @import("wgpu");
const c = @import("c.zig").imports;
const shaders = @import("gpu_shaders.zig");

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

/// Per-instance rect data — matches the WGSL struct layout.
/// 9 x f32 = 36 bytes, padded to 64 bytes (16-float aligned for GPU).
pub const RectInstance = extern struct {
    // Position (top-left, screen pixels)
    pos_x: f32,
    pos_y: f32,
    // Size (width, height in pixels)
    size_w: f32,
    size_h: f32,
    // Background color RGBA [0..1]
    color_r: f32,
    color_g: f32,
    color_b: f32,
    color_a: f32,
    // Border color RGBA [0..1]
    border_color_r: f32,
    border_color_g: f32,
    border_color_b: f32,
    border_color_a: f32,
    // Border radius per corner: tl, tr, br, bl
    radius_tl: f32,
    radius_tr: f32,
    radius_br: f32,
    radius_bl: f32,
    // Border width
    border_width: f32,
    // Padding to 20 floats (80 bytes, aligned to 16)
    _pad0: f32 = 0,
    _pad1: f32 = 0,
    _pad2: f32 = 0,
};

const MAX_RECTS = 4096;

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

var g_instance: ?*wgpu.Instance = null;
var g_surface: ?*wgpu.Surface = null;
var g_adapter: ?*wgpu.Adapter = null;
var g_device: ?*wgpu.Device = null;
var g_queue: ?*wgpu.Queue = null;
var g_format: wgpu.TextureFormat = .bgra8_unorm;
var g_width: u32 = 0;
var g_height: u32 = 0;

// Rect pipeline
var g_rect_pipeline: ?*wgpu.RenderPipeline = null;
var g_rect_buffer: ?*wgpu.Buffer = null;
var g_globals_buffer: ?*wgpu.Buffer = null;
var g_bind_group: ?*wgpu.BindGroup = null;

// CPU-side rect batch
var g_rects: [MAX_RECTS]RectInstance = undefined;
var g_rect_count: usize = 0;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

pub fn init(window: *c.SDL_Window) !void {
    // Create wgpu instance with Vulkan backend only
    // (the GL/EGL probe panics when SDL already has the display)
    var extras = wgpu.InstanceExtras{
        .backends = wgpu.InstanceBackends.vulkan,
        .flags = wgpu.InstanceFlags.default,
        .dx12_shader_compiler = .@"undefined",
        .gles3_minor_version = .automatic,
        .gl_fence_behavior = .gl_fence_behaviour_normal,
        .dxc_max_shader_model = .dxc_max_shader_model_v6_0,
    };
    var desc = wgpu.InstanceDescriptor{
        .features = .{ .timed_wait_any_enable = 0, .timed_wait_any_max_count = 0 },
    };
    desc = desc.withNativeExtras(&extras);
    g_instance = wgpu.Instance.create(&desc) orelse return error.WGPUInstanceFailed;
    const instance = g_instance.?;

    // Get native window handle from SDL2
    var wm_info: c.SDL_SysWMinfo = std.mem.zeroes(c.SDL_SysWMinfo);
    wm_info.version.major = c.SDL_MAJOR_VERSION;
    wm_info.version.minor = c.SDL_MINOR_VERSION;
    wm_info.version.patch = c.SDL_PATCHLEVEL;
    if (c.SDL_GetWindowWMInfo(window, &wm_info) != c.SDL_TRUE) {
        std.debug.print("SDL_GetWindowWMInfo failed: {s}\n", .{c.SDL_GetError()});
        return error.WindowInfoFailed;
    }

    // Create surface from native window handle
    g_surface = createSurfaceFromSDL(instance, &wm_info) orelse return error.SurfaceCreateFailed;
    const surface = g_surface.?;

    // Request adapter
    const adapter_response = instance.requestAdapterSync(&.{
        .compatible_surface = surface,
        .power_preference = .high_performance,
    }, 200_000_000);
    if (adapter_response.status != .success) {
        std.debug.print("wgpu adapter request failed\n", .{});
        return error.AdapterRequestFailed;
    }
    g_adapter = adapter_response.adapter;
    const adapter = g_adapter.?;

    // Request device
    const device_response = adapter.requestDeviceSync(instance, null, 200_000_000);
    if (device_response.status != .success) {
        std.debug.print("wgpu device request failed\n", .{});
        return error.DeviceRequestFailed;
    }
    g_device = device_response.device;
    const device = g_device.?;
    g_queue = device.getQueue();

    // Get window size and configure surface
    var w: c_int = 0;
    var h: c_int = 0;
    c.SDL_GetWindowSize(window, &w, &h);
    g_width = @intCast(w);
    g_height = @intCast(h);

    configureSurface(g_width, g_height);

    // Create rect pipeline
    initRectPipeline(device);

    std.debug.print("wgpu initialized: {d}x{d}\n", .{ g_width, g_height });
}

pub fn deinit() void {
    if (g_bind_group) |bg| bg.release();
    if (g_globals_buffer) |b| b.release();
    if (g_rect_buffer) |b| b.release();
    if (g_rect_pipeline) |p| p.release();
    if (g_queue) |q| q.release();
    if (g_device) |d| d.release();
    if (g_adapter) |a| a.release();
    if (g_surface) |s| s.release();
    if (g_instance) |i| i.release();
    g_bind_group = null;
    g_globals_buffer = null;
    g_rect_buffer = null;
    g_rect_pipeline = null;
    g_queue = null;
    g_device = null;
    g_adapter = null;
    g_surface = null;
    g_instance = null;
}

pub fn resize(width: u32, height: u32) void {
    if (width == 0 or height == 0) return;
    g_width = width;
    g_height = height;
    configureSurface(width, height);
}

/// Queue a rectangle for drawing this frame.
pub fn drawRect(
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    r: f32,
    g: f32,
    b: f32,
    a: f32,
    border_radius: f32,
    border_width: f32,
    br: f32,
    bg: f32,
    bb: f32,
    ba: f32,
) void {
    if (g_rect_count >= MAX_RECTS) return;
    g_rects[g_rect_count] = .{
        .pos_x = x,
        .pos_y = y,
        .size_w = w,
        .size_h = h,
        .color_r = r,
        .color_g = g,
        .color_b = b,
        .color_a = a,
        .border_color_r = br,
        .border_color_g = bg,
        .border_color_b = bb,
        .border_color_a = ba,
        .radius_tl = border_radius,
        .radius_tr = border_radius,
        .radius_br = border_radius,
        .radius_bl = border_radius,
        .border_width = border_width,
    };
    g_rect_count += 1;
}

/// Render all queued primitives and present.
pub fn frame(bg_r: f64, bg_g: f64, bg_b: f64) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const queue = g_queue orelse return;

    // Get current surface texture
    var surface_texture: wgpu.SurfaceTexture = undefined;
    surface.getCurrentTexture(&surface_texture);
    if (surface_texture.status != .success_optimal and surface_texture.status != .success_suboptimal) {
        if (g_width > 0 and g_height > 0) configureSurface(g_width, g_height);
        g_rect_count = 0;
        return;
    }

    const texture = surface_texture.texture orelse return;
    const view = texture.createView(null) orelse return;
    defer view.release();

    // Update globals uniform (screen size)
    const globals = [2]f32{ @floatFromInt(g_width), @floatFromInt(g_height) };
    if (g_globals_buffer) |buf| {
        queue.writeBuffer(buf, 0, @ptrCast(&globals), @sizeOf(@TypeOf(globals)));
    }

    // Upload rect instance data
    if (g_rect_count > 0) {
        if (g_rect_buffer) |buf| {
            const byte_size = g_rect_count * @sizeOf(RectInstance);
            queue.writeBuffer(buf, 0, @ptrCast(&g_rects), byte_size);
        }
    }

    const encoder = device.createCommandEncoder(&.{}) orelse return;

    // Render pass
    const color_attachment = wgpu.ColorAttachment{
        .view = view,
        .load_op = .clear,
        .store_op = .store,
        .clear_value = .{ .r = bg_r, .g = bg_g, .b = bg_b, .a = 1.0 },
    };

    const render_pass = encoder.beginRenderPass(&.{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&color_attachment),
    }) orelse return;

    // Draw rects
    if (g_rect_count > 0) {
        if (g_rect_pipeline) |pipeline| {
            render_pass.setPipeline(pipeline);
            if (g_bind_group) |bg| {
                render_pass.setBindGroup(0, bg, 0, null);
            }
            if (g_rect_buffer) |buf| {
                render_pass.setVertexBuffer(0, buf, 0, g_rect_count * @sizeOf(RectInstance));
            }
            // 6 vertices per rect (2 triangles), instanced
            render_pass.draw(6, @intCast(g_rect_count), 0, 0);
        }
    }

    render_pass.end();
    render_pass.release();

    const command = encoder.finish(null) orelse return;
    encoder.release();

    queue.submit(&.{command});
    command.release();

    _ = surface.present();

    // Reset batch for next frame
    g_rect_count = 0;
}

// ════════════════════════════════════════════════════════════════════════
// Pipeline setup
// ════════════════════════════════════════════════════════════════════════

fn initRectPipeline(device: *wgpu.Device) void {
    // Create shader module
    const shader_desc = wgpu.shaderModuleWGSLDescriptor(.{
        .label = "rect_shader",
        .code = shaders.rect_wgsl,
    });
    const shader_module = device.createShaderModule(&shader_desc) orelse {
        std.debug.print("Failed to create rect shader module\n", .{});
        return;
    };
    defer shader_module.release();

    // Globals uniform buffer (screen_size: vec2f = 8 bytes, pad to 16)
    g_globals_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("globals"),
        .size = 16, // vec2f + padding
        .usage = wgpu.BufferUsages.uniform | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Rect instance buffer
    g_rect_buffer = device.createBuffer(&.{
        .label = wgpu.StringView.fromSlice("rect_instances"),
        .size = MAX_RECTS * @sizeOf(RectInstance),
        .usage = wgpu.BufferUsages.vertex | wgpu.BufferUsages.copy_dst,
        .mapped_at_creation = 0,
    });

    // Bind group layout (group 0: globals uniform)
    const bind_group_layout = device.createBindGroupLayout(&.{
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupLayoutEntry{
            .binding = 0,
            .visibility = wgpu.ShaderStages.vertex | wgpu.ShaderStages.fragment,
            .buffer = .{
                .@"type" = .uniform,
                .has_dynamic_offset = 0,
                .min_binding_size = 8,
            },
        }),
    }) orelse return;
    defer bind_group_layout.release();

    // Bind group
    g_bind_group = device.createBindGroup(&.{
        .layout = bind_group_layout,
        .entry_count = 1,
        .entries = @ptrCast(&wgpu.BindGroupEntry{
            .binding = 0,
            .buffer = g_globals_buffer,
            .offset = 0,
            .size = 8,
        }),
    });

    // Pipeline layout
    const pipeline_layout = device.createPipelineLayout(&.{
        .bind_group_layout_count = 1,
        .bind_group_layouts = @ptrCast(&bind_group_layout),
    }) orelse return;
    defer pipeline_layout.release();

    // Instance vertex attributes (9 locations for 20 floats)
    const instance_attrs = [_]wgpu.VertexAttribute{
        .{ .format = .float32x2, .offset = 0, .shader_location = 0 }, // pos
        .{ .format = .float32x2, .offset = 8, .shader_location = 1 }, // size
        .{ .format = .float32x4, .offset = 16, .shader_location = 2 }, // color
        .{ .format = .float32x4, .offset = 32, .shader_location = 3 }, // border_color
        .{ .format = .float32x4, .offset = 48, .shader_location = 4 }, // radii
        .{ .format = .float32, .offset = 64, .shader_location = 5 }, // border_width
        .{ .format = .float32, .offset = 68, .shader_location = 6 }, // _pad0
        .{ .format = .float32, .offset = 72, .shader_location = 7 }, // _pad1
        .{ .format = .float32, .offset = 76, .shader_location = 8 }, // _pad2
    };

    const instance_buffer_layout = wgpu.VertexBufferLayout{
        .step_mode = .instance,
        .array_stride = @sizeOf(RectInstance),
        .attribute_count = instance_attrs.len,
        .attributes = &instance_attrs,
    };

    // Blend state: premultiplied alpha
    const blend_state = wgpu.BlendState.premultiplied_alpha_blending;

    const color_target = wgpu.ColorTargetState{
        .format = g_format,
        .blend = &blend_state,
        .write_mask = wgpu.ColorWriteMasks.all,
    };

    const fragment_state = wgpu.FragmentState{
        .module = shader_module,
        .entry_point = wgpu.StringView.fromSlice("fs_main"),
        .target_count = 1,
        .targets = @ptrCast(&color_target),
    };

    g_rect_pipeline = device.createRenderPipeline(&.{
        .layout = pipeline_layout,
        .vertex = .{
            .module = shader_module,
            .entry_point = wgpu.StringView.fromSlice("vs_main"),
            .buffer_count = 1,
            .buffers = @ptrCast(&instance_buffer_layout),
        },
        .primitive = .{
            .topology = .triangle_list,
        },
        .multisample = .{},
        .fragment = &fragment_state,
    });

    if (g_rect_pipeline == null) {
        std.debug.print("Failed to create rect render pipeline\n", .{});
    }
}

// ════════════════════════════════════════════════════════════════════════
// Surface / platform helpers
// ════════════════════════════════════════════════════════════════════════

fn configureSurface(width: u32, height: u32) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const adapter = g_adapter orelse return;

    var caps: wgpu.SurfaceCapabilities = undefined;
    _ = surface.getCapabilities(adapter, &caps);
    g_format = if (caps.format_count > 0) caps.formats[0] else .bgra8_unorm;

    const config = wgpu.SurfaceConfiguration{
        .device = device,
        .format = g_format,
        .width = width,
        .height = height,
        .present_mode = .fifo,
        .alpha_mode = .auto,
    };
    surface.configure(&config);
}

fn createSurfaceFromSDL(instance: *wgpu.Instance, wm_info: *const c.SDL_SysWMinfo) ?*wgpu.Surface {
    const subsystem = wm_info.subsystem;

    if (subsystem == c.SDL_SYSWM_X11) {
        const d = wgpu.surfaceDescriptorFromXlibWindow(.{
            .display = @ptrCast(wm_info.info.x11.display),
            .window = @intCast(wm_info.info.x11.window),
        });
        return instance.createSurface(&d);
    }

    if (subsystem == c.SDL_SYSWM_WAYLAND) {
        const d = wgpu.surfaceDescriptorFromWaylandSurface(.{
            .display = @ptrCast(wm_info.info.wl.display),
            .surface = @ptrCast(wm_info.info.wl.surface),
        });
        return instance.createSurface(&d);
    }

    std.debug.print("Unsupported windowing subsystem: {d}\n", .{subsystem});
    return null;
}
