# Live Risk: Split Finalize Handoff

Step 133: Split handoff logic summary.
Timestamp: 2026-04-09

## Handoff Chain

1. `smith/emit/finalize.js:38` — `if (globalThis.__splitOutput == 1) return splitOutput(out, file)` — entry point: monolithic output is handed to split flow.
2. `smith/emit/split.js:1` — `splitOutput(monolith, file)` — takes monolithic output, splits into per-concern files (state, nodes, handlers, maps, logic, app).

## Atom Equivalents (a043-a046)

- `a043_split_section_extraction.js` — Extracts sections from monolithic output. Gated on `__splitOutput == 1`. Owner: emit_split.js.
- `a044_split_namespace_prefixing.js` — Adds cross-file symbol qualifiers when symbols move across split boundaries. Owner: emit_split.js.
- `a045_split_module_headers.js` — Generates @import headers for each split file. Cross-module imports (nodes<-handlers, maps<-nodes/st, app<-all). Owner: emit_split.js.
- `a046_finalize_postpass.js` — Final cleanup pass after split. Owner: finalize.js.

## Summary

The split handoff is: finalize.js checks __splitOutput -> calls splitOutput() -> atoms 43-45 decompose the monolith -> atom 46 does final cleanup. All four atoms gate on `__splitOutput == 1`. Current owner for 43-45 is emit_split.js, for 46 is finalize.js.
