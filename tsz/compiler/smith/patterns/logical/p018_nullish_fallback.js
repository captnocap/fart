// ── Pattern 018: ?? nullish fallback ────────────────────────────
// Index: 18
// Group: logical
// Status: partial
//
// Soup syntax (copy-paste React):
//   {value ?? "default"}
//   <Text>{user.name ?? "Guest"}</Text>
//
// Mixed syntax (hybrid):
//   {value ?? "default"}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Falls through to expression interpolation (p010) via qjs eval:
//   //   .{ .text = "" }   // dynamic text placeholder
//   // In _updateDynText:
//   //   _ = std.fmt.bufPrint(&_dyn_N, "{s}", .{
//   //     qjs_runtime.evalToString("String(value ?? 'default')", &_eval_buf_N)
//   //   }) catch "";
//
// Notes:
//   ?? (nullish coalescing) differs from || in that it only falls back
//   for null/undefined, not for falsy values (0, "", false).
//   The lexer HAS a dedicated ?? token (question_question, lexer.zig:64).
//   No dedicated pattern handler exists — the expression falls through
//   to p010 (expression interpolation) which delegates to qjs eval.
//   QuickJS handles ?? natively in JavaScript, so the expression works
//   correctly at runtime.
//   In the Zig target the null/undefined vs falsy distinction mostly
//   doesn't apply because state slots are always initialized.
//   A dedicated compile path could optimize:
//     - For state slots: always defined → value always wins (elide ??)
//     - For string slots: ?? "default" → if (getSlotString(S).len > 0) ... else "default"
//   But the qjs eval fallback is correct for all cases.
//   Love2d reference: doesn't handle ?? specially — TS compiler resolves it.

function match(c, ctx) {
  // Look for ?? (question_question) token before } or EOF.
  var saved = c.save();
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.question_question && depth === 0) {
      c.restore(saved);
      return true;
    }
    // If we hit ? (ternary) first, this is a different pattern
    if (c.kind() === TK.question && depth === 0) {
      c.restore(saved);
      return false;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Currently no dedicated handler — falls through to expression
  // interpolation (p010) which wraps the whole expression in
  // qjs_runtime.evalToString("String(value ?? 'default')").
  // QuickJS handles ?? natively, so this produces correct results.
  // Returns null to signal the caller should use the fallback path.
  return null;
}
