// ── JSX component prop brace-value helpers ───────────────────────

function tryParseComponentBraceProp(c, attr, propValues) {
  if (c.kind() !== TK.lbrace) return false;

  c.advance();
  if (c.kind() === TK.lt) {
    const jsxResult = parseJSXElement(c);
    if (c.kind() === TK.rbrace) c.advance();
    propValues[attr] = { __jsxSlot: true, result: jsxResult };
    return true;
  }

  if (tryResolveMappedComponentProp(c, attr, propValues)) return true;

  propValues[attr] = parseComponentBraceValue(c);
  return true;
}

function tryResolveMappedComponentProp(c, attr, propValues) {
  if (!(ctx.currentMap && c.kind() === TK.identifier)) return false;

  const saved = c.save();
  let matchMap = null;
  let mapCursor = ctx.currentMap;
  while (mapCursor) {
    if (c.text() === mapCursor.itemParam) {
      matchMap = mapCursor;
      break;
    }
    mapCursor = mapCursor.parentMap;
  }

  if (!matchMap) {
    c.restore(saved);
    return false;
  }

  c.advance();
  if (c.kind() !== TK.dot) {
    c.restore(saved);
    return false;
  }

  c.advance();
  if (c.kind() !== TK.identifier) {
    c.restore(saved);
    return false;
  }

  const field = c.text();
  const oa = matchMap.oa;
  const fieldInfo = oa.fields.find(ff => ff.name === field);
  if (!fieldInfo) {
    c.restore(saved);
    return false;
  }

  let idx = '_i';
  if (matchMap !== ctx.currentMap) {
    const backrefField = ctx.currentMap.oa.fields.find(ff => ff.name === matchMap.itemParam + 'Idx');
    if (backrefField) idx = `@intCast(_oa${ctx.currentMap.oa.oaIdx}_${backrefField.name}[_i])`;
  }

  if (fieldInfo.type === 'string') {
    propValues[attr] = `_oa${oa.oaIdx}_${field}[${idx}][0.._oa${oa.oaIdx}_${field}_lens[${idx}]]`;
  } else {
    propValues[attr] = `_oa${oa.oaIdx}_${field}[${idx}]`;
  }

  c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  return true;
}

