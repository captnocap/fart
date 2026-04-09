# Migration Source Index

## Canonical Planning Documents

Define migration intent. Read directly, not reconstructed from downstream reports:

- [COMPILER_MANIFEST.md](/home/siah/creative/reactjit/tsz/compiler/COMPILER_MANIFEST.md) — Phase 0 inventory
- [COMPILER_MANIFEST_FINAL_CUT.md](/home/siah/creative/reactjit/tsz/compiler/COMPILER_MANIFEST_FINAL_CUT.md) — Phase 1 plan
- [FRAGILE_FUNCTION_DECOMPOSITION_MAP.md](/home/siah/creative/reactjit/tsz/compiler/FRAGILE_FUNCTION_DECOMPOSITION_MAP.md) — Decomposition strategy
- [FRAGILE_FUNCTION_REUSE_MAP.md](/home/siah/creative/reactjit/tsz/compiler/FRAGILE_FUNCTION_REUSE_MAP.md) — Reuse map
- [MIGRATION_AGENT_ORCHESTRATION_PLAN.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_AGENT_ORCHESTRATION_PLAN.md) — Agent coordination plan

## Current Implementation Hubs

Code that implements the monolithic or atom-based emit:

- smith/emit.js — Monolithic emit orchestration
- smith/emit/finalize.js — Finalization logic
- smith/emit/split.js — Split emit output
- smith/emit_atoms/index.js — Atom index
- smith_LOAD_ORDER.txt — Bundle load order
- smith/emit_ops/rebuild_map.js — Map rebuilding
- smith/emit_ops/transforms.js — AST transforms
- smith/emit_ops/js_expr_to_lua.js — JS→Lua translation
- smith/emit_atoms/maps_lua/lua_map_subs.js — Lua map subscriptions
- smith/attrs.js — Attribute handling
- smith/parse.js — JSX parsing
- smith/core.js — Core utilities
- smith/parse/handlers/press.js — Press event handlers

## Important Note

Implementation intent must be read from canonical docs directly, not reconstructed from downstream reports. The migration follows intent first, then verifies output.
