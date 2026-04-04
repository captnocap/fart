(function() {
// ── Chad Pattern c007: <if> conditional block ──────────────────
// Group: control_flow
// Status: complete
//
// Chad syntax:
//   <if count above 0>
//     <C.Hint>Positive</C.Hint>
//   </if>
//
//   <if status exact 'active'>        → string comparison
//   <if count exact or above max>     → >=
//   <if not loading>                  → boolean negation
//   <if active and count above 0>     → compound
//   <if db.read('...') as rows>       → conditional binding
//
// ── Route chain ──
//
// IN JSX (return):
//   parse/children/conditional_blocks.js:parseIfBlock()
//     → parseBlockCondition() reads tokens until >
//       Word operators: exact→==, above→>, below→<,
//         exact or above→>=, exact or below→<=, not exact→!=
//       Identifier resolution: state slots→getSlot(), OA→_oaN_len,
//         props→propStack, map items→_oaN_field[_i], render locals
//     → post-process: string slices + == → std.mem.eql(u8, ...)
//     → bare boolean: getSlotBool() or (getSlot() != 0) wrapping
//     → ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap })
//     → wrapConditionalChildren(): single child → condIdx, multi → container
//   emit/runtime_updates.js:emitRuntimeSupportSections()
//     → Zig show_hide block per conditional
//
// IN FUNCTIONS (<functions> body):
//   page.js:transpilePageBody()
//     → matches /^<if\s+(.+)>$/
//     → emits JS: if (transpilePageExpr(expr)) {
//     → transpilePageExpr(): above→>, below→<, exact→===, not→!
//   emit_split.js → JS_LOGIC embedded in Zig
//
// CONTEXT BRANCHES:
//   Inside <for>: inMap=true, condIdx per-item (no static array wrapper)
//   Outside <for>: inMap=false, may wrap multi-child in flex container
//   String ==: std.mem.eql(u8, lhs, "rhs") via resolveComparison()
//   Boolean slot: state.getSlotBool(N) directly
//   Numeric slot: (state.getSlot(N) != 0) auto-wrapped
//
// ctx fields: ctx.conditionals, ctx._lastIfCondExpr, ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c007'] = { id: 'c007', match: match, compile: compile };

})();
