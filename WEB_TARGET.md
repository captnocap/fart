# Web Target: Single .wasm Runtime

This document is the canonical reference for how ReactJIT ships to the web.
Three prior attempts went sideways because the goal was never written down.
This is it.

## The Goal

One `.wasm` file. Contains everything needed to run any `.tsz` app in a browser.

```
tsz-web.wasm (~8-12MB)
├── Zig framework    (layout, state, events, reconciler)
├── QuickJS          (JS runtime for <script> blocks)
├── FreeType         (glyph rasterization → texture atlas)
├── TinyEMU          (x86-32 CPU emulator, C, Bellard's)
└── Linux image      (minimal buildroot, @embedFile)
```

The browser provides two things: **WebGPU** for rendering, **DOM events** for input.
No CSS. No DOM rendering. No React. No web framework.

## Why This Architecture

The framework compiles `.tsz` → Zig → native binary. That pipeline does not change.
The web target is a cross-compilation target, not a rewrite.

```
.tsz → compiler → .zig → zig build -Dtarget=wasm32-emscripten → .wasm
```

The developer writes `.tsz`. The compiler emits Zig. The Zig compiles to wasm32.
Same source, same compiler, different build target. Like building for the Pi.

### Why TinyEMU is inside the .wasm

Not every cartridge will be compiled from `.tsz`. Third-party `.so` cartridges
compiled for x86-32 Linux need a way to run. TinyEMU boots a minimal Linux
guest inside the wasm and runs those binaries unmodified. It is the universal
fallback — anything that runs on x86 Linux runs in the browser.

For `.tsz` apps, TinyEMU is not involved. The compiled Zig code runs directly
as wasm. TinyEMU is only for pre-compiled native cartridges.

### Why not v86

v86 is the same idea (x86 emulator in the browser) but written in Rust + JS.
The JS dependency makes it impossible to link into a single .wasm.
TinyEMU is pure C (~15K lines), compiles with Zig's C compiler, links into
the same wasm binary as everything else. One toolchain. One output.

### Why not wgpu

wgpu-native is a Rust library. It is 64-bit only. It cannot compile to wasm32.
On native targets (desktop, Pi), wgpu is the GPU backend.
On web, the browser's WebGPU API replaces it via `webgpu.h` (emdawnwebgpu).
Same API shape, different linkage.

## The Two Rendering Paths

```
NATIVE (desktop, Pi, etc.)              WEB (browser)
──────────────────────────              ───────────────
.tsz → Zig → native binary             .tsz → Zig → wasm32
wgpu-native (Vulkan/Metal)             browser WebGPU (webgpu.h)
SDL3 (windowing + events)              Canvas + DOM events
FreeType (system library)              FreeType (compiled to wasm)
QuickJS (compiled to native)           QuickJS (compiled to wasm)
Layout engine (pure Zig)               Layout engine (pure Zig)
WGSL shaders                           WGSL shaders (same files)
```

Everything on the left compiles to wasm32 except wgpu-native, which gets
replaced by the browser's WebGPU API. The shaders, layout engine, and
application logic are identical.

## What Exists Today

Three working prototypes prove the core pieces:

| Build target       | File               | What it proves                        |
|--------------------|--------------------|---------------------------------------|
| `zig build wasm`   | `wasm_exports.zig` | Layout engine runs in wasm (pure Zig) |
| `zig build wasm-gpu` | `wasm_gpu.zig`   | Layout + WebGPU rect drawing          |
| `zig build wasm-rt`  | `wasm_runtime.zig` | QuickJS + layout + text/rects         |

Each has an HTML test harness (`wasm_test.html`, `wasm_gpu_test.html`,
`wasm_runtime_test.html`). The v86 CartridgeOS prototype lives at
`os/web/index.html` (boots real Linux, runs native binaries via VGA
framebuffer — functional but ~15fps, no GPU).

## The Gap

The prototypes use `extern "env"` JS shims for rendering:

```zig
extern "env" fn gpu_draw_rect(x: f32, y: f32, w: f32, h: f32, ...) void;
```

The JS side implements these with either Canvas2D or basic WebGPU. This works
but has per-draw-call overhead (every rect crosses the wasm→JS boundary).

The production path uses **emdawnwebgpu** — Emscripten's WebGPU bindings that
expose `webgpu.h` as C functions callable from inside wasm. GPU commands are
batched and submitted from within the wasm module. Only the final
`queue.submit()` crosses to JS. This is how native-speed GPU rendering works
in the browser.

## GPU Abstraction Layer

The framework's GPU code lives in `tsz/framework/gpu/`:

```
gpu.zig       — orchestrator (device, queue, surface, frame loop)
rects.zig     — SDF rounded rects with borders, rotation (4096/frame)
text.zig      — FreeType glyph atlas, textured quads (8192 glyphs/frame)
curves.zig    — SDF quadratic bezier strokes (4096/frame)
polys.zig     — triangle pipeline (4096/frame)
images.zig    — textured quads with per-image bind groups (16/frame)
shaders.zig   — all WGSL shaders (already browser-compatible)
3d.zig        — 3D pipeline
```

All 9 files import `const wgpu = @import("wgpu");`. The abstraction is a
conditional import at the top of a `backend.zig`:

```zig
const builtin = @import("builtin");
pub usingnamespace if (builtin.cpu.arch == .wasm32)
    @import("backend_web.zig")    // @cImport("webgpu/webgpu.h") via emdawnwebgpu
else
    @import("backend_native.zig") // @import("wgpu") via wgpu-native
;
```

The rendering code does not change. `wgpu.Device`, `wgpu.Queue`,
`wgpu.RenderPipeline`, `wgpu.Buffer` — all resolve to the same-shaped types
on both backends. WGSL shaders are identical.

