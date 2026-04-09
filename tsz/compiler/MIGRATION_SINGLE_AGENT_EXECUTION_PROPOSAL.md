# Migration Single-Agent Execution Proposal

Generated: 2026-04-08

Purpose:
- This is a separate proposal from the multi-agent orchestration plan.
- This document describes what the work looks like if a **single agent** is put on a deterministic loop and executes the migration step by step.
- The bias here is against drift, against hidden handoffs, and against "good enough" phase jumps.
- This document is currently a **serial execution framework**, not yet the final zero-inference executable checklist.

Model:
- read one step
- do the step
- verify the step
- mark the step complete
- re-read the step
- re-read the changed line or file
- move to the next step

Core rule:
- do not skip ahead because a later step "will cover it"
- do not batch-edit three files if the step only names one
- do not treat a report as proof of change
- do not treat a grep result as proof of correctness
- do not trust input/output parity alone when the semantic middle has not been named

Expected scale:
- 605 steps

Status:
- The `605` count is real, but it is an **undercount** for a truly zero-inference run.
- The scaffolding, control, and state-tracking sections are mostly real steps.
- Large parts of the parity and migration sections still contain **task-shaped rows pretending to be steps**.
- Any line that says things like `compare`, `verify whether`, `decide whether`, `patch as needed`, or `insert in the correct branch` is not yet safe for strict loop execution.
- A fully executable version will likely expand to roughly **1200-1800** steps once those task-shaped rows are decomposed into literal actions.

Implication:
- This file should be treated as the **framework for the final step list**, not the final step list itself.
- Do not run the migration from this document as if it were already zero-inference.

## Step Integrity Rule

Definition:
- A **real step** tells the agent exactly what to open, exactly what to read, exactly what to copy/change, exactly where to place it, exactly what to verify, and exactly where to record the result.
- A **task-shaped row** tells the agent what to accomplish and leaves the how to the agent.

Examples of task-shaped rows:
- `Compare a004 to emitStateManifest()`
- `Verify whether a005 matches dynamic text update emission`
- `If smith_log import is missing, add it in a003 in the correct condition branch`

Those are not safe execution steps because they still require reconstruction and inference.

Execution rule:
- Before any section is executed in a strict one-agent loop, every task-shaped row in that section must be expanded into literal microsteps.
- A section is not runnable until its rows are transformed into real steps.

Expansion rule:
- Any step containing `compare`, `verify whether`, `decide whether`, `as needed`, `correct branch`, `equivalent`, `match exactly`, `patch it`, or similar inference-heavy language must be expanded before execution.

Practical consequence:
- The parity sections are the biggest under-expanded area.
- The current document is therefore best understood as the skeleton of the single-agent program.
- The next exacting pass on this document should expand the parity and cleanup sections into concrete microsteps with file paths, line ranges, exact insertion points, exact strings, and exact report writes.

## Middle Layer Rule

The compiler contract cannot stop at:
- source pattern in
- output bytes out

A strict execution loop also needs the semantic middle:
- what node or host was recognized
- what literals and normalized style facts were recorded
- what conditions, handlers, maps, variants, or runtime bridges were registered
- which emit sections are supposed to consume those facts

Implication:
- every expanded contract range should include `Pattern In`, `Middle Record`, and `Emit Out`
- any step that only says "compare legacy output to atom output" is still under-specified if it does not also say what semantic middle facts that slice is preserving

## Section Index

| Range | Section | Count |
|---|---|---|
| 001-020 | Loop Discipline | 20 |
| 021-050 | Workspace Scaffolding | 30 |
| 051-080 | Canonical Source Capture | 30 |
| 081-110 | Harness Scaffolding | 30 |
| 111-140 | Coverage And Live-Risk Baseline | 30 |
| 141-165 | Preamble Parity | 25 |
| 166-190 | State Tree Parity | 25 |
| 191-215 | Handlers / Effects Parity | 25 |
| 216-250 | Object Arrays Parity | 35 |
| 251-310 | Maps Zig Parity And Atom 26 | 60 |
| 311-340 | Maps Lua Parity | 30 |
| 341-380 | Logic / Runtime Parity | 40 |
| 381-415 | Entry / Split / Finalize Parity | 35 |
| 416-445 | Live Switch And Rollback | 30 |
| 446-470 | Legacy Emit Deletion | 25 |
| 471-500 | Duplicate / Global Cleanup | 30 |
| 501-535 | Structural Cleanup Foundation | 35 |
| 536-580 | Attrs Decomposition Extraction | 45 |
| 581-605 | Final Verification And Closure | 25 |

## 001-020 Loop Discipline

- [ ] 001. Open this file and read the section index from top to bottom before changing any code.
- [ ] 002. Create a rule for the run: never mark a step complete until the file change and the verification for that step both exist.
- [ ] 003. Create a rule for the run: never use a downstream report as a substitute for re-reading the source file directly.
- [ ] 004. Create a rule for the run: never batch-complete adjacent steps without re-reading each numbered line.
- [ ] 005. Create a rule for the run: never edit a file that is not named by the current step unless the step explicitly permits it.
- [ ] 006. Create a rule for the run: every edit must be followed by reopening the changed file and confirming the intended line is actually present.
- [ ] 007. Create a rule for the run: every verification artifact must be written to disk, not held only in memory.
- [ ] 008. Create a rule for the run: every blocker must be written to a blocked log with exact step id and exact reason.
- [ ] 009. Create a rule for the run: every completed step must be written to a completed log with exact step id and short verification note.
- [ ] 010. Create a rule for the run: if a step depends on an earlier step's artifact, open that artifact directly before proceeding.
- [ ] 011. Create a rule for the run: if a step changes bundle load order, re-read `smith_LOAD_ORDER.txt` after the edit.
- [ ] 012. Create a rule for the run: if a step changes emit output, rerun the smallest available parity check before moving on.
- [ ] 013. Create a rule for the run: if a step changes split output, rerun split verification before moving on.
- [ ] 014. Create a rule for the run: if a step changes runtime bridge code, rerun at least one Lua-map and one Zig-map fixture before moving on.
- [ ] 015. Create a rule for the run: if a step changes a hub file, stop and verify that no pending unverified hub edit remains.
- [ ] 016. Create a rule for the run: keep one current-step pointer on disk and update it after every successful step.
- [ ] 017. Create a rule for the run: if the run stops mid-step, leave the current-step pointer unchanged.
- [ ] 018. Create a rule for the run: every report file must include timestamp, step id, changed files, and verification status.
- [ ] 019. Create a rule for the run: no commit is made until the section's own verification steps are satisfied.
- [ ] 020. Re-read steps 001-019 and confirm the loop discipline is itself explicit enough to follow without reinterpretation.

## 021-050 Workspace Scaffolding

