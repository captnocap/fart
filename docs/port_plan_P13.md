# EQJS Cart Port Plan — Panel P13

## 0. Inventory

### 0.1 QJS-specific symbols in `qjs_app.zig` (grep -n evidence)

| Line(s) | QJS Symbol | LuaJIT-equivalent in `luajit_runtime.zig` |
|---------|-----------|------------------------------------------|
| 24 | `const qjs_runtime = @import("framework/qjs_runtime.zig");` | `const luajit_runtime = @import("framework/luajit_runtime.zig");` (already imported at L26) |
| 25 | `const qjs_bindings = @import("framework/qjs_bindings.zig");` | **DROP** — no Lua equivalent; tickDrain() call at L1786 must be removed or no-op'd |
| 31-33 | `const qjs = @cImport({ @cInclude("quickjs.h"); });` | **DROP** — LuaJIT headers are in `luajit_runtime.zig`, cart does not cImport lua directly |
| 38-39 | `BUNDLE_FILE_NAME = "bundle-{app_name}.js"` / `BUNDLE_BYTES = @embedFile(...)` | `BUNDLE_BYTES = @embedFile("generated/cursor-ide-boot/boot_bundle.lua")` |
| 40 | `const QJS_UNDEFINED: qjs.JSValue = ...` | **DROP** — used only in `host_flush` / `host_get_input_text_for_node` which are removed |
| 78-83 | `CUSTOM_CHROME_MODE` detect `"cursor-ide"` via `qjs_bindings` app_name | Logic unchanged (app_name still a build option) |
| 156-163 | `qjs_runtime.callGlobal("__beginJsEvent")` / `callGlobalInt(global_name...)` / `callGlobal("__endJsEvent")` in `dispatchInputEvent` | Replace 3-call QJS pattern with `luajit_runtime.callGlobalInt(global_name, ...)` only (EQJS runtime does not need begin/end wrappers) |
| 201-206 | Same pattern in `dispatchInputKeyEvent` | Same substitution |
| 1012-1031 | `fn qjs_effect_shim(ctx)` calls `qjs_runtime.dispatchEffectRender(...)` | Replace body with `luajit_runtime.callGlobal("__zigOS_effectRender")` or drop effect shim (cursor-ide does not use onRender effects in EQJS mode) |
| 1076-1094 | `installJsExpr("__dispatchEvent({d},'onClick')...")` / `qjs_runtime.dispatchPreparedScroll` / `qjs_runtime.dispatchPreparedRightClick` | In EQJS mode, js_on_press exprs are NOT used. Instead, lower_node() in the boot runtime emits `lua_on_press` strings. Set `node.handlers.lua_on_press` using the EQJS-lowered names, OR keep js_on_press + evalExpr path via luajit_runtime.evalExpr (luajit_runtime already handles `js_on_press` by calling evalExpr). For scroll/right-click: luajit_runtime exposes no preparedScroll — set `on_scroll` to a thin Zig wrapper that calls `luajit_runtime.callGlobal("__dispatchScroll")` |
| 1271-1289 | `export fn host_flush(ctx, _, argc, argv) qjs.JSValue` | **REPLACE ENTIRELY** — EQJS does not use __hostFlush. The EQJS boot runtime calls `__markDirty` after state changes via `luajit_runtime.callGlobal` path. **Drop host_flush** and the g_pending_flush queue. |
| 1306-1315 | `export fn host_get_input_text_for_node(...)` returning `qjs.JSValue` | **DROP** — EQJS boot reads input via `getInputText(id)` host fn already registered by luajit_runtime.initVM() |
| 1760-1761 | `qjs_runtime.registerHostFn("__hostFlush", ...)` / `registerHostFn("__getInputTextForNode", ...)` | **DROP** — no equivalent; EQJS host functions are all registered at luajit_runtime.initVM() |
| 1786 | `qjs_bindings.tickDrain()` | **DROP** |
| 1792 | `qjs_runtime.callGlobalInt("__jsTick", now)` | Replace with `luajit_runtime.callGlobal("__zigOS_tick")` (luajit_runtime.tick() already does this) |
| 1696-1702 | `qjs_runtime.teardownVM()` / `qjs_runtime.initVM()` / `qjs_runtime.evalScript(...)` in `evalActiveTab` | Replace with `luajit_runtime.deinit()` / `luajit_runtime.initVM()` / `luajit_runtime.evalScript(BUNDLE_BYTES)` |
| 84 | `const DEV_BUNDLE_PATH = "bundle.js"` | Change to `"generated/cursor-ide-boot/boot_bundle.lua"` |
| 1844 | `js_logic = initial_bundle` in engine.run AppConfig | Change to `lua_logic = initial_bundle`, set `js_logic = ""` |

### 0.2 Framework imports that transfer unchanged

- `framework/layout.zig` — unchanged
- `framework/engine.zig` — unchanged
- `framework/state.zig` — unchanged
- `framework/events.zig` — unchanged
- `framework/input.zig` — unchanged
- `framework/fs.zig` — unchanged
- `framework/localstore.zig` — unchanged
- `framework/effect_ctx.zig` — unchanged (but effect shim logic dropped)
- `framework/dev_ipc.zig` — unchanged
- `framework/luajit_runtime.zig` — used as primary runtime (already imported in qjs_app.zig L26)

### 0.3 Required `build.zig` changes

