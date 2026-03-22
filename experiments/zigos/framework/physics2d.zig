//! physics2d.zig — 2D physics engine integration (Box2D 2.4.1)
//!
//! Manages a Box2D world and maps physics bodies to layout nodes.
//! Each frame: step the world, then write body positions back to node computed x/y.
//!
//! Architecture:
//!   - Fixed-size body pool (MAX_BODIES), zero allocations
//!   - Bodies are registered with a pointer to their Node
//!   - tick(dt) steps the world and syncs positions to nodes
//!   - Pixel ↔ meter conversion: 1 meter = PIXELS_PER_METER pixels

const std = @import("std");
const layout = @import("layout.zig");
const Node = layout.Node;

// ── Box2D C shim ───────────────────────────────────────────────
const c = @cImport({
    @cInclude("physics_shim.h");
});

// ── Constants ──────────────────────────────────────────────────

/// Pixels per Box2D meter. Box2D works in meters; UI works in pixels.
pub const PIXELS_PER_METER: f32 = 50.0;

pub const MAX_BODIES: usize = 256;

const VELOCITY_ITERATIONS: c_int = 8;
const POSITION_ITERATIONS: c_int = 3;

// ── Body types ─────────────────────────────────────────────────

pub const BodyType = enum(c_int) {
    static_body = 0,
    kinematic = 1,
    dynamic = 2,
};

pub const ColliderShape = enum {
    rectangle,
    circle,
};

// ── Body registration ──────────────────────────────────────────

pub const Body = struct {
    active: bool = false,
    handle: c.PhysBody = null,
    node: ?*Node = null,
    /// Offset from body center to node top-left (half width/height)
    offset_x: f32 = 0,
    offset_y: f32 = 0,
};

// ── State ──────────────────────────────────────────────────────

var world: c.PhysWorld = null;
var bodies: [MAX_BODIES]Body = [_]Body{.{}} ** MAX_BODIES;
var body_count: u32 = 0;
var initialized: bool = false;

// ── Public API ─────────────────────────────────────────────────

/// Create the physics world with gravity in pixels/s^2.
/// Gravity is converted to meters internally.
pub fn init(gravity_x: f32, gravity_y: f32) void {
    if (initialized) deinit();
    world = c.phys_world_create(
        gravity_x / PIXELS_PER_METER,
        gravity_y / PIXELS_PER_METER,
    );
    initialized = true;
    body_count = 0;
    for (&bodies) |*b| b.active = false;
}

pub fn deinit() void {
    if (!initialized) return;
    c.phys_world_destroy(world);
    world = null;
    initialized = false;
    body_count = 0;
    for (&bodies) |*b| b.active = false;
}

/// Create a physics body and link it to a node.
/// x, y are in pixels (converted to meters internally).
/// Returns body index or null if pool is full.
pub fn createBody(
    body_type: BodyType,
    x: f32,
    y: f32,
    angle: f32,
    node: ?*Node,
) ?u32 {
    if (!initialized) return null;

    const idx = allocBody() orelse return null;
    const handle = c.phys_body_create(
        world,
        @intFromEnum(body_type),
        x / PIXELS_PER_METER,
        y / PIXELS_PER_METER,
        angle,
    );

    bodies[idx] = .{
        .active = true,
        .handle = handle,
        .node = node,
    };
    body_count += 1;
    return @intCast(idx);
}

/// Attach a box collider to a body. Dimensions in pixels.
pub fn addBoxCollider(
    body_idx: u32,
    width: f32,
    height: f32,
    density: f32,
    friction: f32,
    restitution: f32,
) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    const b = &bodies[body_idx];
    const half_w = (width / 2.0) / PIXELS_PER_METER;
    const half_h = (height / 2.0) / PIXELS_PER_METER;
    _ = c.phys_collider_box(b.handle, half_w, half_h, density, friction, restitution);
    // Store offset for position sync (body center → node top-left)
    b.offset_x = width / 2.0;
    b.offset_y = height / 2.0;
}

/// Attach a circle collider to a body. Radius in pixels.
pub fn addCircleCollider(
    body_idx: u32,
    radius: f32,
    density: f32,
    friction: f32,
    restitution: f32,
) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    const b = &bodies[body_idx];
    _ = c.phys_collider_circle(b.handle, radius / PIXELS_PER_METER, density, friction, restitution);
    b.offset_x = radius;
    b.offset_y = radius;
}

/// Step the physics world and sync body positions to nodes.
/// dt is in seconds.
pub fn tick(dt: f32) void {
    if (!initialized) return;
    c.phys_world_step(world, dt, VELOCITY_ITERATIONS, POSITION_ITERATIONS);

    // Sync positions: body center (meters) → node top-left (pixels)
    for (&bodies) |*b| {
        if (!b.active or b.node == null) continue;
        const node = b.node.?;
        const bx = c.phys_body_get_x(b.handle) * PIXELS_PER_METER;
        const by = c.phys_body_get_y(b.handle) * PIXELS_PER_METER;
        const angle = c.phys_body_get_angle(b.handle);

        // Write to node's absolute position style (top/left)
        node.style.left = bx - b.offset_x;
        node.style.top = by - b.offset_y;
        node.style.position = .absolute;
        node.style.rotation = angle;
    }
}

/// Apply a force (in pixels/s^2 * mass) to a body.
pub fn applyForce(body_idx: u32, fx: f32, fy: f32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_apply_force(bodies[body_idx].handle, fx / PIXELS_PER_METER, fy / PIXELS_PER_METER);
}

/// Apply an impulse (in pixels/s * mass) to a body.
pub fn applyImpulse(body_idx: u32, ix: f32, iy: f32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_apply_impulse(bodies[body_idx].handle, ix / PIXELS_PER_METER, iy / PIXELS_PER_METER);
}

/// Set linear velocity in pixels/s.
pub fn setVelocity(body_idx: u32, vx: f32, vy: f32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_set_linear_velocity(bodies[body_idx].handle, vx / PIXELS_PER_METER, vy / PIXELS_PER_METER);
}

/// Set body properties.
pub fn setLinearDamping(body_idx: u32, damping: f32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_set_linear_damping(bodies[body_idx].handle, damping);
}

pub fn setAngularDamping(body_idx: u32, damping: f32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_set_angular_damping(bodies[body_idx].handle, damping);
}

pub fn setFixedRotation(body_idx: u32, fixed: bool) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_set_fixed_rotation(bodies[body_idx].handle, if (fixed) 1 else 0);
}

pub fn setBullet(body_idx: u32, bullet: bool) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_set_bullet(bodies[body_idx].handle, if (bullet) 1 else 0);
}

pub fn setGravityScale(body_idx: u32, scale: f32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_set_gravity_scale(bodies[body_idx].handle, scale);
}

/// Destroy a body and free its slot.
pub fn destroyBody(body_idx: u32) void {
    if (body_idx >= MAX_BODIES or !bodies[body_idx].active) return;
    c.phys_body_destroy(world, bodies[body_idx].handle);
    bodies[body_idx].active = false;
    if (body_count > 0) body_count -= 1;
}

/// Clear all bodies and reset the world.
pub fn clear() void {
    deinit();
}

/// Number of active bodies.
pub fn activeCount() u32 {
    return body_count;
}

pub fn isInitialized() bool {
    return initialized;
}

// ── Internal ───────────────────────────────────────────────────

fn allocBody() ?usize {
    for (0..MAX_BODIES) |i| {
        if (!bodies[i].active) return i;
    }
    return null;
}
