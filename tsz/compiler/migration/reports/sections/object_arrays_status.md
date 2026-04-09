# Object Arrays Status
timestamp: 2026-04-09T00:00:00-07:00
contract: 0216-0250_object_arrays_parity_contract

OA001: PASS opened tsz/compiler/smith/emit/object_arrays.js lines 4-35
OA002: PASS captured historical monolith lines 1-120 from commit 4b2ec008
OA003: PASS captured historical monolith lines 116-220 from commit 4b2ec008
OA004: PASS captured historical monolith lines 220-349 from commit 4b2ec008
OA005: PASS opened tsz/compiler/smith/emit_ops/emit_oa_bridge.js lines 16-27
OA006: PASS opened a012_qjs_bridge.js lines 11-48
OA007: PASS opened a013_oa_string_helpers.js lines 11-42
OA008: PASS opened a014_oa_const_storage.js lines 11-79
OA009: PASS opened a015_oa_dynamic_storage.js lines 12-220
OA010: PASS opened a016_oa_flat_unpack.js lines 14-225
OA011: PASS opened a017_oa_nested_unpack.js lines 20-70
OA012: PASS opened a018_variant_host_setter.js lines 11-42
OA013: PASS opened ATOM_PARITY_REPORT.md lines 63-85
OA014: PASS opened d96_const_array_map.tsz requested ranges
OA015: PASS opened d40_type_annotations.tsz requested ranges
OA016: PASS opened d105_shell_slot_filter_pipeline.tsz requested ranges
OA017: PASS opened d121_variant_switching.tsz lines 11-35
OA018: PASS created object_arrays_status.md
OA019: PASS wrote heading line

Object-array parity is anchored to historical monolith commit 4b2ec008 because the active object_arrays.js wrapper no longer contains the full legacy body.
ATOM_PARITY_REPORT.md currently records a012 through a018 as MATCH, with a017 explicitly documented as a no-op.
Grounding: reader syntax is adapter-only; middle truth is OA schema + storage + unpack + variant-host records; emit ownership is a012-a018.

OA022: true historical lines 7-24 contain fastBuild @cImport, IS_LIB fallback struct, QJS_UNDEFINED
OA023: true a012 emits fastBuild line, IS_LIB fallback struct, QJS_UNDEFINED
OA024: false no fastBuild line patch required in a012
OA025: false no fallback struct order patch required in a012
OA026: false no QJS_UNDEFINED patch required in a012
OA027: PASS re-opened a012 and verified OA024-OA026 targets
OA028: true historical lines 26-38 contain object-array header, _oa_alloc, _oaDupString, _oaFreeString
OA029: true a013 emits same header/helper block order
OA030: false no header patch required in a013
OA031: false no helper block patch required in a013
OA032: PASS re-opened a013 and verified OA030-OA031 targets
OA033: true historical lines 40-57 show dedupe by oaIdx, skip isNested, merge fields by name
OA034: true _mergeOas in a014/a015/a016 matches historical dedupe logic
OA035: false no _mergeOas patch required in a014
OA036: false no _mergeOas patch required in a015
OA037: false no _mergeOas patch required in a016
OA038: true historical const OA output order verified
OA039: true a014 const OA output order matches historical lines 63-76
OA040: false no string escaping patch required in a014
OA041: false no _len/_dirty line patch required in a014
OA042: PASS re-opened a014 and verified dedupe/escaping/_len/_dirty targets
OA043: true historical dynamic storage section order verified
OA044: true a015 emits dynamic sections in historical order
OA045: true historical parent ensureCapacity rules verified (anchor, grow from 64, flat then nested-count)
OA046: true a015 _emitEnsureCapacity matches historical helper order and growth rules
OA047: true historical child ensureCapacity rules verified (grow from 256, child fields then _parentIdx)
OA048: true a015 _emitChildEnsureCapacity matches historical helper order and growth rules
OA049: false no section reorder patch required in a015
OA050: PASS re-opened a015 and verified OA043-OA049 targets
OA051: true historical _oaN_unpack order verified (header->len->ensure->nested totals->loop->finalization->trim->len/dirty->markDirty->return)
OA052: true a016 _a016_emit matches historical unpack order
OA053: true historical nested flattening is inline in unpack loop
OA054: true a016 _emitNestedFieldUnpack contains inline nested extraction/_parentIdx/_nested_total increments
OA055: true a016 _emitFieldExtract preserves jsPath/direct-string/direct-numeric branches
OA056: false no shrink-trim/dirty-marking reorder patch required in a016
OA057: PASS re-opened a016 and verified OA051-OA056 targets
OA058: true a017 header comment states nested unpack emitted inline by a016
OA059: true a017 _a017_emit returns ''
OA060: true ATOM_PARITY_REPORT documents a017 as no-op because nested unpack is inline in a016
OA061: false no return-line patch required in a017
a017: intentional no-op; nested unpack remains inline in a016
OA063: true historical variant-host setter behavior verified
OA064: true a018 emits same function body and branch order
OA065: false no signature patch required in a018
OA066: false no setter branch-order/path patch required in a018
OA067: PASS re-opened a018 and verified OA063-OA066 targets

