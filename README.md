# ReactJIT

This is an experiment. We don't claim to know where it's going. It started as a joke about putting a React game inside a monitor in cs_office, and things got out of hand. Now it's a general-purpose stack that does whatever you point it at — coding tools, 3D scenes, physics sims, audio visualizers, agent UIs, chemistry plots, finance dashboards, emulators, whatever. Put the fries in the bag.

Write React. Get a single-file native binary. Copy-paste components from any React project. JSX, hooks, tailwind classes, HTML tags, setState, useEffect — all work. But there's no DOM, no CSS engine, no browser. React's reconciler emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned `Node` pool. Layout, paint, hit-test, events, input, text, and GPU are native Zig/wgpu. React is the algorithm, not the environment.

The JS runtime is **V8** (embedded via zig-v8) — the default since April 2026, when it delivered an 1800ms → 40ms click-latency improvement. QJS is maintenance-only legacy; `--qjs` is opt-in. The "V8 has baggage" myth is fake — Chromium has the baggage (networking, rendering engine, browser integration). V8 on its own, embedded in a native app, is tight. We proved it.

```tsx
// cart/counter.tsx
import { useState } from 'react';
import { Box, Text, Pressable } from '../runtime/primitives';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Box className="p-8 gap-4 bg-slate-900">
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{String(count)}</Text>
      <Pressable onPress={() => setCount(count + 1)} className="p-4 bg-teal-500 rounded-lg">
        <Text fontSize={16} color="#ffffff">+ Increment</Text>
      </Pressable>
    </Box>
  );
}
```

One file. `./scripts/ship counter`. Done.

---

## Quick Start

```bash
./scripts/ship counter          # cart/counter.tsx → self-extracting binary
./scripts/ship counter -d       # debug build (raw ELF)
./scripts/ship counter --raw    # release, raw ELF (for ldd inspection)
```

Pipeline: esbuild bundles TSX → `bundle.js` → Zig compiles with the bundle embedded via `@embedFile` → Linux packaging bundles all `.so` deps + `ld-linux` into a self-extracting shell wrapper → macOS produces a `.app` bundle. One file, zero system dependencies.

---

## Dev Loop (hot reload)

```bash
./scripts/dev sweatshop         # persistent dev host + watch
./scripts/dev inspector         # second terminal: pushes to host, adds tab
```

The dev host is a single persistent `ReleaseFast` binary. Edit any file under `cart/` or `runtime/` — esbuild rebundles, host re-evals in ~300ms. No rebuild needed for TSX/TS changes. Rebuild only when you touch `framework/`, `build.zig`, or `scripts/`.

The host is borderless; the top strip IS the window chrome. Tabs for each pushed cart. Double-click to maximize. Drag to move. Window controls on the right.

Dev mode is always `ReleaseFast`. Debug builds have a pre-existing click-path bug — don't use them for dev work.

`useHotState` scaffolding exists but **doesn't preserve state across reloads yet**. Treat HMR as "save → see your change, lose local useState."

---

## What's Real on the .tsx Side

### Works out of the box

