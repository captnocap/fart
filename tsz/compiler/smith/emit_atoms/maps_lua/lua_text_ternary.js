// ── Lua text emit: Ternary expressions ───────────────────────────
// Ternary expression emission: cond ? whenTrue : whenFalse → Lua and/or.
// No semantic reparsing — operates on pre-normalized contract only.
// Dependencies: _jsExprToLua from lua_map_subs.js

// Parse top-level ternary: returns { cond, whenTrue, whenFalse } or null
function _splitTopLevelTernary(expr) {
  if (!expr || expr.indexOf('?') < 0) return null;

  var depthParen = 0, depthBracket = 0, depthBrace = 0;
  var quote = '', escape = false;
  var question = -1;

  // Find top-level ?
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') { depthParen++; continue; }
    if (ch === ')') { if (depthParen > 0) depthParen--; continue; }
    if (ch === '[') { depthBracket++; continue; }
    if (ch === ']') { if (depthBracket > 0) depthBracket--; continue; }
    if (ch === '{') { depthBrace++; continue; }
    if (ch === '}') { if (depthBrace > 0) depthBrace--; continue; }
    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0 && ch === '?') {
      question = i;
      break;
    }
  }

  if (question < 0) return null;

  // Find matching : for this ternary
  depthParen = 0; depthBracket = 0; depthBrace = 0;
  quote = ''; escape = false;
  var ternaryDepth = 0;
  var colon = -1;

  for (var j = question + 1; j < expr.length; j++) {
    var ch2 = expr.charAt(j);
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch2 === '\\') { escape = true; continue; }
      if (ch2 === quote) quote = '';
      continue;
    }
    if (ch2 === '"' || ch2 === "'") { quote = ch2; continue; }
    if (ch2 === '(') { depthParen++; continue; }
    if (ch2 === ')') { if (depthParen > 0) depthParen--; continue; }
    if (ch2 === '[') { depthBracket++; continue; }
    if (ch2 === ']') { if (depthBracket > 0) depthBracket--; continue; }
    if (ch2 === '{') { depthBrace++; continue; }
    if (ch2 === '}') { if (depthBrace > 0) depthBrace--; continue; }
    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      if (ch2 === '?') { ternaryDepth++; continue; }
      if (ch2 === ':') {
        if (ternaryDepth === 0) { colon = j; break; }
        ternaryDepth--;
      }
    }
  }

  if (colon < 0) return null;

  return {
    cond: expr.slice(0, question).trim(),
    whenTrue: expr.slice(question + 1, colon).trim(),
    whenFalse: expr.slice(colon + 1).trim()
  };
}

// String input: "cond ? a : b" → Lua and/or expression
function _luaTextTernaryString(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var tern = _splitTopLevelTernary(text);
  if (!tern) return null;

  // Special case: field !== '' ? field : "default"
  var fieldTern = text.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)?)\s*!==?\s*(['"])\2\s*\?\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)?)\s*:\s*("[^"]*"|'[^']*')$/);
  if (fieldTern) {
    var condExpr = _jsExprToLua(fieldTern[1] + ' !== ""', itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    var trueExpr = _luaTextValueExpr(fieldTern[3], itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    var falseExpr = _luaTextValueExpr(fieldTern[4], itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    return 'tostring(((' + condExpr + ') and (' + trueExpr + ') or (' + falseExpr + ')))';
  }

  // General ternary
  var condExpr = _jsExprToLua(tern.cond, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var trueExpr = _luaTextValueExpr(tern.whenTrue, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var falseExpr = _luaTextValueExpr(tern.whenFalse, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);

  return 'tostring(((' + condExpr + ') and (' + trueExpr + ') or (' + falseExpr + ')))';
}
