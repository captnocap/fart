# Contract 0166-0190 — State Tree Parity

Purpose:
- This contract expands base steps `166-190` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the state-tree atom group.

Scope:
- Compare the live monolith state-tree emitters to atoms `a004` through `a008`.
- Patch only the atom files if any literal mismatch is found.
- Record the result in the state-tree status report and parity artifacts.

## Pattern In

- Reader-side syntax can vary. This contract uses [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz) and [lua_bridge_stress.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/lscript/lua_bridge_stress.tsz) only as concrete fixtures.
- The relevant reader output is the normalized tree/state surface: state slots, static node arrays, root expression, non-map dynamic texts, and JS eval count.
- This contract is therefore frontend-independent once those facts exist in `ctx` and `meta`.

## Middle Record

- `pattern_in`: app tree with stateful nodes, static node arrays, a root expression, and optional non-map dynamic text.
- `node_id`: root node plus any static node array identities referenced by `ctx.nodes`.
- `parent_id`: implicit tree ownership from the emitted root/static tree shape.
- `node_kind`: root node and static node array records.
- `string_literals`: dynamic text initial empty strings and emitted section headers.
- `size_literals`: `ctx.stateSlots.length`, dynamic buffer sizes, array lengths, and `_jsEvalCount`.
- `style_literals`: normalized style facts are already baked into static node expressions; this contract does not redefine them.
- `conditionals`: not applicable for this group.
- `variants`: not applicable for this group.
- `handlers`: not applicable for this group.
- `maps`: only relevant as exclusion for `a008`; this group owns non-map dyn text buffers.
- `render_locals`: not applicable.
- `dyn_text`: non-map dyn-text records with `bufId`, `bufSize`, and `inMap === false`.
- `dyn_style`: not applicable.
- `dyn_color`: not applicable.
- `runtime_bridges`: JS eval buffer count via `ctx._jsEvalCount`.
- `emit_out`: `a004` state manifest, `a005` slot init shell, `a006` static node arrays, `a007` root node init, `a008` dynamic text and eval buffer declarations.

## Emit Out

- Output owners: [a004_state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js), [a005_init_state_slots.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js), [a006_static_node_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js), [a007_root_node_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js), [a008_dynamic_text_buffers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js).
- Legacy compare surfaces: [state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js), [node_tree.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js), [dyn_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js).
- Target backend: `zig`.
- Expected realization:
  - `a004` realizes slot-count truth and slot type normalization.
  - `a005` realizes slot initialization calls.
  - `a006` realizes static node array storage.
  - `a007` realizes the normalized root node initializer.
  - `a008` realizes non-map dynamic text buffers and JS eval buffers.

