# EQJS Cart Port — Consensus Plan (spark-executable)

Synthesized from port_plan_P12.md, P13.md, P16.md, P20.md after Opus cross-validation.

**Contentious items resolved:**
- `host_flush` — **DROP** the pending-flush queue entirely (P13/P20 pattern). EQJS emits ops via `runtime:rerender_instance` → `emit_diff_ops`; a JS-callback queue is dead code on this path.
- Tick function name — **`__zigOS_tick`** (3/4 converge: P13, P20, and engine-side wiring already understands it).
- Scroll / right-click signatures — precondition verify before swapping, not ignored.
- `luajit_runtime.zig` cross-dep on `qjs_runtime.zig` (5 call sites) — **Phase 0 blocker**, must resolve before Phase 1.

**Structure:** P16 atomic sub-numbered steps. **Discipline:** every step has a `Verify:` bash command that exits nonzero on failure. Spark halts the batch on any red.

**Batching guidance for spark:**
- Phase 0 = all parallel-safe (read-only verifies) — batch up to 10.
- Phase 1 = strictly serial (each edits the same file).
- Phase 2 = strictly serial.
- Phase 3 = parallel-safe (each step touches a different file).
- Phase 4 = strictly serial (build → run → click).

---

## Phase 0 — Preconditions (parallel-safe, read-only)

Run all of these. Any failure halts the port.

### Step 0.1 — Source files exist
Verify:
```bash
test -f /home/siah/creative/reactjit/qjs_app.zig && \
test -f /home/siah/creative/reactjit/framework/qjs_runtime.zig && \
test -f /home/siah/creative/reactjit/framework/luajit_runtime.zig && \
test -f /home/siah/creative/reactjit/build.zig && \
test -f /home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua && \
test -f /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua
```
Expected: exit 0.

### Step 0.2 — luajit_runtime API surface exists
Verify:
```bash
rg -n "pub fn (initVM|deinit|evalScript|evalExpr|callGlobal|callGlobalStr|callGlobalInt|callGlobal3Int|hasGlobal|registerHostFn|setEffectRender|setEffectShader|tick)\b" /home/siah/creative/reactjit/framework/luajit_runtime.zig | wc -l
```
Expected: `13` or higher.

### Step 0.3 — Cross-dep count from luajit_runtime to qjs_runtime
Verify:
```bash
rg -n "qjs_runtime\." /home/siah/creative/reactjit/framework/luajit_runtime.zig
```
Expected: exactly 4 hits at lines ~1052, 1064, 1076, 1089 (`syncLuaToQjs`, `evalToLua`, `callGlobal`, `callGlobalReturnToLua`). Plus the import at line 18. If more hits, stop — the plan needs revision.

### Step 0.4 — `has_quickjs` build option is guardable
Verify:
```bash
rg -n "has_quickjs|HAS_QUICKJS" /home/siah/creative/reactjit/framework/qjs_runtime.zig /home/siah/creative/reactjit/build.zig | wc -l
```
Expected: `≥ 2` (at least one in qjs_runtime.zig gate + one in build.zig).

### Step 0.5 — engine.run accepts lua_logic
Verify:
```bash
rg -n "lua_logic|js_logic" /home/siah/creative/reactjit/framework/engine.zig | head -20
```
Expected: matches for both, engine path already dispatches on either.

### Step 0.6 — Scroll/right-click handler signatures
Verify:
```bash
rg -n "on_scroll|on_right_click" /home/siah/creative/reactjit/framework/layout.zig
```
Expected: print signatures. **SAVE THE EXACT TYPE** — needed later in Step 2.3. If signature is `?*const fn(...) void` with args, the Phase 2 stub must match exactly.

### Step 0.7 — boot_bundle defines `__zigOS_tick` (or requires a wrapper)
Verify:
```bash
grep -c "__zigOS_tick" /home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua
```
Expected: nonzero. If zero, Phase 3 Step 3.2 must include a wrapper chunk (handled by fallback guidance in §Blockers).