1. No new dependency additions needed — `luajit-5.1` already linked (L88).
2. Remove QuickJS C source compilation block (L127-131).
3. Remove `root_mod.addIncludePath(b.path("love2d/quickjs"))` (L123).
4. Set `options.addOption(bool, "has_quickjs", false)` (L51) — prevents qjs_runtime from doing real QJS init.
5. Add new build step `"eqjs-cursor-ide"` that builds `eqjs_cart_app.zig` with `-Dapp-name=cursor-ide-eqjs`.
6. Strip step: `exe.strip = (optimize == .ReleaseFast)`.

---

## 1. Preconditions (read-only verifications)

Run each command before starting. If any fails, plan is blocked.

```bash
# P1. Boot bundle exists
ls /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua
# Expected: file path printed, exit 0

# P2. EQJS runtime exists
ls /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua
# Expected: file path printed, exit 0

# P3. luajit_runtime.zig exists
ls /home/siah/creative/reactjit/framework/luajit_runtime.zig
# Expected: file path printed, exit 0

# P4. qjs_app.zig exists (template source)
ls /home/siah/creative/reactjit/qjs_app.zig
# Expected: file path printed, exit 0

# P5. build.zig exists
ls /home/siah/creative/reactjit/build.zig
# Expected: file path printed, exit 0

# P6. LuaJIT system library present
pkg-config --libs luajit-5.1 2>/dev/null || ldconfig -p | grep luajit
# Expected: non-empty output (library found)

# P7. boot_bundle.lua is non-empty
wc -l /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua
# Expected: line count > 100

# P8. eqjs_cart_app.zig does NOT already exist (clean slate)
ls /home/siah/creative/reactjit/eqjs_cart_app.zig 2>&1
# Expected: "No such file or directory" — if file exists, inspect before overwriting

# P9. Confirm luajit_runtime exposes evalScript, initVM, deinit, tick, callGlobal, callGlobalInt, callGlobal3Int, hasGlobal
grep -n "^pub fn " /home/siah/creative/reactjit/framework/luajit_runtime.zig | grep -E "evalScript|initVM|deinit|tick|callGlobal|hasGlobal"
# Expected: all 7 symbols appear in output

# P10. engine.run AppConfig accepts lua_logic field
grep -n "lua_logic" /home/siah/creative/reactjit/framework/engine.zig | head -5
# Expected: field found

# P11. boot_bundle.lua has entry_component = "CursorIdeApp"
grep "entry_component" /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua
# Expected: cursor_ide_boot_bundle.entry_component = "CursorIdeApp"
```

---

## 2. Step-by-step port

### Phase 2.1 — Skeleton: create `eqjs_cart_app.zig`

---

**Step 2.1.1 — Copy qjs_app.zig to eqjs_cart_app.zig**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig` (new file)
Location: new file
Action: copy

```bash
cp /home/siah/creative/reactjit/qjs_app.zig /home/siah/creative/reactjit/eqjs_cart_app.zig
```

Rationale: Start from the proven host skeleton; all subsequent steps are targeted edits to this copy.
Verify:

```bash
wc -l /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: same line count as qjs_app.zig (~1855)
```

---

**Step 2.1.2 — Update file-top docstring**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1-10
Action: replace

BEFORE:
```
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

AFTER:
```
//! eqjs_cart_app.zig — cursor-ide cart running in LuaJIT/EQJS instead of QuickJS.
//! The EQJS boot runtime (boot_bundle.lua + cursor_ide_boot_runtime.lua) renders
//! directly to Zig Nodes via luajit_runtime host functions. No __hostFlush, no
//! JSON mutation commands — the Lua render path calls __declareChildren directly.
//!
//! Build:
//!   zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast
//!   strip zig-out/bin/cursor-ide-eqjs
```

Rationale: Accurate docstring prevents confusion; mechanical worker must know which runtime owns this file.
Verify:

```bash
head -9 /home/siah/creative/reactjit/eqjs_cart_app.zig | grep "eqjs_cart_app"
# Expected: line 1 contains "eqjs_cart_app.zig"
```

---

**Step 2.1.3 — Remove qjs_bindings import**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Line 25 (exact text)
Action: replace

BEFORE:
```
const qjs_bindings = @import("framework/qjs_bindings.zig");
```

AFTER:
```
// qjs_bindings removed — EQJS path has no async hook drain
```

Rationale: `qjs_bindings` is only used for `tickDrain()` which is QJS-specific.
Verify:

```bash
grep "qjs_bindings" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: only the comment line, no actual import
```

---

**Step 2.1.4 — Remove qjs @cImport block**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 31-33
Action: replace

BEFORE:
```
const qjs = @cImport({
    @cInclude("quickjs.h");
});
```

AFTER:
```
// QuickJS cImport removed — LuaJIT headers live in luajit_runtime.zig
```

Rationale: `qjs.*` types are used in host_flush and host_get_input_text_for_node only, both of which are dropped.
Verify:

```bash
grep "cInclude.*quickjs" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output (grep exits 1)
```

---

**Step 2.1.5 — Remove QJS_UNDEFINED constant**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Line 40
Action: replace

BEFORE:
```
const QJS_UNDEFINED: qjs.JSValue = .{ .u = .{ .int32 = 0 }, .tag = 3 };
```

AFTER:
```
// QJS_UNDEFINED removed
```

Rationale: No JSValue type exists without qjs cImport.
Verify:

