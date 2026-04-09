# Live Risk: Atom 26 Reachability

Step 132: `mapBackend` checks — Zig vs Lua backend branch points.
Timestamp: 2026-04-09

## Setting Sites (parse-time, tags maps as lua_runtime)

1. `smith/preflight/context.js:36` — default: `map.mapBackend = 'lua_runtime'`
2. `smith/parse/children/brace.js:127` — nested map: `_mapInfo2.mapBackend = 'lua_runtime'`
3. `smith/parse/children/brace_maps.js:89` — map routing: `ctx.maps[mapIdx].mapBackend = 'lua_runtime'`
4. `smith/parse/children/brace_maps.js:128` — conditional child map
5. `smith/parse/children/brace_maps.js:485` — dynamic map
6. `smith/parse/element/component_inline.js:276` — component inline map

## Branch Points (emit-time, skips Zig emit for lua_runtime maps)

1. `smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js:36` — skip flat pool decls
2. `smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js:33` — skip nested pool decls
3. `smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js:33` — skip inline pool decls
4. `smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js:38` — skip per-item arrays
5. `smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js:33` — skip dynamic text storage
6. `smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js:38,43` — skip handler ptrs
7. `smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js:42` — skip flat map rebuild
8. `smith/emit_ops/rebuild_map.js:32` — skip legacy rebuild

## Summary

All Zig-map atoms (a020-a026) gate on `mapBackend === 'lua_runtime'` to skip Lua-routed maps. 6 parse-time setting sites tag maps. The branching is consistent: if a map is lua_runtime, all Zig map atoms skip it.
