# EQJS Cart Port Plan — Panel P12

## 0. Inventory

### 0.1 QJS-specific symbols in `qjs_app.zig` (grep -n evidence → LuaJIT equivalent)

| Line(s) | QJS Symbol | LuaJIT/EQJS Equivalent |
|---------|-----------|------------------------|
| 25 | `const qjs_runtime = @import("framework/qjs_runtime.zig")` | keep — used for input/key dispatching in hybrid mode |
| 25 | `const qjs_bindings = @import("framework/qjs_bindings.zig")` | **DELETE** — QJS-only async hook drain |
| 31-33 | `const qjs = @cImport({ @cInclude("quickjs.h") })` | **DELETE** — not needed; luajit_runtime already cImports lua.h |
| 38-39 | `const BUNDLE_FILE_NAME = "bundle-{s}.js"` / `@embedFile(BUNDLE_FILE_NAME)` | replace with `const RUNTIME_BYTES = @embedFile("…/cursor_ide_boot_runtime.lua")` + `const BUNDLE_BYTES = @embedFile("…/boot_bundle.lua")` |
| 40 | `const QJS_UNDEFINED: qjs.JSValue` | **DELETE** — no JSValue in Lua bridge |
| 77 | `const DEV_MODE` | keep unchanged |
| 78-83 | `const CUSTOM_CHROME_MODE` / `BORDERLESS_MODE` | keep unchanged |
| 156-157 | `qjs_runtime.callGlobal("__beginJsEvent")` / `callGlobalInt(global_name, …)` / `callGlobal("__endJsEvent")` | replace with EQJS event: `eqjs_runtime.dispatchEvent(g_eqjs_instance, event_name, node_id)` (see §2.2) |
| 201-203 | same pattern for `__dispatchInputKey` | same replacement |
| 1017 | `qjs_runtime.dispatchEffectRender(…)` | no-op stub (effects not used in cursor-ide-boot) |
| 1039-1094 | `node.handlers.js_on_press = installJsExpr("__dispatchEvent({d},'onClick')\x00", id)` etc. | replace with EQJS event dispatch: store node_id+event_name mapping, fire `eqjs_dispatchEvent` from on_press/on_hover callbacks |
| 1091 | `node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll` | keep — Lua runtime handles scroll via scroll_persist_slot |
| 1094 | `node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick` | keep |
| 1271-1290 | `export fn host_flush(ctx: ?*qjs.JSContext, …) qjs.JSValue` | **DELETE ENTIRELY** — EQJS doesn't push via __hostFlush; tree is rebuilt via `runtime:rerender_instance` → `emit_diff_ops` |
| 1306-1315 | `export fn host_get_input_text_for_node(ctx: ?*qjs.JSContext, …)` | **DELETE** — EQJS gets input text via `__getInputTextForNode` registered as Lua global via `luajit_runtime.registerHostFn` |
| 1692-1704 | `evalActiveTab()` calls `qjs_runtime.teardownVM()` / `qjs_runtime.initVM()` / `qjs_runtime.evalScript(…)` | replace: re-`dofile` bundle + re-`instantiate_entry` |
| 1751-1761 | `appInit()` calls `qjs_runtime.registerHostFn("__hostFlush", …)` and `"__getInputTextForNode", …)` | replace: register only `__getInputTextForNode` as Lua global, via `luajit_runtime.registerHostFn`; no `__hostFlush` needed |
| 1783-1803 | `appTick`: `qjs_bindings.tickDrain()`, `qjs_runtime.callGlobalInt("__jsTick", …)`, `drainPendingFlushes()` | replace: call `eqjs_tick()` which runs `rerender_instance` + `emit_diff_ops` + `applyCommandBatch` |

### 0.2 Framework imports that transfer unchanged

```zig
const std = @import("std");
const build_options = @import("build_options");
const layout = @import("framework/layout.zig");
const input = @import("framework/input.zig");
const state = @import("framework/state.zig");
const events = @import("framework/events.zig");
const engine = …@import("framework/engine.zig");
const luajit_runtime = @import("framework/luajit_runtime.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
```

`framework/core.zig` comptime import also transfers unchanged.

### 0.3 Build changes needed

| Change | Detail |
|--------|--------|
| Remove QuickJS C sources | Delete the 6-file `addCSourceFiles` block for `love2d/quickjs/*.c` |
| Remove QuickJS include path | Delete `root_mod.addIncludePath(b.path("love2d/quickjs"))` |
| Set `has_quickjs = false` | `options.addOption(bool, "has_quickjs", false)` |
| Default `app-source` | Change default from `"qjs_app.zig"` to `"eqjs_cart_app.zig"` (or add separate build step) |
| Add `eqjs` step | `b.step("eqjs", …)` pointing at `eqjs_cart_app.zig` |

---

## 1. Preconditions (read-only verifications)

Run each command; if any fails, port is blocked.

```bash
# P1.1 — source file exists
ls /home/siah/creative/reactjit/qjs_app.zig
# Expected: file listed, exit 0

# P1.2 — luajit_runtime.zig exists
ls /home/siah/creative/reactjit/framework/luajit_runtime.zig
# Expected: file listed, exit 0

# P1.3 — EQJS runtime exists
ls /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua
# Expected: file listed, exit 0

# P1.4 — boot bundle exists
ls /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua
# Expected: file listed, exit 0

# P1.5 — build.zig has LuaJIT linkage (not QJS-only)
grep "luajit" /home/siah/creative/reactjit/build.zig
# Expected: lines containing luajit-5.1 and zluajit

# P1.6 — luajit_runtime exposes initVM, evalScript, callGlobal, registerHostFn
grep -c "pub fn initVM\|pub fn evalScript\|pub fn callGlobal\|pub fn registerHostFn" /home/siah/creative/reactjit/framework/luajit_runtime.zig
# Expected: 4

# P1.7 — engine.zig AppConfig has lua_logic field (needed for Lua-only boot)
grep "lua_logic" /home/siah/creative/reactjit/framework/engine.zig | head -3
# Expected: at least one match showing lua_logic field

# P1.8 — docs output dir exists
ls /home/siah/creative/reactjit/docs/
# Expected: directory exists (or create it: mkdir -p /home/siah/creative/reactjit/docs)
```

---

## 2. Step-by-step port

### Phase 2.1 — Skeleton: create `eqjs_cart_app.zig`

---

**Step 2.1.1 — Create skeleton file with correct module header**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: new file
Action: add — write the entire file skeleton:

```zig
//! eqjs_cart_app.zig — cursor-ide cart host using EQJS/LuaJIT instead of QuickJS.
//!
//! Architecture:
//!   - No QuickJS. No __hostFlush. No React reconciler.
//!   - EQJS runtime (cursor_ide_boot_runtime.lua) + boot_bundle.lua embedded.
//!   - luajit_runtime.zig drives the VM; EQJS CursorIdeBootRuntime is instantiated
//!     inside Lua and renders via emit_mount_ops / emit_diff_ops.
//!   - Events: on_press callbacks call eqjs_dispatchEvent() which rerenders.
//!   - appTick: call luajit_runtime.callGlobal("__eqjs_tick") → rerenders dirty.
//!
//! Build:
//!   zig build eqjs -Dapp-name=cursor-ide-eqjs -Doptimize=ReleaseFast

const std = @import("std");
const build_options = @import("build_options");
const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;

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

// ── Embedded Lua sources ───────────────────────────────────────────────
const EQJS_RUNTIME_BYTES = @embedFile("/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua");
const BOOT_BUNDLE_BYTES  = @embedFile("/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua");

const WINDOW_TITLE = std.fmt.comptimePrint("{s}", .{
    if (@hasDecl(build_options, "app_name") and build_options.app_name.len > 0)
        build_options.app_name
    else
        "cursor-ide-eqjs",
});

const CUSTOM_CHROME_MODE = true;
const BORDERLESS_MODE = true;

// ── Globals ─────────────────────────────────────────────────────────────
var g_alloc: std.mem.Allocator = undefined;
var g_arena: std.heap.ArenaAllocator = undefined;
var g_node_by_id: std.AutoHashMap(u32, *Node) = undefined;
var g_children_ids: std.AutoHashMap(u32, std.ArrayList(u32)) = undefined;
var g_root_child_ids: std.ArrayList(u32) = .{};
var g_root: Node = .{};
var g_dirty: bool = true;
var g_press_expr_pool: std.ArrayList([:0]u8) = .{};
var g_input_slot_by_node_id: std.AutoHashMap(u32, u8) = undefined;
var g_node_id_by_input_slot: [input.MAX_INPUTS]u32 = [_]u32{0} ** input.MAX_INPUTS;

// Pending command batches (same deferred-apply pattern as qjs_app.zig)
var g_pending_flush: std.ArrayList([]u8) = .{};

// CHROME_HEIGHT and related constants (same values as qjs_app.zig)
const CHROME_HEIGHT: f32 = 32;
const CHROME_PAD: f32 = 6;
const TAB_PAD_H: f32 = 14;
const TAB_PAD_V: f32 = 4;

// ── Placeholder: functions to be filled in Phase 2.2–2.4 ──────────────

pub fn main() !void {
    if (IS_LIB) return;
    @panic("eqjs_cart_app.zig skeleton — implement phases 2.2–2.4 first");
}
```

Rationale: establishes the module structure, embed paths, and globals that mirror qjs_app.zig without importing QJS.

Verify:
```bash
cd /home/siah/creative/reactjit && \
  zig build-exe eqjs_cart_app.zig --name eqjs-check --zig-lib-dir $(zig env | grep lib_dir | cut -d'"' -f4) 2>&1 | grep -c "skeleton" || true
# Expected: compile error "skeleton" panic visible — file parses OK
```

---

**Step 2.1.2 — Copy input dispatch helpers verbatim from qjs_app.zig**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after globals section (after `g_pending_flush` declaration)
Action: add — copy lines 127–245 from `qjs_app.zig` verbatim (all the `isInputType`, `makeInputChangeCallback`, etc. helpers and comptime callback arrays). No QJS references in this block.

Verify:
```bash
grep -c "makeInputChangeCallback\|g_input_change_callbacks" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 2
```

---

**Step 2.1.3 — Copy color/prop parsing helpers verbatim**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after input callbacks
Action: add — copy lines 297–498 from `qjs_app.zig` (`jsonFloat`, `jsonInt`, `jsonBool`, `parseHex`, `parseRgb`, `parseColor`, `parseGutterRows`, `parseMinimapRows`, `parseColorTextRows`, `parseOverflow`, `parseDisplay`, `parsePosition`). No QJS references.

Verify:
```bash
grep -c "fn parseColor\|fn parseHex\|fn jsonFloat" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 3
```

---

**Step 2.1.4 — Copy `applyProps`, `applyTypeDefaults`, `applyHandlerFlags` verbatim**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after parsing helpers
Action: add — copy lines 499–1110 from `qjs_app.zig` (all the prop-application, type-defaults, handler-flag installation, canvas position helper). The only QJS reference in this range is at line 1091:
```zig
node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll;
```
and line 1094:
```zig
node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick;
```

Replace those two lines as follows (BEFORE → AFTER):

BEFORE (line 1091):
```zig
node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll;
```
AFTER:
```zig
// scroll handled by Lua tree scroll_persist_slot; no JS dispatch needed
```

BEFORE (line 1094):
```zig
node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick;
```
AFTER:
```zig
// right-click dispatch not wired in EQJS cart
```

Also replace lines 1076–1088 (`installJsExpr("__dispatchEvent(…)")` blocks):

BEFORE (lines 1076–1088 in qjs_app.zig):
```zig
        node.handlers.js_on_press = installJsExpr("__dispatchEvent({d},'onClick')\x00", id);
        ...
        node.handlers.js_on_mouse_down = installJsExpr("__dispatchEvent({d},'onMouseDown')\x00", id);
        ...
        node.handlers.js_on_mouse_up = installJsExpr("__dispatchEvent({d},'onMouseUp')\x00", id);
        ...
        node.handlers.js_on_hover_enter = installJsExpr("__dispatchEvent({d},'onHoverEnter')\x00", id);
        ...
        node.handlers.js_on_hover_exit = installJsExpr("__dispatchEvent({d},'onHoverExit')\x00", id);
```
AFTER:
```zig
        node.handlers.on_press = makeEqjsCallback(id, "onClick");
        node.handlers.on_mouse_down = makeEqjsCallback(id, "onMouseDown");
        node.handlers.on_mouse_up = makeEqjsCallback(id, "onMouseUp");
        node.handlers.lua_on_hover_enter = null; // EQJS drives hover via rerender
        node.handlers.lua_on_hover_exit  = null;
```

(The `makeEqjsCallback` function is defined in Phase 2.2 Step 2.2.3.)

Rationale: separates QJS-only event wiring from the structural props/node code which is identical.

