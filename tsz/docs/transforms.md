# Transforms (rotation + scale)

Per-node visual transforms applied in the GPU vertex shader. Does not affect layout or hit testing.

## .tsz API

```tsx
// Rotation in degrees
<Box style={{ width: 50, height: 50, backgroundColor: '#4CAF50', rotation: 45 }} />

// Scale X/Y independently
<Box style={{ width: 40, height: 40, backgroundColor: '#2196F3', scaleX: 1.5, scaleY: 0.8 }} />

// Combined rotation + scale
<Box style={{ width: 50, height: 50, rotation: 30, scaleX: 1.2, scaleY: 1.2 }} />
```

## Framework files

- `framework/gpu/rects.zig` — `RectInstance` struct has `rotation`, `scale_x`, `scale_y` fields; `drawRectTransformed()` function
- `framework/gpu/shaders.zig` — WGSL vertex shader computes center, applies scale then rotation around center
- `framework/gpu/gpu.zig` — re-exports `drawRectTransformed`
- `framework/engine.zig` — `paintNodeVisuals` checks `has_transform` and calls `drawRectTransformed` when rotation/scale differ from identity

## Compiler files

- `compiler/attrs.zig` — `rotation`, `scaleX`, `scaleY` mapped in `mapStyleKey`

## Known limitations

- Visual only — layout and hit testing use the untransformed bounds
- No `translateX` / `translateY` — use `position: 'absolute'` with `left`/`top` instead
- No `skewX` / `skewY`
- Transform origin is always the center of the node (no `transformOrigin` property)
- Only affects rect backgrounds — text within a transformed node is NOT transformed (text uses a separate GPU pipeline)