### Platform-specific code points (~10 total)

| What                  | Native                          | Web                                    |
|-----------------------|---------------------------------|----------------------------------------|
| Surface creation      | SDL window → X11/Wayland handle | `emscripten_webgpu_get_device()`       |
| Adapter/device request| Synchronous                     | Async (`-sASYNCIFY`)                   |
| Main loop             | `while (SDL_PollEvent)` blocking| `emscripten_request_animation_frame_loop()` |
| Canvas resize         | `SDL_GetWindowSize`             | `emscripten_get_canvas_element_size()`  |
| Input events          | `SDL_PollEvent`                 | `emscripten_set_*_callback()`          |
| Clipboard             | `SDL_GetClipboardText`          | Clipboard API via JS                   |
| Font loading          | Fontconfig / filesystem         | `--preload-file fonts/` or fetch       |
| Buffer mapping        | Synchronous readback            | Async only (ASYNCIFY)                  |
| Backend selection     | Vulkan (`InstanceBackends`)     | N/A (browser picks)                    |
| Present/vsync         | `wgpuSurfacePresent()`          | Browser manages via rAF               |

## Build Pipeline

```bash
# Install Emscripten (one-time)
git clone https://github.com/emscripten-core/emsdk.git ~/creative/emsdk
cd ~/creative/emsdk && ./emsdk install latest && ./emsdk activate latest
source ~/creative/emsdk/emsdk_env.sh

# Build the web target
cd tsz
zig build web          # → zig-out/tsz-web.wasm + tsz-web.js

# Under the hood:
# 1. zig cc compiles all .zig + .c to wasm32-emscripten static lib
# 2. emcc links with: -sASYNCIFY --use-port=emdawnwebgpu -sUSE_FREETYPE=1
# 3. Linux image embedded via @embedFile("linux.img")
# 4. Output: .wasm + .js glue (thin: WebGPU init, DOM events, JIT trampoline)
```

## Component Map (what compiles to wasm32)

| Component     | Language | wasm32?  | Notes                                     |
|---------------|----------|----------|-------------------------------------------|
| Layout engine | Zig      | Yes      | Pure math. Already proven.                |
| QuickJS       | C        | Yes      | Already proven (`wasm-rt` target).        |
| FreeType      | C        | Yes      | Emscripten port. `-sUSE_FREETYPE=1`.     |
| TinyEMU       | C        | Yes      | Already targets wasm (powers JSLinux).    |
| GPU pipelines | Zig      | Yes      | Via `webgpu.h` instead of wgpu-native.   |
| WGSL shaders  | WGSL     | N/A      | Browser WebGPU runs them directly.        |
| SDL3          | C        | Replaced | Emscripten APIs for canvas/events.        |
| wgpu-native   | Rust     | No       | Replaced by browser WebGPU.              |
| LuaJIT        | C/ASM    | No       | JIT needs exec memory. Use PUC Lua or drop. |

## Delivery

The output of `zig build web` is two files:

```
tsz-web.wasm    (~8-12MB)   The runtime
tsz-web.js      (~5-10KB)   Glue: WebGPU init, DOM event forwarding, JIT trampoline
```

Plus an `index.html` that loads them. A `.tsz` app is either:
- **Compiled in**: the app's generated Zig is compiled into the wasm (static embed)
- **Loaded at runtime**: the wasm runtime loads a `.so` cartridge via TinyEMU

For the static embed case, `bin/tsz build --web app.tsz` produces a
self-contained `app.html` + `app.wasm` + `app.js` bundle. Same idea as the
native self-extracting binary, but for web.

## Browser Requirements

- **WebGPU**: Chrome 113+, Firefox 141+, Safari 26+ (~70% global coverage)
- **WebAssembly**: All modern browsers
- **No CSS, no DOM rendering**: The canvas is a `<canvas>` element. All pixels
  are painted by the Zig rendering pipeline via WebGPU. The browser is just a
  display surface and event source.

## What This Is NOT

- **Not a React-to-web pipeline.** We are not generating HTML/CSS/JS from .tsz.
- **Not a thin client.** The full app runs locally in the browser. No server.
- **Not v86 in a canvas.** v86 draws to VGA framebuffer at ~15fps. This uses
  real WebGPU at 60fps. TinyEMU is only for running pre-compiled x86 cartridges
  that weren't built from .tsz, and even then it does not handle rendering —
  rendering stays in the WebGPU pipeline.
- **Not a rewrite.** Same .tsz source, same compiler, same Zig output.
  Different build target. Like ARM vs x86 — the app doesn't know or care.

## Implementation Order

1. **GPU backend abstraction** — `backend.zig` conditional import, web backend
   wrapping `webgpu.h`. All 9 GPU files switch from `@import("wgpu")` to
   `@import("backend.zig")`. Native path unchanged.

2. **Engine web main** — `web_main.zig` replacing SDL event loop with
   Emscripten callbacks. Canvas resize, input forwarding, main loop via
   `requestAnimationFrame`.

3. **Build system** — `zig build web` target in `build.zig`. Conditional deps
   (no wgpu-native, no SDL3 on wasm32). Emcc link step with emdawnwebgpu.

4. **FreeType in wasm** — Font bundling via `--preload-file` or `@embedFile`.
   Glyph atlas pipeline unchanged (same FreeType API, same texture upload).

5. **TinyEMU integration** — `@cImport` TinyEMU headers, compile as part of
   the wasm build. Embed minimal buildroot Linux image. Wire cartridge loading:
   `.so` files get passed to TinyEMU guest, rendering commands come back
   through shared memory to the WebGPU pipeline.

6. **`bin/tsz build --web`** — CLI integration. `tsz build --web app.tsz`
   produces the web bundle. Same workflow as native builds.
