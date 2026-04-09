# Maps Zig Parity Status (Contract 0251-0310)

a019 shared meta carrier; a026 sole top-level rebuild; a027/a028 fragment-only at top level; lua_runtime maps excluded from zig rebuild

## Atom Results

- a019: PATCHED — ctx._mapEmitMeta and meta now same object by reference; meta.mapMeta initialized
- a020: MATCH — flat map pool declarations match historical, lua_runtime skip present
- a021: MATCH — nested map pool declarations match historical, lua_runtime skip present
- a022: MATCH — inline map pool declarations match historical, lua_runtime skip present
- a023: MATCH — per-item arrays match historical, shared mapMeta carrier confirmed
- a024: MATCH — dynamic text storage match historical, shared mapMeta carrier confirmed
- a025: MATCH — handler pointer storage match historical, shared mapMeta carrier confirmed
- a026: PATCHED — _a026_applies now excludes lua_runtime; _a026_emit delegates to rebuildMap(ctx, meta)
- a027: PATCHED — _a027_emit returns '' (top-level no-op); emitNestedRebuild stays exported
- a028: PATCHED — _a028_emit returns '' (top-level no-op); emitInlineRebuild + appendOrphanedMapArrays stay exported

## Helper Results

- compute_map_meta.js: MATCH — buildMapEmitOrder, ensureMapHandlerFieldRefs, computePromotedMapArrays, countTopLevelNodeDeclEntries all match historical
- rebuild_map.js: MATCH — full flat/nested/inline rebuild body matches historical lines 361-1195
- emit_arena.js: MATCH — arena declaration string byte-identical
- emit_map_decl.js: MATCH — flat/nested/inline declaration strings match
- emit_per_item_arr.js: MATCH — inline/nested per-item storage matches
- emit_text_storage.js: MATCH — text storage shapes match
- emit_handler_storage.js: MATCH — handler storage + _initMapLuaPtrs match
- emit_orphan_arrays.js: MATCH — orphan cleanup logic matches historical and a028 copy

## Byte-Parity Results

- maps_zig_flat.json: diff_status=DIFF legacy=2d39db33d33d atom=be0466c7847e tags=[lua_map,zig_map,dyn_text,handlers] (d96_const_array_map)
- maps_zig_nested.json: diff_status=DIFF legacy=d9e452aff2eb atom=fresh tags=[lua_map,zig_map,nested_map,dyn_text,handlers] (d01_nested_maps)
- maps_zig_inline.json: diff_status=DIFF legacy=db5665acad39 atom=fresh tags=[lua_map,zig_map,dyn_text,handlers] (d105 fallback)
- Pre-split comparison with parity intercept (lua-tree suppressed): both paths at same pipeline stage
- All carts compiled to 6 .zig files each (app, handlers, logic, maps, nodes, state)
- Post-intercept fix: preamble lines 1-22 now MATCH between legacy and atom
- First diff at line 23: comment dash length in state manifest header (a004 scope)
- MAPS-ZIG SECTION ANALYSIS (d96_const_array_map):
  - Legacy (329 lines): CALLS _rebuildMap0/1 in tick function but has NO map declarations, NO fn _rebuildMap definitions, NO _pool_arena decl, NO MAX_MAP constants. map_pools.js stub returns ''.
  - Atom (607 lines): Full map infrastructure — _pool_arena, MAX_MAP_N, _map_pool_N, fn _rebuildMapN, per-item arrays, text storage, handler ptrs — 286 lines of map content.
  - This is the EXPECTED migration state: atoms a019-a028 produce the map output that legacy stub omits.
  - The diff is correct — atom path is MORE COMPLETE than legacy. Legacy would fail at Zig compile (undefined _rebuildMap refs).
- Pre-map diffs (not maps-zig scope): _initState presence (a005/a006), dyn buf zeroes (a007/a008), OA storage format (a014-a017)

## Visual Parity Results

- maps_zig_flat_visual.json: BLOCKED — visual harness not implemented
- maps_zig_nested_visual.json: BLOCKED — visual harness not implemented
- maps_zig_inline_visual.json: BLOCKED — visual harness not implemented

Behavioral parity: DEFERRED in 0251-0310 until scripted interaction harness exists.