a012: MATCH
a013: MATCH
a014: MATCH
a015: MATCH
a016: MATCH
a017: MATCH
a018: MATCH

OA075: true parity harness file exists at tsz/compiler/migration/harness/run_parity.js
OA076: PASS wrote parity report tsz/compiler/migration/reports/parity/object_arrays_const.json
OA077: PASS wrote parity report tsz/compiler/migration/reports/parity/object_arrays_dynamic.json
OA078: PASS wrote parity report tsz/compiler/migration/reports/parity/object_arrays_nested.json
OA079: PASS wrote parity report tsz/compiler/migration/reports/parity/object_arrays_variant.json
OA080: true all four parity reports exist
OA081: true all four parity reports contain required schema keys
OA082: false object_arrays_const.json predicted_atoms missing required atoms 12,13,14
OA083: false object_arrays_dynamic.json predicted_atoms missing required atoms 12,13,15,16
OA084: false object_arrays_nested.json predicted_atoms missing required atoms 12,13,15,16,17
OA085: false object_arrays_variant.json predicted_atoms missing required atom 18
OA086: true appended coverage gap line for atom 17 to coverage_matrix.md
OA087: true appended coverage gap line for atom 18 to coverage_matrix.md
OA088: PASS read diff_status from all four reports (all = PENDING)
OA089: true diff_status != match for const cart
tsz/carts/conformance/mixed/d96_const_array_map.tsz
null
OA090: true diff_status != match for dynamic cart
tsz/carts/conformance/mixed/d40_type_annotations.tsz
null
OA091: true diff_status != match for nested cart
tsz/carts/conformance/mixed/d105_shell_slot_filter_pipeline.tsz
null
OA092: true diff_status != match for variant cart
tsz/carts/conformance/mixed/d121_variant_switching.tsz
null
OA093: false not all reports have diff_status == match
OA094: true status file contains atom result lines a012-a018 and required diff entries
OA095: true final re-open check passed for a012 (no unauthorized touched lines)
OA096: true final re-open check passed for a013 (no unauthorized touched lines)
OA097: true final re-open check passed for a014 (no unauthorized touched lines)
OA098: true final re-open check passed for a015 (no unauthorized touched lines)
OA099: true final re-open check passed for a016 (no unauthorized touched lines)
OA100: true final re-open check passed for a017 (no unauthorized touched lines)
OA101: true final re-open check passed for a018 (no unauthorized touched lines)
OA102: true reran parity on d40 and hashes match object_arrays_dynamic.json
OA103: true reran parity on d96 and hashes match object_arrays_const.json
OA104: false rerun hash mismatch condition not met; blocker not appended
OA105: PASS appended completion line to migration/state/completed.txt
OA106: PASS set migration/state/current_step.txt to 0216-0250
OA107: true re-opened completed.txt and current_step.txt and confirmed finished-contract values
OA108: false missing/schema-incomplete parity artifact condition not met; blocker not appended
OA109: false final file verification failed condition not met; blocker not appended
OA110: true all touched atom files, object_arrays_status.md, and four parity report files were re-opened and verified directly

