# Contract 0411-0458 — Entry / Split / Finalize Parity

Purpose:
- This contract expands base steps `411-458` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the entry/split/finalize atom group.
- This contract addresses the a039 and a040 mismatches identified in the ATOM_PARITY_REPORT (HIGH and MEDIUM severity respectively).

Scope:
- Compare atoms `a039` through `a046` against their monolith owners in `emit/entrypoints.js`, `emit/split.js`, and `emit/finalize.js`.
- Patch only the atom files if any literal mismatch is found.
- Resolve the known a039 missing luajit registration / mapBackend check / evalLuaMapData / initial rebuild (HIGH severity).
- Resolve the known a040 missing evalLuaMapData and collapsed code paths (MEDIUM severity).
- Verify a041-a042 remain MATCH and a043-a046 remain MATCH / NEEDS VERIFICATION.

## Verification Layers

- `contract parity`
  - required
  - the same app_init structure, app_tick structure, export symbol list, main scaffold, split section boundaries, namespace prefixing, module headers, and finalize postpass must exist
- `byte parity`
  - required
  - atoms `a039-a046` must match the monolith output for identical ctx/meta inputs
- `visual parity`
  - required
  - the engine is unchanged; init/tick orchestration directly affects rendered output
  - exact whole-screen plus named-region hashes are required under [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)
- `behavioral parity`
  - required
  - a039 init ordering determines whether Lua maps get their initial data; a040 tick ordering determines whether Lua maps refresh on state changes; split output determines whether multi-file builds compile

## Pattern In

- Reader-side syntax can vary. This contract uses conformance fixtures that exercise:
  - App init with OA registration, map wrapper registration, initial rebuilds
  - App tick with dirty-tick dispatch, variant updates, QJS/LuaJIT tick
  - App exports (app_get_* ABI, state ABI)
  - App main scaffold (engine.run)
  - Split output (multi-file .zig generation)
  - Finalize postpass (debug appendix, undefined-zeroing, split handoff)
- Suitable fixtures:
  - [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz) — Lua maps + init + tick + evalLuaMapData
  - [d04_map_handler_captures.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d04_map_handler_captures.tsz) — map handlers + init registration
  - [d06_ternary_jsx_branches.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d06_ternary_jsx_branches.tsz) — conditionals + tick
- This contract covers two distinct atom groups:
  - Entry atoms (a039-a042): `zig` target, runtime entrypoint functions
  - Split/finalize atoms (a043-a046): `split` target + `zig` target, post-emit processing

## Middle Record

- `pattern_in`
  - app-level init orchestration (OA registration, map wrapper registration, initial data eval, initial rebuild, initial update calls)
  - app-level tick orchestration (dirty gate, dynamic updates, map rebuilds, Lua bridge, variant updates, QJS/LuaJIT tick)
  - app ABI exports (root, init, tick, js_logic, lua_logic, title, state count, state accessors)
  - app main scaffold (engine.run with config struct)
  - split section extraction (19 regex patterns for section boundaries)
  - split namespace prefixing (pub promotion, cross-module refs)
  - split module headers (per-file @import generation)
  - finalize postpass (debug appendix, undefined-zeroing, split handoff)
- `node_id`
  - a039: wrapper node lookup via `__lmwN` test_id in arrayDecls, elemIdx counting
  - a040-a042: not applicable (orchestration and ABI surface)
  - a043-a046: not applicable (post-emit processing)
- `parent_id`
  - a039: map wrapper pointer registration with `luajit_runtime.setMapWrapper`
- `node_kind`
  - not applicable at this layer
