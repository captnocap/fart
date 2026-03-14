# Animation System for tsz

## What Love2D Has

`love2d/lua/animate.lua` (26,691 bytes) — a full animation engine:
- **Transitions:** style property changes interpolated over time (timing or spring)
- **Keyframe animations:** multi-stop animations with iterations, direction, fill mode
- **Spring physics:** Verlet integration with stiffness, damping, mass, rest threshold
- **8 easing functions:** linear, easeIn, easeOut, easeInOut, spring, bounce, elastic, cubic bezier
- **Value interpolation:** numbers, colors (RGBA), percentages, transforms, arrays
- **Transforms:** translateX/Y, rotate, scaleX/Y, originX/Y (visual only, no layout impact)
- **Zero bridge traffic:** Lua ticks autonomously, painter reads interpolated values

Reference files:
- `love2d/lua/animate.lua` — core engine (easing: lines 54-161, spring: lines 468-493, keyframes: lines 532-656)
- `love2d/lua/painter.lua:666-720` — transform application (push/pop matrix, translate, rotate, scale)
- `love2d/packages/core/src/animation.ts` — TS types + helper hooks (useShake, useCountUp, useTypewriter, entranceStyle, pulseStyle)

## tsz Advantage: useEffect IS the Animation Loop

The Lua stack needed a separate animation engine (`animate.lua`) because React's useEffect runs in JS (wrong side of the bridge). tsz's useEffect compiles to frame-loop code — it's already on the right side. So:

```tsx
// Lua needed: style.transition = { opacity: { duration: 300, easing: 'easeOut' } }
// Plus 700 lines of animate.lua to process this

// tsz can do:
useEffect(() => {
  if (opacity < targetOpacity) {
    setOpacity(opacity + dt * speed);
  }
});  // every-frame effect — already working
```

But raw useEffect animations are tedious. We want the SAME developer API that's familiar:
- `style.transition` for property changes
- Spring physics for interactive feel
- Easing functions for polish

The difference: in tsz these compile to Zig code that runs in the loop, not a runtime engine that interprets config.

## Architecture

### Two layers

**Layer 1: Runtime animation module** (`tsz/runtime/animate.zig`)
- Easing functions (pure math, no state)
- Spring solver (Verlet integration, per-slot)
- Lerp helpers (number, color)
- Animation slot registry (like state slots — compile-time allocated)

**Layer 2: Compiler support** (`tsz/compiler/codegen.zig`)
- Detect `useTransition(property, { duration, easing })` calls
- Detect `useSpring(targetValue, { stiffness, damping })` calls
- Emit animation slot creation + per-frame tick code

### Why not just useEffect?

useEffect works for one-off animations. But for transitions (animate when a value changes), you need:
- Previous value tracking
- Interpolation progress tracking
- Easing application
- "Done" detection (snap to target)

That's boilerplate users shouldn't write. The animation module handles it.

## Phase 1: Easing Functions

**File:** `tsz/runtime/animate.zig`

Pure math, zero state. Reference: `love2d/lua/animate.lua:54-161`

```zig
pub fn linear(t: f32) f32 { return t; }
pub fn easeIn(t: f32) f32 { return t * t; }
pub fn easeOut(t: f32) f32 { return t * (2.0 - t); }
pub fn easeInOut(t: f32) f32 {
    if (t < 0.5) return 2.0 * t * t;
    return -1.0 + (4.0 - 2.0 * t) * t;
}
pub fn bounce(t: f32) f32;     // reference: animate.lua:110-123
pub fn elastic(t: f32) f32;    // reference: animate.lua:128-136
pub fn spring(t: f32) f32;     // reference: animate.lua:68-73

pub fn cubicBezier(x1: f32, y1: f32, x2: f32, y2: f32, t: f32) f32;
// Newton-Raphson solver, 8 iterations
// Reference: animate.lua:92-108
```

Also: color lerp for animated backgroundColor, textColor:
```zig
pub fn lerpColor(a: Color, b: Color, t: f32) Color;  // channel-wise
pub fn lerp(a: f32, b: f32, t: f32) f32;              // basic
```

