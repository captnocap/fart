# AGENTS.md

Context for AI agents (Codex, Claude, etc.) working in this repository. Last updated: 2026-04-21.

## What This Is

ReactJIT is a React-reconciler-driven UI framework. Apps are written in plain `.tsx` (standard React — hooks, JSX, TypeScript), bundled by esbuild.

**The cart runtime is JSRT** — a JavaScript evaluator written in Lua, running inside LuaJIT. JS source stays JS at every stage; nothing ever translates JS to Lua. The evaluator's scope ends at ECMAScript. Lives in `framework/lua/jsrt/`. 12/13 targets passing. See `framework/lua/jsrt/README.md` + `TARGET.md`; progress check is `./framework/lua/jsrt/test/run_targets.sh`.

React's reconciler (running through the evaluator) emits CREATE/APPEND/UPDATE mutation commands against a Zig-owned `layout.Node` pool; the Zig framework handles layout, paint, hit-test, text, input, events, effects, and GPU.

This root-level stack replaced a 50-day Smith-compiler experiment (`tsz/`) that tried to compile a `.tsz` DSL to Zig ahead of time. Lesson: AOT compilation bought nothing user-facing because layout is the bottleneck for small trees; and on large trees (2000+ fibers), a pure interpreter hits a real wall — 440ms reconcile walks, 2300ms mounts. JSRT exists to clear that wall by letting LuaJIT's trace JIT specialize the evaluator, effectively JIT-compiling the JS running through it.

## Repository Layout

```
framework/            <- ACTIVE. Zig runtime (layout, engine, GPU, events, input,
                         state, effects, text, windows, LuaJIT runtime).
framework/lua/jsrt/   <- ACTIVE. JSRT — JavaScript evaluator in Lua, running in
                         LuaJIT. The cart runtime. Read its README.md + TARGET.md
                         before touching. Progress check:
                         ./framework/lua/jsrt/test/run_targets.sh
runtime/              <- ACTIVE. JS entry, primitives, classifier, theme, tw
                         (tailwind parser), JSX shim.
renderer/             <- ACTIVE. Reconciler host config (hostConfig.lua +
                         reconciler.lua). Receives the mutation command stream
                         JSRT emits.
cart/                 <- ACTIVE. .tsx apps live here. One file = one app.
scripts/              <- ACTIVE. ship = one-command build. build-bundle.mjs =
                         esbuild. build-jsast.mjs = acorn JS → Lua AST literal
                         (JSRT input).
build.zig             <- ACTIVE. Root build.
stb/                  <- ACTIVE. stb_image headers (copied from tsz/stb/).

qjs_app.zig           <- LEGACY. Prior QuickJS-based cart host. Hit a 2000ms
                         per-click ceiling on large React trees. Not extended.
                         JSRT replaces it. Do not build new work here.

tsz/                  <- FROZEN. Smith-era stack. Read-only reference, like love2d/.
love2d/               <- FROZEN. Proven reconciler-on-Lua stack. Reference for any
                         runtime pattern.
archive/              <- FROZEN. Old compiler iterations (v1/v2 tsz).
os/                   <- Future (CartridgeOS). Mostly stubs.
game/                 <- Dead Internet Game. Separate project.
```

## DO NOT TOUCH

- `love2d/` — Read-only reference stack
- `tsz/` — Frozen Smith-era stack (same treatment as love2d/)
- `archive/` — Frozen old compilers
- Any file inside `tsz/` or `love2d/` — copy OUT of these for porting, never write INTO them

## DO NOT RESURRECT (EQJS — deleted 2026-04-21)

EQJS was a JS→Lua transpiler attempt. It drifted into a TSX→React-in-Lua compiler, which is the trap this project has landed in seven times before. All EQJS sources were deleted on 2026-04-21:

- `eqjs_app.zig`, `eqjs_cart_app.zig`, `cursor_ide_eqjs_app.zig` — Zig binaries loading `boot_bundle.lua`
- `deps/eqjs/` — the root JS→Lua transpiler + runtime + samples
- `eqjs-artifacts/` — symlinks into a quarantined external dir
- `tests/eqjs/` — EQJS-era smoke harness (salvageable bridges moved into `framework/lua/jsrt/test/`)
- `runtime/react.lua`, `runtime/host.lua` — EQJS-era Lua-side React/host shims
- `scripts/eqjs-*`, `scripts/ship-eqjs`
- `EQJS_VIABILITY.md`, `docs/port_plan_P*.md`, `docs/port_plan_consensus.md`
- Still quarantined outside the repo: `/home/siah/eqjs/compiler/`

