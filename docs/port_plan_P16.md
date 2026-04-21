# EQJS Cart Port Plan

Scope note: this plan is for a new `eqjs_cart_app.zig` host that keeps the current windowed/cart-host shape, but swaps the QJS execution path for the LuaJIT/EQJS path. The source facts below come from `/home/siah/creative/reactjit/qjs_app.zig`, `/home/siah/creative/reactjit/framework/qjs_runtime.zig`, `/home/siah/creative/reactjit/framework/luajit_runtime.zig`, `/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua`, and `/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua`.

## 0. Inventory

### QJS-specific surface in `qjs_app.zig`

| QJS symbol or family | `qjs_app.zig` evidence | LuaJIT / EQJS equivalent | LuaJIT evidence |
|---|---|---|---|
| `qjs_runtime` import and all VM lifecycle calls | Import at `24`; event wrappers at `156-158` and `201-203`; effect bridge at `1017-1030`; dev reload at `1696-1703`; host registration at `1760-1761`; tick call at `1792` | `luajit_runtime` import plus `initVM`, `deinit`, `evalScript`, `evalExpr`, `callGlobal*`, `hasGlobal`, `registerHostFn`, `setEffectRender`, `setEffectShader`, `tick` | `luajit_runtime.zig:26`, `34-41`, `1125-1194`, `1205-1315` |
| `qjs_bindings.tickDrain` | `1786` | No direct equivalent in `luajit_runtime`; if async hook draining remains required it needs a new Lua-side bridge or it must move into the boot runtime | `luajit_runtime.zig:1315` only exposes frame tick, not a drain queue |
| QuickJS C bridge: `@cImport`, `quickjs.h`, `qjs.JSContext`, `qjs.JSValue`, `QJS_UNDEFINED`, `JS_ToCString`, `JS_NewString*`, `JS_FreeCString` | `31-40`, `1271-1314` | Lua C API through `luajit_runtime.lua` or the `zluajit` wrapper | `luajit_runtime.zig:44-47`, `65-67`, `92-129`, `1125-1194` |
| QJS bundle naming and disk hot reload (`bundle-{app-name}.js`, `bundle.js`) | `35-39`, `72-84`, `1598-1605`, `1671-1677`, `1820-1839` | EQJS boot runtime plus compiled boot bundle (`cursor_ide_boot_runtime.lua`, `boot_bundle.lua`) | `cursor_ide_eqjs_app.zig:60-114`, `eqjs_app.zig:248-409`, `cursor_ide_boot_runtime.lua:671`, `806`, `2150-2156`, `boot_bundle.lua:1-6`, `213133` |
| `__beginJsEvent` / `__endJsEvent` / `__dispatchEvent` string contract | `4-5`, `65-66`, `156-158`, `201-203`, `1039`, `1075-1088`, `1792` | Engine already understands `lua_on_press`, `lua_on_mouse_down`, `lua_on_mouse_up`, `lua_on_hover_enter`, `lua_on_hover_exit` | `framework/engine.zig:2182-2230`, `2292-2323`; `framework/layout.zig:503`; `framework/events.zig:21-35` |
| `qjs_runtime.dispatchEffectRender` | `1017-1030` | Use `luajit_runtime.setEffectRender` / `setEffectShader` and let `engine.zig` call the render fn pointer directly; there is no direct LuaJIT dispatcher | `luajit_runtime.zig:27-41`, `890-897`; `framework/engine.zig:1317-1318` |
| `qjs_runtime.registerHostFn` | `1760-1761` | `luajit_runtime.registerHostFn` | `luajit_runtime.zig:1185-1194` |
| `qjs_runtime.callGlobal`, `callGlobalInt`, `callGlobal3Int`, `hasGlobal` | `156-163`, `201-206`, `1792` | `luajit_runtime.callGlobal`, `callGlobalStr`, `callGlobalInt`, `callGlobal3Int`, `hasGlobal` | `luajit_runtime.zig:1237-1312` |
| `qjs_runtime.initVM`, `teardownVM`, `evalScript` | `1696-1703`, `1842-1846` | `luajit_runtime.initVM`, `deinit`, `evalScript` | `luajit_runtime.zig:1125-1201`, `1205-1219` |
| `qjs_runtime.callGlobalInt("__jsTick", ...)` | `1792` | Remove it; the Lua path is driven by `luajit_runtime.tick()` and the boot runtime bootstrap | `luajit_runtime.zig:1315-1337` |
| `host_flush` and `host_get_input_text_for_node` QuickJS ABI signatures | `1268-1314` | Rewrite as LuaJIT C-ABI callbacks that use `lua_State` and register via `luajit_runtime.registerHostFn` | `luajit_runtime.zig:65-129`, `1187-1194` |

