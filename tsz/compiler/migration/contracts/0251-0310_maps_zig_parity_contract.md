# Contract 0251-0310 — Maps Zig Parity

Purpose:
- This contract expands base steps `251-310` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the Zig-backed map group.
- This contract treats the current live [map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js) as a stub wrapper, not as the full legacy truth source.

Scope:
- Compare atoms `a019` through `a028` and their map-declaration / rebuild helpers against the last full monolith body for Zig map pools and rebuilds.
- Resolve the known coherence seam between `ctx._mapEmitMeta` and `meta`.
- Resolve the top-level rebuild ownership seam between `a026`, `a027`, and `a028`.
- Preserve explicit exclusion of `mapBackend === 'lua_runtime'` from Zig map realization.

## Verification Layers

- `contract parity`
  - required
  - the same map metadata, backend route, per-item array truth, handler classification, dyn-text storage, nested/inline parent binding, and orphan-array cleanup truth must exist
- `byte parity`
  - required
  - atoms `a019-a028` plus the helper files in this contract must match the historical monolith output for Zig-backed maps
- `visual parity`
  - required
  - because the engine is unchanged and only the compiler realization path is changing
  - exact whole-screen plus named-region hashes are required under [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)
- `behavioral parity`
  - deferred in this contract
  - if no scripted interaction harness exists, record `DEFERRED` in the status report rather than inventing an ad hoc interaction check

## Pattern In

- Reader-side syntax can vary. This contract uses [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz), [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz), [d109_map_in_ternary_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d109_map_in_ternary_in_map.tsz), and fallback [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz) only as concrete fixtures.
- The relevant reader output is normalized map truth:
  - top-level OA-backed `.map()` hosts
  - nested child maps keyed by `parentOaIdx`
  - inline child maps keyed by `parentMap`
  - per-item array declarations and promoted arrays
  - in-map dynamic texts
  - in-map handler captures
  - in-map conditionals and filter display toggles
  - backend route truth for each map slice
- This contract is frontend-independent once that map truth exists.

## Middle Record

- `pattern_in`
  - top-level flat map
  - nested child map
  - inline child map
  - map-local conditional
  - map-local dynamic text
  - map-local handler capture
- `node_id`
  - map host node
  - per-item child node
  - inner-array node
  - nested child node
  - inline child node
- `parent_id`
  - `parentArr`
  - `childIdx`
  - `parentOaIdx`
  - `parentMap`
  - `_parentMi`
- `node_kind`
  - flat map host
  - nested map host
  - inline map host
  - per-item array storage
  - inner array storage
  - handler ptr storage
  - dyn-text storage
- `string_literals`
  - template literal format strings
  - handler format strings
  - inline and nested rewritten field refs
  - orphan-array stub strings
- `size_literals`
  - `MAX_MAP_*`
  - `MAX_FLAT_*`
  - `MAX_NESTED_OUTER_*`
  - `MAX_INLINE_OUTER_*`
  - per-item element counts
  - inner-array counts
  - handler buffer sizes
- `style_literals`
  - `.flex`
  - `.none`
  - filter display toggles
  - hoisted display state on pool nodes
- `conditionals`
  - show/hide
  - ternary JSX
  - inline conditional rewrite
  - filter conditions
- `variants`
  - in-map variant patch block inside the rebuild loop
- `handlers`
  - map handler records
  - `_handlerFieldRefsMap`
  - nested parent/child field refs
  - pre-init vs per-iteration pointer construction
- `maps`
  - `mapOrder`
  - `mapMeta`
  - `promotedToPerItem`
  - `_mapPerItemDecls`
  - `innerArr`
  - `innerCount`
  - `mapBackend`
  - `isNested`
  - `isInline`
- `render_locals`
  - not applicable
- `dyn_text`
  - `mapDynTexts`
  - `bufId`
  - `_mapTextIdx`
- `dyn_style`
  - not applicable outside display toggles
- `dyn_color`
  - computed color comment path only
- `runtime_bridges`
  - `_map_lua_bufs_*`
  - `_map_lua_ptrs_*`
  - `_initMapLuaPtrs*`
  - orphan-array fallback stubs
- `pattern_backend_flags`
  - per-map route flags that force a map slice out of Zig realization
