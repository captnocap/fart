# tsz/ — Native Stack

Zero-dependency native rendering. `.tsz` source → Zig compiler → SDL2 + wgpu + FreeType binary.
No Node, no npm, no Lua, no QuickJS. The entire toolchain is two binaries.

## .tsz Syntax

`.tsz` files look like React components but compile directly to native Zig:

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

## Capabilities

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

## Build Commands

All builds run from the **repo root** (where `build.zig` lives):

```bash
zig build tsz-compiler                         # Build the compiler
zig build tsz-compiler -Doptimize=ReleaseSmall # Optimized compiler
./zig-out/bin/tsz build app.tsz                # Compile .tsz → native binary
./zig-out/bin/tsz run app.tsz                  # Compile and run
zig build engine-app                           # Build from generated_app.zig directly
zig build engine-app -Doptimize=ReleaseSmall   # 65KB release binary
zig build engine                               # Build the standalone runtime
zig build run-engine                           # Build and run the runtime
```

## Directory Structure

```
compiler/         — The compiler (lexer, parser, codegen) in pure Zig
  main.zig        — Entry point, CLI (build/run/gui/tray)
  lexer.zig       — Tokenizer
  codegen.zig     — .tsz → Zig source emitter
  engine.zig      — Project manager, registry
  gui.zig         — SDL2 dashboard window
  tray.zig        — System tray (GTK3 + libayatana)
  runner.zig      — Process lifecycle
  registry.zig    — Project registry
  actions.zig     — CLI actions
  process.zig     — Process management
  tailwind.zig    — Tailwind-style class support

runtime/          — The rendering engine (layout, text, painter, events)
  main.zig        — Runtime entry point
  generated_app.zig — Compiler output (the compiled .tsz app)
  layout.zig      — Flexbox engine (ported from love2d/lua/layout.lua)
  text.zig        — FreeType glyph rasterizer + cache
  image.zig       — stb_image loader + SDL texture cache
  events.zig      — Hit testing + scroll container detection
  input.zig       — TextInput handling
  state.zig       — Reactive state slots
  windows.zig     — Multi-window manager
  watchdog.zig    — RSS leak guard
  bsod.zig        — Crash screen
  breakpoint.zig  — Debug breakpoints
  mpv.zig         — libmpv video playback
  c.zig           — Shared @cImport (SDL2, GL, FreeType)
  leaktest.zig    — Memory leak testing
  ffi_libs.txt    — Extra libraries for FFI (written by compiler)

examples/         — .tsz demo apps
```

## Relationship to Love2D Stack

The runtime is a **battle-tested port** of the Love2D Lua layout engine (`love2d/lua/layout.lua` → `runtime/layout.zig`). Same flex algorithm, same sizing tiers, same edge cases. When debugging layout, the Lua version is the reference implementation. Fixes and learnings flow both directions.

## Language

Everything is Zig. There is no TypeScript, no Lua, no JavaScript anywhere in this stack. The `.tsz` syntax *looks* like TSX but compiles to Zig structs — React doesn't exist here.

## System Dependencies

SDL2 (windowing/events only), wgpu-native (GPU rendering via Vulkan/Metal/DX12), FreeType, libmpv (optional, for video). GTK3 + libayatana-appindicator3 (for system tray). OpenGL is no longer used.
