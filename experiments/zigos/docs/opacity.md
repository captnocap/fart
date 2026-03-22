# Opacity

Node opacity cascades through the paint tree, affecting the node and all its children.

## .tsz API

```tsx
// Direct opacity
<Box style={{ opacity: 0.5, backgroundColor: '#4CAF50' }}>
  <Text>This text is also 50% transparent</Text>
</Box>

// Nested opacity multiplies
<Box style={{ opacity: 0.5 }}>
  <Box style={{ opacity: 0.5 }}>
    <!-- This is 25% opaque (0.5 * 0.5) -->
  </Box>
</Box>

// Zero opacity = invisible (skips painting entirely)
<Box style={{ opacity: 0, backgroundColor: '#F00' }} />
```

## Framework files

- `framework/engine.zig` — `paintNode` saves/restores `g_paint_opacity`, multiplies by `node.style.opacity`; all `drawRect` and `drawTextWrapped` calls use `g_paint_opacity` for alpha
- `framework/layout.zig` — `Style.opacity: f32 = 1.0` field

## Compiler files

- `compiler/attrs.zig` — `opacity` mapped in `mapStyleKey` as a numeric style property

## Known limitations

- Opacity affects color alpha, not a true compositing opacity (no offscreen buffer). This means overlapping semi-transparent siblings may show visual artifacts
- The `windows.zig` multi-window paint path has its own opacity cascading via `effective_opacity` which works correctly