```bash
grep "QJS_UNDEFINED" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: only the comment, no live usage
```

---

### Phase 2.2 — Bundle swap: embed Lua files instead of JS

---

**Step 2.2.1 — Replace BUNDLE embed with Lua bundles**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 35-39
Action: replace

BEFORE:
```
// Per-cart bundle. Path is `bundle-<app-name>.js` so that two parallel ships
// (different carts) don't race on a shared `bundle.js`. If you run
// `zig build app` directly, make sure the matching bundle file exists.
const BUNDLE_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.js", .{build_options.app_name});
const BUNDLE_BYTES = @embedFile(BUNDLE_FILE_NAME);
```

AFTER:
```
// EQJS bundles: runtime helper + compiled cart bundle.
// Both are embedded at compile time from the eqjs generator output.
const EQJS_RUNTIME_BYTES: []const u8 = @embedFile("/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua");
const BUNDLE_BYTES: []const u8 = @embedFile("/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua");
```

Rationale: The Lua runtime and the compiled cart bundle are separate files; both must be loaded in order.
Verify:

```bash
grep "embedFile" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: two lines, one for EQJS_RUNTIME_BYTES, one for BUNDLE_BYTES
```

---

**Step 2.2.2 — Change DEV_BUNDLE_PATH to Lua path**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Line 84
Action: replace

BEFORE:
```
const DEV_BUNDLE_PATH = "bundle.js";
```

AFTER:
```
const DEV_BUNDLE_PATH = "/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua";
```

Rationale: Dev mode hot-reload must watch the Lua bundle file, not the JS bundle.
Verify:

```bash
grep "DEV_BUNDLE_PATH" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -2
# Expected: path ends in boot_bundle.lua
```

---

### Phase 2.3 — Runtime swap: replace QJS dispatch/eval/init with LuaJIT equivalents

---

**Step 2.3.1 — Replace dispatchInputEvent QJS calls**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 153-163 (function `dispatchInputEvent`)
Action: replace

BEFORE:
```
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
```

AFTER:
```
fn dispatchInputEvent(slot: u8, global_name: [*:0]const u8) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    if (luajit_runtime.hasGlobal(global_name)) {
        luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    }
}
```

Rationale: EQJS runtime is pure Lua; QJS begin/end wrappers do not exist and must be removed.
Verify:

```bash
grep -A8 "fn dispatchInputEvent" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -10
# Expected: no qjs_runtime calls inside the function
```

---

**Step 2.3.2 — Replace dispatchInputKeyEvent QJS calls**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 198-207 (function `dispatchInputKeyEvent`)
Action: replace

BEFORE:
```
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
```
fn dispatchInputKeyEvent(slot: u8, key: c_int, mods: u16) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    if (luajit_runtime.hasGlobal("__dispatchInputKey")) {
        luajit_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    }
}
```

Rationale: Same as 2.3.1 — eliminate QJS begin/end wrappers.
Verify:

```bash
grep -A8 "fn dispatchInputKeyEvent" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -10
# Expected: no qjs_runtime inside
```

---

**Step 2.3.3 — Replace qjs_effect_shim with no-op**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1012-1031 (function `qjs_effect_shim`)
Action: replace

BEFORE:
```
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
```

AFTER:
```
fn qjs_effect_shim(_: *effect_ctx.EffectContext) void {
    // Effect rendering not implemented in EQJS mode
}
```

Rationale: `qjs_runtime.dispatchEffectRender` does not exist in luajit_runtime; cursor-ide EQJS bundle does not use CPU effect rendering.
Verify:

```bash
grep -A5 "fn qjs_effect_shim" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: body is only the comment, no qjs_runtime calls
```

---

**Step 2.3.4 — Replace on_scroll and on_right_click handler wiring**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1090-1094 (inside `applyHandlerFlags`)
Action: replace

BEFORE:
```
    if (cmdHasAnyHandlerName(cmd, &.{"onScroll"})) {
        node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll;
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onRightClick", "onContextMenu" })) {
        node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick;
    }
```

AFTER:
```
    if (cmdHasAnyHandlerName(cmd, &.{"onScroll"})) {
        node.handlers.on_scroll = eqjsDispatchScroll;
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onRightClick", "onContextMenu" })) {
        node.handlers.on_right_click = eqjsDispatchRightClick;
    }
```

Rationale: `qjs_runtime.dispatchPreparedScroll/RightClick` are QJS-specific function pointers; replace with Lua-dispatching stubs defined in step 2.3.5.
Verify:

```bash
grep "dispatchPreparedScroll\|dispatchPreparedRightClick" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output (both references removed)
```

---

**Step 2.3.5 — Add EQJS scroll/right-click dispatch stubs**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: immediately before `fn applyHandlerFlags` (line ~1064)
Action: add the following block

```zig
fn eqjsDispatchScroll() void {
    if (luajit_runtime.hasGlobal("__dispatchScroll")) {
        luajit_runtime.callGlobal("__dispatchScroll");
    }
}

