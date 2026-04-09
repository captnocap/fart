// ── Lua map text emit ───────────────────────────────────────────
// Turns text content into a Lua string expression.
// Uses _jsExprToLua from lua_map_subs.js.

var _luaTextBuiltins = { tostring:1, tonumber:1, type:1, pairs:1, ipairs:1, print:1, pcall:1, math:1, string:1, table:1, unpack:1, __eval:1 };
function _escapeLuaTextEval(expr) {
  return String(expr).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function _normalizeJsEvalPayload(expr) {
  if (!expr) return '';
  return String(expr)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')
    .replace(/~=/g, '!=')
    .replace(/\.len\b/g, '.length')
    .trim();
}

function _jsEvalExpr(expr) {
  return '__eval("' + _escapeLuaTextEval(_normalizeJsEvalPayload(expr)) + '")';
}

function _normalizeEmbeddedJsEval(expr) {
  if (!expr || String(expr).indexOf('__eval("') < 0) return expr;
  return String(expr).replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(_, inner) {
    return _jsEvalExpr(inner);
  });
}

function _splitTopLevelTextTernary(expr) {
  if (!expr || expr.indexOf('?') < 0) return null;
  var depthParen = 0;
  var depthBracket = 0;
  var depthBrace = 0;
  var quote = '';
  var escape = false;
  var question = -1;
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
  depthParen = 0;
  depthBracket = 0;
  depthBrace = 0;
  quote = '';
  escape = false;
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

function _maybeInlineJsEvalExpr(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!expr) return null;
  var m = String(expr).trim().match(/^__eval\("((?:[^"\\]|\\.)*)"\)$/);
  if (!m) return null;
  var jsExpr = _normalizeJsEvalPayload(m[1]);
  var falseBranch = jsExpr.match(/^\(?\s*(?:0\s*==\s*1|1\s*==\s*0|false)\s*\)?\s*&&\s*[^?]+\?\s*([^:]+)\s*:\s*(.+)$/);
  if (falseBranch) jsExpr = falseBranch[2].trim();
  var trueBranch = jsExpr.match(/^\(?\s*(?:1\s*==\s*1|0\s*==\s*0|true)\s*\)?\s*&&\s*([^?]+)\?\s*([^:]+)\s*:\s*(.+)$/);
  if (trueBranch) jsExpr = '(' + trueBranch[1].trim() + ')?' + trueBranch[2].trim() + ':' + trueBranch[3].trim();
  if (/^_item\.\w+$/.test(jsExpr) || /^_nitem\.\w+$/.test(jsExpr)) return jsExpr;
  if (/^[A-Za-z_]\w*\s*\[[^\]]+\]\s*\.\s*[A-Za-z_]\w+$/.test(jsExpr)) {
    return _jsExprToLua(jsExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }
  if (/^\d+(?:\.\d+)?$/.test(jsExpr)) return jsExpr;
  if (/^"(?:[^"\\]|\\.)*"$/.test(jsExpr)) return jsExpr;
  if (/^'(?:[^'\\]|\\.)*'$/.test(jsExpr)) return '"' + jsExpr.slice(1, -1).replace(/"/g, '\\"') + '"';
  return null;
}

