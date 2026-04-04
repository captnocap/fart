// ── Resolve: Ternary ─────────────────────────────────────────────
// Compile cond ? trueVal : falseVal into a Zig if/else expression
// with correct type annotations (@as for type unification).
//
// Every consumer that builds `if (cond) X else Y` with inline
// @as() wrapping should call this instead.

// Build a Zig if/else expression from a condition and two branches.
// context: 'text' | 'color' | 'style' | 'number' | 'auto'
function zigTernary(condExpr, trueVal, falseVal, context) {
  if (context === 'color') {
    return 'if ' + condExpr + ' ' + trueVal + ' else ' + falseVal;
  }

  if (context === 'text' || context === 'auto') {
    var tIsStr = /^"[^"]*"$/.test(trueVal);
    var fIsStr = /^"[^"]*"$/.test(falseVal);
    if (tIsStr && fIsStr) {
      return 'if ' + condExpr + ' @as([]const u8, ' + trueVal + ') else @as([]const u8, ' + falseVal + ')';
    }
    var tIsNum = /^-?\d+(\.\d+)?$/.test(trueVal);
    var fIsNum = /^-?\d+(\.\d+)?$/.test(falseVal);
    if (tIsNum && fIsNum) {
      return 'if ' + condExpr + ' @as(i64, ' + trueVal + ') else @as(i64, ' + falseVal + ')';
    }
    return 'if ' + condExpr + ' ' + trueVal + ' else ' + falseVal;
  }

  if (context === 'number') {
    var tNum = /^-?\d+(\.\d+)?$/.test(trueVal);
    var fNum = /^-?\d+(\.\d+)?$/.test(falseVal);
    if (tNum && fNum) {
      return 'if ' + condExpr + ' @as(i64, ' + trueVal + ') else @as(i64, ' + falseVal + ')';
    }
    return 'if ' + condExpr + ' ' + trueVal + ' else ' + falseVal;
  }

  if (context === 'style') {
    return 'if ' + condExpr + ' ' + trueVal + ' else ' + falseVal;
  }

  // Default
  return 'if ' + condExpr + ' ' + trueVal + ' else ' + falseVal;
}

// Strip quotes from a string value (single or double)
function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return null;
}