Verify:
```bash
grep -c "fn applyProps\|fn applyTypeDefaults\|fn applyHandlerFlags" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 3
```

---

**Step 2.1.5 — Copy tree-management helpers verbatim**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after handler-flag section
Action: add — copy lines 1123–1384 from `qjs_app.zig` verbatim:
`ensureNode`, `inheritTypography`, `applyCommand`, `applyCommandBatch`, `materializeChildren`, `syncRenderedNodeState`, `markReachable`, `destroyDetachedNode`, `cleanupDetachedNodes`, `snapshotRuntimeState`.

Note: `applyCommandBatch` (line 1244) references `g_alloc` — that's a global, no QJS reference. Safe to copy verbatim.

The `host_flush` function (lines 1271–1290) is NOT copied — it's QJS-specific and replaced in Phase 2.2.

The `host_get_input_text_for_node` function (lines 1306–1315) is NOT copied — replaced in Phase 2.2.

`drainPendingFlushes` (lines 1292–1304) IS copied verbatim — it calls only `applyCommandBatch` and `g_alloc`, no QJS.

Verify:
```bash
grep -c "fn applyCommand\b\|fn applyCommandBatch\|fn drainPendingFlushes\|fn materializeChildren" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 4
```

---

**Step 2.1.6 — Copy chrome/resize node builders verbatim**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after tree helpers
Action: add — copy lines 1390–1595 from `qjs_app.zig` verbatim:
`onWinMinimize`, `onWinMaximize`, `onWinClose`, `buildChromeNode`, `buildResizeEdges`, `rebuildTree`.
No QJS references in this range.

Verify:
```bash
grep -c "fn buildChromeNode\|fn rebuildTree\|fn buildResizeEdges" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 3
```

---

### Phase 2.2 — Runtime swap: EQJS init/tick/event instead of QJS

---

**Step 2.2.1 — Add EQJS global state and Lua host function for input text**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after globals section (after `g_pending_flush` declaration)
Action: add the following block:

```zig
// ── EQJS runtime globals ────────────────────────────────────────────────
// g_eqjs_dirty: set to true by event callbacks to request a rerender next tick.
var g_eqjs_dirty: bool = false;

// Lua host function: __getInputTextForNode(node_id) -> string
// Registered as a Lua global so EQJS Lua can call it.
const lua = luajit_runtime.lua;
fn eqjs_host_get_input_text(L: ?*lua.lua_State) callconv(.c) c_int {
    const node_id_raw = lua.lua_tointeger(L, 1);
    if (node_id_raw <= 0) {
        lua.lua_pushstring(L, "");
        return 1;
    }
    const slot = g_input_slot_by_node_id.get(@intCast(node_id_raw)) orelse {
        lua.lua_pushstring(L, "");
        return 1;
    };
    const text = input.getText(slot);
    if (text.len == 0) {
        lua.lua_pushstring(L, "");
    } else {
        lua.lua_pushlstring(L, text.ptr, @intCast(text.len));
    }
    return 1;
}
```

Rationale: replaces the QJS-typed `host_get_input_text_for_node` with a pure-Lua-C-function version.

Verify:
```bash
grep -c "eqjs_host_get_input_text\|g_eqjs_dirty" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 2
```

---

**Step 2.2.2 — Add `eqjs_luaHostFlush` — Lua-callable replacement for `__hostFlush`**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: immediately after the block added in Step 2.2.1
Action: add:

```zig
// __eqjs_host_flush(json_str) — called from Lua when EQJS emits a command batch.
// Mirrors the deferred-apply pattern of host_flush in qjs_app.zig.
fn eqjs_host_flush(L: ?*lua.lua_State) callconv(.c) c_int {
    var len: usize = 0;
    const ptr = lua.lua_tolstring(L, 1, &len);
    if (ptr == null or len == 0) return 0;
    const slice: []const u8 = @as([*]const u8, @ptrCast(ptr))[0..len];
    const owned = g_alloc.dupe(u8, slice) catch return 0;
    g_pending_flush.append(g_alloc, owned) catch {
        g_alloc.free(owned);
        return 0;
    };
    g_dirty = true;
    return 0;
}
```

Rationale: EQJS emits JSON command batches from Lua (same schema as React reconciler). We accept them via a Lua global and queue identically to `host_flush`.

Verify:
```bash
grep -c "fn eqjs_host_flush" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 1
```

---

**Step 2.2.3 — Add `makeEqjsCallback` and per-node event dispatch**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `eqjs_host_flush`
Action: add:

```zig
// Per-node EQJS event dispatch. When a node is pressed, we call the Lua global
// __eqjs_dispatch(node_id, event_name) which drives rerender inside Lua.
fn eqjs_dispatchEvent(node_id: u32, event_name: [*:0]const u8) void {
    luajit_runtime.callGlobalStr("__eqjs_dispatch", std.fmt.allocPrintZ(g_alloc, "{d}", .{node_id}) catch return);
    // Note: above is wrong — we need to pass both args. Use callGlobal2 pattern:
    const L = luajit_runtime.g_lua orelse return;
    _ = lua.lua_getglobal(L, "__eqjs_dispatch");
    if (lua.lua_isfunction(L, -1) == 0) { lua.lua_pop(L, 1); return; }
    lua.lua_pushinteger(L, @intCast(node_id));
    lua.lua_pushstring(L, event_name);
    if (lua.lua_pcall(L, 2, 0, 0) != 0) {
        var elen: usize = 0;
        const err = lua.lua_tolstring(L, -1, &elen);
        if (err != null) std.log.err("[eqjs] dispatch error: {s}", .{@as([*]const u8, @ptrCast(err))[0..elen]});
        lua.lua_pop(L, 1);
    }
    g_eqjs_dirty = true;
    g_dirty = true;
}

// Comptime callback factory: one on_press fn per node_id is not feasible for
// dynamic IDs. Instead, store the node_id in a per-frame table and use a
// single trampoline registered as the on_press callback.
// Strategy: wire node.handlers.on_press to a global trampoline that reads
// g_last_pressed_node_id set by engine just before calling on_press.
// For now, use installJsExpr-equivalent: store a [:0]u8 in g_press_expr_pool.
fn makeEqjsCallback(id: u32, event_name: []const u8) ?*const fn () void {
    // We cannot close over id at runtime in Zig without heap allocation.
    // Pattern: allocate a null-terminated string "id:event_name\0" and store
    // it in g_press_expr_pool. Then register a single trampoline on_press that
    // reads node.handlers.eqjs_event_key and dispatches.
    //
    // SIMPLER approach that matches engine.zig's handler model: store the
    // event string as node.handlers.lua_on_press (which engine evals via
    // luajit_runtime.evalExpr). We format it as a Lua call to __eqjs_dispatch.
    const expr = std.fmt.allocPrintZ(g_alloc, "__eqjs_dispatch({d},'{s}')", .{ id, event_name }) catch return null;
    g_press_expr_pool.append(g_alloc, expr) catch {
        g_alloc.free(expr);
        return null;
    };
    return null; // returned value not used — caller sets lua_on_press instead
}

// Variant that returns the [:0]u8 for use as node.handlers.lua_on_press.
fn makeEqjsLuaExpr(id: u32, event_name: []const u8) ?[:0]const u8 {
    const expr = std.fmt.allocPrintZ(g_alloc, "__eqjs_dispatch({d},'{s}')", .{ id, event_name }) catch return null;
    g_press_expr_pool.append(g_alloc, expr) catch {
        g_alloc.free(expr);
        return null;
    };
    return expr;
}
```

