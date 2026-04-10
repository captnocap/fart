# Smith Compiler Dictionary

Reference for the live Smith compiler at `tsz/compiler/smith/`.

## Architecture

```text
.tsz source
  -> Forge (Zig host, ~595 lines across 6 modules)
     - resolves imports and merges source
     - lexes merged source into flat token triplets
     - sets QuickJS globals (__source, __tokens, __file, __scriptContent, __clsContent, flags)
     - calls Smith compile(), smithCheck(), or sourceContract()

  -> Smith (JS compiler, ~45,559 lines across 366 files in 49 directories)
     - authored lanes: soup / mixed / intent-abstract (`chad` in current code labels)
     - internal implementation branches: soup / module-build / legacy-page-compat / intent-block / legacy-app-fallback
     - coarse source-family heuristic (`_sourceTier`): soup / mixed / chad
     - collection + parse fill ctx
     - preflight validates ctx
     - contract mode returns a JSON source-contract snapshot before emit
     - emit returns Zig + LUA_LOGIC (default) or split-output payloads

  -> Forge
     - stamps integrity header for build mode
     - writes generated output or `source_contract_<stem>.json`
```

QuickJS does not resolve runtime imports. Forge embeds one generated Smith bundle from `smith_LOAD_ORDER.txt`.

## Active Layout

All Smith source lives under `tsz/compiler/smith/`:

### Root files (11 files, ~2,545 lines)

| File | Role |
|------|------|
| `index.js` | Entry point: `compile()`, `sourceContract()`, `smithCheck()`, `stampIntegrity()`, `compileMod()`, `compileModLua()`, `compileModJS()` |
| `core.js` | Shared cursor helpers, ctx reset, slot helpers, runtime-log wrappers |
| `rules.js` | Token enums, style keys, color tables, soup constants |
| `attrs.js` | Thin entry surface — delegates to `parse/attrs/*.js` |
| `parse.js` | Public JSX coordinator: `parseJSXElement()`, `parseChildren()` |
| `parse_map.js` | Map entry: `tryParseMap()` |
| `emit.js` | Top-level emit coordinator |
| `page.js` | Legacy compat helper plus shared block parsers/lowerers reused by intent compilation; it is not the syntax authority for current named pages/apps/widgets |
| `validate.js` | Post-parse linting (Class A/B validation, runs before emit) |
| `logs.js` | Log dictionary — every log entry registered with ID and category |
| `debug.js` | Build-flag-activated debug output (`-c` flag) |

### Subdirectories

| Directory | Files | Lines | Role |
|-----------|-------|-------|------|
| `collect/` | 6 | ~1,329 | Collection pass: classifiers, components, state, script, render_locals |
| `contract/` | 6 | ~1,400 | Contract surfaces: Lua emit contracts plus `module_contract.js` for module-route source contracts |
| `emit/` | 10 | ~1,540 | Lua-tree emit pipeline: entry, preamble, nodes, logic, plus split output and effect transpile |
| `emit_atoms/` | 74 | ~7,700 | Structured codegen atoms organized by phase, including dedicated `module/` atoms for `.mod.tsz` block output plus intent timer / cleanup manifests (see Emit Atoms below) |
| `emit_ops/` | 24 | ~1,916 | Emit helpers: map decls, OA bridge, handler storage, text storage, pool nodes |
| `lanes/` | 7 | ~686 | Dispatcher branching + shared source-family heuristic assignment |
| `mod/` | 12 | ~2,400 | Module emit helpers: compatibility block compiler plus intent-module normalization/inference helpers, expr/statement lowering, pointer inference, and block/function emit support |
| `parse/` | 55 | ~10,614 | JSX/map/element parsing (see Parse below) |
| `patterns/` | 141 | ~12,273 | JSX pattern recognizers across 18 categories |
| `preflight/` | 4 | ~617 | Route scan, pattern atoms, routing check, context |
| `resolve/` | 8 | ~642 | Expression resolution: comparison, const_oa, eval_builder, field_access, identity, state_access, ternary, truthiness |

## Bundle Model

- **Manifest:** `smith_LOAD_ORDER.txt`
- **Bundle builder:** `smith_bundle.zig`
- **Sync scanner:** `smith_sync.zig`
- **Generated bundle:** `compiler/dist/smith.bundle.js`