**If you are tempted to resurrect any of this, stop.** The trap shape is: a tool reads JS (or TSX) and produces Lua source. Semantics get baked into the emitted output; every JS feature becomes emitter code; the emitter inevitably reaches above JS into React's surface (hooks, JSX, components) and scope explodes. JSRT is the opposite shape: JS stays JS as *data*; semantics live in one place (the evaluator); scope bounded by ECMAScript. See `CLAUDE.md`'s HARD RULE section.

## JSRT (active direction)

The chosen path to replace QJS. A JavaScript evaluator in Lua, hosted by LuaJIT. JS source never becomes Lua source — the evaluator walks JS (as an AST table produced by acorn) and executes JS semantics directly. LuaJIT's trace JIT specializes the evaluator's hot paths, effectively JIT-compiling the JS running through it.

**Surface you need to know:**

- `framework/lua/jsrt/README.md` — manifesto + scope rules + file map (read before touching)
- `framework/lua/jsrt/TARGET.md` — 13 ordered milestones; each is a specific JS input → expected runtime behavior. Never specify "what Lua code gets emitted" in a target. JSRT is done at a level when all targets up to that level pass
- `framework/lua/jsrt/test/run_targets.sh` — the progress check. When asked "where is JSRT," run this
- `framework/lua/jsrt/test/reconciler_bridge.lua` — end-to-end: JSRT mounts a counter through `renderer/reconciler.lua`, dispatches a click, verifies UPDATE_TEXT
- `framework/lua/jsrt/test/host_config_golden.lua` — unit test for the reconciler emitter protocol

**Pipeline:**

```
cart/*.tsx → esbuild → bundle.js → acorn (scripts/build-jsast.mjs) → bundle.ast.lua
                                                                          ↓
                                                 LuaJIT loads AST → JSRT evaluator walks it
                                                                          ↓
                                                             host FFI via framework/luajit_runtime.zig
                                                                          ↓
                                                             Zig Node pool + layout + paint
```

**The rule that prevents drift:**

The evaluator's scope ends at ECMAScript. It knows `var`/`let`/`const`, function calls, closures, prototype chain, `this`, try/catch, Map/Set/WeakMap, Symbol, iterator protocol, destructuring. It does NOT know about React, hooks, JSX, components, or reconcilers. esbuild lowers JSX to `React.createElement(...)` before anything hits JSRT. If you catch yourself writing evaluator code that names `useState`, `hook`, `fiber`, `component`, or any React concept — STOP. That's the trap.

**Next step toward target 13:**

Write `jsrt_app.zig` at repo root. Embed the AST via `@embedFile`, create a LuaJIT state, load `framework/lua/jsrt/init.lua`, register host FFI callbacks against Zig's node pool, call `JSRT.run(ast, { host = { emitter = ..., tree = ... } })`. Wire `scripts/ship` to build against it. Do NOT extend the legacy `qjs_app.zig` or the deleted EQJS binaries.

## Ship Path (the only path)

```bash
./scripts/ship <cart-name>          # cart/<name>.tsx → zig-out/bin/<name> (self-extracting)
./scripts/ship <cart-name> -d       # debug build, raw ELF
./scripts/ship <cart-name> --raw    # release, raw ELF (for ldd inspection)
```

What happens:
1. esbuild bundles `cart/<name>.tsx` + `runtime/` + `renderer/` → `bundle.js`.
2. `scripts/build-jsast.mjs` runs acorn over `bundle.js` → `bundle.ast.lua` (AST as Lua table literal — *data*, never code).
3. Zig compiles the cart host with the AST embedded via `@embedFile` — the binary carries its own program, no runtime file lookup.
4. Linux: ldd walk → bundle every non-system `.so` + `ld-linux` → tarball → prepend self-extracting shell wrapper. Output file reports "POSIX shell script executable (binary data)". Ships anywhere with zero system deps.
5. macOS: `.app` bundle with `Frameworks/` dylib rewrites + ad-hoc codesign.

