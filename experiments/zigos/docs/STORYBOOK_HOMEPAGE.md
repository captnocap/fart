# Storybook HomePage — Infinite Canvas Guide

This documents how the storybook homepage works. Read this before touching it.

## 1. Entry Point

**Storybook.tsz is the entry point. HomePage_c.tsz is a component inside it.**

You compile `carts/storybook/Storybook.tsz`. Never compile `HomePage_c.tsz` standalone — it's imported as a component. The compiler inlines all component state, script blocks, and JSX into the parent bundle.

The HomePage must NOT be inside `<C.Content>` (which is a ScrollView). ScrollView auto-sizes to content height and Canvas nodes live in graph space — the canvas collapses to ~0px. The HomePage's Canvas needs `flexGrow: 1, flexBasis: 0` and must be a direct flex child of Shell, not wrapped in a ScrollView.

Use conditionals to swap between HomePage (direct child) and Content (ScrollView) for other pages:
```
{activeNav == 0 && <HomePage />}
{activeNav != 0 && <C.Content>...</C.Content>}
```

## 2. Canvas Element Setup

```tsx
<Canvas style={{ flexGrow: 1, flexBasis: 0 }} viewX={0} viewY={0} viewZoom={0.7} driftX={-15} driftY={-10}>
```

- `flexGrow: 1, flexBasis: 0` — fills all available space in the parent column (minus footer). `flexBasis: 0` is critical — without it the flex algorithm uses content height as basis.
- `viewX={0} viewY={0}` — initial camera center. The welcome overlay is clamped here.
- `viewZoom={0.7}` — slightly zoomed out so more tiles are visible on load.
- `driftX={-15} driftY={-10}` — continuous viewport animation in px/s. Negative = camera moves left and up, so content appears to drift right and down.

Drift pauses when: user is dragging (canvas pan), or a node is selected (clicked). Resumes on release/deselect.

## 3. Canvas.Clamp for Welcome Overlay

```tsx
<Canvas.Clamp>
  <Box style={{ flexDirection: 'column', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
    <Box style={{ ..., backgroundColor: '#0d1117e0', ... }}>
      <Text ...>reactjit</Text>
      ...
    </Box>
  </Box>
</Canvas.Clamp>
```

- Clamp is fixed to the viewport — doesn't move with pan/zoom/drift.
- The background MUST be semi-transparent (`#0d1117e0` — `e0` = 87% opacity). Tiles drift behind it. An opaque background defeats the purpose.
- Clamp content uses `width: '100%', height: '100%'` because it sizes relative to the viewport, not graph space.

## 4. Tile Layout Math

Canvas.Node tiles are isolated layout universes. Each node gets `gx` (center X), `gy` (center Y), `gw` (width), `gh` (height).

**Auto-height (gh=0):**
The layout engine supports `gh={0}` for auto-sizing. It allocates a generous box (500px), layouts children inside it, measures the actual content extent, then shrinks the node to fit. This eliminates dead space. The `canvas_gh` field on the node gets updated to the measured height.

IMPORTANT: When using `gh={0}`, the tile's inner Box must NOT have `height: '100%'` — that resolves against the initial allocation and inflates to 500px. Also no `flexGrow: 1` on containers inside tiles — same problem.

**The measurement loop for getting correct gh:**
1. Set `gh={0}` on the node (or some generous default like 250)
2. Add your content
3. Build: `./zig-out/bin/zigos-compiler build carts/storybook/Storybook.tsz`
4. Add debug logging in `positionCanvasNodes` to print `child.computed.h` for each node
5. Run, read the measured heights
6. Set `gh` to the measured value if you want fixed height, or leave at 0 for auto

**Stacking:**
When the canvas has `canvas_drift_active` (drift is enabled), the engine auto-stacks tiles per column with a uniform gap (`CANVAS_NODE_GAP = 30px`). Tiles in the same column (same `gx`) are stacked outward from the first tile's `gy`:
- First tile: centered at its `gy`
- Odd-indexed tiles: grow downward
- Even-indexed tiles: grow upward