fn eqjsDispatchRightClick() void {
    if (luajit_runtime.hasGlobal("__dispatchRightClick")) {
        luajit_runtime.callGlobal("__dispatchRightClick");
    }
}
```

Rationale: Engine calls `node.handlers.on_scroll` with no arguments; these stubs bridge to the Lua side.

**Blocker note:** Check the `on_scroll` and `on_right_click` field types in `framework/layout.zig`. If they are typed as `?*const fn()void` these stubs match. If they carry arguments (e.g. delta), adjust the stub signature accordingly.

Verify:

```bash
grep -n "on_scroll\|on_right_click" /home/siah/creative/reactjit/framework/layout.zig | head -4
# Expected: field declarations — check argument types match stub signatures above
```

---

**Step 2.3.6 — Drop host_flush export function**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1268-1290 (entire `host_flush` function + the two-line comment header)
Action: replace

BEFORE:
```
// ── QJS host function: __hostFlush(json) ────────────────────────
// JSCFunction signature: fn(ctx, this, argc, argv) -> JSValue

export fn host_flush(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) qjs.JSValue {
    _ = argc;
    if (ctx == null) return QJS_UNDEFINED;
    const c_str = qjs.JS_ToCString(ctx, argv[0]);
    if (c_str == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, c_str);
    const slice = std.mem.span(c_str);
    // Do not apply inline. host_flush fires inside js_on_press evals and
    // React's commit-on-setState path — both mid-frame. Destroying nodes now
    // frees memory the engine's current g_root.children slice still points at.
    // Queue the bytes and drain in appTick before rebuildTree.
    const owned = g_alloc.dupe(u8, slice) catch return QJS_UNDEFINED;
    g_pending_flush.append(g_alloc, owned) catch {
        g_alloc.free(owned);
    };
    g_dirty = true;
    const preview_len: usize = @min(slice.len, 80);
    std.debug.print("[host_flush] queued {d} bytes: {s}{s}\n", .{ slice.len, slice[0..preview_len], if (slice.len > 80) "..." else "" });
    return QJS_UNDEFINED;
}
```

AFTER:
```
// host_flush removed — EQJS runtime marks dirty via luajit_runtime.__markDirty host fn
```

Rationale: EQJS never calls `__hostFlush`; the entire command-batch queue is unused in this architecture.
Verify:

```bash
grep "host_flush\|JS_ToCString\|JS_FreeCString" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output
```

---

**Step 2.3.7 — Drop host_get_input_text_for_node export function**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1306-1315
Action: replace

BEFORE:
```
export fn host_get_input_text_for_node(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) qjs.JSValue {
    if (ctx == null or argc < 1) return qjs.JS_NewString(ctx, "");
    var node_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &node_id, argv[0]);
    if (node_id <= 0) return qjs.JS_NewString(ctx, "");
    const slot = g_input_slot_by_node_id.get(@intCast(node_id)) orelse return qjs.JS_NewString(ctx, "");
    const text = input.getText(slot);
    if (text.len == 0) return qjs.JS_NewString(ctx, "");
    return qjs.JS_NewStringLen(ctx, text.ptr, @intCast(text.len));
}
```

AFTER:
```
// host_get_input_text_for_node removed — EQJS uses getInputText() host fn in luajit_runtime
```

Rationale: luajit_runtime already registers `getInputText` as a Lua global in `initVM()` (line 1141 of luajit_runtime.zig).
Verify:

```bash
grep "host_get_input_text\|JS_NewString\|JS_ToInt32" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output
```

---

**Step 2.3.8 — Drop g_pending_flush globals and drainPendingFlushes**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 65-69 (g_pending_flush declaration)
Action: replace

BEFORE:
```
// Pending flush queue. host_flush is called mid-frame (from inside js_on_press
// evals, or inside __dispatchEvent's React commit). Applying CMDs mid-frame
// would destroy nodes whose heap memory is still referenced by the engine's
// rendered g_root.children copy — use-after-free. So we queue bytes here and
// drain at tick boundary before rebuildTree.
var g_pending_flush: std.ArrayList([]u8) = .{};
```

AFTER:
```
// g_pending_flush removed — EQJS architecture has no JSON command queue
```

Rationale: The flush queue exists exclusively for React mutation commands; EQJS does not use them.
Verify:

```bash
grep "g_pending_flush\|pending_flush" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: only the comment line
```

---

**Step 2.3.9 — Remove drainPendingFlushes function**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1292-1304 (function `drainPendingFlushes`)
Action: replace

BEFORE:
```
fn drainPendingFlushes() void {
    if (g_pending_flush.items.len == 0) return;
    const count = g_pending_flush.items.len;
    // Snapshot the pending list — applyCommandBatch can't re-enter host_flush
    // from Zig, but defensive copy keeps the loop safe anyway.
    const batches = g_pending_flush.toOwnedSlice(g_alloc) catch return;
    defer {
        for (batches) |bytes| g_alloc.free(bytes);
        g_alloc.free(batches);
    }
    for (batches) |bytes| applyCommandBatch(bytes);
    std.debug.print("[drain] applied {d} batches\n", .{count});
}
```

AFTER:
```
fn drainPendingFlushes() void {
    // No-op in EQJS mode — no JSON command queue
}
```

Rationale: drainPendingFlushes is called in appTick; keeping a no-op avoids removing the call site.
Verify:

```bash
grep -A4 "fn drainPendingFlushes" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: function body is the comment only
```

---

**Step 2.3.10 — Remove qjs_bindings.tickDrain() call in appTick**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Line 1786
Action: replace

BEFORE:
```
    qjs_bindings.tickDrain();
```

AFTER:
```
    // qjs_bindings.tickDrain() removed — EQJS has no async hook drain
