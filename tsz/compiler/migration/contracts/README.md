# Migration Contracts

Purpose:
- This directory holds zero-inference contract expansions of the serial ranges in [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- A contract in this directory supersedes the corresponding base range in the serial proposal.
- [MIDDLE_LAYER_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/MIDDLE_LAYER_METHOD.md) defines the semantic middle-record rule that every contract in this directory must follow.
- [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md) defines when exact visual parity is required in addition to byte parity.

Rules:
- Read canonical intent sources directly.
- Do not infer patch shape from summaries.
- Do not widen file ownership beyond the contract.
- Re-open every touched file before marking the contract complete.
- Trust a parity result only if the required artifact exists and matches the schema.
- Do not write input/output-only contracts. Every contract must name `Pattern In`, `Middle Record`, and `Emit Out`.
- Write the middle layer in compiler terms: node ids, normalized literals, map schema, handler classification, conditional records, dynamic registries, runtime bridges, and the output consumers of those facts.
- When backend routing matters, the contract must say whether the owned slice is `backend-neutral`, `zig-tree` eligible, `lua-tree` required, or another explicit realization mode, plus the reason tags for that decision.
- If a matched pattern carries a hard backend gate such as `lua-tree-hard-gate`, the contract must preserve that flag and treat it as routing truth rather than rediscovering the route later.
- Every contract must declare its verification layers explicitly: contract parity, byte parity, visual parity, and behavioral parity as applicable.
- When the engine stays fixed and only compiler realization changes, visual parity is required product truth rather than an optional extra.
- Visual parity contracts should prefer whole-screen plus named-region hashes instead of only one full-screen hash.

Method:
- Canonical middle-layer method: [MIDDLE_LAYER_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/MIDDLE_LAYER_METHOD.md)
- Canonical visual-parity method: [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md)

Expanded ranges:
- `0141-0165` -> [0141-0165_preamble_parity_contract.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/0141-0165_preamble_parity_contract.md)
- `0166-0190` -> [0166-0190_state_tree_parity_contract.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/0166-0190_state_tree_parity_contract.md)
- `0191-0215` -> [0191-0215_handlers_effects_parity_contract.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/0191-0215_handlers_effects_parity_contract.md)
- `0216-0250` -> [0216-0250_object_arrays_parity_contract.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/0216-0250_object_arrays_parity_contract.md)
- `0251-0310` -> [0251-0310_maps_zig_parity_contract.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/0251-0310_maps_zig_parity_contract.md)
- `0311-0340` -> [0311-0340_maps_lua_parity_contract.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/0311-0340_maps_lua_parity_contract.md)

Next range not yet expanded:
- `0341-0380` logic / runtime parity
