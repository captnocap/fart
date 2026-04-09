# Contract 0341-0370 — Maps Lua Parity

Purpose:
- This contract expands base steps `341-370` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the Lua-tree map group.
- This contract treats Lua realization as the intentional backend for this slice, not as a fallback to Zig map pools.

Scope:
- Compare atoms `a029` through `a032` and their Lua-map helper files against the historical Lua map emission body.
- Preserve the master Lua rebuild flow, wrapper registration, and nested helper shape.
- Preserve the QJS-to-Lua bridge semantics for map data and the `__rebuildLuaMaps` dispatch path.

## Verification Layers

- `contract parity`
  - required
  - the same wrapper registration, Lua rebuild list, nested helper shape, and master dispatch truth must exist
- `byte parity`
  - required
  - atoms `a029-a032` plus the helper files in this contract must match the historical Lua map emission output
- `visual parity`
  - required
  - because the engine is unchanged and the Lua realization path must render the same UI
  - exact whole-screen plus named-region hashes are required under [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)
- `behavioral parity`
  - required
  - Lua maps are interaction-heavy and must preserve data reload + dispatch behavior, not only static screen shape

## Pattern In

- Reader-side syntax can vary. This contract uses Lua-map fixtures and route-scan outputs only as concrete triggers for the Lua-tree backend.
- The relevant reader output is normalized Lua-tree truth:
  - one or more Lua map rebuilders
  - wrapper node registrations
  - nested Lua helper availability
  - master dispatch emission
  - QJS-fed map data bridge truth
- This contract is backend-specific:
  - it applies when the route scan determines `lua_tree_required`
  - it does not attempt to force Lua-tree slices into Zig map pools

## Middle Record

- `pattern_in`
  - Lua-backed map host
  - Lua rebuild function
  - Lua nested helper
  - Lua master dispatch
- `node_id`
  - wrapper node id
  - Lua map rebuilder index
  - nested helper emission index
- `parent_id`
  - wrapper node pointer
  - master dispatch owner
  - Lua map data array index
- `node_kind`
  - Lua wrapper registration
  - Lua rebuild function
  - nested helper function
  - master dispatch function
- `string_literals`
  - `__mwN`
  - `__luaMapDataN`
  - `__rebuildLuaMapN`
  - `__rebuildLuaMaps`
  - `__clearLuaNodes`
  - `__declareChildren`
  - Lua template body strings
- `size_literals`
  - Lua rebuilder count
  - wrapper scan count
  - nested helper count
- `style_literals`
  - not applicable directly in the Lua contract; styles are embedded in Lua tables and helper output
- `conditionals`
  - Lua `if not wrapper then return end`
  - Lua empty-items branch
  - Lua nested helper branch
- `variants`
  - not applicable at this layer
- `handlers`
  - Lua closures
  - `lua_on_press`
  - wrapper callback registration
- `maps`
  - `_luaMapRebuilders`
  - `mapIndex`
  - `bodyNode`
  - `luaCode`
  - `__mwN` wrapper tag lookup
  - `__rebuildLuaMaps`
- `render_locals`
  - Lua-local loop variables used in `ipairs`
- `dyn_text`
  - Lua text emission via `emitLuaTextContent`
  - `__luaMapDataN` consumption
- `dyn_style`
  - Lua style emission via `emitLuaStyle`
- `dyn_color`
  - hex-to-Lua color conversion via `hexToLuaColor`
- `runtime_bridges`
  - `luajit_runtime.setMapWrapper`
  - `luajit_runtime.callGlobal("__rebuildLuaMaps")`
  - `evalLuaMapData` bridge expectations where map data is sourced from JS
- `pattern_backend_flags`
  - hard Lua-tree gate values must stay intact when present
- `realization_mode`
  - `lua-tree`
- `zig_tree_eligible`
  - false for slices owned by this contract
- `lua_tree_required`
  - true when the route scanner has already flagged the slice for Lua-tree realization
- `backend_reason_tags`
  - include `mapBackend:lua_runtime`
  - include any upstream hard gate such as `lua-tree-hard-gate`
- `emit_out`
  - `a029` wrapper registration
  - `a030` Lua map rebuilder functions
  - `a031` nested helper shape
  - `a032` master dispatch

## Emit Out