```

Rationale: `qjs_bindings` import was removed in step 2.1.3.
Verify:

```bash
grep "tickDrain" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: only the comment line
```

---

**Step 2.3.11 — Replace qjs_runtime.callGlobalInt("__jsTick",...) with luajit_runtime.tick()**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Line 1792
Action: replace

BEFORE:
```
    qjs_runtime.callGlobalInt("__jsTick", @intCast(now));
```

AFTER:
```
    luajit_runtime.tick();
```

Rationale: `luajit_runtime.tick()` already calls `__zigOS_tick` in Lua (luajit_runtime.zig line 1319).
Verify:

```bash
grep "__jsTick" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output
```

---

**Step 2.3.12 — Replace qjs_runtime calls in evalActiveTab (dev mode reload)**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1692-1703 (function `evalActiveTab`)
Action: replace

BEFORE:
```
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
```

AFTER:
```
fn evalActiveTab() void {
    std.log.info("[dev] evalActiveTab: clearing tree", .{});
    clearTreeStateForReload();
    std.log.info("[dev] evalActiveTab: tearing down Lua VM", .{});
    luajit_runtime.deinit();
    std.log.info("[dev] evalActiveTab: initVM", .{});
    luajit_runtime.initVM();
    std.log.info("[dev] evalActiveTab: appInit", .{});
    appInit();
    std.log.info("[dev] evalActiveTab: loading EQJS runtime ({d} bytes)", .{EQJS_RUNTIME_BYTES.len});
    luajit_runtime.evalScript(EQJS_RUNTIME_BYTES);
    std.log.info("[dev] evalActiveTab: evalScript bundle ({d} bytes)", .{g_tabs.items[g_active_tab].bundle.len});
    luajit_runtime.evalScript(g_tabs.items[g_active_tab].bundle);
    std.log.info("[dev] evalActiveTab: done", .{});
}
```

Rationale: Must load the EQJS runtime Lua file before the cart bundle; mirrors the init path in appInit (step 2.3.13).
Verify:

```bash
grep -A14 "fn evalActiveTab" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -15
# Expected: no qjs_runtime calls, two luajit_runtime.evalScript calls
```

---

**Step 2.3.13 — Replace appInit to load Lua bundles instead of registering QJS host fns**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1751-1767 (function `appInit`)
Action: replace

BEFORE:
```
fn appInit() void {
    // QJS VM is already initialized by engine before this is called (engine calls
    // qjs_runtime.initVM() then evalScript(js_logic)). But we need __hostFlush
    // registered BEFORE evalScript runs. Engine order matters — see below.
    //
    // We piggyback on engine's eval: we pass the bundle via AppConfig.js_logic,
    // engine evals it, hostConfig's transportFlush tries to call globalThis.__hostFlush.
    // We must register __hostFlush BEFORE the bundle evals. Since appInit runs BEFORE
    // evalScript in engine.run order (tsz convention: init → evalScript), register here.
    qjs_runtime.registerHostFn("__hostFlush", @ptrCast(&host_flush), 1);
    qjs_runtime.registerHostFn("__getInputTextForNode", @ptrCast(&host_get_input_text_for_node), 1);

    // Persistent-store substrate for runtime/hooks/localstore. Best-effort —
    // if init fails the hooks gracefully no-op (see qjs_bindings.storeGet etc.).
    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});
}
```

AFTER:
```
fn appInit() void {
    // EQJS path: luajit_runtime.initVM() is called by engine BEFORE appInit
    // (via AppConfig.lua_logic eval path). We load the EQJS runtime helper
    // first, then the compiled cart bundle. Order matters: runtime defines
    // CursorIdeBootRuntime; bundle calls CursorIdeBootRuntime.new().
    luajit_runtime.evalScript(EQJS_RUNTIME_BYTES);
    luajit_runtime.evalScript(BUNDLE_BYTES);

    // Persistent-store substrate — best-effort.
    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});
}
```

Rationale: EQJS rendering is driven by Lua code evaluated into the existing luajit_runtime VM; no host fn registration is needed because luajit_runtime.initVM() already registers all host globals.
Verify:

```bash
grep -A10 "fn appInit" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -12
# Expected: two luajit_runtime.evalScript calls, no registerHostFn calls
```

---

**Step 2.3.14 — Replace engine.run AppConfig: js_logic → lua_logic, remove js_logic**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1842-1854 (`engine.run(...)` call in `main`)
Action: replace

BEFORE:
```
    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = &g_root,
        .js_logic = initial_bundle,
        .lua_logic = "",
        .init = appInit,
        .tick = appTick,
        // In dev mode, strip the OS titlebar so our tab chrome sits in the
        // titlebar position. Empty chrome area gets window_drag; tab buttons
        // with on_press override drag so clicks still switch tabs.
        .borderless = BORDERLESS_MODE,
        .set_canvas_node_position = setCanvasNodePosition,
    });
```

AFTER:
```
    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = &g_root,
        .js_logic = "",
        .lua_logic = "",
        .init = appInit,
        .tick = appTick,
        .borderless = BORDERLESS_MODE,
        .set_canvas_node_position = setCanvasNodePosition,
    });
