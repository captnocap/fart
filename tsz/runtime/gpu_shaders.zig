//! WGSL shader source for the tsz wgpu renderer.
//!
//! SDF-based rounded rectangles with borders, anti-aliasing,
//! gradients, and shadows — all in the fragment shader.

/// Rect pipeline: instanced fullscreen quads with SDF rounded-rect fragment shader.
/// Each instance is one rectangle with position, size, colors, border-radius, border.
pub const rect_wgsl =
    \\// ── Uniforms ───────────────────────────────────────────────────
    \\struct Globals {
    \\    screen_size: vec2f,
    \\};
    \\@group(0) @binding(0) var<uniform> globals: Globals;
    \\
    \\// ── Per-instance data ─────────────────────────────────────────
    \\struct RectInstance {
    \\    @location(0) pos: vec2f,         // top-left in screen pixels
    \\    @location(1) size: vec2f,        // width, height in pixels
    \\    @location(2) color: vec4f,       // background RGBA [0..1]
    \\    @location(3) border_color: vec4f,// border RGBA [0..1]
    \\    @location(4) radii: vec4f,       // border-radius: tl, tr, br, bl
    \\    @location(5) border_width: f32,  // border thickness in pixels
    \\    @location(6) _pad0: f32,
    \\    @location(7) _pad1: f32,
    \\    @location(8) _pad2: f32,
    \\};
    \\
    \\// ── Vertex output ────────────────────────────────────────────
    \\struct VertexOutput {
    \\    @builtin(position) clip_pos: vec4f,
    \\    @location(0) local_pos: vec2f,   // position within rect [0..size]
    \\    @location(1) size: vec2f,
    \\    @location(2) color: vec4f,
    \\    @location(3) border_color: vec4f,
    \\    @location(4) radii: vec4f,
    \\    @location(5) border_width: f32,
    \\};
    \\
    \\// ── Vertex shader ────────────────────────────────────────────
    \\// 6 vertices per instance (2 triangles = 1 quad), no vertex buffer.
    \\@vertex
    \\fn vs_main(
    \\    @builtin(vertex_index) vertex_index: u32,
    \\    inst: RectInstance,
    \\) -> VertexOutput {
    \\    // Two triangles forming a quad:
    \\    // 0:(0,0) 1:(1,0) 2:(0,1) | 3:(0,1) 4:(1,0) 5:(1,1)
    \\    var quad_x = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
    \\    var quad_y = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
    \\    let uv = vec2f(quad_x[vertex_index], quad_y[vertex_index]);
    \\
    \\    let pixel_pos = inst.pos + uv * inst.size;
    \\    let ndc = vec2f(
    \\        pixel_pos.x / globals.screen_size.x * 2.0 - 1.0,
    \\        1.0 - pixel_pos.y / globals.screen_size.y * 2.0,
    \\    );
    \\
    \\    var out: VertexOutput;
    \\    out.clip_pos = vec4f(ndc, 0.0, 1.0);
    \\    out.local_pos = uv * inst.size;
    \\    out.size = inst.size;
    \\    out.color = inst.color;
    \\    out.border_color = inst.border_color;
    \\    out.radii = inst.radii;
    \\    out.border_width = inst.border_width;
    \\    return out;
    \\}
    \\
    \\// ── SDF rounded rectangle ────────────────────────────────────
    \\fn sdf_rounded_rect(p: vec2f, half_size: vec2f, radii: vec4f) -> f32 {
    \\    // radii: tl, tr, br, bl
    \\    // Select corner radius based on quadrant
    \\    let r_top = select(radii.x, radii.y, p.x > 0.0);
    \\    let r_bot = select(radii.w, radii.z, p.x > 0.0);
    \\    let r = select(r_top, r_bot, p.y > 0.0);
    \\    let q = abs(p) - half_size + r;
    \\    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
    \\}
    \\
    \\// ── Fragment shader ───────────────────────────────────────────
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let half_size = in.size * 0.5;
    \\    let p = in.local_pos - half_size; // center-relative coords
    \\
    \\    let dist = sdf_rounded_rect(p, half_size, in.radii);
    \\
    \\    // Anti-aliased edge (1px smooth falloff)
    \\    let aa = 1.0 - smoothstep(-1.0, 0.5, dist);
    \\
    \\    if aa <= 0.0 {
    \\        discard;
    \\    }
    \\
    \\    // Border: if border_width > 0, inner region is fill, outer ring is border
    \\    var final_color: vec4f;
    \\    if in.border_width > 0.0 {
    \\        let inner_dist = sdf_rounded_rect(p, half_size - in.border_width, in.radii);
    \\        let inner_aa = smoothstep(-1.0, 0.5, inner_dist);
    \\        // mix: inner_aa=0 means inside fill, inner_aa=1 means in border zone
    \\        final_color = mix(in.color, in.border_color, inner_aa);
    \\    } else {
    \\        final_color = in.color;
    \\    }
    \\
    \\    // Apply edge anti-aliasing
    \\    final_color.a *= aa;
    \\
    \\    // Premultiply alpha for correct blending
    \\    return vec4f(final_color.rgb * final_color.a, final_color.a);
    \\}
;