### Framework imports and structure that transfer unchanged

| Keep as-is | Reason | Evidence |
|---|---|---|
| `std`, `build_options`, `layout`, `effect_ctx`, `input`, `state`, `events`, `engine`, `fs_mod`, `localstore`, `dev_ipc`, `IS_LIB` guard, `WINDOW_TITLE`, `BORDERLESS_MODE`, dev tab machinery, `g_pending_flush`, `g_tabs`, `g_root`, input slot bookkeeping | These are host/layout/state concerns, not QuickJS-specific | `qjs_app.zig:11-29`, `51-104`, `107-125`, `153-294`, `1390-1848` |
| `luajit_runtime` | This is the EQJS runtime surface and is the target substitution | `qjs_app.zig:26`; `luajit_runtime.zig:1125-1315` |
| `engine.run` | The main window loop already accepts both `js_logic` and `lua_logic` and initializes LuaJIT in the shared engine path | `framework/engine.zig:1932-1962`, `1996-2006`, `2747-2755` |

### Build wiring changes needed

| File | Current lines | Required change |
|---|---|---|
| `/home/siah/creative/reactjit/build.zig` | `16-19`, `47-63`, `75-131`, `160-163` | Add an EQJS build flag or derive backend from `app-source`, set `has_quickjs` false for `eqjs_cart_app.zig`, skip QuickJS C sources in that case, and set `exe.strip = true` |
| `/home/siah/creative/reactjit/scripts/ship-eqjs-cart` | new file | Add a ReleaseFast-only launch script for the new cart host |

## 1. Preconditions (read-only verifications)

- `test -f /home/siah/creative/reactjit/qjs_app.zig && test -f /home/siah/creative/reactjit/framework/qjs_runtime.zig && test -f /home/siah/creative/reactjit/framework/luajit_runtime.zig && test -f /home/siah/creative/reactjit/build.zig`
  - Expected: exit code `0`
- `test -f /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua && test -f /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua`
  - Expected: exit code `0`
- `test -f /home/siah/creative/reactjit/eqjs_app.zig && test -f /home/siah/creative/reactjit/cursor_ide_eqjs_app.zig`
  - Expected: exit code `0`
- `rg -n "pub fn (initVM|deinit|evalScript|evalExpr|callGlobal|callGlobalStr|callGlobalInt|callGlobal3Int|hasGlobal|registerHostFn|setGlobalInt|setEffectRender|setEffectShader|tick)" /home/siah/creative/reactjit/framework/luajit_runtime.zig`
  - Expected: line hits for every listed symbol
- `rg -n "pub fn (initVM|teardownVM|registerHostFn|evalScript|callGlobal|callGlobalStr|callGlobalInt|callGlobal3Int|hasGlobal|dispatchEffectRender|tick)" /home/siah/creative/reactjit/framework/qjs_runtime.zig /home/siah/creative/reactjit/framework/qjs_bindings.zig`
  - Expected: line hits for QJS APIs and `tickDrain`
- `command -v strip && command -v file`
  - Expected: two absolute paths printed
- If any precondition fails, stop and treat the plan as blocked.

## 2. Step-by-step port

### 2.1 Skeleton

#### Step 2.1.1 — Create the new EQJS cart host file
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: new file
Action: Copy `/home/siah/creative/reactjit/qjs_app.zig` wholesale to the new path so the line layout stays stable for later replacements.
Rationale: the fastest safe port is a mechanical clone first, then line-by-line substitutions.
Verify: `test -f /home/siah/creative/reactjit/eqjs_cart_app.zig && wc -l /home/siah/creative/reactjit/eqjs_cart_app.zig` should print a line count close to `1855`.

