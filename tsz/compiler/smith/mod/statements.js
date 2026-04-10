// Mod statements — extracted from mod.js

// Emit a semicolon-separated statement list, each through modTranspileExpr
function emitStatementList(expr, ind) {
  var out = '';
  var stmts = splitTopLevelStatements(expr);
  for (var s = 0; s < stmts.length; s++) {
    var stmt = stmts[s];
    var am = stmt.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (am) {
      var target = modTranspileExpr(normalizeAssignTarget(am[1].trim()));
      var val = modTranspileValue(am[2].trim());
      var esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var inc = val.match(new RegExp('^' + esc + '\\s*\\+\\s*(.+)$'));
      var dec = !inc ? val.match(new RegExp('^' + esc + '\\s*-\\s*(.+)$')) : null;
      if (inc) { out += ind + target + ' += ' + inc[1] + ';\n'; }
      else if (dec) { out += ind + target + ' -= ' + dec[1] + ';\n'; }
      else { out += ind + target + ' = ' + val + ';\n'; }
    } else {
      out += ind + modTranspileExpr(stmt) + ';\n';
    }
  }
  return out;
}

function emitInlineStatements(expr, depth, typeNames, lines, lineIdx, guardRetVal, ctx) {
  let out = '';
  const stmts = splitTopLevelStatements(expr);
  for (let s = 0; s < stmts.length; s++) {
    out += emitSingleStatement(stmts[s], depth, typeNames, lines, lineIdx, guardRetVal, ctx);
  }
  return out;
}

function emitSingleStatement(stmt, depth, typeNames, lines, lineIdx, guardRetVal, ctx) {
  const ind = '    '.repeat(depth);
  const knownVars = ctx.knownVars || [];
  const localNames = ctx.localNames || [];
  const narrowedVars = ctx.narrowedVars || [];
  const text = applyOptionalUnwraps(stmt.trim(), narrowedVars);
  if (!text || text === 'go') return '';
  if (text === 'continue') return ind + 'continue;\n';
  if (text === 'stop') return ind + (ctx.inLoop ? 'break' : guardRetVal) + ';\n';
  if (text.startsWith('return ')) return ind + 'return ' + modTranspileValue(text.slice(7), ctx) + ';\n';

  const inlineTernary = splitInlineStatementTernary(text);
  if (inlineTernary) {
    const thenCtx = extendModCtx(ctx, { scopeLocals: true });
    const elseCtx = extendModCtx(ctx, { scopeLocals: true });
    let out = ind + 'if (' + modTranspileExpr(applyOptionalUnwraps(inlineTernary.cond, narrowedVars), ctx) + ') {\n';
    out += emitInlineStatements(inlineTernary.thenExpr, depth + 1, typeNames, lines, lineIdx, guardRetVal, thenCtx);
    if (inlineTernary.elseExpr !== 'go') {
      out += ind + '} else {\n';
      out += emitInlineStatements(inlineTernary.elseExpr, depth + 1, typeNames, lines, lineIdx, guardRetVal, elseCtx);
    }
    out += ind + '}\n';
    return out;
  }

  const inlineFor = text.match(/^for\s+(.+?)\s+as\s+(\w+)(?:\s+at\s+(\w+))?:\s*(.+)$/);
  if (inlineFor) {
    return emitForLoopV2(
      inlineFor[1],
      inlineFor[2],
      inlineFor[3] || null,
      [{ indent: depth + 1, text: inlineFor[4].trim() }],
      typeNames,
      depth,
      ctx
    );
  }

  const inlineWhile = text.match(/^while\s+(.+?):\s*(.+)$/);
  if (inlineWhile) {
    return emitWhileLoopV2(
      inlineWhile[1],
      [{ indent: depth + 1, text: inlineWhile[2].trim() }],
      typeNames,
      depth,
      [],
      'void',
      extendModCtx(ctx, { scopeLocals: true, inLoop: true })
    );
  }

  const structAssign = text.match(/^(.+?)\s*=\s*\{(.+)\}\s*$/);
  if (structAssign && !isComparison(structAssign[1])) {
    const target = modTranspileExpr(normalizeAssignTarget(structAssign[1].trim()), ctx);
    return ind + target + ' = ' + transpileStructLiteral(structAssign[2]) + ';\n';
  }

  const assignMatch = text.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
  if (assignMatch && !assignMatch[1].includes('(') && !isComparison(assignMatch[1])) {
    const rawTarget = normalizeAssignTarget(assignMatch[1].trim());
    const rawValue = assignMatch[2].trim();
    const val = modTranspileValue(rawValue, ctx);

    if (/^\w+$/.test(rawTarget) && !rawTarget.includes('.') && !rawTarget.includes('[') && knownVars.indexOf(rawTarget) === -1) {
      knownVars.push(rawTarget);
      localNames.push(rawTarget);
      const target = modEscapeLocalName(rawTarget);
      if (typeNames && typeNames.indexOf(rawValue) !== -1) {
        if (ctx.localTypes) ctx.localTypes[rawTarget] = rawValue;
        const isMutableTyped = localIsReassigned(rawTarget, lines, lineIdx);
        return ind + (isMutableTyped ? 'var ' : 'const ') + target + ': ' + rawValue + ' = .{};\n';
      }
      if (localNeedsPointer(rawTarget, rawValue, lines, lineIdx)) {
        if (ctx.ptrVars && ctx.ptrVars.indexOf(rawTarget) === -1) ctx.ptrVars.push(rawTarget);
        return ind + (localIsReassigned(rawTarget, lines, lineIdx) ? 'var ' : 'const ') + target + ' = &' + val + ';\n';
      }
      const inferredType = inferTypeFromValue(assignMatch[2].trim());
      const isMutable = localIsReassigned(rawTarget, lines, lineIdx);
      if (inferredType) {
        return ind + (isMutable ? 'var ' : 'const ') + target + ': ' + inferredType + ' = ' + val + ';\n';
      }
      return ind + (isMutable ? 'var ' : 'const ') + target + ' = ' + val + ';\n';
    }

    const target = modTranspileExpr(rawTarget, ctx);
    const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const incMatch = val.match(new RegExp('^' + esc + '\\s*\\+\\s*(.+)$'));
    if (incMatch) return ind + target + ' += ' + incMatch[1] + ';\n';
    const decMatch = val.match(new RegExp('^' + esc + '\\s*-\\s*(.+)$'));
    if (decMatch) return ind + target + ' -= ' + decMatch[1] + ';\n';
    return ind + target + ' = ' + val + ';\n';
  }

  return ind + modTranspileExpr(text, ctx) + ';\n';
}

