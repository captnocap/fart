(function() {
// ── Chad Pattern c008: <else> / <else if> ───────────────────────
// Group: control_flow
// Status: complete
//
// Chad syntax:
//   <if number above 0>
//     ...
//   </if>
//   <else if number exact 0>
//     ...
//   </else>
//   <else>
//     ...
//   </else>
//
// ── Route chain ──
//
// IN JSX (return):
//   parse/children/conditional_blocks.js:parseElseBlock()
//     → checks for 'if' token after 'else' → isElseIf
//     → <else if X>: finalCond = '!(' + prevCond + ') and (' + X + ')'
//     → <else>: finalCond = '!(' + prevCond + ')'
//     → prevCond from ctx._lastIfCondExpr (set by preceding parseIfBlock)
//     → ctx.conditionals.push({ condExpr: finalCond, kind: 'show_hide' })
//     → wrapConditionalChildren() same as <if>
//   emit/runtime_updates.js → Zig show_hide with negated condition
//
// IN FUNCTIONS (<functions> body):
//   page.js:transpilePageBody()
//     → </if> followed by <else: merges into } else { (skips closing brace)
//     → <else if expr>: } else if (transpilePageExpr(expr)) {
//     → <else>: } else {
//     → </else>: } (checks if followed by another <else for chaining)
//   emit_split.js → JS_LOGIC
//
// CHAINING:
//   <else if> updates ctx._lastIfCondExpr for further else-if blocks
//   Each block self-closes: </if>, </else> — linear, no backtracking
//
// ctx fields: ctx.conditionals, ctx._lastIfCondExpr, ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c008'] = { id: 'c008', match: match, compile: compile };

})();