Re-run after supervisor notice (harness commit 94ee7d38):
RERUN-2026-04-09T08:35Z const: diff_status=PENDING legacy_hash=adf7efaebbd3bcfccc9477d47a04cc0119e2fab04abb53eeceec80e108347c52 atom_hash=pending atom_error=atom_path_not_wired predicted_atoms=[]
RERUN-2026-04-09T08:35Z dynamic: diff_status=PENDING legacy_hash=ba43e923bb00dc51182456c0ed293e164117374df89731cab88ba8a858ef5baa atom_hash=pending atom_error=atom_path_not_wired predicted_atoms=[]
RERUN-2026-04-09T08:35Z nested: diff_status=PENDING legacy_hash=4d5fa7fcf87d57059cd9f039a912a8a0272f2606e55a5cb3a7e7e601d63fcfaf atom_hash=pending atom_error=atom_path_not_wired predicted_atoms=[]
RERUN-2026-04-09T08:35Z variant: diff_status=PENDING legacy_hash=aacceaa4f509977bb351298d529afbfec67ba54a22ca679a5c210a8acfe82022 atom_hash=pending atom_error=atom_path_not_wired predicted_atoms=[]
RERUN summary: forge/legacy path is now real and producing stable hashes; atom path is still not wired in harness, so OA parity match gates remain unresolved.

Re-run after supervisor notice (harness commit 967adfde):
RERUN2-2026-04-09T08:43Z const: diff_status=DIFF legacy_hash=f9250fcc3d915fe3612f5238589ebebea3a5910179c3380614d369ea9fda8816 atom_hash=9a98810dbfa9e9abedbf9a69b827cf763be242893a30e02b705e6ebd0888cc81 atom_error=null predicted_atoms=[]
RERUN2-2026-04-09T08:43Z dynamic: diff_status=DIFF legacy_hash=ba43e923bb00dc51182456c0ed293e164117374df89731cab88ba8a858ef5baa atom_hash=9a98810dbfa9e9abedbf9a69b827cf763be242893a30e02b705e6ebd0888cc81 atom_error=null predicted_atoms=[]
RERUN2-2026-04-09T08:43Z nested: diff_status=DIFF legacy_hash=4d5fa7fcf87d57059cd9f039a912a8a0272f2606e55a5cb3a7e7e601d63fcfaf atom_hash=9a98810dbfa9e9abedbf9a69b827cf763be242893a30e02b705e6ebd0888cc81 atom_error=null predicted_atoms=[]
RERUN2-2026-04-09T08:43Z variant: diff_status=DIFF legacy_hash=aacceaa4f509977bb351298d529afbfec67ba54a22ca679a5c210a8acfe82022 atom_hash=9a98810dbfa9e9abedbf9a69b827cf763be242893a30e02b705e6ebd0888cc81 atom_error=null predicted_atoms=[]
RERUN2 const first_diff_hunk:
--- legacy line 1 ---
> // ── app.zig ──
  //! Generated by tsz compiler — d96_const_array_map [app.zig]
  //! Source: d96_const_array_map.tsz
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d102_effect_color_indexing.tsz
RERUN2 dynamic first_diff_hunk:
--- legacy line 1 ---
> // ── app.zig ──
  //! Generated by tsz compiler — d40_type_annotations [app.zig]
  //! Source: d40_type_annotations.tsz
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d102_effect_color_indexing.tsz
RERUN2 nested first_diff_hunk:
--- legacy line 1 ---
> // ── app.zig ──
  //! Generated by tsz compiler — d105_shell_slot_filter_pipeline [app.zig]
  //! Source: d105_shell_slot_filter_pipeline.tsz
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d102_effect_color_indexing.tsz
RERUN2 variant first_diff_hunk:
--- legacy line 1 ---
> // ── app.zig ──
  //! Generated by tsz compiler — d121_variant_switching [app.zig]
  //! Source: d121_variant_switching.tsz
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d102_effect_color_indexing.tsz
RERUN2 summary: harness blocker is lifted (atom path wired), but atom output appears fixed to d102_effect_color_indexing content across all carts, producing DIFF for all object-array parity carts.

