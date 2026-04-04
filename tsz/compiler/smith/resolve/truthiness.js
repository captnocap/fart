// ── Resolve: Truthiness ──────────────────────────────────────────
// Convert any expression to a Zig bool. This is the ONE place that
// handles "use this value as a condition".
//
// Every consumer that currently appends != 0, .len > 0, or wraps
// in getSlotBool should call this instead.

// Given any Zig expression, return a valid Zig bool expression.
function zigBool(expr, ctx) {
  if (!expr || typeof expr !== 'string') return '(false)';

  // Already a bool expression — has comparison operator or std.mem.eql
  if (expr.includes(' == ') || expr.includes(' != ') ||
      expr.includes(' > ') || expr.includes(' < ') ||
      expr.includes(' >= ') || expr.includes(' <= ') ||
      expr.includes('std.mem.eql') || expr.includes('.len >') ||
      expr.includes('.len ==')) {
    return '(' + expr + ')';
  }

  // Bool slot — already returns bool
  if (expr.includes('getSlotBool')) return expr;

  // QJS eval — rewrite to JS truthiness check
  if (isEval(expr)) {
    var inner = extractInner(expr);
    if (inner) {
      return '(' + buildBoolEval(inner, ctx) + '.len > 0)';
    }
    // Can't extract inner — fall back to .len > 0
    // (wrong for String(false) but best we can do)
    return '(' + expr + '.len > 0)';
  }

  // State slot (integer) — != 0
  if (expr.includes('state.get') || expr.includes('getSlot') || expr.includes('@as(i64')) {
    return '((' + expr + ') != 0)';
  }

  // OA length — > 0
  if (/_oa\d+_len/.test(expr)) {
    return '(' + expr + ' > 0)';
  }

  // If-expression — already bool
  if (expr.startsWith('if (') || expr.startsWith('(if (')) return expr;

  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return '(' + expr + ' != 0)';
  }

  // Default: treat as integer, != 0
  return '((' + expr + ') != 0)';
}