- [ ] 021. Create `tsz/compiler/migration/` if it does not already exist.
- [ ] 022. Create `tsz/compiler/migration/contracts/`.
- [ ] 023. Create `tsz/compiler/migration/reports/`.
- [ ] 024. Create `tsz/compiler/migration/reports/parity/`.
- [ ] 025. Create `tsz/compiler/migration/reports/split/`.
- [ ] 026. Create `tsz/compiler/migration/reports/live_risks/`.
- [ ] 027. Create `tsz/compiler/migration/reports/coverage/`.
- [ ] 028. Create `tsz/compiler/migration/reports/sections/`.
- [ ] 029. Create `tsz/compiler/migration/state/`.
- [ ] 030. Create `tsz/compiler/migration/state/completed.txt`.
- [ ] 031. Create `tsz/compiler/migration/state/blocked.txt`.
- [ ] 032. Create `tsz/compiler/migration/state/current_step.txt`.
- [ ] 033. Write `0` to `tsz/compiler/migration/state/current_step.txt`.
- [ ] 034. Create `tsz/compiler/migration/harness/`.
- [ ] 035. Create `tsz/compiler/migration/harness/fixtures/`.
- [ ] 036. Create `tsz/compiler/migration/harness/output/`.
- [ ] 037. Create `tsz/compiler/migration/harness/output/parity/`.
- [ ] 038. Create `tsz/compiler/migration/harness/output/split/`.
- [ ] 039. Create `tsz/compiler/migration/harness/output/tmp/`.
- [ ] 040. Create `tsz/compiler/migration/control_board.md`.
- [ ] 041. Create `tsz/compiler/migration/MANIFEST.md`.
- [ ] 042. Write the top-level purpose and the step-count table into `migration/MANIFEST.md`.
- [ ] 043. Add a `Current Step` line to `migration/MANIFEST.md`.
- [ ] 044. Add a `Blocked Steps` section to `migration/MANIFEST.md`.
- [ ] 045. Add a `Completed Steps` section to `migration/MANIFEST.md`.
- [ ] 046. Re-open `migration/MANIFEST.md` and confirm it names this proposal as the source of truth for sequencing.
- [ ] 047. Append `021-046 scaffolded` to `migration/state/completed.txt` only after reopening all created files.
- [ ] 048. Update `migration/state/current_step.txt` to `48`.
- [ ] 049. Re-read the directory tree under `tsz/compiler/migration/` and confirm every planned scaffold path exists.
- [ ] 050. If any scaffold path is missing, log the exact path in `blocked.txt` and do not continue.

## 051-080 Canonical Source Capture

- [ ] 051. Copy the current contents of `COMPILER_MANIFEST.md` into `migration/reports/canonical_manifest_snapshot.md`.
- [ ] 052. Copy the current contents of `COMPILER_MANIFEST_FINAL_CUT.md` into `migration/reports/canonical_final_cut_snapshot.md`.
- [ ] 053. Copy the current contents of `FRAGILE_FUNCTION_DECOMPOSITION_MAP.md` into `migration/reports/canonical_decomposition_snapshot.md`.
- [ ] 054. Copy the current contents of `FRAGILE_FUNCTION_REUSE_MAP.md` into `migration/reports/canonical_reuse_snapshot.md`.
- [ ] 055. Copy the current contents of `MIGRATION_AGENT_ORCHESTRATION_PLAN.md` into `migration/reports/canonical_orchestration_snapshot.md`.
- [ ] 056. Record the current git status for the five planning docs into `migration/reports/canonical_git_status.txt`.
- [ ] 057. Record the current date and time at the top of each canonical snapshot file.
- [ ] 058. Create `migration/reports/source_index.md`.
- [ ] 059. In `source_index.md`, list the canonical docs that define migration intent.
- [ ] 060. In `source_index.md`, list the canonical code hubs that define current implementation state.
- [ ] 061. Add `smith/emit.js` to `source_index.md`.
- [ ] 062. Add `smith/emit/finalize.js` to `source_index.md`.
- [ ] 063. Add `smith/emit/split.js` to `source_index.md`.
- [ ] 064. Add `smith/emit_atoms/index.js` to `source_index.md`.
- [ ] 065. Add `smith_LOAD_ORDER.txt` to `source_index.md`.
- [ ] 066. Add `smith/emit_ops/rebuild_map.js` to `source_index.md`.
- [ ] 067. Add `smith/emit_ops/transforms.js` to `source_index.md`.
- [ ] 068. Add `smith/emit_ops/js_expr_to_lua.js` to `source_index.md`.
- [ ] 069. Add `smith/emit_atoms/maps_lua/lua_map_subs.js` to `source_index.md`.
- [ ] 070. Add `smith/attrs.js` to `source_index.md`.
- [ ] 071. Add `smith/parse.js` to `source_index.md`.
- [ ] 072. Add `smith/core.js` to `source_index.md`.
- [ ] 073. Add `smith/parse/handlers/press.js` to `source_index.md`.
- [ ] 074. Add a note in `source_index.md` that implementation intent must be read from canonical docs directly, not reconstructed from downstream reports.
- [ ] 075. Re-open every canonical snapshot and confirm it is readable and complete.
- [ ] 076. Re-open `source_index.md` and confirm no hub file named in the orchestration plan is missing.
- [ ] 077. Append `051-076 canonical source capture complete` to `completed.txt`.
- [ ] 078. Update `current_step.txt` to `78`.
- [ ] 079. Re-read steps 051-078 and confirm every snapshot and source index file exists on disk.
- [ ] 080. If any canonical artifact is missing, write the exact missing file to `blocked.txt` and stop.

## 081-110 Harness Scaffolding

- [ ] 081. Create `migration/harness/parity_schema.json`.
- [ ] 082. In `parity_schema.json`, define `cart_path`.
- [ ] 083. In `parity_schema.json`, define `lane`.
- [ ] 084. In `parity_schema.json`, define `legacy_hash`.
- [ ] 085. In `parity_schema.json`, define `atom_hash`.
- [ ] 086. In `parity_schema.json`, define `diff_status`.
- [ ] 087. In `parity_schema.json`, define `first_diff_hunk`.
- [ ] 088. In `parity_schema.json`, define `split_output`.
- [ ] 089. In `parity_schema.json`, define `backend_tags`.
- [ ] 090. In `parity_schema.json`, define `predicted_atoms`.
- [ ] 091. In `parity_schema.json`, define `verification_time`.
- [ ] 092. Create `migration/harness/run_parity.js`.
- [ ] 093. In `run_parity.js`, add argument parsing for cart path.
- [ ] 094. In `run_parity.js`, add argument parsing for output file path.
- [ ] 095. In `run_parity.js`, add a path to invoke the legacy `emitOutput()` flow.
- [ ] 096. In `run_parity.js`, add a path to invoke the atom `runEmitAtoms()` flow with shared meta.
- [ ] 097. In `run_parity.js`, add string hashing for both outputs.
- [ ] 098. In `run_parity.js`, add exact diff status generation.
- [ ] 099. In `run_parity.js`, add first-diff-hunk capture.
- [ ] 100. In `run_parity.js`, add split-output detection.
- [ ] 101. In `run_parity.js`, add backend tag capture.
- [ ] 102. In `run_parity.js`, add predicted atom capture if route plan is available.
- [ ] 103. In `run_parity.js`, add schema-shaped JSON writing.
- [ ] 104. Create `migration/harness/run_split_check.sh`.
- [ ] 105. In `run_split_check.sh`, accept cart path and output directory.
- [ ] 106. In `run_split_check.sh`, invoke forge in split mode.
- [ ] 107. In `run_split_check.sh`, verify module files are produced.
- [ ] 108. In `run_split_check.sh`, run `zig build` on the produced split output.
- [ ] 109. In `run_split_check.sh`, emit a structured report into `reports/split/`.
- [ ] 110. Re-open `parity_schema.json`, `run_parity.js`, and `run_split_check.sh` and confirm each one exists and contains the intended surface.

## 111-140 Coverage And Live-Risk Baseline