Rationale: EQJS events are dispatched via a Lua global `__eqjs_dispatch(node_id, event_name)` that the EQJS Lua glue (defined in Step 2.2.6) wires to `runtime:rerender_instance`. We use `lua_on_press` (evaluated by luajit_runtime.evalExpr) instead of `js_on_press`.

**Also update** Step 2.1.4's handler replacement in `applyHandlerFlags` to use `makeEqjsLuaExpr` rather than `makeEqjsCallback`. Specifically, in the copy of `applyHandlerFlags`, wherever Step 2.1.4 said to write:
```zig
node.handlers.on_press = makeEqjsCallback(id, "onClick");
```
Instead write:
```zig
node.handlers.lua_on_press = makeEqjsLuaExpr(id, "onClick");
node.handlers.lua_on_hover_enter = makeEqjsLuaExpr(id, "onHoverEnter");
node.handlers.lua_on_hover_exit  = makeEqjsLuaExpr(id, "onHoverExit");
```

Verify:
```bash
grep -c "fn makeEqjsLuaExpr\|fn eqjs_dispatchEvent\|__eqjs_dispatch" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 3
```

---

**Step 2.2.4 — Add input dispatch helpers (replacing qjs_runtime.callGlobal path)**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `makeEqjsLuaExpr`
Action: add — copy `dispatchInputEvent` and `dispatchInputKeyEvent` from `qjs_app.zig` lines 153–207, BUT replace the QJS dispatch calls:

BEFORE (qjs_app.zig lines 156–163):
```zig
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobalInt(global_name, @intCast(node_id));
    qjs_runtime.callGlobal("__endJsEvent");
    if (luajit_runtime.hasGlobal(global_name)) {
        luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    }
```
AFTER:
```zig
    luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    g_eqjs_dirty = true;
    g_dirty = true;
```

BEFORE (qjs_app.zig lines 201–207 for `dispatchInputKeyEvent`):
```zig
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    qjs_runtime.callGlobal("__endJsEvent");
    if (luajit_runtime.hasGlobal("__dispatchInputKey")) {
        luajit_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    }
```
AFTER:
```zig
    luajit_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    g_eqjs_dirty = true;
    g_dirty = true;
```

Then copy the comptime callback arrays (`g_input_change_callbacks`, etc.) and `ensureInputSlot`, `syncInputValue`, `releaseInputSlot` verbatim (lines 217–294 in qjs_app.zig) — no QJS references.

Verify:
```bash
grep -c "fn dispatchInputEvent\|fn ensureInputSlot\|fn syncInputValue" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 3
```

---

**Step 2.2.5 — Add `installEqjsExpr` helper (replaces `installJsExpr`)**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `releaseInputSlot`
Action: add:

```zig
// Like qjs_app.installJsExpr but writes to g_press_expr_pool and returns
// a Lua expression string (not a JS expression).
fn installEqjsExpr(comptime fmt: []const u8, id: u32) ?[:0]const u8 {
    const expr = std.fmt.allocPrintZ(g_alloc, fmt, .{id}) catch return null;
    g_press_expr_pool.append(g_alloc, expr) catch {
        g_alloc.free(expr);
        return null;
    };
    return expr;
}
```

Rationale: matches the resource-management pattern of `installJsExpr` in qjs_app.zig (lines ~1060–1070) for arena-tracked strings.

Verify:
```bash
grep -c "fn installEqjsExpr" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 1
```

---

### Phase 2.3 — Bundle swap: embed Lua, wire EQJS init glue

---

**Step 2.3.1 — Write EQJS Lua glue script (loaded at `appInit`)**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `installEqjsExpr`
Action: add the following comptime string constant:

```zig
// ── EQJS init glue (loaded after the runtime + bundle) ────────────────
// This Lua chunk:
//   1. Loads cursor_ide_boot_runtime.lua (embedded as string)
//   2. Loads boot_bundle.lua (embedded as string)
//   3. Instantiates CursorIdeApp
//   4. Emits mount ops as JSON → calls __eqjs_host_flush for each batch
//   5. Defines __eqjs_dispatch(node_id, event_name) for on_press wiring
//   6. Defines __eqjs_tick() called each frame to check dirty state
const EQJS_GLUE =
    \\-- EQJS glue: load runtime + bundle, instantiate, mount
    \\local ok, err
    \\
    \\-- Load the EQJS runtime class
    \\ok, CursorIdeBootRuntime = pcall(load, __eqjs_runtime_src, "=cursor_ide_boot_runtime", "t", _ENV)
    \\if not ok then error("runtime load failed: " .. tostring(CursorIdeBootRuntime)) end
    \\ok, CursorIdeBootRuntime = pcall(CursorIdeBootRuntime)
    \\if not ok then error("runtime exec failed: " .. tostring(CursorIdeBootRuntime)) end
    \\
    \\-- Load the boot bundle
    \\ok, __eqjs_bundle_fn = pcall(load, __eqjs_bundle_src, "=boot_bundle", "t", _ENV)
    \\if not ok then error("bundle load failed: " .. tostring(__eqjs_bundle_fn)) end
    \\ok, __eqjs_bundle = pcall(__eqjs_bundle_fn)
    \\if not ok then error("bundle exec failed: " .. tostring(__eqjs_bundle)) end
    \\
    \\-- Wire global_this host functions (registered from Zig via registerHostFn)
    \\local global_this = {
    \\  __store_get     = __store_get,
    \\  __store_set     = __store_set,
    \\  __exec          = __exec,
    \\  __fs_readfile   = __fs_readfile,
    \\  __fs_writefile  = __fs_writefile,
    \\  __tel_system    = __tel_system,
    \\  __pty_open      = __pty_open,
    \\  __windowClose   = __windowClose,
    \\  __windowMinimize = __windowMinimize,
    \\  __windowMaximize = __windowMaximize,
    \\  __getInputTextForNode = __getInputTextForNode,
    \\}
    \\
    \\__eqjs_runtime = CursorIdeBootRuntime.new(__eqjs_bundle)
    \\__eqjs_runtime:set_global_this(global_this)
    \\
    \\-- Instantiate entry component
    \\local instance, inst_err = __eqjs_runtime:instantiate_entry({})
    \\if not instance then error("instantiate_entry failed: " .. tostring(inst_err)) end
    \\__eqjs_instance = instance
    \\
    \\-- Emit mount ops as JSON command batch
    \\local mount_ops, mount_tree = __eqjs_runtime:emit_mount_ops(instance.tree)
    \\__eqjs_host_tree = mount_tree
    \\if mount_ops and #mount_ops > 0 then
    \\  -- Encode ops to JSON and send to host via __eqjs_host_flush
    \\  local batch = {}
    \\  for _, op in ipairs(mount_ops) do
    \\    batch[#batch+1] = __eqjs_op_to_json(op)
    \\  end
    \\  __eqjs_host_flush("[" .. table.concat(batch, ",") .. "]")
    \\end
    \\
    \\-- __eqjs_dispatch(node_id, event_name): called by lua_on_press expressions
    \\function __eqjs_dispatch(node_id, event_name)
    \\  if not __eqjs_instance then return end
    \\  -- Inject event into instance props (cart reads from global_this handlers)
    \\  -- For now, mark dirty and let __eqjs_tick rerender with same props.
    \\  __eqjs_pending_event = { node_id = node_id, event_name = event_name }
    \\  __eqjs_needs_rerender = true
    \\end
    \\
    \\-- __eqjs_tick(): called every frame by appTick
    \\function __eqjs_tick()
    \\  if not __eqjs_needs_rerender then return end
    \\  __eqjs_needs_rerender = false
    \\  local rerendered, rerr = __eqjs_runtime:rerender_instance(__eqjs_instance)
    \\  if not rerendered then
    \\    __hostLog("rerender failed: " .. tostring(rerr))
    \\    return
    \\  end
    \\  local diff_ops, new_tree = __eqjs_runtime:emit_diff_ops(__eqjs_host_tree, __eqjs_instance.tree)
    \\  __eqjs_host_tree = new_tree
    \\  if diff_ops and #diff_ops > 0 then
    \\    local batch = {}
    \\    for _, op in ipairs(diff_ops) do
    \\      batch[#batch+1] = __eqjs_op_to_json(op)
    \\    end
    \\    __eqjs_host_flush("[" .. table.concat(batch, ",") .. "]")
    \\  end
    \\end
    \\
    \\-- JSON encoder for EQJS ops (same schema as React reconciler)
    \\function __eqjs_op_to_json(op)
    \\  local function escape(s)
    \\    return (tostring(s):gsub('"', '\\"'):gsub('\n', '\\n'))
    \\  end
    \\  local parts = { string.format('{"op":"%s","id":%d', escape(op.op or ""), op.id or 0) }
    \\  if op.parent_id then parts[#parts+1] = string.format(',"parentId":%d', op.parent_id) end
    \\  if op.before_id then parts[#parts+1] = string.format(',"beforeId":%d', op.before_id) end
    \\  if op.child_id  then parts[#parts+1] = string.format(',"childId":%d', op.child_id) end
    \\  if op.text      then parts[#parts+1] = string.format(',"text":"%s"', escape(op.text)) end
    \\  if op.type_name then parts[#parts+1] = string.format(',"type":"%s"', escape(op.type_name)) end
    \\  if op.props_json then parts[#parts+1] = ',"props":' .. op.props_json end
    \\  parts[#parts+1] = "}"
    \\  return table.concat(parts)
    \\end
;
```

Rationale: the glue wires the pure-Lua EQJS runtime to Zig's command-batch pipeline without any C FFI beyond what luajit_runtime already provides.

Verify:
```bash
grep -c "EQJS_GLUE\|__eqjs_tick\|__eqjs_dispatch\|__eqjs_op_to_json" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 4
```

---

**Step 2.3.2 — Write `appInit()` using EQJS**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `EQJS_GLUE` constant
Action: add:

```zig
fn appInit() void {
    // Persistent storage substrate
    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});

    // Register __getInputTextForNode as a Lua global
    luajit_runtime.registerHostFn("__getInputTextForNode", @ptrCast(&eqjs_host_get_input_text), 1);

    // Register __eqjs_host_flush as a Lua global
    luajit_runtime.registerHostFn("__eqjs_host_flush", @ptrCast(&eqjs_host_flush), 1);

    // Inject runtime + bundle source strings into Lua globals
    // so the glue can load() them without filesystem access.
    const L = luajit_runtime.g_lua orelse {
        std.log.err("[eqjs] Lua state not initialized before appInit", .{});
        return;
    };
    lua.lua_pushlstring(L, EQJS_RUNTIME_BYTES.ptr, EQJS_RUNTIME_BYTES.len);
    lua.lua_setglobal(L, "__eqjs_runtime_src");
    lua.lua_pushlstring(L, BOOT_BUNDLE_BYTES.ptr, BOOT_BUNDLE_BYTES.len);
    lua.lua_setglobal(L, "__eqjs_bundle_src");

    // Register all host globals declared in boot_bundle.host_globals.
    // These are Lua globals needed by the cart (pty, fs, store, telemetry, etc.).
    // They are forwarded from the framework's existing qjs_bindings-equivalent stubs
    // or registered as no-ops if not available.
    registerEqjsHostGlobals(L);

    // Run the glue script — this instantiates the entry component and emits mount ops.
    luajit_runtime.evalScript(EQJS_GLUE);

    std.log.info("[eqjs] appInit complete", .{});
}
```

Rationale: mirrors qjs_app.zig's `appInit` but registers Lua-callable stubs instead of QJS host functions. The glue script runs via `evalScript` which goes through the same `luaL_loadbuffer + lua_pcall` path.

Verify:
```bash
grep -c "fn appInit\b" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 1
```

---

**Step 2.3.3 — Write `registerEqjsHostGlobals` stub table**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: immediately before `appInit`
Action: add:

```zig
// Register all globals listed in boot_bundle.host_globals.
// Each one needs to exist as a Lua global or the glue's global_this table
// construction will silently set nil values. We provide functional stubs
// for the ones that have Zig-side implementations.
fn registerEqjsHostGlobals(L: *lua.lua_State) void {
    // Helper: register a no-op that returns 0
    const noopFn: lua.lua_CFunction = struct {
        fn f(_: ?*lua.lua_State) callconv(.c) c_int { return 0; }
    }.f;
    const stubs = [_][*:0]const u8{
        "__beginTerminalDockResize", "__endTerminalDockResize",
        "__claude_close", "__claude_init", "__claude_poll", "__claude_send",
        "__exec", "__fs_readfile", "__fs_writefile",
        "__kimi_close", "__kimi_init", "__kimi_poll", "__kimi_send",
        "__play_load", "__play_state", "__play_step", "__play_toggle",
        "__pty_open",
        "__rec_frame_count", "__rec_is_recording", "__rec_save",
        "__rec_start", "__rec_stop",
        "__setTerminalDockHeight",
        "__store_del", "__store_get", "__store_set",
        "__tel_system",
        "__windowClose", "__windowMaximize", "__windowMinimize",
    };
    for (stubs) |name| {
        lua.lua_pushcclosure(L, noopFn, 0);
        lua.lua_setglobal(L, name);
    }

    // Functional overrides where Zig has real implementations:
    // __windowClose / Minimize / Maximize use engine callbacks
    lua.lua_pushcclosure(L, struct {
        fn f(_: ?*lua.lua_State) callconv(.c) c_int { engine.windowClose(); return 0; }
    }.f, 0);
    lua.lua_setglobal(L, "__windowClose");

    lua.lua_pushcclosure(L, struct {
        fn f(_: ?*lua.lua_State) callconv(.c) c_int { engine.windowMinimize(); return 0; }
    }.f, 0);
    lua.lua_setglobal(L, "__windowMinimize");

    lua.lua_pushcclosure(L, struct {
        fn f(_: ?*lua.lua_State) callconv(.c) c_int { engine.windowMaximize(); return 0; }
    }.f, 0);
    lua.lua_setglobal(L, "__windowMaximize");

    // __tel_system returns window dimensions
    lua.lua_pushcclosure(L, struct {
        fn f(Lx: ?*lua.lua_State) callconv(.c) c_int {
            lua.lua_newtable(Lx);
            lua.lua_pushnumber(Lx, 1280);
            lua.lua_setfield(Lx, -2, "window_w");
            lua.lua_pushnumber(Lx, 800);
            lua.lua_setfield(Lx, -2, "window_h");
            return 1;
        }
    }.f, 0);
    lua.lua_setglobal(L, "__tel_system");
}
```

Rationale: boot_bundle.host_globals lists 27 globals; without them the glue's `global_this` table has nil values and cart code will nil-index crash. No-ops are safe for non-critical functions; window controls and telemetry need real implementations.

Verify:
```bash
grep -c "fn registerEqjsHostGlobals" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 1
```

---

**Step 2.3.4 — Write `appTick()` using EQJS tick**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `appInit`
Action: add:

```zig
fn appTick(now: u32) void {
    _ = now;

    // Drain pending command batches from the Lua side (queued by __eqjs_host_flush).
    // Must happen BEFORE rebuildTree.
    drainPendingFlushes();

    // Call __eqjs_tick: rerenders if state changed (event fired, etc.)
    luajit_runtime.callGlobal("__eqjs_tick");

    // Drain any new batches emitted by the tick rerender.
    drainPendingFlushes();

    if (g_dirty) {
        snapshotRuntimeState();
        rebuildTree();
        layout.markLayoutDirty();
        g_dirty = false;
    }
}
```

Rationale: replaces qjs_app.zig's appTick which calls `qjs_bindings.tickDrain`, `qjs_runtime.callGlobalInt("__jsTick", …)`. EQJS has no JS timers or QJS async hooks; tick is purely "rerender if dirty".

Verify:
```bash
grep -c "fn appTick\b" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 1
```

---

**Step 2.3.5 — Write `main()` using EQJS**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: after `appTick`, replacing the skeleton `main` added in Step 2.1.1
Action: replace the skeleton `main` function with:

BEFORE:
```zig
pub fn main() !void {
    if (IS_LIB) return;
    @panic("eqjs_cart_app.zig skeleton — implement phases 2.2–2.4 first");
}
```

AFTER:
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
        .lua_logic = "",        // blank — appInit loads via luajit_runtime.evalScript
        .init = appInit,
        .tick = appTick,
        .borderless = BORDERLESS_MODE,
        .set_canvas_node_position = setCanvasNodePosition,
    });
}
```

Note: `js_logic = ""` suppresses QJS eval in engine.run. `lua_logic = ""` is fine — luajit_runtime.initVM() is still called by engine (it always initializes the Lua VM), and `appInit` manually calls `evalScript(EQJS_GLUE)` after registering host functions.

Verify:
```bash
grep -n "pub fn main" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: one line, not the @panic version
grep "panic" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output (panic removed)
```

---

**Step 2.3.6 — Add `setCanvasNodePosition` (required by engine.AppConfig)**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: before `appInit`
Action: copy verbatim from qjs_app.zig lines 1116–1121:

```zig
fn setCanvasNodePosition(id: u32, gx: f32, gy: f32) void {
    if (g_node_by_id.get(id)) |node| {
        node.canvas_gx = gx;
        node.canvas_gy = gy;
    }
}
```

Verify:
```bash
grep -c "fn setCanvasNodePosition" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: 1
```

---

### Phase 2.4 — Build wiring

---

**Step 2.4.1 — Add `eqjs` build step to `build.zig`**

File: `/home/siah/creative/reactjit/build.zig`
Location: lines 162–163 (after existing `app_step`)
Action: add after the existing `app_step` block:

BEFORE (line 162–163):
```zig
    const app_step = b.step("app", "Build the qjs_app binary");
    app_step.dependOn(&b.addInstallArtifact(exe, .{}).step);
