# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Who Maintains This

**You do.** Bugs are from other versions of yourself in parallel instances. If a bug from another Claude is blocking you, fix it — it is your code. All of it.

**Committing:** If you commit on your own, only commit your own work. If prompted to commit, commit everything unaccounted for.

## What This Is

ReactJIT is a rendering framework with **two stacks** that share the same layout engine and primitives:

### Stack 1: Love2D (legacy, full-featured)
React reconciler → QuickJS bridge → Lua layout engine → Love2D painter (OpenGL 2.1). Entry: `love .`. Full storybook, CLI, packages, HMR, test runner. This is the mature stack with every feature.

### Stack 2: Native Engine (new, zero-dependency)
`.tsz` source → Zig compiler → SDL2 + FreeType + OpenGL. Entry: `tsz build app.tsz`. No Node, no npm, no Lua, no QuickJS. The entire toolchain is two binaries totaling 160KB.

**The native engine is where the energy is.** New capabilities (FFI, multi-window, video, watchdog) land here first. The Love2D stack is maintained but not where innovation happens.

## .tsz — The Native Path

`.tsz` files look like React components but compile directly to native Zig binaries:

```tsx
// @ffi <time.h>
declare function time(t: pointer): number;

function App() {
  const [ts, setTs] = useState(0);
  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={24} color="#ffffff">{`Time: ${ts}`}</Text>
      <Pressable onPress={() => setTs(time(0))} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">Get Time</Text>
      </Pressable>
    </Box>
  );
}
```

Build: `tsz build app.tsz` → 65KB native binary.

### .tsz capabilities
- **Primitives:** Box, Text, Image, Pressable, ScrollView, TextInput, Window
- **State:** `useState(initial)` → compile-time state slots, reactive re-render
- **Events:** `onPress` handlers with hit testing and hover feedback
- **FFI:** `// @ffi <header.h> -llib` + `declare function` → `@cImport` any C library
- **Multi-window:** `<Window title="X">` → same-process SDL2 windows, shared state, no IPC
- **Video:** `playVideo("path")` → native libmpv integration
- **Images:** `<Image src="photo.png" />` → stb_image decode + SDL texture cache
- **Scroll:** `<ScrollView>` → overflow clipping + mouse wheel
- **Watchdog:** 512MB hard limit + 50MB/s leak detection → BSOD crash screen
- **Component composition:** multi-file imports, prop substitution, children forwarding

### .tsz build commands
```bash
zig build tsz-compiler                    # Build the native compiler (95KB)
zig build tsz-compiler -Doptimize=ReleaseSmall  # Optimized (95KB)
./zig-out/bin/tsz build app.tsz           # Compile .tsz → native binary
./zig-out/bin/tsz run app.tsz             # Compile and run
zig build engine-app                      # Build from generated_app.zig directly
zig build engine-app -Doptimize=ReleaseSmall     # 65KB release binary
```

### .tsz architecture
```
native/tsz/          — The compiler (lexer, parser, codegen) in pure Zig
native/engine/        — The runtime (layout, text, painter, events, images, state, etc.)
  layout.zig          — Flexbox engine (ported from lua/layout.lua)
  text.zig            — FreeType glyph rasterizer + cache
  image.zig           — stb_image loader + SDL texture cache
  events.zig          — Hit testing + scroll container detection
  state.zig           — Reactive state slots
  windows.zig         — Multi-window manager
  watchdog.zig        — RSS leak guard
  bsod.zig            — Crash screen
  mpv.zig             — libmpv video playback
  c.zig               — Shared @cImport (SDL2, GL, FreeType)
examples/hello-tsz/   — .tsz demo apps (counter, ffi, mpv, multi-window, leak-test)
```

