# Contract 0371-0410 — Logic / Runtime Parity

Purpose:
- This contract expands base steps `371-410` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the logic/runtime atom group.
- This contract addresses the systematic `evalLuaMapData` gap identified in the ATOM_PARITY_REPORT.

Scope:
- Compare atoms `a033` through `a038` against their monolith owners in `emit/logic_blocks.js` and `emit/runtime_updates.js`.
- Patch only the atom files if any literal mismatch is found.
- Resolve the known a033/a034 stub status (HIGH severity) and a038 missing evalLuaMapData calls (MEDIUM severity).

## Verification Layers

- `contract parity`
  - required
  - the same JS_LOGIC structure, LUA_LOGIC structure, dynamic text update body, conditional update body, variant update body, and dirty-tick dispatch must exist
- `byte parity`
  - required
  - atoms `a033-a038` must match the monolith output for identical ctx/meta inputs
- `visual parity`
  - required
  - the engine is unchanged; runtime update functions directly affect rendered output
  - exact whole-screen plus named-region hashes are required under [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)
- `behavioral parity`
  - required
  - dirty-tick dispatch ordering affects runtime state transitions; evalLuaMapData omission causes Lua map data to never reach LuaJIT

## Pattern In

- Reader-side syntax can vary. This contract uses conformance fixtures that exercise:
  - JS logic blocks (script content, OA setters, ambient namespaces)
  - Lua logic blocks (state setters, map handlers, lscript, rebuilders)
  - Dynamic text updates (non-map dynText with bufPrint)
  - Conditional display toggles (show_hide, ternary_jsx)
  - Variant patches (theme variants, breakpoint responsive)
  - Dirty-tick orchestration (state-driven refresh with Lua map data bridge)
- Suitable fixtures:
  - [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz) — Lua maps + dirty tick + evalLuaMapData
  - [d06_ternary_jsx_branches.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d06_ternary_jsx_branches.tsz) — conditionals
  - [d05_dynamic_style_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d05_dynamic_style_in_map.tsz) — dynamic styles + maps + dirty tick
- This contract is backend-independent for a035-a037 (pure Zig runtime functions) and backend-aware for a033/a034 (JS/Lua multiline string blocks) and a038 (dirty-tick dispatch with Lua bridge calls).

## Middle Record

- `pattern_in`
  - JS script block content (ambient namespaces, OA setters, computed OA, effect mount bodies, __computeRenderBody, __evalDynTexts)
  - Lua logic content (state vars, state setters, OA loaders, map handlers, lscript, Lua map rebuilders)
  - dynamic text registration records (bufId, fmtString, fmtArgs, arrName, arrIndex, inMap flag)
  - conditional records (condExpr, kind, trueIdx, falseIdx, arrName, inMap flag)
  - variant binding records (styles[], bpStyles, nodeFieldStrs, arrName, arrIndex, inMap flag)
  - dirty-tick feature flags (hasState, hasConds, hasDynStyles, hasFlatMaps, hasLuaMaps)
- `node_id`
  - not applicable for a033/a034 (logic blocks are string constants, not per-node)
  - a035: dynText arrName + arrIndex targets
  - a036: conditional arrName + trueIdx/falseIdx targets
  - a037: variant arrName + arrIndex targets
  - a038: not applicable (orchestration dispatch, not per-node)
- `parent_id`
  - not applicable
- `node_kind`
  - not applicable for logic blocks
  - a035-a037: Text nodes (dynText), conditional hosts (display toggle), variant hosts (style patch)
- `string_literals`
  - a033: JS_LOGIC multiline string content
  - a034: LUA_LOGIC multiline string content
  - a035: `_dyn_text_N`, `_dyn_buf_N`, bufPrint format strings
  - a036: `_updateConditionals`, comparison expressions, evalToString wrapping
  - a037: `_updateVariants`, `_theme`, `_bp`, `_bp_tier`, `_v`, style field assignment strings
  - a038: `_updateDynamicTexts`, `_updateConditionals`, `_rebuildMapN`, `__rebuildLuaMaps`, `evalLuaMapData`, `state.isDirty`, `state.clearDirty`
