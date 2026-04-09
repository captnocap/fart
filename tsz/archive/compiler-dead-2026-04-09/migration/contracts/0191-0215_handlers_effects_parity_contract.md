# Contract 0191-0215 — Handlers And Effects Parity

Purpose:
- This contract expands base steps `191-215` from [MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md](/home/siah/creative/reactjit/tsz/compiler/MIGRATION_SINGLE_AGENT_EXECUTION_PROPOSAL.md).
- This contract is written as a zero-inference microstep list for the handlers/effects atom group.

Scope:
- Compare the live monolith handler and effect emitters to atoms `a009`, `a010`, and `a011`.
- Patch only the atom files if any literal mismatch is found.
- Resolve the known a010/a011 ordering drift by making one atom own the byte-parity order.

## Pattern In

- Reader-side syntax can vary. This contract uses [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz) and [d102_effect_color_indexing.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d102_effect_color_indexing.tsz) as concrete fixtures only.
- The relevant reader output is the normalized handler/effect record set: non-map handlers and effect-render records.
- This contract is frontend-independent once those records exist.

## Middle Record

- `pattern_in`: app-level handler and effect declarations.
- `node_id`: not applicable. These are function/runtime records, not per-node storage records.
- `parent_id`: not applicable.
- `node_kind`: not applicable.
- `string_literals`: section headers, function names, WGSL string payload lines, shader-desc text.
- `size_literals`: effect ids and collection lengths only; no node-sizing semantics here.
- `style_literals`: not applicable.
- `conditionals`: not applicable.
- `variants`: not applicable.
- `handlers`: non-map handler records with `name`, `body`, and `inMap === false`.
- `maps`: only relevant as exclusion for `a009`; map handlers are not owned here.
- `render_locals`: not applicable.
- `dyn_text`: not applicable.
- `dyn_style`: not applicable.
- `dyn_color`: not applicable.
- `runtime_bridges`: effect-render records with `id`, `param`, `body`, CPU emitter path, and optional WGSL translation result.
- `emit_out`: `a009` handler section, `a010` interleaved CPU/WGSL effect output, `a011` explicit parity no-op.

## Emit Out

- Output owners: [a009_non_map_handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js), [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js), [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js).
- Legacy compare surfaces: [handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/handlers.js), [effects.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js).
- Target backend: `zig`.
- Expected realization:
  - `a009` realizes non-map handler functions only.
  - `a010` realizes effect header/imports plus CPU function and WGSL/shader-desc output in monolith order.
  - `a011` stays loadable but realizes no output so parity is not broken by duplicate WGSL emission.

