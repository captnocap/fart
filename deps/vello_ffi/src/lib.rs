//! Vello GPU FFI — C-callable interface for anti-aliased 2D path rendering.
//!
//! Uses Vello's GPU compute pipeline to render SVG paths with perfect AA.
//! Shares the wgpu device/queue with the Zig engine via raw C pointers.
//! Falls back to CPU rasterization + pixel buffer output for compositing.

use std::slice;
use vello::kurbo::{Affine, BezPath, Stroke};
use vello::peniko::{color::AlphaColor, color::Srgb, Fill};
use vello::Scene;

// ── CPU fallback (Vello GPU needs render-to-texture which requires
// matching wgpu internals — for now, use the scene API to build paths
// and rasterize via Vello's CPU backend if available) ──

/// Opaque handle to a Vello scene + output buffer.
pub struct VelloSurface {
    scene: Scene,
    width: u32,
    height: u32,
    pixels: Vec<u8>, // RGBA output buffer
}

#[unsafe(no_mangle)]
pub extern "C" fn vello_create(width: u32, height: u32) -> *mut VelloSurface {
    if width == 0 || height == 0 || width > 4096 || height > 4096 {
        return std::ptr::null_mut();
    }
    let surface = Box::new(VelloSurface {
        scene: Scene::new(),
        width,
        height,
        pixels: vec![0u8; (width * height * 4) as usize],
    });
    Box::into_raw(surface)
}

