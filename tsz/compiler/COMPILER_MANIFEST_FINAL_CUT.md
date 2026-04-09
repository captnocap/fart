# COMPILER MANIFEST — Final Cut (Phase 1 Plan)
Generated: 2026-04-08 (revised)  
Baseline: COMPILER_MANIFEST.md (200 JS + 6 Zig, 652 unique functions)  
Central thesis: **The atom system is the target architecture. The cleanup is completing the migration.**

---

## Why the atom system matters

Every atom is a unit of transformation: patterns in, generated code out. `_applies()` decides if this source needs this output. `_emit()` produces it. Atoms 1–46 assemble in order to produce the complete generated Zig file.

45 of 46 atoms are registered. The dispatch loop (`runEmitAtoms`) exists and works. But `emitOutput()` in `emit.js` still calls legacy `emit/*.js` functions directly — `emitPreamble`, `emitStateManifest`, `emitNodeTree`, etc. — bypassing the atom pipeline entirely. The atom system was built to replace this. The switchover never happened.

The legacy emit/ path is a god-function orchestrator: one function calling twelve others in sequence, each a monolithic "emit this whole section." The atom path does the same work but granular — 46 composable units, each with a clear trigger and a clear output. That's the architecture you want because:

- Any future compiler feature is `_emitAtoms[47]`, not "find the right place inside emitRuntimeSupportSections and wedge it in"
- Debugging is "which atom produced this output" not "which of 12 functions contributed this line"
- Each atom can be tested in isolation
- The routing check (preflight/routing_check.js) already knows about atoms — it predicts which atoms should fire and flags mismatches

**The cleanup is: activate the atom pipeline, verify parity, delete the legacy path.**

---

## Architecture: what lives where after cleanup

```
smith/
  index.js           — compile() entry, routes to lanes
  core.js            — cursor factory, ctx singleton, slot helpers
  emit.js            — emitOutput() calls runEmitAtoms() (THE SWITCH)
  emit_atoms/        — THE emit pipeline. 46 atoms, each owns its output section.
    index.js          — runEmitAtoms() dispatch loop
    preamble/         — a001–a003: banner, core imports, runtime imports
    state_tree/       — a004–a008: state manifest, init, node arrays, root, dyn-text bufs
    handlers_effects/ — a009–a011: non-map handlers, CPU effects, WGSL shaders
    object_arrays/    — a012–a018: QJS bridge, OA storage, unpack, variant host
    maps_zig/         — a019–a028: map metadata, pool decls, rebuild fns (Zig backend)
    maps_lua/         — a029–a032: Lua map wrapper, rebuilder, nested, dispatch
                        + helper files: lua_map_node, lua_map_style, lua_map_text,
                          lua_map_handler, lua_map_subs, lua_expr
    logic_runtime/    — a033–a038: JS/Lua logic blocks, dyn-text updates, conditionals,
                          variants, dirty tick
    entry/            — a039–a042: app_init, app_tick, app_exports, app_main
    split_finalize/   — a043–a046: section extraction, namespace prefixing, module headers,
                          finalize postpass
  emit_atoms/        — THE emit pipeline. Atoms + the helpers they compose. No separate emit/ or emit_ops/.
    index.js          — runEmitAtoms() dispatch loop
    preamble/         — a001–a003 + helpers
    state_tree/       — a004–a008 + helpers
    handlers_effects/ — a009–a011 + effect_transpile.js, effect_wgsl.js
    object_arrays/    — a012–a018 + emit_oa_bridge.js
    maps_zig/         — a019–a028 + rebuild helpers (emit_pool_node, emit_dyn_text,
                        emit_inner_array, emit_handler_fmt, emit_map_decl,
                        emit_map_press, emit_handler_storage, emit_text_storage,
                        emit_per_item_arr, wire_handler_ptrs, replace_field_refs,
                        wrap_condition, compute_map_meta, constants)
    maps_lua/         — a029–a032 + lua_map_node, lua_map_style, lua_map_text,
                        lua_map_handler, lua_map_subs, lua_expr,
                        emit_lua_element, emit_lua_style, emit_lua_text
    logic_runtime/    — a033–a038 + emit_display_toggle, emit_variant_patch,
                        emit_state_setters, style_assignments
    entry/            — a039–a042
    split_finalize/   — a043–a046
    shared/           — transforms.js (luaTransform/jsTransform — used across groups)
    lua_tree.js       — emitLuaTreeApp (parallel pipeline, not atom-dispatched)
    finalize.js       — finalizeEmitOutput (post-atom wrapper)
  emit/               — DELETED after migration (legacy orchestration)
  emit_ops/           — DISSOLVED into emit_atoms/ group dirs (helpers move to their atoms)
  [everything else: lanes/, collect/, preflight/, parse/, resolve/,
   mod/, rules.js, validate.js, page.js — unchanged by atom migration;
   attrs.js splits in Phase 5d]
```