Commands:

```bash
zig build smith-sync      # verify manifest coverage
zig build smith-bundle    # rebuild bundle
zig build forge           # rebuild forge (embeds bundle)
./scripts/contract path/to/app.tsz   # capture source contract JSON without emit/build
./zig-out/bin/forge contract path/to/app.tsz
```

All native Zig tools. No Node runtime required.

## Contract Validation Pipeline

The compiler has a three-stage gate between parse and emit:

```text
Parse → Contract (luaNode tree)
           ↓
       Sanitize (JS→Lua conversion — single source of truth)
           ↓
       Validate (stop build if contract is broken)
           ↓
       Emit (Zig + LUA_LOGIC)
```

### Sanitizer (`contract/sanitize_for_lua.js`)

**The ONLY place that converts JS operators to Lua.** Runs on the entire luaNode tree before emit sees it. Handles:

- JS operators: `||` → `or`, `&&` → `and`, `!==` → `~=`, `!` → `not`
- JS ternary: `a ? b : c` → `(a) and b or c`
- JS comments: `//` → `--`
- JS string concat: `+` → `..` (when string operands detected)
- JS `.length` → Lua `#`
- Zig builtins: `@as()`, `@intCast()`, `@floatFromInt()` → stripped
- Zig `std.mem.eql` → Lua `==`/`~=`
- Zig `if/else` → Lua `and/or`
- Colors: `#hex` → `0xhex`, `Color.rgb()` → `0xhex`, `Color{}` → `0x000000`
- Zig enums: `.row` → `"row"`
- Bitwise: `&`/`|`/`^`/`>>`/`<<` → `bit.*`

No emit atom should perform these conversions. If you see an operator leak in generated Lua, fix the sanitizer — not the emit atom.

### Validator (`contract/sanitize_for_lua.js` → `validateContract()`)

Walks the contract tree and checks for:

- **JSX contamination**: close tags (`</Text>`, `</Box>`) in any string field
- **Unparsed JSX**: `<` in condition expressions
- **JS operators in text**: `||`, `&&`, `!==` that survived sanitization
- **Unresolved props**: `props.` references that weren't inlined
- **Zig builtins**: `@intCast`, `@as()`, `state.getSlot` that weren't converted

If validation finds errors, forge returns `__CONTRACT_FAIL__` and exits with code 1. **The build stops.** No Zig compilation, no linking, no wasted time.

### Final Gate (`emit/lua_tree_nodes.js`)

After emit assembles the LUA_LOGIC string, a final pass catches any operators that slipped through emit's own string assembly (e.g. handler concat, text fallback chains). Protects `__eval()` and `js_on_press` strings from conversion since those run in QJS, not Lua.

## Build Script Integration

`scripts/build` runs after forge:

1. **Snapshot** (`ZIGOS_WITNESS=snapshot`): runs binary headless, collects all rendered text + clicks every pressable node, writes `.autotest` file
2. **Contract check**: runs `forge contract`, checks for JSX contamination
3. **DB record**: writes expect/click counts, node health metrics, contract status to `conformance.db` snapshots table

The autotest detects broken output:
- `nil` in rendered text → FAIL (Lua expression returned nil)
- `\x01` in rendered text → FAIL (unresolved glyph placeholder)
- `__marker__` in rendered text → FAIL (internal marker leaked)

Query snapshot health:
```sql
SELECT test_name, expect_count, click_count, node_count, contract_clean
FROM snapshots ORDER BY snapped_at DESC;
```

## Lanes, Branches, and Heuristics

Authoritative authored lanes:

- `soup` — HTML/DOM soup sources handled by the dedicated soup compiler path.
- `mixed` — legacy JSX/framework-primitive sources handled by the old `App` fallback path.
- `intent-abstract` — the intent dictionary lane. In current code and historical naming this often appears as `chad`.

Intent-abstract subpaths:

- Named UI/data blocks such as `<my app>`, `<home page>`, `<weather widget>`, `<button component>`, `<backend lib>`, `<lava effect>`, and `<icon glyph>` are all forms inside the intent-abstract lane.
- Named modules (`<engine module>`) are also intent-abstract syntax, but module builds fork into the module contract/build path because they emit a different target surface.
- These are not peer top-level lanes. They are lane-local forms specific to the intent-abstract lane.

