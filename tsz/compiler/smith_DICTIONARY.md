# Smith Compiler Dictionary

Reference for the live Smith compiler at `tsz/compiler/smith/`.

## Architecture

```text
.tsz source
  -> Forge (Zig host, ~595 lines across 6 modules)
     - resolves imports and merges source
     - lexes merged source into flat token triplets
     - sets QuickJS globals (__source, __tokens, __file, __scriptContent, __clsContent, flags)
     - calls Smith compile()

  -> Smith (JS compiler, ~43,200 lines across 354 files in 48 directories)
     - entry-lane dispatch: soup / module / page / app
     - surface-tier scan: soup / mixed / chad
     - collection + parse fill ctx
     - preflight validates ctx
     - emit returns Zig + LUA_LOGIC (default) or split-output payloads

  -> Forge
     - stamps integrity header
     - writes generated output
```

QuickJS does not resolve runtime imports. Forge embeds one generated Smith bundle from `smith_LOAD_ORDER.txt`.

## Active Layout

All Smith source lives under `tsz/compiler/smith/`:

### Root coordinators (11 files, ~2,536 lines)

| File | Role |
|------|------|
| `index.js` | Entry point: `compile()`, `stampIntegrity()`, `compileMod()`, `compileModLua()` |
| `core.js` | Shared cursor helpers, ctx reset, slot helpers, runtime-log wrappers |
| `rules.js` | Token enums, style keys, color tables, soup constants |
| `attrs.js` | Thin entry surface — delegates to `parse/attrs/*.js` |
| `parse.js` | Public JSX coordinator: `parseJSXElement()`, `parseChildren()` |
| `parse_map.js` | Map entry: `tryParseMap()` |
| `emit.js` | Top-level emit coordinator |
| `page.js` | `<page>` block compiler: `<var>`, `<state>`, `<functions>`, `<timer>` |
| `validate.js` | Post-parse linting (Class A/B validation, runs before emit) |
| `logs.js` | Log dictionary — every log entry registered with ID and category |
| `debug.js` | Build-flag-activated debug output (`-c` flag) |

### Subdirectories

| Directory | Files | Lines | Role |
|-----------|-------|-------|------|
| `collect/` | 6 | ~1,329 | Collection pass: classifiers, components, state, script, render_locals |
| `contract/` | 3 | ~589 | Three-phase Lua emit contracts: emit_contract, node_contract, sanitize_for_lua |
| `emit/` | 10 | ~1,540 | Lua-tree emit pipeline: entry, preamble, nodes, logic, plus split output and effect transpile |
| `emit_atoms/` | 60 | ~7,247 | Structured codegen atoms organized by phase (see Emit Atoms below) |
| `emit_ops/` | 24 | ~1,916 | Emit helpers: map decls, OA bridge, handler storage, text storage, pool nodes |
| `lanes/` | 7 | ~686 | Entry-lane dispatch + surface-tier assignment |
| `mod/` | 10 | ~1,442 | `<module>` block compiler: expr, ffi, functions, types, state, imports |
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
```

All native Zig tools. No Node runtime required.

## Entry Lanes vs Surface Tiers

Entry lanes (which compiler path runs):

- `soup` — HTML/DOM soup compiler
- `module` — `.mod.tsz` block compiler
- `page` — `<page>` block compiler
- `app` — default JSX pipeline

Surface tiers (source shape):

- `soup` — copy-paste React, HTML tags, CSS hallucinations
- `mixed` — framework primitives with inline styles
- `chad` — intent dictionary syntax, classifiers, theme tokens

The entry lane decides which compiler path runs. The surface tier describes the source family. `module` is orthogonal to tiers. `soup` lane always produces `soup` tier. `page` lane usually carries `chad`-style source. `app` lane can scan as `mixed` or `chad`.

## Compile Flow

### Entry

`index.js` owns:

- `compile()` -> reads Forge globals, calls `compileLane(source, tokens, file)`
- `stampIntegrity(out)` -> prefixes generated output before Forge finalizes body hash
- `compileMod()` / `compileModLua()` -> line-based module transpilers

### App lane

`lanes/app.js` is the default JSX pipeline:

1. `mkCursor(tokens, source)`
2. `resetCtx()`
3. `assignSurfaceTier(source, file)`
4. `collectCompilerInputs(c)`
5. `findAppStart(c)`
6. `collectRenderLocals(c, appStart)`
7. `moveToAppReturn(c, appStart)`
8. `parseJSXElement(c)`
9. `finishParsedLane(root.nodeExpr, file, opts)`

### Page lane

`lanes/page.js` delegates to `page.js` which owns `<var>`, `<state>`, `<functions>`, `<timer>`, and `return(...)` extraction before normal JSX parsing.

### Module lane

`lanes/module.js` delegates to:

- Line mode in `index.js`
- Block mode in `mod/index.js` (10 files: expr, ffi, functions, helpers, imports, params, state, statements, types)

### Soup lane

`lanes/soup.js` — separate compiler path with its own tokenizer, tree builder, and emitter.

### Chad lane

`lanes/chad.js` — intent-dictionary compiler. `<if>/<else>/<during>/<For>` in JSX, data blocks, type variants, glyph shortcodes, ambient namespaces, computed field resolution.

### Finish path

`lanes/shared.js` owns `finishParsedLane()`:

1. `preflight(ctx)` — via `validate.js`
2. `preflightErrorZig(...)` on failure
3. `emitOutput(nodeExpr, file)` on success
4. `stampIntegrity(...)` unless split output already bypassed wrapping

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

## Emit Atoms (60 files, ~7,247 lines)

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
| `_sourceTier` | Explicit source tier: `soup`, `mixed`, or `chad` |
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