### Step 0.8 — strip and file utilities present
Verify:
```bash
command -v strip && command -v file && command -v nm
```
Expected: 3 paths printed.

### Step 0.9 — luajit_runtime cross-dep elimination strategy
Verify:
```bash
rg -n "hostSyncToJS|hostEval|hostCallJS|hostCallJSReturn" /home/siah/creative/reactjit/framework/luajit_runtime.zig
```
Expected: 4+ hits at the functions wrapping the qjs_runtime calls. These are the wrap points for the Phase 1 guard.

### Step 0.10 — Previous boot smoke renders
Verify:
```bash
cd /home/siah/creative/reactjit && ./zig-out/bin/cursor-ide-eqjs 2>&1 | grep -c "BOOT COMPLETE"
```
Expected: `1`. Confirms the Lua bundle path itself is working end-to-end.

---

## Phase 1 — NO-OP (analysis correction)

Originally flagged as "resolve cross-dep" blocker (P12 B1, P13 B2). Verified against source: `qjs_runtime.zig` self-guards every exported function with `if (comptime !HAS_QUICKJS) return;` at the top (lines 3187, 3471, 3495, 3522). The `@cImport("quickjs.h")` is also conditional (line 30: struct fallback). The cross-dep is already safe — `luajit_runtime.zig` can import and call `qjs_runtime` freely when `HAS_QUICKJS=false`; the calls just become no-ops.

The real fix lives in Phase 5 Step 5.1 (make `has_quickjs` a build flag). No luajit_runtime.zig edits needed.

---

## Phase 2 — Skeleton

### Step 2.1.1 — Clone qjs_app.zig → eqjs_cart_app.zig
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Action:
```bash
cp /home/siah/creative/reactjit/qjs_app.zig /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Rationale: line-stable clone is the safest base for mechanical substitutions.
Verify:
```bash
wc -l /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: `1855` lines (±2).

### Step 2.1.2 — Replace imports + bundle constants
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 24-40
Action: replace the QJS import + bundle block.
BEFORE:
```zig
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
const luajit_runtime = @import("framework/luajit_runtime.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

const BOOT_RUNTIME_BYTES = @embedFile("/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua");
const BOOT_BUNDLE_BYTES = @embedFile("/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua");
```
Verify:
```bash
! rg -q "qjs_runtime|qjs_bindings|quickjs\.h|QJS_UNDEFINED|BUNDLE_FILE_NAME|BUNDLE_BYTES" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "BOOT_RUNTIME_BYTES|BOOT_BUNDLE_BYTES" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 2.1.3 — Update file header comment
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1-10
Action: replace `QuickJS VM` mentions with `LuaJIT / EQJS VM` in the doc comment. Keep architectural description. Build example line becomes:
```
//! zig build app -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast
```
Verify:
```bash
! rg -qE "QuickJS|QJS VM" /home/siah/creative/reactjit/eqjs_cart_app.zig | head -5
```
Expected: no QuickJS mentions in top-level doc comment (some may remain in inline comments — OK for now, cleanup in later step).

---

## Phase 3 — Runtime substitution (serial, same file)

### Step 3.1 — Replace event dispatch helpers
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 153-206 (`dispatchInputEvent` and `dispatchInputKeyEvent`)
Action: strip `qjs_runtime.callGlobal("__beginJsEvent")` / `__endJsEvent` wrappers, keep only the `luajit_runtime.hasGlobal + callGlobal*` branches.
BEFORE:
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
    if (luajit_runtime.hasGlobal(global_name)) {
        luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    }
```
Apply to both functions.
Verify:
```bash
! rg -q "__beginJsEvent|__endJsEvent" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.2 — Replace `installJsExpr` press-handler installs with `lua_on_press` field writes
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1039-1094 (search for `installJsExpr`)
Action: remove the JS-expression-install pattern. For each `node.handlers.js_on_press = installJsExpr("__dispatchEvent({d},'onClick')\x00", id)` etc., replace with the Lua handler name the engine already understands:
- `node.handlers.lua_on_press = <handler-name-string>`
- `node.handlers.lua_on_mouse_down` / `lua_on_mouse_up` / `lua_on_hover_enter` / `lua_on_hover_exit` — same pattern.

Use whatever name the EQJS boot runtime's `lower_node()` emits. If the source has the exact name already in `handler_names_json`, use that; otherwise default to `"__dispatchEvent"`.

Verify:
```bash
! rg -q "installJsExpr|js_on_press|js_on_mouse|js_on_hover" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "lua_on_press" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.3 — Replace `dispatchPreparedScroll` and `dispatchPreparedRightClick`
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: near line 1091 (grep `dispatchPrepared`)
Action: substitute the QJS prepared-dispatch handlers with thin Zig callbacks that call Lua globals.