- Output owners:
  - [a029_lua_map_wrapper_registration.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a029_lua_map_wrapper_registration.js)
  - [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js)
  - [a031_lua_nested_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a031_lua_nested_helpers.js)
  - [a032_lua_map_master_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a032_lua_map_master_dispatch.js)
  - [emit_lua_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_rebuild.js)
  - [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js)
  - [emit_lua_style.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_style.js)
  - [emit_lua_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_text.js)
  - [js_expr_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/js_expr_to_lua.js)
  - [hex_to_color.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/hex_to_color.js)
  - [zig_node_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/zig_node_to_lua.js)
- Legacy compare surface:
  - historical [lua_maps.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/lua_maps.js) body, plus the live `LUA_TREE_ARCHITECTURE.md` contract for current ownership shape
- Target backend:
  - `lua-tree`
- Backend exclusion:
  - if a map slice is `zig-tree` eligible and not `lua-tree` required, it does not belong to this contract

## Coherence Decisions

- Wrapper registration:
  - a029 owns `luajit_runtime.setMapWrapper(...)` emission
- Lua rebuilder shape:
  - a030 owns per-map `__rebuildLuaMapN()` emission
- Nested helper shape:
  - a031 documents the nested helper and keeps its shape byte-stable
- Master dispatch:
  - a032 owns `__rebuildLuaMaps()` and the call-site dispatch contract
- Bridge rule:
  - if map data is fed from JS, the contract must preserve the QJS-to-Lua bridge semantics instead of rediscovering them later

Canonical intent sources:
- [LUA_TREE_ARCHITECTURE.md](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)
- [a029_lua_map_wrapper_registration.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a029_lua_map_wrapper_registration.js)
- [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js)
- [a031_lua_nested_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a031_lua_nested_helpers.js)
- [a032_lua_map_master_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a032_lua_map_master_dispatch.js)
- [emit_lua_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_rebuild.js)
- [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js)
- [emit_lua_style.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_style.js)
- [emit_lua_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_text.js)
- [js_expr_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/js_expr_to_lua.js)
- [hex_to_color.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/hex_to_color.js)
- [zig_node_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/zig_node_to_lua.js)
- [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)

Historical legacy source:
- Use the live [LUA_TREE_ARCHITECTURE.md](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md) plus the historical `emit/lua_maps.js` body as the compare surface for this range.
- Use the current atom files above as the exact ownership boundaries.