```

AFTER:
```zig
    const app_step = b.step("app", "Build the qjs_app binary");
    app_step.dependOn(&b.addInstallArtifact(exe, .{}).step);

    // ── EQJS cart build step ──────────────────────────────────────
    // Same deps/flags as the app step but:
    //   - root source: eqjs_cart_app.zig
    //   - has_quickjs: false (no QJS C sources compiled)
    //   - has_debug_server: false (no QJS IPC server)
    const eqjs_options = b.addOptions();
    eqjs_options.addOption(bool, "is_lib", false);
    eqjs_options.addOption([]const u8, "app_name", app_name);
    eqjs_options.addOption(bool, "dev_mode", false);
    eqjs_options.addOption(bool, "has_quickjs", false);
    eqjs_options.addOption(bool, "has_physics", true);
    eqjs_options.addOption(bool, "has_terminal", true);
    eqjs_options.addOption(bool, "has_video", true);
    eqjs_options.addOption(bool, "has_render_surfaces", true);
    eqjs_options.addOption(bool, "has_effects", true);
    eqjs_options.addOption(bool, "has_canvas", true);
    eqjs_options.addOption(bool, "has_3d", true);
    eqjs_options.addOption(bool, "has_transitions", true);
    eqjs_options.addOption(bool, "has_networking", true);
    eqjs_options.addOption(bool, "has_crypto", true);
    eqjs_options.addOption(bool, "has_blend2d", false);
    eqjs_options.addOption(bool, "has_debug_server", false);

    const eqjs_mod = b.createModule(.{
        .root_source_file = b.path("eqjs_cart_app.zig"),
        .target = target,
        .optimize = optimize,
    });
    eqjs_mod.addOptions("build_options", eqjs_options);
    eqjs_mod.addImport("wgpu", wgpu_mod);
    eqjs_mod.addImport("tls", tls_mod);
    eqjs_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

    const eqjs_exe = b.addExecutable(.{
        .name = app_name,
        .root_module = eqjs_mod,
    });
    eqjs_exe.stack_size = 64 * 1024 * 1024;
    eqjs_exe.linkLibC();
    eqjs_exe.linkSystemLibrary("SDL3");
    eqjs_exe.linkSystemLibrary("freetype");
    eqjs_exe.linkSystemLibrary("luajit-5.1");

    if (os_tag == .linux) {
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/usr/include/luajit-2.1" });
        eqjs_exe.linkSystemLibrary("X11");
        eqjs_exe.linkSystemLibrary("m");
        eqjs_exe.linkSystemLibrary("pthread");
        eqjs_exe.linkSystemLibrary("dl");
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
    } else if (os_tag == .macos) {
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/luajit-2.1" });
        eqjs_mod.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
        eqjs_exe.linkFramework("Foundation");
        eqjs_exe.linkFramework("QuartzCore");
        eqjs_exe.linkFramework("Metal");
        eqjs_exe.linkFramework("Cocoa");
        eqjs_exe.linkFramework("IOKit");
        eqjs_exe.linkFramework("CoreVideo");
        eqjs_mod.addCSourceFile(.{ .file = b.path("framework/ffi/applescript_shim.m"), .flags = &.{"-O2"} });
    }

    eqjs_mod.addIncludePath(b.path("."));
    eqjs_mod.addIncludePath(b.path("framework/ffi"));
    // NOTE: NO love2d/quickjs include path here

    eqjs_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    eqjs_mod.addCSourceFile(.{ .file = b.path("framework/ffi/compute_shim.c"), .flags = &.{"-O2"} });
    eqjs_mod.addCSourceFile(.{ .file = b.path("framework/ffi/physics_shim.cpp"), .flags = &.{"-O2"} });
    eqjs_exe.linkSystemLibrary("box2d");
    eqjs_exe.linkSystemLibrary("sqlite3");
    eqjs_exe.linkSystemLibrary("vterm");
    eqjs_exe.linkSystemLibrary("curl");
    eqjs_exe.linkLibCpp();

    if (os_tag == .linux) {
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
    } else if (os_tag == .macos) {
        eqjs_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
    }

    b.installArtifact(eqjs_exe);
    const eqjs_step = b.step("eqjs", "Build the eqjs_cart_app binary (LuaJIT, no QuickJS)");
    eqjs_step.dependOn(&b.addInstallArtifact(eqjs_exe, .{}).step);
```

Rationale: separate step so the original `app` step (qjs_app.zig) is unaffected. `has_quickjs = false` prevents qjs_runtime.zig from importing quickjs.h.

Verify:
```bash
grep -c "eqjs_step\|eqjs_exe\|eqjs_mod\|eqjs_options" /home/siah/creative/reactjit/build.zig
# Expected: >= 4
```

---

**Step 2.4.2 — Build with ReleaseFast and verify binary size**

```bash
cd /home/siah/creative/reactjit
zig build eqjs -Dapp-name=cursor-ide-eqjs -Doptimize=ReleaseFast 2>&1 | tail -20
# Expected: no errors, exits 0

ls -lh zig-out/bin/cursor-ide-eqjs
# Expected: ~80-120MB pre-strip (debug info embedded)

