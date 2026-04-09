Snapshot recorded: 2026-04-09 (step 57)

# Migration Agent Orchestration Plan

Generated: 2026-04-08

Inputs:
- `COMPILER_MANIFEST_FINAL_CUT.md`
- `FRAGILE_FUNCTION_DECOMPOSITION_MAP.md`
- `FRAGILE_FUNCTION_REUSE_MAP.md`
- current Smith layout under `smith/`

## Goal

Break the compiler migration into parallel work that can move at high velocity without creating merge chaos.

This plan optimizes for:
- high parallelism where write scopes are naturally disjoint
- explicit single-owner choke points where hidden coupling is high
- fast feedback loops through standardized verification artifacts
- contracts that preserve the semantic middle layer between pattern intake and emitted output

The important distinction is:
- **20+ active agents is fine**
- **20+ concurrent writers on hub files is not**

The right topology is a mix of:
- a small control group
- subsystem owners
- narrowly-scoped end-to-end implementation lanes
- support verification attached to those lanes

## Non-Negotiable Lane Rules

These rules override any looser notion of "parallel analysis."

### 0. No cascading context reconstruction

Do not build execution as a waterfall where:
- Agent A reads the architecture and writes a summary
- Agent B reads Agent A's summary and re-discovers the code
- Agent C reads Agent B's artifact and re-discovers the code again
- Agent D finally implements from a third-hand reconstruction

That pattern is not just slow. It is **compounding context rot**.

Why it fails:
- each downstream tier has to reconstruct context the upstream tier already had
- reconstruction is always lossy, even when it looks locally coherent
- each tier is confident in its own grep-based reconstruction, so the drift is invisible from inside the lane
- end-to-end incoherence only shows up at the very end, when the original architectural intent has already been degraded through multiple handoffs

Treat every `rg`-based rediscovery of already-known architectural intent as a warning sign. If lane N needs to re-derive the same core intent that was already known when lane N-1 was designed, the lane boundaries are wrong.

Correct model:
- the contract author reads the architectural sources once
- the implementation lane receives the original intent directly
- the implementation lane also reads the owned code directly
- the implementation lane executes end to end inside that scope

Support artifacts are allowed, but they must not become the primary carrier of intent.

### 1. No scout-only implementation agents

Do not create implementation agents whose job is:
- read code
- report findings
- stop before changing the code

That pattern is exactly how stubbed migrations happen. It creates handoff loss and encourages partial work.

If an agent is launched as an implementation lane, it must own its slice **end to end**:
- inspect the assigned scope
- make the code changes
- wire imports/exports/helpers
- run the required local verification
- report completion against its contract

### 2. Parallelism is vertical, not tiered

Do not decompose implementation into:
- one agent that reads
- one agent that extracts helpers
- one agent that rewires imports
- one agent that verifies

for the same slice.

Instead, decompose by **vertical lane ownership**:
- exact files
- exact functions
- exact helper boundaries
- exact import paths
- exact verification obligations

Each lane should be independently completable without another implementation agent needing to "pick up where it left off."

### 3. Every implementation lane must be exact

A lane contract must name:
- owned files
- owned functions
- helper functions to introduce or re-home
- import/export paths to update
- forbidden files outside the lane
- required verification steps
- required report artifact

If the lane cannot be specified this concretely, it is still too vague to parallelize safely.

In addition, every implementation lane must be anchored to **canonical sources**, not only downstream summaries:
- the architectural source doc(s) that define the intent
- the exact current code files the lane is responsible for changing
- the exact migration doc section the lane is implementing

An implementation agent should not need to recover its mission by grepping prior agent artifacts. The mission should already be present in the contract.

### 3a. No input/output-only contracts

Do not write contracts that only say:
- read source pattern
- patch emitter
- compare final output

That misses the semantic middle, which is where most compiler drift actually hides.

Every implementation lane must state:
- `Pattern In`
- `Middle Record`
- `Emit Out`

The middle record should describe the compiler facts that survive between intake and serialization:
- node ids and host ownership
- normalized literals and style facts
- conditional and variant records
- map/OA schema and iterator shape
- handler capture and backend classification
- dynamic registries and runtime bridge obligations

This is what lets an implementation agent execute a lane end to end without re-deriving intent from monoliths or output bytes alone.

### 4. Control groups still exist, but only for true choke points

Small control groups are still correct for:
- `emit.js` switchover
- `smith_LOAD_ORDER.txt`
- split/finalize handoff
- bundle/load-order changes
- parity harness ownership

But outside those choke points, the default should be **direct end-to-end lane ownership**, not analysis relays.

### 5. Support lanes do not become context relays

Verification agents, coverage taggers, and live-risk auditors are useful only if they produce:
- evidence
- diffs
- coverage gaps
- blocker reports