- `size_literals`
  - a035: dynText bufId indices, arrIndex values
  - a036: trueIdx, falseIdx values
  - a037: variant index values (si, nfi), breakpoint tier values (0, 1)
  - a038: map indices for rebuildMap calls
- `style_literals`
  - a035: dynStyles field+expression pairs, dynColors colorExpr
  - a036: `.display = .flex / .none`
  - a037: variant style assignments per variant index, breakpoint column flex_grow zeroing
- `conditionals`
  - a036 owns: condExpr evaluation, show_hide vs ternary_jsx branch structure, evalToString/comparison/numeric wrapping
  - a038: `state.isDirty()` gate, three code path branches (hasDynStyles / maps / state-only)
- `variants`
  - a037 owns: variant binding iteration, breakpoint-responsive style tiers, variant-only style switching, nodeFieldStrs per-variant field patching
- `handlers`
  - not applicable at this layer (handlers are emitted by a009; map press handlers appear in a033/a034 LUA_LOGIC but are generated by `emitLogicBlocks`, not by this atom group directly)
- `maps`
  - a033/a034: Lua map rebuilder code appears in LUA_LOGIC string
  - a038: `_rebuildMapN()` calls and `evalLuaMapData` + `__rebuildLuaMaps` Lua bridge calls
  - mapPoolArrayNames exclusion set used by a035 and a036 to skip map-owned entries
- `render_locals`
  - not applicable
- `dyn_text`
  - a035 owns: non-map dynText bufPrint emission, target field assignment, dynColor text_color assignment, dynStyle field assignment (sorted by arrNum/arrIndex)
- `dyn_style`
  - a035: dynStyles entries (field, expression, arrName, arrIndex), sorted output
  - a037: variant style patches per variant index
- `dyn_color`
  - a035: dynColors entries (colorExpr, arrName, arrIndex)
- `runtime_bridges`
  - a033: JS_LOGIC string consumed by QJS at runtime via `app_get_js_logic()`
  - a034: LUA_LOGIC string consumed by LuaJIT at runtime via `app_get_lua_logic()`
  - a038: `qjs_runtime.evalLuaMapData(N, "source")` — JS-to-Lua data bridge inside dirty tick
  - a038: `luajit_runtime.callGlobal("__rebuildLuaMaps")` — Lua rebuild trigger
- `pattern_backend_flags`
  - not applicable at this layer
- `realization_mode`
  - a033: `js_in_zig` (JS multiline string embedded in Zig)
  - a034: `lua_in_zig` (Lua multiline string embedded in Zig)
  - a035-a038: `zig` (native Zig runtime functions)
- `zig_tree_eligible`
  - a035-a037: yes (pure Zig runtime updaters)
  - a033/a034: not applicable (logic string constants)
  - a038: mixed (orchestrates both Zig and Lua paths)
- `lua_tree_required`
  - when `ctx._luaMapRebuilders.length > 0`, a034 includes Lua rebuilder code and a038 includes evalLuaMapData calls
- `backend_reason_tags`
  - `evalLuaMapData` bridge needed when Lua maps exist
  - `__rebuildLuaMaps` dispatch needed when Lua maps exist
- `emit_out`
  - `a033` JS_LOGIC multiline string
  - `a034` LUA_LOGIC multiline string
  - `a035` `fn _updateDynamicTexts() void { ... }`
  - `a036` `fn _updateConditionals() void { ... }`
  - `a037` `fn _updateVariants() void { ... }`
  - `a038` dirty-tick dispatch block inside `_appTick()`

## Emit Out