**No `.tsz`. No Smith. No d-suite.** When you need a feature — inspector, classifier, theme, custom primitive — port the pattern from `love2d/packages/core/src/` or `love2d/lua/` by hand into `runtime/`, or regenerate it fresh in `.tsx` from a description. `love2d/` already solved every runtime pattern we need.

## Dev Path (iterate without rebuilding)

```bash
./scripts/dev <cart-name>       # launches persistent dev host + watches for saves
./scripts/dev <other-cart>      # second terminal: pushes to running host, adds tab
```

**When to rebuild:**
- Cart `.tsx` / `.ts`, anything under `runtime/` or `renderer/` — **no rebuild needed**. The dev host watches saves, re-bundles via esbuild, pushes the new JS over `/tmp/reactjit.sock`, and re-evals. ~300ms save → visible change.
- Zig (`framework/`, `build.zig`), `scripts/` — **rebuild required**. Delete `zig-out/bin/reactjit-dev` and re-run `./scripts/dev <cart>`, or explicitly: `zig build app -Ddev-mode=true -Doptimize=ReleaseFast -Dapp-name=reactjit-dev`.

**Dev host is always `-Doptimize=ReleaseFast`.** The Debug build has a pre-existing framework bug that silently crashes on any click. Do not switch the dev compile to Debug without fixing that first.

**Window chrome.** The host is borderless; the top strip IS the OS titlebar. Each `scripts/dev <cart>` invocation registers a tab (bootstrap `main` tab is hidden). Click a tab to switch (the cart bundle re-evals from scratch). Double-click chrome → maximize/restore toggle. Drag empty chrome → move window. Min/Max/Close buttons on the right. Resize edges at 6px left/right/bottom, 3px top.

**useHotState state preservation: NOT working yet.** The scaffold exists (`runtime/hooks/useHotState.ts` + `framework/hotstate.zig` + `__hot_get/__hot_set` host fns) but in practice state still resets on every hot reload. Do NOT assume atoms persist. Tell users if they ask.

See `runtime/hooks/README.md` for the current matrix of which host bindings are live (fs / localstore / crypto / sqlite / http sync+async / env / exit all live; websocket + process spawn streaming pending).

## Primitives (runtime/primitives.tsx)

`Box`, `Row`, `Col`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `TextEditor`, `Canvas`/`Canvas.Node`/`Canvas.Path`/`Canvas.Clamp`, `Graph`/`Graph.Path`/`Graph.Node`, `Native`.

`Canvas` is pan/zoomable, `Graph` is a lightweight static-viewport chart surface. Both support `gx/gy/gw/gh` coordinate-space positioning on Nodes and SVG `d`/`stroke`/`strokeWidth`/`fill` on Paths. (Note: `viewX`/`viewY`/`viewZoom` on the root tag aren't wired to camera yet — Canvas props are dropped silently until that's done.)

`<Native type="X" {...props} />` is the universal escape hatch for any host-handled node type (Audio, Video, Cartridge, LLMAgent, RigidBody, etc.). The reconciler emits CREATE with that type; the Zig host handles it.

### HTML tags work

`renderer/hostConfig.ts` has `HTML_TYPE_MAP` that remaps standard HTML tags before CREATE. You can copy-paste React markup from anywhere:

```tsx
<div className="p-4 flex-row gap-2">
  <h1>Hello</h1>
  <p>World</p>
  <button onClick={...}>Go</button>
</div>
```

Maps: `div/section/article/main/nav/header/footer/form/ul/li/table/tr/td/a/button/dialog/menu → View`; `span/p/label/h1-6/strong/b/em/i/code/small → Text`; `img → Image`; `input/textarea → TextInput/TextEditor`; `pre → CodeBlock`; `video → Video`. HTML-only attrs (`alt`, `htmlFor`, `aria-*`, `data-*`, etc.) are stripped before the bridge. Headings get auto font-sizes (h1=32, h2=28, …, h6=16).

### Tailwind via `className`

`runtime/tw.ts` (ported from `love2d/packages/core/src/tw.ts`) parses utility class strings at CREATE time and merges them into `style`. Full coverage: spacing (`p-4`, `mx-8`), sizing (`w-full`, `h-[300]`), flex (`flex-row`, `gap-2`, `justify-center`, `items-start`), colors (`bg-blue-500`, `text-slate-200`), radius (`rounded-lg`), borders (`border-2`, `border-blue-400`), typography (`text-xl`, `font-bold`), arbitrary values via brackets (`p-[20]`, `bg-[#ff6600]`).