function parseComponentBraceValue(c) {
  // Script function call as brace value: funcName(...) ? ... : ...
  // Detect unresolvable identifier followed by ( — route entire expression through QuickJS
  if ((ctx.scriptBlock || globalThis.__scriptContent) &&
      c.kind() === TK.identifier && !isGetter(c.text()) &&
      !(ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) &&
      !(ctx.propStack && ctx.propStack[c.text()] !== undefined) &&
      c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
    // Collect raw tokens as JS expression for QuickJS eval
    let rawParts = [];
    let bd = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && bd === 0) break;
      if (c.kind() === TK.lbrace) bd++;
      if (c.kind() === TK.rbrace) bd--;
      rawParts.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    let rawExpr = rawParts.join(' ').replace(/\s*\.\s*/g, '.').replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')').replace(/\s*,\s*/g, ', ');
    // If it's a ternary, extract branches: cond ? "then" : "else"
    let qIdx = -1, bd2 = 0;
    for (let ri = 0; ri < rawExpr.length; ri++) {
      if (rawExpr[ri] === '(') bd2++;
      else if (rawExpr[ri] === ')') bd2--;
      else if (rawExpr[ri] === '?' && bd2 === 0) { qIdx = ri; break; }
    }
    // Eval the entire expression via QuickJS — ternary and all
    if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
    let evalBufId = ctx._jsEvalCount;
    ctx._jsEvalCount = evalBufId + 1;
    let escaped = rawExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return 'qjs_runtime.evalToString("String(' + escaped + ')", &_eval_buf_' + evalBufId + ')';
  }

  let val = '';
  let depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) {
      if (depth === 0) break;
      depth--;
    }

    const propAccess = peekPropsAccess(c);
    if (propAccess) {
      skipPropsAccess(c);
      val += typeof propAccess.value === 'string' ? propAccess.value : String(propAccess.value);
      continue;
    }

    // Const OA bracket access: nodes[0] or nodes[0].field
    var _coaR = (c.kind() === TK.identifier) ? resolveConstOaAccess(c) : null;
    if (_coaR) {
      val += _coaR.value;
      for (var _ski = 1; _ski < _coaR.skip; _ski++) c.advance();
      c.advance();
      continue;
    }

    // Object state field access: cursorPosition.line → state.getSlot(N)
    var _osResult = tryResolveObjectStateAccess(c);
    if (_osResult) {
      val += _osResult;
      continue;
    }

    if (c.kind() === TK.template_literal) {
      const resolvedTemplate = resolveComponentTemplateLiteralValue(c);
      if (resolvedTemplate !== null) {
        val = resolvedTemplate;
        break;
      }
      val += c.text();
    } else if (c.kind() === TK.identifier && isGetter(c.text())) {
      val += slotGet(c.text());
    } else if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
      var _rlv = ctx.renderLocals[c.text()];
      // Const OA row ref with .field access
      if (typeof _rlv === 'string' && _rlv.charCodeAt(0) === 1 &&
          c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        var _fld = resolveConstOaFieldFromRef(_rlv, c.textAt(c.pos + 2));
        if (_fld !== null) {
          val += _fld;
          c.advance(); c.advance(); // skip name and dot; field advanced below
        } else {
          val += _rlv;
        }
      } else if (typeof _rlv === 'string' && _rlv.includes('qjs_runtime.evalToString') &&
          c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        // qjs eval render-local + .field → route field access through QuickJS
        var _rlName = c.text();
        var _qField = c.textAt(c.pos + 2);
        // Use raw expression if available, otherwise try to extract from eval string
        var _rawExpr = ctx._renderLocalRaw && ctx._renderLocalRaw[_rlName];
        if (_rawExpr) {
          if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
          var _qBuf = ctx._jsEvalCount; ctx._jsEvalCount = _qBuf + 1;
          var _qEsc = _rawExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          val += 'qjs_runtime.evalToString("String((' + _qEsc + ').' + _qField + ')", &_eval_buf_' + _qBuf + ')';
        } else {
          var _qInner = _rlv.match(/evalToString\("String\((.+)\)",/);
          if (_qInner) {
            if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
            var _qBuf2 = ctx._jsEvalCount; ctx._jsEvalCount = _qBuf2 + 1;
            var _qExpr = _qInner[1].replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            val += 'qjs_runtime.evalToString("String((' + _qExpr + ').' + _qField + ')", &_eval_buf_' + _qBuf2 + ')';
          } else {
            val += _rlv;
          }
        }
        c.advance(); c.advance(); // skip name and dot; field advanced below
      } else {
        val += _rlv;
      }
    } else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.indexParam) {
      val += '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
    } else if (c.kind() === TK.identifier && ctx.currentMap) {
      var _anc = ctx.currentMap.parentMap;
      var _hitParent = null;
      while (_anc) {
        if (c.text() === _anc.indexParam) {
          _hitParent = _anc;
          break;
        }
        _anc = _anc.parentMap;
      }
      if (_hitParent) {
        val += '@as(i64, @intCast(' + (_hitParent.iterVar || '_i') + '))';
      } else if (c.text() === ctx.currentMap.itemParam) {
        // Map item param .field access → OA field reference
        if (c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip item name
          c.advance(); // skip dot → now at field
          var _mf = c.text();
          var _moa = ctx.currentMap.oa;
          var _mfi = _moa ? _moa.fields.find(function(f) { return f.name === _mf; }) : null;
          var _miv = ctx.currentMap.iterVar || '_i';
          if (_moa && _mfi && _mfi.type === 'string') {
            val += '_oa' + _moa.oaIdx + '_' + _mf + '[' + _miv + '][0.._oa' + _moa.oaIdx + '_' + _mf + '_lens[' + _miv + ']]';
          } else if (_moa) {
            val += '_oa' + _moa.oaIdx + '_' + _mf + '[' + _miv + ']';
          } else {
            val += '0';
          }
        } else {
          val += '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
        }
      } else {
        const resolvedValue = resolveComponentIdentifierValue(c);
        if (resolvedValue !== null) val += resolvedValue;
        else val += c.text();
      }
    } else if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq) {
      // === / !== → == / != (skip trailing = from JS triple-equals)
      val += c.text();
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // skip 3rd = of ===
      continue;
    } else {
      const resolvedValue = resolveComponentIdentifierValue(c);
      if (resolvedValue !== null) val += resolvedValue;
      else val += c.text();
    }
    c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();
  return normalizeComponentTernaryValue(val);
}