---

## Phase 1 — Activate the Atom Pipeline

### 1a. Build the parity test harness

Before touching the live path, prove the atoms produce **byte-identical** output.

The standard is byte-identical, not "compilation-equivalent." Two outputs that differ only in whitespace or declaration ordering are functionally identical Zig, but treating cosmetic diffs as acceptable hides real bugs among noise. If atoms produce different whitespace, fix the atom. Every diff is a drift bug.

```
For every conformance cart:
  1. Run emitOutput() legacy path → capture output string A
  2. Run runEmitAtoms(ctx, meta) → capture output string B
  3. Diff A vs B — must be empty
  4. Every diff is a drift bug — fix it in the atom, not the legacy code
```

For split output (atoms 43–46): test not just string equality but **compilation of the split modules**. Split logic is positional — it finds markers in concatenated output and cuts there. If atoms produce sections in slightly different order or with different marker formatting, split breaks silently (output that compiles individually but links wrong). Run `zig build` on split output, not just diff.

The meta object that `runEmitAtoms` needs is already assembled inside `emitOutput()` — `basename`, `pfLane`, `prefix`, `hasState`, `hasDynText`, `fastBuild`, `hasScriptRuntime`, `rootExpr`, `promotedToPerItem`, `hasConds`, `hasVariants`, `hasDynStyles`, `hasFlatMaps`. Wire it to both paths.

**Known drift — verified by reading a001, a002, a003 against legacy emitPreamble:**

| issue | legacy emitPreamble | atoms a001+a002+a003 | severity |
|---|---|---|---|
| `smith_log` import | emitted when `meta.hasRuntimeLog` | **missing entirely** — not in a002 or a003 | **build-breaking** if runtime log used |
| `evalLuaMapData` in qjs_runtime IS_LIB stub | legacy stub has 6 fns including `evalLuaMapData` | a003 stub has only 5 fns — `evalLuaMapData` **missing** | **build-breaking** for IS_LIB builds |
| `comptime { _ = core.zig }` ordering | emitted after all imports (end of preamble) | emitted inside a002's `!fastBuild` block, before a003 runs | cosmetic — Zig doesn't care about order, but fails byte-identical |
| luajit_runtime trigger | `if (meta.hasLuaMaps)` only | `if (meta.hasScriptRuntime \|\| meta.hasLuaMaps)` — more inclusive | semantic — atom imports luajit_runtime for script-only carts too |
| state/engine/qjs imports | in emitPreamble directly | correctly split into a003 | ✅ verified match |

Two of these are build-breaking. They will surface immediately in the parity harness — that's the point of running parity before switching.

**Action:** Fix the `smith_log` and `evalLuaMapData` gaps in the atoms. Decide whether to match legacy ordering for `comptime core.zig` (move to a003) or accept the cosmetic diff. Repeat this verification for all 12 legacy functions × their atom groups.

The full mapping:

| legacy function | atom group | atoms |
|---|---|---|
| `emitPreamble` | preamble | 1, 2, 3 |
| `emitStateManifest` + `emitInitState` | state_tree | 4, 5 |
| `emitNodeTree` | state_tree | 6, 7 |
| `emitDynamicTextBuffers` | state_tree | 8 |
| `emitNonMapHandlers` | handlers_effects | 9 |
| `emitEffectRenders` | handlers_effects | 10, 11 |
| `emitObjectArrayInfrastructure` | object_arrays | 12–18 |
| `emitMapPoolDeclarations` + `emitMapPoolRebuilds` | maps_zig | 19–28 |
| `emitLogicBlocks` | logic_runtime | 33, 34 |
| `emitRuntimeSupportSections` | logic_runtime | 35, 36, 37, 38 |
| `emitRuntimeEntrypoints` | entry | 39, 40, 41, 42 |
| `splitOutput` + `finalizeEmitOutput` | split_finalize | 43, 44, 45, 46 |

### 1b. Switch the live path

Once parity passes across the conformance suite:

```js
// emit.js — THE SWITCH
function emitOutput(rootExpr, file) {
  if (ctx._luaRootNode && typeof emitLuaTreeApp === 'function') {
    var _ltOut = emitLuaTreeApp(ctx, rootExpr, file);
    return finalizeEmitOutput(_ltOut, file);
  }

  var meta = buildEmitMeta(ctx, rootExpr, file);  // extract from current emitOutput
  var out = runEmitAtoms(ctx, meta);
  return finalizeEmitOutput(out, file);
}
```

Note: the lua-tree path (`emitLuaTreeApp`) stays as a special case — it skips the normal parse phase entirely and walks tokens directly to Lua. It does not go through atoms. This is correct because the lua-tree path is a fundamentally different pipeline, not a different arrangement of the same sections. It doesn't produce a Zig file and doesn't consume a normally-parsed context. Making it an atom would break the atom contract. Document it as a parallel pipeline.

### 1b-rollback. Rollback strategy

After the switch goes live: keep the legacy emit/ files **loadable but not loaded** for one release cycle. Comment out their bundle entries rather than deleting the files. Phase 2 deletion is the deliberate point of no return, not Phase 1b.

If a non-conformance cart hits an atom bug post-switch, the legacy path can be re-enabled by uncommenting bundle entries, no code changes needed. This gives the atom pipeline a real proving period under full workload before the legacy path is destroyed.

### 1c. Fix atom 26

Atom 26 (flat Zig map rebuild) is the only unregistered atom. The decision for this plan is:

- **Zig map rebuild remains an active backend.** It is the correct path for static/known-shape maps even when Lua is present in the cart for other reasons.
- Lua map rebuilding exists because dynamic-content maps are genuinely hostile to Zig's comptime-oriented model. That does **not** make the Zig path obsolete. It makes Zig and Lua two backends for different map content profiles.
- Therefore atom 26 must be registered with a **real, data-driven** `_a026_applies` gate, not a hardcoded dormant `return false`.

Target behavior:

- `_a026_applies(ctx, meta)` returns true when the cart has flat Zig-backed maps (`meta.hasFlatZigMaps` or equivalent derived feature flag)
- `_a026_emit(ctx, meta)` calls the live `rebuildMap()` path
- parity harness coverage must include carts that exercise **both** backends: Lua map rebuilds and Zig map rebuilds

Checks:

```bash
# Find carts / compiler code that still route maps to Zig
grep -rn "mapBackend.*zig\|mapBackend.*native" smith/ carts/
```

```bash
# Audit the atom file itself
grep -n "_a026_applies\|_a026_emit" smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js
```

Register atom 26 because the backend is active, not because the registry should look complete on paper.

---

## Phase 2 — Delete Legacy Emit Orchestration

Once atoms are live, these files contain dead code:

| file | lines | reason |
|---|---|---|
| `emit/preamble.js` | 49 | replaced by atoms 1–3 |
| `emit/state_manifest.js` | 24 | replaced by atoms 4–5 |
| `emit/node_tree.js` | 14 | replaced by atoms 6–7 |
| `emit/dyn_text.js` | 22 | replaced by atom 8 |
| `emit/handlers.js` | 10 | replaced by atom 9 |
| `emit/effects.js` | 29 | replaced by atoms 10–11 |
| `emit/object_arrays.js` | 36 | replaced by atoms 12–18 |
| `emit/map_pools.js` | 37 | replaced by atoms 19–28 |
| `emit/logic_blocks.js` | 128 | replaced by atoms 33–34 |
| `emit/runtime_updates.js` | 102 | replaced by atoms 35–38 |
| `emit/entrypoints.js` | 109 | replaced by atoms 39–42 |
| **Legacy orchestration total** | **560** | |