Signatures from framework/events.zig:27-28 are `on_scroll: ?*const fn () void` (no args) and `on_right_click: ?*const fn (x: f32, y: f32) void`. Template:
```zig
fn eqjs_on_scroll() void {
    if (luajit_runtime.hasGlobal("__dispatchScroll")) {
        luajit_runtime.callGlobal("__dispatchScroll");
    }
}
fn eqjs_on_right_click(x: f32, y: f32) void {
    _ = x; _ = y;
    if (luajit_runtime.hasGlobal("__dispatchRightClick")) {
        luajit_runtime.callGlobal("__dispatchRightClick");
    }
}
```
Then `node.handlers.on_scroll = eqjs_on_scroll;` and `node.handlers.on_right_click = eqjs_on_right_click;`.
Verify:
```bash
! rg -q "dispatchPreparedScroll|dispatchPreparedRightClick" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "eqjs_on_scroll|eqjs_on_right_click" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.4 — Remove effect shim
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1008-1031 (`fn qjs_effect_shim` and its callers)
Action: remove the function body and any registration. Replace with `noop_effect_render` if engine requires a non-null fn pointer; otherwise drop. `luajit_runtime.setEffectRender` wiring can land in a follow-up.
Verify:
```bash
! rg -q "qjs_effect_shim|dispatchEffectRender" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.5 — DELETE `host_flush` + flush queue (consensus: drop-queue)
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1268-1314 (`export fn host_flush`) and globals (`g_pending_flush`) and drain call (`drainPendingFlushes`).
Action: **DELETE the export fn host_flush entirely. DELETE `g_pending_flush`. DELETE `drainPendingFlushes()` and its calls.** The EQJS runtime emits mount/diff ops via `runtime:rerender_instance` → `emit_diff_ops` directly; there is no JS-callback→queue path.
Verify:
```bash
! rg -q "host_flush|g_pending_flush|drainPendingFlushes" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.6 — Convert `host_get_input_text_for_node` to LuaJIT C ABI
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines ~1295-1314 (the other export fn in that range)
Action: rewrite signature to accept a `*lua_State`, read node_id as lua arg, push a lua string, return 1.
```zig
fn host_get_input_text_for_node(L: ?*luajit_runtime.lua_State) c_int {
    const node_id: u32 = @intCast(luajit_runtime.checkInt(L, 1));
    const slot = g_input_slot_by_node_id.get(node_id) orelse {
        luajit_runtime.pushString(L, "");
        return 1;
    };
    const text = input.getText(slot);
    luajit_runtime.pushString(L, text);
    return 1;
}
```
Verify:
```bash
! rg -q "JSContext|JSValue|JS_ToCString|JS_NewString" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.7 — Replace reload path
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1667-1704 (`evalActiveTab` and dev reload)
Action: substitute `qjs_runtime.teardownVM()` / `initVM()` / `evalScript(...)` with `luajit_runtime.deinit()` / `initVM()` / the Lua bootstrap chunk re-eval (see Step 4.1).
Verify:
```bash
! rg -q "qjs_runtime\.(teardownVM|initVM|evalScript|registerHostFn|callGlobal)" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.8 — Replace appTick
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1783-1803
Action:
- Remove `qjs_bindings.tickDrain();`
- Remove `qjs_runtime.callGlobalInt("__jsTick", now);`
- Add `luajit_runtime.tick();` (which internally calls `__zigOS_tick` if present).
- Remove `drainPendingFlushes()` (already deleted in Step 3.5, confirm).
Verify:
```bash
! rg -q "qjs_bindings\.tickDrain|__jsTick|drainPendingFlushes" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "luajit_runtime\.tick\(\)" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 3.9 — Replace appInit host-fn registrations
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1751-1767
Action: remove `qjs_runtime.registerHostFn("__hostFlush", ...)`. Register the EQJS-side host fns on `luajit_runtime.registerHostFn`:
- `__getInputTextForNode` → `host_get_input_text_for_node` (from Step 3.6)
- `__bootRuntimeSource` → pushes `BOOT_RUNTIME_BYTES`
- `__bootBundleSource` → pushes `BOOT_BUNDLE_BYTES`
Keep `fs_mod.init("reactjit")` and `localstore.init()` calls intact.
Verify:
```bash
! rg -q "qjs_runtime\.registerHostFn" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "luajit_runtime\.registerHostFn.*__getInputTextForNode" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

---

## Phase 4 — Bundle + engine wiring (serial)

### Step 4.1 — Add Lua BOOTSTRAP chunk
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: just above `fn appInit` (or after the globals block)
Action: add
```zig
const BOOTSTRAP: [:0]const u8 =
    \\local runtime_src = __bootRuntimeSource()
    \\local bundle_src  = __bootBundleSource()
    \\local Runtime = assert(load(runtime_src, "@cursor_ide_boot_runtime.lua"))()
    \\local bundle  = assert(load(bundle_src,  "@boot_bundle.lua"))()
    \\local rt = Runtime.new(bundle)
    \\rt:set_global_this(_G)
    \\_G.__eqjs_runtime = rt
    \\_G.__eqjs_app = rt:instantiate_entry("CursorIdeApp")
    \\function __zigOS_tick()
    \\  rt:rerender_instance(_G.__eqjs_app)
    \\end
    \\
