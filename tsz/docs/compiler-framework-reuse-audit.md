# Compiler + Framework Reuse Audit

Scope: `tsz/compiler` and `tsz/framework` only.

Goal: find duplicated logic and isolated function islands that should be consolidated into reusable seams, without changing runtime behavior.

## Executive findings

1. **Map conditional display logic is duplicated in multiple compiler paths** and partly duplicated again in extracted emit ops.
2. **Conditional-update emission has parallel implementations** (`runtime_updates` vs atomized path), creating drift risk.
3. **VM host-function registration is hand-wired in large blocks** in both LuaJIT and QuickJS runtimes; overlap is high for core host APIs.
4. **Framework C-ABI exports are repetitive thin wrappers**, ideal for table-driven or generated consolidation.
5. **Emit string-construction idioms repeat heavily** across map/dynamic text/handler formatting and should be normalized with a shared emit utility layer.

---

## Findings by area

## 1) Compiler: map condition wrapping and display toggles

### Evidence

- `wrapMapCondition` duplicated directly in:
  - `tsz/compiler/smith/emit_ops/emit_display_toggle.js`
  - `tsz/compiler/smith/emit/map_pools.js` (via map metadata ownership and references)
- Near-identical `.style.display = if ...` emission exists in:
  - `tsz/compiler/smith/emit_ops/rebuild_map.js`
  - `tsz/compiler/smith/emit/runtime_updates.js`
  - `tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js`
  - map atom files under `tsz/compiler/smith/emit_atoms/maps_zig/`

### Why this matters

- Bugs in truthiness/boolean wrapping are expensive and subtle (especially OA i64 truthiness, negation handling, and eval wrappers).
- A small semantic change must be repeated across multiple emitters and atom/ops variants.

### Reusable seam

- Promote one canonical condition-wrapping helper and one canonical display-toggle emitter primitive:
  - keep canonical helper in map metadata/util layer
  - consume from `rebuild_map`, `runtime_updates`, and atomized conditional emit paths

---

## 2) Compiler: duplicate conditional-update implementations

### Evidence

- `_updateConditionals` exists in:
  - `tsz/compiler/smith/emit/runtime_updates.js`
  - `tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js`
- Both perform branch-kind checks (`show_hide`, `ternary_jsx`) and display toggling.
- Behavior filters differ (e.g., map-array exclusions and expression guards), risking divergent generated Zig.

### Why this matters

- Two codepaths can silently diverge across features and tier lanes.
- Adds test burden and slows bugfix throughput.

### Reusable seam

- Single shared conditionals builder utility consumed by both owners, with feature flags for lane-specific exclusions.

---

## 3) Framework: host API registration duplication (QJS + LuaJIT)

### Evidence

- QuickJS runtime has a long manual registration block with many `JS_SetPropertyStr(... JS_NewCFunction(...))` calls in:
  - `tsz/framework/qjs_runtime.zig` (`initVM`)
- LuaJIT runtime registers host functions in a manual function table and loop:
  - `tsz/framework/luajit_runtime.zig` (`initVM`)
- Core APIs overlap conceptually (`__setState`, `__getState`, `__markDirty`, telemetry getters, input getters, logging).

### Why this matters

- Name/arity drift between runtimes can produce hard-to-diagnose cross-VM inconsistencies.
- Manual long-form registration is error-prone and hard to review.

### Reusable seam

- Introduce a shared host-function descriptor list (name, arity, intent tag, availability flags) and per-VM adapter registrars.
- Keep VM-specific functions in dedicated extension tables merged into the common registry.

---

## 4) Framework: repetitive C-ABI forwarding wrappers

### Evidence

- `tsz/framework/core.zig` contains many thin `export fn rjit_`* wrappers forwarding directly to module functions (state, theme, breakpoint, qjs/lua bridge, engine).

### Why this matters

- Boilerplate grows with every exposed API and increases mismatch risk with `api.zig` extern declarations.
- Review effort is high for low-value glue.

### Reusable seam

- Table-driven or comptime-generated ABI wrapper declarations for grouped namespaces (`state`, `qjs`, `lua`, etc.).
- Add a parity check utility ensuring `api.zig` and `core.zig` exported symbols stay aligned.

