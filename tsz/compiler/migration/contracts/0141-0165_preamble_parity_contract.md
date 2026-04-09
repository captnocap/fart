# Contract 0141-0165 — Preamble Parity

Purpose:
- This contract expands base steps `141-165` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the preamble atom group.

Scope:
- Compare the live monolith preamble emitter to atoms `a001`, `a002`, and `a003`.
- Patch only the atom files needed for byte-parity.
- Record the result in the preamble status report and parity report.

## Pattern In

- Frontend source is intentionally not fixed for this contract. Any frontend that compiles to a Smith app/unit can trigger this preamble path.
- The smoke fixture is whatever cart is used by `preamble_smoke.json`; the syntax of that cart is not the truth surface here.
- Reader-side ownership is frontend-independent at this layer. The relevant input is the normalized app/meta feature set that says whether the compile unit has runtime log support, Lua maps, script runtime, fastBuild, and library mode.

## Middle Record

- `pattern_in`: compile unit that requires preamble emission.
- `node_id`: not applicable. This contract is app-level, not node-level.
- `parent_id`: not applicable.
- `node_kind`: not applicable.
- `string_literals`: banner string, import strings, fallback stub strings.
- `size_literals`: not applicable.
- `style_literals`: not applicable.
- `conditionals`: not applicable.
- `variants`: not applicable.
- `handlers`: not applicable.
- `maps`: relevant only as `meta.hasLuaMaps` gating for `luajit_runtime`.
- `render_locals`: not applicable.
- `dyn_text`: not applicable.
- `dyn_style`: not applicable.
- `dyn_color`: not applicable.
- `runtime_bridges`: `meta.hasRuntimeLog`, `meta.fastBuild`, `meta.hasScriptRuntime`, `meta.hasLuaMaps`, `meta.prefix`, and `IS_LIB` fallback stubs for `evalExpr` and `evalLuaMapData`.
- `emit_out`: `a001` banner, `a002` core imports, `a003` runtime imports and non-fastBuild tail import.

## Emit Out

- Output owners: [a001_compile_banner.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a001_compile_banner.js), [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js), [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js).
- Legacy compare surface: [preamble.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js).
- Target backend: `zig`.
- Expected realization:
  - `a001` emits the generated-file banner.
  - `a002` emits `std` and optional `smith_log` in monolith order.
  - `a003` emits runtime imports, QJS fallback stubs, Lua-map runtime import gating, and the trailing `core.zig` comptime import in the correct branch.