;
```
Rationale: this gives the engine a self-contained bootstrap that loads runtime + bundle, instantiates the cart, and exposes `__zigOS_tick` as the tick hook.
Verify:
```bash
rg -q "BOOTSTRAP:" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "__zigOS_tick" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

### Step 4.2 — Point engine.run at BOOTSTRAP
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1842-1848
Action: in the `engine.run(.{ ... })` AppConfig:
- set `.js_logic = ""`
- set `.lua_logic = BOOTSTRAP`
- keep window title, root, borderless, tabs as-is
Verify:
```bash
rg -n "\.js_logic\s*=\s*\"\"" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -n "\.lua_logic\s*=\s*BOOTSTRAP" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: both rg exit 0.

### Step 4.3 — Update dev reload to watch the Lua bundle
File: `/home/siah/creative/reactjit/eqjs_cart_app.zig`
Location: lines 1598-1677 (dev mode file path)
Action: swap the watched file path from `bundle.js` to `/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua`. On reload, re-read the file, replace `BOOT_BUNDLE_BYTES` behavior with the fresh disk bytes, and re-run BOOTSTRAP.
Verify:
```bash
! rg -q "bundle\.js" /home/siah/creative/reactjit/eqjs_cart_app.zig && rg -q "boot_bundle\.lua" /home/siah/creative/reactjit/eqjs_cart_app.zig
```
Expected: exit 0.

---

## Phase 5 — Build wiring (parallel-safe)

### Step 5.1 — Add `has_quickjs=false` path for eqjs_cart_app
File: `/home/siah/creative/reactjit/build.zig`
Location: options block around lines 47-63
Action: detect `app-source == "eqjs_cart_app.zig"` OR add a new `-Deqjs-cart=true` option, and when set, `options.addOption(bool, "has_quickjs", false)`. Otherwise keep existing true default.
Verify:
```bash
rg -n "has_quickjs" /home/siah/creative/reactjit/build.zig | wc -l
```
Expected: `≥ 2`.

### Step 5.2 — Gate QuickJS C sources on `has_quickjs`
File: `/home/siah/creative/reactjit/build.zig`
Location: lines 75-131 (wherever QuickJS C sources are added)
Action: wrap the `exe.addCSourceFile(...)` calls for QuickJS (and any `exe.addIncludePath(...)` for `quickjs.h`) in `if (has_quickjs) { ... }`.
Verify: zig build for EQJS cart (Step 5.4) succeeds with no `quickjs.h` include errors.

### Step 5.3 — Force strip on the cart executable
File: `/home/siah/creative/reactjit/build.zig`
Location: lines 75-83 (where `exe` is created)
Action: set `exe.strip = true;` unconditionally (or only when `has_quickjs == false`, to preserve QJS-side debug if needed). The EQJS cart MUST be stripped.
Verify:
```bash
rg -n "exe\.strip" /home/siah/creative/reactjit/build.zig
```
Expected: match.

### Step 5.4 — Build the EQJS cart
Verify:
```bash
cd /home/siah/creative/reactjit && zig build app -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast 2>&1 | tee /tmp/build_cart.log | tail -10; ! grep -qE "^.*error:" /tmp/build_cart.log
```
Expected: exit 0.

### Step 5.5 — Add ship-cursor-ide-eqjs script
File: `/home/siah/creative/reactjit/scripts/ship-cursor-ide-eqjs`
Action: write
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
zig build app -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast
exec ./zig-out/bin/cursor-ide-eqjs-cart
```
Then `chmod +x`.
Verify:
```bash
test -x /home/siah/creative/reactjit/scripts/ship-cursor-ide-eqjs
```
Expected: exit 0.