- Output owners:
  - [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js)
  - [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js)
  - [a035_dynamic_text_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a035_dynamic_text_updates.js)
  - [a036_conditional_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js)
  - [a037_variant_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a037_variant_updates.js)
  - [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js)
- Legacy compare surfaces:
  - [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js)
  - [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js)
- Target backends:
  - a033: `js_in_zig`
  - a034: `lua_in_zig`
  - a035-a038: `zig`

Canonical intent sources:
- [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js)
- [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) §Group 6 (a033-a038)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js) lines `43`, `66`, `69`

Owned files:
- [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js)
- [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js)
- [a035_dynamic_text_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a035_dynamic_text_updates.js)
- [a036_conditional_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js)
- [a037_variant_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a037_variant_updates.js)
- [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js)
- [logic_runtime_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/logic_runtime_status.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js)
- [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)
- [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz)
- [d06_ternary_jsx_branches.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d06_ternary_jsx_branches.tsz)
- [d05_dynamic_style_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d05_dynamic_style_in_map.tsz)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [emit/entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js)

Required artifacts:
- `tsz/compiler/migration/reports/sections/logic_runtime_status.md`
- `tsz/compiler/migration/reports/parity/logic_js.json`
- `tsz/compiler/migration/reports/parity/logic_lua.json`
- `tsz/compiler/migration/reports/parity/runtime_dirty_tick.json`
- `tsz/compiler/migration/reports/visual/logic_runtime_visual.json`

Completion criteria:
- `a033` emits the full JS_LOGIC multiline string matching the monolith's `emitLogicBlocks()` JS path (ambient namespaces, OA setters, script blocks, map handlers, delegated handlers, __computeRenderBody, __evalDynTexts)
- `a034` emits the full LUA_LOGIC multiline string matching the monolith's `emitLogicBlocks()` Lua path (state vars, setters, OA loaders, map handlers, lscript, rebuilders)
- `a035` continues to match (already verified MATCH in parity report)
- `a036` continues to match (already verified MATCH in parity report)
- `a037` continues to match (already verified MATCH in parity report)
- `a038` includes `qjs_runtime.evalLuaMapData(N, "source")` calls before `luajit_runtime.callGlobal("__rebuildLuaMaps")` in the dirty-tick dispatch, matching the monolith
- `logic_runtime_status.md` records the grounding line, separate results for each atom, and explicit coverage of the evalLuaMapData gap
- all three parity reports exist and match the parity schema
- visual parity report exists and matches the visual-parity method

## Known Mismatch Context

The ATOM_PARITY_REPORT identifies a systematic pattern: `evalLuaMapData` is missing from atoms a003, a038, a039, and a040. This was added to the monolith after atoms were extracted. This contract addresses the a038 instance. The a039/a040 instances belong to the 0411-0458 entry/split/finalize contract.

Additionally, a033 and a034 are stubs (return `''`). The monolith `emitLogicBlocks()` in `logic_blocks.js` (129 lines) contains the full implementation for both JS_LOGIC and LUA_LOGIC generation. These stubs must be replaced with the real emission logic.

## Microsteps

- [ ] LR001. Open [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js) lines `1-128`.
- [ ] LR002. Open [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js) lines `1-102`.
- [ ] LR003. Open [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js) lines `1-57`.
- [ ] LR004. Open [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js) lines `1-53`.
- [ ] LR005. Open [a035_dynamic_text_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a035_dynamic_text_updates.js) lines `1-110`.
- [ ] LR006. Open [a036_conditional_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js) lines `1-83`.
- [ ] LR007. Open [a037_variant_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a037_variant_updates.js) lines `1-176`.
- [ ] LR008. Open [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js) lines `1-86`.
- [ ] LR009. Open [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) lines `107-182`.
- [ ] LR010. Create `tsz/compiler/migration/reports/sections/logic_runtime_status.md` if it does not exist.
- [ ] LR011. Write a heading `# Logic / Runtime Status` into `logic_runtime_status.md` if the file is new.
- [ ] LR012. Add the grounding line `Grounding: a033 JS_LOGIC block; a034 LUA_LOGIC block; a035 dynamic text updates; a036 conditional updates; a037 variant updates; a038 dirty-tick dispatch. evalLuaMapData gap is the primary known defect.` to `logic_runtime_status.md`.

