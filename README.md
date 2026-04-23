# ReactJIT

This is an experiment. We don't know where it's going. It's a general-purpose stack that does whatever you point it at — coding tools, 3D scenes, physics sims, audio visualizers, agent UIs, dashboards, emulators. Put the fries in the bag.

Write React in plain `.tsx`. Bundle with esbuild. Get a single-file native binary. Copy-paste components from any React project. JSX, hooks, tailwind classes, HTML tags — all work. But there is no DOM, no CSS engine, no browser. React's reconciler emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned `Node` pool. Layout, paint, hit-test, events, input, text, and GPU are native Zig/wgpu. React is the algorithm, not the environment.

The JS runtime is **V8** (embedded via zig-v8) — the default since April 2026. The prior QuickJS-based host hit a 2000ms-per-click ceiling on large React trees and is now maintenance-only legacy. `scripts/ship` builds V8 by default; `--qjs` is legacy opt-in.

The "V8 has baggage" myth is fake — the baggage is Chromium, not V8. V8 standalone is ~6MB. Node+V8 is ~50MB. CEF is ~200MB. We measured it. V8-qua-V8, embedded in a native app, is tight.

---

## Quick start

```bash
./scripts/ship counter          # cart/counter.tsx → self-extracting binary
./scripts/ship counter -d       # debug/raw ELF
./scripts/ship counter --raw    # release/raw ELF

./scripts/dev sweatshop         # persistent dev host + hot reload
```

Dev mode is always `ReleaseFast`. Debug builds have a pre-existing click-path bug — don't use them for dev work. `useHotState` scaffolding exists but doesn't preserve state across reloads yet.

---

## What's in the box

**Primitives:** `Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`, `Canvas`/`Canvas.Node`/`Canvas.Path`, `Graph`/`Graph.Path`/`Graph.Node`, `Native`.

`Native` is the universal escape hatch — `<Native type="X" />` bridges to Zig-handled types (Audio, Video, Cartridge, LLMAgent, etc.) until they get first-class wrappers.

**Copy-paste compatibility:** Standard hooks, HTML tags remapped to primitives, tailwind `className`, timers, and events all work out of the box. `installBrowserShims()` adds `fetch` + `localStorage` globals.

**Host hooks:** fs, SQLite, HTTP (sync + async), crypto, clipboard. See `runtime/hooks/README.md` for the full matrix.

**Not available:** `window`/`document`, `sessionStorage`/`IndexedDB`, CSS Grid/media/pseudo-classes, inline SVG, blob URLs. This is closer to React Native than browser React.

---

## Source layout

```
cart/              .tsx apps (single-file or directory-based)
cart/sweatshop/    Active IDE cart

framework/         Zig runtime (~45k lines). Layout, engine, GPU,
                   events, input, state, text, windows.
runtime/           JS entry, primitives, classifier, theme, tw, hooks.
renderer/          Reconciler host config. Mutation command stream.
scripts/           Build scripts.
build.zig          Root build.

v8_app.zig         ACTIVE — V8-based cart host (default).
qjs_app.zig        LEGACY — QuickJS host. Maintenance-only.
jsrt_app.zig       JSRT host binary. Alternate path.

tsz/               FROZEN — Smith-era AOT compiler stack.
love2d/            FROZEN — Proven reconciler-on-Lua stack.
archive/           FROZEN — Old compiler iterations.
os/                Future (CartridgeOS). Mostly stubs.
```

Frozen directories are read-only. See git log for the backstory.

---

## Status

| Working | Incomplete |
|---|---|
| IDE cart, all primitives, HTML remapping, tailwind | Multi-window, Inspector |
| Host bindings (fs, http, crypto, clipboard, etc.) | Physics/audio/video bridging |
| Dev host with ~300ms hot reload | WebSocket hooks, subprocess pipes |
| V8 runtime (default) | `useHotState` persistence |

---

## Contributing

See [`AGENTS.md`](AGENTS.md) for agent/AI contributor conventions. See [`CLAUDE.md`](CLAUDE.md) for Claude Code specific guidance.

---

*"Any sufficiently advanced technology is indistinguishable from magic." — Arthur C. Clarke*