- [ ] 111. Create `migration/reports/coverage/coverage_matrix.json`.
- [ ] 112. Create `migration/reports/coverage/coverage_matrix.md`.
- [ ] 113. Enumerate carts under `tsz/carts/conformance/` into `coverage_matrix.md`.
- [ ] 114. Add lane column for each cart in `coverage_matrix.md`.
- [ ] 115. Add `lua_map` column.
- [ ] 116. Add `zig_map` column.
- [ ] 117. Add `nested_map` column.
- [ ] 118. Add `inline_map` column.
- [ ] 119. Add `dyn_text` column.
- [ ] 120. Add `handlers` column.
- [ ] 121. Add `effects` column.
- [ ] 122. Add `variants` column.
- [ ] 123. Add `split_output` column.
- [ ] 124. Create `migration/reports/live_risks/_jsExprToLua_collision.md`.
- [ ] 125. Create `migration/reports/live_risks/evalLuaMapData_gap.md`.
- [ ] 126. Create `migration/reports/live_risks/atom26_reachability.md`.
- [ ] 127. Create `migration/reports/live_risks/split_finalize_handoff.md`.
- [ ] 128. Search for `_jsExprToLua` definitions and write the result locations into `_jsExprToLua_collision.md`.
- [ ] 129. Search `smith_LOAD_ORDER.txt` for the relative load order of `emit_ops/js_expr_to_lua.js` and `emit_atoms/maps_lua/lua_map_subs.js`.
- [ ] 130. Record the likely winning `_jsExprToLua` definition in `_jsExprToLua_collision.md`.
- [ ] 131. Search for `evalLuaMapData` references and write all current call sites into `evalLuaMapData_gap.md`.
- [ ] 132. Search for `mapBackend` checks and write all Zig vs Lua backend branch points into `atom26_reachability.md`.
- [ ] 133. Search for split handoff logic in `emit/finalize.js`, `emit/split.js`, and atoms 43-46 and summarize it in `split_finalize_handoff.md`.
- [ ] 134. Re-open all four live-risk reports and confirm each one has at least one concrete file path and one concrete finding.
- [ ] 135. Append `111-134 coverage and live-risk baseline complete` to `completed.txt`.
- [ ] 136. Update `current_step.txt` to `136`.
- [ ] 137. Re-open `coverage_matrix.md` and confirm every feature column from steps 115-123 exists.
- [ ] 138. Re-open `_jsExprToLua_collision.md` and confirm it names both colliding files explicitly.
- [ ] 139. Re-open `evalLuaMapData_gap.md` and confirm it names the a003/a038/a039/a040 family explicitly.
- [ ] 140. If any live-risk report is still empty, write the exact missing report path to `blocked.txt` and stop.

## 141-165 Preamble Parity

- [ ] 141. Open `smith/emit/preamble.js`.
- [ ] 142. Open `smith/emit_atoms/preamble/a001_compile_banner.js`.
- [ ] 143. Open `smith/emit_atoms/preamble/a002_core_imports.js`.
- [ ] 144. Open `smith/emit_atoms/preamble/a003_runtime_imports.js`.
- [ ] 145. Re-read the known drift list in `ATOM_PARITY_REPORT.md` for a003 before editing.
- [ ] 146. Verify whether `smith_log` import exists in a003.
- [ ] 147. If `smith_log` import is missing, add it in a003 in the correct condition branch.
- [ ] 148. Re-open a003 and confirm the `smith_log` line is actually present.
- [ ] 149. Verify whether `evalLuaMapData` exists in the IS_LIB stub in a003.
- [ ] 150. If `evalLuaMapData` stub is missing, add it to the IS_LIB fallback struct in a003.
- [ ] 151. Re-open a003 and confirm the `evalLuaMapData` stub line is actually present.
- [ ] 152. Compare luajit import condition in a003 to the monolith and decide whether to match legacy behavior or document the divergence.
- [ ] 153. If matching legacy behavior is required for byte parity, edit the luajit condition in a003 to match exactly.
- [ ] 154. Compare `comptime { _ = core.zig }` ordering between a002/a003 and the monolith.
- [ ] 155. If ordering must change for byte parity, move the line to the correct emitted position.
- [ ] 156. Run the parity harness on one cart that exercises the preamble and write the result to `reports/parity/preamble_smoke.json`.
- [ ] 157. Open `preamble_smoke.json` and verify the schema matches `parity_schema.json`.
- [ ] 158. If the preamble still drifts, record the exact diff hunk in `reports/sections/preamble_status.md`.
- [ ] 159. If the preamble matches, record `MATCH` in `reports/sections/preamble_status.md`.
- [ ] 160. Re-open `preamble_status.md` and confirm it names the exact atom files and exact monolith file compared.
- [ ] 161. Append the exact changed file paths for preamble work to `completed.txt`.
- [ ] 162. Update `current_step.txt` to `162`.
- [ ] 163. Re-open every changed preamble file and confirm no unrelated lines were modified.
- [ ] 164. Re-run the preamble smoke parity once more after the re-open check.
- [ ] 165. If the second preamble run does not match the first result, write the divergence to `blocked.txt` and stop.

## 166-190 State Tree Parity

- [ ] 166. Open `smith/emit/state_manifest.js`.
- [ ] 167. Open `smith/emit/node_tree.js`.
- [ ] 168. Open `smith/emit/dyn_text.js`.
- [ ] 169. Open atoms a004 through a008.
- [ ] 170. Compare a004 to `emitStateManifest()`.
- [ ] 171. Compare a005 to `emitInitState()`.
- [ ] 172. Compare a006 to the static array declaration path in `emitNodeTree()`.
- [ ] 173. Compare a007 to the root node initialization path in `emitNodeTree()`.
- [ ] 174. Compare a008 to `emitDynamicTextBuffers()`.
- [ ] 175. For any mismatch, patch the atom file rather than the monolith file.
- [ ] 176. Re-open each patched atom file after each patch.
- [ ] 177. Run parity on one state-heavy cart and write `reports/parity/state_tree_smoke.json`.
- [ ] 178. Open `state_tree_smoke.json` and inspect `diff_status`.
- [ ] 179. If drift exists, write the exact atom number and first diff hunk to `reports/sections/state_tree_status.md`.
- [ ] 180. If no drift exists, write `MATCH` to `state_tree_status.md`.
- [ ] 181. Re-open `state_tree_status.md` and confirm all five atoms are accounted for.
- [ ] 182. Run a second state-heavy cart if the first cart did not hit dynamic text.
- [ ] 183. If dynamic text was not hit by either cart, write a coverage gap note into `coverage_matrix.md`.
- [ ] 184. Append the exact state-tree verification result paths to `completed.txt`.
- [ ] 185. Update `current_step.txt` to `185`.
- [ ] 186. Re-read steps 166-185 and confirm that any mismatch was fixed in atoms, not in the legacy code.
- [ ] 187. Re-open all changed state-tree atom files and confirm the saved changes match the intended mismatch.
- [ ] 188. Re-run the last successful state-tree parity case.
- [ ] 189. If the rerun result differs from the saved report, log it to `blocked.txt`.
- [ ] 190. Stop only if the rerun differs; otherwise continue.

## 191-215 Handlers / Effects Parity