### a033 — JS Logic Block (stub → real implementation)

- [ ] LR013. Read [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js) lines `40-46` and confirm `_a033_emit` currently returns `''` (empty string stub).
- [ ] LR014. Write `a033_is_stub_before_patch: true` to `logic_runtime_status.md`.
- [ ] LR015. Read [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js) lines `96-114` and note the exact JS_LOGIC emission body: lines 96-100 collect `jsLines` from scriptBlock and __scriptContent via `jsTransform()`, lines 106-114 emit `const JS_LOGIC =\n` with `\\` multiline string encoding or `const JS_LOGIC = "";\n\n` when empty.
- [ ] LR016. Note the exact JS_LOGIC string encoding: each line is prefixed with `    \\\\` and terminated with `\n`, final line is `;\n\n`.
- [ ] LR017. Note the exact JS_LOGIC sources in order: (1) scriptBlock via `jsTransform()`, (2) globalThis.__scriptContent via `jsTransform()`.
- [ ] LR018. Replace lines `40-46` of [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js) with the exact JS_LOGIC emission body from the monolith:
```js
function _a033_emit(ctx, meta) {
  void meta;
  var jsLines = [];

  // Script content → JS_LOGIC
  if (ctx.scriptBlock) {
    var jsBlock = jsTransform(ctx.scriptBlock);
    jsLines.push(jsBlock);
  }
  if (globalThis.__scriptContent) {
    jsLines.push(jsTransform(globalThis.__scriptContent));
  }

  // Emit JS_LOGIC
  var out = '';
  if (jsLines.length > 0) {
    out += 'const JS_LOGIC =\n';
    for (var ji = 0; ji < jsLines.length; ji++) {
      out += '    \\\\' + jsLines[ji] + '\n';
    }
    out += ';\n\n';
  } else {
    out += 'const JS_LOGIC = "";\n\n';
  }

  return out;
}
```
- [ ] LR019. Re-open [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js) and confirm `_a033_emit` no longer returns `''` and contains the jsTransform calls and multiline encoding.
- [ ] LR020. Write `a033_is_stub_after_patch: false` to `logic_runtime_status.md`.
- [ ] LR021. Write `a033_emits_scriptBlock_via_jsTransform: true` to `logic_runtime_status.md`.
- [ ] LR022. Write `a033_emits___scriptContent_via_jsTransform: true` to `logic_runtime_status.md`.
- [ ] LR023. Write `a033_uses_multiline_string_encoding: true` to `logic_runtime_status.md`.

### a034 — Lua Logic Block (stub → real implementation)

