# Middle Layer Contract Method

Generated: 2026-04-08

Purpose:
- The compiler already has pattern intake on one side and emit atoms / generated output on the other.
- The missing contract surface is the semantic middle: the exact compiler facts that must exist after intake and before emission.
- This document makes that middle layer explicit so migration work is not judged only by `pattern in` and `bytes out`.

## Architecture Reframe

The compiler should be understood as:
- ingest
- normalize
- realize

More explicitly:

1. pattern readers
2. contract
3. realization

That means:
- source syntax is not the source of truth
- the contract is the source of truth
- emitters and runtime bridges are realization backends over that contract

This matters because it demotes syntax to what it really is:
- an adapter layer

The system is therefore better described as:
- a UI contract engine with multiple ingestion syntaxes

not merely:
- a React-like compiler

## Core Thesis

The compiler is not:
- source pattern -> emitted Zig/Lua bytes

The compiler is:
- source pattern reader
- semantic middle record
- emitted Zig / emitted Lua / emitted JS / runtime bridge output

If the middle layer is not written down, each migration step is forced to reconstruct it from code and output. That is where drift hides.

## Three Stages

### 1. Pattern Readers

Pattern readers are dialect frontends.

They may read:
- React / JSX-like syntax
- soup syntax
- mixed syntax
- chad syntax
- intent syntax
- Python / tkinter-like syntax
- visual builder output
- LLM-authored structured input
- any future frontend that can be translated faithfully

Their job is only:
- recognize the input
- preserve the intended semantics
- translate those semantics into the contract

They are not the heart of the compiler.

### 2. Contract

This is the real source code in the machine-truth sense.

It is the canonical app description that realization backends should consume regardless of how the app was authored.

If two totally different frontends produce the same contract, then they are semantically equivalent for the purposes of the compiler.

That is the right place to judge correctness.

In practice, this means the contract is a set of values that are true for the node, host, map, handler, or runtime record being described.

Not every field is relevant for every node.

That is not a weakness. It is part of the truth.

### 3. Realization

Realization takes the contract and does what the system already does:
- emit Zig
- emit Lua
- emit JS
- wire runtime bridges
- stamp nodes
- route handlers
- route state
- build the runtime realization of the app

Realization should not have to rediscover meaning that the contract already knows.

This stage is expected to look more normalized than the source surface.

That is correct.

Once the contract has decided the semantics, realization is applying a normalized instruction set. The output can be "cookie cutter" at this stage without losing expressiveness, because the expressiveness was already captured by the contract.

### 3a. Backend Realization Question

This is the major intersection point the contract must eventually answer:

- does this app or slice have the necessary structure to realize as `lua-tree`
- or can it be finalized into a purely Zig-based runtime realization

Both paths still use the same framework behind the scenes.

The distinction is not:
- one path uses the framework
- the other path does not

The distinction is:
- what realization strategy is valid for the contract that step 2 produced

That means backend routing is a contract question, not a syntax question.

The reader does not decide this by dialect.
The emitter should not guess this late.
The contract should say it directly when the slice is mature enough to know.

Backend routing is also not a fuzzy late-stage discovery process.

When pattern readers encounter a pattern that is explicitly flagged for `lua-tree`, that hit should be carried into the contract as a hard routing fact.

In other words:
- did this app use a pattern flagged for `lua-tree`
- if yes even once, `lua_tree_required` becomes true for the app-level route unless an explicit narrower scope is defined

That makes pattern intake matter in the right way:
- not because syntax is the source of truth
- but because pattern readers are the earliest point where hard backend gates can be recorded faithfully

## Why This Matters

The current system already has the two edge catalogs:
- intake patterns in `smith/patterns/`
- output atoms in `smith/emit_atoms/`

What it does not yet have as a formal migration contract is:
- the exact semantic record those systems are supposed to agree on

Without that middle record, a migration can look correct for the wrong reason:
- the pattern match still fires
- the output still compiles
- but the compiler may have changed what it believes the node tree, literals, handlers, maps, or conditionals actually are

That is not a safe contract.

It also creates fake syntax fights.

If two frontends produce the same contract, then the syntax difference is not the architectural center of the system. The contract is.

## Contract Shape

Every migration contract should be written in three layers:

1. `pattern_in`
2. `middle_record`
3. `emit_out`

The contract is incomplete if any one of those layers is missing.

## Correctness Model

The clean correctness questions are:

1. Did the input pattern reader produce the right contract?
2. Did the contract contain the right semantics?
3. Did realization honor the contract?

When the engine is fixed and only the realization path changes, there is also a fourth practical question:

4. Did the same engine render the same visible result?

That is much stronger than asking:
- did the parser kind of understand the source
- did the emitter kind of reconstruct the meaning later

The first model is contract-driven.
The second model is drift-driven.

