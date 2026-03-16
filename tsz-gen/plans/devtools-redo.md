# Devtools Redo — Delete Zig UI, Use .tsz Components

## WHAT HAPPENED

An agent ignored the plan's own rule ("Do NOT hand-write devtools UI in Zig") and drew
pixels by hand in `compositor.zig` — hardcoded tab hit zones, manual text positioning,
magic pixel offsets. The result is 30% coverage that barely works.

## WHAT TO DO

1. **Delete** all devtools rendering code from `compositor.zig`
2. **Keep** `telemetry.zig` — it's correct and complete
3. **Write** proper `.tsz` components using the framework's own primitives
4. **Inject** devtools as a conditional child of root at compile time

## RULE (READ THIS BEFORE WRITING ANY CODE)

**Every piece of devtools UI is a .tsz component.**
- Tab bar → `<Pressable>` elements with `onPress`
- Status bar → `<Box>` with `<Text>` children
- Sparkline → `<Box>` elements in a row with computed heights
- Node tree → `<ScrollView>` with `<Text>` lines
- Wireframe → `<Box>` elements with scaled positions
- Panel resize → state variable for panel height

**The ONLY Zig code is `telemetry.zig`** (already done) and built-in function registration
in `codegen.zig` (already done — `getFps()`, `getLayoutMs()`, etc.).

If you find yourself writing `SDL_RenderFillRect` or `SDL_SetRenderDrawColor` for devtools
UI, **STOP. You are doing it wrong. Use `<Box>` with `backgroundColor`.**

If you find yourself computing pixel positions for click targets, **STOP. Use `<Pressable>`.**

If you find yourself manually positioning text, **STOP. Use `<Text>` inside a `<Box>`
with padding.**

## Step 1: Delete Compositor Devtools Code

In `tsz/runtime/compositor.zig`:
- Remove `renderDevtoolsOverlay()` and everything it calls
- Remove `handleDevtoolsClick()`
- Remove `devtools_visible`, `devtools_tab` state
- Keep F12 keybinding but route it to a state variable the .tsz component reads

In `tsz/compiler/loop_template.txt`:
- Remove the `compositor.handleDevtoolsClick()` call
- Remove the `compositor.renderDevtoolsOverlay()` call

## Step 2: Devtools State

The devtools needs 3 state variables:
- `devtoolsVisible` (bool) — F12 toggles this
- `devtoolsTab` (int) — which tab is active
- `devtoolsPanelHeight` (int) — resizable panel height

These are regular `useState` slots. The compiler allocates them AFTER the app's state slots
so there's no conflict.

## Step 3: Components

### `tsz/devtools/DevtoolsPanel.tsz`

```tsx
function DevtoolsPanel() {
  const [tab, setTab] = useState(0);

  return (
    <Box style={{ height: 250, backgroundColor: '#12121e', flexDirection: 'column' }}>
      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', height: 28, backgroundColor: '#0a0a16', alignItems: 'center', gap: 0 }}>
        <Pressable onPress={() => setTab(0)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>
          <Text fontSize={12} color={tab == 0 ? '#ffffff' : '#666666'}>Perf</Text>
        </Pressable>
        <Pressable onPress={() => setTab(1)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>
          <Text fontSize={12} color={tab == 1 ? '#ffffff' : '#666666'}>Elements</Text>
        </Pressable>
        <Pressable onPress={() => setTab(2)} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>
          <Text fontSize={12} color={tab == 2 ? '#ffffff' : '#666666'}>Wireframe</Text>
        </Pressable>
      </Box>

      {/* Tab content */}
      <Box style={{ flexGrow: 1 }}>
        {tab == 0 && <PerfTab />}
        {tab == 1 && <ElementsTab />}
        {tab == 2 && <WireframeTab />}
      </Box>

      {/* Status bar */}
      <StatusBar />
    </Box>
  );
}
```

### `tsz/devtools/StatusBar.tsz`

```tsx
function StatusBar() {
  const [fps, setFps] = useState(0);
  const [layoutMs, setLayoutMs] = useState(0);
  const [paintMs, setPaintMs] = useState(0);
  const [nodes, setNodes] = useState(0);
  const [rss, setRss] = useState(0);

  useEffect(() => {
    setFps(getFps());
    setLayoutMs(getLayoutMs());
    setPaintMs(getPaintMs());
    setNodes(getNodeCount());
    setRss(getRssMb());
  }, 500);

  return (
    <Box style={{ flexDirection: 'row', height: 22, backgroundColor: '#0a0a16', paddingLeft: 8, paddingRight: 8, alignItems: 'center', gap: 16 }}>
      <Text fontSize={11} color={fps >= 55 ? '#4ec9b0' : fps >= 30 ? '#dcdcaa' : '#f44747'}>{`FPS: ${fps}`}</Text>
      <Text fontSize={11} color="#666666">{`Layout: ${layoutMs}ms`}</Text>
      <Text fontSize={11} color="#666666">{`Paint: ${paintMs}ms`}</Text>
      <Text fontSize={11} color="#666666">{`Nodes: ${nodes}`}</Text>
      <Text fontSize={11} color="#666666">{`RSS: ${rss}MB`}</Text>
    </Box>
  );
}
```