Canonical intent sources:
- [state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js)
- [node_tree.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js)
- [dyn_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [a004_state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js)
- [a005_init_state_slots.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js)
- [a006_static_node_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js)
- [a007_root_node_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js)
- [a008_dynamic_text_buffers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js)

Owned files:
- [a004_state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js)
- [a005_init_state_slots.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js)
- [a006_static_node_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js)
- [a007_root_node_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js)
- [a008_dynamic_text_buffers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js)
- [state_tree_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/state_tree_status.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js)
- [node_tree.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js)
- [dyn_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz)
- [lua_bridge_stress.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/lscript/lua_bridge_stress.tsz)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [emit/finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)

Required artifacts:
- `tsz/compiler/migration/reports/sections/state_tree_status.md`
- `tsz/compiler/migration/reports/parity/state_tree_smoke_counter.json`
- `tsz/compiler/migration/reports/parity/state_tree_smoke_bridge.json` only if the primary report does not include atom `8`

Completion criteria:
- `a004` emits the same state-manifest header, slot comment format, bool type normalization, and comptime guard as the monolith
- `a005` emits the same `_initState()` shell and `createSlot*` lines as the monolith
- `a006` emits the same static array banner, promoted-skip logic, array comment insertion, and `__mt` stripping as the monolith
- `a007` emits the same `rootExpr` normalization and `_root` initializer as the monolith
- `a008` emits the same non-map dyn-text buffer declarations and JS eval buffer declarations as the monolith
- `state_tree_status.md` names the pattern/middle/emit grounding for this group and the exact result for atoms `a004` through `a008`
- the primary parity report exists and matches the parity schema
- the fallback parity report exists if the primary report did not exercise atom `8`

## Microsteps

- [ ] S001. Open [state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js) lines `3-24`.
- [ ] S002. Open [node_tree.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js) lines `3-13`.
- [ ] S003. Open [dyn_text.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js) lines `3-21`.
- [ ] S004. Open [a004_state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js) lines `11-35`.
- [ ] S005. Open [a005_init_state_slots.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js) lines `11-39`.
- [ ] S006. Open [a006_static_node_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js) lines `11-37`.
- [ ] S007. Open [a007_root_node_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js) lines `11-32`.
- [ ] S008. Open [a008_dynamic_text_buffers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js) lines `11-50`.
- [ ] S009. Open [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) lines `32-46`.
- [ ] S010. Open [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz) lines `3-12`.
- [ ] S011. Open [lua_bridge_stress.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/lscript/lua_bridge_stress.tsz) lines `19-25` and `66-99`.
- [ ] S012. Create `tsz/compiler/migration/reports/sections/state_tree_status.md` if it does not exist.
- [ ] S013. Write a heading `# State Tree Status` into `state_tree_status.md` if the file is new.
- [ ] S014. Add a line to `state_tree_status.md` stating that group 2 was read directly against `emit/state_manifest.js`, `emit/node_tree.js`, and `emit/dyn_text.js`.
- [ ] S015. Add a line to `state_tree_status.md` stating that [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) currently records group 2 as `MATCH`.
- [ ] S015A. Add the line `Grounding: reader syntax is adapter-only; middle truth is state slots + static nodes + root expr + non-map dyn text; emit ownership is a004-a008.` to `state_tree_status.md`.
- [ ] S016. Read [state_manifest.js#L4](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L4) and confirm the monolith returns `''` when `hasState` is false.
- [ ] S017. Read [a004_state_manifest.js#L13](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L13) and confirm the atom applies only when `ctx.stateSlots && ctx.stateSlots.length > 0`.
- [ ] S018. If [a004_state_manifest.js#L13](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L13) does not read `return ctx.stateSlots && ctx.stateSlots.length > 0;`, replace that line with the exact text `return ctx.stateSlots && ctx.stateSlots.length > 0;`.
- [ ] S019. Read [state_manifest.js#L5](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L5) and confirm the header string is `// ── State manifest ──────────────────────────────────────────────\n`.
- [ ] S020. Read [a004_state_manifest.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L18) and confirm the emitted header string matches the monolith header string exactly.
- [ ] S021. If [a004_state_manifest.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L18) differs, replace the entire `var out = ...` line with the exact text `  var out = '// ── State manifest ──────────────────────────────────────────────\\n';`.
- [ ] S022. Read [state_manifest.js#L7](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L7) and confirm the bool normalization line is `const typeLabel = s.type === 'boolean' ? 'bool' : s.type;`.
- [ ] S023. Read [a004_state_manifest.js#L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L20) and confirm the atom uses the same bool normalization rule.
- [ ] S024. If [a004_state_manifest.js#L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L20) differs, replace that line with the exact text `    var typeLabel = s.type === 'boolean' ? 'bool' : s.type;`.
- [ ] S025. Read [state_manifest.js#L8](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L8) and confirm the slot comment format is `// slot ${i}: ${s.getter} (${typeLabel})\n`.
- [ ] S026. Read [a004_state_manifest.js#L21](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L21) and confirm the atom emits the same slot comment format.
- [ ] S027. If [a004_state_manifest.js#L21](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L21) differs, replace that line with the exact text `    out += '// slot ' + i + ': ' + s.getter + ' (' + typeLabel + ')\\n';`.
- [ ] S028. Read [state_manifest.js#L10](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L10) and confirm the comptime guard string is `comptime { if (${ctx.stateSlots.length} != ${ctx.stateSlots.length}) @compileError("state slot count mismatch"); }\n\n`.
- [ ] S029. Read [a004_state_manifest.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L23) and confirm the atom emits the same comptime guard string.
- [ ] S030. If [a004_state_manifest.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js#L23) differs, replace that line with the exact text `  out += 'comptime { if (' + ctx.stateSlots.length + ' != ' + ctx.stateSlots.length + ') @compileError(\"state slot count mismatch\"); }\\n\\n';`.
- [ ] S031. Re-open [a004_state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js) and confirm the applies line, header line, bool normalization line, slot comment line, and comptime guard line all match steps `S018-S030`.
- [ ] S032. Read [state_manifest.js#L15](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L15) and confirm `_initState()` begins with `fn _initState() void {\n`.
- [ ] S033. Read [a005_init_state_slots.js#L14](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L14) and [a005_init_state_slots.js#L19](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L19) and confirm the atom applies with `return Array.isArray(ctx.stateSlots);` and uses the same function header string.
- [ ] S033A. If [a005_init_state_slots.js#L14](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L14) differs, replace it with the exact text `  return Array.isArray(ctx.stateSlots);`.
- [ ] S034. If [a005_init_state_slots.js#L19](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L19) differs, replace that line with the exact text `  var out = 'fn _initState() void {\\n';`.
- [ ] S035. Read [state_manifest.js#L17-L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L17-L20) and confirm the four create-slot lines are `createSlot`, `createSlotFloat`, `createSlotBool`, and `createSlotString`.
- [ ] S036. Read [a005_init_state_slots.js#L22-L25](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L22-L25) and confirm those four emitted lines match the monolith exactly.
- [ ] S037. If [a005_init_state_slots.js#L22](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L22) differs, replace it with `    if (s.type === 'int') out += '    _ = state.createSlot(' + s.initial + ');\\n';`.
- [ ] S038. If [a005_init_state_slots.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L23) differs, replace it with `    else if (s.type === 'float') out += '    _ = state.createSlotFloat(' + s.initial + ');\\n';`.
- [ ] S039. If [a005_init_state_slots.js#L24](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L24) differs, replace it with `    else if (s.type === 'boolean') out += '    _ = state.createSlotBool(' + s.initial + ');\\n';`.
- [ ] S040. If [a005_init_state_slots.js#L25](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L25) differs, replace it with `    else if (s.type === 'string') out += '    _ = state.createSlotString(\"' + s.initial + '\");\\n';`.
- [ ] S041. Read [state_manifest.js#L22](/home/siah/creative/reactjit/tsz/compiler/smith/emit/state_manifest.js#L22) and confirm the function terminator is `}\n\n`.
- [ ] S042. Read [a005_init_state_slots.js#L27](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L27) and confirm the atom uses the same terminator.
- [ ] S043. If [a005_init_state_slots.js#L27](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js#L27) differs, replace it with `  out += '}\\n\\n';`.
- [ ] S044. Re-open [a005_init_state_slots.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js) and confirm the applies line, function header, four `createSlot*` lines, and terminator all match steps `S033-S043`.
- [ ] S045. Read [node_tree.js#L4](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js#L4) and confirm the static-tree header string is `// ── Generated node tree ─────────────────────────────────────────\n`.
- [ ] S046. Read [a006_static_node_arrays.js#L13](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L13) and [a006_static_node_arrays.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L18) and confirm the atom applies with `return ctx.arrayDecls && ctx.arrayDecls.length > 0;` and uses the same static-tree header string.
- [ ] S046A. If [a006_static_node_arrays.js#L13](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L13) differs, replace it with the exact text `  return ctx.arrayDecls && ctx.arrayDecls.length > 0;`.
- [ ] S047. If [a006_static_node_arrays.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L18) differs, replace it with `  var out = '// ── Generated node tree ─────────────────────────────────────────\\n';`.
- [ ] S048. Read [node_tree.js#L6-L10](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js#L6-L10) and confirm the monolith uses `^var (_arr_\\d+)`, skips `promotedToPerItem`, emits `ctx.arrayComments[i] + '\n'` when present, and replaces `"__mt\\d+__"` with `""`.
- [ ] S049. Read [a006_static_node_arrays.js#L17-L24](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L17-L24) and confirm the atom uses the same promoted-set default, regex, skip rule, comment insertion, and replacement rule.
- [ ] S050. If [a006_static_node_arrays.js#L17](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L17) differs, replace it with `  var promotedToPerItem = meta.promotedToPerItem || new Set();`.
- [ ] S051. If [a006_static_node_arrays.js#L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L20) differs, replace it with `    var nm = ctx.arrayDecls[i].match(/^var (_arr_\\d+)/);`.
- [ ] S052. If [a006_static_node_arrays.js#L21](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L21) differs, replace it with `    if (nm && promotedToPerItem.has(nm[1])) continue;`.
- [ ] S053. If [a006_static_node_arrays.js#L22](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L22) differs, replace it with `    if (ctx.arrayComments && ctx.arrayComments[i]) out += ctx.arrayComments[i] + '\\n';`.
- [ ] S054. If [a006_static_node_arrays.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js#L23) differs, replace it with `    out += ctx.arrayDecls[i].replace(/\"__mt\\d+__\"/g, '\"\"') + '\\n';`.
- [ ] S055. Re-open [a006_static_node_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js) and confirm the applies line, promoted-set default, regex, skip rule, comment insertion, and replacement rule all match steps `S046-S054`.
- [ ] S056. Read [node_tree.js#L11-L12](/home/siah/creative/reactjit/tsz/compiler/smith/emit/node_tree.js#L11-L12) and confirm the monolith strips a leading dot from `rootExpr` before emitting `_root`.
- [ ] S057. Read [a007_root_node_init.js#L13](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js#L13) and [a007_root_node_init.js#L18-L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js#L18-L20) and confirm the atom applies with `return typeof meta.rootExpr === 'string' && meta.rootExpr.length > 0;` and uses the same `rootExpr`, `startsWith('.')`, and `Node` concatenation logic.
- [ ] S057A. If [a007_root_node_init.js#L13](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js#L13) differs, replace it with the exact text `  return typeof meta.rootExpr === 'string' && meta.rootExpr.length > 0;`.
- [ ] S058. If [a007_root_node_init.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js#L18) differs, replace it with `  var rootExpr = meta.rootExpr;`.
- [ ] S059. If [a007_root_node_init.js#L19](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js#L19) differs, replace it with `  var nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;`.
- [ ] S060. If [a007_root_node_init.js#L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js#L20) differs, replace it with `  return 'var _root = Node' + nodeInit + ';\\n';`.
- [ ] S061. Re-open [a007_root_node_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js) and confirm the applies line and the three logic lines from steps `S057-S060` are correct.
- [ ] S062. Read [dyn_text.js#L4-L5](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js#L4-L5) and confirm the monolith filters to `!dt.inMap` and returns `''` when no non-map dyn texts exist.
- [ ] S063. Read [a008_dynamic_text_buffers.js#L13-L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L13-L23) and confirm the atom applies when either a non-map dyn text exists or `ctx._jsEvalCount > 0`, and confirm `_a008_emit` begins by filtering `ctx.dynTexts` with `return !dt.inMap;`.
- [ ] S063A. If [a008_dynamic_text_buffers.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L23) differs, replace it with the exact text `  var nonMapDynTexts = ctx.dynTexts.filter(function(dt) { return !dt.inMap; });`.
- [ ] S064. If [a008_dynamic_text_buffers.js#L15](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L15) differs, replace it with `    if (!ctx.dynTexts[i].inMap) return true;`.
- [ ] S065. If [a008_dynamic_text_buffers.js#L17](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L17) differs, replace it with `  if (ctx._jsEvalCount && ctx._jsEvalCount > 0) return true;`.
- [ ] S066. Read [dyn_text.js#L7](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js#L7) and confirm the dyn-text header string is `\n// ── Dynamic text buffers ─────────────────────────────────────────\n`.
- [ ] S067. Read [a008_dynamic_text_buffers.js#L24](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L24) and confirm the atom uses the same dyn-text header string.
- [ ] S068. If [a008_dynamic_text_buffers.js#L24](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L24) differs, replace it with `  var out = '\\n// ── Dynamic text buffers ─────────────────────────────────────────\\n';`.
- [ ] S069. Read [dyn_text.js#L10-L11](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js#L10-L11) and confirm the monolith emits `var _dyn_buf_*` and `var _dyn_text_*` for each non-map dyn text.
- [ ] S070. Read [a008_dynamic_text_buffers.js#L28-L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L28-L29) and confirm the atom emits the same buffer and text declaration lines.
- [ ] S071. If [a008_dynamic_text_buffers.js#L28](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L28) differs, replace it with `    out += 'var _dyn_buf_' + dt.bufId + ': [' + bs + ']u8 = undefined;\\n';`.
- [ ] S072. If [a008_dynamic_text_buffers.js#L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L29) differs, replace it with `    out += 'var _dyn_text_' + dt.bufId + ': []const u8 = \"\";\\n';`.
- [ ] S073. Read [dyn_text.js#L16-L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit/dyn_text.js#L16-L18) and confirm the JS eval buffer section header and `_eval_buf_*` line.
- [ ] S074. Read [a008_dynamic_text_buffers.js#L34-L36](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L34-L36) and confirm the atom uses the same JS eval buffer section header and `_eval_buf_*` line.
- [ ] S075. If [a008_dynamic_text_buffers.js#L34](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L34) differs, replace it with `    out += '\\n// ── JS eval buffers (runtime expression results) ─────────────────\\n';`.
- [ ] S076. If [a008_dynamic_text_buffers.js#L36](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js#L36) differs, replace it with `      out += 'var _eval_buf_' + ei + ': [256]u8 = undefined;\\n';`.
- [ ] S077. Re-open [a008_dynamic_text_buffers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js) and confirm the applies logic, non-map filter line, dyn-text header, dyn-text declarations, JS eval header, and JS eval buffer line all match steps `S063-S076`.
- [ ] S078. Re-open `state_tree_status.md`.
- [ ] S079. Add one plain-text line to `state_tree_status.md` for `a004` stating `MATCH` if no patch was required, or `PATCHED` if any step from `S018-S030` changed the file.
- [ ] S080. Add one plain-text line to `state_tree_status.md` for `a005` stating `MATCH` if no patch was required, or `PATCHED` if any step from `S034-S043` changed the file.
- [ ] S081. Add one plain-text line to `state_tree_status.md` for `a006` stating `MATCH` if no patch was required, or `PATCHED` if any step from `S047-S054` changed the file.
- [ ] S082. Add one plain-text line to `state_tree_status.md` for `a007` stating `MATCH` if no patch was required, or `PATCHED` if any step from `S058-S060` changed the file.
- [ ] S083. Add one plain-text line to `state_tree_status.md` for `a008` stating `MATCH` if no patch was required, or `PATCHED` if any step from `S064-S076` changed the file.
- [ ] S084. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to smoke verification.
- [ ] S085. Run the parity harness on [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz) and write the output to `tsz/compiler/migration/reports/parity/state_tree_smoke_counter.json`.
- [ ] S086. Open `state_tree_smoke_counter.json` and confirm it exists.
- [ ] S087. Open `state_tree_smoke_counter.json` and confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] S088. Read `predicted_atoms` in `state_tree_smoke_counter.json` and confirm it includes atoms `4`, `5`, `6`, and `7`.
- [ ] S089. Read `predicted_atoms` in `state_tree_smoke_counter.json` and determine whether atom `8` is present.
- [ ] S090. If atom `8` is present in `state_tree_smoke_counter.json`, add a line to `state_tree_status.md` stating that the primary counter cart exercised `a008`.
- [ ] S091. If atom `8` is absent in `state_tree_smoke_counter.json`, run the parity harness on [lua_bridge_stress.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/lscript/lua_bridge_stress.tsz) and write the output to `tsz/compiler/migration/reports/parity/state_tree_smoke_bridge.json`.
- [ ] S092. If `state_tree_smoke_bridge.json` was created, open it and confirm it exists.
- [ ] S093. If `state_tree_smoke_bridge.json` was created, confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] S094. If `state_tree_smoke_bridge.json` was created, read `predicted_atoms` and confirm atom `8` is present.
- [ ] S095. If `state_tree_smoke_bridge.json` was created and atom `8` is still absent, add the exact line `State tree coverage gap: atom 8 not exercised by s01a_counter or lua_bridge_stress` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md).
- [ ] S096. Read `diff_status` in `state_tree_smoke_counter.json`.
- [ ] S097. If `state_tree_smoke_bridge.json` exists, read `diff_status` there as well.
- [ ] S098. If `state_tree_smoke_counter.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text from that report into `state_tree_status.md` under a line naming the cart path `tsz/carts/conformance/soup/s01a_counter.tsz`.
- [ ] S099. If `state_tree_smoke_bridge.json` exists and its `diff_status` is not `match`, copy the exact `first_diff_hunk` text from that report into `state_tree_status.md` under a line naming the cart path `tsz/carts/conformance/lscript/lua_bridge_stress.tsz`.
- [ ] S100. If `state_tree_smoke_counter.json` has `diff_status` equal to `match` and no fallback report was required, add the line `State tree smoke parity: MATCH on s01a_counter` to `state_tree_status.md`.
- [ ] S101. If `state_tree_smoke_counter.json` has `diff_status` equal to `match` and `state_tree_smoke_bridge.json` also has `diff_status` equal to `match`, add the line `State tree smoke parity: MATCH on s01a_counter and lua_bridge_stress` to `state_tree_status.md`.
- [ ] S102. Re-open `state_tree_status.md` and confirm it contains one result line for each atom `a004` through `a008`, plus either copied diff hunks or an explicit `State tree smoke parity: MATCH ...` line.
- [ ] S103. Re-open [a004_state_manifest.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a004_state_manifest.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] S104. Re-open [a005_init_state_slots.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a005_init_state_slots.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] S105. Re-open [a006_static_node_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a006_static_node_arrays.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] S106. Re-open [a007_root_node_init.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a007_root_node_init.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] S107. Re-open [a008_dynamic_text_buffers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/state_tree/a008_dynamic_text_buffers.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] S108. Append a completion line to `tsz/compiler/migration/state/completed.txt` with the text `0166-0190 state tree parity contract executed` only after steps `S102-S107` are complete.
- [ ] S109. Update `tsz/compiler/migration/state/current_step.txt` to `0166-0190`.
- [ ] S110. Re-open `completed.txt` and `current_step.txt` and confirm both files reflect the finished contract.
- [ ] S111. If `state_tree_smoke_counter.json` is missing or schema-incomplete, append `0166-0190 missing primary parity artifact` to `blocked.txt` and stop.
- [ ] S112. If the fallback report was required but is missing or schema-incomplete, append `0166-0190 missing fallback parity artifact` to `blocked.txt` and stop.
- [ ] S113. If any final re-open check in `S103-S107` fails, append `0166-0190 final file verification failed` to `blocked.txt` and stop.
- [ ] S114. Stop this contract only after all touched atom files, `state_tree_status.md`, and the required parity report files have all been re-opened and verified directly.