#### Step 2.1.2 — Replace the import block and bundle constants
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `15-40`
Action: replace the entire import / QuickJS / JS-bundle block with an EQJS bootstrap block.
BEFORE:
```zig
const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const effect_ctx = @import("framework/effect_ctx.zig");
const input = @import("framework/input.zig");
const state = @import("framework/state.zig");
const events = @import("framework/events.zig");
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
const qjs_runtime = @import("framework/qjs_runtime.zig");
const qjs_bindings = @import("framework/qjs_bindings.zig");
const luajit_runtime = @import("framework/luajit_runtime.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

const qjs = @cImport({
    @cInclude("quickjs.h");
});

const BUNDLE_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.js", .{build_options.app_name});
const BUNDLE_BYTES = @embedFile(BUNDLE_FILE_NAME);
const QJS_UNDEFINED: qjs.JSValue = .{ .u = .{ .int32 = 0 }, .tag = 3 };
```
AFTER:
```zig
const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const effect_ctx = @import("framework/effect_ctx.zig");
const input = @import("framework/input.zig");
const state = @import("framework/state.zig");
const events = @import("framework/events.zig");
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
const luajit_runtime = @import("framework/luajit_runtime.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

const BOOT_RUNTIME_FILE = "../../eqjs/compiler/cursor_ide_boot_runtime.lua";
const BOOT_BUNDLE_FILE = "../../eqjs/generated/cursor-ide-boot/boot_bundle.lua";
const BOOT_RUNTIME_BYTES = @embedFile(BOOT_RUNTIME_FILE);
const BOOT_BUNDLE_BYTES = @embedFile(BOOT_BUNDLE_FILE);
```
Rationale: the new host must not compile or name any QuickJS artifacts.
Verify: `rg -n "qjs_runtime|qjs_bindings|quickjs.h|QJS_UNDEFINED|BUNDLE_FILE_NAME|BUNDLE_BYTES" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches; `rg -n "BOOT_RUNTIME_FILE|BOOT_BUNDLE_FILE|BOOT_RUNTIME_BYTES|BOOT_BUNDLE_BYTES" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return matches.

#### Step 2.1.3 — Keep the shared globals, but reword the runtime comments
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `51-104`
Action: keep the tree, input-slot, tab, and reload globals exactly as they are, but rewrite the surrounding comments so they say `EQJS` / `LuaJIT` instead of `QJS` / `QuickJS`.
Rationale: this preserves the host-state shape while making the file self-consistent for the EQJS backend.
Verify: `rg -n "QuickJS|QJS" /home/siah/creative/reactjit/eqjs_cart_app.zig` should only show historical references that were intentionally left in comments for later removal, or ideally no matches.

### 2.2 Runtime swap