### `tsz/devtools/PerfTab.tsz`

Sparkline as a row of colored boxes:
```tsx
function PerfTab() {
  // Poll telemetry ring buffer
  // Render 120 boxes in a row, heights from frame history
  // Budget bar as a single box with proportional width
  // Stats row with FPS, timing, node count
  return (
    <Box style={{ padding: 8, flexDirection: 'column', gap: 8 }}>
      {/* Budget bar */}
      <Box style={{ height: 20, backgroundColor: '#1a1a2e', borderRadius: 4 }}>
        <Box style={{ height: 20, width: budgetWidth, backgroundColor: budgetColor, borderRadius: 4 }} />
      </Box>

      {/* Sparkline — needs .map() over frame history */}
      <Box style={{ flexDirection: 'row', height: 60, alignItems: 'end', gap: 1 }}>
        {frames.map((frame, i) => (
          <Box style={{ width: 2, height: frame.height, backgroundColor: frame.color }} />
        ))}
      </Box>

      {/* Stats */}
      <Box style={{ flexDirection: 'row', gap: 16 }}>
        <Text fontSize={12} color="#4ec9b0">{`FPS: ${fps}`}</Text>
        <Text fontSize={12} color="#888888">{`Layout: ${layoutMs}ms | Paint: ${paintMs}ms`}</Text>
        <Text fontSize={12} color="#888888">{`Nodes: ${nodes} | RSS: ${rss}MB`}</Text>
      </Box>
    </Box>
  );
}
```

### `tsz/devtools/ElementsTab.tsz`

Node tree as scrollable indented text:
```tsx
function ElementsTab() {
  // getNodeTree() returns flattened array of {name, depth, w, h, hasText, text}
  return (
    <ScrollView style={{ flexGrow: 1 }}>
      {nodes.map((node, i) => (
        <Pressable onPress={() => selectNode(i)} style={{ paddingLeft: node.depth * 16, paddingTop: 2, paddingBottom: 2 }}>
          <Text fontSize={11} color={depthColors[node.depth % 7]}>{`${node.name} ${node.w}x${node.h}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

### `tsz/devtools/WireframeTab.tsz`

Scaled node rectangles:
```tsx
function WireframeTab() {
  // getNodeTree() returns nodes with x, y, w, h
  // Scale to fit panel
  return (
    <Box style={{ flexGrow: 1, position: 'relative' }}>
      {nodes.map((node, i) => (
        <Box style={{
          position: 'absolute',
          left: node.x * scale,
          top: node.y * scale,
          width: node.w * scale,
          height: node.h * scale,
          borderWidth: 1,
          borderColor: depthColors[node.depth % 7],
        }} />
      ))}
    </Box>
  );
}
```

## Step 4: Compiler Injection

When building in dev mode (`tsz dev` or `tsz build --dev`), the compiler:
1. Appends the devtools component tree after the app's root
2. Wraps both in a column: app (flexGrow: 1) + devtools panel (conditional)
3. F12 toggles the devtools state variable

```zig
// Generated structure:
var root = Node{
    .style = .{ .flex_direction = .column, .width = 100, .height = 100 },
    .children = &[_]Node{
        app_root,                           // user's app (flexGrow: 1)
        devtools_panel,                     // conditional on devtools_visible
    },
};
```

The devtools panel uses `display: none/flex` toggle (same as conditional rendering) controlled by the F12 keybinding.

## Step 5: Built-in Functions Needed

Already wired from telemetry.zig:
- `getFps()`, `getLayoutMs()`, `getPaintMs()`, `getNodeCount()`, `getRssMb()`

New built-ins needed:
- `getFrameHistory()` → array of {layout_ms, paint_ms, total_ms} for sparkline
- `getNodeTree()` → flattened array of {name, depth, x, y, w, h, text} for elements/wireframe

These are tree introspection functions that walk the node tree and return data the `.tsz` components render.

## Files

**Delete from:**
| File | What to remove |
|------|---------------|
| `tsz/runtime/compositor.zig` | All devtools rendering + click handling |
| `tsz/compiler/loop_template.txt` | Devtools click intercept + render calls |

**Create:**
| File | What |
|------|------|
| `tsz/devtools/DevtoolsPanel.tsz` | Panel shell + tab bar |
| `tsz/devtools/StatusBar.tsz` | Bottom status bar |
| `tsz/devtools/PerfTab.tsz` | Sparkline + budget bar + stats |
| `tsz/devtools/ElementsTab.tsz` | Node tree (scrollable, clickable) |
| `tsz/devtools/WireframeTab.tsz` | Scaled miniature viewport |

**Modify:**
| File | What |
|------|------|
| `tsz/compiler/codegen.zig` | Inject devtools tree in dev mode, register new built-ins |
| `tsz/runtime/telemetry.zig` | Add `getFrameHistory()` and `getNodeTree()` exports |

## Verification

```bash
tsz build --dev tsz/examples/counter.tsz
./zig-out/bin/tsz-counter
# Press F12 → devtools panel appears at bottom
# Click Perf/Elements/Wireframe tabs
# Sparkline updates live
# Elements tab shows scrollable node tree
# Wireframe shows scaled rectangles
```