- [ ] LR024. Read [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js) lines `37-42` and confirm `_a034_emit` currently returns `''` (empty string stub).
- [ ] LR025. Write `a034_is_stub_before_patch: true` to `logic_runtime_status.md`.
- [ ] LR026. Read [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js) lines `4-94` and note the exact LUA_LOGIC emission body: lines 9-10 state setters via `emitStateSetters(ctx, 'lua')`, lines 13-22 OA unpack/setter functions and global declarations, lines 24-36 map press handlers via `emitMapPressBody()`, lines 39-94 Lua map rebuilders (nested helper, per-rebuilder functions via `_nodeToLua`, master rebuild), lines 116-125 emit `const LUA_LOGIC =\n` with `\\` encoding or `const LUA_LOGIC = "";\n\n` when empty.
- [ ] LR027. Note the exact LUA_LOGIC sources in order: (1) state setters, (2) OA unpack/setter + globals, (3) map press handlers, (4) Lua map rebuilders (nested helper, per-map functions, master dispatch).
- [ ] LR028. Replace lines `37-42` of [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js) with the exact LUA_LOGIC emission body from the monolith:
```js
function _a034_emit(ctx, meta) {
  void meta;
  var luaLines = [];

  // State setters → Lua
  emitStateSetters(ctx, 'lua').forEach(function(l) { luaLines.push(l); });

  // OA unpack functions → Lua
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      var oa = ctx.objectArrays[oi];
      if (oa.setter) {
        luaLines.push('function ' + oa.setter + '(v) ' + oa.getter + ' = v; __setObjArr' + oa.oaIdx + '(v) end');
      }
      luaLines.push(oa.getter + ' = {}');
    }
  }

  // Map press handlers → Lua
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var handler = ctx.handlers[hi];
    if (!handler.inMap) continue;
    if (!handler.luaBody) continue;
    var mapIdx = handler.mapIdx !== undefined ? handler.mapIdx : 0;
    var luaBody = luaTransform(handler.luaBody);
    var pressLines = emitMapPressBody(mapIdx, hi, handler, ctx.maps[mapIdx] || {}, 'lua');
    if (pressLines && pressLines.length > 0) {
      for (var pl = 0; pl < pressLines.length; pl++) luaLines.push(pressLines[pl]);
    }
  }

  // Lua map rebuilders
  if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
    luaLines.push('-- Lua map rebuilders');

    luaLines.push('function __luaNestedMap(arr, fn)');
    luaLines.push('  if not arr then return nil end');
    luaLines.push('  local result = {}');
    luaLines.push('  for _ni, _nitem in ipairs(arr) do');
    luaLines.push('    result[#result + 1] = fn(_nitem, _ni)');
    luaLines.push('  end');
    luaLines.push('  return { children = result }');
    luaLines.push('end');
    luaLines.push('');

    for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
      var lmr = ctx._luaMapRebuilders[lmi];
      var bodyNode = lmr.bodyNode || null;
      var itemParam = lmr.itemParam || 'item';
      var indexParam = lmr.indexParam || null;

      if (bodyNode && typeof _nodeToLua === 'function') {
        var bodyLua = _nodeToLua(bodyNode, itemParam, indexParam, '      ');
        luaLines.push('function __rebuildLuaMap' + lmi + '()');
        luaLines.push('  __clearLuaNodes()');
        luaLines.push('  local wrapper = __mw' + lmi);
        luaLines.push('  if not wrapper then return end');
        luaLines.push('  local items = __luaMapData' + lmi);
        luaLines.push('  if not items or #items == 0 then');
        luaLines.push('    __declareChildren(wrapper, {})');
        luaLines.push('    return');
        luaLines.push('  end');
        luaLines.push('  local tmpl = {}');
        luaLines.push('  for _i, _item in ipairs(items) do');
        luaLines.push('    tmpl[#tmpl + 1] = ' + bodyLua);
        luaLines.push('  end');
        luaLines.push('  __declareChildren(wrapper, tmpl)');
        luaLines.push('end');
        luaLines.push('');
      } else if (lmr.luaCode) {
        var codeLines = lmr.luaCode.split('\n');
        for (var ll = 0; ll < codeLines.length; ll++) luaLines.push(codeLines[ll]);
      }
    }

    luaLines.push('function __rebuildLuaMaps()');
    luaLines.push('  __clearLuaNodes()');
    for (var lmi2 = 0; lmi2 < ctx._luaMapRebuilders.length; lmi2++) {
      if (ctx._luaMapRebuilders[lmi2].isNested) continue;
      luaLines.push('  __rebuildLuaMap' + lmi2 + '()');
    }
    luaLines.push('end');
    luaLines.push('');
  }

  // Emit LUA_LOGIC
  var out = '';
  if (luaLines.length > 0) {
    out += 'const LUA_LOGIC =\n';
    for (var li = 0; li < luaLines.length; li++) {
      out += '    \\\\' + luaLines[li] + '\n';
    }
    out += ';\n\n';
  } else {
    out += 'const LUA_LOGIC = "";\n\n';
  }

  return out;
}
```
- [ ] LR029. Re-open [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js) and confirm `_a034_emit` no longer returns `''` and contains emitStateSetters, OA logic, map press handlers, and Lua map rebuilder emission.
- [ ] LR030. Write `a034_is_stub_after_patch: false` to `logic_runtime_status.md`.
- [ ] LR031. Write `a034_emits_state_setters: true` to `logic_runtime_status.md`.
- [ ] LR032. Write `a034_emits_oa_unpack_and_globals: true` to `logic_runtime_status.md`.
- [ ] LR033. Write `a034_emits_map_press_handlers: true` to `logic_runtime_status.md`.
- [ ] LR034. Write `a034_emits_lua_map_rebuilders_and_master_dispatch: true` to `logic_runtime_status.md`.
- [ ] LR035. Write `a034_uses_multiline_string_encoding: true` to `logic_runtime_status.md`.