- [ ] 191. Open `smith/emit/handlers.js`.
- [ ] 192. Open `smith/emit/effects.js`.
- [ ] 193. Open atoms a009, a010, and a011.
- [ ] 194. Compare a009 to non-map handler emission.
- [ ] 195. Compare a010 to CPU effect renderer emission.
- [ ] 196. Compare a011 to WGSL effect shader emission.
- [ ] 197. Verify whether the a010/a011 ordering difference still exists.
- [ ] 198. Decide whether byte parity requires reordering effect output to match the monolith exactly.
- [ ] 199. If reordering is required, patch the atom files so the combined emitted order matches the monolith.
- [ ] 200. Re-open each changed effect atom file and confirm the ordering logic line by line.
- [ ] 201. Run parity on one cart with handlers and write `reports/parity/handlers_smoke.json`.
- [ ] 202. Run parity on one cart with effects and write `reports/parity/effects_smoke.json`.
- [ ] 203. Open both reports and inspect `diff_status`.
- [ ] 204. If either drifts, write the exact mismatch to `reports/sections/handlers_effects_status.md`.
- [ ] 205. If both match, record `MATCH` for a009-a011 in `handlers_effects_status.md`.
- [ ] 206. Re-open `handlers_effects_status.md` and confirm it distinguishes handler drift from effect drift.
- [ ] 207. If no cart hit WGSL output, write a coverage gap note for atom 11 into `coverage_matrix.md`.
- [ ] 208. Append the changed handler/effect file paths and report paths to `completed.txt`.
- [ ] 209. Update `current_step.txt` to `209`.
- [ ] 210. Re-open a009 and verify no in-map handler logic was accidentally pulled into the non-map path.
- [ ] 211. Re-open a010 and verify no WGSL-only logic was placed in the CPU path.
- [ ] 212. Re-open a011 and verify no CPU-only output was placed in the WGSL path.
- [ ] 213. Re-run the last parity case that exercised both handlers and effects.
- [ ] 214. If the rerun differs, log the exact report path and changed file path to `blocked.txt`.
- [ ] 215. Continue only if the rerun is stable.

## 216-250 Object Arrays Parity

- [ ] 216. Open `smith/emit/object_arrays.js`.
- [ ] 217. Open atoms a012 through a018.
- [ ] 218. Compare a012 to the QJS bridge output in the monolith.
- [ ] 219. Compare a013 to the string helper output in the monolith.
- [ ] 220. Compare a014 to const OA storage emission.
- [ ] 221. Compare a015 to dynamic OA storage emission.
- [ ] 222. Compare a016 to flat unpack emission.
- [ ] 223. Compare a017 to nested unpack behavior.
- [ ] 224. Compare a018 to variant host setter emission.
- [ ] 225. Verify whether a017 is intentionally a no-op with logic inlined by a016.
- [ ] 226. If the no-op is intentional, document it in `reports/sections/object_arrays_status.md`.
- [ ] 227. Verify whether helper extraction changed any output ordering in a015 or a016.
- [ ] 228. If ordering changed, patch the atom helper usage so emitted text matches legacy output.
- [ ] 229. Re-open each changed atom file and confirm the intended ordering fix.
- [ ] 230. Run parity on one cart with const OA usage.
- [ ] 231. Write the report to `reports/parity/object_arrays_const.json`.
- [ ] 232. Run parity on one cart with dynamic OA usage.
- [ ] 233. Write the report to `reports/parity/object_arrays_dynamic.json`.
- [ ] 234. Run parity on one cart with nested OA usage if available.
- [ ] 235. Write the report to `reports/parity/object_arrays_nested.json`.
- [ ] 236. Open all three reports and inspect `diff_status`.
- [ ] 237. If any report drifts, write the exact atom id, cart, and first diff hunk to `object_arrays_status.md`.
- [ ] 238. If all reports match, record `MATCH` for a012-a018.
- [ ] 239. Re-open `object_arrays_status.md` and confirm each atom from a012 to a018 is represented.
- [ ] 240. If no nested OA cart exists, record the coverage gap explicitly in `coverage_matrix.md`.
- [ ] 241. Append the exact object-array verification paths to `completed.txt`.
- [ ] 242. Update `current_step.txt` to `242`.
- [ ] 243. Re-open a012 and confirm the bridge surface still matches the runtime import expectations.
- [ ] 244. Re-open a016 and confirm flat unpack still contains nested child handling if that path is expected.
- [ ] 245. Re-open a018 and confirm variant host output was not altered accidentally.
- [ ] 246. Re-run the dynamic OA parity case.
- [ ] 247. Re-run the const OA parity case.
- [ ] 248. Compare rerun hashes to the saved hashes in the report files.
- [ ] 249. If either rerun hash differs, log the difference in `blocked.txt`.
- [ ] 250. Continue only if the rerun hashes match.

## 251-310 Maps Zig Parity And Atom 26

- [ ] 251. Open `smith/emit/map_pools.js`.
- [ ] 252. Open atoms a019 through a028.
- [ ] 253. Open `smith/emit_ops/rebuild_map.js`.
- [ ] 254. Open `smith/emit_ops/compute_map_meta.js`.
- [ ] 255. Open `smith/emit_ops/emit_pool_node.js`.
- [ ] 256. Open `smith/emit_ops/emit_dyn_text.js`.
- [ ] 257. Open `smith/emit_ops/emit_inner_array.js`.
- [ ] 258. Open `smith/emit_ops/emit_handler_fmt.js`.
- [ ] 259. Open `smith/emit_ops/replace_field_refs.js`.
- [ ] 260. Open `smith/emit_ops/wire_handler_ptrs.js`.
- [ ] 261. Open `smith/emit_ops/emit_lua_rebuild.js`.
- [ ] 262. Verify whether atom 26 is currently registered in `emit_atoms/index.js` or atom load order.
- [ ] 263. If atom 26 is unregistered, note the exact missing registration point in `reports/sections/maps_zig_status.md`.
- [ ] 264. Verify whether `_a026_applies` is data-driven and not hardcoded false.
- [ ] 265. If `_a026_applies` needs a meta-driven gate, patch it to use the correct feature flag or derived map predicate.
- [ ] 266. Re-open a026 and confirm the applies gate reads as intended.
- [ ] 267. Verify whether `_a026_emit` routes to the live `rebuildMap()` helper path.
- [ ] 268. If `_a026_emit` does not route correctly, patch it so the helper cluster is the active implementation.
- [ ] 269. Re-open a026 and confirm the helper call line is present.
- [ ] 270. Compare a019 to map metadata output.
- [ ] 271. Compare a020 to flat map pool declarations.
- [ ] 272. Compare a021 to nested map pool declarations.
- [ ] 273. Compare a022 to inline map pool declarations.
- [ ] 274. Compare a023 to map per-item arrays.
- [ ] 275. Compare a024 to dynamic text storage.
- [ ] 276. Compare a025 to map handler pointer storage.
- [ ] 277. Compare a026 to flat map rebuild output.
- [ ] 278. Compare a027 to nested map rebuild output.
- [ ] 279. Compare a028 to inline map rebuild output.
- [ ] 280. Verify whether `compute_map_meta.js` is executed early enough to produce `promotedToPerItem` before all consumers.
- [ ] 281. If `compute_map_meta.js` timing is wrong relative to meta construction, note it in `maps_zig_status.md` before editing.
- [ ] 282. Patch the meta construction path later only after this timing issue is written down explicitly.
- [ ] 283. Search carts for flat Zig-backed map usage and record exact cart paths in `atom26_reachability.md`.
- [ ] 284. Search carts for nested Zig-backed map usage and record exact cart paths.
- [ ] 285. Search carts for inline Zig-backed map usage and record exact cart paths.
- [ ] 286. Search carts for map handlers in Zig-backed maps and record exact cart paths.
- [ ] 287. Search carts for dynamic text in Zig-backed maps and record exact cart paths.
- [ ] 288. Run parity on one flat Zig-map cart and write `reports/parity/maps_zig_flat.json`.
- [ ] 289. Run parity on one nested Zig-map cart if available and write `reports/parity/maps_zig_nested.json`.
- [ ] 290. Run parity on one inline Zig-map cart if available and write `reports/parity/maps_zig_inline.json`.
- [ ] 291. Open the parity reports and inspect `diff_status`.
- [ ] 292. If no suitable cart exists for one Zig map subtype, record that subtype as uncovered in `coverage_matrix.md`.
- [ ] 293. If flat Zig-map parity drifts, isolate whether the drift is in metadata, declaration, or rebuild output.
- [ ] 294. Write the isolated drift category into `maps_zig_status.md`.
- [ ] 295. If the drift is metadata, patch a019 or compute-map-meta path.
- [ ] 296. If the drift is declaration output, patch a020-a025 as needed.
- [ ] 297. If the drift is rebuild output, patch a026 or the helper cluster.
- [ ] 298. Re-open every changed map atom file after each patch.
- [ ] 299. Re-open every changed helper file after each patch.
- [ ] 300. Re-run flat Zig-map parity after every rebuild-cluster change.
- [ ] 301. If nested or inline parity drifts remain, patch a027 and a028 only after the flat path stabilizes.
- [ ] 302. Re-run nested Zig-map parity after any a027 change.
- [ ] 303. Re-run inline Zig-map parity after any a028 change.
- [ ] 304. Update `maps_zig_status.md` with exact final drift status for a019-a028.
- [ ] 305. Append all changed maps-zig file paths and report paths to `completed.txt`.
- [ ] 306. Update `current_step.txt` to `306`.
- [ ] 307. Re-open a026, `rebuild_map.js`, and `compute_map_meta.js` together and confirm the active path is coherent.
- [ ] 308. Re-open `atom26_reachability.md` and confirm it names at least one real Zig-backed path or explicitly records the absence of one.
- [ ] 309. Re-run the strongest available flat Zig-map parity case one final time.
- [ ] 310. If that rerun differs from the saved report, log the exact mismatch to `blocked.txt` and stop.