strip zig-out/bin/cursor-ide-eqjs
ls -lh zig-out/bin/cursor-ide-eqjs
# Expected: ~25-35MB post-strip (satisfies ~30MB constraint)
```

---

### Phase 2.5 — Smoke

---

**Step 2.5.1 — Launch binary and verify window opens**

```bash
cd /home/siah/creative/reactjit
./zig-out/bin/cursor-ide-eqjs &
sleep 2
# Expected: window appears with cursor-ide title bar visible, no crash
```

**Step 2.5.2 — Verify UI renders**

Manual check: window should show cursor-ide top bar (with branch strip / nav toolbar at minimum). Check stderr for Lua errors:
```bash
./zig-out/bin/cursor-ide-eqjs 2>&1 | grep -E "error|Error|panic" | head -20
# Expected: no lines (or only non-fatal warnings)
```

**Step 2.5.3 — Verify click triggers rerender**

Manual check: click a tab or pressable button. Observe:
- No crash / SIGSEGV
- `[eqjs]` log shows rerender triggered
```bash
./zig-out/bin/cursor-ide-eqjs 2>&1 | grep "eqjs" | head -10
# Expected: "[eqjs] appInit complete" on startup
```

---

## 3. Expected blockers + fallback guidance

### B1 — `qjs_runtime.zig` is imported by `luajit_runtime.zig` (line 18)
`luajit_runtime.zig` imports `qjs_runtime` for `syncLuaToQjs`, `evalToLua`, `callGlobal`, `callGlobalReturnToLua`. With `has_quickjs=false`, qjs_runtime.zig's QJS functions become no-ops, so this import compiles. **BUT** if `qjs_runtime.zig` unconditionally imports `quickjs.h` (line 31–38), a no-QJS build must guard with `if (HAS_QUICKJS)`.

Check: `grep -n "HAS_QUICKJS" /home/siah/creative/reactjit/framework/qjs_runtime.zig | head -5`

If `qjs_runtime.zig` already has `if (HAS_QUICKJS) @cImport(…) else struct {…}` (line 30–38 of qjs_runtime.zig, confirmed in this read), this is safe. The key: confirm `qjs_bindings.zig` is NOT imported by `luajit_runtime.zig` — if it is, add `HAS_QUICKJS` guard.

**Fallback**: if `qjs_bindings` import causes compile error, add `const qjs_bindings = if (HAS_QUICKJS) @import("qjs_bindings.zig") else struct { pub fn tickDrain() void {} };` at the top of any file that imports it.

---

### B2 — `engine.AppConfig.lua_logic = ""` triggers Lua no-eval path
If `engine.zig` only calls `luajit_runtime.initVM()` when `lua_logic.len > 0`, then the EQJS glue loaded in `appInit` won't have a Lua state. Check:
```bash
grep -n "lua_logic\|initVM\|evalScript" /home/siah/creative/reactjit/framework/engine.zig | head -20
```

**Fallback**: if engine only inits Lua when `lua_logic.len > 0`, change `appInit` to call `luajit_runtime.initVM()` directly before the glue injection, then call `evalScript(EQJS_GLUE)`. If `initVM` is idempotent (checks `g_lua != null`), double-calling is safe.

---

### B3 — EQJS `emit_mount_ops` / `emit_diff_ops` op schema differs from `applyCommand` expectations
`applyCommand` expects ops with fields: `op` (string: "CREATE", "UPDATE", etc.), `id`, `parentId`, `childId`, `props` (JSON object), `type`, `text`.

The EQJS diff bridge sample (`path_cursor_ide_boot_diff_bridge.lua`) shows ops like `{ op = "CREATE", id = N, type_name = "…", props_json = "…" }`. The field names differ: `type_name` vs `type`, `props_json` vs `props`.

**Fallback**: in `__eqjs_op_to_json` (EQJS_GLUE constant), add mappings:
- `op.type_name` → emit as `"type"`
- `op.props_json` → emit as `"props":` + raw JSON
- `op.parent_id` → emit as `"parentId"`

The `__eqjs_op_to_json` function in Step 2.3.1 already does this. If ops don't render, add a debug dump: `__hostLog(table_to_json(op))` inside `__eqjs_tick` before encoding.

---

### B4 — `has_quickjs=false` causes `qjs_runtime.zig:syncLuaToQjs` to be called from `luajit_runtime.zig:hostSyncToJS`
`luajit_runtime.zig` line 1052 calls `qjs_runtime.syncLuaToQjs(name_z)` unconditionally. With `has_quickjs=false`, `qjs_runtime.syncLuaToQjs` should be a no-op (check its body). If not, it will crash trying to access `g_qjs_ctx = null`.

Check: `grep -A5 "pub fn syncLuaToQjs" /home/siah/creative/reactjit/framework/qjs_runtime.zig`

**Fallback**: if `syncLuaToQjs` dereferences `g_qjs_ctx` without null check, it will segfault. Add a guard at the top of the function: `if (!HAS_QUICKJS or g_qjs_ctx == null) return;`

---

### B5 — EQJS bundle is 213k lines / ~8MB; embedFile may hit comptime memory limits
`@embedFile` of an 8MB file at comptime can slow down `zig build` but should not fail. If it does:

**Fallback**: write the bundle bytes to a tmp file at runtime instead. In `appInit`, change:
```zig
const BOOT_BUNDLE_BYTES = @embedFile("...");
```
to read from disk:
```zig
const bundle_path = "/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua";
const bundle_bytes = std.fs.cwd().readFileAlloc(g_alloc, bundle_path, 32*1024*1024) catch @panic("boot_bundle.lua not found");
```
Then push `bundle_bytes` instead of `BOOT_BUNDLE_BYTES` as `__eqjs_bundle_src`.

---

### B6 — `framework/luajit_runtime.zig` calls `qjs_runtime.evalToLua` / `qjs_runtime.callGlobal` from `hostEval` / `hostCallJS`
Lines 1064 and 1077 in `luajit_runtime.zig` call into `qjs_runtime`. With no QJS context, these return false/no-op (confirmed: `evalToLua` in qjs_runtime checks `g_qjs_ctx == null`). The EQJS cart doesn't use `__eval` or `__callJS` Lua globals from the boot bundle, so these are dead paths. No action needed.

---

### B7 — `framework/dev_ipc.zig` imported by `qjs_app.zig` is NOT in `eqjs_cart_app.zig`
Confirmed: `eqjs_cart_app.zig` does NOT import `dev_ipc` — it has no DEV_MODE tab-switching logic. This is intentional (EQJS has no hot-reload in this port). If tab switching is needed later, it can be added.

---

## 4. Final verification checklist

Run each check before declaring the port complete:

| # | Check | Command | Pass condition |
|---|-------|---------|----------------|
| V1 | Build succeeds | `cd /home/siah/creative/reactjit && zig build eqjs -Dapp-name=cursor-ide-eqjs -Doptimize=ReleaseFast` | exit 0, no compile errors |
| V2 | Pre-strip size reasonable | `ls -lh zig-out/bin/cursor-ide-eqjs` | < 200MB |
| V3 | Strip reduces to ~30MB | `strip zig-out/bin/cursor-ide-eqjs && ls -lh zig-out/bin/cursor-ide-eqjs` | 20–40MB |
| V4 | Binary launches window | `./zig-out/bin/cursor-ide-eqjs` | window opens, no crash within 3s |
| V5 | No Lua errors on startup | `./zig-out/bin/cursor-ide-eqjs 2>&1 \| grep -E "\\[luajit-runtime\\].*error\|panic"` | no output |
| V6 | appInit log present | `./zig-out/bin/cursor-ide-eqjs 2>&1 \| grep "eqjs.*complete"` | at least one line |
| V7 | UI renders | manual: cursor-ide top bar visible, branch strip present | visual confirm |
| V8 | Click triggers rerender | manual: press a tab/button, no crash | visual confirm + no SIGSEGV |
| V9 | QJS sources excluded | `ldd zig-out/bin/cursor-ide-eqjs \| grep quickjs` | no output (QJS not linked) |
| V10 | LuaJIT linked | `ldd zig-out/bin/cursor-ide-eqjs \| grep luajit` | libluajit-5.1.so listed |