---

## Phase 6 — Smoke (serial)

### Step 6.1 — Binary is stripped
Verify:
```bash
file /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs-cart | grep -q "stripped"
```
Expected: match.

### Step 6.2 — Binary size ~30MB
Verify:
```bash
size_bytes=$(stat -c %s /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs-cart); echo "size=$size_bytes"; [ "$size_bytes" -lt 50000000 ]
```
Expected: exit 0, size printed under 50MB (hard ceiling; target ~30MB).

### Step 6.3 — No QuickJS symbols
Verify:
```bash
nm /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs-cart 2>/dev/null | grep -ic "quickjs\|JS_NewContext\|JS_Eval"
```
Expected: `0`.

### Step 6.4 — LuaJIT symbols present
Verify:
```bash
nm /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs-cart 2>/dev/null | grep -ic "lua_|luaJIT"
```
Expected: > 0.

### Step 6.5 — Launch smoke (10s)
Verify:
```bash
timeout 10 /home/siah/creative/reactjit/zig-out/bin/cursor-ide-eqjs-cart 2>&1 | head -30
rc=$?; [ "$rc" -eq 124 ] || [ "$rc" -eq 0 ]
```
Expected: exit 0 or 124 (timeout = good, process was alive). Output should include boot / mount logs.

### Step 6.6 — Manual visual check
Action: launch `./scripts/ship-cursor-ide-eqjs` and confirm:
- Window opens with cursor-ide chrome
- Top bar shows `WS reactjit Project landing`
- Branch strip: `BR main 0 dirty / 0 staged`
- Nav toolbar: `RF Refresh`, `PL Settings`, `SR Search`, `SH Terminal`, `Hot`
- Click a Pressable → state change reflected

Pass condition: user visual confirmation. (This step is the only non-bash-automatable one.)

---

## Expected blockers + fallback guidance

### B1 — Scroll/right-click field signatures (P13)
If Step 3.3's callback signature doesn't match `layout.Node.handlers.on_scroll`'s declared type, compilation fails. From Step 0.6, use the EXACT signature. If `on_scroll` is `?*const fn(delta: f32) void`, the callback must take a `delta: f32` arg.

