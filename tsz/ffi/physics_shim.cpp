// physics_shim.cpp — Box2D 2.4.1 C wrapper
//
// Compile: g++ -c -O2 physics_shim.cpp -o physics_shim.o
// Or via Zig build system as a C++ source file.

#include "physics_shim.h"
#include <box2d/b2_world.h>
#include <box2d/b2_body.h>
#include <box2d/b2_fixture.h>
#include <box2d/b2_polygon_shape.h>
#include <box2d/b2_circle_shape.h>
#include <box2d/b2_math.h>

// ── World ──────────────────────────────────────────────────────

extern "C" PhysWorld phys_world_create(float gravity_x, float gravity_y) {
    b2Vec2 gravity(gravity_x, gravity_y);
    b2World* world = new b2World(gravity);
    return static_cast<void*>(world);
}

extern "C" void phys_world_destroy(PhysWorld world) {
    delete static_cast<b2World*>(world);
}

extern "C" void phys_world_step(PhysWorld world, float dt, int velocity_iters, int position_iters) {
    static_cast<b2World*>(world)->Step(dt, velocity_iters, position_iters);
}

// ── Body ───────────────────────────────────────────────────────

extern "C" PhysBody phys_body_create(PhysWorld world, int body_type, float x, float y, float angle) {
    b2BodyDef def;
    switch (body_type) {
        case 0: def.type = b2_staticBody; break;
        case 1: def.type = b2_kinematicBody; break;
        case 2: def.type = b2_dynamicBody; break;
        default: def.type = b2_staticBody; break;
    }
    def.position.Set(x, y);
    def.angle = angle;
    b2Body* body = static_cast<b2World*>(world)->CreateBody(&def);
    return static_cast<void*>(body);
}

extern "C" void phys_body_destroy(PhysWorld world, PhysBody body) {
    static_cast<b2World*>(world)->DestroyBody(static_cast<b2Body*>(body));
}

extern "C" float phys_body_get_x(PhysBody body) {
    return static_cast<b2Body*>(body)->GetPosition().x;
}

extern "C" float phys_body_get_y(PhysBody body) {
    return static_cast<b2Body*>(body)->GetPosition().y;
}

extern "C" float phys_body_get_angle(PhysBody body) {
    return static_cast<b2Body*>(body)->GetAngle();
}

extern "C" void phys_body_set_position(PhysBody body, float x, float y) {
    b2Body* b = static_cast<b2Body*>(body);
    b->SetTransform(b2Vec2(x, y), b->GetAngle());
}

extern "C" void phys_body_set_angle(PhysBody body, float angle) {
    b2Body* b = static_cast<b2Body*>(body);
    b->SetTransform(b->GetPosition(), angle);
}

extern "C" void phys_body_set_linear_damping(PhysBody body, float damping) {
    static_cast<b2Body*>(body)->SetLinearDamping(damping);
}

extern "C" void phys_body_set_angular_damping(PhysBody body, float damping) {
    static_cast<b2Body*>(body)->SetAngularDamping(damping);
}

extern "C" void phys_body_set_fixed_rotation(PhysBody body, int fixed) {
    static_cast<b2Body*>(body)->SetFixedRotation(fixed != 0);
}

extern "C" void phys_body_set_bullet(PhysBody body, int bullet) {
    static_cast<b2Body*>(body)->SetBullet(bullet != 0);
}

extern "C" void phys_body_set_gravity_scale(PhysBody body, float scale) {
    static_cast<b2Body*>(body)->SetGravityScale(scale);
}

extern "C" void phys_body_apply_force(PhysBody body, float fx, float fy) {
    static_cast<b2Body*>(body)->ApplyForceToCenter(b2Vec2(fx, fy), true);
}

extern "C" void phys_body_apply_impulse(PhysBody body, float ix, float iy) {
    b2Body* b = static_cast<b2Body*>(body);
    b->ApplyLinearImpulse(b2Vec2(ix, iy), b->GetWorldCenter(), true);
}

extern "C" void phys_body_apply_torque(PhysBody body, float torque) {
    static_cast<b2Body*>(body)->ApplyTorque(torque, true);
}