```

Rationale: Both js_logic and lua_logic are set to "" because appInit() loads the Lua bundles directly via luajit_runtime.evalScript after the VM is ready. Passing lua_logic via AppConfig would cause a double-load.
Verify:

```bash
grep -A10 "engine.run" /home/siah/creative/reactjit/eqjs_cart_app.zig | grep "js_logic\|lua_logic"
# Expected: js_logic = "", lua_logic = ""
```

---

**Step 2.3.15 — Remove initial_bundle / dev mode tab seeding (it watched bundle.js, now watches boot_bundle.lua)**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Lines 1820-1840 (the `initial_bundle` block in `main`)
Action: verify and NO CHANGE needed — this block reads from disk or uses BUNDLE_BYTES.

The `initial_bundle` variable is used to seed `g_tabs.items[0].bundle` for the dev-mode tab, and is passed to engine.run as `js_logic`. Since step 2.3.14 already changes that to `""`, `initial_bundle` is only used for the tab registry seed. The tab bundle is then passed to `evalActiveTab → luajit_runtime.evalScript(g_tabs.items[g_active_tab].bundle)` (step 2.3.12). This is correct — in dev mode, the disk file IS the Lua bundle, so no further change is needed here.

Verify:

```bash
grep "initial_bundle\|BUNDLE_BYTES" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -6
# Expected: initial_bundle assignment from BUNDLE_BYTES or disk read; used in tab seeding only
```

---

**Step 2.3.16 — Remove qjs_runtime import**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: Line 24
Action: replace

BEFORE:
```
const qjs_runtime = @import("framework/qjs_runtime.zig");
```

AFTER:
```
// qjs_runtime removed — EQJS uses luajit_runtime exclusively
```

Rationale: After all substitutions above, no remaining code references `qjs_runtime.*`.
Verify:

```bash
grep "qjs_runtime\." /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: no output (no live calls remain)
```

---

**Step 2.3.17 — Remove applyCommandBatch and dependent JSON parsing code**

File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: The `applyCommandBatch` function and all functions it calls exclusively (approximately lines 1123-1266 — the command application section)

Audit first:

```bash
grep -n "fn applyCommandBatch\|fn ensureNode\|fn inheritTypography\|fn applyCmd\|fn jsonFloat\|fn dupJsonText\|fn isInputType\|fn isMultilineInputType\|fn isTerminalType\|fn syncInputValue\|fn releaseInputSlot\|fn ensureInputSlot" /home/siah/creative/reactjit/eqjs_cart_app.zig
```

**Decision rule:** Do NOT delete `ensureNode`, `ensureInputSlot`, `releaseInputSlot`, `isInputType`, `isMultilineInputType`, `isTerminalType`, `syncInputValue` if they are also called from `rebuildTree` or handler setup code. Check:

```bash
grep -n "ensureNode\|ensureInputSlot\|releaseInputSlot\|syncInputValue" /home/siah/creative/reactjit/eqjs_cart_app.zig | grep -v "^[0-9]*:fn "
```

If these are only called from `applyCommandBatch` / `applyCmd`, delete them all. If called from elsewhere, keep them.

Action: Replace `applyCommandBatch` with a no-op stub:

BEFORE (find exact line with):
```
fn applyCommandBatch(json_bytes: []const u8) void {
```

AFTER: Replace the entire function body up to its closing `}` with:
```
fn applyCommandBatch(_: []const u8) void {
    // No-op in EQJS mode — no JSON command format
}
```

Rationale: EQJS renders via luajit_runtime node-stamping, not JSON mutation commands.
Verify:

```bash
grep -A3 "fn applyCommandBatch" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: function body is only the comment
zig build-exe /home/siah/creative/reactjit/eqjs_cart_app.zig 2>&1 | grep "error" | head -10
# Expected: no "unused variable" or "undefined" errors from this section (may have other errors — see phase 2.5)
```

---

**Step 2.3.18 — Remove rebuildTree / snapshotRuntimeState if they reference g_node_by_id-only state**

These functions (`rebuildTree`, `snapshotRuntimeState`, `materializeChildren`, `syncRenderedNodeState`) are the QJS-specific tree materialization from the JSON command pool. In EQJS mode, luajit_runtime owns tree construction via `__declareChildren` / `stampLuaNode`.

**Decision rule:** In EQJS mode `g_dirty` still needs to trigger `layout.markLayoutDirty()` but the `g_node_by_id` hash map is always empty. Replace `rebuildTree()` with a layout-dirty marker only.

Find:
```bash
grep -n "fn rebuildTree\|fn snapshotRuntimeState" /home/siah/creative/reactjit/eqjs_cart_app.zig
```

Action: replace `rebuildTree` function body:

BEFORE (exact first line of function):
```
fn rebuildTree() void {
```

AFTER (replace entire function body up to closing `}`):
```
fn rebuildTree() void {
    // EQJS mode: tree is owned by luajit_runtime / __declareChildren.
    // Just mark layout dirty; the Lua render path populates g_root.children.
    layout.markLayoutDirty();
}
```

Also replace `snapshotRuntimeState` body:

BEFORE:
```
fn snapshotRuntimeState() void {
```

AFTER (replace body with no-op):
```
fn snapshotRuntimeState() void {
    // No-op in EQJS mode
}
```

Rationale: g_node_by_id is never populated in EQJS mode; materializeChildren returns empty slices. Layout dirties when luajit_runtime calls `__clearLuaNodes` + `__declareChildren`.
Verify:

```bash
grep -A4 "fn rebuildTree\b" /home/siah/creative/reactjit/eqjs_cart_app.zig
# Expected: body = layout.markLayoutDirty() only
```

---

### Phase 2.4 — Build wiring

---

**Step 2.4.1 — Add eqjs-cursor-ide build step to build.zig**

File: `/home/siah/creative/reactjit/build.zig`
Location: Line 162 (after `const app_step = b.step(...)`)
Action: add after the existing `app_step` block (after line 163)

```zig
    // ── EQJS cursor-ide cart ────────────────────────────────────────
    const eqjs_options = b.addOptions();
    eqjs_options.addOption(bool, "is_lib", false);
    eqjs_options.addOption([]const u8, "app_name", "cursor-ide-eqjs");
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
        .optimize = .ReleaseFast,
    });
    eqjs_mod.addOptions("build_options", eqjs_options);
    eqjs_mod.addImport("wgpu", wgpu_mod);
    eqjs_mod.addImport("tls", tls_mod);
    eqjs_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

    const eqjs_exe = b.addExecutable(.{
        .name = "cursor-ide-eqjs",
        .root_module = eqjs_mod,
    });
    eqjs_exe.stack_size = 64 * 1024 * 1024;
    eqjs_exe.strip = true;

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
    }

    eqjs_mod.addIncludePath(b.path("."));
    eqjs_mod.addIncludePath(b.path("framework/ffi"));

    // QuickJS C sources intentionally omitted — has_quickjs = false
    eqjs_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    eqjs_mod.addCSourceFile(.{ .file = b.path("framework/ffi/compute_shim.c"), .flags = &.{"-O2"} });
    eqjs_mod.addCSourceFile(.{ .file = b.path("framework/ffi/physics_shim.cpp"), .flags = &.{"-O2"} });

    eqjs_exe.linkSystemLibrary("box2d");
    eqjs_exe.linkSystemLibrary("sqlite3");
    eqjs_exe.linkSystemLibrary("vterm");
    eqjs_exe.linkSystemLibrary("curl");
    eqjs_exe.linkLibCpp();

    eqjs_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });

    const eqjs_step = b.step("eqjs", "Build the EQJS cursor-ide cart");
    eqjs_step.dependOn(&b.addInstallArtifact(eqjs_exe, .{}).step);
