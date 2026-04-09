# Migration Index

Entry point for workers executing the single-agent migration.

## Source Documents

- [COMPILER_MANIFEST.md](/home/siah/creative/reactjit/tsz/compiler/COMPILER_MANIFEST.md)
- [COMPILER_MANIFEST_FINAL_CUT.md](/home/siah/creative/reactjit/tsz/compiler/COMPILER_MANIFEST_FINAL_CUT.md)
- [FRAGILE_FUNCTION_REUSE_MAP.md](/home/siah/creative/reactjit/tsz/compiler/FRAGILE_FUNCTION_REUSE_MAP.md)
- [FRAGILE_FUNCTION_DECOMPOSITION_MAP.md](/home/siah/creative/reactjit/tsz/compiler/FRAGILE_FUNCTION_DECOMPOSITION_MAP.md)
- [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md)

## Execution Plan

660 steps across 17 sections. Read the proposal top-to-bottom before touching code.

| Range | Section | Contract |
|---|---|---|
| 001-020 | Loop Discipline | proposal only |
| 021-050 | Workspace Scaffolding | proposal only |
| 051-080 | Canonical Source Capture | proposal only |
| 081-110 | Harness Scaffolding | proposal only |
| 111-140 | Coverage And Live-Risk Baseline | proposal only |
| 141-165 | Preamble Parity | [contract](contracts/0141-0165_preamble_parity_contract.md) |
| 166-190 | State Tree Parity | [contract](contracts/0166-0190_state_tree_parity_contract.md) |
| 191-215 | Handlers / Effects Parity | [contract](contracts/0191-0215_handlers_effects_parity_contract.md) |
| 216-250 | Object Arrays Parity | [contract](contracts/0216-0250_object_arrays_parity_contract.md) |
| 251-340 | Maps Zig Parity And Atom 26 | [contract](contracts/0251-0310_maps_zig_parity_contract.md) |
| 341-370 | Maps Lua Parity | [contract](contracts/0341-0370_maps_lua_parity_contract.md) |
| 371-410 | Logic / Runtime Parity | [contract](contracts/0371-0410_logic_runtime_parity_contract.md) |
| 411-458 | Entry / Split / Finalize Parity | [contract](contracts/0411-0458_entry_split_finalize_parity_contract.md) |
| 459-492 | Live Switch And Rollback | proposal only |
| 493-517 | Legacy Emit Deletion | proposal only |
| 518-547 | Duplicate / Global Cleanup | proposal only |
| 548-660 | Structural Cleanup + Attrs + Final | proposal only |

## Method Documents

- [MIDDLE_LAYER_METHOD.md](contracts/MIDDLE_LAYER_METHOD.md) — semantic middle-record rule
- [VISUAL_PARITY_METHOD.md](contracts/VISUAL_PARITY_METHOD.md) — visual parity verification method
- [contracts/README.md](contracts/README.md) — contract directory rules

## State (created at step 021)

Not yet scaffolded. When execution begins:
- `migration/state/current_step.txt` — last completed step
- `migration/state/completed.txt` — completion log
- `migration/state/blocked.txt` — blocker log
- `migration/control_board.md` — boolean gate results