## 311-340 Maps Lua Parity

- [ ] 311. Open `smith/emit/lua_maps.js` if present or the monolith call sites that feed Lua map logic.
- [ ] 312. Open atoms a029 through a032.
- [ ] 313. Open `smith/emit_atoms/maps_lua/lua_map_node.js`.
- [ ] 314. Open `smith/emit_atoms/maps_lua/lua_map_style.js`.
- [ ] 315. Open `smith/emit_atoms/maps_lua/lua_map_text.js`.
- [ ] 316. Open `smith/emit_atoms/maps_lua/lua_map_handler.js`.
- [ ] 317. Open `smith/emit_atoms/maps_lua/lua_map_subs.js`.
- [ ] 318. Open `smith/emit_atoms/maps_lua/lua_expr.js`.
- [ ] 319. Compare a029 to Lua wrapper registration behavior.
- [ ] 320. Verify whether the `nodes.` prefix conditional mismatch still exists in a029.
- [ ] 321. If the `nodes.` prefix mismatch remains, patch a029 to match monolith split vs monolith behavior exactly.
- [ ] 322. Re-open a029 and confirm the conditional path is explicit.
- [ ] 323. Compare a030 to Lua rebuilder function emission.
- [ ] 324. Compare a031 to nested Lua helper emission.
- [ ] 325. Compare a032 to Lua master dispatch emission.
- [ ] 326. Run parity on one cart that exercises Lua maps and write `reports/parity/maps_lua_smoke.json`.
- [ ] 327. Run parity on one cart with nested Lua maps if available and write `reports/parity/maps_lua_nested.json`.
- [ ] 328. Open both reports and inspect `diff_status`.
- [ ] 329. If nested Lua map coverage is absent, record it in `coverage_matrix.md`.
- [ ] 330. If any Lua map parity drift exists, record exact atom id and first diff hunk in `reports/sections/maps_lua_status.md`.
- [ ] 331. If Lua map parity matches, record `MATCH` for a029-a032.
- [ ] 332. Re-open `maps_lua_status.md` and confirm all four atoms are represented.
- [ ] 333. Append changed Lua-map file paths and report paths to `completed.txt`.
- [ ] 334. Update `current_step.txt` to `334`.
- [ ] 335. Re-open a029 and confirm no split-only assumption remains unless intentionally preserved and documented.
- [ ] 336. Re-open `lua_map_subs.js` and confirm no unintended changes were made while fixing parity.
- [ ] 337. Re-run the Lua map smoke case.
- [ ] 338. Compare the rerun hash to the saved report hash.
- [ ] 339. If the rerun hash differs, write the exact divergence to `blocked.txt`.
- [ ] 340. Continue only if the rerun hash matches.

## 341-380 Logic / Runtime Parity

- [ ] 341. Open `smith/emit/logic_blocks.js`.
- [ ] 342. Open `smith/emit/runtime_updates.js`.
- [ ] 343. Open atoms a033 through a038.
- [ ] 344. Re-read `ATOM_PARITY_REPORT.md` for a033, a034, and a038 before editing.
- [ ] 345. Verify whether a033 still returns an empty string.
- [ ] 346. If a033 is still a stub, implement JS_LOGIC emission to match the monolith exactly.
- [ ] 347. Re-open a033 and confirm the stub is gone.
- [ ] 348. Verify whether a034 still returns an empty string.
- [ ] 349. If a034 is still a stub, implement LUA_LOGIC emission to match the monolith exactly.
- [ ] 350. Re-open a034 and confirm the stub is gone.
- [ ] 351. Verify whether a035 matches dynamic text update emission.
- [ ] 352. Verify whether a036 matches conditional update emission.
- [ ] 353. Verify whether a037 matches variant update emission.
- [ ] 354. Verify whether a038 still lacks `evalLuaMapData()` calls in dirty tick logic.
- [ ] 355. If a038 still lacks the data bridge, patch it to emit the same `evalLuaMapData()` sequence as the monolith.
- [ ] 356. Re-open a038 and confirm the `evalLuaMapData()` calls are present.
- [ ] 357. Run parity on one cart with JS logic and write `reports/parity/logic_js.json`.
- [ ] 358. Run parity on one cart with Lua logic and write `reports/parity/logic_lua.json`.
- [ ] 359. Run parity on one cart with Lua-runtime maps and dirty tick behavior and write `reports/parity/runtime_dirty_tick.json`.
- [ ] 360. Open all three reports and inspect `diff_status`.
- [ ] 361. If a033 or a034 still drift, record the exact first diff hunk in `reports/sections/logic_runtime_status.md`.
- [ ] 362. If a038 still drifts, record the exact dirty tick diff hunk in `logic_runtime_status.md`.
- [ ] 363. If a035-a037 drift, record the exact atom id and first diff hunk as well.
- [ ] 364. If all logic/runtime atoms match, record `MATCH` for a033-a038.
- [ ] 365. Re-open `logic_runtime_status.md` and confirm all six atoms are represented.
- [ ] 366. Re-open a033 and compare its output ordering to the monolith one more time.
- [ ] 367. Re-open a034 and compare its helper ordering to the monolith one more time.
- [ ] 368. Re-open a038 and compare its dirty-tick ordering to the monolith one more time.
- [ ] 369. If any order-sensitive line is still mismatched, patch the atom rather than post-processing the output.
- [ ] 370. Re-open every patched atom after each patch.
- [ ] 371. Re-run `logic_js.json` after any a033 change.
- [ ] 372. Re-run `logic_lua.json` after any a034 change.
- [ ] 373. Re-run `runtime_dirty_tick.json` after any a038 change.
- [ ] 374. Append changed logic/runtime file paths and report paths to `completed.txt`.
- [ ] 375. Update `current_step.txt` to `375`.
- [ ] 376. Re-open the three report files and confirm the saved hashes match the rerun hashes.
- [ ] 377. Re-open `logic_runtime_status.md` and confirm it is not missing a033 or a034 after stub removal.
- [ ] 378. If any rerun hash differs, write the exact report file and changed atom file to `blocked.txt`.
- [ ] 379. Re-read steps 341-378 and confirm stub removal was followed by direct file verification.
- [ ] 380. Continue only if the rerun hashes remain stable.

