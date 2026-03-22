# Animations & Transitions

CSS-style transitions that animate style property changes smoothly — fade, slide, scale, color, spring physics.

## .tsz API

### Timing-based transitions
```tsx
<Box style={{
  width: expanded ? 400 : 100,
  opacity: visible ? 1.0 : 0.3,
  borderRadius: active ? 40 : 4,
  transition: {
    width: { duration: 500, easing: "easeInOut" },
    opacity: { duration: 300, easing: "easeOut" },
    borderRadius: { duration: 600, easing: "bounce" },
  }
}} />
```

### Spring physics
```tsx
<Box style={{
  width: pressed ? 240 : 120,
  transition: {
    width: { type: "spring", stiffness: 180, damping: 12 }
  }
}} />
```

### Transition config options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| duration | number | 300 | Duration in milliseconds |
| delay | number | 0 | Delay before start in milliseconds |
| easing | string | "easeInOut" | Easing function name |
| type | string | "timing" | "timing" or "spring" |
| stiffness | number | 100 | Spring stiffness (spring only) |
| damping | number | 10 | Spring damping (spring only) |
| mass | number | 1 | Spring mass (spring only) |

### Easing functions

linear, easeIn, easeOut, easeInOut, spring, bounce, elastic

Also accepts CSS names: ease-in, ease-out, ease-in-out

### `all` shorthand
```tsx
transition: { all: { duration: 300, easing: "easeInOut" } }
```

### Animatable properties

**Visual-only (no relayout):** opacity, backgroundColor, borderColor, shadowColor, borderRadius, borderWidth, rotation, scaleX, scaleY, shadowOffsetX/Y, shadowBlur

**Layout-affecting (triggers relayout):** width, height, minWidth, maxWidth, minHeight, maxHeight, padding/Left/Right/Top/Bottom, margin/Left/Right/Top/Bottom, gap, flexGrow

## Framework files

| File | Role |
|------|------|
| `framework/easing.zig` | 8 easing functions + CSS cubic-bezier with Newton-Raphson |
| `framework/transition.zig` | 256-slot transition engine, timing + spring, color RGBA lerp |
| `framework/engine.zig` | `transition.tick(dt)` wired between app tick and layout |
| `framework/math.zig` | lerp, clamp (used by easing + transition, not duplicated) |

## Compiler files

| File | Role |
|------|------|
| `compiler/attrs.zig` | Parses `transition` key, builds TransitionConfig/SpringConfig literals, tags DynStyles. Also converts JS ternary `?:` to Zig `if/else`. |
| `compiler/codegen.zig` | DynStyle struct has `transition_config`, `transition_is_spring`, `is_color` fields |
| `compiler/emit.zig` | Emits `transition.set()`/`setSpring()` for tagged DynStyles, conditionally imports transition.zig |
| `compiler/lint.zig` | Skips `transition: { ... }` block during style property validation |

## Known limitations

- **Color ternaries from hex strings** not yet supported. `backgroundColor: mode ? "#f00" : "#00f"` requires the compiler to pre-resolve hex strings to Color.rgb() at compile time. Works with packed-int colors from state slots.
- **String shorthand** `transition: "opacity 300ms easeInOut"` not implemented — use object form.
- **Nested ternaries** in style values not tested.
- **Transition on unmount** (exit animations) not supported — nodes disappear immediately.
- **Keyframe animations** (multi-step sequences) not yet implemented — the Lua reference has them.

## Demo

```
cd tsz
./zig-out/bin/zigos-compiler build carts/animations/animation_demo.tsz
./zig-out/bin/animation_demo
```

## Tests

```
cd tsz
zig test framework/easing.zig                                    # 10 easing tests
zig test framework/transition.zig                                # 8 transition tests
zig test transition_test_gen.zig                                 # 2 integration tests
```