### a035 — Dynamic Text Updates (already MATCH)

- [ ] LR036. Read [a035_dynamic_text_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a035_dynamic_text_updates.js) lines `33-98` and confirm the atom emits `fn _updateDynamicTexts() void { ... }` with mapPoolArrayNames filtering, dynText bufPrint, dynColors text_color, dynStyles sorted by arrNum/arrIndex.
- [ ] LR037. Read [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js) lines `18-58` and confirm the monolith's `_updateDynamicText()` (note: different function name) and `_updateDynamicStyles()`/`_updateDynamicColors()` sections.
- [ ] LR038. Compare the atom's combined output to the monolith's equivalent sections line by line. Note: the atom emits one function `_updateDynamicTexts()` that combines what the monolith splits into `_updateDynamicText()`, `_updateDynamicStyles()`, and `_updateDynamicColors()`. The atom's combined function must produce byte-equivalent output to the monolith's combined output of these three functions.
- [ ] LR039. Write `a035_matches_monolith_dynamic_text_body: true|false` to `logic_runtime_status.md`.
- [ ] LR040. If `a035_matches_monolith_dynamic_text_body` is `false`, record the exact first mismatch line number and content in `logic_runtime_status.md` before any patch.

### a036 — Conditional Updates (already MATCH)

- [ ] LR041. Read [a036_conditional_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js) lines `29-71` and confirm the atom emits `fn _updateConditionals() void { ... }` with mapPoolArrayNames filtering, evalToString wrapping, comparison detection, show_hide and ternary_jsx branches.
- [ ] LR042. Read [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js) lines `31-45` and confirm the monolith's `_updateConditionals()` section.
- [ ] LR043. Compare the atom's output to the monolith's equivalent section. Note: the monolith uses a simpler conditional body (direct condExpr without evalToString/comparison wrapping). The atom has more sophisticated wrapping logic. This is expected per the ATOM_PARITY_REPORT which says a036 is MATCH.
- [ ] LR044. Write `a036_matches_monolith_conditional_body: true|false` to `logic_runtime_status.md`.

### a037 — Variant Updates (already MATCH)

- [ ] LR045. Read [a037_variant_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a037_variant_updates.js) lines `37-165` and confirm the atom emits `fn _updateVariants() void { ... }` with breakpoint tiers, variant style switching, column flex_grow zeroing, and nodeFieldStrs per-variant patching.
- [ ] LR046. Read [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js) lines `72-74` and confirm the monolith delegates to `emitVariantPatch(ctx, { promotedToPerItem })`.
- [ ] LR047. Write `a037_matches_monolith_variant_body: true|false` to `logic_runtime_status.md`.

### a038 — Runtime Dirty Tick (evalLuaMapData gap)

