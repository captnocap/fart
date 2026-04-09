# Live Risk: evalLuaMapData Gap

Step 131: Search results for `evalLuaMapData` references.
Timestamp: 2026-04-09

## Call Sites

1. `smith/parse/children/brace_maps.js:84` — Comment: tag map for Lua routing, emit will use evalLuaMapData
2. `smith/emit/runtime_updates.js:95` — Actual call: `qjs_runtime.evalLuaMapData(ldi, ldSrc)`
3. `smith/emit/entrypoints.js:59` — Actual call: `qjs_runtime.evalLuaMapData(ldi, ldSrc)`
4. `smith/emit/preamble.js:28` — Stub definition: `pub fn evalLuaMapData(_: usize, _: []const u8) void {}`
5. `smith/emit/lua_tree_emit.js:148` — Comment: sync OA data from __luaMapDataN globals
6. `smith/emit/lua_tree_emit.js:343` — Actual call: `qjs_runtime.evalLuaMapData(oaTickIdx, oaSource)`

## Summary

3 actual emit call sites (runtime_updates, entrypoints, lua_tree_emit).
1 stub definition in preamble (IS_LIB fallback).
2 comments referencing the function.
