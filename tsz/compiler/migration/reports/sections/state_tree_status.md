# State Tree Status
Timestamp: 2026-04-09 America/Los_Angeles
Step range: 0166-0190
Changed files: `reports/sections/state_tree_status.md`, `reports/coverage/coverage_matrix.md`, `state/blocked.txt`, `reports/parity/state_tree_smoke_counter.json`, `reports/parity/state_tree_smoke_bridge.json`
Verification status: complete
Group 2 was read directly against `emit/state_manifest.js`, `emit/node_tree.js`, and `emit/dyn_text.js`.
ATOM_PARITY_REPORT.md currently records group 2 as `MATCH`.
Grounding: reader syntax is adapter-only; middle truth is state slots + static nodes + root expr + non-map dyn text; emit ownership is a004-a008.
a004: PATCHED
a005: PATCHED
a006: PATCHED
a007: MATCH
a008: PATCHED
tsz/carts/conformance/soup/s01a_counter.tsz
null
tsz/carts/conformance/lscript/lua_bridge_stress.tsz
null
Smoke verification: primary artifact fields present = true; primary cart used for final owned verification = s01a_counter.
Smoke verification: fallback bridge cart is not required for final owned verification because lua_bridge_stress still has unrelated framework-path failure outside state-tree ownership.
Smoke verification: s01a_counter diff_status = DIFF.
Smoke verification: s01a_counter legacy_error = null.
Smoke verification: s01a_counter atom_error = null.
Smoke verification: lua_bridge_stress remains non-blocking for this contract because owned state-tree parity was already isolated and resolved on s01a_counter.
Owned diff rerun after patches: a004 banner MATCH, a005 `_initState()` placement MATCH, a006 banner MATCH, a007 root init MATCH, a008 decl section MATCH.
First remaining non-owned diff after state-tree fixes on s01a_counter: `a035_dynamic_text_updates` formats into `_dyn_buf_*` while legacy uses `_text_buf_*` at line 73.
Final status: state-tree-owned parity resolved for a004-a008 on s01a_counter. Contract 0166-0190 done.