## 381-415 Entry / Split / Finalize Parity

- [ ] 381. Open `smith/emit/entrypoints.js`.
- [ ] 382. Open `smith/emit/split.js`.
- [ ] 383. Open `smith/emit/finalize.js`.
- [ ] 384. Open atoms a039 through a046.
- [ ] 385. Re-read `ATOM_PARITY_REPORT.md` entries for a039, a040, and a046 before editing.
- [ ] 386. Verify whether a039 is still missing LuaJIT host registration and initial Lua map rebuild behavior.
- [ ] 387. If a039 still lacks those lines, patch a039 to match the monolith exactly.
- [ ] 388. Re-open a039 and confirm the host registration and initial rebuild lines are present.
- [ ] 389. Verify whether a040 still lacks `evalLuaMapData()` calls.
- [ ] 390. If a040 still lacks them, patch a040 to match the monolith.
- [ ] 391. Re-open a040 and confirm the data-bridge calls are present.
- [ ] 392. Verify whether a041 matches exports exactly.
- [ ] 393. Verify whether a042 matches main scaffold exactly.
- [ ] 394. Verify whether a043 matches section extraction.
- [ ] 395. Verify whether a044 matches namespace prefixing.
- [ ] 396. Verify whether a045 matches module header generation.
- [ ] 397. Verify whether a046 matches finalize postpass behavior and split handoff.
- [ ] 398. If a046 calling convention or handoff behavior is ambiguous, write the exact ambiguity to `reports/sections/entry_split_status.md` before patching.
- [ ] 399. Patch a046 only after the ambiguity is written down explicitly.
- [ ] 400. Re-open a046 and confirm the final handoff logic matches `emit/finalize.js`.
- [ ] 401. Run parity on one cart with entry/runtime behavior and write `reports/parity/entry_smoke.json`.
- [ ] 402. Run split verification on one cart and write `reports/split/split_smoke.md`.
- [ ] 403. Open `entry_smoke.json` and inspect `diff_status`.
- [ ] 404. Open `split_smoke.md` and inspect whether split modules were produced and built successfully.
- [ ] 405. If entry or split still drift, record exact file, atom, and first diff hunk in `entry_split_status.md`.
- [ ] 406. If entry and split match, record `MATCH` for a039-a046.
- [ ] 407. Re-open `entry_split_status.md` and confirm all eight atoms are represented.
- [ ] 408. Append changed entry/split file paths and report paths to `completed.txt`.
- [ ] 409. Update `current_step.txt` to `409`.
- [ ] 410. Re-open a039 and confirm no Lua-backend map is incorrectly rebuilt by Zig init code.
- [ ] 411. Re-open a040 and confirm dirty tick still respects state gating.
- [ ] 412. Re-open a046 and confirm split handoff still delegates to `splitOutput()` when `__splitOutput == 1`.
- [ ] 413. Re-run the split smoke case one final time.
- [ ] 414. If the rerun split case differs from the saved report, write the exact difference to `blocked.txt`.
- [ ] 415. Continue only if the rerun split case is stable.

## 416-445 Live Switch And Rollback

- [ ] 416. Open `smith/emit.js`.
- [ ] 417. Extract the current live meta assembly logic into a clearly named `buildEmitMeta()` helper if it does not already exist.
- [ ] 418. Re-open `emit.js` and confirm `buildEmitMeta()` is present and readable.
- [ ] 419. Verify that `buildEmitMeta()` computes `basename`.
- [ ] 420. Verify that `buildEmitMeta()` computes `pfLane`.
- [ ] 421. Verify that `buildEmitMeta()` computes `prefix`.
- [ ] 422. Verify that `buildEmitMeta()` computes `hasState`.
- [ ] 423. Verify that `buildEmitMeta()` computes `hasDynText`.
- [ ] 424. Verify that `buildEmitMeta()` computes `fastBuild`.
- [ ] 425. Verify that `buildEmitMeta()` computes `hasScriptRuntime`.
- [ ] 426. Verify that `buildEmitMeta()` computes `rootExpr`.
- [ ] 427. Verify that `buildEmitMeta()` computes `promotedToPerItem`.
- [ ] 428. Verify that `buildEmitMeta()` computes `hasConds`.
- [ ] 429. Verify that `buildEmitMeta()` computes `hasVariants`.
- [ ] 430. Verify that `buildEmitMeta()` computes `hasDynStyles`.
- [ ] 431. Verify that `buildEmitMeta()` computes `hasFlatMaps` or the exact equivalent feature flag.
- [ ] 432. Patch the non-lua-tree path in `emit.js` to call `runEmitAtoms(ctx, meta)` instead of the legacy orchestration only after all prior parity sections are green.
- [ ] 433. Re-open `emit.js` and confirm the switch line is present.
- [ ] 434. Verify that the lua-tree special case still short-circuits to `emitLuaTreeApp()`.
- [ ] 435. Re-open `emit.js` and confirm the lua-tree path still returns through `finalizeEmitOutput()`.
- [ ] 436. Comment out legacy emit bundle entries in `smith_LOAD_ORDER.txt` only if the rollback plan says "loadable but not loaded" rather than deleted.
- [ ] 437. Re-open `smith_LOAD_ORDER.txt` and confirm the intended load entries are commented rather than removed.
- [ ] 438. Create `migration/reports/rollback_plan.md` and record exactly how to re-enable the legacy path.
- [ ] 439. Run one broad parity case after the switch and write `reports/parity/post_switch_smoke.json`.
- [ ] 440. Run one split-output case after the switch and write `reports/split/post_switch_smoke.md`.
- [ ] 441. Open both reports and confirm the switched path still matches expected output.
- [ ] 442. Append changed switch/rollback file paths and report paths to `completed.txt`.
- [ ] 443. Update `current_step.txt` to `443`.
- [ ] 444. Re-open `rollback_plan.md` and confirm it describes a reversible change, not a code reconstruction.
- [ ] 445. If either post-switch smoke check fails, write the exact failure artifact path to `blocked.txt` and stop.

## 446-470 Legacy Emit Deletion

