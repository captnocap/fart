# Clippy — AI Desktop Pet: Mega Plan

## What Was Built (Session 2026-04-09, Day 60)

### Working Proof of Concept
A `.tsz` cart (`tsz/carts/clippy/clippy.tsz`) that:
- Loads Qwen3.5-4B-Q4_K_M.gguf (2.6GB) via llama.cpp C API
- Uses LuaJIT FFI (`ffi.C`) to call llama.cpp symbols statically linked into the engine binary
- Generates text one token per frame (frame-distributed inference)
- Renders a pixel-block face with model-controlled expressions (eyes + mouth)
- Streams text into a speech bubble
- Runs on Vulkan GPU (7900 XTX) at 240fps while generating

### What's In The Binary
llama.cpp + ggml + Vulkan compute shaders are compiled from source via Zig's build system and statically linked into `libreactjit-core.so`. The engine went from 20MB → 109MB .so (37MB → 43MB packaged cart). Every cart now has LLM inference available via `ffi.C`.

### Build Integration
- **Dependency**: `deps/llama.cpp.zig` (local clone of github.com/diogok/llama.cpp.zig)
- **Patched**: `deps/llama.cpp.zig/ggml/build.zig` — disabled advanced shader extensions (bf16, integer dot, coopmat) because system glslc (2024.4) is too old. Uses system `/usr/bin/glslc` instead of building shaderc from source.
- **Linked in**: `tsz/build.zig` → `addCoreLib()` and `addAppExe()` both pull in `llama_cpp_zig` with `.backend = .vulkan`
- **Symbol export**: `tsz/framework/llama_exports.zig` — force-exports llama.cpp symbols so LuaJIT `ffi.C` can find them at runtime. Referenced via `comptime { _ = @import("llama_exports.zig"); }` in `core.zig`
- **Vulkan loader**: `lib.linkSystemLibrary("vulkan")` added to both addCoreLib and addAppExe

### NOTE: Other Session Modified core.zig
The other Claude session (e06e) removed the `comptime` import of `llama_exports.zig` from `core.zig` and added a comment about "separate libllama_ffi.so". This needs to be reconciled. The approach that WORKS is having the symbols in the main engine .so via the comptime import. If the other session split it out, check if their approach also works.

## Current State of the Cart

### What Works
- Model loads onto Vulkan GPU (490MB compute buffer on Vulkan0)
- Flash Attention auto-enabled
- Streaming token generation (frame-distributed)
- Face renders with computed eye/mouth properties (blue eyes idle, amber thinking, red mouth talking)
- Speech bubble shows generated text
- "Wake Up" button triggers model init via `lua_on_press`
- `<think>` tag stripping for Qwen3.5 reasoning output
- 240fps maintained during generation
- `<lscript>` blocks compile correctly into LUA_LOGIC (fixed by session e06e during this session)

### What's Broken / Not Done
1. **480 zero-size nodes** — some Box elements render at 0x0. Check with `-n` flag. May be related to string state values not mapping to layout correctly.
2. **Face sizing** — the eyes and mouth render but may need tuning. The computed values (eyeW, eyeH, etc.) are integer state slots. Colors are string state slots (hex strings). Verify they reach the layout engine correctly.
3. **No blinking when idle** — the blink timer logic is in Lua but may not be triggering `__markDirty` / re-render. The face only updates when state changes.
4. **Quip timer** — set to 8 seconds. After first generation, should auto-generate new quips on a timer. Verify this works.
5. **No think tag suppression in system prompt** — Qwen3.5 still generates `<think>` blocks, we strip them in post. Could add "/no_think" to system prompt.

## Architecture

### How Inference Works in the Cart
```
clippy.tsz <lscript> block:
  ├── ffi.cdef[[ ... ]]          — declare llama.cpp C types
  ├── lib = ffi.C                — access symbols from the binary itself
  ├── lib.llama_backend_init()   — init (runs at lscript load time)
  ├── clippy_init()              — called on first tick after Wake Up button
  │   ├── llama_model_load_from_file(MODEL_PATH, params)
  │   ├── llama_init_from_model(model, ctx_params)
  │   └── sets loaded = true
  ├── __zigOS_tick()             — called every frame by luajit_runtime.zig
  │   ├── blink logic (timer-based eye state changes)
  │   ├── quip timer (auto-generates after QUIP_INTERVAL seconds)
  │   └── if gen_state == GEN_TOKENS: decode one token
  ├── start_quip()               — picks random prompt, prefills, sets up sampler
  └── clippy_tick()              — the per-frame token generation
      ├── llama_sampler_sample() → get one token
      ├── detokenize → append to output
      ├── update mouth state (flicker between open/talking)
      ├── every 4 tokens: update speech bubble with partial text
      └── on EOG or max tokens: finalize, set idle state
```