## The Primitives (shared across both stacks)

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`

Everything is composed from these. A dashboard is Boxes and Text. There are no special node types.

## Layout Rules (apply to BOTH stacks)

The flex layout engine is pixel-perfect and shared between Lua and Zig.

### Sizing tiers (first match wins)
1. **Explicit dimensions** — `width`, `height`, `flexGrow`, `flexBasis`
2. **Content auto-sizing** — containers shrink-wrap children, text measures from font metrics
3. **Proportional fallback** — empty surfaces get 1/4 of parent (cascades)

### Rules that still cause bugs
- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling elements, never hardcoded pixel heights
- ScrollView needs explicit height (excluded from proportional fallback)
- Don't mix text and expressions in `<Text>` — use template literals

### Layout anti-patterns
- Hardcoding pixel heights to fit a known window size → use `flexGrow: 1`
- Manual pixel budgeting → let flex handle distribution
- Fixed dimensions where auto-sizing works → let containers shrink-wrap

## One-Liner Design Philosophy

Every capability should be usable in one line by someone who doesn't code. The target user knows their domain (music, art, data, games) but doesn't know internals. An AI should be able to discover and control it without documentation.

## Model Selection

**Always use Opus 4.6 (`claude-opus-4-6`) for debugging.** Sonnet is fine for scaffolding and routine tasks. When tracking down layout bugs, coordinate mismatches, or anything structural — use Opus.

## Git Discipline (CRITICAL)

**Commit early and often. Do not leave work uncommitted.**

### When to commit
- After completing each logical unit of work
- Before risky operations (refactoring core files, changing build pipeline)
- When you've touched 3+ files
- At natural breakpoints in multi-step work
- When the human gives positive feedback ("nice", "cool", "ok", thumbs up) — that IS the approval signal
- When in doubt, commit

### How to commit
- Descriptive conventional-commit messages: `feat(tsz): add FFI support`
- One logical change per commit
- Never leave a session with uncommitted work

### Parallel sessions ("empty fridge" problem)
Multiple Claude instances work simultaneously. If `git status` is unexpectedly clean:
1. Run `git log --oneline -5` ONCE
2. Another you committed it. Move on.
3. Do NOT loop on `git status`

## Love2D Stack (legacy — still maintained)

### CLI Workflow
```bash
rjit dev          # Watch + HMR
rjit build        # Dev build
rjit build linux  # Production binary
rjit lint         # Static linter
rjit test <spec>  # Test runner (inside Love2D process)
```

### Source-of-Truth Architecture
- Edit `lua/` and `packages/` (source of truth)
- Run `make cli-setup` → `cli/runtime/`
- Run `reactjit update` in each project → local copies
- The storybook reads source directly via symlinks — never copy into it

### React's Role (Love2D stack only)
In the Love2D stack, React is a layout declaration engine. It declares geometry and diffs the tree. Input, state, and compute run in Lua via hooks like `useLuaEffect`, `useHotState`, `useLoveEvent`. `useEffect` is banned (linter enforces it).

In the native .tsz stack, React doesn't exist. Components compile directly to Zig structs.

### Key rules for Love2D stack
- `useEffect` is banned — use `useLuaEffect`, `useMount`, `useLuaInterval`
- The scissor rule: use `intersectScissor` with `transformPoint`, never raw `setScissor`
- Box event handlers use explicit whitelist in `primitives.tsx`
- .tslx compiles to Lua capabilities (the Love2D equivalent of .tsz)

## Monorepo Structure

npm workspaces. Path aliases (`@reactjit/*`) in `tsconfig.base.json`.

| Package | Role |
|---------|------|
| `packages/core` | Primitives, hooks, animation, types |
| `packages/renderer` | react-reconciler host config, instance tree, events |
| `packages/3d` | 3D scene, lighting |
| `packages/audio` | Audio playback, synth |
| `packages/ai` | LLM integration |
| Other packages | Domain-specific (storage, router, theme, etc.) |

**Lua runtime** (`lua/`): Layout engine, painter, bridge, tree, events, measure, videos, BSOD.

**Storybook** (`storybook/`): IS the framework. Every user-facing feature gets a story.

**Native engine** (`native/engine/`): Zig runtime. Layout, text, images, events, state, windows, watchdog, BSOD, mpv.

**Native compiler** (`native/tsz/`): Zig compiler. Lexer, parser, codegen. Reads .tsz, emits Zig, invokes `zig build`.

## Input Pattern

**TextInput is a normal input.** Use `onChangeText` for state updates and `onSubmit` for submission. See `examples/hot-code/src/App.tsx` for the Love2D pattern.

## Documentation Workflow

Documentation is a completion criterion. After major features:
1. Emit a CHANGESET brief (what, why, affects, breaking changes, new APIs)
2. Update affected docs
3. Commit code + docs together