This creates jagged top/bottom edges per column — no flat horizontal boundary.

**Gap uniformity:**
The gap between tiles is always `CANVAS_NODE_GAP` (30px), set in engine.zig. It's the same in all directions. Don't try to manually compute gy positions — the engine does it.

## 5. Staggered Column Start Positions

Every column's first tile starts at a DIFFERENT `gy`. This breaks the horizontal edge.

Example stagger:
```
gx=-1050: gy=-200
gx=-750:  gy=-500
gx=-450:  gy=-100
gx=-150:  gy=-350
gx=150:   gy=-450
gx=450:   gy=-150
gx=750:   gy=-400
gx=1050:  gy=-250
```

The auto-stacker uses the first tile's `gy` as the center point. Tiles grow outward from there. Varying the center per column means the top and bottom edges are all at different heights — no straight line.

Column X positions use a 300px stride (gx values: -1050, -750, -450, -150, 150, 450, 750, 1050). Tile width is 260px, leaving 40px between columns. The vertical divider lines are at the midpoints between columns.

## 6. hopTo Function

```tsx
<script>
function hopToTile(idx) {
  hopTo((idx % 8) * 300 - 1050, 0);
}
</script>
```

`hopTo(x, y)` is a JS-callable function exposed by the engine. It smoothly eases the canvas viewport to the target graph-space coordinates. Uses exponential decay (lerp toward target, converges in ~1s). While hopping, drift is paused. After hop completes, drift resumes.

The formula `(idx % 8) * 300 - 1050` converts a tile index to the column's gx position.

## 7. How to Add a New Tile

1. Pick a column (choose a `gx` value: -1050, -750, -450, -150, 150, 450, 750, 1050)
2. Add a `<Canvas.Node>` inside the Canvas, AFTER the last node in that column:
   ```tsx
   <Canvas.Node gx={-1050} gy={0} gw={260} gh={0}>
     <Box style={{ backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#1c2333', borderRadius: 8, padding: 12, flexDirection: 'column', gap: 6 }}>
       <Text fontSize={11} color="#8b949e">My Tile</Text>
       ...your content...
     </Box>
   </Canvas.Node>
   ```
3. The `gy` value doesn't matter much — the auto-stacker will reposition it based on column order. Just make sure it's in the right column group (nodes are grouped by `gx` in array order).
4. Set `gh={0}` for auto-height, or measure and set explicit.
5. Build and test.

Nodes MUST be ordered by `gx` in the children array. All nodes for column gx=-1050 must come before nodes for gx=-750, etc. The auto-stacker relies on this ordering.

## 8. What NOT To Do

- **Don't compile HomePage_c.tsz standalone.** It's a component, not an app. Compile Storybook.tsz.
- **Don't hand-place tiles with precise gy values.** The auto-stacker handles vertical positioning. Only set the first tile's gy per column (the center point).
- **Don't use opaque Clamp backgrounds.** The whole point is tiles drifting behind the welcome text. Use semi-transparent: `#0d1117e0` or similar with alpha channel.
- **Don't use `height: '100%'` on tile inner boxes.** It resolves against the Canvas.Node's allocated height and breaks auto-sizing.
- **Don't use `flexGrow: 1` on containers inside tiles.** Same problem — expands into the allocated height instead of sizing to content.
- **Don't use JSX comments `{/* ... */}` inside Canvas children.** The compiler doesn't support them — they get compiled as text content on the Canvas node, which gives it a content height and breaks layout.
- **Don't put the HomePage inside `<C.Content>` (ScrollView).** The canvas collapses to ~0px height inside a ScrollView.
- **Don't set drift on canvases that aren't the storybook homepage.** Drift is global canvas state. If you set it on one canvas, other canvases inherit it unless they explicitly clear it. The engine handles this by always setting drift from the node props (0,0 if no drift attribute).