```

Rationale: New named build step avoids changing the existing `app` step, allows `zig build eqjs` to build only the EQJS binary at ReleaseFast with strip.
Verify:

```bash
cd /home/siah/creative/reactjit && zig build --list-steps 2>&1 | grep eqjs
# Expected: "eqjs  Build the EQJS cursor-ide cart"
```

---

**Step 2.4.2 — Set has_quickjs = false in eqjs build options (already done in 2.4.1)**

Confirmed in step 2.4.1 above: `eqjs_options.addOption(bool, "has_quickjs", false)`.

This prevents `qjs_runtime.zig` from importing or calling any QuickJS functions even if it is still imported transitively.

Verify:

```bash
grep "has_quickjs.*false" /home/siah/creative/reactjit/build.zig
# Expected: at least one match in the eqjs_options block
```

---

### Phase 2.5 — Smoke build and run

---

**Step 2.5.1 — First compile attempt**

```bash
cd /home/siah/creative/reactjit
zig build eqjs 2>&1 | head -60
```

Expected: compile errors listing undefined symbols or unused imports. Use the error list to drive the remaining cleanup steps. Common expected errors:

- `error: use of undeclared identifier 'qjs_bindings'` → covered by step 2.1.3
- `error: use of undeclared identifier 'qjs_runtime'` → covered by step 2.3.16
- `error: use of undeclared identifier 'QJS_UNDEFINED'` → covered by step 2.1.5
- `error: use of undeclared identifier 'qjs'` → covered by step 2.1.4
- `error: struct 'AppConfig' has no field named 'x'` → field mismatch in engine.run call
- `error: unused variable 'g_pending_flush'` → init removed but declaration remains (fix: remove from main's var declarations too if missed)

For each error, apply the mechanical fix: remove the reference or replace with the Lua equivalent.

---

**Step 2.5.2 — Fix any remaining qjs.* references**

```bash
grep -n "qjs\." /home/siah/creative/reactjit/eqjs_cart_app.zig
```

For each hit: replace the expression with its Lua equivalent or remove it. No `qjs.*` references should remain after all prior steps.

---

**Step 2.5.3 — Verify binary size**

```bash
ls -lh /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs
# Expected: file size ~25-35 MB (ReleaseFast + strip)
# If > 50MB: QuickJS C sources were accidentally included — check build.zig eqjs block
# If < 5MB: binary is malformed — check that all framework modules linked
```

---

**Step 2.5.4 — Launch smoke test**

```bash
cd /home/siah/creative/reactjit
./zig-out/bin/cursor-ide-eqjs
```

Expected sequence in stderr/stdout:
1. `[luajit-runtime] VM initialized with tsl_stdlib`
2. Lua output from EQJS runtime init (no errors)
3. SDL window opens titled "cursor-ide-eqjs"
4. cursor-ide UI renders (top bar with branch strip, nav toolbar)

If window opens blank: The EQJS boot runtime's `__zigOS_tick` global is not defined — check that `luajit_runtime.tick()` finds `__zigOS_tick` in Lua after boot_bundle loads.

---

**Step 2.5.5 — Verify click triggers re-render**

Click any Pressable in the UI (e.g., nav toolbar button).

Expected: `[Lua]` log lines appear in stderr showing state change; UI re-renders within one frame.

---

## 3. Expected blockers + fallback guidance

### Blocker B1: `on_scroll` / `on_right_click` field types have arguments

If `layout.Node.handlers.on_scroll` is typed as `?*const fn(delta: f32) void` (or similar), the stub in step 2.3.5 won't compile.

Fallback: Read `grep -n "on_scroll\|on_right_click" /home/siah/creative/reactjit/framework/layout.zig` and match the stub signature exactly. Pass dummy 0 to Lua: `luajit_runtime.callGlobal("__dispatchScroll")` ignores the delta on the Zig side; if Lua needs the delta, add `luajit_runtime.callGlobalInt("__dispatchScroll", @intFromFloat(delta * 100))`.

### Blocker B2: `qjs_runtime.zig` is still transitively imported by another framework module

If `has_quickjs=false` does not make qjs_runtime a no-op for some symbol that eqjs_cart_app uses (e.g. `syncLuaToQjs`), the build will fail.

Fallback: Add a guard in luajit_runtime.zig around the two QJS cross-calls:
- `hostSyncToJS` (luajit_runtime.zig:1045): `if (comptime qjs_runtime.HAS_QUICKJS) qjs_runtime.syncLuaToQjs(name_z)`
- `hostEval` (luajit_runtime.zig:1056): same guard
- `hostCallJS` / `hostCallJSReturn` (luajit_runtime.zig:1071, 1081): same guard

These functions are in luajit_runtime.zig and will simply no-op when `has_quickjs=false`.

### Blocker B3: EQJS boot runtime uses `__zigOS_tick` but boot_bundle.lua does not define it

If `grep "__zigOS_tick" /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua` returns nothing:

Fallback: Wrap the EQJS render loop in a Lua glue file. After loading boot_bundle.lua, eval a small bootstrap chunk:

```lua
local rt = CursorIdeBootRuntime.new(cursor_ide_boot_bundle)
local app_instance = rt:create_render_frame(...)
function __zigOS_tick()
  rt:rerender_instance(app_instance)
  -- nodes are pushed via __declareChildren inside the runtime
  __markDirty()