Internal implementation branches in the current dispatcher:

- `soup` branch — `isSoupLaneSource(source, file)` matched.
- `module-build` branch — `globalThis.__modBuild === 1`; used for `.mod.tsz` compilation targets.
- `legacy-page-compat` branch — `isPageLaneSource(source)` matched on the old `<page ...>` wrapper path still present in Smith.
- `intent-block` branch — `isChadBlockSource(source)` matched on named intent blocks.
- `legacy-app-fallback` branch — `compileAppLane(...)` when none of the earlier branches matched.

Coarse source-family heuristic (`_sourceTier`):

- `detectSurfaceTier()` in `lanes/shared.js` returns only `soup`, `mixed`, or `chad`.
- This is coarse metadata used by preflight, route planning, and source-contract payloads.
- `chad` here means the intent-abstract family.
- `_sourceTier` is not the authoritative lane model and should not be read as ownership of syntax.
- The module build route currently emits `sourceTier: "module"` in `lanes/module.js` source-contract payloads. That is route-local contract metadata, not part of the shared three-lane model.

Important clarity rule:

- `page.js` is not its own authored lane.
- `page.js` is not the syntax authority for current pages.
- Current dictionary pages/apps/widgets belong to the intent-abstract lane and are routed through the intent-block branch.
- The separate `page` branch exists only as leftover compat plumbing for an older wrapper surface, which is exactly why it feels islanded.

## Compile Flow

### Entry

`index.js` owns:

- `compile()` -> reads Forge globals, calls `compileLane(source, tokens, file)`
- `sourceContract()` -> toggles contract-only mode, then runs `compileLane(...)`
- `smithCheck()` -> predicts route plan / atom chain without parse+emit
- `stampIntegrity(out)` -> prefixes generated output before Forge finalizes body hash
- `compileMod()` / `compileModLua()` / `compileModJS()` -> module emit entrypoints; `compileMod()` consults the module contract path first, then falls back to the legacy line-mode transpiler only when contract-backed emit cannot take the source

Forge front-door commands:

- `forge build <file.tsz>` -> full compile path through emit and generated Zig
- `forge check <file.tsz>` -> route scan / predicted atom report only
- `forge contract <file.tsz>` -> parse + preflight + source contract JSON, no emit

### Mixed lane branch

`lanes/app.js` is the mixed-lane fallback JSX pipeline for function-style `App` sources and similar mixed-era input. It is not the current intent `<name app>` syntax path.

1. `mkCursor(tokens, source)`
2. `resetCtx()`
3. `assignSurfaceTier(source, file)`
4. `collectCompilerInputs(c)`
5. `findAppStart(c)`
6. `collectRenderLocals(c, appStart)`
7. `moveToAppReturn(c, appStart)`
8. `parseJSXElement(c)`
9. `finishParsedLane(root.nodeExpr, file, opts)`

### Legacy page compat branch

`lanes/page.js` handles the legacy compat page-wrapper path and delegates to `page.js`.

Important boundary:

- This branch is not the authoritative dictionary page syntax.
- The current dictionary page surface is named-block form: `<home page> ... </home>`.
- Named pages therefore enter through `lanes/chad.js`, not `lanes/page.js`.
- `page.js` still contains stale compat assumptions such as old `<page ...>` matching and legacy `<timer>` support. Those are implementation leftovers, not current language truth.

### Module build branch

`lanes/module.js` is the build-target branch for `.mod.tsz` compilation and now builds module-route source-contract state first:

- `contract/module_contract.js` owns `module-contract-v1` for all `.mod.tsz` sources.
- `lanes/module.js` attaches `moduleContract` to `source-contract-v1` payloads.
- `index.js` asks the module-contract layer for an emit path before any legacy fallback.
- `mod/index.js` consumes compatibility block contracts (`<module name>`) and builds the emit ctx from contract data instead of re-extracting blocks during dispatcher branching.
- `mod/intent_types.js` and `mod/intent_functions.js` normalize active dictionary modules (`<name module>`) into the older atom-fed block surface without collapsing everything into one god file.

Exact syntax audit:

- Active dictionary module syntax is intent-style `<name module> ... </name>` with `<uses>`, per-library `<libname ffi>`, `<var>` using `set_` for reactive state, and block control flow inside `<functions>` (`<if>`, `<for>`, `<while>`, `<switch>`, `<during>`). This is the syntax described in `tsz/docs/INTENT_DICTIONARY.md`.
- Compatibility block-module syntax is `<module name> ... </module>` with `<imports>`, `<ffi>`, `<const>`, `<state>`, and line-oriented function bodies. This is a compiler-owned compatibility surface used by the current layout/module atom path. It is not the primary dictionary contract.
- The legacy line-by-line transpiler in `index.js` is a TS/JS imperative compatibility path. It is not intent-module codegen.
- `contract/module_contract.js` now emits explicit module-route contract data for both surfaces:
  - compat block modules: `sections`, raw block bodies, compat ffi/state/function summaries
  - intent named modules: `sections`, `uses`, `ffi`, `types`, `vars`, `functions`, `topLevelDurings`, `legacyExtensions`, `unsupportedForEmit`
- `unsupportedForEmit` on intent contracts is no longer a placeholder. It now reflects the same safe-subset support gate used by the named-module emitter (`assessIntentModuleSupport(...)` + `buildIntentModuleEnv(...)`).
- `preflight/intent_patterns.js` remains source-contract metadata only. It does not itself provide final Zig emit for active intent modules.

Live compatibility block-module path:

- `contract/module_contract.js` detects module surface, extracts balanced top-level sections, and normalizes them into `module-contract-v1`.
- `mod/index.js` resets per-module globals, reads `contract.blocks.imports|ffi|types|consts|state|functions`, builds a module ctx, then dispatches to `runModuleEmitAtoms(ctx, meta)`.
- `emit_atoms/module/index.js` is the block-module atom orchestrator. It owns the ordered pass through banner, preamble, imports, ffi, types, consts, state, and functions.
- `emit_atoms/module/a055_module_intent_timers.js` emits the `SmithEvery` manifest for `name every N:` functions accepted by the intent-module path.
- `emit_atoms/module/a056_module_intent_cleanup.js` emits the `SmithCleanup` manifest for `name cleanup:` pairs accepted by the intent-module path.
- `mod/helpers.js` owns shared imperative helpers: range parsing, top-level statement splitting, ternary classification, null-guard tracking, pointer-call detection, loop-substitution support, and Zig-keyword-safe function call rewriting.
- `mod/expr.js` owns Zig expression lowering for module code: type/default transpile, struct literals, ambient `math.*` lowering, field-aware `.length`/`.count` preservation versus collection `.len`, keyword escaping, call-argument ternaries, parenthesized ternaries, and known function-call rewrites.
- `mod/params.js` owns param parsing plus pointer-param inference for mutating module functions.
- `mod/statements.js` owns imperative statement lowering: mutable local detection, addressable local lifting, inline statement ternaries, inline one-line loops, assignment normalization, and local-type capture for typed imperative declarations.
- `mod/functions.js` owns function splitting plus recursive block lowering for `if`-style ternaries, `while`, `for ... as ... at ...`, `switch`, multi-line struct init bodies, branch-local scope isolation, and Zig-safe function identifier emission.

Current active intent-module status:

- `forge contract --mod` now reports a real module contract for named modules such as `query.mod.tsz` and `engine.mod.tsz`.
- Build-mode emit is now contract-backed for a safe subset of active named modules. Verified contract-backed outputs currently include conformance modules such as `connection.mod.tsz`, `http.mod.tsz`, `text.mod.tsz`, `measure.mod.tsz`, `flex.mod.tsz`, and `playback.mod.tsz`.
- The named-module safe subset currently accepts: `<uses>`, per-lib `<ffi>`, struct/enum/union `<types>`, top-level `<var>` with `set_`, block control flow inside `<functions>`, conditional binding (`<if ... as name>` / `<while ... as name>`), cleanup pairs, and timer manifests.
- Intent modules still fall back when the support gate sees surfaces the current normalizer cannot lower exactly. The current explicit buckets are:
  - `top-level-during`
  - `legacy-state-block`
  - `multiple-functions-blocks`
  - `function-hatch`
  - `collection-helper`
  - `function-composition`
  - `string-switch-case`
  - `dynamic-var-collection`
  - `nested-has-var:<name>`