- `realization_mode`
  - `zig-tree` for this contract's owned maps
- `zig_tree_eligible`
  - true only when `mapBackend !== 'lua_runtime'`
- `lua_tree_required`
  - true for a map slice that resolves to `mapBackend === 'lua_runtime'`
- `backend_reason_tags`
  - include `mapBackend:zig` or `mapBackend:lua_runtime`
  - include any upstream hard gate such as `lua-tree-hard-gate` if already recorded by the reader
- `emit_out`
  - `a019` metadata only
  - `a020-a025` declarations and storage
  - `a026` sole top-level rebuild owner via `rebuildMap(ctx, meta)`
  - `a027` nested fragment helper export only
  - `a028` inline fragment helper export only plus orphan-array cleanup parity

## Emit Out

- Output owners:
  - [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js)
  - [a020_flat_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js)
  - [a021_nested_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js)
  - [a022_inline_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js)
  - [a023_map_per_item_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js)
  - [a024_map_dynamic_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js)
  - [a025_map_handler_ptrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js)
  - [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js)
  - [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js)
  - [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js)
  - [compute_map_meta.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/compute_map_meta.js)
  - [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js)
  - [emit_arena.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_arena.js)
  - [emit_map_decl.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_map_decl.js)
  - [emit_per_item_arr.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_per_item_arr.js)
  - [emit_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_text_storage.js)
  - [emit_handler_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_handler_storage.js)
  - [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js)
- Legacy compare surface:
  - historical [map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js) body at commit `3820f0a2`
- Target backend:
  - `zig-tree`
- Backend exclusion:
  - if a map slice carries `mapBackend === 'lua_runtime'`, this contract must not emit Zig pool declarations or Zig rebuild functions for that slice

## Coherence Decisions

- Shared metadata carrier:
  - `ctx._mapEmitMeta` and `meta` must be the same object by reference before atom `a020` runs
- Top-level rebuild owner:
  - `a026` is the only top-level rebuild emitter in this contract
- Fragment helpers:
  - `a027_emitNestedRebuild` stays live
  - `a028_emitInlineRebuild` stays live
  - top-level `_a027_emit` returns `''`
  - top-level `_a028_emit` returns `''`
- Orphan-array cleanup:
  - `a028_appendOrphanedMapArrays` and [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js) must both stay byte-identical to historical `appendOrphanedMapArrays()`

Canonical intent sources:
- [map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js)
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)
- [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js)
- [a020_flat_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js)
- [a021_nested_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js)
- [a022_inline_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js)
- [a023_map_per_item_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js)
- [a024_map_dynamic_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js)
- [a025_map_handler_ptrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js)
- [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js)
- [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js)
- [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js)
- [compute_map_meta.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/compute_map_meta.js)
- [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js)
- [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js)
- [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)

Historical legacy source:
- Use the local git command `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js` as the monolith source of truth.
- Use the command `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '1,138p'` for `_wrapMapCondition`, `buildMapEmitOrder`, `ensureMapHandlerFieldRefs`, `countTopLevelNodeDeclEntries`, and `computePromotedMapArrays`.
- Use the command `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '140,358p'` for map declarations, per-item arrays, inner arrays, map dyn texts, and handler storage.
- Use the command `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '361,520p'` for flat rebuild entry, early handler ptr init, and per-item array setup.
- Use the command `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '520,840p'` for conditionals, nested rebuilds, and the start of inline rebuilds.
- Use the command `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '840,1251p'` for inline rebuild completion, inner arrays, pool nodes, filters, deferred canvas attrs, variant patches, parent binding, and orphan-array cleanup.

Owned files:
- [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js)
- [a020_flat_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js)
- [a021_nested_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js)
- [a022_inline_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js)
- [a023_map_per_item_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js)
- [a024_map_dynamic_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js)
- [a025_map_handler_ptrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js)
- [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js)
- [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js)
- [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js)
- [compute_map_meta.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/compute_map_meta.js)
- [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js)
- [emit_arena.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_arena.js)
- [emit_map_decl.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_map_decl.js)
- [emit_per_item_arr.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_per_item_arr.js)
- [emit_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_text_storage.js)
- [emit_handler_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_handler_storage.js)
- [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js)
- [maps_zig_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/maps_zig_status.md)
- [atom26_reachability.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/atom26_reachability.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js)
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)
- [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz)
- [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz)
- [d109_map_in_ternary_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d109_map_in_ternary_in_map.tsz)
- [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js)