**Keep alive (used by atoms or special paths):**

| file | lines | reason |
|---|---|---|
| `emit/transforms.js` | 163 | `luaTransform`/`jsTransform` — used by atoms, lua-tree, everywhere |
| `emit/effect_transpile.js` | 172 | `transpileEffectBody`/`transpileExpr` — used by atoms 10–11 |
| `emit/effect_wgsl.js` | 361 | `transpileEffectToWGSL` — used by atom 11 |
| `emit/lua_tree_emit.js` | 412 | `emitLuaTreeApp` — the lua-tree special path (not atom-dispatched) |
| `emit/split.js` | 306 | `splitOutput` — post-emit output splitting, used by atoms 43–46 or by finalize |
| `emit/finalize.js` | 23 | `finalizeEmitOutput` — post-atom wrapper |

`emit.js` itself shrinks from 95 lines to ~15 (build meta, call runEmitAtoms, finalize).

---

## Phase 3 — Activate the Zig Map Rebuild Cluster

These files are not dead architecture. They are the implementation of the **active Zig map backend**. They only look dead because atom 26 was never registered, so the atom pipeline never reached them.

Registering atom 26 (Phase 1c) makes this entire cluster live:

| file | lines | role in atom 26 pipeline |
|---|---|---|
| `emit_ops/rebuild_map.js` | 827 | `rebuildMap()` — the orchestrator. Header says "extracted from a026/a027/a028." This IS atom 26's emit function, just never wired. |
| `emit_ops/emit_pool_node.js` | 44 | `emitPoolNodeAssign` — pool node slot assignment |
| `emit_ops/emit_dyn_text.js` | 50 | `emitMapDynText` — per-item text formatting in rebuild loop |
| `emit_ops/emit_inner_array.js` | 100 | `emitInnerArray` — nested map inner array construction |
| `emit_ops/emit_handler_fmt.js` | 57 | `emitHandlerFmt` / `buildFieldRefFmtArgs` — handler format string codegen |
| `emit_ops/replace_field_refs.js` | 27 | `replaceFieldRefs` — field reference substitution in templates |
| `emit_ops/wire_handler_ptrs.js` | 37 | `wireHandlerPtrs` — handler function pointer assignment |
| `emit_ops/emit_lua_rebuild.js` | 46 | `emitLuaRebuildList` — Lua rebuild template builder |
| **Cluster total** | **1,188** | |

### Decision: Zig map backend — active

For this plan, the backend is treated as **active and supported**:

```bash
# Check where non-lua map backends are selected
grep -rn "mapBackend.*zig\|mapBackend.*native" smith/ carts/
```

- Register atom 26.
- Wire `_a026_emit` to the `rebuildMap()` helper cluster.
- Keep the 1,188-line helper cluster in the active bundle.
- Test carts that hit both the Zig map path and the Lua map path.

Why this matters:

- Lua may be loaded for scripting, game logic, or data transforms without implying that map rebuilding should also move to Lua.
- Static/known-shape maps are still a good fit for Zig rebuilds.
- The correct architecture is **backend selection by map content profile**, not "Lua is present, therefore all maps become Lua."

Retirement is no longer the working assumption here. It would require an explicit future decision to remove Zig map rebuilding as a supported backend.

---

## Phase 4 — Resolve Duplicate Globals

These exist because both the legacy emit/ path and the atom path loaded the same code under different filenames.

### 4a. Byte-identical duplicates (delete emit_ops/ copies)