function resolveComponentTemplateLiteralValue(c) {
  const raw = c.text().slice(1, -1);
  let ti = 0;
  while (ti < raw.length) {
    if (raw[ti] === '$' && raw[ti + 1] === '{') {
      const end = raw.indexOf('}', ti + 2);
      if (end >= 0) {
        const expr = raw.slice(ti + 2, end).trim();
        if (ctx.currentMap && ctx.currentMap.oa) {
          const oa = ctx.currentMap.oa;
          const fieldInfo = oa.fields.find(ff => ff.name === expr);
          if (fieldInfo) {
            return fieldInfo.type === 'string'
              ? `_oa${oa.oaIdx}_${expr}[_i][0.._oa${oa.oaIdx}_${expr}_lens[_i]]`
              : `_oa${oa.oaIdx}_${expr}[_i]`;
          }
        }
        if (isGetter(expr)) return slotGet(expr);
        if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) return ctx.renderLocals[expr];
      }
      break;
    }
    ti++;
  }
  return null;
}

function resolveComponentIdentifierValue(c) {
  let resolved = null;

  if (c.kind() === TK.identifier && ctx.currentMap) {
    let mapCursor = ctx.currentMap.parentMap;
    while (mapCursor) {
      if (c.text() === mapCursor.indexParam) {
        const backrefField = ctx.currentMap.oa.fields.find(ff => ff.name === mapCursor.itemParam + 'Idx');
        if (backrefField) {
          resolved = `_oa${ctx.currentMap.oa.oaIdx}_${backrefField.name}[_i]`;
          break;
        }
        resolved = '@as(i64, @intCast(' + (mapCursor.iterVar || '_i') + '))';
        break;
      }
      mapCursor = mapCursor.parentMap;
    }
  }

  if (resolved !== null) return resolved;
  if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) return ctx.renderLocals[c.text()];
  if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && typeof ctx.propStack[c.text()] === 'string') return ctx.propStack[c.text()];
  return null;
}

function normalizeComponentTernaryValue(val) {
  if (val.indexOf('?') < 0 || val.indexOf(':') < 0) return val;

  const qIdx = val.indexOf('?');
  const cIdx = val.indexOf(':', qIdx);
  if (!(qIdx > 0 && cIdx > qIdx)) return val;

  var cond = val.substring(0, qIdx).trim();
  const thenVal = val.substring(qIdx + 1, cIdx).trim();
  const elseVal = val.substring(cIdx + 1).trim();
  cond = cond.replace(/===/g, '==').replace(/!==/g, '!=');
  // Resolve comparison or bare truthiness via resolve layer
  var _eqMatch = cond.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (_eqMatch) {
    cond = resolveComparison(_eqMatch[1].trim(), _eqMatch[2], _eqMatch[3].trim(), ctx);
  } else if (isEval(cond)) {
    cond = zigBool(cond, ctx);
  }
  // String branches need @as([]const u8, ...) for Zig type unification
  const thenIsStr = /^"[^"]*"$/.test(thenVal);
  const elseIsStr = /^"[^"]*"$/.test(elseVal);
  if (thenIsStr && elseIsStr) {
    return 'if (' + cond + ') @as([]const u8, ' + thenVal + ') else @as([]const u8, ' + elseVal + ')';
  }
  const zigThen = /^-?\d+$/.test(thenVal) ? '@as(i64, ' + thenVal + ')' : thenVal;
  const zigElse = /^-?\d+$/.test(elseVal) ? '@as(i64, ' + elseVal + ')' : elseVal;
  return 'if (' + cond + ') ' + zigThen + ' else ' + zigElse;
}