Required artifacts:
- `tsz/compiler/migration/reports/sections/maps_zig_status.md`
- `tsz/compiler/migration/reports/coverage/atom26_reachability.md`
- `tsz/compiler/migration/reports/parity/maps_zig_flat.json`
- `tsz/compiler/migration/reports/parity/maps_zig_nested.json`
- `tsz/compiler/migration/reports/parity/maps_zig_inline.json`
- `tsz/compiler/migration/reports/visual/maps_zig_flat_visual.json`
- `tsz/compiler/migration/reports/visual/maps_zig_nested_visual.json`
- `tsz/compiler/migration/reports/visual/maps_zig_inline_visual.json`

Visual fixture regions:
- `maps_zig_flat_visual.json`
  - `nav_panel`
  - `main_panel`
- `maps_zig_nested_visual.json`
  - `group_list`
  - `selected_footer`
- `maps_zig_inline_visual.json`
  - `header_status`
  - `accordion_list`

Completion criteria:
- `a019` makes `ctx._mapEmitMeta` and `meta` the same object by reference and initializes `meta.mapMeta`
- `a020-a025` match historical declaration order and helper output for Zig-backed maps only
- `a026_applies` excludes `mapBackend === 'lua_runtime'`
- `a026_emit` delegates to `rebuildMap(ctx, meta)` directly
- `rebuild_map.js` matches historical flat/nested/inline rebuild output for Zig-backed maps
- top-level `_a027_emit` returns `''` and `emitNestedRebuild` stays exported
- top-level `_a028_emit` returns `''` and `emitInlineRebuild` plus `appendOrphanedMapArrays` stay exported
- `a028_appendOrphanedMapArrays` and `emit_orphan_arrays.js` both match historical `appendOrphanedMapArrays()`
- `maps_zig_status.md` records the grounding line `a019 shared meta carrier; a026 sole top-level rebuild; a027/a028 fragment-only at top level; lua_runtime maps excluded from zig rebuild`
- all three byte-parity reports exist and match the parity schema
- all three visual-parity reports exist and match the visual-parity method

## Microsteps