### B2 — `luajit_runtime` still importing `qjs_runtime` (P12, P13)
Phase 1 is the fix. If Phase 1 steps applied but build still fails with `qjs_runtime` undefined, grep again — more call sites exist than anticipated. Add guards until zero uncondition calls remain.

### B3 — `__zigOS_tick` not defined in bundle (P13)
If Step 0.7 shows zero, Step 4.1's BOOTSTRAP chunk defines it explicitly. Verify after launch: `luajit_runtime.hasGlobal("__zigOS_tick")` returns true post-init.

### B4 — Binary > 50MB despite strip=true (P13)
QuickJS C sources accidentally included. Verify Step 5.2 actually gated them. `nm | grep -c quickjs` must be 0.

### B5 — `engine.run` skips Lua init if `lua_logic` is empty (P13)
Read `framework/engine.zig` around the `lua_logic` check. If the engine requires non-empty `lua_logic` to init Lua, the BOOTSTRAP string must be non-empty (it is, from Step 4.1).

### B6 — `host_flush` referenced from engine-side callback registration
If `engine.zig` or another framework module expected a `__hostFlush` registration, flushing may silently fail. Grep framework for `__hostFlush` callers — if any, add a no-op registration in Step 3.9 pushing an empty function.

### B7 — `has_quickjs` check skips Lua init path
Unlikely but worth checking: `rg -n "has_quickjs" /home/siah/creative/reactjit/framework/engine.zig` — any branches on has_quickjs should not gate Lua init.

---

## Final verification checklist (final gate)

Run every command, expect all pass:

```bash
cd /home/siah/creative/reactjit

# 1. Build green
zig build app -Dapp-name=cursor-ide-eqjs-cart -Dapp-source=eqjs_cart_app.zig -Doptimize=ReleaseFast 2>&1 | tee /tmp/final_build.log
! grep -qE "^.*error:" /tmp/final_build.log || { echo "FAIL: build errors"; exit 1; }

# 2. Binary exists + stripped
file zig-out/bin/cursor-ide-eqjs-cart | grep -q stripped || { echo "FAIL: not stripped"; exit 1; }

# 3. Size in target range (~30MB, hard ceiling 50MB)
size_bytes=$(stat -c %s zig-out/bin/cursor-ide-eqjs-cart)
[ "$size_bytes" -lt 50000000 ] || { echo "FAIL: size $size_bytes > 50MB"; exit 1; }
echo "OK: size=$size_bytes ($(( size_bytes / 1024 / 1024 ))MB)"

# 4. No QuickJS
qjs_syms=$(nm zig-out/bin/cursor-ide-eqjs-cart 2>/dev/null | grep -ic "quickjs\|JS_NewContext" || true)
[ "$qjs_syms" -eq 0 ] || { echo "FAIL: QuickJS symbols present ($qjs_syms)"; exit 1; }

# 5. LuaJIT present
lua_syms=$(nm zig-out/bin/cursor-ide-eqjs-cart 2>/dev/null | grep -ic "lua_" || true)
[ "$lua_syms" -gt 0 ] || { echo "FAIL: no LuaJIT symbols"; exit 1; }

# 6. Launch smoke (doesn't crash immediately)
timeout 10 ./zig-out/bin/cursor-ide-eqjs-cart 2>&1 | head -20 > /tmp/cart_smoke.log
rc=$?
[ "$rc" -eq 124 ] || [ "$rc" -eq 0 ] || { echo "FAIL: exit $rc"; cat /tmp/cart_smoke.log; exit 1; }

# 7. Bootstrap logged
grep -qE "mount|render|boot" /tmp/cart_smoke.log || { echo "FAIL: no boot/mount log"; exit 1; }

echo "ALL GATES GREEN"
```

Manual gate: visual confirmation cursor-ide UI renders + Pressable click triggers rerender.