- `string_literals`
  - a039: `_appInit`, `_initState`, `qjs_runtime.registerHostFn`, `luajit_runtime.registerHostFn`, `luajit_runtime.setMapWrapper`, `qjs_runtime.evalLuaMapData`, `luajit_runtime.callGlobal("__rebuildLuaMaps")`, `_updateDynamicTexts`, `_updateConditionals`, `_updateVariants`, `_rebuildMapN`, `_initMapLuaPtrsN_M`, input.setOnSubmit/setOnChange
  - a040: `_appTick`, `state.isDirty`, `state.clearDirty`, `_updateDynamicTexts`, `_updateConditionals`, `_updateVariants`, `_rebuildMapN`, `luajit_runtime.callGlobal("__rebuildLuaMaps")`, `qjs_runtime.tick`, `luajit_runtime.tick`, `applescript.pollResult`
  - a041: `app_get_root`, `app_get_init`, `app_get_tick`, `app_get_js_logic`, `app_get_lua_logic`, `app_get_title`, `app_state_count`, `app_state_slot_type`, `app_state_get_int/float/bool/string_ptr`, `app_state_set_int/float/bool/string`, `app_state_mark_dirty`
  - a042: `pub fn main`, `engine.run`, `.title`, `.root`, `.js_logic`, `.lua_logic`, `.init`, `.tick`
  - a043: 19 section boundary regex patterns (state_manifest, nodes, dyntxt, handlers, effects, oa, maps, jslogic, lualogic, initstate, updatedyn, updatecond, updatevariants, appinit, apptick, exports, stateexports, mainfn, debug)
  - a044: `pub` prefix rules, `nodes.`, `st.`, `maps.`, `handlers.`, `logic.` namespace prefixes
  - a045: `//! Generated by tsz compiler`, `@import("std")`, `build_options`, `IS_LIB`, framework module imports, cross-module imports, `__SPLIT_OUTPUT__`, `__FILE:name__`
  - a046: `// ── SMITH DEBUG ──`, `// DBG:`, `std.mem.zeroes`, split handoff
- `size_literals`
  - a039: OA oaIdx values, map lmi indices, input handler IDs
  - a040: map indices for rebuildMap calls
  - a041: stateSlots.length, slot type numeric codes (0=int, 1=float, 2=boolean, 3=string)
  - a042: appName.length (implicit in title string)
- `style_literals`
  - not applicable at this layer
- `conditionals`
  - a039: `if (oa.isNested || oa.isConst) continue` for OA registration, `if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue` for map rebuilds
  - a040: `state.isDirty()` gate with three branch shapes (hasDynStyles / maps / state-only), `if (meta.hasVariants)` for unconditional variant update
  - a041: `if (meta.hasState)` for state ABI exports
  - a042: `if (IS_LIB) return` for standalone check
  - a043: `globalThis.__splitOutput == 1` gate
  - a046: split handoff via `globalThis.__splitOutput == 1`
- `variants`
  - a039: variant host setter registration (`__setVariant`)
  - a040: `_updateVariants()` call outside dirty gate
- `handlers`
  - a039: map handler init via `_initMapLuaPtrsN_M()`, input submit/change handler registration
- `maps`
  - a039: `_rebuildMapN()` calls at init, `luajit_runtime.setMapWrapper` for Lua maps, `qjs_runtime.evalLuaMapData` for Lua map data, `luajit_runtime.callGlobal("__rebuildLuaMaps")` for initial Lua rebuild
  - a040: `_rebuildMapN()` calls in dirty tick, `__rebuildLuaMaps` call
- `render_locals`
  - not applicable
- `dyn_text`
  - a039: `_updateDynamicTexts()` call at init
  - a040: `_updateDynamicTexts()` call in dirty tick
- `dyn_style`
  - a040: hasDynStyles flag drives first branch path selection
- `dyn_color`
  - not applicable at this layer (handled by a035)
- `runtime_bridges`
  - a039: `qjs_runtime.registerHostFn` for OA + variant, `luajit_runtime.registerHostFn` for OA (MISSING in current atom), `qjs_runtime.evalLuaMapData` for Lua map data init (MISSING in current atom), `luajit_runtime.callGlobal("__rebuildLuaMaps")` for initial Lua rebuild (MISSING in current atom)
  - a040: `qjs_runtime.evalLuaMapData` for dirty tick Lua data refresh (MISSING in current atom), `qjs_runtime.tick()`, `luajit_runtime.tick()`
  - a046: split handoff to `splitOutput()`
- `pattern_backend_flags`
  - not applicable at this layer
- `realization_mode`
  - a039-a042: `zig` (native Zig runtime entrypoints)
  - a043-a045: `split` (multi-file output processing)
  - a046: `zig` (final postpass) with optional split handoff
- `zig_tree_eligible`
  - a039-a042: yes (pure Zig entrypoints)
  - a043-a046: n/a (post-emit processing)
- `lua_tree_required`
  - when `ctx._luaMapRebuilders.length > 0`, a039 must register wrappers and do initial eval/rebuild, a040 must include evalLuaMapData in tick
