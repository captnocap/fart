# Contract 0216-0250 — Object Arrays Parity

Purpose:
- This contract expands base steps `216-250` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the object-array atom group.

Scope:
- Compare atoms `a012` through `a018` against the last full monolith body for object-array emission.
- Patch only the atom files if any literal mismatch is found.
- Record fixed smoke coverage for const OA, dynamic OA, nested OA, and variant host emission.

## Pattern In

- Reader-side syntax can vary. This contract uses [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz), [d40_type_annotations.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d40_type_annotations.tsz), [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz), and [d121_variant_switching.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d121_variant_switching.tsz) only as concrete fixtures.
- The relevant reader output is the normalized OA-backed collection truth: merged OA schemas, const vs dynamic storage, nested-child relationships, unpack behavior, and optional variant-host wiring.
- This contract is frontend-independent once those OA records exist.

## Middle Record

- `pattern_in`: OA-backed maps, field collections, nested arrays, and optional variant host interaction.
- `node_id`: not applicable. Object-array storage is collection truth, not per-node identity.
- `parent_id`: not applicable except for nested OA child-parent relationships recorded in schema.
- `node_kind`: OA pool, nested child pool, unpack helper, variant host runtime helper.
- `string_literals`: const string payloads, duplicated string helper usage, `_lens` companions, WGSL/QJS bridge strings where applicable.
- `size_literals`: `_len`, capacity growth bases, nested counts, shrink-trim boundaries.
- `style_literals`: not applicable.
- `conditionals`: not applicable.
- `variants`: variant host setter contract and host id conversion.
- `handlers`: not applicable.
- `maps`: OA schema by `oaIdx`, merged field sets, `isNested` handling, flat vs nested child layout, unpack ordering.
- `render_locals`: not applicable.
- `dyn_text`: not applicable.
- `dyn_style`: not applicable.
- `dyn_color`: not applicable.
- `runtime_bridges`: QJS shim types/accessors, `QJS_UNDEFINED`, unpack/runtime dirty marking, variant host bridge.
- `emit_out`: `a012` QJS bridge, `a013` string helpers, `a014` const storage, `a015` dynamic storage, `a016` flat unpack with inline nested logic, `a017` no-op nested placeholder, `a018` variant host setter.

## Emit Out

- Output owners: [a012_qjs_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js), [a013_oa_string_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js), [a014_oa_const_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js), [a015_oa_dynamic_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js), [a016_oa_flat_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js), [a017_oa_nested_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js), [a018_variant_host_setter.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js).
- Legacy compare surfaces: historical [object_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/object_arrays.js) body at commit `4b2ec008`, plus current [emit_oa_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_oa_bridge.js) for active wrapper context.
- Target backend: `zig`.
- Expected realization:
  - `a012` realizes the QJS bridge support and `QJS_UNDEFINED`.
  - `a013` realizes OA header and string helper functions.
  - `a014` realizes const OA storage in historical order.
  - `a015` realizes dynamic storage and ensure-capacity helpers in historical order.
  - `a016` realizes unpack logic, including inline nested handling.
  - `a017` realizes no emitted bytes because nested unpack truth is already realized inline by `a016`.
  - `a018` realizes variant-host setter output.