Another way to say it:
- step 1 is wide and syntax-bound
- step 2 is narrow and truth-bound
- step 3 is normalized and realization-bound

## Verification Layers

The migration should be judged through four layers:

1. `pattern in` correctness
2. `middle record` correctness
3. `realization` correctness
4. `visual result` correctness

In practical migration work this becomes:

1. contract parity
2. byte parity
3. visual parity
4. behavioral parity

These are not interchangeable.

- byte parity is a migration tool
- visual parity is product truth when the engine is unchanged

That means emitted code is allowed to get cleaner while rendered output is not allowed to drift.

For the exact visual-parity method, see [VISUAL_PARITY_METHOD.md](/home/siah/creative/reactjit/tsz/compiler/migration/contracts/VISUAL_PARITY_METHOD.md).

## 1. Pattern In

This is the source-side recognition surface.

A contract must name:
- the exact source syntax or fixture cart being used
- the exact pattern file or parser entrypoint that recognizes it
- the exact lane or tier involved: `soup`, `mixed`, `chad`, `mod`, or other explicit subsystem

Examples:
- `<Box><Text>hello</Text></Box>`
- `{items.map(item => <Text>{item.name}</Text>)}`
- `<Box color={flag ? 'red' : tone}>`
- inline `onPress={() => setOpen(true)}`

Important:
- this layer is allowed to vary dramatically across frontends
- correctness is not judged by syntax familiarity
- correctness is judged by whether the frontend produced the right middle record

## 2. Middle Record

This is the semantic compiler state that the input pattern must produce before any backend-specific serialization.

This is the most important layer.

This layer is the canonical app description.

This layer answers:
- what is true for this node
- what is not applicable for this node
- what behavior the source author intended regardless of syntax spelling

A contract must name the exact middle facts that matter for that pattern. Not every contract needs every field, but every contract must declare the fields it cares about.

### Core middle fields

- `pattern_in`
  - short name of the matched pattern
- `node_id`
  - stable node identity or node allocation target
- `parent_id`
  - parent or host attachment target
- `node_kind`
  - `Box`, `Text`, component instance, fragment, map host, conditional host, etc.
- `string_literals`
  - exact literal strings captured for text, labels, keys, template chunks
- `size_literals`
  - exact numeric/percent/enum size facts captured before emit
- `style_literals`
  - exact normalized style assignments, not raw source text
- `conditionals`
  - exact condition records, branch shape, truthy/falsy payload ownership
- `variants`
  - variant host binding, switch targets, active branches
- `handlers`
  - handler capture, backend classification, closure params, binding target
- `maps`
  - map kind, OA schema, iterator params, flat/nested/inline shape, backend choice
- `render_locals`
  - locals promoted during parse or map expansion
- `dyn_text`
  - dynamic text registration records and target bindings
- `dyn_style`
  - dynamic style registration records and target bindings
- `dyn_color`
  - dynamic color registration records and target bindings
- `runtime_bridges`
  - `evalLuaMapData`, `__eval`, JS/Lua handler shims, dirty tick participation
- `pattern_backend_flags`
  - backend-routing flags attached by matched patterns before realization: for example `lua-tree-hard-gate`, `zig-tree-safe`, or another explicit routing flag
- `realization_mode`
  - selected or permitted realization path for the slice: `backend-neutral`, `zig-tree`, `lua-tree`, `hybrid`, or another explicit mode
- `zig_tree_eligible`
  - whether the contract can be realized as a pure Zig tree/runtime for the owned slice
- `lua_tree_required`
  - whether the contract requires lua-tree realization for the owned slice
- `backend_reason_tags`
  - exact reasons for the routing decision: runtime map shape, eval dependency, script ownership, dynamic rebuild needs, or other explicit causes
- `emit_out`
  - the expected downstream emit sections or atom ids that consume this middle record

### Rules for middle fields

- Use normalized compiler facts, not raw source snippets, whenever the compiler already resolves them.
- If a field is not relevant for the contract, say `not applicable` instead of silently omitting it.
- If a field is produced by one file and consumed by another, the contract must name both ends.
- If a middle fact changes shape across Zig/Lua/JS backends, record the shared semantic fact first and the backend-specific rendering second.
- When backend routing is relevant, record it here as contract truth. Do not defer it to emitter guesswork.
- When a matched pattern carries a hard backend gate, preserve that flag here exactly. Do not downgrade it into a heuristic.

### Node Truth Rule

The middle record should be read as node truth, not syntax residue.

Example:
- the source may express a conditional in many different ways
- those are pattern-reader concerns
- the contract records whether a conditional exists for the node, what its branch structure is, and what payload it controls

The same rule applies to:
- handlers
- variants
- styles
- dynamic text
- maps
- runtime bridges

What matters is not how the source spelled the idea.
What matters is what became true for the node.