Canonical intent sources:
- [handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/handlers.js)
- [effects.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [a009_non_map_handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js)
- [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js)
- [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js)

Owned files:
- [a009_non_map_handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js)
- [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js)
- [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js)
- [handlers_effects_status.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/sections/handlers_effects_status.md)
- [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md)

Read-only files for this contract:
- [handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/handlers.js)
- [effects.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js)
- [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md)
- [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz)
- [d102_effect_color_indexing.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d102_effect_color_indexing.tsz)

Do not edit in this contract:
- [emit.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit.js)
- [emit_atoms/index.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/index.js)
- [emit/effect_transpile.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effect_transpile.js)
- [emit/effect_wgsl.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effect_wgsl.js)
- [smith_LOAD_ORDER.txt](/home/siah/creative/reactjit/tsz/compiler/smith_LOAD_ORDER.txt)

Required artifacts:
- `tsz/compiler/migration/reports/sections/handlers_effects_status.md`
- `tsz/compiler/migration/reports/parity/handlers_smoke.json`
- `tsz/compiler/migration/reports/parity/effects_smoke.json`

Completion criteria:
- `a009` emits the same non-map handler filter, header, and handler body format as the monolith
- `a010` emits effect header/imports plus CPU and WGSL output in the same per-effect interleaved order as the monolith
- `a011` no longer re-emits WGSL output after `a010`; it becomes an explicit parity no-op while remaining loadable
- `handlers_effects_status.md` records the pattern/middle/emit grounding for this group and separate results for `a009`, `a010`, and `a011`
- the handler smoke report exists and matches the parity schema
- the effect smoke report exists and matches the parity schema

## Microsteps

- [ ] H001. Open [handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/handlers.js) lines `3-9`.
- [ ] H002. Open [effects.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js) lines `3-28`.
- [ ] H003. Open [a009_non_map_handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js) lines `11-41`.
- [ ] H004. Open [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js) lines `14-44`.
- [ ] H005. Open [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js) lines `14-50`.
- [ ] H006. Open [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) lines `50-61`.
- [ ] H007. Open [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz) lines `12-30`.
- [ ] H008. Open [d102_effect_color_indexing.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d102_effect_color_indexing.tsz) lines `12-38`.
- [ ] H009. Create `tsz/compiler/migration/reports/sections/handlers_effects_status.md` if it does not exist.
- [ ] H010. Write a heading `# Handlers And Effects Status` into `handlers_effects_status.md` if the file is new.
- [ ] H011. Add a line to `handlers_effects_status.md` stating that group 3 was read directly against `emit/handlers.js` and `emit/effects.js`.
- [ ] H012. Add a line to `handlers_effects_status.md` stating that [ATOM_PARITY_REPORT.md](/home/siah/creative/reactjit/tsz/compiler/smith/ATOM_PARITY_REPORT.md) currently records `a009` as `MATCH` and `a010/a011` as ordering mismatches.
- [ ] H012A. Add the line `Grounding: reader syntax is adapter-only; middle truth is non-map handler records plus effect-render records; emit ownership is a009-a011.` to `handlers_effects_status.md`.
- [ ] H013. Read [handlers.js#L4-L7](/home/siah/creative/reactjit/tsz/compiler/smith/emit/handlers.js#L4-L7) and confirm the monolith returns `''` when `nonMapHandlers.length === 0`, emits the header `\n// ── Event handlers ──────────────────────────────────────────────\n`, and formats each handler as `fn NAME() void {\nBODY}\n\n`.
- [ ] H014. Read [a009_non_map_handlers.js#L13-L29](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js#L13-L29) and confirm the atom applies only when at least one `!inMap` handler exists, filters `ctx.handlers` to `!handler.inMap`, emits the same header, and formats each handler the same way.
- [ ] H015. If [a009_non_map_handlers.js#L14-L16](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js#L14-L16) differs, replace those lines with the exact text:
```js
  return ctx.handlers.some(function(handler) {
    return !handler.inMap;
  });
```
- [ ] H016. If [a009_non_map_handlers.js#L21-L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js#L21-L23) differs, replace those lines with the exact text:
```js
  var nonMapHandlers = (ctx.handlers || []).filter(function(handler) {
    return !handler.inMap;
  });
```
- [ ] H017. If [a009_non_map_handlers.js#L26](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js#L26) differs, replace it with the exact text `  var out = '\n// ── Event handlers ──────────────────────────────────────────────\\n';`.
- [ ] H018. If [a009_non_map_handlers.js#L28](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js#L28) differs, replace it with the exact text `    out += 'fn ' + handler.name + '() void {\\n' + (handler.body || '') + '}\\n\\n';`.
- [ ] H019. Re-open [a009_non_map_handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js) and confirm the applies logic, non-map filter, header string, and handler body line all match steps `H015-H018`.
- [ ] H020. Read [effects.js#L4-L7](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js#L4-L7) and confirm the monolith returns `''` when no effects exist, emits the effect header string, and imports `effect_ctx` and `api` before the loop.
- [ ] H021. Read [effects.js#L8-L27](/home/siah/creative/reactjit/tsz/compiler/smith/emit/effects.js#L8-L27) and confirm the monolith loop order is `CPU function` immediately followed by `WGSL or CPU-only shader desc` for each effect render.
- [ ] H021A. Read [a010_cpu_effect_renderers.js#L16](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L16) and [a011_wgsl_effect_shaders.js#L16](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js#L16) and confirm both atoms apply with the exact text `return !!(ctx.effectRenders && ctx.effectRenders.length > 0);`.
- [ ] H021B. If [a010_cpu_effect_renderers.js#L16](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L16) differs, replace it with the exact text `  return !!(ctx.effectRenders && ctx.effectRenders.length > 0);`.
- [ ] H021C. If [a011_wgsl_effect_shaders.js#L16](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js#L16) differs, replace it with the exact text `  return !!(ctx.effectRenders && ctx.effectRenders.length > 0);`.
- [ ] H022. Read [a010_cpu_effect_renderers.js#L20-L31](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L20-L31) and confirm the atom currently emits the header, imports, and only the CPU function body for each effect render.
- [ ] H023. Read [a011_wgsl_effect_shaders.js#L23-L37](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js#L23-L37) and confirm the atom currently emits all WGSL and shader-desc output after a010 has already finished.
- [ ] H024. Add a line to `handlers_effects_status.md` stating that parity requires the combined a010+a011 output to match the monolith's per-effect interleaving, not just emit the same content in a different section order.
- [ ] H025. If [a010_cpu_effect_renderers.js#L23](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L23) differs, replace it with the exact text `  var out = '\n// ── Effect render functions ─────────────────────────────────────\\n';`.
- [ ] H026. If [a010_cpu_effect_renderers.js#L24](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L24) differs, replace it with the exact text `  out += 'const effect_ctx = @import(\"' + prefix + 'effect_ctx.zig\");\\n';`.
- [ ] H027. If [a010_cpu_effect_renderers.js#L25](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L25) differs, replace it with the exact text `  out += 'const api = @import(\"' + prefix + 'api.zig\");\\n\\n';`.
- [ ] H028. Read [a010_cpu_effect_renderers.js#L27-L31](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js#L27-L31) and confirm the current loop ends immediately after the CPU function terminator `}\n\n`.
- [ ] H029. Insert the following exact block into [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js) immediately after the existing line `    out += '}\\n\\n';` and before the `ctx.effectRenders.forEach(...)` callback closes:
```js
    var result = transpileEffectToWGSL(effectRender.body, effectRender.param);
    if (result && result.wgsl) {
      var wgslLines = result.wgsl.split('\n');
      out += 'pub const _effect_wgsl_' + effectRender.id + ': []const u8 =\n';
      wgslLines.forEach(function(wgslLine) {
        out += '    \\\\' + wgslLine + '\n';
      });
      out += ';\n';
      out += 'pub const _effect_shader_' + effectRender.id + ' = api.GpuShaderDesc{ .wgsl = _effect_wgsl_' + effectRender.id + ' };\n\n';
    } else {
      out += 'pub const _effect_shader_' + effectRender.id + ': ?api.GpuShaderDesc = null;  // CPU-only effect\n\n';
    }
```
- [ ] H030. Re-open [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js) and confirm each effect iteration now emits CPU function lines first and WGSL or CPU-only shader lines second inside the same loop body.
- [ ] H031. Read [a011_wgsl_effect_shaders.js#L21-L38](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js#L21-L38) and confirm the current emit body still re-emits WGSL and shader-desc output after a010.
- [ ] H032. Delete lines [a011_wgsl_effect_shaders.js#L23-L38](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js#L23-L38), which currently contain `var out = '';`, the `ctx.effectRenders.forEach(...)` WGSL loop, and `return out;`.
- [ ] H033. Insert the exact line `  return '';` into [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js) inside `_a011_emit` immediately after the existing no-effects guard line `if (!(ctx.effectRenders && ctx.effectRenders.length > 0)) return '';`.
- [ ] H034. Re-open [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js) and confirm `_a011_emit` now returns `''` unconditionally after the guard and no longer contains the WGSL loop.
- [ ] H035. Add a line to `handlers_effects_status.md` stating that `a010` now owns the interleaved effect output required for byte parity.
- [ ] H036. Add a line to `handlers_effects_status.md` stating that `a011` is an intentional parity no-op so it does not duplicate WGSL output after `a010`.
- [ ] H037. Ensure the parity harness file [run_parity.js](/home/siah/creative/reactjit/tsz/compiler/migration/harness/run_parity.js) exists before continuing to smoke verification.
- [ ] H038. Run the parity harness on [s01a_counter.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/soup/s01a_counter.tsz) and write the output to `tsz/compiler/migration/reports/parity/handlers_smoke.json`.
- [ ] H039. Open `handlers_smoke.json` and confirm it exists.
- [ ] H040. Open `handlers_smoke.json` and confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] H041. Read `predicted_atoms` in `handlers_smoke.json` and confirm atom `9` is present.
- [ ] H042. Run the parity harness on [d102_effect_color_indexing.tsz](/home/siah/creative/reactjit/tsz/carts/conformance/mixed/d102_effect_color_indexing.tsz) and write the output to `tsz/compiler/migration/reports/parity/effects_smoke.json`.
- [ ] H043. Open `effects_smoke.json` and confirm it exists.
- [ ] H044. Open `effects_smoke.json` and confirm it contains the fields `cart_path`, `lane`, `legacy_hash`, `atom_hash`, `diff_status`, `first_diff_hunk`, `split_output`, `backend_tags`, `predicted_atoms`, and `verification_time`.
- [ ] H045. Read `predicted_atoms` in `effects_smoke.json` and confirm atoms `10` and `11` are both present.
- [ ] H046. If `effects_smoke.json` does not include both `10` and `11`, add the exact line `Handlers/effects coverage gap: d102_effect_color_indexing did not exercise atoms 10 and 11 together` to [coverage_matrix.md](/home/siah/creative/reactjit/tsz/compiler/migration/reports/coverage/coverage_matrix.md).
- [ ] H047. Read `diff_status` in `handlers_smoke.json`.
- [ ] H048. Read `diff_status` in `effects_smoke.json`.
- [ ] H049. If `handlers_smoke.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text from that report into `handlers_effects_status.md` under a line naming the cart path `tsz/carts/conformance/soup/s01a_counter.tsz`.
- [ ] H050. If `effects_smoke.json` has `diff_status` not equal to `match`, copy the exact `first_diff_hunk` text from that report into `handlers_effects_status.md` under a line naming the cart path `tsz/carts/conformance/mixed/d102_effect_color_indexing.tsz`.
- [ ] H051. If `handlers_smoke.json` has `diff_status` equal to `match`, add the line `Handler parity: MATCH on s01a_counter` to `handlers_effects_status.md`.
- [ ] H052. If `effects_smoke.json` has `diff_status` equal to `match`, add the line `Effect parity: MATCH on d102_effect_color_indexing` to `handlers_effects_status.md`.
- [ ] H053. Re-open `handlers_effects_status.md` and confirm it contains separate result lines for `a009`, `a010`, and `a011`, plus either copied diff hunks or explicit `MATCH` lines for the handler and effect carts.
- [ ] H054. Re-open [a009_non_map_handlers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a009_non_map_handlers.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] H055. Re-open [a010_cpu_effect_renderers.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a010_cpu_effect_renderers.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] H056. Re-open [a011_wgsl_effect_shaders.js](/home/siah/creative/reactjit/tsz/compiler/smith/emit_atoms/handlers_effects/a011_wgsl_effect_shaders.js) one final time and confirm only the lines named in this contract were touched if any patch occurred.
- [ ] H057. Append a completion line to `tsz/compiler/migration/state/completed.txt` with the text `0191-0215 handlers effects parity contract executed` only after steps `H053-H056` are complete.
- [ ] H058. Update `tsz/compiler/migration/state/current_step.txt` to `0191-0215`.
- [ ] H059. Re-open `completed.txt` and `current_step.txt` and confirm both files reflect the finished contract.
- [ ] H060. If `handlers_smoke.json` is missing or schema-incomplete, append `0191-0215 missing handler parity artifact` to `blocked.txt` and stop.
- [ ] H061. If `effects_smoke.json` is missing or schema-incomplete, append `0191-0215 missing effect parity artifact` to `blocked.txt` and stop.
- [ ] H062. If any final re-open check in `H054-H056` fails, append `0191-0215 final file verification failed` to `blocked.txt` and stop.
- [ ] H063. Stop this contract only after all touched atom files, `handlers_effects_status.md`, `handlers_smoke.json`, and `effects_smoke.json` have all been re-opened and verified directly.
