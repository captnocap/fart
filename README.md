# ReactJIT

Write React. Get a native binary. No runtime, no interpreter, no garbage collector.

```
app.tsz (TypeScript + JSX)
   |
   v
tsz compiler (hand-written Zig, 17K lines)
   |
   v
generated Zig source (layout + GPU paint + events + state)
   |
   v
native binary (SDL2 + wgpu + FreeType + QuickJS)
```

```tsx
const [count, setCount] = useState(0);

function App() {
  return (
    <Box style={{ padding: 32, gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Pressable onPress={() => { setCount(count + 1) }}
        style={{ padding: 16, backgroundColor: '#4ec9b0', borderRadius: 8 }}>
        <Text fontSize={16} color="#ffffff">+ Increment</Text>
      </Pressable>
    </Box>
  );
}
```

That's the entire app. Compiles to a native binary.

---

## Three Pillars

### `tsz/` — Compiler + Framework (active)

The `.tsz` compiler and native rendering framework. A hand-written lexer, parser, and multi-phase codegen in pure Zig compiles TypeScript + JSX into Zig source that links against the framework runtime.

- **Compiler** — 23 modules, ~17K lines. Components, useState, useEffect, .map(), conditionals, template literals, classifiers, script imports, HTML tags, FFI
- **GPU renderer** — wgpu pipeline: SDF text, rounded rects, borders, shadows, images, video, 3D (Blinn-Phong), custom effects
- **Layout engine** — Flexbox (1400 lines), CSS-spec-aligned, WPT-tested
- **Networking** — HTTP client/server, WebSocket client/server, IPC, SOCKS5, Tor — all pure Zig
- **Physics** — Box2D 2.4.1 integration for 2D rigid body simulation
- **3D** — Inline 3D viewports with camera, lights, and mesh primitives (box, sphere, plane, cylinder)
- **Terminal** — PTY terminal emulator with cell-grid rendering
- **Canvas** — Infinite canvas with zoom/pan/drift, SVG path nodes, graph visualization
- **Inspector** — Built-in devtools: element tree, style inspector, performance profiler, constraint graph
- **Transitions** — CSS-style animations with timing and spring physics

### `love2d/` — Lua Reference Stack

The original proof of concept. React reconciler → QuickJS → Lua layout → Love2D painter. Mature, full-featured: 30+ packages, storybook, HMR, test runner, CLI with `rjit convert`, theme system, 3D, audio, terminal emulator. The native engine ports features from here.

### `os/` — CartridgeOS + Exodia (future)

Operating system shell and app distribution layer. CartridgeOS manages windows, permissions, and app lifecycle. Exodia is the network layer for cart distribution and discovery.

---

## What Are .tsz Files?

`.tsz` is TypeScript + JSX that compiles to native code. No bundler, no transpiler chain — one compiler, one output.

| Extension | What | Example |
|-----------|------|---------|
| `.app.tsz` | App → binary | `counter.app.tsz` |
| `.mod.tsz` | Runtime module → `.gen.zig` | `state.mod.tsz` |
| `.tsz` | Component import | `Button.tsz` |
| `.cls.tsz` | Shared styles/classifiers | `styles.cls.tsz` |
| `.script.tsz` | QuickJS runtime script | `data.script.tsz` |
| `_c.tsz` | Component module | `Header_c.tsz` |
| `_cmod.tsz` | Component module (alt) | `Badge_cmod.tsz` |

## Quick Start

```bash
cd tsz

# Build the compiler
zig build compiler

# Compile and build a cart
./zig-out/bin/zigos-compiler build carts/storybook/Storybook.tsz

# Run it
./zig-out/bin/Storybook
```

## Primitives

`Box` `Text` `Image` `Pressable` `ScrollView` `TextInput` `TextArea`

Also accepts HTML tags: `div` `span` `p` `h1`-`h6` `button` `section` `nav` `header` `footer` `img` `input` — mapped to primitives automatically.

## Carts

Apps are called "carts." Each is a `.tsz` entry point with optional components, classifiers, and scripts.

```
carts/
  storybook/          Component catalog + infinite canvas + theme demo
  inspector/          Built-in devtools (element tree, styles, perf)
  dashboard/          Dashboard demo
  charts/             Chart library (area, bar, candlestick, pie, radar, ...)
  browser/            In-app web content renderer
  effect-bench/       Stress tests (57M+ bridge calls/s, 5000+ node layout)
  conformance/        Compiler conformance suite (16 tests, SHA256-locked)
  wpt-flex/           W3C Web Platform Tests for flexbox (70 tests)
  autobahn-ws/        Autobahn WebSocket conformance (202/204 cases pass)
  http-conformance/   HTTP conformance test harness
  animations/         Animation and physics demos
  scene3d-demo/       3D rendering demo
  pty-test/           Terminal emulator
  constraint-graph/   Constraint graph visualization
```

## Conformance

| Suite | Score | What |
|-------|-------|------|
| Autobahn WebSocket | 202/204 | RFC 6455 compliance |
| WPT Flexbox | 70 | W3C CSS flex spec |
| Compiler | 16 | Real React app ports + destructive pattern tests |

## Performance

At 4096 mapped items (5139 visible nodes):
- Layout: ~3.3ms
- Paint: ~260us
- Bridge: 57M setState calls/s with zero impact on layout

```
[telemetry] FPS: 258 | layout: 3268us | paint: 263us | visible: 5139 | bridge: 57671729/s
```

## `archive/` Purpose

`archive/` contains `tsz/` (v1) and `tsz-gen/` (v2) — earlier iterations of the compiler and runtime. These are frozen references, not active code. The v1 stack was a hand-written Zig runtime. The v2 stack added `.mod.tsz → .gen.zig` compilation. Both are superseded by the current `tsz/` (v3) which has the multi-phase compiler, QuickJS bridge, inspector, and full networking stack.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
