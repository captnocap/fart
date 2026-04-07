// ── Lua map substitutions ───────────────────────────────────────
// The ONLY translations from .tsz expressions to Lua expressions.
// Every other maps_lua file uses these. Nothing else does translations.

function _hexToLua(hex) {
  if (hex.charAt(0) === '#') return '0x' + hex.slice(1);
  if (hex.charAt(0) === "'" || hex.charAt(0) === '"') {
    var inner = hex.slice(1, -1);
    if (inner.charAt(0) === '#') return '0x' + inner.slice(1);
  }
  return hex;
}

function _camelToSnake(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function _jsExprToLua(expr, itemParam, indexParam) {
  if (itemParam) expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
  if (indexParam) expr = expr.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), '(_i - 1)');
  // Resolve component props — bare prop names from inlined components
  // need to be replaced with the actual value (OA ref cleaned for Lua)
  if (ctx && ctx.propStack) {
    for (var _pk in ctx.propStack) {
      if (new RegExp('\\b' + _pk + '\\b').test(expr)) {
        var _pv = ctx.propStack[_pk];
        if (typeof _pv === 'string') {
          // Clean Zig OA refs to Lua _item.field
          _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
          _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
          // Strip Zig casts
          _pv = _pv.replace(/@as\([^,]+,\s*/g, '').replace(/@intCast\(/g, '(');
          _pv = _pv.replace(/@floatFromInt\(/g, '(');
          expr = expr.replace(new RegExp('\\b' + _pk + '\\b', 'g'), _pv);
        }
      }
    }
  }
  expr = expr.replace(/===/g, '==');
  expr = expr.replace(/!==/g, '~=');
  expr = expr.replace(/&&/g, 'and');
  expr = expr.replace(/'#([0-9a-fA-F]{3,8})'/g, '0x$1');
  expr = expr.replace(/"#([0-9a-fA-F]{3,8})"/g, '0x$1');
  return expr;
}