Re-run after supervisor notice (harness commit 011a3e34):
RERUN3-2026-04-09T08:55Z const: diff_status=PENDING legacy_hash=dfe60e62e930089035f7b9a5f92b4d080d390bccc530467bb9f49919ed0fbe65 atom_hash=pending atom_error=atom output file not found: /tmp/tsz-gen/parity_atom_output.zig predicted_atoms=[]
RERUN3-2026-04-09T08:55Z dynamic: diff_status=PENDING legacy_hash=dfe60e62e930089035f7b9a5f92b4d080d390bccc530467bb9f49919ed0fbe65 atom_hash=pending atom_error=atom output file not found: /tmp/tsz-gen/parity_atom_output.zig predicted_atoms=[]
RERUN3-2026-04-09T08:55Z nested: diff_status=PENDING legacy_hash=dfe60e62e930089035f7b9a5f92b4d080d390bccc530467bb9f49919ed0fbe65 atom_hash=pending atom_error=atom output file not found: /tmp/tsz-gen/parity_atom_output.zig predicted_atoms=[]
RERUN3-2026-04-09T08:55Z variant: diff_status=PENDING legacy_hash=dfe60e62e930089035f7b9a5f92b4d080d390bccc530467bb9f49919ed0fbe65 atom_hash=pending atom_error=atom output file not found: /tmp/tsz-gen/parity_atom_output.zig predicted_atoms=[]
RERUN3 summary: previous atom hashes are invalidated as requested; current run still fails to produce atom output and legacy output appears cart-invariant, so parity remains blocked.

Re-run after supervisor notice (harness commit 0471f002, pre-split vs pre-split):
RERUN4-2026-04-09T09:06Z const: diff_status=DIFF legacy_hash=06a527447a2a7095b8697ecccbdb09205d52414f3d247b9ba84e3c05e3da0f4e atom_hash=49459cd5d27f3cce47250b2fea095d873d37132c7be413e8678bfb147348b578 atom_error=null predicted_atoms=[]
RERUN4-2026-04-09T09:06Z dynamic: diff_status=DIFF legacy_hash=767d466283a2e562db2bf14a30dd2cab0bef4f6960a2dc2c161cdb39bfa75b9a atom_hash=f04a5daedd1f65f3b96f7c7bae714bce8272eaa580b9320d4773645ed26a3cbc atom_error=null predicted_atoms=[]
RERUN4-2026-04-09T09:06Z nested: diff_status=DIFF legacy_hash=0feb21b8c7076e7ef8860fb05c41a22d2d1f6bec566b2f114a23e0e3a7dc974e atom_hash=1302d0da9c6a47fc81fe76f8ec4ec19814d2b375b8e31bd03cf6671153d18187 atom_error=null predicted_atoms=[]
RERUN4-2026-04-09T09:06Z variant: diff_status=DIFF legacy_hash=d5d4144b9e93f1939d41c6b6abb16d75d5f971da891a23d528b7e19fa829cd07 atom_hash=d0d198c38f74873a4549f7ac8a68720187ab3a6186ba7894c4977151862ec712 atom_error=null predicted_atoms=[]
RERUN4 const first_diff_hunk:
--- legacy line 1 ---
> const std = @import("std");
  const build_options = @import("build_options");
  const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d96_const_array_map.tsz
RERUN4 dynamic first_diff_hunk:
--- legacy line 1 ---
> const std = @import("std");
  const build_options = @import("build_options");
  const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d40_type_annotations.tsz
RERUN4 nested first_diff_hunk:
--- legacy line 1 ---
> const std = @import("std");
  const build_options = @import("build_options");
  const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d105_shell_slot_filter_pipeline.tsz
RERUN4 variant first_diff_hunk:
--- legacy line 1 ---
> const std = @import("std");
  const build_options = @import("build_options");
  const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;
+++ atom line 1 +++
> //! Generated by tsz compiler (Zig) — do not edit
  //!
  //! Source: d121_variant_switching.tsz
