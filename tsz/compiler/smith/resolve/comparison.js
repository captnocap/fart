// ── Resolve: Comparison ──────────────────────────────────────────
// Normalize any comparison into valid Zig. This is the ONE place
// that handles ===, !==, string comparisons, empty string checks,
// and qjs eval numeric comparisons.
//
// Every consumer that currently has inline regex for === or
// std.mem.eql construction should call this instead.

function _looksBoolLikeComparisonExpr(expr) {
  if (typeof expr !== 'string') return false;
  var trimmed = expr.trim();
  if (trimmed.length === 0) return false;
  if (trimmed === 'true' || trimmed === 'false') return true;
  if (trimmed.indexOf('?') >= 0) return false;
  if (trimmed.indexOf('getSlotBool') >= 0) return true;
  if (trimmed.indexOf('std.mem.eql') >= 0) return true;
  return /(?:==|!=|>=|<=|\band\b|\bor\b|\bnot\b|[<>])/.test(trimmed) || trimmed.charAt(0) === '!';
}

function _resolveBoolNumericComparison(expr, op, rhs) {
  var wrapped = '(' + expr + ')';
  if ((op === '==' && rhs === '1') || (op === '!=' && rhs === '0')) return wrapped;
  if ((op === '!=' && rhs === '1') || (op === '==' && rhs === '0')) return '(!' + wrapped + ')';
  return '(' + expr + ' ' + op + ' ' + rhs + ')';
}

// Normalize a comparison expression to valid Zig.
// Input: lhs (Zig expr), op (JS operator string), rhs (Zig expr or literal)
// Returns: Zig bool expression string
function resolveComparison(lhs, op, rhs, ctx) {
  // 1. Normalize JS operators to Zig
  if (op === '===') op = '==';
  if (op === '!==') op = '!=';

  // 2. Detect types
  var lhsIsQjs = isEval(lhs);
  var rhsIsQjs = isEval(rhs);
  var lhsIsStr = !lhsIsQjs && (lhs.includes('getSlotString') || lhs.includes('[0..') || lhs.includes('getString'));
  var rhsIsStr = !rhsIsQjs && (rhs.includes('getSlotString') || rhs.includes('[0..') || rhs.includes('getString') || /^"[^"]*"$/.test(rhs));
  var rhsIsEmptyStr = /^['"]['"]$/.test(rhs) || rhs === '""';
  var rhsIsNum = /^-?\d+(\.\d+)?$/.test(rhs);

  // 2.5. Bool expr vs 0/1 — preserve JS truthiness semantics.
  if ((rhs === '0' || rhs === '1') && _looksBoolLikeComparisonExpr(lhs)) {
    return _resolveBoolNumericComparison(lhs, op, rhs);
  }

  // 3. QJS eval vs number → do comparison in JS
  if (lhsIsQjs && rhsIsNum) {
    var inner = extractInner(lhs);
    if (inner) {
      return '(' + buildComparisonEval(inner, op, rhs, ctx) + '.len > 0)';
    }
    // Fallback — shouldn't happen if eval_builder works
    return '(' + lhs + '.len > 0)';
  }

  // 4. QJS eval vs string → do comparison in JS
  if (lhsIsQjs && (rhsIsStr || /^"[^"]*"$/.test(rhs))) {
    var inner2 = extractInner(lhs);
    var rhsClean = rhs.replace(/^"/, '').replace(/"$/, '');
    if (inner2) {
      return '(' + buildComparisonEval(inner2, op, "'" + rhsClean + "'", ctx) + '.len > 0)';
    }
    return '(' + lhs + '.len > 0)';
  }

  // 5. Empty string comparison → .len check
  if (rhsIsEmptyStr && (lhsIsStr || lhs.includes('getSlotString'))) {
    if (op === '==' || op === '===') return '(' + lhs + '.len == 0)';
    if (op === '!=' || op === '!==') return '(' + lhs + '.len > 0)';
  }

  // 6. String comparison → std.mem.eql
  if (lhsIsStr || rhsIsStr) {
    var rhsQuoted = /^"[^"]*"$/.test(rhs) ? rhs : '"' + rhs + '"';
    var eql = 'std.mem.eql(u8, ' + lhs + ', ' + rhsQuoted + ')';
    return op === '!=' ? '(!' + eql + ')' : '(' + eql + ')';
  }

  // 7. Normal numeric/bool comparison — pass through
  return '(' + lhs + ' ' + op + ' ' + rhs + ')';
}

// Normalize a JS operator token to Zig
function normalizeOp(op) {
  if (op === '===') return '==';
  if (op === '!==') return '!=';
  return op;
}
