# Changelog

Major features and milestones for the tsz stack, organized by date.

---

## 2026-03-25 — SDL3 Migration

- **SDL2 → SDL3 (3.2.8)**: Migrated the entire framework from SDL2 to SDL3, updating all window, event, GPU, and input APIs.

## 2026-03-24 — Crash Isolation & Cartridge Safety

- **Crash isolation for cartridges**: Hostile `.so` cartridges can no longer kill the host process. Faults in loaded cartridges are caught and isolated.
- **Single-instance dev shell**: PID file at `/tmp/tsz-dev.pid` prevents duplicate dev windows. Re-running `tsz dev` rebuilds the `.so` and the existing shell auto-reloads.

## 2026-03-23 — CartridgeOS & Hot-Reload

- **`<Cartridge>` primitive**: Embed `.so` apps inline as components with `<Cartridge src="app.so" />`.
- **CartridgeOS**: Multi-app tabbed shell with cross-cartridge state access. Run `tsz-dev app1.so app2.so` for a tabbed host.
- **Hot-reload dev shell**: `tsz dev` provides 63x faster iteration — compiles to `.so`, watches for changes, hot-reloads in ~186ms.
- **State preservation across hot-reloads**: useState values survive `.so` rebuilds.
- **Watch all .tsz files**: Dev mode monitors the entire cart directory, not just the entry point.
- **Build restructure**: Self-extracting dist packaging for portable binaries.
- **Pure Zig file explorer cartridge**: Custom cart build target (`zig build cart`).

## 2026-03-22 — Inspector & IPC

- **IPC debug client**: Remote inspector attach via debug_server IPC.
- **Recursive map depth**: Object array mirrors, nested unpack, classifier conditionals.
- **Primitive API reference**: Comprehensive docs for all primitive props.
- **Canvas system docs**: Document the canvas and Graph elements.
- **Log export guide**: Runtime logging documentation.
- **Right-click context menu**: Framework-level context menu support.
- **Drift-pause-on-focus**: Animations pause when window loses focus.

## 2026-03-21 — Conformance & Tools

- **Conformance tests d17-d33**: Map conditionals, script blocks, deep nesting.
- **Tools app**: Session discovery, self-inspect, inspector IPC wiring.
- **Conformance-driven compiler fixes**: Map conditionals, nested objects, state slot resolution.
- **JSON-driven classifier engine**: Runtime-configurable classifiers.
- **Storybook**: 8 new interactive tiles, generative canvas auto-stacker.

## 2026-03-20 — Semantic Terminal

- **Semantic terminal bridge**: Port semantic graph builder from Love2D.
- **Classifier sheets + `__sem_snapshot`**: Consumer format for semantic data.
- **Command detection**: Debug hotkey, default-off classification.
- **Claude-canvas cart**: Semantic terminal visualization.
- **Graph element**: `<Graph>` for lightweight SVG chart paths without canvas overhead.

## 2026-03-19 — OS & Web

- **CartridgeOS boots**: Alpine kernel + Zig init + QuickJS.
- **Zig HTTP bridge**: Using framework httpserver.
- **Unified web page**: tsz + QuickJS + Linux all in browser.
- **WASM runtime**: QuickJS + Zig layout + WebGPU in one WASM module.

## 2026-03-18 — Inspector & Parity

- **Full Inspector**: 5 sub-tabs (Elements, Console, Network, Source, Wireframe).
- **TodoMVC**: Full add + display pipeline working.
- **Hacker News clone**: React parity testing cart.
- **Debug server**: Encrypted IPC with comptime elimination, session auth, visual pairing.
- **Tools app**: Dashboard, Inspector, BSOD Viewer, Test Runner tabs.

## 2026-03-17 — Terminal Features

- **Semantic classifier**: Basic + claude_code modes with 25+ tokens.
- **Text selection**: Ctrl+Shift+C/V copy/paste in terminal.
- **Scrollback buffer**: Mouse wheel navigation.
- **17 standard themes**: Plus BIOS and Win95 custom themes.

## 2026-03-16 — Privacy & Crypto

- **Privacy framework**: Port from Love2D, PII demo cart.
- **Crypto module**: Test cart with runtime crypto.
- **Graph element**: Added to validator primitives.

## 2026-03-15 — Repo Restructure

- **`experiments/zigos/` → `tsz/`**: Promoted to top-level, archived old tsz directory.
- **CLI release workflow**: GitHub Actions for tsz compiler releases.

## 2026-03-14 — 3D, Physics, Storybook

- **3D inline API**: Scene3D and Mesh primitives.
- **Terminal cell-grid renderer**: Per-cell rendering.
- **Physics drag + walls**: 2D physics improvements.
- **Inspector modules**: Dynamic DetailPane with live node properties.

## 2026-03-12 — Compiler Improvements

- **Nested map detection**: Component-inlined maps.
- **Display condition propagation**: Map pool nodes.
- **Filtered pool alignment**: Nested map card styling.

## 2026-03-08 — Hot State & Terminal

- **HMR state preservation**: useState survives hot reload in Love2D stack.
- **Claude Code terminal**: Promote claude canvas to framework + `@reactjit/terminal` package.
- **Crash recovery**: State preloading in reload pipeline.
- **Block classification**: Cursor detection + framework-wide updates.

## 2026-03-06 — Semantic Classification

- **Claude Code classifier**: Complete 25-token semantic vocabulary.
- **TUI compositor**: Real-time semantic classification of terminal output.
- **Classifier accuracy fixes**: Viewport-independent clipboard dump.

## 2026-03-04 — HTML & Tailwind

- **HTML element remapping**: `<div>`, `<span>`, `<h1>`-`<h6>`, `<button>` map to primitives.
- **12-column grid system**: Tailwind CSS compatibility layer.
- **Div soup support**: 8,000+ lines of pure div soup working.

## 2026-03-01 — CLI & Migration

- **CLI improvements**: Init scaffolding, dev watcher, migration commands.
- **Convert/migrate commands**: React, Tkinter, SwiftUI → ReactJIT migration tools.
- **macOS support**: Dev servers, production builds, all targets.

## 2026-02 — Foundation (Love2D Stack)

- **Nano-diffusion example**: Image processing demo.
- **Blessed/curses migration**: CLI tool for migrating terminal UIs.
- **React permission modals**: For Claude Code integration.
- **Architecture: native/web purge**: Single-path Love2D only, DOM target removed.