Reference: `love2d/lua/animate.lua:176` (lerp), `love2d/lua/animate.lua:251-261` (color lerp)

## Phase 2: Animation Slots

**File:** `tsz/runtime/animate.zig`

Compile-time allocated slots (same pattern as state slots). Each animation tracks:

```zig
const MAX_ANIM_SLOTS = 64;

pub const AnimSlot = struct {
    from: f32,
    to: f32,
    current: f32,
    progress: f32,         // 0.0 → 1.0
    duration_ms: f32,
    start_tick: u32,       // SDL_GetTicks at start
    easing: EasingFn,
    active: bool,
    done: bool,
};

pub const SpringSlot = struct {
    target: f32,
    current: f32,
    velocity: f32,
    stiffness: f32,        // default: 100
    damping: f32,           // default: 10
    mass: f32,              // default: 1
    rest_threshold: f32,    // default: 0.01
    active: bool,
};
```

Reference: `love2d/lua/animate.lua:342-356` (spring state), `love2d/lua/animate.lua:360-368` (timing state)

### API

```zig
// Timing-based
pub fn createAnim(duration_ms: f32, easing: EasingFn) usize;
pub fn startAnim(id: usize, from: f32, to: f32) void;
pub fn tickAnims(now: u32) void;  // call each frame
pub fn getAnimValue(id: usize) f32;
pub fn isAnimDone(id: usize) bool;

// Spring-based
pub fn createSpring(stiffness: f32, damping: f32) usize;
pub fn setSpringTarget(id: usize, target: f32) void;
pub fn tickSprings(dt: f32) void;  // call each frame
pub fn getSpringValue(id: usize) f32;
pub fn isSpringAtRest(id: usize) bool;
```

### Spring tick (Verlet integration)

Reference: `love2d/lua/animate.lua:468-493`

```zig
pub fn tickSprings(dt: f32) void {
    for (springs) |*s| {
        if (!s.active) continue;
        const displacement = s.current - s.target;
        const spring_force = -s.stiffness * displacement;
        const damping_force = -s.damping * s.velocity;
        const acceleration = (spring_force + damping_force) / s.mass;
        s.velocity += acceleration * dt;
        s.current += s.velocity * dt;
        // Rest detection
        if (@abs(s.velocity) < s.rest_threshold and @abs(s.current - s.target) < s.rest_threshold) {
            s.current = s.target;
            s.velocity = 0;
            s.active = false;
        }
    }
}
```

## Phase 3: Compiler Support

### `useTransition` hook

```tsx
const opacity = useTransition(isVisible ? 1.0 : 0.0, { duration: 300, easing: 'easeOut' });
```

Compiler detects `useTransition(targetExpr, config)` and emits:
1. Animation slot creation at init
2. Target update check each frame (if target changed, restart animation)
3. Tick call in loop
4. `opacity` resolves to `animate.getAnimValue(slotId)`

Generated Zig:
```zig
// Init:
const _anim_0 = animate.createAnim(300, animate.easeOut);

// In loop, before layout:
{
    const target: f32 = if (state.getSlotBool(0)) 1.0 else 0.0;
    if (target != animate.getAnimTarget(_anim_0)) {
        animate.startAnim(_anim_0, animate.getAnimValue(_anim_0), target);
    }
}
animate.tickAnims(c.SDL_GetTicks());

// Where opacity is used in style:
.style = .{ .opacity = animate.getAnimValue(_anim_0) }
```

### `useSpring` hook

```tsx
const scale = useSpring(isPressed ? 0.95 : 1.0, { stiffness: 300, damping: 20 });
```

Same pattern but with spring slot:
```zig
const _spring_0 = animate.createSpring(300, 20);

// In loop:
animate.setSpringTarget(_spring_0, if (state.getSlotBool(1)) 0.95 else 1.0);
animate.tickSprings(0.016); // dt from frame timing
```

## Phase 4: Style Properties That Can Animate

Start with what the layout engine supports:

| Property | Animatable? | Notes |
|----------|------------|-------|
| width, height | Yes | Triggers relayout |
| padding (all) | Yes | Triggers relayout |
| margin (all) | Yes | Triggers relayout |
| gap | Yes | Triggers relayout |
| flexGrow | Yes | Triggers relayout |
| borderRadius | Yes | Paint only |
| backgroundColor | Yes (color lerp) | Paint only |
| textColor | Yes (color lerp) | Paint only |

### Not yet (needs runtime support):
| Property | What's needed |
|----------|--------------|
| opacity | Add `opacity: f32` to Style struct + painter alpha blending |
| transform | Add transform matrix to Node + painter push/pop (reference: `love2d/lua/painter.lua:666-720`) |

Opacity and transform are the highest-impact missing style properties for animation. They should be added to `layout.zig` and the painter as part of this plan.

### Adding opacity

```zig
// In layout.zig Style struct:
opacity: f32 = 1.0,

// In painter (generated_app.zig):
// Before painting a node, set alpha: SDL_SetRenderDrawBlendMode + modulate color.a
const alpha: u8 = @intFromFloat(node.style.opacity * 255.0);
```

### Adding transform (Phase 4b — optional, can defer)

Reference: `love2d/lua/painter.lua:666-720`

Transforms are visual only — no layout impact (matches CSS behavior). Implemented via OpenGL matrix push/pop in the painter.

This is a larger change and can be a separate task. Animation of existing numeric properties works without transforms.

## Phase 5: Helper Hooks

Compile-time helpers that emit common animation patterns:

```tsx
// Entrance fade-in
const opacity = useTransition(1.0, { duration: 500, easing: 'easeOut' });
// Starts at 0, animates to 1 on mount

// Pulse
useEffect(() => {
  if (animate.isAnimDone(pulseSlot)) {
    animate.startAnim(pulseSlot, 0.8, 1.0);
  }
}, []);  // infinite pulse via effect + done check
```

Reference: `love2d/packages/core/src/animation.ts:255-331` (entranceStyle, pulseStyle, repeatStyle)

These are syntactic sugar — the compiler emits the same animation slot code, just with preset configurations.

## Files

| File | Change |
|------|--------|
| `tsz/runtime/animate.zig` | **New** — easing functions, animation/spring slots, tick functions, color lerp |
| `tsz/runtime/layout.zig` | Add `opacity` field to Style struct |
| `tsz/compiler/codegen.zig` | Detect `useTransition`/`useSpring`, emit anim slot creation + tick calls |
| `tsz/compiler/codegen.zig` | Emit `animate.tickAnims()`/`tickSprings()` in main loop |

## Implementation Order

1. **Easing functions** — pure math, immediately testable
2. **Animation slots + tick** — timing-based interpolation
3. **Spring slots + tick** — physics-based interpolation
4. **Compiler: useTransition** — detect and emit timing animation code
5. **Compiler: useSpring** — detect and emit spring animation code
6. **Opacity in Style** — enable the most common animation target
7. **Transform** (optional) — translateX/Y, rotate, scale via OpenGL matrix

## Agent Split

| Agent | Phases | Scope |
|-------|--------|-------|
| A | 1-3 | `animate.zig` — all runtime code (easing, slots, springs, tick) |
| B | 4-6 | `codegen.zig` — compiler support for useTransition/useSpring + opacity in layout.zig |

A runs first (runtime must exist before compiler emits calls to it). B follows.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/animation-test.tsz
```

Example .tsz:
```tsx
function App() {
  const [show, setShow] = useState(1);
  const opacity = useTransition(show ? 1.0 : 0.0, { duration: 500, easing: 'easeOut' });

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Pressable onPress={() => setShow(show == 1 ? 0 : 1)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">Toggle</Text>
      </Pressable>
      <Box style={{ padding: 32, backgroundColor: '#569cd6', opacity: opacity, marginTop: 16 }}>
        <Text fontSize={24} color="#ffffff">I fade in and out</Text>
      </Box>
    </Box>
  );
}
```

Click Toggle → box fades out over 500ms with easeOut curve, click again → fades back in.
