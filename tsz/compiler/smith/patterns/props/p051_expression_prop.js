// ── Pattern 051: Expression prop ────────────────────────────────
// Index: 51
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   <Counter value={a + b} />
//   <Progress percent={score / total * 100} />
//   <Label text={firstName + " " + lastName} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // state getter: propValues["value"] = slotGet("a") + slotGet("b")
//   // → inlined at component call site:
//   nodes._arr_0[0] = .{ .text = state.getSlotString(0) };
//   // render-local arithmetic:
//   const _rl_pct = @divTrunc(score * 100, total);
//   // map item field:
//   _oa0_value[_i]
//   // QuickJS fallback for unresolvable:
//   qjs_runtime.evalToString("String(complexExpr())", &_eval_buf_0)
//
// Notes:
//   Implemented in parse/element/component_brace_values.js → parseComponentBraceValue().
//   Resolution order:
//     1. Script function calls → QuickJS eval (entire expression)
//     2. State getters (isGetter) → slotGet()
//     3. Render-locals (ctx.renderLocals) → pre-resolved Zig expression
//     4. Prop stack (ctx.propStack) → pre-resolved value from parent
//     5. Map item param (ctx.currentMap.itemParam) → OA field reference
//     6. Map index param → @as(i64, @intCast(_i))
//     7. Arithmetic between tokens collected as raw text
//   Template literals inside braces handled by resolveComponentTemplateLiteralValue().
//   Ternary expressions normalized by normalizeComponentTernaryValue().
//   Comparison operators === → == and !== → != automatically.
//   String comparisons detected and rewritten to std.mem.eql().
//   QuickJS eval truthiness: (expr)?'T':'' → .len > 0 for conditionals.
//
//   Partial because:
//     - Complex multi-operator expressions (a + b * c) collected as raw token text,
//       no operator precedence parsing
//     - No parenthesization of sub-expressions
//     - Bitwise operators not handled

function match(c, ctx) {
  // Expression prop = attr name followed by = then { ... }
  // where the brace content is NOT:
  //   - a string literal (p047)
  //   - a number literal (p048)
  //   - a boolean (p050)
  //   - an arrow function (p052)
  //   - a JSX element (p059)
  //   - an object literal (p057)
  //   - an array literal (p058)
  // i.e., it contains operators or function calls
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance();
  // Not JSX
  if (c.kind() === TK.lt) { c.restore(saved); return false; }
  // Not object literal (double brace)
  if (c.kind() === TK.lbrace) { c.restore(saved); return false; }
  // Not array literal
  if (c.kind() === TK.lbracket) { c.restore(saved); return false; }
  // Not arrow function
  if (c.kind() === TK.lparen) {
    var la = c.pos, pd = 1; la++;
    while (la < c.count && pd > 0) {
      if (c.kindAt(la) === TK.lparen) pd++;
      if (c.kindAt(la) === TK.rparen) pd--;
      la++;
    }
    if (la < c.count && c.kindAt(la) === TK.arrow) { c.restore(saved); return false; }
  }
  // Must contain at least one operator or function call to be an expression
  var depth = 0;
  var hasOperator = false;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) { if (depth === 0) break; depth--; }
    if (c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.star ||
        c.kind() === TK.slash || c.kind() === TK.mod || c.kind() === TK.question ||
        c.kind() === TK.eq_eq || c.kind() === TK.not_eq ||
        c.kind() === TK.gt || c.kind() === TK.lt ||
        c.kind() === TK.lparen) {
      hasOperator = true;
      break;
    }
    c.advance();
  }
  c.restore(saved);
  return hasOperator;
}

function compile(c, ctx) {
  // Delegates to parseComponentBraceValue() which handles all resolution.
  // See component_brace_values.js for the full implementation.
  return null;
}