function localNeedsPointer(name, rawValue, lines, lineIdx) {
  if (!modValueLooksAddressable(rawValue)) return false;
  const assignRe = new RegExp('^' + escapeRegExp(name) + '(?:\\.|\\[).*='); 
  for (let i = lineIdx + 1; i < lines.length; i++) {
    const text = (lines[i].text || lines[i] || '').trim();
    if (!text) continue;
    if (assignRe.test(text) && hasTopLevelAssignment(text)) return true;
  }
  return false;
}

function modValueLooksAddressable(rawValue) {
  const v = (rawValue || '').trim();
  if (!v || v.startsWith('&')) return false;
  if (v.indexOf('(') !== -1) return false;
  if (!/^[A-Za-z_]/.test(v)) return false;
  let i = 0;
  while (i < v.length && /[A-Za-z0-9_]/.test(v[i])) i++;
  while (i < v.length) {
    if (v[i] === '.') {
      i++;
      const start = i;
      while (i < v.length && /[A-Za-z0-9_]/.test(v[i])) i++;
      if (start === i) return false;
      continue;
    }
    if (v[i] === '[') {
      let depth = 1;
      i++;
      while (i < v.length && depth > 0) {
        if (v[i] === '[') depth++;
        else if (v[i] === ']') depth--;
        i++;
      }
      if (depth !== 0) return false;
      continue;
    }
    return false;
  }
  return true;
}

function normalizeAssignTarget(target) {
  const trimmed = (target || '').trim();
  if (/^\w+\.\?$/.test(trimmed)) return trimmed.slice(0, -2);
  return trimmed;
}