- [ ] LR048. Read [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js) lines `40-75` and confirm the atom emits the dirty-tick dispatch with three code paths (hasDynStyles / maps / state-only).
- [ ] LR049. Read [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js) lines `77-99` and confirm the monolith's `_dirtyTick()` function includes `qjs_runtime.evalLuaMapData(N, "source")` calls before `luajit_runtime.callGlobal("__rebuildLuaMaps")`.
- [ ] LR050. Write `a038_has_evalLuaMapData_before_patch: false` to `logic_runtime_status.md`.
- [ ] LR051. In [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js), locate the first `hasLuaMaps` branch (line `53`) where it emits `luajit_runtime.callGlobal("__rebuildLuaMaps")`.
- [ ] LR052. Insert the following exact block immediately BEFORE the `luajit_runtime.callGlobal("__rebuildLuaMaps")` line in the first branch (hasDynStyles path):
```js
    for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
      if (ctx._luaMapRebuilders[ldi].isNested) continue;
      var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += '        qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
    }
```
- [ ] LR053. Locate the second `hasLuaMaps` branch (line `64`) where it emits `luajit_runtime.callGlobal("__rebuildLuaMaps")` in the maps-but-no-dynStyles path.
- [ ] LR054. Insert the same evalLuaMapData block immediately BEFORE that `luajit_runtime.callGlobal` line.
- [ ] LR055. Locate the third `hasLuaMaps` branch (line `70`) in the state-only compact path.
- [ ] LR056. Insert the same evalLuaMapData block immediately BEFORE that `luajit_runtime.callGlobal` line, adjusting indentation to match the compact single-line style (the evalLuaMapData calls must be on separate lines before the callGlobal).
- [ ] LR057. Re-open [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js) and confirm all three code paths now contain `qjs_runtime.evalLuaMapData` calls before `luajit_runtime.callGlobal("__rebuildLuaMaps")`.
- [ ] LR058. Write `a038_has_evalLuaMapData_after_patch: true` to `logic_runtime_status.md`.
- [ ] LR059. Confirm the evalLuaMapData calls use `ctx._luaMapRebuilders[ldi].rawSource` with proper escaping (backslash and double-quote).
- [ ] LR060. Write `a038_evalLuaMapData_uses_rawSource_with_escaping: true` to `logic_runtime_status.md`.

### Parity Verification