Canonical intent sources:
- [object_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/object_arrays.js)
- [emit_oa_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_oa_bridge.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [a012_qjs_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js)
- [a013_oa_string_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js)
- [a014_oa_const_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js)
- [a015_oa_dynamic_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js)
- [a016_oa_flat_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js)
- [a017_oa_nested_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js)
- [a018_variant_host_setter.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js)

Historical legacy source:
- Use the local git command `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js` as the monolith source of truth.
- Use the command `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js | nl -ba | sed -n '1,120p'` for the bridge, string-helper, and const-storage sections.
- Use the command `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js | nl -ba | sed -n '116,220p'` for ensure-capacity and unpack setup sections.
- Use the command `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js | nl -ba | sed -n '220,349p'` for nested unpack, shrink trim, and variant host sections.

Owned files:
- [a012_qjs_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js)
- [a013_oa_string_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js)
- [a014_oa_const_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js)
- [a015_oa_dynamic_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js)
- [a016_oa_flat_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js)
- [a017_oa_nested_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js)
- [a018_variant_host_setter.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js)
- [object_arrays_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/object_arrays_status.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [object_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/object_arrays.js)
- [emit_oa_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_oa_bridge.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz)
- [d40_type_annotations.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d40_type_annotations.tsz)
- [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz)
- [d121_variant_switching.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d121_variant_switching.tsz)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [emit_ops/emit_oa_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_oa_bridge.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)

Required artifacts:
- `tsz/compiler/migration/reports/sections/object_arrays_status.md`
- `tsz/compiler/migration/reports/parity/object_arrays_const.json`
- `tsz/compiler/migration/reports/parity/object_arrays_dynamic.json`
- `tsz/compiler/migration/reports/parity/object_arrays_nested.json`
- `tsz/compiler/migration/reports/parity/object_arrays_variant.json`

Completion criteria:
- `a012` matches the historical QJS shim and `QJS_UNDEFINED` output
- `a013` matches the historical object-array header and string-helper functions
- `a014` matches the historical const OA dedupe and storage output
- `a015` matches the historical dynamic storage layout and ensure-capacity helper order
- `a016` matches the historical unpack header, field extraction, inline nested unpack, shrink-trim, and dirty-marking order
- `a017` remains an intentional no-op and its rationale matches the inline nested logic in `a016`
- `a018` matches the historical variant-host setter output
- `object_arrays_status.md` records the pattern/middle/emit grounding for this group and separate results for atoms `a012` through `a018`
- all four parity reports exist and match the parity schema

## Microsteps

- [ ] OA001. Open [object_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/object_arrays.js) lines `4-35`.
- [ ] OA002. Run `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js | nl -ba | sed -n '1,120p'`.
- [ ] OA003. Run `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js | nl -ba | sed -n '116,220p'`.
- [ ] OA004. Run `git show 4b2ec008:tsz/compiler/smith/emit/object_arrays.js | nl -ba | sed -n '220,349p'`.
- [ ] OA005. Open [emit_oa_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_ops/emit_oa_bridge.js) lines `16-27`.
- [ ] OA006. Open [a012_qjs_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js) lines `11-48`.
- [ ] OA007. Open [a013_oa_string_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js) lines `11-42`.
- [ ] OA008. Open [a014_oa_const_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js) lines `11-79`.
- [ ] OA009. Open [a015_oa_dynamic_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js) lines `12-220`.
- [ ] OA010. Open [a016_oa_flat_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js) lines `14-225`.
- [ ] OA011. Open [a017_oa_nested_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js) lines `20-70`.
- [ ] OA012. Open [a018_variant_host_setter.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js) lines `11-42`.
- [ ] OA013. Open [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) lines `63-85`.
- [ ] OA014. Open [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz) lines `19-54` and `69-134`.
- [ ] OA015. Open [d40_type_annotations.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d40_type_annotations.tsz) lines `7-12` and `19-45` and `77-94`.
- [ ] OA016. Open [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz) lines `15-31` and `75-92` and `129-135`.
- [ ] OA017. Open [d121_variant_switching.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d121_variant_switching.tsz) lines `11-35`.
- [ ] OA018. Create `tsz/compiler/migration/reports/sections/object_arrays_status.md` if it does not exist.
- [ ] OA019. Write a heading `# Object Arrays Status` into `object_arrays_status.md` if the file is new.
- [ ] OA020. Add a line to `object_arrays_status.md` stating that object-array parity is anchored to historical monolith commit `4b2ec008` because the active [object_arrays.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/object_arrays.js) wrapper no longer contains the full legacy body.
- [ ] OA021. Add a line to `object_arrays_status.md` stating that [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) currently records `a012` through `a018` as `MATCH`, with `a017` explicitly documented as a no-op.
- [ ] OA021A. Add the line `Grounding: reader syntax is adapter-only; middle truth is OA schema + storage + unpack + variant-host records; emit ownership is a012-a018.` to `object_arrays_status.md`.
- [ ] OA022. Read historical monolith lines `7-24` from the `git show` output and confirm they contain the fastBuild `@cImport` branch, the IS_LIB fallback struct, and the `QJS_UNDEFINED` line.
- [ ] OA023. Read [a012_qjs_bridge.js#L19-L36](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js#L19-L36) and confirm the atom emits the same fastBuild branch, IS_LIB fallback struct, and `QJS_UNDEFINED` line.
- [ ] OA024. If [a012_qjs_bridge.js#L20](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js#L20) differs from the historical fastBuild line, replace it with the exact text `    out += 'const qjs = @cImport({ @cDefine(\"_GNU_SOURCE\", \"1\"); @cDefine(\"QUICKJS_NG_BUILD\", \"1\"); @cInclude(\"quickjs.h\"); });\\n';`.
- [ ] OA025. If [a012_qjs_bridge.js#L22-L34](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js#L22-L34) differs in structure or emitted line order from historical lines `10-22`, replace that block so it emits `JSValue`, `JSContext`, `JS_GetPropertyStr`, `JS_GetPropertyUint32`, `JS_ToInt32`, `JS_ToInt64`, `JS_ToFloat64`, `JS_FreeValue`, `JS_ToCString`, `JS_FreeCString`, and `JS_NewFloat64` in exactly that order.
- [ ] OA026. If [a012_qjs_bridge.js#L36](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js#L36) differs, replace it with the exact text `  out += 'const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\\n\\n';`.
- [ ] OA027. Re-open [a012_qjs_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js) and confirm the fastBuild branch, fallback struct, and `QJS_UNDEFINED` line match steps `OA024-OA026`.
- [ ] OA028. Read historical monolith lines `26-38` and confirm they contain the `// ── Object arrays` header, `_oa_alloc`, `_oaDupString`, and `_oaFreeString`.
- [ ] OA029. Read [a013_oa_string_helpers.js#L19-L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js#L19-L29) and confirm the atom emits the same header and helper functions in the same order.
- [ ] OA030. If [a013_oa_string_helpers.js#L19](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js#L19) differs, replace it with the exact text `  out += '// ── Object arrays ───────────────────────────────────────────────\\n';`.
- [ ] OA031. If [a013_oa_string_helpers.js#L20-L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js#L20-L29) differs in line order or emitted text from historical lines `27-38`, replace that block so `_oa_alloc`, `_oaDupString`, and `_oaFreeString` emit in exactly the historical order.
- [ ] OA032. Re-open [a013_oa_string_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js) and confirm the header and helper block match steps `OA030-OA031`.
- [ ] OA033. Read historical monolith lines `40-57` and confirm duplicate OAs are merged by `oaIdx`, `isNested` entries are skipped, and duplicate fields are merged by name.
- [ ] OA034. Read [a014_oa_const_storage.js#L11-L31](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js#L11-L31) and [a015_oa_dynamic_storage.js#L12-L32](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js#L12-L32) and [a016_oa_flat_unpack.js#L14-L34](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js#L14-L34) and confirm all three `_mergeOas` helpers match the historical dedupe logic exactly.
- [ ] OA035. If [a014_oa_const_storage.js#L11-L31](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js#L11-L31) differs, replace the entire `_mergeOas` helper with the exact dedupe logic used in the historical monolith lines `40-57`.
- [ ] OA036. If [a015_oa_dynamic_storage.js#L12-L32](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js#L12-L32) differs, replace the entire `_mergeOas` helper with the exact dedupe logic used in the historical monolith lines `40-57`.
- [ ] OA037. If [a016_oa_flat_unpack.js#L14-L34](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js#L14-L34) differs, replace the entire `_mergeOas` helper with the exact dedupe logic used in the historical monolith lines `40-57`.
- [ ] OA038. Read historical monolith lines `63-76` and confirm const OA output order is: per-field arrays, `_lens` for strings, `_len`, then `_dirty`.
- [ ] OA039. Read [a014_oa_const_storage.js#L43-L68](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js#L43-L68) and confirm const OA output order matches historical lines `63-76`.
- [ ] OA040. If [a014_oa_const_storage.js#L56](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js#L56) differs in string escaping, replace it with the exact text `        var vals = oa.constData.map(function(item) { return '\"' + (item[f.name] || '').replace(/\\\\/g, '\\\\\\\\').replace(/\"/g, '\\\\\"') + '\"'; });`.
- [ ] OA041. If [a014_oa_const_storage.js#L64-L65](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js#L64-L65) differ, replace them with the exact texts `    out += 'var _oa' + idx + '_len: usize = ' + len + ';\\n';` and `    out += 'var _oa' + idx + '_dirty: bool = false;\\n\\n';`.
- [ ] OA042. Re-open [a014_oa_const_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js) and confirm dedupe, escaping, and `_len/_dirty` lines match steps `OA035-OA041`.
- [ ] OA043. Read historical monolith lines `80-114` and confirm dynamic storage order is: flat field buffers, nested field count buffers, `_len`, `_dirty`, then nested child OA storage.
- [ ] OA044. Read [a015_oa_dynamic_storage.js#L153-L195](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js#L153-L195) and confirm the atom emits those sections in exactly the same order.
- [ ] OA045. Read historical monolith lines `116-160` and confirm parent `_oaN_ensureCapacity` uses the first flat field as the cap anchor, grows from `64`, and updates flat fields before nested count buffers.
- [ ] OA046. Read [a015_oa_dynamic_storage.js#L44-L94](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js#L44-L94) and confirm `_emitEnsureCapacity` matches the historical helper order and growth rules.
- [ ] OA047. Read historical monolith lines `162-205` and confirm child `_oaN_ensureCapacity` grows from `256` and updates child fields before `_parentIdx`.
- [ ] OA048. Read [a015_oa_dynamic_storage.js#L96-L140](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js#L96-L140) and confirm `_emitChildEnsureCapacity` matches the historical child helper order and growth rules.
- [ ] OA049. If [a015_oa_dynamic_storage.js#L153-L205](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js#L153-L205) differs in section order from historical lines `80-205`, reorder the emit body so it stays exactly: dynamic field buffers -> nested count buffers -> `_len/_dirty` -> nested child storage -> parent ensureCapacity -> child ensureCapacity.
- [ ] OA050. Re-open [a015_oa_dynamic_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js) and confirm the storage sections and helper-call order match steps `OA043-OA049`.
- [ ] OA051. Read historical monolith lines `207-330` and confirm `_oaN_unpack()` order is: function header, array length read, `_oaN_ensureCapacity(count)`, nested total counters, per-element loop, nested total finalization, string trim on shrink, `_len`, `_dirty`, `state.markDirty()`, return.
- [ ] OA052. Read [a016_oa_flat_unpack.js#L86-L171](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js#L86-L171) and confirm `_a016_emit` matches that same order.
- [ ] OA053. Read historical monolith lines `233-268` and confirm nested array flattening lives inline inside the unpack loop, not as a standalone emitted function.
- [ ] OA054. Read [a016_oa_flat_unpack.js#L173-L214](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js#L173-L214) and confirm `_emitNestedFieldUnpack` contains the inline nested child extraction, `_parentIdx` wiring, and `_nested_total_*` increments.
- [ ] OA055. Read [a016_oa_flat_unpack.js#L46-L84](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js#L46-L84) and confirm `_emitFieldExtract` preserves the historical `jsPath` branch, direct string branch, and direct numeric branch.
- [ ] OA056. If [a016_oa_flat_unpack.js#L148-L167](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js#L148-L167) differs in shrink-trim or dirty-marking order, reorder that block so it matches historical lines `312-329`.
- [ ] OA057. Re-open [a016_oa_flat_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js) and confirm unpack header, nested inline handling, shrink-trim, dirty-marking, and return order match steps `OA051-OA056`.
- [ ] OA058. Read [a017_oa_nested_unpack.js#L11-L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js#L11-L18) and confirm the header comment states the nested unpack logic is emitted inline by `a016`.
- [ ] OA059. Read [a017_oa_nested_unpack.js#L54-L58](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js#L54-L58) and confirm `_a017_emit` returns `''`.
- [ ] OA060. Read [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) lines `80-82` and confirm `a017` is explicitly documented as a no-op because nested unpack lives inline in `a016`.
- [ ] OA061. If [a017_oa_nested_unpack.js#L58](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js#L58) differs, replace it with the exact text `  return '';`.
- [ ] OA062. Add the line `a017: intentional no-op; nested unpack remains inline in a016` to `object_arrays_status.md`.
- [ ] OA063. Read historical monolith lines `333-345` and confirm `_setVariantHost()` reads `argv[0]`, converts to `i64`, and calls either `api.zig` theme setter in fastBuild or `theme.zig` setter otherwise.
- [ ] OA064. Read [a018_variant_host_setter.js#L19-L30](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js#L19-L30) and confirm the atom emits the same function body and branch order.
- [ ] OA065. If [a018_variant_host_setter.js#L19](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js#L19) differs, replace it with the exact text `  out += 'fn _setVariantHost(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\\n';`.
- [ ] OA066. If [a018_variant_host_setter.js#L23-L27](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js#L23-L27) differs in branch order or emitted path, replace those lines so fastBuild emits `@import("...api.zig").theme.rjit_theme_set_variant(...)` and non-fastBuild emits `@import("...theme.zig").setVariant(...)`.
- [ ] OA067. Re-open [a018_variant_host_setter.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js) and confirm the function signature and variant setter branch order match steps `OA063-OA066`.
- [ ] OA068. Add one plain-text line to `object_arrays_status.md` for `a012` stating `MATCH` if no patch was required, or `PATCHED` if any step from `OA024-OA026` changed the file.
- [ ] OA069. Add one plain-text line to `object_arrays_status.md` for `a013` stating `MATCH` if no patch was required, or `PATCHED` if any step from `OA030-OA031` changed the file.
- [ ] OA070. Add one plain-text line to `object_arrays_status.md` for `a014` stating `MATCH` if no patch was required, or `PATCHED` if any step from `OA035-OA041` changed the file.
- [ ] OA071. Add one plain-text line to `object_arrays_status.md` for `a015` stating `MATCH` if no patch was required, or `PATCHED` if any step from `OA046-OA049` changed the file.
- [ ] OA072. Add one plain-text line to `object_arrays_status.md` for `a016` stating `MATCH` if no patch was required, or `PATCHED` if any step from `OA056` changed the file.
- [ ] OA073. Add one plain-text line to `object_arrays_status.md` for `a017` stating `MATCH` if no patch was required, or `PATCHED` if step `OA061` changed the file.
- [ ] OA074. Add one plain-text line to `object_arrays_status.md` for `a018` stating `MATCH` if no patch was required, or `PATCHED` if any step from `OA065-OA066` changed the file.
- [ ] OA075. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to smoke verification.
- [ ] OA076. Run the parity harness on [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz) and write the output to `tsz/compiler/migration/reports/parity/object_arrays_const.json`.
- [ ] OA077. Run the parity harness on [d40_type_annotations.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d40_type_annotations.tsz) and write the output to `tsz/compiler/migration/reports/parity/object_arrays_dynamic.json`.
- [ ] OA078. Run the parity harness on [d105_shell_slot_filter_pipeline.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz) and write the output to `tsz/compiler/migration/reports/parity/object_arrays_nested.json`.
- [ ] OA079. Run the parity harness on [d121_variant_switching.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d121_variant_switching.tsz) and write the output to `tsz/compiler/migration/reports/parity/object_arrays_variant.json`.
- [ ] OA080. Open all four parity reports and confirm each one exists.
- [ ] OA081. Open all four parity reports and confirm each one contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] OA082. Read `predicted_atoms` in `object_arrays_const.json` and confirm atoms `12`, `13`, and `14` are present.
- [ ] OA083. Read `predicted_atoms` in `object_arrays_dynamic.json` and confirm atoms `12`, `13`, `15`, and `16` are present.
- [ ] OA084. Read `predicted_atoms` in `object_arrays_nested.json` and confirm atoms `12`, `13`, `15`, `16`, and `17` are present.
- [ ] OA085. Read `predicted_atoms` in `object_arrays_variant.json` and confirm atom `18` is present.
- [ ] OA086. If `object_arrays_nested.json` does not include atom `17`, add the exact line `Object arrays coverage gap: nested OA cart did not exercise atom 17 applies path` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md).
- [ ] OA087. If `object_arrays_variant.json` does not include atom `18`, add the exact line `Object arrays coverage gap: variant cart did not exercise atom 18` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md).
- [ ] OA088. Read `diff_status` in all four parity reports.
- [ ] OA089. If `object_arrays_const.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `object_arrays_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d96_const_array_map.tsz`.
- [ ] OA090. If `object_arrays_dynamic.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `object_arrays_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d40_type_annotations.tsz`.
- [ ] OA091. If `object_arrays_nested.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `object_arrays_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz`.
- [ ] OA092. If `object_arrays_variant.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text into `object_arrays_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d121_variant_switching.tsz`.
- [ ] OA093. If all four parity reports have `diff_status` equal to `match`, add the line `Object arrays smoke parity: MATCH on const, dynamic, nested, and variant carts` to `object_arrays_status.md`.
- [ ] OA094. Re-open `object_arrays_status.md` and confirm it contains one result line for each atom `a012` through `a018`, plus either copied diff hunks or the explicit all-match line.
- [ ] OA095. Re-open [a012_qjs_bridge.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a012_qjs_bridge.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA096. Re-open [a013_oa_string_helpers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a013_oa_string_helpers.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA097. Re-open [a014_oa_const_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a014_oa_const_storage.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA098. Re-open [a015_oa_dynamic_storage.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a015_oa_dynamic_storage.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA099. Re-open [a016_oa_flat_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a016_oa_flat_unpack.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA100. Re-open [a017_oa_nested_unpack.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a017_oa_nested_unpack.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA101. Re-open [a018_variant_host_setter.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/object_arrays/a018_variant_host_setter.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] OA102. Re-run the parity harness on [d40_type_annotations.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d40_type_annotations.tsz) and compare the rerun hashes to `object_arrays_dynamic.json`.
- [ ] OA103. Re-run the parity harness on [d96_const_array_map.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d96_const_array_map.tsz) and compare the rerun hashes to `object_arrays_const.json`.
- [ ] OA104. If either rerun hash differs from the saved report hash, append `0216-0250 object arrays rerun hash mismatch` to `blocked.txt` and stop.
- [ ] OA105. Append a completion line to `tsz/compiler/migration/state/completed.txt` with the text `0216-0250 object arrays parity contract executed` only after steps `OA094-OA104` are complete.
- [ ] OA106. Update `tsz/compiler/migration/state/current_step.txt` to `0216-0250`.
- [ ] OA107. Re-open `completed.txt` and `current_step.txt` and confirm both files reflect the finished contract.
- [ ] OA108. If any required parity report is missing or schema-incomplete, append `0216-0250 missing parity artifact` to `blocked.txt` and stop.
- [ ] OA109. If any final re-open check in `OA095-OA101` fails, append `0216-0250 final file verification failed` to `blocked.txt` and stop.
- [ ] OA110. Stop this contract only after all touched atom files, `object_arrays_status.md`, and all four parity report files have been re-opened and verified directly.
