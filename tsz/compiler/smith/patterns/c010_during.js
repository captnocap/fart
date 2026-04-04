(function() {
// ── Chad Pattern c010: <during> reactive lifecycle ──────────────
// Group: control_flow
// Status: complete
//
// Chad syntax:
//   // In JSX:
//   <during loading>
//     <C.Spinner />
//   </during>
//
//   // In functions:
//   <during recording>
//     media.captureFrame every 33
//   </during>
//
// ── Route chain ──
//
// IN JSX (return):
//   parse/children/conditional_blocks.js:parseDuringBlock()
//     → parseBlockCondition() — identical to <if> condition parsing
//     → ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap })
//     → wrapConditionalChildren() — identical to <if>
//     → semantically different (<during> = lifecycle), but runtime behavior
//       is the same: re-evaluates conditionals on state change
//   emit/runtime_updates.js:emitRuntimeSupportSections()
//     → Zig show_hide — identical to <if> output
//
// IN FUNCTIONS (<functions> body):
//   page.js:transpilePageBody()
//     → matches /^<during\s+(.+)>$/
//     → emits JS: if (transpilePageExpr(condition)) {
//     → </during> → }
//     → in function bodies, <during> acts as conditional execution
//       (same as <if> — runtime already re-evaluates on state change)
//   emit_split.js → JS_LOGIC
//
// NOTES:
//   <during> and <if> produce identical Zig output. The distinction is
//   semantic: <during> implies sustained activation (replaces useEffect),
//   <if> implies point-in-time branching. The runtime treats both as
//   show_hide conditionals that re-evaluate when state changes.
//
// ctx fields: ctx.conditionals, ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c010'] = { id: 'c010', match: match, compile: compile };

})();
