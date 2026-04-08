// ── Lua map handler emit ────────────────────────────────────────
// Turns an onPress handler body into a Lua string expression.
// Uses _jsExprToLua from lua_map_subs.js.

function _handlerToLua(handler, itemParam, indexParam, _luaIdxExpr) {
  if (!handler) return null;
  var h = _jsExprToLua(handler, itemParam, indexParam, _luaIdxExpr);
  var _ixStr = _luaIdxExpr || '(_i - 1)';
  var hasDynamic = h.indexOf('_item') >= 0 || h.indexOf(_ixStr) >= 0 || h.indexOf('(_i - 1)') >= 0;
  if (hasDynamic) {
    return '"' + _spliceDynamicHandler(h, _ixStr) + '"';
  }
  return '"' + h.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// "toggleTodo(_item.id)" → 'toggleTodo(" .. (_item.id) .. ")'
function _spliceDynamicHandler(h, _ixStr) {
  var out = '';
  var i = 0;
  while (i < h.length) {
    var fnStart = h.indexOf('(', i);
    if (fnStart < 0) { out += h.slice(i); break; }
    var fnNameEnd = fnStart;
    while (fnNameEnd > i && h[fnNameEnd - 1] === ' ') fnNameEnd--;
    var fnNameStart = fnNameEnd;
    while (fnNameStart > i && /\w/.test(h[fnNameStart - 1])) fnNameStart--;
    var fnName = h.slice(fnNameStart, fnNameEnd);
    var depth = 1;
    var argStart = fnStart + 1;
    var argEnd = argStart;
    while (argEnd < h.length && depth > 0) {
      if (h[argEnd] === '(') depth++;
      if (h[argEnd] === ')') depth--;
      argEnd++;
    }
    var args = h.slice(argStart, argEnd - 1).trim();
    var argDyn = args.indexOf('_item') >= 0 || args.indexOf('(_i - 1)') >= 0 || (_ixStr && args.indexOf(_ixStr) >= 0);
    out += h.slice(i, fnNameStart);
    if (argDyn && fnName) {
      // Split multi-arg calls: "removeItem(_item.id, _item.label)" → each arg spliced separately
      var _splitArgs = [];
      var _ad = 0, _aStart = 0;
      for (var _ai = 0; _ai <= args.length; _ai++) {
        if (_ai < args.length && args[_ai] === '(') _ad++;
        if (_ai < args.length && args[_ai] === ')') _ad--;
        if ((_ai === args.length || (args[_ai] === ',' && _ad === 0))) {
          _splitArgs.push(args.slice(_aStart, _ai).trim());
          _aStart = _ai + 1;
        }
      }
      var _splicedArgs = [];
      for (var _si = 0; _si < _splitArgs.length; _si++) {
        var _sa = _splitArgs[_si];
        var _isDyn = _sa.indexOf('_item') >= 0 || _sa.indexOf('(_i - 1)') >= 0 || (_ixStr && _sa.indexOf(_ixStr) >= 0);
        if (_isDyn) {
          if (/^_n?item\.\w+$/.test(_sa)) {
            _splicedArgs.push('\'" .. (' + _sa + ') .. "\'');
          } else {
            _splicedArgs.push('" .. (' + _sa + ') .. "');
          }
        } else {
          _splicedArgs.push(_sa.replace(/"/g, '\\"'));
        }
      }
      out += fnName + '(' + _splicedArgs.join(', ') + ')';
    } else {
      // Escape string args so inner quotes don't break the outer lua_on_press = "..." wrapper
      var escapedArgs = args.replace(/"/g, '\\"');
      out += fnName + '(' + escapedArgs + ')';
    }
    i = argEnd;
  }
  return out;
}
