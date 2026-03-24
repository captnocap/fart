# Canvas System

`Canvas` is not just a primitive tag. It is a small graph/viewport API system with sub-surfaces.

Document it as a system, not as “Box with a couple extra props”.

## Surfaces

- `Canvas`
- `Canvas.Node`
- `Canvas.Path`
- `Canvas.Clamp`

Closely related:

- `Graph`
- `Graph.Node`
- `Graph.Path`

## Why this is a system

The API is not just styling a leaf node. It gives users a graph-space surface with:

- viewport positioning
- graph-space child placement
- path drawing
- clamp overlays

That is a larger composition model than the core UI primitives.

## Canvas

Container-level attrs parsed in `tsz/compiler/jsx.zig`:

- `type`
- `viewX`
- `viewY`
- `viewZoom`
- `driftX`
- `driftY`
- `style`

Compiler lowering emits fields like:

- `canvas_type`
- `canvas_view_set`
- `canvas_view_x`
- `canvas_view_y`
- `canvas_view_zoom`
- `canvas_drift_active`
- `canvas_drift_x`
- `canvas_drift_y`

## Canvas.Node

Graph-space node placement surface.

Parsed attrs:

- `gx`
- `gy`
- `gw`
- `gh`

These are lowered into graph-space fields on the node.

Use it when a child should live at a graph-space position with a graph-space size.

## Canvas.Path

Path drawing surface.

Parsed attrs:

- `d`
- `stroke`
- `strokeWidth`
- `flowSpeed`

Notes:

- `stroke` is lowered through color parsing.
- `strokeWidth` becomes `canvas_stroke_width`.
- `flowSpeed` is a dedicated canvas path field.

## Canvas.Clamp

Clamp is a marker surface used as part of the canvas system. It is declared and lowered, but it is intentionally thin:

- no dedicated prop table beyond normal node structure
- acts as a system marker rather than a rich standalone component

This is exactly the kind of surface that should be documented as “real, but narrow” rather than padded out into a fake larger API.

## Example shape

```tsx
<Canvas style={{ flexGrow: 1 }} viewX={0} viewY={100} viewZoom={1}>
  <Canvas.Path d="M 0,25 L 0,75" stroke="#14b8a6" strokeWidth={3} flowSpeed={1} />
  <Canvas.Node gx={0} gy={0} gw={120} gh={50}>
    <Box style={{ width: "100%", height: "100%" }} />
  </Canvas.Node>
  <Canvas.Clamp>
    <Box style={{ width: "100%", height: "100%" }} />
  </Canvas.Clamp>
</Canvas>
```

## Documentation boundary

When documenting `Canvas`, keep these categories separate:

- viewport/container API
- graph node placement API
- path drawing API
- clamp marker API

Do not describe the whole system as if all sub-surfaces expose the same depth of API.

## Source files

- `tsz/compiler/jsx.zig`
- `tsz/framework/layout.zig`
- `tsz/carts/inspector/`
- `tsz/carts/storybook/tiles/CanvasTile_c.tsz`