#### Step 2.2.1 — Replace the QJS event wrappers with LuaJIT wrappers
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `153-206`
Action: replace the `__beginJsEvent` / `__endJsEvent` wrapped event helpers with LuaJIT calls only.
BEFORE:
```zig
fn dispatchInputEvent(slot: u8, global_name: [*:0]const u8) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobalInt(global_name, @intCast(node_id));
    qjs_runtime.callGlobal("__endJsEvent");
    if (luajit_runtime.hasGlobal(global_name)) {
        luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    }
}
...
fn dispatchInputKeyEvent(slot: u8, key: c_int, mods: u16) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    qjs_runtime.callGlobal("__endJsEvent");
    if (luajit_runtime.hasGlobal("__dispatchInputKey")) {
        luajit_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    }
}
```
AFTER:
```zig
fn dispatchInputEvent(slot: u8, global_name: [*:0]const u8) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    if (luajit_runtime.hasGlobal(global_name)) {
        luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    }
}

fn dispatchInputKeyEvent(slot: u8, key: c_int, mods: u16) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    if (luajit_runtime.hasGlobal("__dispatchInputKey")) {
        luajit_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    }
}
```
Rationale: the EQJS cart should execute event code in the Lua VM, without the JS event-framing globals.
Verify: `rg -n "qjs_runtime.callGlobal\\(\"__beginJsEvent\"|qjs_runtime.callGlobal\\(\"__endJsEvent\"|qjs_runtime.callGlobal3Int|qjs_runtime.callGlobalInt" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches.

#### Step 2.2.2 — Replace the effect shim and handler wiring
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1008-1110`
Action: remove `qjs_runtime.dispatchEffectRender(...)`, remove `qjs_runtime.dispatchPreparedScroll`, and remove `qjs_runtime.dispatchPreparedRightClick`.
Use `luajit_runtime.setEffectRender` / `setEffectShader` for effect registration if the runtime exposes a concrete effect callback; otherwise keep the gate as `noop_effect_render` and explicitly document the blocker.
For event props, use the Lua-side handler fields the engine already understands: `lua_on_press`, `lua_on_mouse_down`, `lua_on_mouse_up`, `lua_on_hover_enter`, and `lua_on_hover_exit`.
For scroll and right-click, add local Zig callbacks that call `luajit_runtime.callGlobalInt("__dispatchScroll", ...)` and `luajit_runtime.callGlobalInt("__dispatchRightClick", ...)` because the LuaJIT runtime has no prebuilt `dispatchPrepared*` helpers.
Rationale: `engine.zig` already consumes Lua event handlers natively; the QJS-only event path is the wrong abstraction for the EQJS cart.
Verify: `rg -n "dispatchEffectRender|dispatchPreparedScroll|dispatchPreparedRightClick|js_on_press|js_on_mouse_down|js_on_mouse_up|js_on_hover_enter|js_on_hover_exit" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches.

#### Step 2.2.3 — Convert the QJS host-function block to LuaJIT ABI callbacks
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1268-1314`
Action: rewrite the host functions to use LuaJIT C-API inputs and outputs instead of `qjs.JSContext` / `qjs.JSValue`.
- `host_flush` should accept a `lua_State`, read the first argument as a string, duplicate the bytes, append to `g_pending_flush`, and return `0`.
- `host_get_input_text_for_node` should accept a `lua_State`, push a Lua string, and return `1`.
- The functions must be registered through `luajit_runtime.registerHostFn`.
Rationale: the LuaJIT VM cannot consume QuickJS signatures.
Verify: `rg -n "JS_ToCString|JS_NewString|JS_NewStringLen|JS_FreeCString|JSValue|JSContext|quickjs.h" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches.

#### Step 2.2.4 — Replace the QuickJS reload path with a LuaJIT reload path
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1667-1704`
Action: replace `qjs_runtime.teardownVM()`, `qjs_runtime.initVM()`, and `qjs_runtime.evalScript(...)` with the LuaJIT equivalents.
- Reinitialize the Lua VM with `luajit_runtime.deinit()` / `luajit_runtime.initVM()`.
- Re-run the EQJS bootstrap script that loads `cursor_ide_boot_runtime.lua` and `boot_bundle.lua`.
- Keep the tree clearing and allocator cleanup exactly as-is.
Rationale: this preserves the dev reload semantics while swapping the runtime backend.
Verify: `rg -n "teardownVM|qjs_runtime\\.initVM|qjs_runtime\\.evalScript|qjs_runtime\\." /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches.

#### Step 2.2.5 — Replace init/tick/main script dispatch with the Lua boot flow
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1751-1848`
Action: make `appInit()` register Lua host functions and preload the bootstrap loader, then make `appTick()` stop calling QJS-only helpers.
- Remove `qjs_bindings.tickDrain()`.
- Remove `qjs_runtime.callGlobalInt("__jsTick", ...)`.
- Register any bootstrap helpers that the Lua chunk will call.
- Keep `fs_mod.init("reactjit")` and `localstore.init()`.
Rationale: the EQJS cart should be driven by a single Lua bootstrap stage, not by mixed QJS/Lua scheduling.
Verify: `rg -n "qjs_bindings\\.tickDrain|__jsTick|qjs_runtime\\.(registerHostFn|callGlobalInt|evalScript|initVM|teardownVM)" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches.

### 2.3 Bundle swap

#### Step 2.3.1 — Replace the JS bundle constants with Lua boot-source constants
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `35-39` and `72-84`
Action: swap the JS bundle constants for Lua boot runtime/bundle constants and update the dev hot reload path to the EQJS bundle file.
Rationale: the executable now embeds and/or reloads the Lua runtime and compiled boot bundle, not a `.js` bundle.
Verify: `rg -n "bundle\\.js|bundle-.*\\.js|BUNDLE_FILE_NAME|BUNDLE_BYTES|DEV_BUNDLE_PATH" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches; `rg -n "cursor_ide_boot_runtime\\.lua|boot_bundle\\.lua" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return matches.

#### Step 2.3.2 — Add a Lua bootstrap chunk that loads the EQJS runtime and bundle
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: add near the top-level constants or just above `appInit()`
Action: add a `const BOOTSTRAP = ...` multiline Lua chunk that:
- calls host functions to retrieve the runtime source and bundle source
- `load(...)()`s the runtime source first
- `load(...)()`s the bundle source second
- constructs `Runtime.new(bundle)`
- calls `runtime:set_global_this(...)`
- instantiates the cursor-ide entry component
- emits the initial mount ops through `__hostFlush`
Use `cursor_ide_eqjs_app.zig:60-114` as the loader pattern, but adapt it so the sources come from Zig host functions instead of hard-coded disk paths.
Rationale: `luajit_runtime.evalScript()` discards return values, so the bootstrap has to capture the returned `Runtime` class and bundle table explicitly.
Verify: `rg -n "Runtime\\.new|set_global_this|emit_mount_ops|__hostFlush|load\\(" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return matches.