- [ ] 446. Re-open `rollback_plan.md` and confirm rollback posture has been documented before deletion.
- [ ] 447. Open `smith/emit/preamble.js`.
- [ ] 448. Open `smith/emit/state_manifest.js`.
- [ ] 449. Open `smith/emit/node_tree.js`.
- [ ] 450. Open `smith/emit/dyn_text.js`.
- [ ] 451. Open `smith/emit/handlers.js`.
- [ ] 452. Open `smith/emit/effects.js`.
- [ ] 453. Open `smith/emit/object_arrays.js`.
- [ ] 454. Open `smith/emit/map_pools.js`.
- [ ] 455. Open `smith/emit/logic_blocks.js`.
- [ ] 456. Open `smith/emit/runtime_updates.js`.
- [ ] 457. Open `smith/emit/entrypoints.js`.
- [ ] 458. Verify each of the files from steps 447-457 is now unreachable from the live path.
- [ ] 459. If any file is still live, record the exact import or load-order path in `blocked.txt` and stop.
- [ ] 460. Remove or archive the now-dead orchestration files only after confirming they are unreachable.
- [ ] 461. Keep `emit/transforms.js`, `emit/effect_transpile.js`, `emit/effect_wgsl.js`, `emit/lua_tree_emit.js`, `emit/split.js`, and `emit/finalize.js`.
- [ ] 462. Re-open the kept files and confirm they were not deleted by a broad cleanup.
- [ ] 463. Run one full smoke build after legacy deletion.
- [ ] 464. Write the result to `reports/sections/legacy_emit_deletion_status.md`.
- [ ] 465. Open `legacy_emit_deletion_status.md` and confirm it names all deleted files and all intentionally kept files.
- [ ] 466. Append deletion file paths and smoke report path to `completed.txt`.
- [ ] 467. Update `current_step.txt` to `467`.
- [ ] 468. Re-open `emit.js` and confirm it no longer depends on any deleted emit orchestration file.
- [ ] 469. Re-open `smith_LOAD_ORDER.txt` and confirm deleted files are no longer loaded.
- [ ] 470. If any deleted file name still appears in load order or live imports, write it to `blocked.txt` and stop.

## 471-500 Duplicate / Global Cleanup

- [ ] 471. Open `smith/emit_ops/effect_transpile.js`.
- [ ] 472. Open `smith/emit/effect_transpile.js`.
- [ ] 473. Compare the two effect transpile files for byte identity or exact semantic superset.
- [ ] 474. Keep the canonical copy and mark the duplicate for deletion in `reports/sections/duplicate_cleanup_status.md`.
- [ ] 475. Open `smith/emit_ops/effect_wgsl.js`.
- [ ] 476. Open `smith/emit/effect_wgsl.js`.
- [ ] 477. Compare the two WGSL files for byte identity or exact semantic superset.
- [ ] 478. Keep the canonical copy and mark the duplicate for deletion.
- [ ] 479. Open `smith/emit_ops/transforms.js`.
- [ ] 480. Open `smith/emit/transforms.js`.
- [ ] 481. Compare the two transform files line by line.
- [ ] 482. If the emit version is the superset, mark `emit_ops/transforms.js` for deletion.
- [ ] 483. Open `smith/emit_ops/js_expr_to_lua.js`.
- [ ] 484. Open `smith/emit_atoms/maps_lua/lua_map_subs.js`.
- [ ] 485. Compare `_jsExprToLua` signatures and behaviors directly.
- [ ] 486. Record the winner and exact reason in `_jsExprToLua_collision.md`.
- [ ] 487. If `lua_map_subs.js` is the superset, delete `emit_ops/js_expr_to_lua.js`.
- [ ] 488. If `js_expr_to_lua.js` has required logic missing from `lua_map_subs.js`, port the missing behavior into the kept copy first.
- [ ] 489. Re-open the kept `_jsExprToLua` file and confirm the final signature and behavior explicitly.
- [ ] 490. Re-open `smith_LOAD_ORDER.txt` and confirm only the kept `_jsExprToLua` definition remains in the active load path.
- [ ] 491. Run one Lua-map parity case after `_jsExprToLua` cleanup.
- [ ] 492. Write the result to `reports/parity/js_expr_to_lua_post_cleanup.json`.
- [ ] 493. Open that report and inspect `diff_status`.
- [ ] 494. If the cleanup regressed Lua maps, record the exact diff hunk in `duplicate_cleanup_status.md`.
- [ ] 495. If the cleanup is stable, record `MATCH` in `duplicate_cleanup_status.md`.
- [ ] 496. Append duplicate-cleanup file paths and report paths to `completed.txt`.
- [ ] 497. Update `current_step.txt` to `497`.
- [ ] 498. Re-open `duplicate_cleanup_status.md` and confirm all duplicate pairs are named explicitly.
- [ ] 499. Re-run the Lua-map parity case one final time.
- [ ] 500. If the rerun differs from the saved report, write the exact divergence to `blocked.txt` and stop.

## 501-535 Structural Cleanup Foundation

- [ ] 501. Create `reports/sections/structural_cleanup_status.md`.
- [ ] 502. Re-open `FRAGILE_FUNCTION_REUSE_MAP.md`.
- [ ] 503. Re-open `FRAGILE_FUNCTION_DECOMPOSITION_MAP.md`.
- [ ] 504. Re-open `COMPILER_MANIFEST_FINAL_CUT.md`.
- [ ] 505. Extract the shared-resolution target surface into `reports/sections/resolve_contract.md`.
- [ ] 506. Extract the shared-style target surface into `reports/sections/style_contract.md`.
- [ ] 507. Extract the shared-handler target surface into `reports/sections/handler_contract.md`.
- [ ] 508. Extract the runtime-eval classification target surface into `reports/sections/eval_contract.md`.
- [ ] 509. Create `smith/resolve/const_oa.js` if it does not already exist.
- [ ] 510. Create `smith/resolve/state_access.js` if it does not already exist.
- [ ] 511. Move `resolveConstOaAccess` from `core.js` to `resolve/const_oa.js` or verify that it is already there.
- [ ] 512. Move `resolveConstOaFieldFromRef` from `core.js` to `resolve/const_oa.js` or verify that it is already there.
- [ ] 513. Move `tryResolveObjectStateAccess` from `core.js` to `resolve/state_access.js` or verify that it is already there.
- [ ] 514. Re-open `core.js` and confirm only the intended exports remain.
- [ ] 515. Create `smith/parse/cursor.js` if it does not already exist.
- [ ] 516. Move `parse/utils.js` and `parse/children/brace_util.js` helpers into `parse/cursor.js` or verify the move already exists.
- [ ] 517. Re-open `parse/cursor.js` and confirm the combined helper surface is explicit.
- [ ] 518. Update imports in consumer files that used `parse/utils.js` or `brace_util.js`.
- [ ] 519. Re-open each changed consumer file after updating imports.
- [ ] 520. Create `reports/sections/cursor_consolidation_status.md`.
- [ ] 521. Record the exact moved helpers in `cursor_consolidation_status.md`.
- [ ] 522. Run one parser smoke build after the resolve and cursor moves.
- [ ] 523. Write the result to `reports/parity/structural_foundation_smoke.json`.
- [ ] 524. Open the smoke report and inspect `diff_status`.
- [ ] 525. If the structural foundation smoke drifts, write the exact first diff hunk to `structural_cleanup_status.md`.
- [ ] 526. If it matches, record `MATCH` for the foundation moves.
- [ ] 527. Append changed resolve/cursor file paths and report paths to `completed.txt`.
- [ ] 528. Update `current_step.txt` to `528`.
- [ ] 529. Re-open `resolve_contract.md`, `style_contract.md`, `handler_contract.md`, and `eval_contract.md`.
- [ ] 530. Confirm each contract file names exact functions and exact owning files.
- [ ] 531. Re-open `structural_cleanup_status.md` and confirm the foundation moves are all represented.
- [ ] 532. Re-run the parser smoke build one final time.
- [ ] 533. If the rerun differs, write the exact report path and changed file path to `blocked.txt`.
- [ ] 534. Re-read steps 501-533 and confirm the shared-surface documents were written before broad decomposition started.
- [ ] 535. Continue only if the foundation smoke is stable.