- Example: `socket.mod.tsz` still reports `unsupportedForEmit = ["collection-helper", "dynamic-var-collection"]` and therefore falls back to the older legacy line-mode transpiler.
- Remaining drift is now mostly semantic inference inside the contract-backed path, not routing. The ambient math path, scoped-local emission, field-aware `.length` preservation, Zig-keyword function names, and terminal-expression return inference for branchy helper functions are now wired through the source-contract-backed emitter. The current weak spots are still parameter/field typing in more complex modules plus some emitted Zig expressions around optional/value semantics, but those are generator-quality gaps rather than missing source-contract or routing seams.

### Soup lane branch

`lanes/soup/index.js` — separate compiler path with its own tokenizer, tree builder, and emitter.

### Intent block branch

`lanes/chad.js` — named intent-block compiler. Handles `<name widget|page|app|component|lib|effect|glyph>` sources, including the current dictionary page/app/widget entry syntax, `<if>/<else>/<during>/<For>` in JSX, data blocks, type variants, glyph shortcodes, ambient namespaces, and computed field resolution.

Timer note:

- Current scheduled-function syntax is `name every N:` inside `<functions>`, per `tsz/docs/INTENT_DICTIONARY.md`.
- Smith still carries legacy `<timer>` parsing in shared page helpers, but that is compatibility behavior, not the active dictionary contract.

### Finish path

`lanes/shared.js` owns `finishParsedLane()`:

1. `preflight(ctx)` — via `validate.js`
2. `preflightErrorZig(...)` on failure
3. `buildSourceContractSnapshot(nodeExpr, file)` when `__SOURCE_CONTRACT_MODE === 1`
4. `emitOutput(nodeExpr, file)` on success in normal build mode
5. `stampIntegrity(...)` unless split output already bypassed wrapping

Contract output shape:

- Versioned JSON snapshot: `source-contract-v1`
- Written by Forge to `/tmp/tsz-gen/source_contract_<stem>.json` by default
- Includes: `inputPatterns`, `routePlan`, `preflight`, `rootExpr`, `luaRootNode`, `luaMapRebuilders`, `stateSlots`, `objectArrays`, `maps`, `handlers`, `dynTexts`, `scriptBlock`, and compiler debug buckets

## Parse (55 files, ~10,614 lines)

| Subdir | Files | What |
|--------|-------|------|
| `attrs/` | 15 | Style parsing: color, handler, pending_style, style_block, style_expr (tokenizer/parser/spec/tokens/entry), style_normalize, style_ternary, style_value, value_expr, value_expr_lua |
| `brace/` | 2 | Brace expression parsing: conditional, ternary |
| `children/` | 9 | Child node parsing: brace, brace_computed, brace_maps, brace_render_local, brace_util, chained_expr, conditional_blocks, elements, inline_glyph, text |
| `element/` | 15 | Element parsing: attrs (basic/canvas/dispatch/handlers/spatial/text_color), component (brace_values/handlers/inline/props/spread), defaults, flow, postprocess, tags, value_readers |
| `handlers/` | 1 | Handler parsing: press |
| `map/` | 7 | Map parsing: context, for_loop, header, infer_oa, info, nested, plain |
| root | 4 | build_node, cursor, template_literal, utils |

## Emit Atoms (72 files, ~7,498 lines)

Structured Zig codegen organized into numbered phases:

| Phase | Atoms | What |
|-------|-------|------|
| Preamble (a001-a003) | compile_banner, core_imports, runtime_imports | File header and imports |
| State tree (a004-a008) | state_manifest, init_state_slots, static_node_arrays, root_node_init, dynamic_text_buffers | State slots and node arrays |
| Handlers/effects (a009-a011) | non_map_handlers, cpu_effect_renderers, wgsl_effect_shaders | Event handlers and GPU effects |
| Object arrays (a012-a018) | qjs_bridge, oa_string_helpers, oa_const_storage, oa_dynamic_storage, oa_flat_unpack, oa_nested_unpack, variant_host_setter | SoA data backing |
| Maps Zig (a019-a028) | map_metadata, flat/nested/inline pool decls, per_item_arrays, map_dynamic_text_storage, map_handler_ptrs, flat/nested/inline rebuild | Zig-side map infrastructure |
| Maps Lua (a029-a032+) | lua_map_wrapper_registration, lua_map_rebuilder_functions, lua_nested_helpers, lua_map_master_dispatch + 11 lua_map/lua_text helpers | LuaJIT map logic |
| Logic/runtime (a033-a038) | js_logic_block, lua_logic_block, dynamic_text_updates, conditional_updates, variant_updates, runtime_dirty_tick | Runtime update logic |
| Entry (a039-a042) | app_init, app_tick, app_exports, app_main | Application lifecycle |
| Split/finalize (a043-a046) | split_section_extraction, split_namespace_prefixing, split_module_headers, finalize_postpass | Multi-file output |
| Module (a047-a056) | module_banner, module_preamble, module_imports, module_ffi, module_types, module_consts, module_state, module_functions, module_intent_timers, module_intent_cleanup | `.mod.tsz` block output routed through split atoms instead of a single god-file emitter |

## Patterns (141 files, ~12,273 lines)

JSX pattern recognizers across 18 categories:

`array_construction`, `children`, `component_ref`, `composition`, `conditional_rendering`, `events`, `filter_sort`, `hooks`, `keys`, `logical`, `map`, `misc_jsx`, `primitives`, `props`, `strings`, `style`, `ternary`, `type_narrowing`

Each pattern file recognizes a specific JSX/TS pattern and maps it to the compiler's internal representation. Preflight uses `patterns/index.js` to register and match patterns during route scan.

## ctx: Important State

`core.js` owns `ctx` and `resetCtx()`.

| Field | Meaning |
|-------|---------|
| `stateSlots` | Scalar state slots: `{ getter, setter, initial, type }` |
| `components` | Collected component bodies and slot metadata |
| `handlers` | Handler metadata for Zig / JS / Lua dispatch |
| `dynTexts` | Runtime text buffers and node targets |
| `dynColors` / `dynStyles` | Runtime-updated colors and styles |
| `objectArrays` | SoA backing for mapped data |
| `maps` | Map templates and rebuild metadata |
| `arrayDecls` / `arrayComments` / `arrayCounter` | Static node-array build state |
| `scriptBlock` / `scriptFuncs` | JS logic payload and callable names |
| `classifiers` | Loaded classifier definitions |
| `renderLocals` | Pre-return locals eligible for JSX substitution |
| `_sourceTier` | Coarse source-family heuristic label: `soup`, `mixed`, or `chad` (`chad` = intent-abstract family) |
| `_preflight` | Cached preflight result consumed by emit |
| `_needsRuntimeLog` / `_runtimeLogCounter` | Generated Zig logging support bookkeeping |

## Lua-Tree Emit Pipeline

Smith emits `LUA_LOGIC` by default for app UI and handlers. The lua-tree pipeline:

| File | Role |
|------|------|
| `emit/lua_tree_entry.js` | Entry coordinator for lua-tree emit |
| `emit/lua_tree_preamble.js` | Lua preamble: require statements, state bridge |
| `emit/lua_tree_nodes.js` | Node stamping: Lua tables -> Zig Node graph |
| `emit/lua_tree_logic.js` | Runtime logic: handlers, state updates, conditionals |
| `emit/lua_tree_emit.js` | Final Lua string assembly |
| `contract/emit_contract.js` | Three-phase contract: collect, validate, emit |
| `contract/node_contract.js` | Node identity and ref contracts |
| `contract/sanitize_for_lua.js` | Zig->Lua string sanitization |

`.map()` handlers become Lua functions like `__mapPress_0_0(idx)` with `lua_on_press` strings baked per item. `<script>` blocks add `JS_LOGIC` on QuickJS; `__eval` / `evalLuaMapData` also use QuickJS from Lua.

## Archive Boundary

Frozen compiler code lives outside `tsz/`:

- `archive/frozen-compilers/smith-prepromotion/`
- `archive/frozen-compilers/zig-reference/`
- `archive/compiler-dead-code.zip` (v4_reference, migration, dead code)

Rules:

- Do not add new active compiler work under `archive/`
- If behavior changes, update the active files under `tsz/compiler/smith/`
