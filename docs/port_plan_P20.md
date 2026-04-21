# EQJS Cart Port Plan

## 0. Inventory

### QJS-specific surface in [`qjs_app.zig`](/home/siah/creative/reactjit/qjs_app.zig)

| QJS symbol / text | Evidence in `qjs_app.zig` | LuaJIT / EQJS equivalent | Evidence in `luajit_runtime.zig` / runtime |
|---|---|---|---|
| `const qjs_runtime = @import("framework/qjs_runtime.zig");` | [line 24](/home/siah/creative/reactjit/qjs_app.zig#L24) | `const luajit_runtime = @import("framework/luajit_runtime.zig");` | [line 26](/home/siah/creative/reactjit/qjs_app.zig#L26), [init/eval API](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1125) |
| `const qjs_bindings = @import("framework/qjs_bindings.zig");` | [line 25](/home/siah/creative/reactjit/qjs_app.zig#L25) | no direct LuaJIT equivalent; drop the import and replace `tickDrain()` with `luajit_runtime.tick()` or delete if unused | [tick](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1315) |
| `const qjs = @cImport({ @cInclude("quickjs.h"); });` | [lines 31-33](/home/siah/creative/reactjit/qjs_app.zig#L31) | no QuickJS C import; use LuaJIT C API through `luajit_runtime` | [Lua C import](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L44) |
| `QJS_UNDEFINED` | [line 40](/home/siah/creative/reactjit/qjs_app.zig#L40) | delete; LuaJIT path uses `nil` / `0` / no-op returns | [Lua host funcs](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L65) |
| `@embedFile(BUNDLE_FILE_NAME)` and `bundle-{s}.js` / `bundle.js` | [lines 35-39, 84](/home/siah/creative/reactjit/qjs_app.zig#L35) | embed `/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua` and `/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua` | [runtime file](/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua#L1), [bundle file](/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua#L1) |
| `qjs_runtime.callGlobal("__beginJsEvent")` / `qjs_runtime.callGlobal("__endJsEvent")` | [lines 156-158, 201-203](/home/siah/creative/reactjit/qjs_app.zig#L156) | delete; LuaJIT events are direct `evalExpr()` calls | [evalExpr](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1222) |
| `qjs_runtime.callGlobalInt(...)` | [line 157](/home/siah/creative/reactjit/qjs_app.zig#L157), [line 1792](/home/siah/creative/reactjit/qjs_app.zig#L1792) | `luajit_runtime.callGlobalInt(...)` | [line 1267](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1267) |
| `qjs_runtime.callGlobal3Int(...)` | [line 202](/home/siah/creative/reactjit/qjs_app.zig#L202) | `luajit_runtime.callGlobal3Int(...)` | [line 1282](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1282) |
| `luajit_runtime.hasGlobal(...)` already exists in the file | [line 161](/home/siah/creative/reactjit/qjs_app.zig#L161) | keep; it is the EQJS-side equivalent of the QJS global lookup | [line 1306](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1306) |
| `qjs_runtime.dispatchEffectRender(...)` | [line 1017](/home/siah/creative/reactjit/qjs_app.zig#L1017) | `luajit_runtime.setEffectRender(...)` registry, then host-side callback lookup; no direct dispatch helper | [lines 34-41](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L34) |
| `qjs_runtime.dispatchPreparedScroll` / `qjs_runtime.dispatchPreparedRightClick` | [lines 1091, 1094](/home/siah/creative/reactjit/qjs_app.zig#L1091) | no direct helper in LuaJIT runtime; use `luajit_runtime.callGlobalInt("__dispatchScroll", ...)` / `("__dispatchRightClick", ...)` or delete if boot runtime owns those events | [callGlobalInt](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1267), [callGlobal3Int](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1282) |
| `export fn host_flush(...)` for `__hostFlush` | [lines 1268-1289](/home/siah/creative/reactjit/qjs_app.zig#L1268) | delete; cursor-ide EQJS boot runtime uses `set_global_this()` + host globals instead of `__hostFlush` | [set_global_this](/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua#L907), [host globals list](/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua#L6) |
| `export fn host_get_input_text_for_node(...)` | [lines 1306-1314](/home/siah/creative/reactjit/qjs_app.zig#L1306) | delete unless the Lua bundle explicitly needs it; the cursor-ide EQJS bundle uses `__store_get`, `__store_set`, `__exec`, `__pty_open`, etc. | [host globals list](/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua#L6) |
| `qjs_runtime.teardownVM()` / `qjs_runtime.initVM()` / `qjs_runtime.evalScript(...)` | [lines 1696-1702](/home/siah/creative/reactjit/qjs_app.zig#L1696) | `luajit_runtime.initVM()` / `luajit_runtime.deinit()` / `luajit_runtime.evalScript(...)` | [init](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1125), [deinit](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1196), [evalScript](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1206) |
| `qjs_runtime.registerHostFn(...)` | [lines 1760-1761](/home/siah/creative/reactjit/qjs_app.zig#L1760) | `luajit_runtime.registerHostFn(...)` | [line 1187](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1187) |
| `qjs_bindings.tickDrain()` | [line 1786](/home/siah/creative/reactjit/qjs_app.zig#L1786) | no direct LuaJIT equivalent; delete unless you add a separate async bridge | [tick](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1315) |
| `qjs_runtime.callGlobalInt("__jsTick", ...)` | [line 1792](/home/siah/creative/reactjit/qjs_app.zig#L1792) | `luajit_runtime.tick()` and, if needed, a Lua-side `__zigOS_tick` | [tick](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1315), [callGlobal](/home/siah/creative/reactjit/framework/luajit_runtime.zig#L1238) |
| `js_logic = initial_bundle`, `lua_logic = ""` | [lines 1845-1846](/home/siah/creative/reactjit/qjs_app.zig#L1845) | `js_logic = ""`, `lua_logic = BOOTSTRAP_LUA` or embedded Lua bootstrap text | [engine lua/js split](/home/siah/creative/reactjit/framework/engine.zig#L1959) |

### Framework imports that transfer unchanged

If you keep the `qjs_app.zig` shell shape, these imports stay:

- `std`
- `build_options`
- `framework/layout.zig`
- `framework/effect_ctx.zig`
- `framework/input.zig`
- `framework/state.zig`
- `framework/events.zig`
- `framework/engine.zig`
- `framework/luajit_runtime.zig`
- `framework/fs.zig`
- `framework/localstore.zig`
- `framework/dev_ipc.zig`
- `framework/core.zig` comptime import

### Build.zig changes needed

- Add a `has-quickjs` build option, default `true` for the QJS cart and `false` for the EQJS cart.
- Guard the QuickJS include path and `addCSourceFiles(...)` block behind that option.
- Set `exe.strip = true` for ReleaseFast builds so the final binary is stripped.
- Keep `exe.linkSystemLibrary("luajit-5.1")` for the EQJS cart.
- Keep the existing ReleaseFast path in `scripts/ship-eqjs`, but pass the new EQJS app source and `-Dhas-quickjs=false`.

## 1. Preconditions (read-only verifications)

If any command below fails, stop the port and fix that blocker first.

- `test -f /home/siah/creative/reactjit/qjs_app.zig` -> expected exit code `0`
- `test -f /home/siah/creative/reactjit/framework/qjs_runtime.zig` -> expected exit code `0`
- `test -f /home/siah/creative/reactjit/framework/luajit_runtime.zig` -> expected exit code `0`
- `test -f /home/siah/creative/reactjit/build.zig` -> expected exit code `0`
- `test -f /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua` -> expected exit code `0`
- `test -f /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua` -> expected exit code `0`
- `rg -n "pub fn (initVM|evalScript|evalExpr|tick|callGlobal|callGlobalInt|callGlobal3Int|hasGlobal|registerHostFn|deinit)" /home/siah/creative/reactjit/framework/luajit_runtime.zig` -> expected to print the LuaJIT API surface
- `rg -n "set_global_this|instantiate_component|host_globals|__store_get|__store_set|__exec|__pty_open" /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua` -> expected to print the EQJS bootstrap contract
- `zig version` -> expected to print a release-capable Zig toolchain version

## 2. Step-by-step port

### 2.1 Skeleton

#### Step 2.1.1 - Create the EQJS cart app file
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: new file
- Action: add the new file by copying `/home/siah/creative/reactjit/qjs_app.zig` verbatim as the baseline.
- Rationale: this preserves the window shell, globals, and line structure so later substitutions can be mechanical.
- Verify: `test -f /home/siah/creative/reactjit/eqjs_cart_app.zig` -> exit code `0`

#### Step 2.1.2 - Rename the file header and build note
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 1-9
- Action: replace the file banner so it says EQJS/LuaJIT, not QuickJS.
- Before:
```zig
//! qjs_app.zig — React (via react-reconciler + love2d hostConfig) running in the
//! framework's real QuickJS VM, producing mutation commands that land directly on
//! framework.layout.Node. Event press → engine's js_on_press evals
//! `__dispatchEvent(id,'onClick')` → React handler runs → commit flushes new
//! mutations via __hostFlush → applied to the same Node pool → layout dirtied.
//! No hermes subprocess. Same AppConfig seam Smith uses.
//!
//! Build:
//!   zig build app -Dapp-name=qjs_d152 -Dapp-source=qjs_app.zig -Doptimize=ReleaseFast
```
- After:
```zig
//! eqjs_cart_app.zig — React/cursor-ide host running in the framework's
//! LuaJIT/EQJS VM path, producing the same window shell but without QuickJS.
//! The EQJS boot bundle is loaded from /home/siah/eqjs/generated/cursor-ide-boot/
//! and the runtime comes from /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua.
//!
//! Build:
//!   zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Dhas-quickjs=false -Doptimize=ReleaseFast
```
- Rationale: the banner must advertise the correct runtime and build invocation.
- Verify: `sed -n '1,9p' /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected to show the new EQJS header

#### Step 2.1.3 - Swap the runtime imports
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 15-33
- Action: replace the QJS imports and C import block with the LuaJIT-only import set.
- Before:
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
```
- After:
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
```
- Rationale: EQJS should not pull in QuickJS or the QJS-only binding layer.
- Verify: `rg -n "qjs_runtime|qjs_bindings|quickjs.h" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches

#### Step 2.1.4 - Replace the JS bundle constants with the EQJS boot bundle constants
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 35-40
- Action: replace the per-cart `bundle-*.js` embed with the boot runtime and boot bundle embeds.
- Before:
```zig
// Per-cart bundle. Path is `bundle-<app-name>.js` so that two parallel ships
// (different carts) don't race on a shared `bundle.js`. If you run
// `zig build app` directly, make sure the matching bundle file exists.
const BUNDLE_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.js", .{build_options.app_name});
const BUNDLE_BYTES = @embedFile(BUNDLE_FILE_NAME);
const QJS_UNDEFINED: qjs.JSValue = .{ .u = .{ .int32 = 0 }, .tag = 3 };
```
- After:
```zig
// EQJS boot runtime + bundle. These are compiled into the binary so the
// ReleaseFast cart does not depend on runtime JS file lookup.
const BOOT_RUNTIME_BYTES = @embedFile("/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua");
const BOOT_BUNDLE_BYTES = @embedFile("/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua");
```
- Rationale: the cart now boots from the Lua runtime/bundle pair instead of a per-cart JS blob.
- Verify: `rg -n "BOOT_RUNTIME_BYTES|BOOT_BUNDLE_BYTES|bundle-<app-name>.js|QJS_UNDEFINED" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected only the two new EQJS constants

#### Step 2.1.5 - Remove the QJS-only dev bundle path and tab registry
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 71-120
- Action: delete the entire QJS dev tab / reload block.
- Before:
```zig
// ── Dev mode — hot reload of the JS bundle ──────────────────────────
// When DEV_MODE is enabled (via -Ddev-mode=true), the binary reads bundle.js
// from disk on startup and polls its mtime each tick. When the file changes
// (esbuild watch mode rebundles it), we tear down the tree + the QuickJS
// context, reinit, and re-eval the new bundle. React state resets on reload
// in phase 1; phase 2 will use LuaJIT hotstate atoms to preserve it.
const DEV_MODE = if (@hasDecl(build_options, "dev_mode")) build_options.dev_mode else false;
const CUSTOM_CHROME_MODE = if (@hasDecl(build_options, "app_name"))
    std.mem.eql(u8, build_options.app_name, "browser") or
        std.mem.eql(u8, build_options.app_name, "cursor-ide")
else
    false;
const BORDERLESS_MODE = DEV_MODE or CUSTOM_CHROME_MODE;
const DEV_BUNDLE_PATH = "bundle.js";

var g_dev_bundle_buf: []u8 = &.{};
var g_last_bundle_mtime: i128 = 0;
var g_mtime_poll_counter: u32 = 0;
var g_reload_pending: bool = false;

const dev_ipc = @import("framework/dev_ipc.zig");

/// A dev-mode tab. Each tab has a human-readable name (cart name) and a
/// heap-owned bundle. The active tab is the one currently evaluated in QJS;
/// others sit dormant until re-activated via IPC push or (future) chrome click.
const Tab = struct {
    name: []u8, // owned
    bundle: []u8, // owned
};

var g_tabs: std.ArrayList(Tab) = .{};
var g_active_tab: usize = 0;

const MAX_TABS = 16;

/// Comptime-generated per-tab click handler. We can't close over an index at
/// runtime in Zig, so we specialize one callback per slot ahead of time.
fn makeTabClickCallback(comptime idx: usize) *const fn () void {
    return struct {
        fn callback() void {
            if (idx < g_tabs.items.len and idx != g_active_tab) switchToTab(idx);
        }
    }.callback;
}
```
- After: remove all of the above.
- Rationale: EQJS release does not reload `bundle.js`; the boot bundle is compiled in and the cursor-ide state lives inside the Lua runtime.
- Verify: `rg -n "DEV_MODE|DEV_BUNDLE_PATH|g_tabs|switchToTab|processIncomingPushes|bundle.js" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches

### 2.2 Runtime swap

#### Step 2.2.1 - Replace the QJS event dispatch helpers with LuaJIT calls
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 153-205
- Action: replace the QJS begin/end wrappers with direct LuaJIT event calls.
- Before:
```zig
fn dispatchInputEvent(slot: u8, global_name: [*:0]const u8) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobalInt(global_name, @intCast(node_id));
    qjs_runtime.callGlobal("__endJsEvent");
    // Additive LuaJIT dispatch — cart code running in the Lua VM picks up the
    // same event by defining a matching global. Silent no-op if absent.
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
- After:
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
- Rationale: LuaJIT event handlers are executed directly; the QJS begin/end bookkeeping is not part of the EQJS path.
- Verify: `rg -n "__beginJsEvent|__endJsEvent|qjs_runtime.callGlobal" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches in those helper functions

#### Step 2.2.2 - Replace the QJS effect shim with the LuaJIT effect registry path
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 1008-1110
- Action: delete `qjs_effect_shim`, then rewrite `applyHandlerFlags` so it only wires LuaJIT-compatible hooks.
- Before:
```zig
fn qjs_effect_shim(ctx: *effect_ctx.EffectContext) void {
    const id_u: usize = ctx.user_data;
    if (id_u == 0) return;
    const id: u32 = @intCast(id_u);
    const buf_len: usize = @as(usize, ctx.height) * @as(usize, ctx.stride);
    qjs_runtime.dispatchEffectRender(
        id,
        ctx.buf,
        buf_len,
        ctx.width,
        ctx.height,
        ctx.stride,
        ctx.time,
        ctx.dt,
        ctx.mouse_x,
        ctx.mouse_y,
        ctx.mouse_inside,
        ctx.frame,
    );
}
...
    if (cmdHasAnyHandlerName(cmd, &.{"onScroll"})) {
        node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll;
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onRightClick", "onContextMenu" })) {
        node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick;
    }
...
    if (cmdHasHandlerName(cmd, "onRender")) {
        node.effect_render = &qjs_effect_shim;
    } else if (node.effect_shader != null) {
        node.effect_render = &noop_effect_render;
    }
```
- After:
```zig
fn applyHandlerFlags(node: *Node, id: u32, cmd: std.json.Value) void {
    node.handlers.js_on_press = null;
    node.handlers.js_on_mouse_down = null;
    node.handlers.js_on_mouse_up = null;
    node.handlers.js_on_hover_enter = null;
    node.handlers.js_on_hover_exit = null;
    node.handlers.on_scroll = null;
    node.handlers.on_right_click = null;
    node.canvas_move_draggable = false;
    node.effect_render = null;

    if (cmdHasAnyHandlerName(cmd, &.{ "onClick", "onPress" })) {
        node.handlers.js_on_press = installJsExpr("__dispatchEvent({d},'onClick')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onMouseDown" })) {
        node.handlers.js_on_mouse_down = installJsExpr("__dispatchEvent({d},'onMouseDown')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onMouseUp" })) {
        node.handlers.js_on_mouse_up = installJsExpr("__dispatchEvent({d},'onMouseUp')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onHoverEnter", "onMouseEnter" })) {
        node.handlers.js_on_hover_enter = installJsExpr("__dispatchEvent({d},'onHoverEnter')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onHoverExit", "onMouseLeave" })) {
        node.handlers.js_on_hover_exit = installJsExpr("__dispatchEvent({d},'onHoverExit')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{"onScroll"})) {
        node.handlers.on_scroll = null;
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onRightClick", "onContextMenu" })) {
        node.handlers.on_right_click = null;
    }
    if (cmdHasAnyHandlerName(cmd, &.{"onMove"})) {
        node.canvas_move_draggable = true;
    }
}
```
- Rationale: EQJS boot runtime does not go through the React-reconciler/QJS effect callback path.
- Verify: `rg -n "qjs_effect_shim|dispatchEffectRender|dispatchPreparedScroll|dispatchPreparedRightClick" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches

#### Step 2.2.3 - Replace the QJS host functions with the cursor-ide EQJS host globals
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 1268-1314 and 1751-1767
- Action: delete `host_flush` and `host_get_input_text_for_node`; replace `appInit()` with the EQJS boot host registration table from `cursor_ide_eqjs_app.zig`.
- Before:
```zig
// ── QJS host function: __hostFlush(json) ────────────────────────
// JSCFunction signature: fn(ctx, this, argc, argv) -> JSValue

export fn host_flush(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) qjs.JSValue {
    ...
}

fn drainPendingFlushes() void {
    ...
}

export fn host_get_input_text_for_node(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) qjs.JSValue {
    ...
}
...
fn appInit() void {
    qjs_runtime.registerHostFn("__hostFlush", @ptrCast(&host_flush), 1);
    qjs_runtime.registerHostFn("__getInputTextForNode", @ptrCast(&host_get_input_text_for_node), 1);

    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});
}
```
- After:
```zig
const lua = luajit_runtime.lua;

fn hostLog(L: ?*lua.lua_State) callconv(.c) c_int {
    const level = lua.lua_tointeger(L, 1);
    var len: usize = 0;
    const ptr = lua.lua_tolstring(L, 2, &len);
    const message = if (ptr != null) @as([*]const u8, @ptrCast(ptr))[0..len] else "";
    std.debug.print("[eqjs][lua:{d}] {s}\n", .{ level, message });
    return 0;
}

fn hostStoreGet(L: ?*lua.lua_State) callconv(.c) c_int { ... }
fn hostStoreSet(L: ?*lua.lua_State) callconv(.c) c_int { ... }
fn hostExec(L: ?*lua.lua_State) callconv(.c) c_int { ... }
fn hostFsReadFile(L: ?*lua.lua_State) callconv(.c) c_int { ... }
fn hostFsWriteFile(L: ?*lua.lua_State) callconv(.c) c_int { ... }
fn hostPtyOpen(L: ?*lua.lua_State) callconv(.c) c_int { ... }
fn hostNoop(_: ?*lua.lua_State) callconv(.c) c_int { ... }

fn appInit() void {
    luajit_runtime.registerHostFn("__host_store_get", @ptrCast(&hostStoreGet), 1);
    luajit_runtime.registerHostFn("__host_store_set", @ptrCast(&hostStoreSet), 2);
    luajit_runtime.registerHostFn("__host_exec", @ptrCast(&hostExec), 1);
    luajit_runtime.registerHostFn("__host_fs_readfile", @ptrCast(&hostFsReadFile), 1);
    luajit_runtime.registerHostFn("__host_fs_writefile", @ptrCast(&hostFsWriteFile), 2);
    luajit_runtime.registerHostFn("__host_pty_open", @ptrCast(&hostPtyOpen), 0);
    luajit_runtime.registerHostFn("__host_noop", @ptrCast(&hostNoop), 0);

    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});
}
```
- Rationale: the EQJS cursor-ide runtime expects these globals, not `__hostFlush` / `__getInputTextForNode`.
- Verify: `rg -n "__hostFlush|__getInputTextForNode|__host_store_get|__host_store_set|__host_exec|__host_fs_readfile|__host_fs_writefile|__host_pty_open|__host_noop" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected to show only the EQJS host globals

#### Step 2.2.4 - Replace the per-frame tick path
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 1769-1804
- Action: replace the QJS tick/drain path with the LuaJIT tick path.
- Before:
```zig
fn appTick(now: u32) void {
    if (DEV_MODE) {
        dev_ipc.pollOnce();
        processIncomingPushes();
    }
    maybeScheduleReload();
    if (g_reload_pending) {
        g_reload_pending = false;
        performReload();
        return;
    }

    qjs_bindings.tickDrain();
    qjs_runtime.callGlobalInt("__jsTick", @intCast(now));
    drainPendingFlushes();

    if (g_dirty) {
        snapshotRuntimeState();
        rebuildTree();
        layout.markLayoutDirty();
        g_dirty = false;
    }
}
```
- After:
```zig
fn appTick(now: u32) void {
    _ = now;
    luajit_runtime.tick();
    if (g_dirty) {
        layout.markLayoutDirty();
        g_dirty = false;
    }
}
```
- Rationale: EQJS tick work is handled by the Lua VM and the boot runtime; there is no QJS drain queue.
- Verify: `rg -n "tickDrain|__jsTick|drainPendingFlushes|maybeScheduleReload|performReload" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches

### 2.3 Bundle swap

#### Step 2.3.1 - Replace the JS reload helpers with an inline Lua bootstrap loader
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 1608-1747
- Action: delete the reload/tab helpers and replace them with a single `BOOTSTRAP_LUA` constant inside `eqjs_cart_app.zig` that loads the EQJS runtime + boot bundle, then instantiates `CursorIdeApp`.
- Before:
```zig
fn bundleMtimeOrZero() i128 { ... }
fn maybeScheduleReload() void { ... }
fn clearTreeStateForReload() void { ... }
fn performReload() void { ... }
fn replaceActiveTabBundle(new_bundle: []u8) void { ... }
fn evalActiveTab() void {
    std.log.info("[dev] evalActiveTab: clearing tree", .{});
    clearTreeStateForReload();
    std.log.info("[dev] evalActiveTab: tearing down VM", .{});
    qjs_runtime.teardownVM();
    std.log.info("[dev] evalActiveTab: initVM", .{});
    qjs_runtime.initVM();
    std.log.info("[dev] evalActiveTab: appInit", .{});
    appInit();
    std.log.info("[dev] evalActiveTab: evalScript ({d} bytes)", .{g_tabs.items[g_active_tab].bundle.len});
    qjs_runtime.evalScript(g_tabs.items[g_active_tab].bundle);
    std.log.info("[dev] evalActiveTab: done", .{});
}
fn tabName(idx: usize) []const u8 { ... }
fn findTab(name: []const u8) ?usize { ... }
fn upsertTab(name: []u8, bundle: []u8) !usize { ... }
fn switchToTab(idx: usize) void { ... }
fn processIncomingPushes() void { ... }
```
- After:
```zig
const BOOTSTRAP_LUA =
    \\local Runtime = assert(load(BOOT_RUNTIME_BYTES, "@cursor_ide_boot_runtime.lua"))()
    \\local bundle = assert(load(BOOT_BUNDLE_BYTES, "@boot_bundle.lua"))()
    \\local runtime = Runtime.new(bundle)
    \\runtime:set_global_this({
    \\  __store_get = __host_store_get,
    \\  __store_set = __host_store_set,
    \\  __exec = __host_exec,
    \\  __fs_readfile = __host_fs_readfile,
    \\  __fs_writefile = __host_fs_writefile,
    \\  __tel_system = function() return { window_w = 1280, window_h = 800 } end,
    \\  __pty_open = __host_pty_open,
    \\  __windowClose = __host_noop,
    \\  __windowMinimize = __host_noop,
    \\  __windowMaximize = __host_noop,
    \\  __claude_init = __host_noop,
    \\  __claude_send = __host_noop,
    \\  __claude_poll = __host_noop,
    \\  __claude_close = __host_noop,
    \\  __kimi_init = __host_noop,
    \\  __kimi_send = __host_noop,
    \\  __kimi_poll = __host_noop,
    \\  __kimi_close = __host_noop,
    \\  __rec_start = __host_noop,
    \\  __rec_stop = __host_noop,
    \\  __rec_save = __host_noop,
    \\  __rec_is_recording = function() return false end,
    \\  __rec_frame_count = function() return 0 end,
    \\  __play_load = __host_noop,
    \\  __play_toggle = __host_noop,
    \\  __play_step = __host_noop,
    \\  __play_state = function() return { playing = false, frame = 0 } end,
    \\  __setTerminalDockHeight = __host_noop,
    \\  __beginTerminalDockResize = __host_noop,
    \\  __endTerminalDockResize = __host_noop,
    \\})
    \\local instance, err = runtime:instantiate_component("CursorIdeApp", { widthBand = "desktop" })
    \\if not instance then error("instantiate failed: " .. tostring(err)) end
    \\local mount_ops = runtime:emit_mount_ops(instance.tree)
    \\return true
;
```
- Rationale: the boot runtime is a single Lua bootstrap surface; it does not use QJS reload or tab bookkeeping.
- Verify: `rg -n "evalActiveTab|switchToTab|upsertTab|processIncomingPushes|bundleMtimeOrZero|maybeScheduleReload" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches

#### Step 2.3.2 - Replace `main()` bundle selection with the EQJS bootstrap
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: lines 1808-1855
- Action: replace the QJS `engine.run(.{ .js_logic = initial_bundle, .lua_logic = "" })` block with an EQJS boot sequence that runs the Lua bootstrap and keeps the same window shell.
- Before:
```zig
pub fn main() !void {
    if (IS_LIB) return;

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    g_alloc = gpa.allocator();
    g_arena = std.heap.ArenaAllocator.init(g_alloc);
    g_node_by_id = std.AutoHashMap(u32, *Node).init(g_alloc);
    g_children_ids = std.AutoHashMap(u32, std.ArrayList(u32)).init(g_alloc);
    g_input_slot_by_node_id = std.AutoHashMap(u32, u8).init(g_alloc);

    g_root = .{};

    const initial_bundle: []const u8 = if (DEV_MODE) blk: {
        ...
    } else BUNDLE_BYTES;

    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = &g_root,
        .js_logic = initial_bundle,
        .lua_logic = "",
        .init = appInit,
        .tick = appTick,
        .borderless = BORDERLESS_MODE,
        .set_canvas_node_position = setCanvasNodePosition,
    });
}
```
- After:
```zig
pub fn main() !void {
    if (IS_LIB) return;

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    g_alloc = gpa.allocator();
    g_arena = std.heap.ArenaAllocator.init(g_alloc);
    g_node_by_id = std.AutoHashMap(u32, *Node).init(g_alloc);
    g_children_ids = std.AutoHashMap(u32, std.ArrayList(u32)).init(g_alloc);
    g_input_slot_by_node_id = std.AutoHashMap(u32, u8).init(g_alloc);
    g_root = .{};

    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = &g_root,
        .js_logic = "",
        .lua_logic = BOOTSTRAP_LUA,
        .init = appInit,
        .tick = appTick,
        .borderless = BORDERLESS_MODE,
        .set_canvas_node_position = setCanvasNodePosition,
    });
}
```
- Rationale: the EQJS cart host should boot Lua logic directly and stop pretending there is a JS bundle.
- Verify: `rg -n "js_logic = initial_bundle|lua_logic = \"\"|BUNDLE_BYTES|initial_bundle" /home/siah/creative/reactjit/eqjs_cart_app.zig` -> expected no matches

### 2.4 Build wiring

#### Step 2.4.1 - Add a build option that disables QuickJS for EQJS carts
- File: `/home/siah/creative/reactjit/build.zig`
- Location: lines 16-63
- Action: add `has-quickjs` as a build option, wire it into `build_options`, and use it to decide whether the QuickJS C sources are compiled.
- Before:
```zig
const app_name = b.option([]const u8, "app-name", "Output binary name") orelse "app";
const app_source = b.option([]const u8, "app-source", "Root Zig source file") orelse "qjs_app.zig";
const sysroot = b.option([]const u8, "sysroot", "Optional sysroot for cross-builds");
const dev_mode = b.option(bool, "dev-mode", "Read bundle.js from disk and hot-reload on change") orelse false;
...
options.addOption(bool, "has_quickjs", true);
...
root_mod.addIncludePath(b.path("love2d/quickjs"));
...
root_mod.addCSourceFiles(.{
    .root = b.path("love2d/quickjs"),
    .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
    .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
});
```
- After:
```zig
const has_quickjs = b.option(bool, "has-quickjs", "Build the QuickJS backend") orelse true;
...
options.addOption(bool, "has_quickjs", has_quickjs);
...
if (has_quickjs) {
    root_mod.addIncludePath(b.path("love2d/quickjs"));
    root_mod.addCSourceFiles(.{
        .root = b.path("love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });
}
```
- Rationale: the EQJS cart should not pay for QuickJS text, code, or link size.
- Verify: `zig build -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Dhas-quickjs=false -Doptimize=ReleaseFast app` -> expected exit code `0`

#### Step 2.4.2 - Turn on stripping for ReleaseFast artifacts
- File: `/home/siah/creative/reactjit/build.zig`
- Location: lines 75-83
- Action: add `exe.strip = true` for ReleaseFast builds.
- Before:
```zig
    const exe = b.addExecutable(.{
        .name = app_name,
        .root_module = root_mod,
    });
    // 64MB stack. Debug frames are massive (SDL_Event union + engine.run locals
    // alone burn through the old 16MB), and recursive hitTest/paint walks on
    // deep trees compound fast. VA-only; no RSS cost until used.
    exe.stack_size = 64 * 1024 * 1024;
```
- After:
```zig
    const exe = b.addExecutable(.{
        .name = app_name,
        .root_module = root_mod,
    });
    exe.strip = optimize == .ReleaseFast;
    // 64MB stack. Debug frames are massive (SDL_Event union + engine.run locals
    // alone burn through the old 16MB), and recursive hitTest/paint walks on
    // deep trees compound fast. VA-only; no RSS cost until used.
    exe.stack_size = 64 * 1024 * 1024;
```
- Rationale: the final binary must be stripped and should not carry debug ELFs.
- Verify: `zig build -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Dhas-quickjs=false -Doptimize=ReleaseFast app && file zig-out/bin/cursor-ide-eqjs | rg "stripped"` -> expected to print a stripped ELF line

#### Step 2.4.3 - Update the EQJS ship script to pass the new build flag
- File: `/home/siah/creative/reactjit/scripts/ship-eqjs`
- Location: lines 21-28
- Action: change the build command so it points at `eqjs_cart_app.zig` and passes `-Dhas-quickjs=false`.
- Before:
```bash
OPT_FLAG="-Doptimize=ReleaseFast"
[[ "$DEBUG" -eq 1 ]] && OPT_FLAG="-Doptimize=Debug"

echo "[ship-eqjs] building cursor-ide-eqjs..."
zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=cursor_ide_eqjs_app.zig $OPT_FLAG

echo "[ship-eqjs] launching cursor-ide under --backend=eqjs"
exec ./zig-out/bin/cursor-ide-eqjs
```
- After:
```bash
OPT_FLAG="-Doptimize=ReleaseFast"
[[ "$DEBUG" -eq 1 ]] && OPT_FLAG="-Doptimize=Debug"

echo "[ship-eqjs] building cursor-ide-eqjs..."
zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Dhas-quickjs=false $OPT_FLAG

echo "[ship-eqjs] launching cursor-ide under --backend=eqjs"
exec ./zig-out/bin/cursor-ide-eqjs
```
- Rationale: the ship script is the one-button release path, so it must build the EQJS cart source.
- Verify: `scripts/ship-eqjs -d` -> expected to compile the EQJS cart source and exit only when you close the window

### 2.5 Smoke

#### Step 2.5.1 - Build the release binary
- File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
- Location: whole file
- Action: build the EQJS cart in ReleaseFast with QuickJS disabled.
- Command: `zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Dhas-quickjs=false -Doptimize=ReleaseFast`
- Expected output: exit code `0`
- Rationale: this validates the new host compiles before any runtime check.
- Verify: same command above

#### Step 2.5.2 - Check final binary size
- File: `zig-out/bin/cursor-ide-eqjs`
- Location: built artifact
- Action: confirm the stripped binary is near the target size ceiling.
- Command: `test "$(stat -c%s /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs)" -lt 31457280`
- Expected output: exit code `0`
- Rationale: the binary-shape constraint is part of the port definition, not an afterthought.

#### Step 2.5.3 - Launch the windowed host
- File: `/home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs`
- Location: built artifact
- Action: start the binary and confirm the window stays up.
- Command: `timeout 10s /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs`
- Expected output: exit code `124` from `timeout` if the window stays alive for the full window; manual confirmation that an SDL window opens.
- Rationale: the host must actually launch the cursor-ide UI, not just compile.

#### Step 2.5.4 - Confirm cursor-ide renders and click interaction rerenders
- File: runtime behavior
- Location: UI
- Action: click the top bar / branch strip / nav toolbar and verify the view updates.
- Command: manual click in the running window; if X11 tooling is available, use `xdotool` to click one of the pressables.
- Expected output: a visible re-render, e.g. highlight change or active tab update.
- Rationale: this proves the host bridge and Lua render path are wired end-to-end.

## 3. Expected blockers + fallback guidance

- If `luajit_runtime` cannot execute a Lua chunk that returns a module table, do not improvise in the cart file. Add a tiny `evalModule` helper to `framework/luajit_runtime.zig` that exposes `load`/`pcall` behavior, then use that helper from `eqjs_cart_app.zig`.
- If the EQJS bootstrap needs `__store_get` / `__store_set` / `__exec` but the host globals are missing, copy the exact registration set from [`cursor_ide_eqjs_app.zig`](/home/siah/creative/reactjit/cursor_ide_eqjs_app.zig) lines 60-204 into `appInit()`.
- If the window shell still depends on `qjs_bindings.tickDrain()`, delete that path completely and rely on `luajit_runtime.tick()` only. There is no LuaJIT-side `__ffiEmit` equivalent in the current runtime.
- If the binary still exceeds the size target after QuickJS is disabled and strip is on, the next thing to remove is any leftover QJS-only imports or link libraries that the EQJS cart does not use. Do not reintroduce QuickJS just to satisfy a compile-time dependency.
- If the Lua bootstrap cannot load `cursor_ide_boot_runtime.lua` and `boot_bundle.lua` from embedded bytes cleanly, fall back to the existing [`cursor_ide_eqjs_app.zig`](/home/siah/creative/reactjit/cursor_ide_eqjs_app.zig) bootstrap pattern and keep the window shell separate from the runtime loader.

## 4. Final verification checklist

- `zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Dhas-quickjs=false -Doptimize=ReleaseFast` succeeds.
- `file zig-out/bin/cursor-ide-eqjs` reports a stripped ELF.
- `stat -c%s zig-out/bin/cursor-ide-eqjs` is below 31,457,280 bytes.
- The binary opens a window.
- The cursor-ide top bar, branch strip, and nav toolbar render.
- A pressable click changes the rendered UI, proving rerender works.