- `backend_reason_tags`
  - `evalLuaMapData` bridge needed in a039 init and a040 tick when Lua maps exist
  - `luajit_runtime.registerHostFn` needed in a039 for OA when Lua maps exist
- `emit_out`
  - `a039` `fn _appInit() void { ... }`
  - `a040` `fn _appTick(now: u32) void { ... }`
  - `a041` `export fn app_get_*` and state ABI exports
  - `a042` `pub fn main() !void { ... engine.run(...) }`
  - `a043` section extraction producing `{F}` map of 6 target files
  - `a044` namespace prefixing transforming `{F}` in-place
  - `a045` module header generation + `__SPLIT_OUTPUT__` encoding
  - `a046` debug appendix + undefined-zeroing + split handoff decision

## Emit Out

- Output owners:
  - [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js)
  - [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js)
  - [a041_app_exports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a041_app_exports.js)
  - [a042_app_main.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a042_app_main.js)
  - [a043_split_section_extraction.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a043_split_section_extraction.js)
  - [a044_split_namespace_prefixing.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a044_split_namespace_prefixing.js)
  - [a045_split_module_headers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a045_split_module_headers.js)
  - [a046_finalize_postpass.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a046_finalize_postpass.js)
- Legacy compare surfaces:
  - [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js)
  - [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js)
  - [finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- Target backends:
  - a039-a042: `zig`
  - a043-a045: `split`
  - a046: `zig` (with split handoff)

Canonical intent sources:
- [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js)
- [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js)
- [finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) §Group 7 (a039-a042) and §Group 8 (a043-a046)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js) line `72`

Owned files:
- [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js)
- [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js)
- [a041_app_exports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a041_app_exports.js)
- [a042_app_main.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a042_app_main.js)
- [a043_split_section_extraction.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a043_split_section_extraction.js)
- [a044_split_namespace_prefixing.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a044_split_namespace_prefixing.js)
- [a045_split_module_headers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a045_split_module_headers.js)
- [a046_finalize_postpass.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a046_finalize_postpass.js)
- [entry_split_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/entry_split_status.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js)
- [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js)
- [finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)
- [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz)
- [d04_map_handler_captures.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d04_map_handler_captures.tsz)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)

Required artifacts:
- `tsz/compiler/migration/reports/sections/entry_split_status.md`
- `tsz/compiler/migration/reports/parity/entry_smoke.json`
- `tsz/compiler/migration/reports/split/split_smoke.md`
- `tsz/compiler/migration/reports/visual/entry_split_visual.json`

Completion criteria:
- `a039` registers OA with both `qjs_runtime.registerHostFn` AND `luajit_runtime.registerHostFn`, skips Lua-backend maps in `_rebuildMapN()` loop, includes `qjs_runtime.evalLuaMapData()` calls, includes `luajit_runtime.callGlobal("__rebuildLuaMaps")` at init
- `a040` includes `qjs_runtime.evalLuaMapData()` calls before `__rebuildLuaMaps` in dirty tick, preserves the three-branch structure (hasDynStyles / maps / state-only) matching the monolith
- `a041` continues to match (already verified MATCH)
- `a042` continues to match (already verified MATCH)
- `a043` continues to match (already verified MATCH)
- `a044` continues to match (already verified MATCH)
- `a045` continues to match (already verified MATCH)
- `a046` calling convention verified as compatible with `runEmitAtoms()` orchestration
- `entry_split_status.md` records the grounding line, separate results for each atom, and explicit coverage of the evalLuaMapData gap and luajit registration gap
- entry parity report exists and matches the parity schema
- split smoke report exists and confirms multi-file build success
- visual parity report exists and matches the visual-parity method

## Known Mismatch Context

The ATOM_PARITY_REPORT identifies four issues in a039 (HIGH severity):
1. Missing `luajit_runtime.registerHostFn` for OA unpack — monolith registers with both QJS and LuaJIT
2. Missing `mapBackend === 'lua_runtime'` skip — monolith skips Lua-backend maps in Zig rebuild loop
3. Missing `qjs_runtime.evalLuaMapData(...)` calls — monolith evaluates source data for Lua maps
4. Missing `luajit_runtime.callGlobal("__rebuildLuaMaps")` — monolith triggers initial Lua rebuild