They should not become the main way implementation context is transmitted.

Implementation lanes should be launched from canonical docs plus exact scope, then use support artifacts as additional evidence.

## Program Topology

### 1. Control Group

Keep this to **4-6 agents max**.

Responsibilities:
- own the canonical migration board and gate status
- own `smith_LOAD_ORDER.txt` / bundle load-order changes
- own the parity harness and result schema
- own the `emit.js` switchover and rollback point
- own final merge/reconciliation when parallel work converges

This group should be the only group touching:
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit/finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- any shared orchestration docs / migration board

Suggested roles:
- program lead
- harness owner
- load-order owner
- switch/rollback owner
- coverage/reconciliation owner
- release gatekeeper

### 2. Subsystem Owners

Use **one write-enabled owner per subsystem**.

These owners absorb findings from many verification agents, fix drift in their slice, and avoid conflicting edits inside the same file cluster.

### 3. Verification Support

Verification scales safely, but it should support end-to-end lanes rather than replace them.

The default model is:
- implementation lane owns code + local verification
- support verification lanes run breadth checks across many carts or feature buckets
- support lanes feed owning implementers, not separate follow-on coders

Use pure verification-only agents for:
- parity breadth
- coverage tagging
- split-output breadth checks
- live-risk audits

Do **not** use them as a substitute for narrowly-owned implementation contracts.

## Single-Owner Choke Points

These files should never be crowd-edited:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit/finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- [emit/split.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/split.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- [core.js](/home/siah/creative/reactjit/tsz/compiler/smith/core.js)
- [attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/attrs.js)
- [parse.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse.js)
- [attrs_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/element/attrs_dispatch.js)
- [press.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/handlers/press.js)

These need explicit owners because they are either:
- orchestration entrypoints
- bundle/load-order hubs
- shared API surfaces
- integration funnels touched by many downstream migrations

## Phase-by-Phase Orchestration

## Phase 0 — Control Plane Setup

### Focus group only

Parallelism:
- **2-4 agents**

Work:
- define parity harness contract
- define result schema and artifact names
- define ownership map for subsystem pods
- define lock list for hub files
- define coverage tags for carts

Outputs:
- `control_board.md`
- `coverage_matrix.json`
- `parity_result.json` schema
- ownership table

Do not fan out implementation before this is frozen.

## Phase 1a — Atom Parity Harness And Drift Triage

This phase splits into one narrow harness lane and one huge verification lane.

### Lane 1: Harness Owners

Parallelism:
- **1-2 agents**

Own:
- parity runner
- diff normalizer
- result schema
- split-output verification path

No other worker should edit the harness concurrently.

### Lane 2: Coverage Tagging Support

Parallelism:
- **4-8 agents**

Safe because:
- read-only
- output is per-cart tagging

Work:
- classify carts by lane and feature bucket
- identify carts hitting:
  - `lua_map`
  - `zig_map`
  - `nested_map`
  - `inline_map`
  - `dyn_text`
  - `handlers`
  - `effects`
  - `variants`
  - `split_output`

Outputs:
- `coverage_matrix.json`
- uncovered feature list

### Lane 3: Cart Parity Support

Parallelism:
- **10-20+ agents**

This is the best massive fan-out surface in the whole program, but it is support work.

Each worker owns:
- one cart or one small bucket of carts

Each worker outputs:
- cart path
- lane
- legacy hash
- atom hash
- diff status: `match` / `drift` / `build-break`
- first diff hunk
- split-output yes/no
- backend tags hit

### Lane 4: Atom-Group End-to-End Owners

Parallelism:
- **8-9 agents**

One owner per group:
- preamble: atoms 1-3
- state_tree: 4-8
- handlers_effects: 9-11
- object_arrays: 12-18
- maps_zig: 19-28
- maps_lua: 29-32
- logic_runtime: 33-38
- entry: 39-42
- split_finalize: 43-46

Each owner is responsible for the slice **end to end**:
- inspect drifts in their group
- patch atom and monolith-adjacent code in their owned scope
- wire any needed helper/import changes inside that scope
- run the required local verification
- report against the lane contract

Each owner writes only inside their group plus the directly compared monolith files.

### Lane 5: Live-Risk Auditors

Parallelism:
- **3-5 agents**

Safe isolated probes:
- `_jsExprToLua` collision and load-order winner
- `evalLuaMapData` propagation gaps
- atom 26 reachability and Zig-map cart coverage
- `mapBackend === 'lua_runtime'` skip behavior
- split/finalize calling-convention risk

These are excellent independent tasks for sidecar agents.

### Merge points

Need focused reconciliation by:
- harness owner
- coverage owner
- subsystem owners

Do not turn parity support runners into ad hoc coders. They feed owned implementation lanes.

## Phase 1b — Switch The Live Path

### Focus group only

Parallelism:
- **2-3 agents**

Own:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- build-meta extraction
- rollback posture
- any `finalizeEmitOutput` / split handoff changes

Why this must funnel:
- this is the compiler entrypoint
- it touches the live cutover
- mistakes here invalidate the entire parallel parity effort

Recommended roles:
- switch owner
- finalize/split owner
- release gatekeeper

No swarm editing here.

## Phase 1c + Phase 3 — Atom 26 And Zig Map Backend Activation

Treat this as a **focused pod**, not a broad swarm.

Parallelism:
- **3-5 agents**

Suggested pod layout:
- `a026 owner`
  Owns [a026_flat_map_rebuild.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/maps_zig/a026_flat_map_rebuild.js), atom registration, applies gate, and direct wiring.
- `maps_zig helper owner`
  Owns [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js) and the helper cluster under `emit_ops/`.
- `Zig-map verifier`
  Owns carts/fixtures that genuinely hit the Zig backend.
- `Lua-map compatibility verifier`
  Ensures atom 26 activation does not regress Lua-runtime map behavior.
- optional `coverage gap fixer`
  Adds or identifies missing parity fixtures if no cart cleanly exercises the path.

Why this should stay small:
- the maps_zig cluster is tightly coupled
- [rebuild_map.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/rebuild_map.js) is a central orchestrator
- a026, a027, a028, and helper files all share the same semantic state

This is not a good place for 10 concurrent writers.

## Phase 2 — Delete Legacy Emit Orchestration

This can fan out **after** the switch is stable.

Parallelism:
- **4-6 agents**

Safe ownership slices:
- `emit/preamble.js`
- `emit/state_manifest.js` + `emit/node_tree.js` + `emit/dyn_text.js`
- `emit/handlers.js` + `emit/effects.js`
- `emit/object_arrays.js`
- `emit/map_pools.js`
- `emit/logic_blocks.js` + `emit/runtime_updates.js`
- `emit/entrypoints.js`

Still single-owner:
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)
- any shared load/bundle manifest edits