Owned files:
- [a029_lua_map_wrapper_registration.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a029_lua_map_wrapper_registration.js)
- [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js)
- [a031_lua_nested_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a031_lua_nested_helpers.js)
- [a032_lua_map_master_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a032_lua_map_master_dispatch.js)
- [emit_lua_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_rebuild.js)
- [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js)
- [emit_lua_style.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_style.js)
- [emit_lua_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_text.js)
- [js_expr_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/js_expr_to_lua.js)
- [hex_to_color.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/hex_to_color.js)
- [zig_node_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/zig_node_to_lua.js)
- [maps_lua_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/maps_lua_status.md)
- [maps_lua_reachability.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/maps_lua_reachability.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [LUA_TREE_ARCHITECTURE.md](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)

Required artifacts:
- `tsz/compiler/migration/reports/sections/maps_lua_status.md`
- `tsz/compiler/migration/reports/coverage/maps_lua_reachability.md`
- `tsz/compiler/migration/reports/parity/maps_lua_rebuilder.json`
- `tsz/compiler/migration/reports/parity/maps_lua_master.json`
- `tsz/compiler/migration/reports/visual/maps_lua_rebuilder_visual.json`
- `tsz/compiler/migration/reports/visual/maps_lua_master_visual.json`

Visual fixture regions:
- `maps_lua_rebuilder_visual.json`
  - `wrapper_row`
  - `lua_map_body`
- `maps_lua_master_visual.json`
  - `wrapper_row`
  - `rendered_children`

Completion criteria:
- `a029` matches wrapper registration behavior for every Lua map rebuilder
- `a030` matches rebuilder function emission and nested helper inclusion behavior
- `a031` matches the nested helper shape required by the Lua-tree contract
- `a032` matches master dispatch emission and ordering
- `maps_lua_status.md` records the grounding line `a029 wrapper registration; a030 rebuilder functions; a031 nested helper; a032 master dispatch; lua_tree required`
- both byte-parity reports exist and match the parity schema
- both visual-parity reports exist and match the visual-parity method
- behavioral parity is recorded against the same cart paths or explicitly marked with the exact missing harness

## Microsteps

- [ ] ML001. Open [LUA_TREE_ARCHITECTURE.md](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/LUA_TREE_ARCHITECTURE.md#L1) and confirm this contract is aligned to the Lua-tree realization model, not Zig pools.
- [ ] ML002. Open [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js#L61) lines `61-65` and confirm `has_lua_maps` maps to atoms `29-32`.
- [ ] ML003. Open [a029_lua_map_wrapper_registration.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a029_lua_map_wrapper_registration.js#L16) lines `16-40`.
- [ ] ML004. Open [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js#L13) lines `13-71`.
- [ ] ML005. Open [a031_lua_nested_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a031_lua_nested_helpers.js#L19) lines `19-36`.
- [ ] ML006. Open [a032_lua_map_master_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a032_lua_map_master_dispatch.js#L16) lines `16-29`.
- [ ] ML007. Open [emit_lua_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_rebuild.js#L5) lines `5-45`.
- [ ] ML008. Open [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js#L11) lines `11-220`.
- [ ] ML009. Open [emit_lua_style.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_style.js#L5) lines `5-98`.
- [ ] ML010. Open [emit_lua_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_text.js#L4) lines `4-180`.
- [ ] ML011. Open [js_expr_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/js_expr_to_lua.js#L25) lines `25-64`.
- [ ] ML012. Open [hex_to_color.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/hex_to_color.js#L4) lines `4-14`.
- [ ] ML013. Open [zig_node_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/zig_node_to_lua.js#L4) lines `4-54`.
- [ ] ML014. Open [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js#L1) lines `1-40` and `73-94`.
- [ ] ML015. Compare the live Lua-tree architecture doc to the Lua-map atoms and confirm the intended lane is `lua-tree`, not Zig map pool realization.
- [ ] ML016. Confirm `has_lua_maps` in `pattern_atoms.js` drives atoms `29, 30, 31, 32` and no others.
- [ ] ML017. Read [a029_lua_map_wrapper_registration.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a029_lua_map_wrapper_registration.js#L20) lines `20-40` and confirm it scans wrapper tags and emits `luajit_runtime.setMapWrapper(...)` lines.
- [ ] ML018. Read [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js#L19) lines `19-71` and confirm it emits one `__rebuildLuaMapN()` per rebuilder, including the empty-items branch and `__declareChildren(wrapper, tmpl)` call.
- [ ] ML019. Read [a031_lua_nested_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a031_lua_nested_helpers.js#L23) lines `23-36` and confirm the nested helper shape is documented exactly as `__luaNestedMap(arr, fn)`.
- [ ] ML020. Read [a032_lua_map_master_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a032_lua_map_master_dispatch.js#L20) lines `20-29` and confirm it emits `__rebuildLuaMaps()` and appends each `__rebuildLuaMapN()` in order.
- [ ] ML021. Compare [emit_lua_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_rebuild.js#L5) lines `5-45` to [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js#L19) lines `19-71` and confirm the helper and atom agree on rebuilder shape.
- [ ] ML022. Compare [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js#L11) lines `11-220` to the live Lua-tree architecture doc and confirm the recursive element emission is the real body generator for Lua map rebuilds.
- [ ] ML023. Compare [emit_lua_style.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_style.js#L5) lines `5-98` to the Lua-tree style contract and confirm `hexToLuaColor` and `_jsExprToLua` remain the style-expression bridge.
- [ ] ML024. Compare [emit_lua_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_text.js#L4) lines `4-180` to the Lua-tree text contract and confirm template literals, inline glyphs, and brace expressions match the intended realization path.
- [ ] ML025. Compare [js_expr_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/js_expr_to_lua.js#L25) lines `25-64` to the Lua expression rewrite rules and confirm the JS-to-Lua conversion path is still the one used by the Lua-tree backend.
- [ ] ML026. Compare [zig_node_to_lua.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/zig_node_to_lua.js#L4) lines `4-54` to the Lua-tree node conversion contract and confirm Zig-node rewrites still feed Lua table realization where applicable.
- [ ] ML027. Compare [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js#L1) lines `1-40` and `73-94` to the maps-lua route and confirm the runtime path already recognizes `ctx._luaMapRebuilders`.
- [ ] ML028. Create `tsz/compiler/migration/reports/sections/maps_lua_status.md` if it does not already exist.
- [ ] ML029. Add this exact grounding line to `maps_lua_status.md`: `a029 wrapper registration; a030 rebuilder functions; a031 nested helper; a032 master dispatch; lua_tree required`.
- [ ] ML030. Add one plain-text result line to `maps_lua_status.md` for each atom `a029` through `a032`, marking `MATCH` or `PATCHED`.
- [ ] ML031. Add one plain-text line to `maps_lua_status.md` stating `Behavioral parity is required for Lua maps because wrapper registration and master dispatch affect runtime reload behavior.`
- [ ] ML032. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to byte-parity verification.
- [ ] ML033. Run the parity harness on a Lua-map fixture and write the output to `tsz/compiler/migration/reports/parity/maps_lua_rebuilder.json`.
- [ ] ML034. Run the parity harness on a second Lua-map fixture that exercises master dispatch and write the output to `tsz/compiler/migration/reports/parity/maps_lua_master.json`.
- [ ] ML035. Open both byte-parity reports and confirm each one exists.
- [ ] ML036. Open both byte-parity reports and confirm each one contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] ML037. Read `predicted_atoms` in `maps_lua_rebuilder.json` and confirm atoms `29`, `30`, and `31` are present.
- [ ] ML038. Read `predicted_atoms` in `maps_lua_master.json` and confirm atoms `29`, `30`, `31`, and `32` are present.
- [ ] ML039. If either byte report omits a required atom, write the exact coverage gap to `coverage_matrix.md` and stop.
- [ ] ML040. Read `diff_status` in both byte-parity reports.
- [ ] ML041. If `maps_lua_rebuilder.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `maps_lua_status.md` under the rebuilder cart path.
- [ ] ML042. If `maps_lua_master.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `maps_lua_status.md` under the master cart path.
- [ ] ML043. If both byte-parity reports have `diff_status` equal to `match`, add the line `Maps lua smoke parity: MATCH on rebuilder and master dispatch carts` to `maps_lua_status.md`.
- [ ] ML044. Ensure the visual capture harness exists before continuing to visual verification. If it does not exist, append `0341-0370 maps-lua visual harness missing` to `blocked.txt` and stop.
- [ ] ML045. Capture visual parity for the rebuilder cart and write the report to `tsz/compiler/migration/reports/visual/maps_lua_rebuilder_visual.json`.
- [ ] ML046. Capture visual parity for the master-dispatch cart and write the report to `tsz/compiler/migration/reports/visual/maps_lua_master_visual.json`.
- [ ] ML047. Open both visual reports and confirm each one contains the fields listed in [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md).
- [ ] ML048. Confirm `maps_lua_rebuilder_visual.json` includes region hashes for `wrapper_row` and `lua_map_body`.
- [ ] ML049. Confirm `maps_lua_master_visual.json` includes region hashes for `wrapper_row` and `rendered_children`.
- [ ] ML050. Read `full_diff_status` and `region_diff_status` in both visual reports and confirm they are `match`.
- [ ] ML051. If either visual report is not `match`, copy `first_diff_region` and the cart path into `maps_lua_status.md`.
- [ ] ML052. If both visual reports are `match`, add the line `Maps lua visual parity: EXACT HASH REGIONS MATCH on rebuilder and master dispatch carts` to `maps_lua_status.md`.
- [ ] ML053. Re-open `maps_lua_status.md` and confirm it contains the grounding line from `ML029`, one result line for each atom `a029-a032`, and either copied diff hunks or the explicit all-match lines.
- [ ] ML054. Re-open [a029_lua_map_wrapper_registration.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a029_lua_map_wrapper_registration.js), [a030_lua_map_rebuilder_functions.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a030_lua_map_rebuilder_functions.js), [a031_lua_nested_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a031_lua_nested_helpers.js), and [a032_lua_map_master_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_lua/a032_lua_map_master_dispatch.js) and confirm only the lines named in this contract were touched if a patch occurred.
- [ ] ML055. Re-open [emit_lua_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_rebuild.js) and [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js) and confirm only the lines named in this contract were touched if a patch occurred.
- [ ] ML056. Re-run the byte-parity harness on both Lua carts and compare rerun hashes to `maps_lua_rebuilder.json` and `maps_lua_master.json`.
- [ ] ML057. If either rerun hash differs from the saved report hash, append `0341-0370 maps-lua rerun hash mismatch` to `blocked.txt` and stop.
- [ ] ML058. Append `0341-0370 maps-lua parity complete` to `completed.txt`.