extern "C" void phys_body_set_linear_velocity(PhysBody body, float vx, float vy) {
    static_cast<b2Body*>(body)->SetLinearVelocity(b2Vec2(vx, vy));
}

extern "C" float phys_body_get_linear_velocity_x(PhysBody body) {
    return static_cast<b2Body*>(body)->GetLinearVelocity().x;
}

extern "C" float phys_body_get_linear_velocity_y(PhysBody body) {
    return static_cast<b2Body*>(body)->GetLinearVelocity().y;
}

// ── Collider (Fixture) ─────────────────────────────────────────

extern "C" PhysFixture phys_collider_box(PhysBody body, float half_w, float half_h,
                                          float density, float friction, float restitution) {
    b2PolygonShape shape;
    shape.SetAsBox(half_w, half_h);
    b2FixtureDef def;
    def.shape = &shape;
    def.density = density;
    def.friction = friction;
    def.restitution = restitution;
    return static_cast<void*>(static_cast<b2Body*>(body)->CreateFixture(&def));
}

extern "C" PhysFixture phys_collider_circle(PhysBody body, float radius,
                                             float density, float friction, float restitution) {
    b2CircleShape shape;
    shape.m_radius = radius;
    b2FixtureDef def;
    def.shape = &shape;
    def.density = density;
    def.friction = friction;
    def.restitution = restitution;
    return static_cast<void*>(static_cast<b2Body*>(body)->CreateFixture(&def));
}

extern "C" void phys_collider_set_sensor(PhysFixture fixture, int is_sensor) {
    static_cast<b2Fixture*>(fixture)->SetSensor(is_sensor != 0);
}

// ── Mouse Joint (drag interaction) ─────────────────────────────

#include <box2d/b2_mouse_joint.h>

extern "C" PhysJoint phys_mouse_joint_create(PhysWorld world, PhysBody body,
                                              float target_x, float target_y, float max_force) {
    b2World* w = static_cast<b2World*>(world);
    b2Body* b = static_cast<b2Body*>(body);
    // MouseJoint needs a ground body as bodyA — use the world's first static body or create one
    b2Body* ground = nullptr;
    for (b2Body* bb = w->GetBodyList(); bb; bb = bb->GetNext()) {
        if (bb->GetType() == b2_staticBody) { ground = bb; break; }
    }
    if (!ground) {
        b2BodyDef gd;
        gd.type = b2_staticBody;
        ground = w->CreateBody(&gd);
    }
    b2MouseJointDef jd;
    jd.bodyA = ground;
    jd.bodyB = b;
    jd.target.Set(target_x, target_y);
    jd.maxForce = max_force;
    jd.stiffness = 5.0f;
    jd.damping = 0.7f;
    return static_cast<void*>(w->CreateJoint(&jd));
}

extern "C" void phys_mouse_joint_set_target(PhysJoint joint, float x, float y) {
    static_cast<b2MouseJoint*>(joint)->SetTarget(b2Vec2(x, y));
}

extern "C" void phys_mouse_joint_destroy(PhysJoint joint) {
    b2Joint* j = static_cast<b2Joint*>(joint);
    j->GetBodyA()->GetWorld()->DestroyJoint(j);
}

// ── Point Query ────────────────────────────────────────────────

#include <box2d/b2_world_callbacks.h>

class PointQueryCallback : public b2QueryCallback {
public:
    b2Vec2 point;
    b2Body* found = nullptr;

    bool ReportFixture(b2Fixture* fixture) override {
        if (fixture->GetBody()->GetType() != b2_dynamicBody) return true; // skip non-dynamic
        if (fixture->TestPoint(point)) {
            found = fixture->GetBody();
            return false; // stop query
        }
        return true; // continue
    }
};

extern "C" PhysBody phys_query_point(PhysWorld world, float x, float y) {
    b2World* w = static_cast<b2World*>(world);
    b2AABB aabb;
    float d = 0.1f; // small query box around point
    aabb.lowerBound.Set(x - d, y - d);
    aabb.upperBound.Set(x + d, y + d);
    PointQueryCallback cb;
    cb.point.Set(x, y);
    w->QueryAABB(&cb, aabb);
    return static_cast<void*>(cb.found);
}