This phase is a good cleanup fan-out because most deletions are file-local and low-conflict once the switch is complete.

## Phase 4 — Duplicate / Global Collision Cleanup

This phase parallelizes well, but one item must start early.

### Early focused item

`_jsExprToLua` collision:
- keep this under a **single owner** with control-group review
- it is a live correctness risk, not cosmetic cleanup

### Good parallel cleanup slices

Parallelism:
- **4-7 agents**

Disjoint worker scopes:
- `emit_ops/transforms.js` vs `emit/transforms.js`
- `emit_ops/effect_transpile.js` vs `emit/effect_transpile.js`
- `emit_ops/effect_wgsl.js` vs `emit/effect_wgsl.js`
- `emit_ops/js_expr_to_lua.js` vs `emit_atoms/maps_lua/lua_map_subs.js`
- load-order cleanup once winners are chosen

Merge points:
- load-order owner
- subsystem owner for affected atom group

## Phase 5 — Structural Cleanup And Reuse Extraction

This phase can eventually scale to **20+ active agents**, but only through exact vertical lane contracts.

The right model is hub-and-spoke with direct lane ownership, not free-for-all and not handoff chains.

### Contract owners

Parallelism:
- **4 agents**

Roles:
- `resolution owner`
  Owns [identity.js](/home/siah/creative/reactjit/tsz/compiler/smith/resolve/identity.js), [field_access.js](/home/siah/creative/reactjit/tsz/compiler/smith/resolve/field_access.js), new `resolve/const_oa.js`, new `resolve/state_access.js`, and moved `core.js` exports.
- `style/attrs core owner`
  Owns the new `parse/attrs/style_*` contracts and the import surface replacing [attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/attrs.js).
- `handler/eval owner`
  Owns handler capture/classification, runtime-eval classification, and the seam between parser/emitter consumers.
- `integration owner`
  Owns [parse.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse.js), [attrs_dispatch.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/element/attrs_dispatch.js), re-export/index files, and migration shims.

Do not fan out implementation until these contracts are frozen.

### Parallel leaf lanes

Parallelism:
- **8-12 agents**

Safe parallel leaf files under `parse/attrs/`:
- `color.js`
- `style_normalize.js`
- `style_expr_tokenizer.js`
- `style_expr_tokens.js`
- `style_expr_spec.js`
- `style_expr_parser.js`
- `style_expr_entry.js`
- `pending_style.js`
- `handler.js`
- `handler_lua.js`
- `value_expr.js`
- `value_expr_lua.js`

Why this is safe:
- mostly new-file creation
- low overlap if `attrs.js` itself remains owned by the style core owner