### Negative Applicability Rule

Knowing what a node does not have is as important as knowing what it does have.

Examples:
- `conditionals: not applicable`
- `handlers: not applicable`
- `maps: not applicable`
- `dyn_style: not applicable`

This keeps realization from inventing behavior later by guessing from incomplete records.

### Backend Routing Rule

When a contract is broad enough to make a backend decision, it should answer:
- `pattern_backend_flags`
- `realization_mode`
- `zig_tree_eligible`
- `lua_tree_required`
- `backend_reason_tags`

Examples:
- a slice may be `backend-neutral` because it is shared infrastructure
- a slice may be `zig-tree` eligible because all required semantics are statically realizable
- a slice may require `lua-tree` because the contract includes runtime-owned map behavior or script-eval dependencies that the pure Zig path does not own cleanly
- a whole app may require `lua-tree` because even one matched pattern carried a `lua-tree-hard-gate`

This is the point that explains why lua-tree methods existed in the first place.
They are not a separate universe. They are one realization answer to the same contract engine.

### Hard Gate Rule

Pattern flags can act as hard backend gates.

Example rule:
- if any matched pattern is marked `lua-tree-hard-gate`
- then the app-level contract records `lua_tree_required: true`
- and realization must honor that route

This is not a matter of emitter discovery.
It is a matter of contract truth established during intake and normalization.

## 3. Emit Out

This is the output-side obligation.

A contract must name:
- the exact atom ids, legacy emit functions, or helper files that consume the middle record
- the exact output sections expected from this record
- the target backend: `zig`, `lua_in_zig`, `js_in_zig`, `split`, or another explicit output class

Examples:
- `a006_static_node_arrays` consumes node allocation and normalized style facts
- `a030_lua_map_rebuilder_functions` consumes Lua map wrapper and map callback facts
- `a035_dynamic_text_updates` consumes registered dynamic text records

Important:
- realization should consume contract facts
- realization should not act like source syntax is still the primary truth

Realization is therefore a normalized output stage over contract facts, not a second semantic parser.

When backend routing is relevant, realization should also consume the route that the contract selected instead of rediscovering it from source patterns.

## Required Evidence In Every Contract

Every contract file under `migration/contracts/` must include:
- `Pattern In`
- `Middle Record`
- `Emit Out`
- `Canonical Sources`
- `Owned Files`
- `Verification Artifact`

If a contract only says "compare atom X to legacy function Y," it is not complete enough.

## Middle Record Writing Rule

The contract author must write the middle layer in compiler terms, not in vague prose.

Bad:
- "make sure text color works the same"
- "preserve map behavior"

Good:
- `style_literals.color` resolves to named color record when source is static
- `dyn_color` record is allocated when RHS resolves to runtime value
- `conditionals` owns the ternary branch set and feeds the color assignment payload
- `emit_out` includes atom 35 runtime updater if dynamic color registration occurs

## Contract Granularity Rule

Do not force one contract to describe the entire compiler middle layer at once.

Each contract should only write the middle facts required for its owned slice:
- preamble contracts mostly care about runtime bridge obligations and feature flags
- state-tree contracts care about node ids, root ownership, dyn-text buffers, state slots
- map contracts care about OA schema, iterator params, per-item promotion, nested ownership
- handler contracts care about capture source, backend classification, registration targets

## Verification Rule

Parity alone is necessary but insufficient.

A contract is only complete when it proves:
- the same input pattern is recognized
- the same middle facts are produced
- the same output surface is emitted from those facts

This means verification artifacts should eventually record more than string diffs. They should record middle-record evidence for the owned slice.

## Minimal Contract Template

```md
## Pattern In
- Fixture:
- Parser / pattern owner:
- Lane:

## Middle Record
- pattern_in:
- node_id:
- node_kind:
- string_literals:
- size_literals:
- style_literals:
- conditionals:
- handlers:
- maps:
- dyn_text:
- dyn_style:
- dyn_color:
- runtime_bridges:
- realization_mode:
- zig_tree_eligible:
- lua_tree_required:
- backend_reason_tags:
- emit_out:

## Emit Out
- Atom / legacy owner:
- Target backend:
- Expected section(s):

## Verification Artifact
- Path:
- Required proof:
```

## Immediate Migration Consequence

From this point on:
- a migration contract must not only say what files to compare and patch
- it must also say what semantic middle record that slice is responsible for preserving

That is the contract surface that closes the gap between:
- patterns in
- atoms out

## Future Frontends

This model creates clean future lanes.

Different frontends can evolve independently as long as they generate valid equivalent contracts:
- React-ish frontend
- intent frontend
- soup frontend
- Python-ish frontend
- visual builder frontend
- LLM-authored structured frontend

They all answer to the same standard:
- do they generate the right contract
- does realization honor that contract