The ATOM_PARITY_REPORT identifies two issues in a040 (MEDIUM severity):
1. Missing `evalLuaMapData` calls before `__rebuildLuaMaps`
2. Collapsed code paths (two branches merged into one condition)

The a046 has NEEDS VERIFICATION status due to calling convention difference: atom takes `(out, ctx, file)` while monolith takes `(out, file)` with `ctx` from closure.

All of these are part of the systematic `evalLuaMapData` gap pattern.

## Microsteps

### Setup

- [ ] ES001. Open [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `1-109`.
- [ ] ES002. Open [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js) lines `1-306`.
- [ ] ES003. Open [finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js) lines `1-41`.
- [ ] ES004. Open [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) lines `1-99`.
- [ ] ES005. Open [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js) lines `1-58`.
- [ ] ES006. Open [a041_app_exports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a041_app_exports.js) lines `1-59`.
- [ ] ES007. Open [a042_app_main.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a042_app_main.js) lines `1-40`.
- [ ] ES008. Open [a043_split_section_extraction.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a043_split_section_extraction.js) lines `1-91`.
- [ ] ES009. Open [a044_split_namespace_prefixing.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a044_split_namespace_prefixing.js) lines `1-124`.
- [ ] ES010. Open [a045_split_module_headers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a045_split_module_headers.js) lines `1-197`.
- [ ] ES011. Open [a046_finalize_postpass.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a046_finalize_postpass.js) lines `1-63`.
- [ ] ES012. Open [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) lines `129-183`.
- [ ] ES013. Create `tsz/compiler/migration/reports/sections/entry_split_status.md` if it does not exist.
- [ ] ES014. Write a heading `# Entry / Split / Finalize Status` into `entry_split_status.md` if the file is new.
- [ ] ES015. Add the grounding line `Grounding: a039 app_init; a040 app_tick; a041 app_exports; a042 app_main; a043 split section extraction; a044 split namespace prefixing; a045 split module headers; a046 finalize postpass. evalLuaMapData gap and luajit OA registration gap are the primary known defects.` to `entry_split_status.md`.

### a039 — App Init (4 missing features)

- [ ] ES016. Read [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) lines `19-26` and confirm the OA registration loop only calls `qjs_runtime.registerHostFn`.
- [ ] ES017. Read [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `22-27` and confirm the monolith registers each non-const non-nested OA with `luajit_runtime.registerHostFn` in addition to `qjs_runtime.registerHostFn`.
- [ ] ES018. Write `a039_has_luajit_registerHostFn_for_oa_before_patch: false` to `entry_split_status.md`.
- [ ] ES019. In [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js), locate the OA registration loop (lines `19-25`). After the existing `qjs_runtime.registerHostFn` line (line `22`), insert the following exact line:
```js
    out += '    luajit_runtime.registerHostFn("__setObjArr' + oa.oaIdx + '", @ptrCast(&_oa' + oa.oaIdx + '_unpack), 1);\n';
```
- [ ] ES020. Re-open [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) and confirm the OA registration loop now contains both `qjs_runtime.registerHostFn` and `luajit_runtime.registerHostFn`.
- [ ] ES021. Write `a039_has_luajit_registerHostFn_for_oa_after_patch: true` to `entry_split_status.md`.

- [ ] ES022. Read [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) lines `50-64` and confirm the Zig map rebuild loop at init does NOT skip Lua-backend maps.
- [ ] ES023. Read [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `50-64` and note the monolith's Zig map rebuild loop structure. Note: the atom's current loop already uses `if (ctx.maps[mi2].isNested || ctx.maps[mi2].isInline) continue` but does NOT check `mapBackend`.
- [ ] ES024. Write `a039_has_mapBackend_lua_skip_before_patch: false` to `entry_split_status.md`.
- [ ] ES025. Determine from the monolith whether a `mapBackend === 'lua_runtime'` check exists in the init `_rebuildMapN()` loop. Read [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `60-64` carefully.
- [ ] ES026. If the monolith skips Lua-backend maps in the Zig rebuild loop, add the equivalent skip condition to a039's rebuild loop. If the monolith does NOT have this check (because Lua maps are already excluded by `isNested`/`isInline`), write `a039_mapBackend_skip_not_needed_because_lua_maps_excluded_by_structure: true` to `entry_split_status.md`.
- [ ] ES027. Re-open [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) and confirm the rebuild loop state.

- [ ] ES028. Read [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) lines `67-84` and confirm the Lua map wrapper registration block exists but does NOT include `qjs_runtime.evalLuaMapData` calls or `luajit_runtime.callGlobal("__rebuildLuaMaps")`.
- [ ] ES029. Read [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `55-62` and confirm the monolith includes `qjs_runtime.evalLuaMapData(ldi, "source")` calls in a loop plus `luajit_runtime.callGlobal("__rebuildLuaMaps")` after the wrapper registration.
- [ ] ES030. Write `a039_has_evalLuaMapData_at_init_before_patch: false` to `entry_split_status.md`.
- [ ] ES031. Write `a039_has_callGlobal_rebuildLuaMaps_at_init_before_patch: false` to `entry_split_status.md`.
- [ ] ES032. In [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js), locate the end of the Lua map wrapper registration block (after the `break;` and closing braces of the arrayDecls loop, before `out += '}\n\n';`). Insert the following exact block:
```js
    // Initial data evaluation + rebuild
    for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
      if (ctx._luaMapRebuilders[ldi].isNested) continue;
      var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += '            qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
    }
    out += '            luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
```
- [ ] ES033. Re-open [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) and confirm the evalLuaMapData loop and callGlobal line are present after the wrapper registration block and inside the `if (ctx._luaMapRebuilders ...)` conditional.
- [ ] ES034. Write `a039_has_evalLuaMapData_at_init_after_patch: true` to `entry_split_status.md`.
- [ ] ES035. Write `a039_has_callGlobal_rebuildLuaMaps_at_init_after_patch: true` to `entry_split_status.md`.
- [ ] ES036. Confirm the evalLuaMapData calls use `ctx._luaMapRebuilders[ldi].rawSource` with proper escaping (backslash and double-quote), matching the monolith.

### a040 — App Tick (evalLuaMapData gap + code path structure)

- [ ] ES037. Read [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js) lines `16-46` and note the current code path structure.
- [ ] ES038. Read [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `74-91` and note the monolith's _appTick structure: `state.isDirty()` gate with three branch shapes matching `emitRuntimeSupportSections()`, followed by variant update outside the gate, followed by `qjs_runtime.tick()` + `luajit_runtime.tick()`.
- [ ] ES039. Write `a040_has_evalLuaMapData_in_tick_before_patch: false` to `entry_split_status.md`.
- [ ] ES040. Compare the atom's code path structure to the monolith's. The atom currently collapses the hasDynStyles and maps branches. Note whether the monolith's `runtime_updates.js` `_dirtyTick()` function has the same three-branch structure as entrypoints.js `_appTick()`.
- [ ] ES041. Write `a040_code_path_structure_matches_monolith: true|false` to `entry_split_status.md` based on the comparison. If false, note the exact structural difference.
- [ ] ES042. In [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js), locate each `hasLuaMaps` branch where `luajit_runtime.callGlobal("__rebuildLuaMaps")` is emitted.
- [ ] ES043. For each such branch, insert the following exact block immediately BEFORE the `callGlobal` line:
```js
      for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
        if (ctx._luaMapRebuilders[ldi].isNested) continue;
        var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        out += '        qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
      }
```
- [ ] ES044. Re-open [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js) and confirm all `hasLuaMaps` branches now contain `evalLuaMapData` calls before `callGlobal("__rebuildLuaMaps")`.
- [ ] ES045. Write `a040_has_evalLuaMapData_in_tick_after_patch: true` to `entry_split_status.md`.

### a041 — App Exports (already MATCH)

- [ ] ES046. Read [a041_app_exports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a041_app_exports.js) lines `16-47` and confirm the atom emits `app_get_root`, `app_get_init`, `app_get_tick`, `app_get_js_logic`, `app_get_lua_logic`, `app_get_title`, `app_state_count`, slot types, and state accessor exports.
- [ ] ES047. Read [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js) lines `93-108` and confirm the monolith's export section.
- [ ] ES048. Compare the atom's export symbol list and ordering to the monolith's. Note: the atom uses `app_get_init() ?*const fn () void` return type while the monolith uses `*const fn () void`. Record the exact difference.
- [ ] ES049. Write `a041_export_symbols_match_monolith: true|false` to `entry_split_status.md`. If false, note the exact difference.

### a042 — App Main (already MATCH)

- [ ] ES050. Read [a042_app_main.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a042_app_main.js) lines `16-28` and confirm the atom emits `pub fn main() !void { ... engine.run(...) }`.
- [ ] ES051. Write `a042_main_scaffold_matches_monolith: true|false` to `entry_split_status.md`.

### a043 — Split Section Extraction (already MATCH)

- [ ] ES052. Read [a043_split_section_extraction.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a043_split_section_extraction.js) lines `30-79` and confirm the atom uses the same 19 regex patterns and same section grouping as [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js) lines `9-56`.
- [ ] ES053. Compare the 19 regex patterns one by one between the atom and the monolith.
- [ ] ES054. Write `a043_section_patterns_match_monolith: true|false` to `entry_split_status.md`.
- [ ] ES055. Compare the section-to-file grouping (F['nodes.zig'], F['handlers.zig'], etc.) between atom and monolith.
- [ ] ES056. Write `a043_section_grouping_matches_monolith: true|false` to `entry_split_status.md`.

### a044 — Split Namespace Prefixing (already MATCH)

- [ ] ES057. Read [a044_split_namespace_prefixing.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a044_split_namespace_prefixing.js) lines `30-112` and confirm the atom's pub promotion rules, dedup logic, and cross-reference prefixing match [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js) lines `58-143`.
- [ ] ES058. Write `a044_pub_promotion_rules_match_monolith: true|false` to `entry_split_status.md`.
- [ ] ES059. Write `a044_cross_reference_prefixing_matches_monolith: true|false` to `entry_split_status.md`.

### a045 — Split Module Headers (already MATCH)

- [ ] ES060. Read [a045_split_module_headers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a045_split_module_headers.js) lines `33-186` and confirm the atom's mkHeader function, origin tags, and __SPLIT_OUTPUT__ encoding match [split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js) lines `146-306`.
- [ ] ES061. Write `a045_mkHeader_import_logic_matches_monolith: true|false` to `entry_split_status.md`.
- [ ] ES062. Write `a045_origin_tags_match_monolith: true|false` to `entry_split_status.md`.
- [ ] ES063. Write `a045_split_encoding_matches_monolith: true|false` to `entry_split_status.md`.

### a046 — Finalize Postpass (NEEDS VERIFICATION)

- [ ] ES064. Read [a046_finalize_postpass.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a046_finalize_postpass.js) lines `25-52` and confirm the atom takes `(out, ctx, file)` as arguments.
- [ ] ES065. Read [finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js) lines `32-39` and confirm the monolith's `finalizeEmitOutput(out, file)` accesses `ctx` from closure scope (not as argument).
- [ ] ES066. Write `a046_calling_convention_differs_from_monolith: true` to `entry_split_status.md`.
- [ ] ES067. Determine whether the calling convention difference is compatible with `runEmitAtoms()`. The atom receives `ctx` as an explicit parameter. The monolith receives `ctx` from closure. Both have access to the same object. Write `a046_calling_convention_compatible_with_runEmitAtoms: true|false` to `entry_split_status.md`.
- [ ] ES068. Compare the atom's debug appendix body (lines `27-39`) to the monolith's `appendEmitDebugSections()` (finalize.js lines `3-14`).
- [ ] ES069. Write `a046_debug_appendix_matches_monolith: true|false` to `entry_split_status.md`.
- [ ] ES070. Compare the atom's undefined-zeroing regex (line `42-44`) to the monolith's (finalize.js lines `35-37`).
- [ ] ES071. Write `a046_undefined_zeroing_matches_monolith: true|false` to `entry_split_status.md`.
- [ ] ES072. Note that the atom's `_a046_emit` does NOT call `splitOutput()` — the split handoff is documented as deferred to the orchestration layer. The monolith's `finalizeEmitOutput()` does call `splitOutput()` when `__splitOutput == 1`. Write `a046_split_handoff_deferred_to_orchestration: true` to `entry_split_status.md`.
- [ ] ES073. Confirm the split handoff deferral is correct: when atoms are active, the atom pipeline should call a043→a044→a045 explicitly rather than having a046 call `splitOutput()` internally. Write `a046_split_deferral_is_intentional_and_correct: true|false` to `entry_split_status.md`.

### Parity Verification

- [ ] ES074. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to smoke verification.
- [ ] ES075. Run the parity harness on a cart with Lua maps and init/tick (e.g., [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz)) and write the output to `tsz/compiler/migration/reports/parity/entry_smoke.json`.
- [ ] ES076. Open `entry_smoke.json` and confirm it exists.
- [ ] ES077. Open `entry_smoke.json` and confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] ES078. Read `predicted_atoms` in `entry_smoke.json` and confirm atoms `39` and `40` are present.
- [ ] ES079. Read `diff_status` in `entry_smoke.json`.
- [ ] ES080. If `entry_smoke.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `entry_split_status.md` under the entry cart path.
- [ ] ES081. If `entry_smoke.json` has `diff_status` equal to `match`, add the line `Entry parity: MATCH on d01_nested_maps` to `entry_split_status.md`.

### Split Verification

- [ ] ES082. Run split verification on a cart and write the result to `tsz/compiler/migration/reports/split/split_smoke.md`.
- [ ] ES083. Open `split_smoke.md` and confirm it exists.
- [ ] ES084. Confirm `split_smoke.md` records: (a) whether split modules were produced, (b) whether each produced module compiled, (c) list of produced files.
- [ ] ES085. If split modules failed to compile, record the exact error in `entry_split_status.md`.
- [ ] ES086. If split modules compiled, add the line `Split verification: PASS on [cart_path]` to `entry_split_status.md`.

### Visual Verification

- [ ] ES087. Ensure the visual capture harness exists before continuing. If it does not exist, append `0411-0458 entry-split-finalize visual harness missing` to `blocked.txt` and stop.
- [ ] ES088. Capture visual parity for the entry smoke cart and write the report to `tsz/compiler/migration/reports/visual/entry_split_visual.json`.
- [ ] ES089. Open the visual report and confirm it contains the fields listed in [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md).
- [ ] ES090. Read `full_diff_status` in the visual report and confirm it is `match`.
- [ ] ES091. If the visual report is not `match`, copy `first_diff_region` and the cart path into `entry_split_status.md`.
- [ ] ES092. If the visual report is `match`, add the line `Entry/split visual parity: EXACT HASH MATCH` to `entry_split_status.md`.

### Final Verification

- [ ] ES093. Add one plain-text result line to `entry_split_status.md` for each atom `a039` through `a046`, marking `MATCH`, `PATCHED`, `MATCH (pre-existing)`, or `NEEDS VERIFICATION (resolved)`.
- [ ] ES094. Re-open [a039_app_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a039_app_init.js) one final time and confirm only the lines named in this contract were touched.
- [ ] ES095. Re-open [a040_app_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a040_app_tick.js) one final time and confirm only the lines named in this contract were touched.
- [ ] ES096. Re-open [a041_app_exports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a041_app_exports.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] ES097. Re-open [a042_app_main.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/entry/a042_app_main.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] ES098. Re-open [a043_split_section_extraction.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a043_split_section_extraction.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] ES099. Re-open [a044_split_namespace_prefixing.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a044_split_namespace_prefixing.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] ES100. Re-open [a045_split_module_headers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a045_split_module_headers.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] ES101. Re-open [a046_finalize_postpass.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/split_finalize/a046_finalize_postpass.js) one final time and confirm no lines were touched (calling convention difference is documented, not patched).
- [ ] ES102. Re-run the entry byte-parity case and compare rerun hash to saved hash.
- [ ] ES103. If the rerun hash differs from the saved report hash, append `0411-0458 entry-split rerun hash mismatch` to `blocked.txt` and stop.
- [ ] ES104. Append `0411-0458 entry-split-finalize parity complete` to `completed.txt`.
- [ ] ES105. Update `current_step.txt` to `0411-0458`.
- [ ] ES106. Re-open `completed.txt` and `current_step.txt` and confirm both files reflect the finished contract.
- [ ] ES107. If `entry_smoke.json` is missing or schema-incomplete, append `0411-0458 missing entry parity artifact` to `blocked.txt` and stop.
- [ ] ES108. If `split_smoke.md` is missing or incomplete, append `0411-0458 missing split verification artifact` to `blocked.txt` and stop.
- [ ] ES109. If any final re-open check in `ES094-ES101` fails, append `0411-0458 final file verification failed` to `blocked.txt` and stop.
- [ ] ES110. Stop this contract only after all touched atom files, `entry_split_status.md`, `entry_smoke.json`, `split_smoke.md`, and all re-opened atom files have been verified directly.
