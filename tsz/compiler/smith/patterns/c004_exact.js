(function() {
// ── Chad Pattern c004: `exact` binding ──────────────────────────
// Group: core
// Status: complete
//
// Chad syntax:
//   // Immutable constant (in <var>):
//   MAX exact 100
//
//   // Comparison (in <if> / conditions):
//   <if count exact 0>
//   <if status exact 'active'>
//   <if a not exact b>
//   <if count exact or above max>
//   <if count exact or below min>
//
// ── Route chain ──
//
// IN <var> (immutable constant):
//   page.js:parsePageVarBlock()
//     → matches /^(\w+)\s+exact\s+(.+)$/
//     → classifies: string/int/float/boolean or type reference
//     → pushed to stateVars (no setter possible)
//
// IN JSX CONDITIONS (<if>, <during>):
//   conditional_blocks.js:parseBlockCondition()
//     → 'exact or above' (3 tokens) → ' >= '
//     → 'exact or below' (3 tokens) → ' <= '
//     → 'not exact' (2 tokens) → ' != '
//     → bare 'exact' → ' == '
//     → post-process: string slices on either side of == → std.mem.eql()
//   → ctx.conditionals
//
// IN <functions> (expression rewriting):
//   page.js:transpilePageExpr()
//     → 'exact or above' → '>='
//     → 'exact or below' → '<='
//     → 'not exact' → '!=='
//     → bare 'exact' → '==='
//   → ctx.scriptBlock via JS_LOGIC
//
// EMIT (JSX):
//   emit/runtime_updates.js:emitRuntimeSupportSections()
//     → Zig: if (state.getSlot(0) == 0) { ... }
//     → String: if (std.mem.eql(u8, slot_str, "active")) { ... }
//
// EMIT (functions):
//   emit_split.js → JS string: "if (count === 0) { ... }"
//
// ctx fields: ctx.stateSlots, ctx.conditionals, ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c004'] = { id: 'c004', match: match, compile: compile };

})();