end
```

Check the boot_bundle's actual tick wiring by running:
```bash
grep -n "zigOS_tick\|__render\|_appInit\|appTick" /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua | head -10
```

### Blocker B4: Binary > 50MB despite strip=true

QuickJS C sources (~3MB compiled) may have been accidentally included.

Verify with:
```bash
nm zig-out/bin/cursor-ide-eqjs 2>/dev/null | grep -i quickjs | head -5
# Expected: no output (QuickJS symbols stripped/excluded)
```

If symbols found: remove the QuickJS C source compile block from the eqjs build step in build.zig (step 2.4.1 already excludes them — verify the block was saved correctly).

### Blocker B5: `applyHandlerFlags` is dead code but its callers remain

If `applyHandlerFlags` is only called from `applyCommandBatch` (which is now a no-op), Zig may warn about unused function. This is non-fatal but creates noise. Either delete `applyHandlerFlags` entirely or suppress with `_ = applyHandlerFlags;` at file scope.

### Blocker B6: `g_node_by_id` / `g_children_ids` declared but never populated in EQJS mode

The `clearTreeStateForReload` function iterates these maps. In EQJS mode they're always empty so the iteration is safe (0 iterations). The `main` function still initializes them — that's fine. No action needed unless Zig reports "unreachable code".

### Blocker B7: engine.run AppConfig `js_logic=""` causes engine to skip QJS init

If engine.zig skips `qjs_runtime.initVM()` only when `js_logic == ""` AND `has_quickjs=true`, the QJS runtime gets initialized unnecessarily. With `has_quickjs=false` set in build options, `qjs_runtime.initVM()` is a no-op anyway (guarded by `HAS_QUICKJS` in qjs_runtime.zig L9). No action needed.

---

## 4. Final verification checklist

Run these in order. Each must pass before claiming the port is complete.

```bash
# 1. Build succeeds
cd /home/siah/creative/reactjit
zig build eqjs -Doptimize=ReleaseFast 2>&1 | grep -E "^error" | wc -l
# Expected: 0

# 2. Binary exists
ls -lh zig-out/bin/cursor-ide-eqjs
# Expected: file exists

# 3. Binary is stripped (~30MB)
ls -lh zig-out/bin/cursor-ide-eqjs | awk '{print $5}'
# Expected: value between 20M and 40M

# 4. QuickJS symbols absent
nm zig-out/bin/cursor-ide-eqjs 2>/dev/null | grep -ic "quickjs" || true
# Expected: 0

# 5. LuaJIT symbols present
nm zig-out/bin/cursor-ide-eqjs 2>/dev/null | grep -ic "lua_" || true
# Expected: > 0

# 6. Binary launches (10-second smoke test)
timeout 10 ./zig-out/bin/cursor-ide-eqjs &
sleep 3
# Expected: window opens (check visually), no segfault in dmesg

# 7. cursor-ide top bar renders
# Visual check: top bar with branch name strip visible

# 8. Nav toolbar renders
# Visual check: file explorer / settings / etc toolbar buttons visible

# 9. Pressable click triggers re-render
# Click a toolbar button; stderr should show [Lua] lines

# 10. No memory errors
ASAN_OPTIONS=detect_leaks=0 ./zig-out/bin/cursor-ide-eqjs 2>&1 | grep -i "segfault\|abort\|panic" | wc -l
# Expected: 0
```