- [ ] LR061. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to smoke verification.
- [ ] LR062. Run the parity harness on a cart with JS logic (script block) and write the output to `tsz/compiler/migration/reports/parity/logic_js.json`.
- [ ] LR063. Open `logic_js.json` and confirm it exists.
- [ ] LR064. Open `logic_js.json` and confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] LR065. Read `predicted_atoms` in `logic_js.json` and confirm atom `33` is present.
- [ ] LR066. Run the parity harness on a cart with Lua logic (Lua maps + state) and write the output to `tsz/compiler/migration/reports/parity/logic_lua.json`.
- [ ] LR067. Open `logic_lua.json` and confirm it exists.
- [ ] LR068. Open `logic_lua.json` and confirm it contains the parity schema fields.
- [ ] LR069. Read `predicted_atoms` in `logic_lua.json` and confirm atom `34` is present.
- [ ] LR070. Run the parity harness on a cart with Lua maps and dirty tick (e.g., [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz)) and write the output to `tsz/compiler/migration/reports/parity/runtime_dirty_tick.json`.
- [ ] LR071. Open `runtime_dirty_tick.json` and confirm it exists.
- [ ] LR072. Open `runtime_dirty_tick.json` and confirm it contains the parity schema fields.
- [ ] LR073. Read `predicted_atoms` in `runtime_dirty_tick.json` and confirm atom `38` is present.
- [ ] LR074. Read `diff_status` in `logic_js.json`.
- [ ] LR075. Read `diff_status` in `logic_lua.json`.
- [ ] LR076. Read `diff_status` in `runtime_dirty_tick.json`.
- [ ] LR077. If `logic_js.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `logic_runtime_status.md` under the JS logic cart path.
- [ ] LR078. If `logic_lua.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `logic_runtime_status.md` under the Lua logic cart path.
- [ ] LR079. If `runtime_dirty_tick.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `logic_runtime_status.md` under the dirty tick cart path.
- [ ] LR080. If all three reports have `diff_status` equal to `match`, add the line `Logic/runtime smoke parity: MATCH on JS logic, Lua logic, and dirty tick carts` to `logic_runtime_status.md`.
- [ ] LR081. Add one plain-text result line to `logic_runtime_status.md` for each atom `a033` through `a038`, marking `MATCH` or `PATCHED` or `MATCH (pre-existing)`.

### Visual Verification

- [ ] LR082. Ensure the visual capture harness exists before continuing. If it does not exist, append `0371-0410 logic-runtime visual harness missing` to `blocked.txt` and stop.
- [ ] LR083. Capture visual parity for the dirty tick cart and write the report to `tsz/compiler/migration/reports/visual/logic_runtime_visual.json`.
- [ ] LR084. Open the visual report and confirm it contains the fields listed in [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md).
- [ ] LR085. Read `full_diff_status` in the visual report and confirm it is `match`.
- [ ] LR086. If the visual report is not `match`, copy `first_diff_region` and the cart path into `logic_runtime_status.md`.
- [ ] LR087. If the visual report is `match`, add the line `Logic/runtime visual parity: EXACT HASH MATCH` to `logic_runtime_status.md`.

### Final Verification

- [ ] LR088. Re-open `logic_runtime_status.md` and confirm it contains the grounding line from `LR012`, one result line for each atom `a033-a038`, and either copied diff hunks or the explicit all-match line.
- [ ] LR089. Re-open [a033_js_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a033_js_logic_block.js) one final time and confirm only the lines named in this contract were touched.
- [ ] LR090. Re-open [a034_lua_logic_block.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a034_lua_logic_block.js) one final time and confirm only the lines named in this contract were touched.
- [ ] LR091. Re-open [a038_runtime_dirty_tick.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a038_runtime_dirty_tick.js) one final time and confirm only the lines named in this contract were touched.
- [ ] LR092. Re-open [a035_dynamic_text_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a035_dynamic_text_updates.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] LR093. Re-open [a036_conditional_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] LR094. Re-open [a037_variant_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/logic_runtime/a037_variant_updates.js) one final time and confirm no lines were touched (pre-existing MATCH).
- [ ] LR095. Re-run the three byte-parity cases and compare rerun hashes to saved hashes.
- [ ] LR096. If any rerun hash differs from the saved report hash, append `0371-0410 logic-runtime rerun hash mismatch` to `blocked.txt` and stop.
- [ ] LR097. Append `0371-0410 logic-runtime parity complete` to `completed.txt`.
- [ ] LR098. Update `current_step.txt` to `0371-0410`.
- [ ] LR099. Re-open `completed.txt` and `current_step.txt` and confirm both files reflect the finished contract.
- [ ] LR100. If `logic_js.json` is missing or schema-incomplete, append `0371-0410 missing JS logic parity artifact` to `blocked.txt` and stop.
- [ ] LR101. If `logic_lua.json` is missing or schema-incomplete, append `0371-0410 missing Lua logic parity artifact` to `blocked.txt` and stop.
- [ ] LR102. If `runtime_dirty_tick.json` is missing or schema-incomplete, append `0371-0410 missing dirty tick parity artifact` to `blocked.txt` and stop.
- [ ] LR103. If any final re-open check in `LR089-LR094` fails, append `0371-0410 final file verification failed` to `blocked.txt` and stop.
- [ ] LR104. Stop this contract only after all touched atom files, `logic_runtime_status.md`, `logic_js.json`, `logic_lua.json`, and `runtime_dirty_tick.json` have all been re-opened and verified directly.