#### Step 2.3.3 — Bind the EQJS bootstrap globals in `appInit`
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1751-1767`
Action: register `__hostFlush`, `__getInputTextForNode`, `__bootRuntimeSource`, and `__bootBundleSource` with `luajit_runtime.registerHostFn`, then keep the `fs_mod` and `localstore` setup.
Rationale: the Lua bootstrap must be able to fetch its source text and push flush batches before the first render.
Verify: `rg -n "registerHostFn\\(\"__hostFlush\"|registerHostFn\\(\"__getInputTextForNode\"|registerHostFn\\(\"__bootRuntimeSource\"|registerHostFn\\(\"__bootBundleSource\"" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return matches.

#### Step 2.3.4 — Feed the boot bootstrap through `engine.run`
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1842-1848`
Action: set `.js_logic = ""` and `.lua_logic = BOOTSTRAP` in the `engine.run` call, leaving the window/title/root/borderless wiring unchanged.
Rationale: the EQJS cart should enter through the engine's Lua path only.
Verify: `rg -n "\\.js_logic =|\\.lua_logic =" /home/siah/creative/reactjit/eqjs_cart_app.zig` should show the EQJS values.

#### Step 2.3.5 — Switch dev reload to the EQJS bundle file
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines `1598-1677`
Action: change the file I/O so dev mode reads `/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua`, not `bundle.js`, and re-runs the Lua bootstrap after reload.
Rationale: this keeps hot reload aligned with the same bundle format the release binary embeds.
Verify: `rg -n "bundle\\.js" /home/siah/creative/reactjit/eqjs_cart_app.zig` should return no matches.

### 2.4 Build wiring

#### Step 2.4.1 — Add an EQJS cart build gate and skip QuickJS sources
File: `/home/siah/creative/reactjit/build.zig`
Location: lines `16-19`, `47-63`, `75-131`
Action: add a new `eqjs-cart` build option or derive the backend from `app-source`, then:
- set `options.addOption(bool, "has_quickjs", !eqjs_cart);`
- wrap the QuickJS C source block in `if (options.has_quickjs)` or an equivalent build-time guard
- keep the LuaJIT dependency and include paths untouched
Rationale: the size target depends on not linking in the QuickJS runtime for the EQJS cart build.
Verify: `zig build app -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast` should succeed once the file port is in place.

#### Step 2.4.2 — Force stripping in the cart build
File: `/home/siah/creative/reactjit/build.zig`
Location: lines `75-83`
Action: set `exe.strip = true` on the executable.
Rationale: the target binary must not ship debug symbols or debug ELF sections.
Verify: `file zig-out/bin/cursor-ide-eqjs-cart` should report `stripped`.

#### Step 2.4.3 — Add a dedicated EQJS ship script
File: `/home/siah/creative/reactjit/scripts/ship-eqjs-cart`
Location: new file
Action: add this script:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

zig build app -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast
exec ./zig-out/bin/cursor-ide-eqjs-cart
```
Rationale: a single entry point keeps the ReleaseFast-only build path unambiguous.
Verify: `bash /home/siah/creative/reactjit/scripts/ship-eqjs-cart` should build and launch the host.