RERUN4 summary: hashes are now cart-specific and atom output is present; all carts still DIFF at preamble/file-header surface (line 1), so object-array-specific parity is not yet isolated.

Supervisor follow-up: preamble skipped, OA section analyzed directly (2026-04-09T09:20Z snapshots in /tmp/oa_*).
Finding 1 (critical): legacy pre-split outputs contain zero OA infrastructure for all four carts; atom outputs contain OA infrastructure blocks (`QJS_UNDEFINED`, `_oa_alloc`, `_oa*` storage/helpers).
Finding 1 evidence: d96 legacy `_oa` refs=0 vs atom `_oa` refs=34; d40 legacy 0 vs atom 92; d105 legacy 0 vs atom 168; d121 legacy 0 vs atom 83.
Finding 2 (critical): dynamic/nested/variant carts diverge in atom-owned unpack/variant sections:
- d40: legacy `fn _oa*_unpack` count=0, atom count=1.
- d105: legacy `fn _oa*_unpack` count=0, atom count=1.
- d121: legacy `fn _oa*_unpack` count=0, atom count=1; legacy `fn _setVariantHost` count=0, atom count=1.
Finding 3 (major): legacy still drives map sync via direct `qjs_runtime.evalLuaMapData(...)` without OA host bridge sections, while atom output emits OA const/dynamic storage + unpack helpers and (for d121) variant-host setter.
Conclusion: after skipping preamble, DIFF remains in atom-owned object-array regions, not just line-1 header formatting.

Re-run after supervisor notice (forge parity rebuild 39bae560; preamble 1-22 treated as MATCH externally):
RERUN5-2026-04-09T09:27Z const report: DIFF legacy_hash=2d39db33d33d88b38c95ca080e27a35ff2afd5dffac810be03bc0606f5135f7a atom_hash=be0466c7847e8cc2756f6cb4552e9a5c60372d064905bef0331660e145a3ec63 first_diff at state-manifest separator width.
RERUN5-2026-04-09T09:27Z dynamic report: DIFF legacy_hash=86d352f23e69b089869fd72c680d8a525c46effc5b5782e32d31f81b66378242 atom_hash=f04a5daedd1f65f3b96f7c7bae714bce8272eaa580b9320d4773645ed26a3cbc first_diff at state-manifest separator width.
RERUN5-2026-04-09T09:27Z nested report: DIFF legacy_hash=db5665acad39a41703c1334a4ebf521008ddaa3e6d93d3116128ea2190088b67 atom_hash=37bb6afdfec96caf70cf13d7fdb992922aa34ac67257a175f05f0426a1b818c9 first_diff at state-manifest separator width.
RERUN5-2026-04-09T09:27Z variant report: DIFF legacy_hash=de5e01354cc41b2f0cbe73992deb839ddb0670aaae96017cd55ce267f1ba0db5 atom_hash=d0d198c38f74873a4549f7ac8a68720187ab3a6186ba7894c4977151862ec712 first_diff at state-manifest separator width.
RERUN5 deep OA-section check (beyond first diff), using per-cart snapshots `/tmp/oa2_*`:
- Legacy (all four carts) has no OA-owned symbols: no `QJS_UNDEFINED`, no `// ── Object arrays`, no `_oa_alloc`, no `_oa*_ensureCapacity`, no `_oa*_unpack`, no `_setVariantHost`.
- Atom outputs contain OA-owned symbols as expected:
  - d96: `QJS_UNDEFINED`, object-array header, const OA storage.
  - d40: + `_oa0_ensureCapacity`, `_oa0_unpack`.
  - d105: + `_oa0_ensureCapacity`, child `_oa1_ensureCapacity`, `_oa0_unpack` with nested handling.
  - d121: + `_oa0_ensureCapacity`, `_oa0_unpack`, `_setVariantHost`.
RERUN5 finding: owned-section divergences are real and substantial in a012-a018 surfaces; not preamble noise.

Final adjudication (supervisor directive):
- Legacy absence of OA symbols is expected in parity-mode legacy path for this phase.
- Atom OA infrastructure in a012-a018 is accepted as correct owned behavior.
- Contract 0216-0250 status: DONE (adjudicated).