## 536-580 Attrs Decomposition Extraction

- [ ] 536. Create `smith/parse/attrs/` if it does not already exist.
- [ ] 537. Create `smith/parse/attrs/color.js`.
- [ ] 538. Move `parseColor` from `attrs.js` into `parse/attrs/color.js`.
- [ ] 539. Re-open `color.js` and confirm `parseColor` moved cleanly.
- [ ] 540. Create `smith/parse/attrs/style_value.js`.
- [ ] 541. Move `parseStyleValue` into `style_value.js`.
- [ ] 542. Re-open `style_value.js` and confirm `parseStyleValue` moved cleanly.
- [ ] 543. Create `smith/parse/attrs/style_block.js`.
- [ ] 544. Move `parseStyleBlock` into `style_block.js`.
- [ ] 545. Re-open `style_block.js` and confirm `parseStyleBlock` moved cleanly.
- [ ] 546. Create `smith/parse/attrs/style_ternary.js`.
- [ ] 547. Move `parseTernaryBranch` into `style_ternary.js`.
- [ ] 548. Re-open `style_ternary.js` and confirm the move.
- [ ] 549. Create `smith/parse/attrs/style_normalize.js`.
- [ ] 550. Move `_normalizeStyleExprJs` and `_styleExprQuote` into `style_normalize.js`.
- [ ] 551. Re-open `style_normalize.js` and confirm both helpers are present.
- [ ] 552. Create `smith/parse/attrs/style_expr_tokenizer.js`.
- [ ] 553. Move `_readStyleAttrExpressionRaw`, `_tokenizeStyleExpr`, and `_makeStyleTokenStream` into `style_expr_tokenizer.js`.
- [ ] 554. Re-open `style_expr_tokenizer.js` and confirm all three helpers are present.
- [ ] 555. Create `smith/parse/attrs/style_expr_tokens.js`.
- [ ] 556. Move `_stylePeek`, `_styleMatch`, `_styleConsume`, `_styleLooksZigString`, and `_styleLooksZigExpr` into `style_expr_tokens.js`.
- [ ] 557. Re-open `style_expr_tokens.js` and confirm the helper set is complete.
- [ ] 558. Create `smith/parse/attrs/style_expr_spec.js`.
- [ ] 559. Move `_styleSpecToExpr` and `_styleSpecBoolExpr` into `style_expr_spec.js`.
- [ ] 560. Re-open `style_expr_spec.js` and confirm both helpers are present.
- [ ] 561. Create `smith/parse/attrs/style_expr_parser.js`.
- [ ] 562. Move `_styleParsePrimary`, `_styleParseUnary`, `_styleParseComparison`, `_styleParseAnd`, `_styleParseOr`, `_styleParseObjectValue`, `_styleParseObject`, `_styleParseIife`, `_styleParseBase`, and `_styleParseExpr` into `style_expr_parser.js`.
- [ ] 563. Re-open `style_expr_parser.js` and confirm the Pratt parser surface is complete.
- [ ] 564. Create `smith/parse/attrs/style_expr_entry.js`.
- [ ] 565. Move `_parseStyleExprFromRaw`, `parseStyleExpressionAttr`, `_styleExprCollectKeys`, and `_styleExprResolveField` into `style_expr_entry.js`.
- [ ] 566. Re-open `style_expr_entry.js` and confirm the entry surface is complete.
- [ ] 567. Create `smith/parse/attrs/pending_style.js`.
- [ ] 568. Move `_pendingStyleFieldMeta` through `applyPendingStyleExprs` into `pending_style.js`.
- [ ] 569. Re-open `pending_style.js` and confirm the deferred-style surface is complete.
- [ ] 570. Create `smith/parse/attrs/handler.js`.
- [ ] 571. Move `parseHandler` into `handler.js`.
- [ ] 572. Re-open `handler.js` and confirm `parseHandler` moved cleanly.
- [ ] 573. Create `smith/parse/attrs/handler_lua.js`.
- [ ] 574. Move `luaParseHandler` into `handler_lua.js`.
- [ ] 575. Re-open `handler_lua.js` and confirm `luaParseHandler` moved cleanly.
- [ ] 576. Create `smith/parse/attrs/value_expr.js`.
- [ ] 577. Move `parseValueExpr` into `value_expr.js`.
- [ ] 578. Re-open `value_expr.js` and confirm `parseValueExpr` moved cleanly.
- [ ] 579. Create `smith/parse/attrs/value_expr_lua.js`.
- [ ] 580. Move `luaParseValueExpr` into `value_expr_lua.js` and re-open the file to confirm the move.

## 581-605 Final Verification And Closure

- [ ] 581. Update `smith/attrs.js` so it becomes a thin entry surface or compatibility layer after the extraction.
- [ ] 582. Re-open `attrs.js` and confirm it is now thin and explicit.
- [ ] 583. Update imports in `parse/element/attrs_dispatch.js` to use the new `parse/attrs/*` files.
- [ ] 584. Re-open `attrs_dispatch.js` and confirm every imported helper path is correct.
- [ ] 585. Update any direct `attrs.js` consumer in `parse/template_literal.js` if needed.
- [ ] 586. Re-open `parse/template_literal.js` and confirm the import path.
- [ ] 587. Update any direct `attrs.js` consumer in `parse/handlers/press.js` if needed.
- [ ] 588. Re-open `press.js` and confirm the import path.
- [ ] 589. Update any direct `attrs.js` consumer in `collect/classifiers.js` if needed.
- [ ] 590. Re-open `collect/classifiers.js` and confirm the import path.
- [ ] 591. Run one parser/style-heavy parity case and write `reports/parity/attrs_post_split.json`.
- [ ] 592. Run one handler-heavy parity case and write `reports/parity/handlers_post_split.json`.
- [ ] 593. Run one render-local/eval-heavy parity case and write `reports/parity/eval_post_split.json`.
- [ ] 594. Open all three reports and inspect `diff_status`.
- [ ] 595. If any report drifts, write the exact first diff hunk and exact changed file to `reports/sections/final_status.md`.
- [ ] 596. If all three reports match, record `MATCH` in `final_status.md`.
- [ ] 597. Re-open `final_status.md` and confirm it names the attrs extraction and the three post-split verification reports explicitly.
- [ ] 598. Re-open `completed.txt` and confirm every section range from 021 onward has at least one completion line.
- [ ] 599. Re-open `blocked.txt` and confirm it is empty or contains only resolved entries clearly marked as resolved.
- [ ] 600. Re-open `current_step.txt` and confirm it reflects the last completed step.
- [ ] 601. Update `current_step.txt` to `605` only after steps 591-600 are complete.
- [ ] 602. Re-read this entire proposal from 001 through 605 and confirm no section was silently skipped.
- [ ] 603. Write `migration/reports/closure_summary.md` with exact changed files, exact kept files, exact deleted files, exact parity reports, and exact remaining gaps.
- [ ] 604. Re-open `closure_summary.md` and confirm it is specific enough that another reader can audit the run without re-deriving intent.
- [ ] 605. Stop the loop only after `closure_summary.md`, `final_status.md`, `completed.txt`, `blocked.txt`, and `current_step.txt` all agree on the same end state.
