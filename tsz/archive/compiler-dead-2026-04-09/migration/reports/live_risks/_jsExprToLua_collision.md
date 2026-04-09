# Live Risk: _jsExprToLua Collision

Step 128: Search results for `_jsExprToLua` definitions.
Timestamp: 2026-04-09

## Definition Locations

1. `smith/emit_atoms/maps_lua/lua_map_subs.js:315` — `function _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr)`
2. `smith/emit_ops/js_expr_to_lua.js:25` — `function _jsExprToLua(expr, itemParam, indexParam)`

Two definitions exist. Signature differs (4 params vs 3 params). The winning definition depends on bundle load order (see step 129-130).

## Load Order (step 129)

- `smith/emit_ops/js_expr_to_lua.js` — line 277 in smith_LOAD_ORDER.txt
- `smith/emit_atoms/maps_lua/lua_map_subs.js` — line 353 in smith_LOAD_ORDER.txt

lua_map_subs.js loads AFTER js_expr_to_lua.js.

## Likely Winner (step 130)

`smith/emit_atoms/maps_lua/lua_map_subs.js:315` — the 4-parameter version. It loads later and overwrites the 3-parameter version from `emit_ops/js_expr_to_lua.js`. This means the atom-path `_jsExprToLua` with the `_luaIdxExpr` parameter is the active definition at runtime.