`style` props win on conflicts. Mix freely:

```tsx
<Box className="p-4 bg-blue-500 rounded-lg" style={{ borderWidth: 2 }}>
```

## Runtime Shims (runtime/)

Ported from love2d, available as of commit `9ce5dda60`:

- **`classifier.tsx`** — global `classifier()` registry + `classifiers` export. Static defaults, `'theme:*'` token resolution, hook-powered `use` field.
- **`theme.tsx`** — `<ThemeProvider colors={...}>` + `useThemeColors()` + `useThemeColorsOptional()`. Minimal (one colors map, no multi-theme switching).
- **`Native`** primitive for custom host-handled types.
- **Timer subsystem** (`runtime/index.tsx`) — real `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval` against a frame-clock. The Zig host calls `globalThis.__jsTick(now)` each frame; __jsTick fires any due timers. `performance.now()` returns host tick time.

## Layout Rules

Flex layout engine in `framework/layout.zig`. Pixel-perfect, shared logic with love2d's engine.

Sizing tiers (first match wins):
1. Explicit dimensions (`width`, `height`, `flexGrow`, `flexBasis`)
2. Content auto-sizing (shrink-wrap children, text measures from font metrics)
3. Proportional fallback (empty surfaces get 1/4 of parent)

Common pitfalls:
- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling, never hardcoded pixel heights
- `ScrollView` needs explicit height (excluded from proportional fallback)
- Don't mix text and expressions in `<Text>` — use template literals

## Host Event Wiring

Events flow both directions through JSRT in-process:
- Press → Zig `input.zig` → dispatch entry stored via `__registerDispatch` → `Evaluator.callFunction(dispatchFn, ...)` → React handler → state change → new mutations → `__hostFlush` → same Node pool
- Input events: `__dispatchInputChange`, `__dispatchInputSubmit`, `__dispatchInputFocus`, `__dispatchInputBlur`, `__dispatchInputKey`
- Right-click: `__dispatchRightClick` (with prepared payload from `__getPreparedRightClick`)
- Scroll: `__dispatchScroll` (with prepared payload from `__getPreparedScroll`)

## Zig Version

This project uses **Zig 0.15.2**. Training data for most models covers 0.13/0.14. Key breaking changes — check actual source before assuming API shapes.

## Git Discipline

Commit early and often. Descriptive conventional-commit messages (`feat: ...`, `fix: ...`, `refactor: ...`). Multiple AI sessions run in parallel — if `git status` is unexpectedly clean, run `git log --oneline -5` ONCE, see who committed, move on. Do not loop on `git status`.

**Main only, no branches.** The only safe git commands: `git add`, `git commit`, `git push`, `git status`, `git log`, `git diff`. Never `git checkout`, `git stash`, `git reset --hard`, `git branch`, `git switch`. Solo project.

## Model Selection (Claude specifically)

Use Opus 4.6 (`claude-opus-4-6`) or Opus 4.7 (`claude-opus-4-7`) for debugging and anything structural. Sonnet is fine for scaffolding and mechanical work.

## Known Gaps (current)

- **JSRT target 13 pending** — evaluator + builtins are mature; no `jsrt_app.zig` binary yet, ship pipeline doesn't have a JSRT path yet, cursor-ide hasn't been run through JSRT end-to-end in a built binary. This is the unblock for large-tree perf.
- **No inspector yet** — planned, regenerate from love2d's `packages/core/src/CartridgeInspector.tsx` + `lua/inspector.lua` as reference. Don't port `tsz/carts/tools/Inspector*.tsz` (frozen, Smith-era).
- **Canvas/Graph viewport** — `viewX`/`viewY`/`viewZoom` on root tags are dropped silently. Needs `canvas.setCameraFor(...)` wiring at CREATE time in the host.
- **Cockpit is frozen** — `tsz/carts/cockpit/` still uses Smith. Port to `.tsx` when ready.
- **`runtime/index.ts` barrel export** — carts currently import from specific files (`../runtime/primitives`, `../runtime/classifier`, `../runtime/theme`). A barrel export would tidy that.

## When in doubt

Read `CLAUDE.md` for Claude-specific context. Read `love2d/CLAUDE.md` when touching love2d (though you shouldn't be modifying it). The per-directory `CLAUDE.md` files override or augment the root one inside their trees.