Canonical intent sources:
- [preamble.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [a001_compile_banner.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a001_compile_banner.js)
- [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js)
- [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js)

Owned files:
- [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js)
- [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js)
- [preamble_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/preamble_status.md)

Read-only files for this contract:
- [preamble.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js)
- [a001_compile_banner.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a001_compile_banner.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [emit/finalize.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/finalize.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)

Required artifacts:
- `tsz/compiler/migration/reports/sections/preamble_status.md`
- `tsz/compiler/migration/reports/parity/preamble_smoke.json`

Completion criteria:
- `a001` still matches banner output
- `a002` contains the missing `smith_log` import line in the correct emitted order
- `a002` no longer emits the `core.zig` comptime import
- `a003` emits the `evalLuaMapData` stub in the QJS IS_LIB fallback
- `a003` imports `luajit_runtime` only when `meta.hasLuaMaps`
- `a003` emits the `core.zig` comptime import at the end of the non-fastBuild preamble path
- `preamble_status.md` names the pattern/middle/emit grounding for this group, the exact changed lines, and the result
- `preamble_smoke.json` exists and matches the parity schema

## Microsteps

- [ ] P001. Open [preamble.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js) lines `3-47`.
- [ ] P002. Open [a001_compile_banner.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a001_compile_banner.js) lines `11-29`.
- [ ] P003. Open [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) lines `16-31`.
- [ ] P004. Open [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) lines `16-45`.
- [ ] P005. Open [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) and read the `a003_runtime_imports` mismatch note.
- [ ] P006. Read [preamble.js#L4](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L4) and confirm the emitted banner string begins with `//! Generated by tsz compiler (Zig)`.
- [ ] P007. Read [a001_compile_banner.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a001_compile_banner.js#L18) and confirm the emitted banner string is identical to the monolith banner string.
- [ ] P008. Create `tsz/compiler/migration/reports/sections/preamble_status.md` if it does not exist.
- [ ] P009. Write a heading `# Preamble Status` into `preamble_status.md` if the file is new.
- [ ] P010. Add a line to `preamble_status.md` stating that `a001` was read directly against `emit/preamble.js`.
- [ ] P011. Add a line to `preamble_status.md` stating that no `a001` code change is required if the strings are identical.
- [ ] P011A. Add the line `Grounding: frontend syntax is adapter-only here; middle truth is app/meta preamble state; emit ownership is a001-a003.` to `preamble_status.md`.
- [ ] P012. Read [preamble.js#L5](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L5) and confirm the first non-banner emitted line is `const std = @import("std");`.
- [ ] P013. Read [preamble.js#L6](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L6) and confirm the `smith_log` import line is `if (meta.hasRuntimeLog) out += \`const smith_log = @import("${meta.prefix}log.zig");\n\`;`.
- [ ] P014. Read [a002_core_imports.js#L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js#L18) and confirm the atom currently emits only the `std` import at the top of the function.
- [ ] P015. Confirm that [a002_core_imports.js#L19](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js#L19) currently starts the `meta.fastBuild` branch without emitting `smith_log`.
- [ ] P016. Insert the exact JavaScript line `if (meta.hasRuntimeLog) out += 'const smith_log = @import("' + meta.prefix + 'log.zig");\n';` into [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) immediately after the current `var out = 'const std = @import("std");\n';` line.
- [ ] P017. Re-open [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) and confirm the new `smith_log` line appears directly after the `std` import line.
- [ ] P018. Read [preamble.js#L15-L18](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L15-L18) and confirm the non-fastBuild block emits `build_options`, `IS_LIB`, and `layout` before any `core.zig` comptime import.
- [ ] P019. Read [preamble.js#L43-L45](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L43-L45) and confirm the `core.zig` comptime import is emitted at the end of the non-fastBuild path.
- [ ] P020. Read [a002_core_imports.js#L28-L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js#L28-L29) and confirm `a002` currently emits the `core.zig` comptime import too early.
- [ ] P021. Delete the comment and emitted `core.zig` lines from [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) so `a002` stops emitting `comptime { _ = @import("...core.zig"); }`.
- [ ] P022. Re-open [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) and confirm there is no `core.zig` import string left in `_a002_emit`.
- [ ] P023. Read [preamble.js#L21-L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L21-L29) and confirm the QJS IS_LIB fallback struct includes `pub fn evalLuaMapData(_: usize, _: []const u8) void {}`.
- [ ] P024. Read [a003_runtime_imports.js#L27-L34](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js#L27-L34) and confirm the atom currently omits the `evalLuaMapData` stub.
- [ ] P025. Insert the exact JavaScript line `      out += '    pub fn evalLuaMapData(_: usize, _: []const u8) void {}\\n';` into [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) immediately after the current `evalExpr` stub line and immediately before the `} else @import("...qjs_runtime.zig");` line.
- [ ] P026. Re-open [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) and confirm the `evalLuaMapData` stub appears between `evalExpr` and the closing struct line.
- [ ] P027. Read [preamble.js#L32-L40](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L32-L40) and confirm `luajit_runtime` is imported only inside `if (meta.hasLuaMaps)`.
- [ ] P028. Read [a003_runtime_imports.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js#L23) and confirm the fastBuild path currently uses `if (meta.hasScriptRuntime || meta.hasLuaMaps)`.
- [ ] P029. Read [a003_runtime_imports.js#L36](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js#L36) and confirm the non-fastBuild path currently uses `if (meta.hasScriptRuntime || meta.hasLuaMaps)`.
- [ ] P030. Change the fastBuild condition in [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) from `if (meta.hasScriptRuntime || meta.hasLuaMaps)` to `if (meta.hasLuaMaps)`.
- [ ] P031. Change the non-fastBuild condition in [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) from `if (meta.hasScriptRuntime || meta.hasLuaMaps)` to `if (meta.hasLuaMaps)`.
- [ ] P032. Re-open [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) and confirm both `luajit_runtime` condition lines now read `if (meta.hasLuaMaps)`.
- [ ] P033. Read [preamble.js#L43-L45](/home/siah/creative/reactjit/tsz/compiler/smith/emit/preamble.js#L43-L45) again and confirm the desired emitted string is `comptime { _ = @import("${meta.prefix}core.zig"); }\n`.
- [ ] P034. Insert the exact JavaScript line `    out += 'comptime { _ = @import(\"' + meta.prefix + 'core.zig\"); }\\n';` into [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) inside the non-fastBuild `else` block after the optional `luajit_runtime` block and before the block closes.
- [ ] P035. Re-open [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) and confirm the new `core.zig` emitted line is inside the non-fastBuild branch and after the `luajit_runtime` block.
- [ ] P036. Search [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) for `core.zig` and confirm there are now zero matches inside `_a002_emit`.
- [ ] P037. Search [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) for `core.zig` and confirm there is exactly one emitted string inside `_a003_emit`.
- [ ] P038. Re-open [preamble_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/preamble_status.md).
- [ ] P039. Add a line stating that `a002` was changed to emit `smith_log` immediately after `std`.
- [ ] P040. Add a line stating that `a002` no longer emits `core.zig`.
- [ ] P041. Add a line stating that `a003` now emits the `evalLuaMapData` QJS stub.
- [ ] P042. Add a line stating that `a003` now gates `luajit_runtime` on `meta.hasLuaMaps` only.
- [ ] P043. Add a line stating that `a003` now emits the `core.zig` comptime import at the end of the non-fastBuild path.
- [ ] P044. Re-open `preamble_status.md` and confirm all five findings from steps `P039-P043` are present as plain text.
- [ ] P045. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to the smoke run.
- [ ] P046. Run the parity harness on one cart and write the output to `tsz/compiler/migration/reports/parity/preamble_smoke.json`.
- [ ] P047. Open `preamble_smoke.json` and confirm it exists.
- [ ] P048. Open `preamble_smoke.json` and confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] P049. Read `diff_status` in `preamble_smoke.json`.
- [ ] P050. If `diff_status` is not `match`, copy the exact `first_diff_hunk` text from `preamble_smoke.json` into `preamble_status.md`.
- [ ] P051. If `diff_status` is `match`, add a line `Preamble smoke parity: MATCH` to `preamble_status.md`.
- [ ] P052. Re-open `preamble_status.md` and confirm it contains either the copied first diff hunk or the explicit `MATCH` line.
- [ ] P053. Re-open [a002_core_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a002_core_imports.js) one final time and verify the `smith_log` line still appears immediately after the `std` line.
- [ ] P054. Re-open [a003_runtime_imports.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/preamble/a003_runtime_imports.js) one final time and verify the `evalLuaMapData` stub, both `hasLuaMaps` conditions, and the relocated `core.zig` line are all still present.
- [ ] P055. Append a completion line to `tsz/compiler/migration/state/completed.txt` with the text `0141-0165 preamble parity contract executed` only after `P053` and `P054` are both complete.
- [ ] P056. Update `tsz/compiler/migration/state/current_step.txt` to `0141-0165`.
- [ ] P057. Re-open `completed.txt` and `current_step.txt` and confirm both files reflect the finished contract.
- [ ] P058. If `preamble_smoke.json` is missing or schema-incomplete, append `0141-0165 missing parity artifact` to `blocked.txt` and stop.
- [ ] P059. If the final re-open checks in `P053-P054` fail, append `0141-0165 final file verification failed` to `blocked.txt` and stop.
- [ ] P060. Stop this contract only after `a002_core_imports.js`, `a003_runtime_imports.js`, `preamble_status.md`, and `preamble_smoke.json` have all been re-opened and verified directly.