| delete | keep | lines saved |
|---|---|---|
| `emit_ops/effect_transpile.js` | `emit/effect_transpile.js` | 172 |
| `emit_ops/effect_wgsl.js` | `emit/effect_wgsl.js` | 361 |
| **subtotal** | | **533** |

### 4b. Near-duplicate (transforms.js)

`emit_ops/transforms.js` (159 lines) is a subset of `emit/transforms.js` (163 lines). The emit/ version has 4 extra lines in `jsTransform` that strip TypeScript declares. **Delete `emit_ops/transforms.js`.** Lines saved: 159.

### 4c. Global name collision (_jsExprToLua)

Both `emit_ops/js_expr_to_lua.js` (64 lines) and `emit_atoms/maps_lua/lua_map_subs.js` define `_jsExprToLua` as a global. The last one loaded wins. 

- `emit_ops/js_expr_to_lua.js` — takes `(expr, itemParam, indexParam)`, regex-based conversion
- `lua_map_subs.js` — takes `(expr, itemParam, indexParam, _luaIdxExpr)`, has 4th param

This is not just cleanup debt. It is a live correctness risk because the wrong loader order can silently change Lua expression generation, especially for index-sensitive map code.

**Action:** Verify this during Phase 1a, not after teardown.

- Confirm which definition currently wins in bundle load order
- Verify whether `lua_map_subs.js` is a true superset
- Pay special attention to `_luaIdxExpr` handling for Lua's 1-indexed array access

Then in Phase 4:

- If `lua_map_subs.js` is the superset, delete `emit_ops/js_expr_to_lua.js` (64 lines)
- Otherwise port the missing behavior into the kept copy and delete the other one

### Phase 4 total: ~756 lines deleted

---

## Phase 5 — Structural Cleanup

These are independent of the atom migration and can be done in any order.

### 5a. Cursor helper consolidation

Merge `parse/utils.js` (58 lines) + `parse/children/brace_util.js` (67 lines) into `parse/cursor.js`. Move `peekPropsAccess` / `skipPropsAccess` from `core.js`.

`brace_util.js` deleted (~67 lines). `core.js` trims (~40 lines). Net: one file, one place for cursor operations.

Do NOT move `skipRenderLocalDestructure` / `readRawJsExpression` from `collect/render_locals.js` — these are collection-specific, not generic cursor helpers.

### 5b. Resolution surface cleanup

Move from `core.js` to `resolve/`:
- `tryResolveObjectStateAccess` → `resolve/state_access.js`
- `resolveConstOaAccess` + `resolveConstOaFieldFromRef` → `resolve/const_oa.js`

Zero line change. One folder answers "how does a name resolve."

### 5c. validate.js registry pattern

Each rule in `preflight/rules/` exports `{ name, check }`. `validate.js` iterates the registry. Adding a rule becomes a one-file change.

### 5d. `attrs.js` decomposition — 51 functions, 1560 lines → individual helpers

`attrs.js` is the largest JS file in the compiler. The full enumeration (COMPILER_MANIFEST.md § 6) shows 51 functions spanning 5+ unrelated responsibilities glued into one file. The more things stay glued, the more fragile it gets — every edit risks collateral in an unrelated subsystem.

The principle is the same as atoms: each helper does one job, lives in its own file, is independently testable and replaceable. Not "split into 4 big files" — decompose into individual responsibilities.

**Target: `parse/attrs/` directory**