Each of these lanes should be contracted as:
- one worker
- one or more exact new files
- explicit helper/function ownership
- explicit import rewires
- local verification

### Parallel consumer lanes

Parallelism:
- **4-6 agents**

Safe boundaries:
- `parse/element/*`
- `parse/brace/*`
- `parse/children/*`
- [template_literal.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/template_literal.js)
- `collect/classifiers.js`

These can move in parallel once the imported contracts are frozen, and each lane must carry its own rewires to completion.

### Integration lanes

Parallelism:
- **2-3 agents**

Own:
- remove dead exports/shims from [attrs.js](/home/siah/creative/reactjit/tsz/compiler/smith/attrs.js)
- clean imports
- collapse temporary compatibility layers
- final parser conformance verification

### Hold Until Atom Migration Stabilizes

Do **not** parallelize these early:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js), [runtime_updates.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/runtime_updates.js), [entrypoints.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/entrypoints.js), [logic_blocks.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/logic_blocks.js), `emit_variant_patch.js`
- Lua-family sharing between cursor-based and AST-based codegen
- [build_node.js](/home/siah/creative/reactjit/tsz/compiler/smith/parse/build_node.js)
- [page.js](/home/siah/creative/reactjit/tsz/compiler/smith/page.js)
- [emit_lua_element.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_lua_element.js)

These sit on top of contracts that are still moving during earlier phases.

## Best High-Velocity Configuration

## Configuration A — Phase 1 Push

Use when the goal is to activate atoms quickly.

Active agents:
- 4-6 control-group owners
- 8-9 atom-group owners
- 10-20 cart parity runners
- 3-5 live-risk auditors

Total active agents:
- **25-40**

This is safe because most agents are either support verification or confined to one end-to-end atom-group lane.

## Configuration B — Post-Switch Cleanup

Use after `emit.js` has switched and rollback posture is established.

Active agents:
- 3-4 control-group owners
- 4-6 legacy deletion / duplicate cleanup workers
- 3-5 map-backend focused workers
- 4-8 verification workers

Total active agents:
- **14-23**

## Configuration C — Phase 5 Refactor Swarm

Use after atom migration stabilizes.

Active agents:
- 4 contract owners
- 8-12 leaf extraction workers
- 4-6 consumer rewire workers
- 2-4 verification workers

Total active agents:
- **18-26**

## Worker Artifact Contract

Every worker should return:
- owned files
- tests or checks run
- artifact produced
- blockers / upstream dependencies
- safe-to-merge vs needs-owner-review

Recommended artifacts:
- `parity_result.json`
- `coverage_matrix.json`
- `atom_group_status.md`
- `live_risks.md`
- per-subsystem drift reports

This is what keeps 20+ agents from degenerating into noise.

## Where Broad Parallelism Helps

- cart tagging
- parity runs across many carts
- atom-group drift triage
- file-local leaf extraction
- duplicate-pair cleanup
- targeted backend verification

## Where Broad Parallelism Hurts

- harness edits
- `emit.js` switch logic
- split/finalize calling conventions
- load-order changes
- `attrs.js` hub edits
- `core.js` export moves
- handler contract changes
- deciding whether a drift is cosmetic or real

## Recommended Execution Sequence

1. Freeze control-plane contracts and ownership.
2. Run massive verification fan-out for Phase 1a.
3. Let subsystem owners absorb drift and patch within their write scopes.
4. Funnel to the `emit.js` switch group.
5. After the switch stabilizes, fan out deletion and duplicate cleanup.
6. Only then open the large Phase 5 hub-and-spoke refactor swarm.

## Bottom Line

The migration can absolutely support **20+ active agents**, but only if the concurrency model is intentional:

- keep orchestration and hub files under a small control group
- keep one owner per subsystem write scope
- let verification scale almost without limit
- let structural refactors scale only after shared contracts freeze

High velocity comes from **many independent workers feeding a few explicit merge funnels**, not from letting everyone touch the same central files at once.

## Contract-Manifest Implication

The next document after this one should be a contract manifest, not a looser task board.

For every implementation lane, the contract manifest should specify:
- lane id
- exact owned files
- exact owned functions
- helper functions to add / move / remove
- exact import/export rewires
- files the lane must not edit
- local verification steps
- required completion artifact
- required report format

And it should also specify:
- canonical intent source(s) the agent must read directly
- exact code source(s) the agent must read directly
- explicit statement that the agent is not to infer mission-critical intent from prior agent summaries alone
- explicit statement that the lane is expected to run end to end without a downstream implementation relay

That contract manifest is what prevents stub work. An agent should be able to run directly from that contract to a merge-ready result without another implementation agent filling gaps afterward.