- [ ] MZ001. Open [map_pools.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/map_pools.js#L1) lines `1-34` and confirm the live file is a stub wrapper, not the full historical body.
- [ ] MZ002. Run `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '1,138p'`.
- [ ] MZ003. Run `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '140,358p'`.
- [ ] MZ004. Run `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '361,520p'`.
- [ ] MZ005. Run `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '520,840p'`.
- [ ] MZ006. Run `git show 3820f0a2:tsz/compiler/smith/emit/map_pools.js | nl -ba | sed -n '840,1251p'`.
- [ ] MZ007. Open [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js#L19) lines `19-33`.
- [ ] MZ008. Open [a020_flat_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js#L15) lines `15-46`.
- [ ] MZ009. Open [a021_nested_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js#L17) lines `17-49`.
- [ ] MZ010. Open [a022_inline_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js#L17) lines `17-46`.
- [ ] MZ011. Open [a023_map_per_item_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js#L19) lines `19-150`.
- [ ] MZ012. Open [a024_map_dynamic_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js#L16) lines `16-50`.
- [ ] MZ013. Open [a025_map_handler_ptrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js#L19) lines `19-55`.
- [ ] MZ014. Open [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js#L24) lines `24-42`.
- [ ] MZ015. Open [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js#L23) lines `23-32` and `160-175`.
- [ ] MZ016. Open [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L35) lines `35-44` and `353-381`.
- [ ] MZ017. Open [compute_map_meta.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/compute_map_meta.js#L1) lines `1-104`.
- [ ] MZ018. Open [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L20) lines `20-260`.
- [ ] MZ019. Open [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L211) lines `211-540`.
- [ ] MZ020. Open [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L541) lines `541-827`.
- [ ] MZ021. Open [emit_arena.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_arena.js#L1) lines `1-3`.
- [ ] MZ022. Open [emit_map_decl.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_map_decl.js#L1) lines `1-20`.
- [ ] MZ023. Open [emit_per_item_arr.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_per_item_arr.js#L1) lines `1-9`.
- [ ] MZ024. Open [emit_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_text_storage.js#L1) lines `1-10`.
- [ ] MZ025. Open [emit_handler_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_handler_storage.js#L1) lines `1-24`.
- [ ] MZ026. Open [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12) lines `12-74`.
- [ ] MZ027. Open [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js#L41) lines `41-69`.
- [ ] MZ028. Open [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt#L343) lines `343-352`.
- [ ] MZ029. Open [pattern_atoms.js](/home/siah/creative/reactjit/tsz/compiler/smith/preflight/pattern_atoms.js#L39) lines `39-60`.
- [ ] MZ030. Open [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz#L19) lines `19-79` and `81-139`.
- [ ] MZ031. Open [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz#L12) lines `12-27`.
- [ ] MZ032. Open [d109_map_in_ternary_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d109_map_in_ternary_in_map.tsz#L24) lines `24-56`.
- [ ] MZ033. Open fallback [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz#L120) lines `120-135`.
- [ ] MZ034. Compare historical lines `22-138` from step `MZ002` to [compute_map_meta.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/compute_map_meta.js#L1) lines `1-104` and confirm `buildMapEmitOrder`, `ensureMapHandlerFieldRefs`, `computePromotedMapArrays`, and `countTopLevelNodeDeclEntries` match in logic and order.
- [ ] MZ035. Compare [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js#L24) lines `24-33` to historical metadata setup and confirm the atom currently computes `promotedToPerItem`, `mapOrder`, and handler refs before any declaration atom runs.
- [ ] MZ036. If [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js#L29) lines `29-32` do not make `ctx._mapEmitMeta` and `meta` the same object, replace lines `29-32` with this exact block:
```js
  if (!meta.mapMeta) meta.mapMeta = [];
  meta.promotedToPerItem = promotedToPerItem;
  meta.mapOrder = mapOrder;
  ctx._mapEmitMeta = meta;
```
- [ ] MZ037. Re-open [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js#L24) lines `24-33` and confirm the exact block from `MZ036` is present.
- [ ] MZ038. Compare historical line `155` from step `MZ003` to [emit_arena.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_arena.js#L1) lines `1-3` and confirm the arena declaration string is byte-identical.
- [ ] MZ039. If [emit_arena.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_arena.js#L2) differs, replace line `2` with the exact text ``  return `var _pool_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);\n`;``.
- [ ] MZ040. Compare historical lines `176-193` from step `MZ003` to [emit_map_decl.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_map_decl.js#L1) lines `1-20` and confirm the flat, nested, and inline declaration strings match exactly.
- [ ] MZ041. Compare historical lines `267-274` from step `MZ003` to [emit_per_item_arr.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_per_item_arr.js#L1) lines `1-9` and confirm inline and nested per-item storage declarations match exactly.
- [ ] MZ042. Compare historical lines `305-317` from step `MZ003` to [emit_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_text_storage.js#L1) lines `1-10` and confirm nested vs flat vs inline text storage shapes match exactly.
- [ ] MZ043. Compare historical lines `323-343` from step `MZ003` to [emit_handler_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_handler_storage.js#L1) lines `1-24` and confirm storage declarations plus `_initMapLuaPtrs*()` output match exactly.
- [ ] MZ044. Compare historical lines `145-169` from step `MZ003` to [a020_flat_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js#L21) lines `21-46` and confirm header comment, optional ternary marker comment, arena emission, `mapOrder` traversal, and `mapBackend === 'lua_runtime'` skip are present in that order.
- [ ] MZ045. If [a020_flat_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a020_flat_map_pool_decls.js#L36) does not contain the exact line `    if (map.mapBackend === 'lua_runtime') continue;`, insert that line directly after line `35`.
- [ ] MZ046. Compare historical lines `170-181` from step `MZ003` to [a021_nested_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js#L23) lines `23-49` and confirm parent-map discovery, `_parentMi`, `parentPoolSize`, and declaration order match exactly.
- [ ] MZ047. If [a021_nested_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a021_nested_map_pool_decls.js#L33) does not contain the exact line `    if (map.mapBackend === 'lua_runtime') continue;`, insert that line directly after line `32`.
- [ ] MZ048. Compare historical lines `182-188` from step `MZ003` to [a022_inline_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js#L23) lines `23-46` and confirm `_parentMi` assignment and declaration order match exactly.
- [ ] MZ049. If [a022_inline_map_pool_decls.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a022_inline_map_pool_decls.js#L33) does not contain the exact line `    if (map.mapBackend === 'lua_runtime') continue;`, insert that line directly after line `32`.
- [ ] MZ050. Compare historical lines `195-300` from step `MZ003` to [a023_map_per_item_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js#L25) lines `25-149` and confirm `promotedToPerItem`, `emittedMapArrays`, `mapPerItemDecls`, `innerArr`, and `innerCount` are built in the same order.
- [ ] MZ051. Confirm [a023_map_per_item_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a023_map_per_item_arrays.js#L31) line `31` initializes `mapMeta` from the shared carrier with the exact text `  const mapMeta = emitMeta.mapMeta || (emitMeta.mapMeta = []);`.
- [ ] MZ052. Compare historical lines `302-318` from step `MZ003` to [a024_map_dynamic_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js#L22) lines `22-50` and confirm `mapDynTexts`, `_mapTextIdx`, and `emitTextStorage()` usage match exactly.
- [ ] MZ053. Confirm [a024_map_dynamic_text_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a024_map_dynamic_text_storage.js#L27) line `27` initializes `mapMeta` from the shared carrier with the exact text `  const mapMeta = emitMeta.mapMeta || (emitMeta.mapMeta = []);`.
- [ ] MZ054. Compare historical lines `320-345` from step `MZ003` to [a025_map_handler_ptrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js#L25) lines `25-55` and confirm `emitHandlerStorage()` is used for every in-map handler and `mapHandlers` are written back to shared `mapMeta`.
- [ ] MZ055. Confirm [a025_map_handler_ptrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a025_map_handler_ptrs.js#L30) line `30` initializes `mapMeta` from the shared carrier with the exact text `  const mapMeta = emitMeta.mapMeta || (emitMeta.mapMeta = []);`.
- [ ] MZ056. Compare [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js#L24) lines `24-28` to the contract rule `top-level Zig maps only` and confirm `_a026_applies` excludes `mapBackend === 'lua_runtime'`.
- [ ] MZ057. If [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js#L24) lines `24-28` differ, replace that function with this exact block:
```js
function _a026_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) {
    return !m.isNested && !m.isInline && m.mapBackend !== 'lua_runtime';
  });
}
```
- [ ] MZ058. Compare [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L20) lines `20-827` to historical lines `361-1195` from steps `MZ004-MZ006` and confirm the helper file is the single full flat/nested/inline top-level rebuild body.
- [ ] MZ059. Replace the entire `_a026_emit` function in [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js#L30) with this exact block:
```js
function _a026_emit(ctx, meta) {
  return rebuildMap(ctx, meta);
}
```
- [ ] MZ060. Re-open [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js#L24) lines `24-33` and confirm `_a026_applies` matches `MZ057` and `_a026_emit` matches `MZ059`.
- [ ] MZ061. Read [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L31) lines `31-32` and confirm the helper itself skips nested/inline top-level maps and skips `mapBackend === 'lua_runtime'`.
- [ ] MZ062. Read [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L44) lines `44-209` and confirm flat dyn-text, early handler ptrs, per-item array copies, conditionals, and non-map dyn-text wiring match historical lines `381-550`.
- [ ] MZ063. Read [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L211) lines `211-323` and confirm nested child rebuild output matches historical lines `552-668`.
- [ ] MZ064. Read [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L325) lines `325-540` and confirm inline rebuild output matches historical lines `670-897`.
- [ ] MZ065. Read [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js#L541) lines `541-827` and confirm inner arrays, pool nodes, filters, deferred canvas attrs, variant patches, and parent binding match historical lines `900-1195`.
- [ ] MZ066. Replace the entire `_a027_emit` function in [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js#L160) with this exact block:
```js
function _a027_emit(ctx, meta) {
  void ctx;
  void meta;
  return '';
}
```
- [ ] MZ067. Re-open [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js#L160) lines `160-175` and confirm `_a027_emit` is now an intentional top-level no-op.
- [ ] MZ068. Confirm [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js#L186) line `186` still exports `emitNestedRebuild: _a027_emitNestedRebuild,`.
- [ ] MZ069. Replace the entire `_a028_emit` function in [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L353) with this exact block:
```js
function _a028_emit(ctx, meta) {
  void ctx;
  void meta;
  return '';
}
```
- [ ] MZ070. Re-open [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L353) lines `353-369` and confirm `_a028_emit` is now an intentional top-level no-op.
- [ ] MZ071. Confirm [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L380) line `380` still exports `emitInlineRebuild: _a028_emitInlineRebuild,`.
- [ ] MZ072. Confirm [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L381) line `381` still exports `appendOrphanedMapArrays: _a028_appendOrphanedMapArrays,`.
- [ ] MZ073. Compare historical lines `1198-1251` from step `MZ006` to [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12) lines `12-74` and confirm the helper is byte-identical to the monolith cleanup pass.
- [ ] MZ074. Compare [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12) lines `12-74` to [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L293) lines `293-350` and confirm both orphan-array helper bodies are byte-identical.
- [ ] MZ075. If [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12) differs from historical lines `1198-1251`, replace lines `12-74` with the exact historical body from step `MZ006`.
- [ ] MZ076. If [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L293) differs from [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12), replace lines `293-350` with the exact helper body from [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12).
- [ ] MZ077. Re-open [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js#L12) and [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js#L293) and confirm the orphan-array bodies are now identical.
- [ ] MZ078. Run `rg -n "mapBackend|lua_runtime" tsz/compiler/smith/emit.js tsz/compiler/smith/emit_atoms/maps_zig tsz/compiler/smith/emit_ops tsz/compiler/smith/emit/map_pools.js` and copy every returned file path and line number into `tsz/compiler/migration/reports/coverage/atom26_reachability.md`.
- [ ] MZ079. Add one exact line to `atom26_reachability.md` stating `Current live monolith still routes map metadata and rebuild meta through emit.js lines 41-69.`
- [ ] MZ080. Add one exact line to `atom26_reachability.md` stating `Atom 26 load-order registration confirmed at smith_LOAD_ORDER.txt lines 343-352.`
- [ ] MZ081. Add one exact line to `atom26_reachability.md` stating `Zig map route is valid only when mapBackend !== 'lua_runtime'.`
- [ ] MZ082. Create `tsz/compiler/migration/reports/sections/maps_zig_status.md` if it does not already exist.
- [ ] MZ083. Add this exact grounding line to `maps_zig_status.md`: `a019 shared meta carrier; a026 sole top-level rebuild; a027/a028 fragment-only at top level; lua_runtime maps excluded from zig rebuild`.
- [ ] MZ084. Add one plain-text result line to `maps_zig_status.md` for each atom `a019` through `a028`, marking `MATCH` or `PATCHED`.
- [ ] MZ085. Add one plain-text line to `maps_zig_status.md` stating `Behavioral parity: DEFERRED in 0251-0310 until scripted interaction harness exists.`
- [ ] MZ086. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to byte-parity verification.
- [ ] MZ087. Run the parity harness on [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz) and write the output to `tsz/compiler/migration/reports/parity/maps_zig_flat.json`.
- [ ] MZ088. Run the parity harness on [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz) and write the output to `tsz/compiler/migration/reports/parity/maps_zig_nested.json`.
- [ ] MZ089. Run the parity harness on [d109_map_in_ternary_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d109_map_in_ternary_in_map.tsz) and write the output to `tsz/compiler/migration/reports/parity/maps_zig_inline.json`.
- [ ] MZ090. Open all three byte-parity reports and confirm each one exists.
- [ ] MZ091. Open all three byte-parity reports and confirm each one contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] MZ092. Read `predicted_atoms` in `maps_zig_flat.json` and confirm atoms `19`, `20`, `23`, `24`, `25`, and `26` are present.
- [ ] MZ093. Read `predicted_atoms` in `maps_zig_nested.json` and confirm atoms `19`, `20`, `21`, `23`, `24`, `25`, `26`, and `27` are present.
- [ ] MZ094. Read `predicted_atoms` in `maps_zig_inline.json` and confirm atoms `19`, `20`, `22`, `23`, `24`, `25`, `26`, and `28` are present.
- [ ] MZ095. If `maps_zig_inline.json` does not include atom `28`, re-run the parity harness on [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz) and overwrite `maps_zig_inline.json`.
- [ ] MZ096. If `maps_zig_flat.json` still does not include atom `26`, add the exact line `Maps zig coverage gap: d96_const_array_map.tsz did not exercise atom 26` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md) and stop.
- [ ] MZ097. If `maps_zig_nested.json` still does not include atom `27`, add the exact line `Maps zig coverage gap: d01_nested_maps.tsz did not exercise atom 27` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md) and stop.
- [ ] MZ098. If `maps_zig_inline.json` still does not include atom `28`, add the exact line `Maps zig coverage gap: inline fallback cart did not exercise atom 28` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md) and stop.
- [ ] MZ099. Read `diff_status` in all three byte-parity reports.
- [ ] MZ100. If `maps_zig_flat.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `maps_zig_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d96_const_array_map.tsz`.
- [ ] MZ101. If `maps_zig_nested.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `maps_zig_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d01_nested_maps.tsz`.
- [ ] MZ102. If `maps_zig_inline.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `maps_zig_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d109_map_in_ternary_in_map.tsz` or the fallback inline cart if step `MZ095` overwrote the report.
- [ ] MZ103. If all three byte-parity reports have `diff_status` equal to `match`, add the line `Maps zig smoke parity: MATCH on flat, nested, and inline carts` to `maps_zig_status.md`.
- [ ] MZ104. Ensure the visual capture harness exists before continuing to visual verification. If it does not exist, append `0251-0310 maps-zig visual harness missing` to `blocked.txt` and stop.
- [ ] MZ105. Capture visual parity for [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz) and write the report to `tsz/compiler/migration/reports/visual/maps_zig_flat_visual.json`.
- [ ] MZ106. Capture visual parity for [d01_nested_maps.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d01_nested_maps.tsz) and write the report to `tsz/compiler/migration/reports/visual/maps_zig_nested_visual.json`.
- [ ] MZ107. Capture visual parity for [d109_map_in_ternary_in_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d109_map_in_ternary_in_map.tsz) and write the report to `tsz/compiler/migration/reports/visual/maps_zig_inline_visual.json`.
- [ ] MZ108. Open all three visual reports and confirm each one contains the fields listed in [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md).
- [ ] MZ109. Confirm `maps_zig_flat_visual.json` includes region hashes for `nav_panel` and `main_panel`.
- [ ] MZ110. Confirm `maps_zig_nested_visual.json` includes region hashes for `group_list` and `selected_footer`.
- [ ] MZ111. Confirm `maps_zig_inline_visual.json` includes region hashes for `header_status` and `accordion_list`.
- [ ] MZ112. Read `full_diff_status` and `region_diff_status` in all three visual reports and confirm they are `match`.
- [ ] MZ113. If any visual report is not `match`, copy `first_diff_region` and the cart path into `maps_zig_status.md`.
- [ ] MZ114. If all three visual reports are `match`, add the line `Maps zig visual parity: EXACT HASH REGIONS MATCH on flat, nested, and inline carts` to `maps_zig_status.md`.
- [ ] MZ115. Re-open `maps_zig_status.md` and confirm it contains the grounding line from `MZ083`, one result line for each atom `a019-a028`, one behavioral line from `MZ085`, and either copied diff hunks or the explicit all-match lines.
- [ ] MZ116. Re-open [a019_map_metadata.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a019_map_metadata.js), [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js), [a027_nested_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a027_nested_map_rebuild.js), and [a028_inline_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a028_inline_map_rebuild.js) and confirm only the lines named in this contract were touched if a patch occurred.
- [ ] MZ117. Re-open [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js) and [emit_orphan_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_orphan_arrays.js) and confirm only the lines named in this contract were touched if a patch occurred.
- [ ] MZ118. Re-run the byte-parity harness on the flat and nested carts and compare rerun hashes to `maps_zig_flat.json` and `maps_zig_nested.json`.
- [ ] MZ119. If either rerun hash differs from the saved report hash, append `0251-0310 maps-zig rerun hash mismatch` to `blocked.txt` and stop.
- [ ] MZ120. Append `0251-0310 maps-zig parity complete` to `completed.txt`.