| file | function(s) | lines | responsibility |
|---|---|---|---|
| `parse/attrs/color.js` | `parseColor` | ~25 | hex → Color.rgb conversion |
| `parse/attrs/style_value.js` | `parseStyleValue` | ~137 | single style key:value parsing |
| `parse/attrs/style_block.js` | `parseStyleBlock` | ~190 | `style={{...}}` block walk |
| `parse/attrs/style_ternary.js` | `parseTernaryBranch` | ~48 | ternary branches in style values |
| `parse/attrs/style_normalize.js` | `_normalizeStyleExprJs`, `_styleExprQuote` | ~25 | JS→Zig style expression cleanup |
| `parse/attrs/style_expr_tokenizer.js` | `_readStyleAttrExpressionRaw`, `_tokenizeStyleExpr`, `_makeStyleTokenStream` | ~100 | style expression tokenizer |
| `parse/attrs/style_expr_tokens.js` | `_stylePeek`, `_styleMatch`, `_styleConsume`, `_styleLooksZigString`, `_styleLooksZigExpr` | ~35 | token stream primitives |
| `parse/attrs/style_expr_resolve.js` | `_styleResolvedLiteral`, `_styleResolvedExpr`, `_coerceResolvedStyleValue`, `_resolveStyleIdentifierValue`, `_resolveStyleObjectReference` | ~90 | resolved value constructors |
| `parse/attrs/style_expr_spec.js` | `_styleSpecToExpr`, `_styleSpecBoolExpr` | ~15 | spec → expression converters |
| `parse/attrs/style_expr_parser.js` | `_styleParsePrimary`, `_styleParseUnary`, `_styleParseComparison`, `_styleParseAnd`, `_styleParseOr`, `_styleParseObjectValue`, `_styleParseObject`, `_styleParseIife`, `_styleParseBase`, `_styleParseExpr` | ~170 | Pratt parser — each precedence level |
| `parse/attrs/style_expr_entry.js` | `_parseStyleExprFromRaw`, `parseStyleExpressionAttr`, `_styleExprCollectKeys`, `_styleExprResolveField` | ~40 | style expression entry + field extraction |
| `parse/attrs/pending_style.js` | `_pendingStyleFieldMeta` → `applyPendingStyleExprs` (10 fns) | ~140 | deferred style field system |
| `parse/attrs/handler.js` | `parseHandler` | ~145 | Zig handler body parsing |
| `parse/attrs/handler_lua.js` | `luaParseHandler` | ~180 | Lua handler body parsing |
| `parse/attrs/value_expr.js` | `parseValueExpr` | ~30 | JSX prop value expression parsing |
| `parse/attrs/value_expr_lua.js` | `luaParseValueExpr` | ~100 | Lua prop value expression parsing |

**Misplaced utilities — move out entirely:**
- `_condPropValue` → `core.js` (called from parse/brace/conditional.js, parse/children/brace.js)
- `slotSet` → `core.js` (called from parse/handlers/press.js, emit/handlers.js — same surface as `slotGet`)

**`attrs.js` after decomposition:** becomes `parse/attrs/index.js`, a thin re-export or entry point (~20 lines). Or disappears entirely if all callers import from the specific files.

**Same treatment applies to any other file over ~200 lines with multiple independent responsibilities.** The manifest now shows exactly which files those are — `build_node.js` (912 lines, 3 fns), `page.js` (723 lines, 11 fns), `emit_lua_element.js` (569 lines, 2 fns). Each one should be evaluated the same way: if the functions inside don't need each other, they don't need the same file.

### 5e. rules.js ↔ constants.js audit

Verify `rules.js` tag classification functions read from `emit_ops/constants.js`, not maintaining independent lists.

---

## The Two Lua Codegen Families — Why They're Both Correct

The Sonnet plan proposed merging these with `mode: 'tree' | 'map'`. That's wrong. They operate at different pipeline stages with incompatible input types.

### Family 1: Cursor-based (emit_ops/)

| file | lines | input | called by |
|---|---|---|---|
| `emit_lua_element.js` | 569 | cursor `c` at JSX tokens | `parse/children/brace_maps.js` (live parse path) |
| `emit_lua_style.js` | 99 | cursor `c` at `{{` | `emitLuaElement` internally |
| `emit_lua_text.js` | 69 | cursor `c` at text tokens | `emitLuaElement` internally |

These are combined **parser+emitters**. They walk raw tokens (`c.kind() === TK.lt`, `c.advance()`) and produce Lua directly. Used during parse for nested map bodies where the Lua template is built on the fly.

### Family 2: AST-based (emit_atoms/maps_lua/)