- **Standard hooks** — `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `useContext`, custom hooks
- **HTML tags** — `<div>`, `<span>`, `<button>`, `<img>`, `<input>`, `<h1>`–`<h6>`, and friends remapped to native primitives in `renderer/hostConfig.ts`. HTML-only attrs stripped before the bridge.
- **Tailwind via `className`** — full utility coverage: spacing, sizing, flex, colors, radius, borders, typography, arbitrary bracket values (`p-[20]`, `bg-[#ff6600]`).
- **Timers** — `setTimeout`, `setInterval`, `performance.now()` backed by the engine frame clock.
- **Events** — `onClick`, `onPress`, `onChangeText`, `onKeyDown`, `onScroll`, `onRightClick`. Bidirectional through the Zig runtime.

### Works via hooks (`runtime/hooks/`)

- **fs** — read/write/list/stat/mkdir/remove
- **localstore** — persistent key/value via SQLite
- **sqlite** — JSON param binding, typed row objects
- **http** — sync (`curl` subprocess) and async (libcurl worker pool)
- **crypto** — randomBytes, HMAC-SHA256, HKDF-SHA256, XChaCha20-Poly1305
- **clipboard** — system get/set

`installBrowserShims()` one-liner adds `fetch` + `localStorage` globals for copy-pasted code.

### Doesn't work (no browser context)

- No `window`/`document`/`navigator` — minimal shims so code doesn't crash, but DOM manipulation is a no-op.
- No `sessionStorage`, `IndexedDB`, cookies.
- No `Blob`, `FormData`, `FileReader`, `XMLHttpRequest`.
- No inline `<svg>` — use `<Canvas.Path>` or `<Graph.Path>`.
- No CSS `@media`, Grid, pseudo-classes, transitions — use `useEffect` + interval.

This is closer to React Native than browser React. Great for dashboards, tools, games, visualizers, chat UIs, creative coding.

---

## Primitives

`Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`, `Canvas`/`Canvas.Node`/`Canvas.Path`/`Canvas.Clamp`, `Graph`/`Graph.Path`/`Graph.Node`, `Native`.

`<Native type="X" />` is the universal escape hatch — the reconciler emits CREATE with that type string, the Zig host handles it. Audio, Video, Cartridge, LLMAgent, RigidBody, etc. all bridge through this.

---

## How We Got Here

**love2d** — built a proven reconciler-on-Lua stack with 30+ packages, storybook, classifier, theme, tw, hooks. Frozen at `love2d/` — read-only reference for porting patterns.

**tsz** — 50-day experiment compiling a `.tsz` DSL to Zig ahead of time. Theory: AOT beats VM. Reality: layout is the bottleneck, not JS execution. AOT bought nothing user-facing, cost every language feature as emitter work, and drifted toward reimplementing React. Frozen at `tsz/`.

**QJS** — QuickJS-based host. Hit a 2000ms-per-click ceiling on large React trees. Legacy, maintenance-only.

**V8** — default since April 2026. The move coincided with discovering a synchronous path in the React reconciler that was the actual bottleneck. Fixing that plus V8's headroom dropped clicks from 1800ms to 40ms. V8 on its own (not Chromium) is lean and fast. We ship with it.

**JSRT** — a JS evaluator in Lua, running inside LuaJIT. JS stays JS as data; the evaluator walks an AST and executes JS semantics. LuaJIT's trace JIT optimizes the evaluator's hot paths. 12/13 targets passing at `framework/lua/jsrt/`. Not the default runtime, but the alternate path.

---

## Repository Layout

```
framework/            Zig runtime (layout, engine, GPU, events, input,
                      state, effects, text, windows, LuaJIT runtime).
framework/lua/jsrt/   JSRT evaluator in Lua. Alternate runtime path.
runtime/              JS entry, primitives, classifier, theme, tw,
                      JSX shim, window/document shims.
renderer/             Reconciler host config. Mutation command stream.
cart/                 .tsx apps. One file = one app.
cart/sweatshop/       Active IDE cart (evolved from cursor-ide).
scripts/              ship (one-command build), esbuild wrapper.
build.zig             Root build.

v8_app.zig            ACTIVE. V8-based cart host (default).
qjs_app.zig           LEGACY. QJS host. Maintenance-only.
jsrt_app.zig          JSRT host binary. Alternate path.

tsz/                  FROZEN. Smith-era compiler stack.
love2d/               FROZEN. Proven reconciler-on-Lua stack. Reference.
archive/              FROZEN. Old compiler iterations.
os/                   Future (CartridgeOS). Mostly stubs.
```

---

## Performance

Vsync-locked by default. Uncap with `ZIGOS_VSYNC=0 ./zig-out/bin/<app>`.

- esbuild bundle: ~30–100ms
- zig build (cached): ~1–3s
- packaging: ~500ms
- Layout: sub-ms
- Paint: ~250µs
- Binary: ~24MB self-extracting

---

## Design Philosophy

**Be conservative in what you send, be liberal in what you accept.**

The runtime accepts anything React emits. HTML tags, tailwind, inline styles, handler aliases. If a model hallucinates valid JSX, it should render. But first-party code uses classifiers, theme tokens, and semantic primitives. The freedom is at the boundary where external code enters.

---

## Contributing

See [`AGENTS.md`](AGENTS.md) for agent/AI contributor guidance. See [`CLAUDE.md`](CLAUDE.md) for Claude Code specific conventions.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