function _needsLuaTextEval(expr) {
  if (!expr) return false;
  if (expr.indexOf('__eval(') >= 0) return false;
  var re = /(^|[^.\w])([A-Za-z_]\w*)\s*\(/g;
  var m;
  while ((m = re.exec(expr)) !== null) {
    if (!_luaTextBuiltins[m[2]]) return true;
  }
  return false;
}

function _luaTextValueExpr(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var luaExpr = _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  luaExpr = luaExpr.replace(/(\w+(?:\.\w+)*)\.length\b/g, '#$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  luaExpr = _normalizeEmbeddedJsEval(luaExpr);
  var _inlineEval = _maybeInlineJsEvalExpr(luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (_inlineEval) return _inlineEval;
  luaExpr = luaExpr.trim();
  if (_needsLuaTextEval(luaExpr)) {
    return _jsEvalExpr(luaExpr);
  }
  return luaExpr;
}

function _wrapLuaTextTostringCalls(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var out = '';
  var cursor = 0;
  while (cursor < expr.length) {
    var start = expr.indexOf('tostring(', cursor);
    if (start < 0) {
      out += expr.slice(cursor);
      break;
    }
    out += expr.slice(cursor, start);
    var innerStart = start + 9;
    var depth = 1;
    var i = innerStart;
    while (i < expr.length && depth > 0) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      i++;
    }
    if (depth !== 0) {
      out += expr.slice(start);
      break;
    }
    var inner = expr.slice(innerStart, i - 1);
    var luaInner = _luaTextValueExpr(inner, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    out += 'tostring(' + luaInner + ')';
    cursor = i;
  }
  return out;
}

function _lowerTextTernaryExpr(raw, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!raw || typeof raw !== 'string' || raw.indexOf('?') < 0 || raw.indexOf(':') < 0) return null;
  var _fieldTern = raw.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)?)\s*!==?\s*(['"])\2\s*\?\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)?)\s*:\s*("[^"]*"|'[^']*')$/);
  if (_fieldTern) {
    var _condExpr = _jsExprToLua(_fieldTern[1] + ' !== ""', itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    var _trueExpr = _luaTextValueExpr(_fieldTern[3], itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    var _falseExpr = _luaTextValueExpr(_fieldTern[4], itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    return 'tostring(((' + _condExpr + ') and (' + _trueExpr + ') or (' + _falseExpr + ')))';
  }
  var _tern = _splitTopLevelTextTernary(raw);
  if (!_tern) return null;
  var _condExpr2 = _jsExprToLua(_tern.cond, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var _trueExpr2 = _luaTextValueExpr(_tern.whenTrue, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var _falseExpr2 = _luaTextValueExpr(_tern.whenFalse, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  return 'tostring(((' + _condExpr2 + ') and (' + _trueExpr2 + ') or (' + _falseExpr2 + ')))';
}

function _repairConcatTernaryLuaExpr(raw, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!raw || typeof raw !== 'string') return null;
  var normalized = raw.replace(/\\"/g, '"');
  var outer = normalized.match(/^tostring\(([^)]+)\)\s*\.\.\s*"(.*)"\s*$/);
  if (!outer) return null;
  var lhsExpr = outer[1].trim();
  var body = outer[2].trim();
  var inner = body.match(/^(!==|===|!=|==)\s*''\s*\?\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)?)\s*:\s*"([^"]*)"$/);
  if (!inner) return null;
  var op = inner[1];
  var trueExprRaw = inner[2].trim();
  var falseLit = '"' + inner[3].replace(/"/g, '\\"') + '"';
  if (/^[A-Za-z_]\w+$/.test(lhsExpr)) {
    var _tf = trueExprRaw.match(/\.([A-Za-z_]\w+)$/);
    if (_tf && _tf[1] === lhsExpr) lhsExpr = trueExprRaw;
  }
  var condExpr = _jsExprToLua(lhsExpr + ' ' + op + ' ""', itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var trueExpr = _luaTextValueExpr(trueExprRaw, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var falseExpr = _luaTextValueExpr(falseLit, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  return 'tostring(((' + condExpr + ') and (' + trueExpr + ') or (' + falseExpr + ')))';
}

function _repairTemplateTernaryExpr(raw, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!raw || typeof raw !== 'string') return null;
  var normalized = raw.replace(/\\"/g, '"');
  var m = normalized.match(/^\$\{([^}]+)\}\s*(!==|===|!=|==)\s*''\s*\?\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)?)\s*:\s*"([^"]*)"$/);
  if (!m) return null;
  var lhsExpr = m[1].trim();
  var op = m[2];
  var trueExprRaw = m[3].trim();
  var falseLit = '"' + m[4].replace(/"/g, '\\"') + '"';
  if (/^[A-Za-z_]\w+$/.test(lhsExpr)) {
    var _tf = trueExprRaw.match(/\.([A-Za-z_]\w+)$/);
    if (_tf && _tf[1] === lhsExpr) lhsExpr = trueExprRaw;
  }
  var condExpr = _jsExprToLua(lhsExpr + ' ' + op + ' ""', itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var trueExpr = _luaTextValueExpr(trueExprRaw, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  var falseExpr = _luaTextValueExpr(falseLit, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  return 'tostring(((' + condExpr + ') and (' + trueExpr + ') or (' + falseExpr + ')))';
}

function _textToLua(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!text) return '""';
  if (typeof text === 'string') {
    var _repairedTextExpr = _repairConcatTernaryLuaExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_repairedTextExpr) return _repairedTextExpr;
    var _repairedTemplateTern = _repairTemplateTernaryExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_repairedTemplateTern) return _repairedTemplateTern;
  }
  // Normalize pre-escaped quotes from parser (prevents double-escaping: \" → \\")
  if (typeof text === 'string') text = text.replace(/\\"/g, '"');

  // Field reference: { field: "title" } → tostring(_item.title)
  if (typeof text === 'object' && text.field) {
    return 'tostring(_item.' + text.field + ')';
  }

  // State variable: { stateVar: "count" } → tostring(count)
  if (typeof text === 'object' && text.stateVar) {
    var _rawStateTern = _lowerTextTernaryExpr(text.stateVar, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_rawStateTern) return _rawStateTern;
    var _sv = text.stateVar;
    // Resolve component props — bare prop names need _item.field substitution
    _sv = _jsExprToLua(_sv, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    _sv = _normalizeEmbeddedJsEval(_sv);
    var _inlineStateEval = _maybeInlineJsEvalExpr(_sv, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_inlineStateEval) _sv = _inlineStateEval;
    var _stateTernary = _lowerTextTernaryExpr(_sv, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_stateTernary) return _stateTernary;
    // If stateVar still has Zig syntax, clean it up
    if (/@|state\.getSlot|\bif\b/.test(_sv)) {
      // Color.rgb → 0xHEX
      _sv = _sv.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      // Strip Zig @as wrappers — handle []const u8 type parameter
      for (var _i = 0; _i < 5; _i++) {
        _sv = _sv.replace(/@as\(\[\]const u8,\s*("[^"]*")\)/g, '$1');
        _sv = _sv.replace(/@as\(\w+,\s*([^)]+)\)/g, '$1');
        _sv = _sv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
        _sv = _sv.replace(/@intCast\(([^)]+)\)/g, '$1');
        _sv = _sv.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
        _sv = _sv.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
      }
      // JS operators → Lua
      _sv = _sv.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
      _sv = _sv.replace(/===/g, '==').replace(/!==/g, '~=');
      // State slots → getter names
      _sv = _sv.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
        return (typeof ctx !== 'undefined' && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
      });
      // OA refs → _item.field
      _sv = _sv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
      _sv = _sv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      // qjs_runtime.evalToString → bare expression
      _sv = _sv.replace(/qjs_runtime\.evalToString\("String\(([^)]+)\)"[^)]*\)/g, '$1');
      _sv = _sv.replace(/&_eval_buf_\d+/g, '');
      // Iterative if/else → and/or (balanced parens, handles chaining)
      for (var _ifIter = 0; _ifIter < 10; _ifIter++) {
        var _ifPos = _sv.indexOf('if (');
        if (_ifPos < 0) break;
        var _depth = 0, _ci = _ifPos + 3;
        for (; _ci < _sv.length; _ci++) {
          if (_sv[_ci] === '(') _depth++;
          if (_sv[_ci] === ')') { _depth--; if (_depth === 0) break; }
        }
        if (_depth !== 0) break;
        var _cond = _sv.substring(_ifPos + 4, _ci);
        var _after = _sv.substring(_ci + 1).trim();
        var _elseIdx = _after.indexOf(' else ');
        if (_elseIdx < 0) break;
        var _trueVal = _after.substring(0, _elseIdx).trim();
        var _prefix = _sv.substring(0, _ifPos);
        var _suffix = _after.substring(_elseIdx + 6).trim();
        _sv = _prefix + '(' + _cond + ') and ' + _trueVal + ' or ' + _suffix;
      }
      // Clean orphan parens
      var _open = (_sv.match(/\(/g) || []).length;
      var _close = (_sv.match(/\)/g) || []).length;
      while (_close > _open && _sv.endsWith(')')) { _sv = _sv.slice(0, -1); _close--; }
      // If clean Lua now (no Zig syntax left), emit bare
      if (!/[@?]/.test(_sv) && !/\bif\b/.test(_sv) && !/qjs_runtime/.test(_sv)) {
        if (_needsLuaTextEval(_sv)) {
          return 'tostring(' + _jsEvalExpr(_sv) + ')';
        }
        var _litPfx2 = _sv.match(/^([^a-zA-Z_(\d#]+)(.+)$/);
        if (_litPfx2 && _litPfx2[1].trim().length > 0) {
          return '"' + _litPfx2[1].replace(/"/g, '\\"') + '" .. tostring(' + _litPfx2[2] + ')';
        }
        return 'tostring(' + _sv + ')';
      }
      return 'tostring(' + _jsEvalExpr(_sv) + ')';
    }
    // Detect literal prefix before expression (e.g. "= _item.weight * ..." from template "= ${expr}")
    var _litPfxMatch = _sv.match(/^([^a-zA-Z_(\d#]+)(.+)$/);
    if (_litPfxMatch && _litPfxMatch[1].trim().length > 0) {
      return '"' + _litPfxMatch[1].replace(/"/g, '\\"') + '" .. tostring(' + _litPfxMatch[2] + ')';
    }
    if (_needsLuaTextEval(_sv)) {
      return 'tostring(' + _jsEvalExpr(_sv) + ')';
    }
    return 'tostring(' + _sv + ')';
  }

  // Lua expression: { luaExpr: "(mode == 0) and \"A\" or \"B\"" }
  if (typeof text === 'object' && text.luaExpr) {
    var _repairedLuaExpr = _repairConcatTernaryLuaExpr(text.luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_repairedLuaExpr) return _repairedLuaExpr;
    return _wrapLuaTextTostringCalls(text.luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Template literal: { parts: [{literal: "hi "}, {expr: "item.x"}] }
  if (typeof text === 'object' && text.parts) {
    var luaParts = [];
    for (var i = 0; i < text.parts.length; i++) {
      var part = text.parts[i];
      if (part.literal) {
        luaParts.push('"' + part.literal.replace(/"/g, '\\"') + '"');
      } else if (part.expr) {
        luaParts.push('tostring(' + _luaTextValueExpr(part.expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) + ')');
      }
    }
    return luaParts.join(' .. ');
  }

  // Template literal string containing ${...} interpolation
  if (typeof text === 'string' && text.indexOf('${') >= 0) {
    var tParts = [];
    var ti = 0;
    while (ti < text.length) {
      if (text[ti] === '$' && ti + 1 < text.length && text[ti + 1] === '{') {
        var tj = ti + 2;
        var tDepth = 1;
        while (tj < text.length && tDepth > 0) {
          if (text[tj] === '{') tDepth++;
          if (text[tj] === '}') tDepth--;
          tj++;
        }
        var tExpr = text.slice(ti + 2, tj - 1).trim();
        tExpr = _luaTextValueExpr(tExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
        tParts.push('tostring(' + tExpr + ')');
        ti = tj;
      } else {
        var tStart = ti;
        while (ti < text.length && !(text[ti] === '$' && ti + 1 < text.length && text[ti + 1] === '{')) ti++;
        var tLit = text.slice(tStart, ti).replace(/"/g, '\\"');
        if (tLit.length > 0) tParts.push('"' + tLit + '"');
      }
    }
    return tParts.join(' .. ');
  }

  // Expression followed by a literal suffix, e.g. "questions[ai].header:"
  if (typeof text === 'string' && /[\].\w]\:$/.test(text) && text.indexOf('${') < 0) {
    var _suffixExpr = text.slice(0, -1).trim();
    if (_suffixExpr.length > 0) {
      return 'tostring(' + _luaTextValueExpr(_suffixExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) + ') .. ":"';
    }
  }

  // Plain JS ternary text expression: cond ? a : b
  if (typeof text === 'string' && text.indexOf('?') >= 0 && text.indexOf(':') >= 0 && text.indexOf('${') < 0) {
    var _plainTernary = _lowerTextTernaryExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (_plainTernary) return _plainTernary;
  }

  // "label: expr" pattern — template literal was unwrapped, label text + expression mashed together
  // e.g. "id: _item.children[subMapIndex].id" → "id: " .. tostring(__eval("_item.children[subMapIndex].id"))
  if (typeof text === 'string' && /^\w+:\s+/.test(text) && (text.indexOf('_item') >= 0 || text.indexOf('[') >= 0 || text.indexOf('.') >= 0)) {
    var _colonIdx = text.indexOf(': ');
    var _label = text.slice(0, _colonIdx + 2);
    var _expr = text.slice(_colonIdx + 2).trim();
    // Clean up Zig artifacts
    _expr = _expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
    _expr = _expr.replace(/\.length\b/g, '.length');
    // If expr has brackets or dots, use __eval for safety
    if (/[\[\].]/.test(_expr)) {
      return '"' + _label + '" .. tostring(' + _jsEvalExpr(_expr) + ')';
    }
    return '"' + _label + '" .. tostring(' + _expr + ')';
  }

  // Plain string with no dynamic refs
  if (typeof text === 'string' && text.indexOf(itemParam) < 0 && (!indexParam || text.indexOf(indexParam) < 0)) {
    return '"' + text.replace(/"/g, '\\"') + '"';
  }

  // Expression string with dynamic refs
  var luaExpr = _jsExprToLua(String(text), itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  // Simple cleanups
  luaExpr = luaExpr.replace(/(\w+(?:\.\w+)*)\.length\b/g, '#$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  luaExpr = _normalizeEmbeddedJsEval(luaExpr);
  var _inlineGenericEval = _maybeInlineJsEvalExpr(luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (_inlineGenericEval) return 'tostring(' + _inlineGenericEval + ')';
  // If still has Zig/JS syntax or broken expressions → __eval with original source
  if (/@|state\.get|getSlot|\bconst\b|\blet\b|=>/.test(luaExpr) ||
      /\)\s+\w/.test(luaExpr) || /\w+\s+\w+/.test(luaExpr.replace(/\band\b|\bor\b|\bnot\b|\btostring\b/g, '').trim())) {
    // Use tostring(__eval("expr")) for safe conversion
    var _jsText = String(text);
    _jsText = _jsText.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
    _jsText = _jsText.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
    _jsText = _jsText.replace(/@as\([^,]+,\s*/g, '').replace(/@intCast\(/g, '(');
    return 'tostring(' + _jsEvalExpr(_jsText) + ')';
  }
  luaExpr = luaExpr.trim();
  if (luaExpr.indexOf('_item') >= 0 || luaExpr.indexOf('(_i - 1)') >= 0 ||
      luaExpr.indexOf('#') >= 0 || luaExpr.indexOf('(') >= 0) {
    // Detect literal prefix before expression (e.g. "= _item.weight * ..." from template "= ${expr}")
    var _litPfx = luaExpr.match(/^([^a-zA-Z_(\d#]+)(.+)$/);
    if (_litPfx && _litPfx[1].trim().length > 0) {
      var _litTail = _litPfx[2].trim();
      if (_needsLuaTextEval(_litTail)) {
        _litTail = _jsEvalExpr(_litTail);
      }
      return '"' + _litPfx[1].replace(/"/g, '\\"') + '" .. tostring(' + _litTail + ')';
    }
    if (_needsLuaTextEval(luaExpr)) {
      return 'tostring(' + _jsEvalExpr(luaExpr) + ')';
    }
    return 'tostring(' + luaExpr + ')';
  }
  return '"' + luaExpr.replace(/"/g, '\\"') + '"';
}
