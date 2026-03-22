# 2D Physics (Box2D)

Box2D 2.4.1 integration for 2D rigid body physics — gravity, collisions, bouncing, forces.

## .tsz API (planned)

```tsx
<Physics.World gravity={[0, 980]}>
  <Physics.Body type="static" x={400} y={580}>
    <Physics.Collider shape="rectangle" width={800} height={40} />
    <Box style={{ width: 800, height: 40, backgroundColor: "#333" }} />
  </Physics.Body>

  <Physics.Body type="dynamic" x={400} y={100} restitution={0.6}>
    <Physics.Collider shape="circle" radius={20} />
    <Box style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#f00" }} />
  </Physics.Body>
</Physics.World>
```

### Physics.World props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| gravity | [number, number] | [0, 980] | Gravity in pixels/s^2 |

### Physics.Body props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| type | string | "dynamic" | "static", "kinematic", or "dynamic" |
| x | number | 0 | Initial X position (pixels, body center) |
| y | number | 0 | Initial Y position (pixels, body center) |
| angle | number | 0 | Initial rotation (radians) |
| fixedRotation | boolean | false | Prevent rotation |
| bullet | boolean | false | CCD for fast-moving objects |
| gravityScale | number | 1.0 | Per-body gravity multiplier |

### Physics.Collider props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| shape | string | "rectangle" | "rectangle" or "circle" |
| width | number | - | Rectangle width (pixels) |
| height | number | - | Rectangle height (pixels) |
| radius | number | - | Circle radius (pixels) |
| density | number | 1.0 | Mass density |
| friction | number | 0.3 | Surface friction |
| restitution | number | 0.1 | Bounciness (0=no bounce, 1=perfect) |

## How it works

1. Engine walks the node tree on first frame, finds Physics.World/Body/Collider nodes
2. Creates Box2D world with specified gravity
3. Creates bodies and attaches colliders
4. Each frame: `physics2d.tick(dt)` steps Box2D, reads body positions, writes them to the wrapped visual node's `style.left`/`style.top`/`style.rotation` (absolute positioning)
5. Layout engine positions the visual nodes where physics says they should be

Coordinate system: Box2D works in meters internally; the module converts at 50 pixels/meter. All API values are in pixels.

## Framework files

| File | Role |
|------|------|
| `framework/physics2d.zig` | Zig physics module: 256-body pool, world/body/collider management, position sync |
| `framework/engine.zig` | `initPhysicsFromTree()` + `physics2d.tick(dt)` in frame loop |
| `framework/layout.zig` | Node fields: `physics_world`, `physics_body`, `physics_collider`, params |
| `ffi/physics_shim.h` | C header for Box2D wrapper |
| `ffi/physics_shim.cpp` | C++ implementation wrapping Box2D 2.4.1 classes |
| `build.zig` | Links `physics_shim.cpp` + `-lbox2d` |

## Compiler files

Compiler support for `Physics.*` elements is not yet implemented (jsx.zig is at the 1600-line limit and needs splitting). Currently, physics demos use hand-authored Zig that matches what the compiler would generate.

## Known limitations

- **No compiler support** — `<Physics.World>`, `<Physics.Body>`, `<Physics.Collider>` elements not yet parsed by the .tsz compiler. Requires jsx.zig split.
- **No joints** — RevoluteJoint, DistanceJoint, etc. from the love2d API not yet ported.
- **No collision callbacks** — onCollide/onCollideEnd events not wired.
- **No sensors** — Trigger volumes not yet supported.
- **Fixed body pool** — MAX_BODIES = 256. No runtime expansion.
- **No hot reload** — Physics world is initialized once on first frame. Changing body positions requires restart.
- **Box2D 2.4.1** — Using the older C++ version via shim, not Box2D 3.0 with native C API.

## Demo

```
cd experiments/zigos
cp carts/animations/bouncing_balls_gen.zig generated_app.zig
zig build app
./zig-out/bin/app  # or: zig-out/bin/Bouncing\ Balls
```

## Tests

```
cd experiments/zigos
zig test framework/physics2d.zig -I ffi -lbox2d -lc++ -lc -cflags -O2 -- ffi/physics_shim.cpp
```

5 tests: world create/destroy, body create, collider attach, gravity simulation, body destroy.
