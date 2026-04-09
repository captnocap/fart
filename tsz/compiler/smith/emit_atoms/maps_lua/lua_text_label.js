// ── Lua text emit: Label/value formatting ────────────────────────
// Label + expression patterns: "label: expr" emission.
// Consumes contract (already normalized by pattern phase).
// Dependencies: _jsExprToLua from lua_map_subs.js, _jsEvalExpr from lua_text_eval.js

// "label: expr" → "label: " .. tostring(expr)
function _luaTextLabelValue(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var colonIdx = text.indexOf(': ');
  if (colonIdx < 0) return _luaTextPlain(text);

  var label = text.slice(0, colonIdx + 2);
  var expr = text.slice(colonIdx + 2).trim();

  // Clean up Zig artifacts that may have leaked through
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  expr = expr.replace(/\.length\b/g, '.length');

  // If expr has brackets or dots, use __eval for safety
  if (/[\[\].]/.test(expr)) {
    return '"' + label + '" .. tostring(' + _jsEvalExpr(expr) + ')';
  }

  return '"' + label + '" .. tostring(' + expr + ')';
}

// Expression with literal suffix: "expr:" → tostring(expr) .. ":"
function _luaTextSuffixExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var suffixExpr = text.slice(0, -1).trim();
  if (suffixExpr.length === 0) return _luaTextPlain(text);

  return 'tostring(' + _luaTextValueExpr(suffixExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) + ') .. ":"';
}