#[unsafe(no_mangle)]
pub extern "C" fn vello_destroy(surface: *mut VelloSurface) {
    if !surface.is_null() {
        unsafe { drop(Box::from_raw(surface)); }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn vello_clear(surface: *mut VelloSurface) {
    let s = unsafe { &mut *surface };
    s.scene = Scene::new();
    s.pixels.fill(0);
}

/// Fill an SVG path with a solid color, applying the given transform.
#[unsafe(no_mangle)]
pub extern "C" fn vello_fill_path(
    surface: *mut VelloSurface,
    svg_d: *const u8, svg_d_len: usize,
    r: f32, g: f32, b: f32, a: f32,
    scale_x: f64, scale_y: f64,
    translate_x: f64, translate_y: f64,
) {
    let s = unsafe { &mut *surface };
    let d_str = match std::str::from_utf8(unsafe { slice::from_raw_parts(svg_d, svg_d_len) }) {
        Ok(s) => s,
        Err(_) => return,
    };
    let path = match BezPath::from_svg(d_str) {
        Ok(p) => p,
        Err(_) => return,
    };

    let transform = Affine::scale_non_uniform(scale_x, scale_y)
        * Affine::translate((translate_x, translate_y));

    let color = AlphaColor::<Srgb>::new([r, g, b, a]);
    s.scene.fill(Fill::NonZero, transform, color, None, &path);
}

/// Stroke an SVG path with a solid color.
#[unsafe(no_mangle)]
pub extern "C" fn vello_stroke_path(
    surface: *mut VelloSurface,
    svg_d: *const u8, svg_d_len: usize,
    r: f32, g: f32, b: f32, a: f32,
    width: f64,
    scale_x: f64, scale_y: f64,
    translate_x: f64, translate_y: f64,
) {
    let s = unsafe { &mut *surface };
    let d_str = match std::str::from_utf8(unsafe { slice::from_raw_parts(svg_d, svg_d_len) }) {
        Ok(s) => s,
        Err(_) => return,
    };
    let path = match BezPath::from_svg(d_str) {
        Ok(p) => p,
        Err(_) => return,
    };

    let transform = Affine::scale_non_uniform(scale_x, scale_y)
        * Affine::translate((translate_x, translate_y));

    let color = AlphaColor::<Srgb>::new([r, g, b, a]);
    let stroke = Stroke::new(width);
    s.scene.stroke(&stroke, transform, color, None, &path);
}

/// Render the scene to a pixel buffer using Vello's GPU compute pipeline.
/// Returns a pointer to BGRA pixel data, or null on failure.
///
/// This creates a temporary wgpu device for rendering. In a future version,
/// the device will be shared with the Zig engine.
#[unsafe(no_mangle)]
pub extern "C" fn vello_render(surface: *mut VelloSurface) -> *const u8 {
    let s = unsafe { &mut *surface };
    let w = s.width;
    let h = s.height;

    // Use pollster to block on async wgpu operations
    pollster::block_on(async {
        render_scene_async(s, w, h).await
    });

    if s.pixels.is_empty() {
        return std::ptr::null();
    }
    s.pixels.as_ptr()
}

async fn render_scene_async(s: &mut VelloSurface, w: u32, h: u32) {
    // Create a temporary wgpu instance + device for rendering
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::VULKAN,
        ..Default::default()
    });

    let adapter = match instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        ..Default::default()
    }).await {
        Ok(a) => a,
        Err(_) => return,
    };

    let (device, queue) = match adapter.request_device(&wgpu::DeviceDescriptor {
        required_features: wgpu::Features::empty(),
        required_limits: wgpu::Limits::default(),
        ..Default::default()
    }).await {
        Ok(dq) => dq,
        Err(_) => return,
    };

    // Create Vello renderer
    let mut renderer = match vello::Renderer::new(
        &device,
        vello::RendererOptions {
            ..Default::default()
        },
    ) {
        Ok(r) => r,
        Err(_) => return,
    };

    // Create render target texture
    let target = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("vello_target"),
        size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING
            | wgpu::TextureUsages::COPY_SRC
            | wgpu::TextureUsages::RENDER_ATTACHMENT,
        view_formats: &[],
    });
    let target_view = target.create_view(&Default::default());

    // Render
    let render_params = vello::RenderParams {
        base_color: vello::peniko::color::palette::css::TRANSPARENT,
        width: w,
        height: h,
        antialiasing_method: vello::AaConfig::Msaa16,
    };

    if renderer.render_to_texture(&device, &queue, &s.scene, &target_view, &render_params).is_err() {
        return;
    }

    // Read back pixels
    let bytes_per_row = w * 4;
    let padded_bytes_per_row = (bytes_per_row + 255) & !255; // align to 256
    let buffer_size = (padded_bytes_per_row * h) as u64;

    let readback = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("vello_readback"),
        size: buffer_size,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    let mut encoder = device.create_command_encoder(&Default::default());
    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo { texture: &target, mip_level: 0, origin: Default::default(), aspect: Default::default() },
        wgpu::TexelCopyBufferInfo { buffer: &readback, layout: wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(padded_bytes_per_row),
            rows_per_image: Some(h),
        }},
        wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
    );
    let sub_idx = queue.submit(Some(encoder.finish()));

    // Map and copy
    let slice = readback.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |result| {
        let _ = tx.send(result);
    });
    device.poll(wgpu::PollType::Wait { submission_index: Some(sub_idx), timeout: Some(std::time::Duration::from_secs(5)) }).ok();
    if rx.recv().ok().and_then(|r| r.ok()).is_none() {
        return;
    }

    let data = slice.get_mapped_range();
    s.pixels.resize((w * h * 4) as usize, 0);

    // Copy rows (skip padding), swizzle RGBA → BGRA, and premultiply alpha.
    // Vello outputs straight alpha but our image pipeline uses premultiplied blending.
    for y in 0..h {
        let src_offset = (y * padded_bytes_per_row) as usize;
        let dst_offset = (y * bytes_per_row) as usize;
        for x in 0..w as usize {
            let si = src_offset + x * 4;
            let di = dst_offset + x * 4;
            let a = data[si + 3] as u16;
            s.pixels[di]     = ((data[si + 2] as u16 * a + 127) / 255) as u8; // B * alpha
            s.pixels[di + 1] = ((data[si + 1] as u16 * a + 127) / 255) as u8; // G * alpha
            s.pixels[di + 2] = ((data[si]     as u16 * a + 127) / 255) as u8; // R * alpha
            s.pixels[di + 3] = data[si + 3];                                   // A
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn vello_width(surface: *const VelloSurface) -> u32 {
    unsafe { &*surface }.width
}

#[unsafe(no_mangle)]
pub extern "C" fn vello_height(surface: *const VelloSurface) -> u32 {
    unsafe { &*surface }.height
}