| file | lines | input | called by |
|---|---|---|---|
| `lua_map_node.js` | 311 | parsed `node` object | `emit/lua_tree_emit.js`, `emit/logic_blocks.js` |
| `lua_map_style.js` | 229 | parsed `style` object | `_nodeToLua` internally |
| `lua_map_text.js` | 254 | parsed text value | `_nodeToLua` internally |
| `lua_map_handler.js` | 74 | parsed handler object | `_nodeToLua` internally |
| `lua_map_subs.js` | 143 | string expressions | `_styleToLua`, `_textToLua` etc. |
| `lua_expr.js` | 171 | cursor `c` at expression | atom pipeline (map Lua expression building) |

These are **pure emitters** converting already-parsed AST structures to Lua tables. `_nodeToLua(node, ...)` reads `node.style`, `node.text`, `node.children` — it doesn't walk tokens.

### What IS shareable (~60 lines, not 800)

The Lua syntax conversion rules are duplicated across both families:
- `===` → `==`, `!==` → `~=`, `&&` → `and`, `||` → `or`
- Ternary `? :` → `and/or`
- Hex color → `0x` format
- `@intCast`/`@as` stripping
- `__eval()` wrapping for non-Lua function calls

Extract these as `lua_codegen/syntax.js` (~60 lines). Both families import it. Everything else stays where it is.

---

## Summary

| phase | action | lines deleted | lines added |
|---|---|---|---|
| 1 | Activate atom pipeline, fix drift, register atom 26 | ~0 | ~30 (meta builder, switch) |
| 2 | Delete legacy emit/ orchestration | ~560 | 0 |
| 3 | Activate Zig map rebuild cluster | 0 | 0 |
| 4 | Resolve duplicate globals | ~756 | 0 |
| 5 | Structural cleanup | ~107 | ~60 (cursor.js, syntax.js) |
| **Total** | | **~1,423** | **~90** |

**Net reduction: ~1,300 lines while keeping Zig map rebuilding as an active backend. File count: 200 → ~191.**

The line count is not the point. The point is eliminating the dual-path ambiguity where every future emit change requires asking "do I change the legacy function or the atom?" After Phase 2, that question disappears.

---

## Execution Order

1. **Phase 1** — Atom activation. This is the spine. Everything else depends on it.
   - 1a first (parity harness). Non-destructive — runs both paths, diffs output.
   - 1b only after parity passes on every conformance cart.
   - 1b-rollback: legacy path stays loadable-but-not-loaded for one cycle.
   - 1c (atom 26) during 1a — register it, wire the real applies gate, and include Zig-map carts in parity coverage.
   - 4c verification also starts during 1a — `_jsExprToLua` collision is a live risk and should not wait for duplicate cleanup.

2. **Phase 3** — Zig map rebuild cluster. Atom 26 is active, so the helpers are live code. Test the backend explicitly rather than treating it as dormant reference.

3. **Phase 2** — Legacy emit/ teardown. Do after Phase 1 proves atoms are live and the rollback period passes.

4. **Phase 4** — Duplicate resolution. Do after Phase 2 so you're not deleting files that the legacy path still loads.

5. **Phase 5** — Structural cleanup. Independent, do any time.

---

## Open Questions

1. **Lua-tree path stays outside atoms.** `emitLuaTreeApp` (412 lines) is a fundamentally different pipeline — cursor → Lua, no normal parse, doesn't produce a Zig file, doesn't consume a normally-parsed context. Making it an atom would require either breaking the atom contract (atoms produce Zig sections from parsed context) or creating a "not really an atom" atom. It stays as a parallel pipeline with a documented reason.

2. **split.js and atoms:** `splitOutput` (306 lines) post-processes the assembled Zig output into per-module files. Atoms 43–46 handle this in the atom pipeline. After activation, verify that the atom split path matches the legacy `splitOutput` path — this is where the most complex drift is likely because split logic depends on the exact shape of everything that came before it.

3. **emit.js after cleanup:** It becomes a ~15-line file (build meta, call runEmitAtoms, finalize). Should it stay as `emit.js` or fold into `emit_atoms/index.js`? Keep it separate — `emit.js` is the public API ("produce output from this parsed context"), `emit_atoms/index.js` is the internal dispatch.