#### Step 2.4.4 — Add a named build step for the EQJS cart
File: `/home/siah/creative/reactjit/build.zig`
Location: lines `160-163`
Action: add a second build step, e.g. `eqjs-cart`, that installs the EQJS cart artifact without replacing the existing `app` step.
Rationale: this gives CI and local smoke tests a stable target.
Verify: `zig build eqjs-cart -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast` should return exit code `0`.

### 2.5 Smoke

#### Step 2.5.1 — Verify the binary shape
File: build artifact only
Location: after `zig build`
Action: inspect the artifact size and ELF shape.
Rationale: the hard constraint is a stripped ReleaseFast binary around 30MB, not a large debug build.
Verify: `file zig-out/bin/cursor-ide-eqjs-cart` should say `stripped`; `stat -c %s zig-out/bin/cursor-ide-eqjs-cart` should be in the low tens of MB and definitely not `100000000+`.

#### Step 2.5.2 — Launch the host
File: build artifact only
Location: after `zig build`
Action: run `timeout 10s ./zig-out/bin/cursor-ide-eqjs-cart`.
Rationale: confirms the Lua bootstrap, runtime load, and window creation do not crash immediately.
Verify: the process should stay alive until timeout and emit bootstrap / mount logs.

#### Step 2.5.3 — Click rerender smoke
File: runtime behavior
Location: manual GUI check after launch
Action: click a visible `Pressable` in the cursor-ide surface and confirm the tree rerenders.
Rationale: this is the minimum proof that the Lua event bridge and flush path both work.
Verify: the top bar / branch strip / nav toolbar remain visible, and the clicked control triggers a state update or rerender.

## 3. Expected blockers + fallback guidance

- The main probable blocker is that `cursor_ide_boot_runtime.lua` currently records `handler_values` and `handler_ids` but does not expose a clearly named event-dispatch method in the source I inspected. That is an inference from the runtime source, not a proven API contract. If that gap is real, add a small Lua-side dispatcher first, then bind it into the Lua globals that `eqjs_cart_app.zig` calls.
- If `luajit_runtime.evalScript()` cannot capture the returned `Runtime` class or bundle table, do not try to `evalScript` the bundle file directly. Instead, use host functions that return the runtime and bundle source text, and load them from a Lua bootstrap chunk with `load(...)()`.
- If flushes must stay batched, keep the exact queueing logic from `qjs_app.zig` and only swap the callback ABI to LuaJIT. Do not apply host flushes inline during event callbacks.
- If the EQJS effect path cannot be hooked on the first pass, keep `noop_effect_render` and ship the host without custom effect rendering first. Then wire `luajit_runtime.setEffectRender` and `setEffectShader` in a follow-up pass.
- If the binary is still too large after `exe.strip = true`, the next fallback is to make the QuickJS C sources conditional on the EQJS cart build and verify that `eqjs_cart_app.zig` contains no `qjs_runtime` or `qjs_bindings` references at all.

## 4. Final verification checklist

- `zig build eqjs-cart -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast` succeeds
- `file zig-out/bin/cursor-ide-eqjs-cart` reports a stripped executable
- `stat -c %s zig-out/bin/cursor-ide-eqjs-cart` is roughly 30MB and not 100MB+
- `./zig-out/bin/cursor-ide-eqjs-cart` opens a window
- The cursor-ide top bar, branch strip, and nav toolbar render
- Clicking a `Pressable` triggers a rerender