### Key Files
- `tsz/carts/clippy/clippy.tsz` — the cart (single file, ~500 lines)
- `tsz/framework/llama_exports.zig` — force-export shim for llama symbols
- `tsz/framework/core.zig` — imports llama_exports (CHECK: may have been modified by other session)
- `tsz/build.zig` — llama.cpp dependency in addCoreLib() and addAppExe()
- `tsz/build.zig.zon` — llama_cpp_zig dependency (local path to ../deps/llama.cpp.zig)
- `deps/llama.cpp.zig/` — local clone with patched ggml/build.zig
- `experiments/clippy/clippy.lua` — original terminal POC (still works, separate from tsz cart)
- `experiments/clippy/lib/` — old Vulkan .so files from failed cmake build (can delete)

### Model Location
`/home/siah/.lmstudio/models/lmstudio-community/Qwen3.5-4B-GGUF/Qwen3.5-4B-Q4_K_M.gguf`

### GPU Setup
- NVIDIA RTX 3060 (12GB) — GPU index 0 via nvidia-smi, available for CUDA inference
- AMD Radeon RX 7900 XTX — primary display GPU, Vulkan inference currently runs here
- Both GPUs are usable. `main_gpu` in model params controls which one. Currently defaults to 0 (which Vulkan sees as the 7900 XTX since it's the Vulkan device).

## Next Steps (Priority Order)

### 1. Fix Face Rendering
- Build with `-n` flag to see actual node sizes
- The 480 zero-size nodes suggest layout is computing 0 for some dimension
- Check if string color states ("#3b82f6") reach the Lua node builder correctly
- The computed values (eyeW=28, eyeH=28, etc.) are integer state slots — verify they appear in the node tree
- If colors don't work as hex strings, switch to integer hex (0x3b82f6)

### 2. Expression System — Model-Controlled Face
The current face is controlled by Lua logic (blink timer, generation state). The next step is letting the MODEL control expressions via tool calling:

```lua
-- Model generates this in its output:
-- <face eyes="narrowed" mouth="smirk" blush="true" />

-- Parse tool calls from model output, apply to face state
function applyFaceCommand(eyes, mouth, extras)
  setEyeState(eyes)
  setMouthState(mouth)
  -- extras: blush overlay, sweat drops, sparkles, etc.
end
```

Qwen3.5 is excellent at tool calling. Define a JSON schema for face control, inject it into the system prompt, parse structured output during generation.

### 3. Clipboard Watching
On X11 (user's display server):
- Poll `xclip -o -selection clipboard` or use X11 `XGetSelectionOwner`
- On change: feed new text to model as context
- Model decides what to do (translate, summarize, explain, search)
- Render response inline

Implementation: add a host function `getClipboard()` exposed to Lua via luajit_runtime.zig, or just shell out via `io.popen("xclip -o")` from Lua.

### 4. Global Hotkey
X11 `XGrabKey` to register a system-wide keybind (e.g., Super+C) that:
- Activates clippy
- Passes current clipboard to model
- Shows response panel near cursor

### 5. Transparent Always-On-Top Window
SDL3 supports:
- `SDL_WINDOW_TRANSPARENT` — per-pixel alpha
- `SDL_WINDOW_ALWAYS_ON_TOP` — stays above other windows
- `SDL_SetWindowPosition` — absolute positioning (works on X11)

This turns clippy from a fullscreen cart to a floating desktop widget. Needs framework changes to support transparent/overlay window modes.

### 6. Tool Calling / Capabilities
Expose host functions to the QJS sandbox that clippy can call:
```javascript
fs.readFile(path)        // filesystem access
fs.writeFile(path, data)
fs.listDir(path)
shell.exec(cmd)          // shell commands
http.get(url)            // web requests (curl is already linked)
sqlite.query(sql)        // persistent memory
clipboard.read()         // clipboard
clipboard.write(text)
```

The model generates JS code in `<tool>` tags, it runs in QJS, results feed back to the model.

### 7. Web Fetching (elinks-style)
- curl is already linked into the engine
- Expose `http_get(url)` to Lua/QJS
- Port the HTML parser from `love2d/examples/browser/` to run in QJS
- Strip JS, extract text/links/images
- Model gets clean content, renders inline

### 8. Persistent Memory via SQLite
- sqlite3 is already linked
- Create a `clippy.db` with tables for: conversations, memories, user preferences
- Model can query its own memory: "what did the user ask me about yesterday?"
- Personality evolves over time based on interactions

### 9. Multi-Window / Glass Tiles
Model can spawn additional transparent windows:
```lua
-- Model requests a new surface
spawnWindow({ id="note", x=200, y=50, w=300, h=150, opacity=0.8 })
-- Render content into it
renderToWindow("note", { ... node tree ... })
-- Close it
closeWindow("note")
```
SDL3 multi-window API. Each window is independent. Model controls the window manager.

### 10. Bake Model Into Binary
`@embedFile("path/to/model.gguf")` in Zig. The GGUF becomes a const slice in .rodata. At runtime, use `llama_model_load_from_buffer` (if available) or write to a tmpfile and load. Binary goes from 43MB to ~2.6GB. True single-file AI.

## Bigger Picture (The Next 30 Days)

### Product Tiers (same stack, different entry points)
1. **Clippy Widget** — floating desktop pet, single binary, local model. SHIP FIRST.
2. **AI-in-a-Binary Build Tool** — pick HF model, define persona, configure capabilities, build → sovereign binary
3. **CartridgeOS** — window manager with baked-in AI as the shell (reference: engAIge at ~/creative/engaige)
4. **Dreaming OS** — when idle, model creates experimental carts in /dreams (Gemini's idea)
5. **Bare Metal Boot** — UEFI → Zig kernel → ReactJIT → model on the machine

### NFT/Distribution Angle
Tomagotchi-style desktop pets. Each one unique (different GGUF + persona + memory). Neural Pepe aesthetic. NFT is activation key, value is the creature. Organic distribution only.

### Dual GPU Architecture
- 3060 (12GB) runs inference via CUDA (needs CUDA build, or keep Vulkan)
- 7900 XTX runs display rendering via wgpu
- Zero contention between thinking and drawing

### Key Assets Already Built
- `~/creative/engaige` — full fake OS UI (desktop, windows, browser, apps, boot screen, games). React+Tauri. UI prototype for CartridgeOS.
- `~/creative/claudeshome` — AI-in-a-box with panels, persistence, shell access, sqlite memory, self-motivation loop (the "Ralph" component). Love2D.
- `love2d/experiments/llm/` — original LuaJIT FFI llama.cpp wrapper (700 lines). Reference for the API.
- `love2d/examples/browser/` — elinks-style HTML browser. Has HTML parser, proxy, rendering.

## Build Commands

```bash
# Rebuild engine with llama.cpp (one-time, ~2 min)
cd tsz
zig build core-so -Doptimize=ReleaseFast

# Build clippy cart (fast, ~200ms)
./scripts/build carts/clippy/clippy.tsz

# Run
./zig-out/bin/clippy

# Debug layout
./scripts/build carts/clippy/clippy.tsz -n

# Run the original terminal POC (no tsz needed)
experiments/clippy/run.sh
```

## Technical Decisions Made

1. **Static linking over dynamic** — llama.cpp compiled from source into the engine, no .so loading at runtime
2. **Vulkan over CUDA/ROCm** — works on both GPUs without vendor-specific toolchains
3. **Frame-distributed inference** — one token per frame, no threading needed at GPU speeds
4. **ffi.C over ffi.load** — symbols are in the binary, no library path management
5. **`<lscript>` over `<script>`** — Lua has direct FFI access, JS would need an extra bridge
6. **Pre-computed face state** — avoid chained ternaries in JSX (compiler can't handle them), compute in Lua and push integer/string slots
7. **System glslc** — disabled advanced Vulkan extensions (bf16, coopmat, integer_dot) that need newer glslc. Basic Vulkan compute is plenty for inference.

## Known Issues / Gotchas

1. **core.zig may have been modified by other session** — check if `comptime { _ = @import("llama_exports.zig"); }` is still there. Without it, llama symbols get dropped from the .so.
2. **Chained ternaries in .tsz JSX don't compile** — the Smith compiler collapses `a === 'x' ? 1 : a === 'y' ? 2 : 3` to just `a`. Use computed state values instead.
3. **lscript `ffi.cdef` braces get mangled** — the compiler replaces `}` with `end` inside C declarations. The other session (e06e) fixed this during this session.
4. **`n_gpu_layers = 99`** — offloads everything to GPU. If VRAM is insufficient, lower this.
5. **Model path is hardcoded** — `/home/siah/.lmstudio/models/...`. Should be configurable via env var `CLIPPY_MODEL`.
6. **Advanced Vulkan shaders disabled** — bf16, coopmat, integer_dot extensions are commented out in `deps/llama.cpp.zig/ggml/build.zig`. Updating system glslc would re-enable them for better performance.