---

## 5) Compiler: emit string-builder patterns repeated across ops

### Evidence

- Repeated idioms in `emit_ops` and map emitters:
  - branch display lines
  - dynamic text formatting with `std.fmt.bufPrint`
  - per-item handler pointer formatting/wiring
  - map inner array assignment templates

### Why this matters

- Small formatting bugs (escaping/spacing/parentheses) reappear in multiple places.
- Refactors require broad synchronized edits.

### Reusable seam

- Shared emit utility module(s) for:
  - boolean-wrapped condition formatting
  - display assignment generation
  - common `bufPrint` line templates
  - scoped indentation helpers

---

## Prioritized refactor queue

## P0 (high impact, low-to-medium risk)

1. **Canonical map condition + display toggle utilities**
  - Targets:
    - `tsz/compiler/smith/emit_ops/emit_display_toggle.js`
    - `tsz/compiler/smith/emit_ops/rebuild_map.js`
    - `tsz/compiler/smith/emit/runtime_updates.js`
    - `tsz/compiler/smith/emit_atoms/logic_runtime/a036_conditional_updates.js`
  - Outcome: one source of truth for wrapped condition semantics and display-line emission.
2. **Shared host-function registry model for common APIs**
  - Targets:
    - `tsz/framework/qjs_runtime.zig`
    - `tsz/framework/luajit_runtime.zig`
  - Outcome: reduce drift in host API names/arity and simplify registration maintenance.
3. **Group and normalize `rjit_`* wrappers**
  - Targets:
    - `tsz/framework/core.zig`
    - `tsz/framework/api.zig` (parity check integration)
  - Outcome: less boilerplate and fewer bridge mismatch bugs.

## P1 (medium impact, medium risk)

1. **Unify `_updateConditionals` ownership path**
  - Either make atom path the sole builder, or runtime_updates the sole builder, but not both.
  - Keep compatibility shim during transition.
2. **Extract shared emit templating primitives**
  - Consolidate repeated Zig line-construction helpers for map and dynamic text emit code.
3. **Create compiler drift tests focused on condition wrapping**
  - Add golden tests for:
    - direct comparisons
    - truthy i64 expressions
    - negated expressions
    - `evalToString` conditions

## P2 (defer / intentional duplication candidates)

1. **VM-specific advanced host APIs**
  - Keep separate where runtime capabilities diverge significantly.
  - Consolidate only naming/schema, not behavior internals.
2. **Legacy/reference trees**
  - Avoid refactoring archived/reference emit paths unless actively used by current build lane.

---

## Suggested implementation slices (atomic)

1. **Slice A: condition utils hardening**
  - Move/alias `wrapMapCondition` into canonical helper module.
  - Make `emit_display_toggle` consume canonical helper only.
  - Add tests for wrapped condition output strings.
2. **Slice B: conditional updates convergence**
  - Introduce shared conditional line builder.
  - Switch both `_updateConditionals` emitters to shared builder.
  - Compare generated outputs on representative conformance carts.
3. **Slice C: host registry core**
  - Define common descriptor list for shared host functions.
  - Implement QJS registrar adapter over descriptor list.
  - Implement Lua registrar adapter over same list.
4. **Slice D: ABI wrapper consolidation**
  - Group repetitive `rjit_state_`* wrappers using a consistent macro/template approach.
  - Add automated check for `api.zig` extern parity vs `core.zig` exports.
5. **Slice E: emit template helpers**
  - Extract repeated emit string templates and indentation helpers.
  - Migrate map rebuild and runtime update emitters incrementally.

---

## Risk controls and verification

- Keep refactors behavior-preserving and slice-scoped.
- After each slice:
  - rebuild Forge when Smith JS changes
  - run targeted conformance carts stressing maps/conditionals/handlers
  - run carts using both Lua and JS runtime bridges where applicable
- Track generated output diff footprint to ensure no unintended structural changes.

---

## Backlog card template (for each candidate)

- **Candidate**:
- **Files**:
- **Duplication cluster**:
- **Proposed seam**:
- **Migration steps**:
- **Regression checks**:
- **Risk**:
- **Priority (P0/P1/P2)**: