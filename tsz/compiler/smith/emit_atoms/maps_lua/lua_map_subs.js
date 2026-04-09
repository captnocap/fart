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

function _unwrapQuotedDynamicExpr(expr) {
  return expr.replace(/"((?:[^"\\]|\\.)*)"/g, function(full, inner) {
    var decoded = inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (/^\(+.*(?:==|~=|>=|<=|&&|\|\||\band\b|\bor\b|\?|:).*\)+$/.test(decoded.trim())) {
      return decoded;
    }
    return full;
  });
}

function _convertSimpleJsTernary(expr) {
  for (var _ti = 0; _ti < 8; _ti++) {
    var next = expr.replace(
      /\(([^()?:]+(?:\s+(?:and|or)\s+[^()?:]+)*)\s*\?\s*("[^"]*"|'[^']*'|\d+)\s*:\s*("[^"]*"|'[^']*'|\d+)\)/g,
      '(($1) and $2 or $3)'
    );
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function _collapseRedundantParens(expr) {
  for (var _pi = 0; _pi < 8; _pi++) {
    var next = expr.replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)');
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function _simplifyBoolNumericComparison(expr) {
  function _boolCmp(lhs, op, rhs) {
    lhs = lhs.trim();
    if (lhs === 'true') {
      if ((op === '==' && rhs === '1') || (op === '~=' && rhs === '0')) return 'true';
      if ((op === '~=' && rhs === '1') || (op === '==' && rhs === '0')) return 'false';
    }
    if (lhs === 'false') {
      if ((op === '==' && rhs === '1') || (op === '~=' && rhs === '0')) return 'false';
      if ((op === '~=' && rhs === '1') || (op === '==' && rhs === '0')) return 'true';
    }
    if ((op === '==' && rhs === '1') || (op === '~=' && rhs === '0')) return '(' + lhs + ')';
    if ((op === '~=' && rhs === '1') || (op === '==' && rhs === '0')) return '(not (' + lhs + '))';
    return '(' + lhs + ' ' + op + ' ' + rhs + ')';
  }

  for (var _bi = 0; _bi < 8; _bi++) {
    var next = expr
      .replace(/\(\s*([^()]+(?:==|~=| and | or |not [^()]+)[^()]*)\s*\)\s*(==|~=)\s*(0|1)\b/g, function(_, lhs, op, rhs) {
        return _boolCmp(lhs, op, rhs);
      })
      .replace(/((?:\b[\w.]+\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+)\s*(?:==|~=|>=|<=|>|<)\s*(?:\b[\w.]+\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+))\s*(==|~=)\s*(0|1)\b/g, function(_, lhs, op, rhs) {
        return _boolCmp(lhs, op, rhs);
      })
      .replace(/\b(true|false)\b\s*(==|~=)\s*(0|1)\b/g, function(_, lhs, op, rhs) {
        return _boolCmp(lhs, op, rhs);
      });
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function _normalizeEmbeddedJsEvalForLua(expr) {
  if (!expr || expr.indexOf('__eval("') < 0) return expr;
  return expr.replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(_, inner) {
    var jsExpr = inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!')
      .replace(/~=/g, '!=')
      .replace(/\.len\b/g, '.length');
    return '__eval("' + jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '")';
  });
}

function _protectEmbeddedJsEvalForLua(expr) {
  var protectedExprs = [];
  if (!expr || expr.indexOf('__eval("') < 0) return { expr: expr, protectedExprs: protectedExprs };
  var out = expr.replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(full) {
    var slot = '__JS_EVAL_SLOT_' + protectedExprs.length + '__';
    protectedExprs.push(_normalizeEmbeddedJsEvalForLua(full));
    return slot;
  });
  return { expr: out, protectedExprs: protectedExprs };
}

function _restoreEmbeddedJsEvalForLua(expr, protectedExprs) {
  if (!protectedExprs || protectedExprs.length === 0) return expr;
  return expr.replace(/__JS_EVAL_SLOT_(\d+)__/g, function(_, idx) {
    var restored = protectedExprs[+idx];
    return restored === undefined ? '' : restored;
  });
}

function _isLuaStringLiteral(expr) {
  return /^"(?:[^"\\]|\\.)*"$/.test(expr) || /^'(?:[^'\\]|\\.)*'$/.test(expr);
}

function _splitTopLevelPlus(expr) {
  var parts = [];
  var cur = '';
  var quote = '';
  var escape = false;
  var paren = 0;
  var bracket = 0;
  var brace = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      cur += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;
    else if (ch === '{') brace++;
    else if (ch === '}' && brace > 0) brace--;
    if (paren === 0 && bracket === 0 && brace === 0 && ch === '+') {
      var prev = i > 0 ? expr.charAt(i - 1) : '';
      var next = i + 1 < expr.length ? expr.charAt(i + 1) : '';
      if (prev !== '+' && next !== '+' && prev !== '=' && next !== '=' && prev !== 'e' && prev !== 'E') {
        parts.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim().length > 0) parts.push(cur.trim());
  return parts;
}

function _hasTopLevelConcatUnsafeOps(expr) {
  var quote = '';
  var escape = false;
  var paren = 0;
  var bracket = 0;
  var brace = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;
    else if (ch === '{') brace++;
    else if (ch === '}' && brace > 0) brace--;
    if (paren !== 0 || bracket !== 0 || brace !== 0) continue;
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      var j = i + 1;
      while (j < expr.length) {
        var next = expr.charAt(j);
        if (!((next >= 'a' && next <= 'z') || (next >= 'A' && next <= 'Z') || (next >= '0' && next <= '9') || next === '_')) break;
        j++;
      }
      var word = expr.substring(i, j);
      if (word === 'and' || word === 'or') return true;
      i = j - 1;
      continue;
    }
    if (ch === '?' || ch === ':' || ch === '*' || ch === '/' || ch === '%' || ch === '<' || ch === '>' || ch === '=' || ch === '&' || ch === '|' || ch === '^') {
      return true;
    }
  }
  return false;
}

function _isWrappedByOuterParens(expr) {
  if (!expr || expr.charAt(0) !== '(' || expr.charAt(expr.length - 1) !== ')') return false;
  var quote = '';
  var escape = false;
  var depth = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0 && i < expr.length - 1) return false;
    }
  }
  return depth === 0;
}

function _stripOuterParens(expr) {
  var out = expr.trim();
  while (_isWrappedByOuterParens(out)) out = out.substring(1, out.length - 1).trim();
  return out;
}

function _rewriteJsStringConcatNode(expr, depth) {
  if (!expr) return { expr: expr, isConcat: false, hasString: false };
  if (depth > 12) return { expr: expr, isConcat: false, hasString: false };
  var stripped = _stripOuterParens(expr);
  var parts = _splitTopLevelPlus(stripped);
  if (parts.length < 2 || _hasTopLevelConcatUnsafeOps(stripped)) {
    return { expr: stripped, isConcat: false, hasString: _isLuaStringLiteral(stripped) };
  }

  var hasString = false;
  var rewritten = [];
  for (var i = 0; i < parts.length; i++) {
    var child = _rewriteJsStringConcatNode(parts[i], depth + 1);
    if (child.hasString || child.isConcat || _isLuaStringLiteral(child.expr)) hasString = true;
    rewritten.push(child);
  }
  if (!hasString) return { expr: stripped, isConcat: false, hasString: false };

  var luaParts = [];
  for (var j = 0; j < rewritten.length; j++) {
    var partExpr = rewritten[j].expr.trim();
    if (partExpr.length === 0) return { expr: stripped, isConcat: false, hasString: false };
    if (rewritten[j].isConcat || _isLuaStringLiteral(partExpr) || /^tostring\(([\s\S]+)\)$/.test(partExpr)) luaParts.push(partExpr);
    else luaParts.push('tostring(' + partExpr + ')');
  }
  return { expr: luaParts.join(' .. '), isConcat: true, hasString: true };
}

function _rewriteJsStringConcatToLua(expr) {
  if (!expr || expr.indexOf('+') < 0) return expr;
  var rewritten = _rewriteJsStringConcatNode(expr, 0);
  return rewritten.isConcat ? rewritten.expr : expr;
}

function _normalizePropValueForLua(propValue, _luaIdxExpr) {
  if (typeof propValue !== 'string') return String(propValue);
  var _pv = propValue;
  _pv = _pv.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
  _pv = _pv.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
  _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  if (/@as\(i64,\s*@intCast\((_\w+)\)\)/.test(_pv)) {
    _pv = _pv.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
      if (v === '_i') return '(_i - 1)';
      if (_luaIdxExpr) return _luaIdxExpr;
      return '(' + v + ' - 1)';
    });
  }
  for (var _ci2 = 0; _ci2 < 3; _ci2++) {
    _pv = _pv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
    _pv = _pv.replace(/@intCast\(([^)]+)\)/g, '$1');
    _pv = _pv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  return _pv;
}

function _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr) {
  var _origExpr = expr;
  // _luaIdxExpr: override for the Lua index expression. Defaults to '(_i - 1)'.
  // For nested maps, caller passes '(_ni - 1)' so inner index params resolve correctly.
  var _idxExpr = _luaIdxExpr || '(_i - 1)';
  if (typeof expandRenderLocalRawExpr === 'function' && ctx && ctx._renderLocalRaw) {
    expr = expandRenderLocalRawExpr(expr);
  }
  if (itemParam) expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
  if (indexParam) expr = expr.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), _idxExpr);
  if (ctx && ctx.propStack && ctx.propsObjectName) {
    expr = expr.replace(new RegExp('\\b' + ctx.propsObjectName + '\\.(\\w+)\\b', 'g'), function(_, field) {
      if (ctx.propStack[field] === undefined) return ctx.propsObjectName + '.' + field;
      return _normalizePropValueForLua(ctx.propStack[field], _luaIdxExpr);
    });
  }
  // Resolve component props — bare prop names from inlined components
  // need to be replaced with the actual value (OA ref cleaned for Lua)
  if (ctx && ctx.propStack) {
    for (var _pk in ctx.propStack) {
      if (new RegExp('\\b' + _pk + '\\b').test(expr)) {
        expr = expr.replace(new RegExp('\\b' + _pk + '\\b', 'g'), _normalizePropValueForLua(ctx.propStack[_pk], _luaIdxExpr));
      }
    }
  }
  // Strip Zig builtins that leak from parseTemplateLiteral into Lua expressions
  expr = expr.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
  expr = expr.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
  for (var _zi = 0; _zi < 3; _zi++) {
    expr = expr.replace(/@as\(\[\]const u8,\s*("[^"]*")\)/g, '$1');
    expr = expr.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
    expr = expr.replace(/@intCast\(([^)]+)\)/g, '$1');
    expr = expr.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  // OA length refs: _oa0_len → #getter_name
  if (typeof ctx !== 'undefined' && ctx.objectArrays) {
    expr = expr.replace(/_oa(\d+)_len\b/g, function(_, oaIdx) {
      var _oa = ctx.objectArrays[+oaIdx];
      return _oa ? '#' + _oa.getter : '#_oa' + oaIdx;
    });
  }
  // OA field refs that leaked through: _oa0_field[_i] → _item.field, _oa0_field[_j] → _nitem.field
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  expr = expr.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
  expr = expr.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
  // Zig inner map iterator _j → Lua _ni (nested index)
  expr = expr.replace(/\b_j\b/g, '_ni');
  // Zig state.getSlot* → Lua getter name
  if (typeof ctx !== 'undefined' && ctx.stateSlots) {
    expr = expr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
      var _s = ctx.stateSlots[+idx];
      return _s ? _s.getter : '_slot' + idx;
    });
    expr = expr.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
      var _s = ctx.stateSlots[+idx];
      return _s ? _s.getter : '_slot' + idx;
    });
  }
  // std.mem.eql → Lua string compare
  expr = expr.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
  expr = expr.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
  // Zig qjs_runtime.evalToString → __eval (JS function calls from Lua)
  // Pattern 1: "String(expr)" → __eval("expr")
  expr = expr.replace(/qjs_runtime\.evalToString\("String\(([^"]+)\)"[^)]*\)/g, '__eval("$1")');
  // Pattern 2: general "any JS code" → __eval("code")
  expr = expr.replace(/qjs_runtime\.evalToString\("([^"]+)"[^)]*\)/g, '__eval("$1")');
  expr = expr.replace(/&_eval_buf_\d+/g, '');
  expr = _unwrapQuotedDynamicExpr(expr);
  expr = _collapseRedundantParens(expr);
  var _protectedJsEval = _protectEmbeddedJsEvalForLua(expr);
  expr = _protectedJsEval.expr;
  // Zig if/else chains → Lua and/or (from parseTemplateLiteral ternary emit)
  for (var _ifIter = 0; _ifIter < 10; _ifIter++) {
    var _ifPos = expr.indexOf('if (');
    if (_ifPos < 0) break;
    var _depth = 0, _ci3 = _ifPos + 3;
    for (; _ci3 < expr.length; _ci3++) {
      if (expr[_ci3] === '(') _depth++;
      if (expr[_ci3] === ')') { _depth--; if (_depth === 0) break; }
    }
    if (_depth !== 0) break;
    var _cond = expr.substring(_ifPos + 4, _ci3);
    var _after = expr.substring(_ci3 + 1).trim();
    var _elseIdx = _after.indexOf(' else ');
    if (_elseIdx < 0) break;
    var _trueVal = _after.substring(0, _elseIdx).trim();
    var _prefix = expr.substring(0, _ifPos);
      var _suffix = _after.substring(_elseIdx + 6).trim();
      expr = _prefix + '(' + _cond + ') and ' + _trueVal + ' or ' + _suffix;
  }
  expr = _convertSimpleJsTernary(expr);
  expr = _rewriteJsStringConcatToLua(expr);
  expr = expr.replace(/!==/g, '~=');
  expr = expr.replace(/===/g, '==');
  expr = expr.replace(/!=/g, '~=');
  expr = expr.replace(/\|\|/g, ' or ');
  expr = expr.replace(/&&/g, ' and ');
  expr = _restoreEmbeddedJsEvalForLua(expr, _protectedJsEval.protectedExprs);
  expr = _normalizeEmbeddedJsEvalForLua(expr);
  expr = _collapseRedundantParens(expr);
  expr = _simplifyBoolNumericComparison(expr);
  // Bitwise operators → LuaJIT bit library (after &&/|| so remaining &/| are bitwise)
  if (expr.indexOf('&') >= 0 || expr.indexOf('|') >= 0 || expr.indexOf('^') >= 0 ||
      expr.indexOf('>>') >= 0 || expr.indexOf('<<') >= 0 || /~(?!=)\w/.test(expr)) {
    expr = expr.replace(/~(?!=)(\w+)/g, 'bit.bnot($1)');
    for (var _bp = 0; _bp < 5; _bp++) {
      var _prevE = expr;
      expr = expr.replace(/(\w+)\s*>>\s*(\w+)/g, 'bit.rshift($1, $2)');
      expr = expr.replace(/(\w+)\s*<<\s*(\w+)/g, 'bit.lshift($1, $2)');
      expr = expr.replace(/(\w+)\s*&\s*(\w+)/g, 'bit.band($1, $2)');
      expr = expr.replace(/(\w+)\s*\|\s*(\w+)/g, 'bit.bor($1, $2)');
      expr = expr.replace(/(\w+)\s*\^\s*(\w+)/g, 'bit.bxor($1, $2)');
      if (expr === _prevE) break;
    }
  }
  expr = expr.replace(/'#([0-9a-fA-F]{3,8})'/g, '0x$1');
  expr = expr.replace(/"#([0-9a-fA-F]{3,8})"/g, '0x$1');
  if (expr.indexOf('_item.0') >= 0 || expr.indexOf('0.0') >= 0) {
    print('[MAP_SUB_DEBUG] before=' + _origExpr + ' after=' + expr + ' item=' + (itemParam || '') + ' idx=' + (indexParam || '') + ' props=' + JSON.stringify((ctx && ctx.propStack) || {}));
  }
  return expr;
}
