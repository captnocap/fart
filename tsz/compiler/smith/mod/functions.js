// Mod functions block — extracted from mod.js

function emitFunctionsBlock(content, typeNames, allVariants) {
  let out = '\n';
  // Split into individual functions by detecting signatures at top-level indent.
  const lines = content.split('\n');
  const funcs = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;
    const isSig = indent <= 4 && trimmed.match(/^\w+\([^)]*\)\s*(?::\s*.+)?$/);
    if (isSig) {
      if (current) funcs.push(current);
      current = { sig: trimmed, body: [] };
      continue;
    }
    if (current) current.body.push(raw);
  }
  if (current) funcs.push(current);
  for (let f = 0; f < funcs.length; f++) {
    const sigMatch = funcs[f].sig.match(/^(\w+)\(/);
    if (sigMatch && _modReservedNames.indexOf(sigMatch[1]) === -1) _modReservedNames.push(sigMatch[1]);
  }
  for (let f = 0; f < funcs.length; f++) out += emitOneFunction(funcs[f].sig, funcs[f].body, typeNames, allVariants);
  return out;
}
function emitOneFunction(sig, rawBodyLines, typeNames, allVariants) {
  const fnMatch = sig.match(/^(\w+)\(([^)]*)\)\s*(?::\s*(\S+))?\s*$/);
  if (!fnMatch) return '';
  const fname = fnMatch[1]; const params = fnMatch[2]; const ret = fnMatch[3] || 'void';
  const paramInfo = parseModParams(params);
  inferModParamPointerFlags(fname, paramInfo, rawBodyLines, typeNames);
  const zigParams = emitModParams(paramInfo, fname); const zigRet = modTranspileType(ret);
  const paramNames = paramInfo.map(function(p) { return p.name; });
  const ptrVars = paramInfo.filter(function(p, idx) {
    return !!(p.isPtr || (_modFnPtrParams[fname] && _modFnPtrParams[fname][idx]));
  }).map(function(p) { return p.name; });
  const bodyLines = [];
  for (let i = 0; i < rawBodyLines.length; i++) {
    const raw = rawBodyLines[i]; const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) continue;
    bodyLines.push({ indent: raw.match(/^(\s*)/)[1].length, text: trimmed });
  }
  if (bodyLines.length === 1 && bodyLines[0].text.match(/return .+\.map\(/)) {
    return emitMapFunction(fname, zigParams, zigRet, bodyLines[0].text, typeNames);
  }
  const ctx = {
    knownVars: (_modStateVars || []).concat(paramNames),
    localNames: paramNames.slice(),
    ptrVars: ptrVars,
    paramTypes: buildModParamTypeMap(paramInfo),
    localTypes: {},
    narrowedVars: [],
  };
  let out = 'pub fn ' + zigEscape(fname) + '(' + zigParams + ') ' + zigRet + ' {\n';
  out += emitModBody(bodyLines, 0, typeNames, 1, allVariants, zigRet, ctx);
  out += '}\n\n';
  return out;
}
function prescanModFunctionSigs(content, typeNames) {
  _modFnPtrParams = {};
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;
    const sigMatch = indent <= 4 ? trimmed.match(/^(\w+)\(([^)]*)\)\s*(?::\s*(\S+))?\s*$/) : null;
    if (!sigMatch) continue;
    const fnName = sigMatch[1];
    const paramInfo = parseModParams(sigMatch[2]);
    const bodyLines = [];
    let j = i + 1;
    while (j < lines.length) {
      const nextRaw = lines[j];
      const nextTrimmed = nextRaw.trim();
      const nextIndent = nextRaw.match(/^(\s*)/)[1].length;
      if (nextIndent <= 4 && nextTrimmed.match(/^\w+\([^)]*\)\s*(?::\s*.+)?$/)) break;
      bodyLines.push(nextRaw);
      j += 1;
    }
    inferModParamPointerFlags(fnName, paramInfo, bodyLines, typeNames || []);
  }
}

function emitFunctionBody(lines, typeNames, depth) {
  let out = '';
  const indent = '    '.repeat(depth);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    // Guard: cond ? stop : go → if (cond) return ...;
    const guardMatch = line.match(/^(.+)\s+\?\s+stop\s*:\s*go$/);
    if (guardMatch) {
      out += indent + 'if (' + modTranspileExpr(guardMatch[1]) + ') return ' + modGuardReturn(depth) + ';\n';
      i++;
      continue;
    }

    // Return
    if (line.startsWith('return ')) {
      out += indent + 'return ' + modTranspileExpr(line.slice(7)) + ';\n';
      i++;
      continue;
    }

    // Switch: switch name:
    const switchMatch = line.match(/^switch\s+(\w+):$/);
    if (switchMatch) {
      const switchVar = switchMatch[1];
      out += indent + 'switch (' + switchVar + ') {\n';
      i++;
      // Collect arms until de-indent
      while (i < lines.length && lines[i]) {
        const arm = lines[i];
        // Arm: variant:
        const armMatch = arm.match(/^(\w+):$/);
        if (armMatch) {
          out += indent + '    .' + armMatch[1] + ' => {\n';
          i++;
          // Collect arm body
          const armBody = [];
          while (i < lines.length && lines[i] && !lines[i].match(/^\w+:$/) && !lines[i].startsWith('return ')) {
            armBody.push(lines[i]);
            i++;
          }
          // Check if next line is return (belongs to outer scope, not arm)
          out += emitArmBody(armBody, typeNames, depth + 2);
          out += indent + '    },\n';
          continue;
        }
        break;
      }
      out += indent + '}\n';
      continue;
    }

    // For loop: for array as item:
    const forMatch = line.match(/^for\s+(.+?)\s+as\s+(\w+):$/);
    if (forMatch) {
      const arrExpr = forMatch[1];
      const itemVar = forMatch[2];
      out += indent + 'var _i: usize = 0;\n';
      // Determine the count expression
      const rangeMatch = arrExpr.match(/^(\w+)\[(\d+)\.\.(\w+)\]$/);
      if (rangeMatch) {
        out += indent + 'while (_i < ' + rangeMatch[3] + ') : (_i += 1) {\n';
      } else {
        out += indent + 'while (_i < ' + arrExpr + '.len) : (_i += 1) {\n';
      }
      i++;
      // Collect body
      const forBody = [];
      while (i < lines.length && lines[i] && !lines[i].match(/^\w+\(/) && !lines[i].match(/^return /)) {
        forBody.push(lines[i]);
        i++;
      }
      out += emitForBody(forBody, arrExpr, itemVar, typeNames, depth + 1);
      out += indent + '}\n';
      continue;
    }

    // Assignment: target = { ... } → struct init
    const structAssign = line.match(/^(.+?)\s*=\s*\{(.+)\}\s*$/);
    if (structAssign) {
      const target = modTranspileExpr(structAssign[1]);
      const fields = structAssign[2].split(',').map(function(f) {
        const kv = f.trim().match(/^(\w+):\s*(.+)$/);
        if (kv) return '.' + kv[1] + ' = ' + modTranspileExpr(kv[2].trim());
        return f.trim();
      }).join(', ');
      out += indent + target + ' = .{ ' + fields + ' };\n';
      i++;
      continue;
    }

    // Assignment: target = expr
    const assignMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (assignMatch && !assignMatch[1].includes('(')) {
      const target = modTranspileExpr(assignMatch[1]);
      const val = modTranspileExpr(assignMatch[2]);
      out += indent + target + ' = ' + val + ';\n';
      i++;
      continue;
    }

    // Bare expression / statement
    out += indent + modTranspileExpr(line) + ';\n';
    i++;
  }

  return out;
}

function emitArmBody(lines, typeNames, depth) {
  let out = '';
  const indent = '    '.repeat(depth);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Ternary assignment: cond ? target = val1 : target = val2
    const ternAssign = line.match(/^(.+?)\s+and\s+(.+)$/);
    // cond\n  ? expr1\n  : expr2 — check for multi-line ternary
    const condAssign = line.match(/^(.+)\s*\?\s*(.+?)\s*:\s*(.+)$/);
    if (condAssign) {
      const cond = modTranspileExpr(condAssign[1]);
      const ifTrue = condAssign[2].trim();
      const ifFalse = condAssign[3].trim();
      // Both sides are assignments
      const trueAssign = ifTrue.match(/^(.+?)\s*=\s*(.+)$/);
      const falseAssign = ifFalse.match(/^(.+?)\s*=\s*(.+)$/);
      if (trueAssign && falseAssign) {
        out += indent + 'if (' + cond + ') {\n';
        out += indent + '    ' + modTranspileExpr(trueAssign[1]) + ' = ' + modTranspileExpr(trueAssign[2]) + ';\n';
        out += indent + '} else {\n';
        out += indent + '    ' + modTranspileExpr(falseAssign[1]) + ' = ' + modTranspileExpr(falseAssign[2]) + ';\n';
        out += indent + '}\n';
        continue;
      }
    }
    // Fallback: assignment or expression
    const assignMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (assignMatch && !assignMatch[1].includes('(')) {
      out += indent + modTranspileExpr(assignMatch[1]) + ' = ' + modTranspileExpr(assignMatch[2]) + ';\n';
    } else {
      out += indent + modTranspileExpr(line) + ';\n';
    }
  }
  return out;
}

function emitForBody(lines, arrExpr, itemVar, typeNames, depth) {
  let out = '';
  const indent = '    '.repeat(depth);
  // Determine the array access pattern
  const rangeMatch = arrExpr.match(/^(\w+)\[(\d+)\.\.(\w+)\]$/);
  const baseArr = rangeMatch ? rangeMatch[1] : arrExpr;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // cond ? action; return : continue
    const condMatch = line.match(/^(.+?)\s*\?\s*(.+?)\s*;\s*return\s*:\s*continue$/);
    if (condMatch) {
      out += indent + 'if (' + modTranspileForExpr(condMatch[1], baseArr, itemVar) + ') {\n';
      // Parse the action part (may be multiple semicoloned statements)
      const actions = condMatch[2].split(';').map(function(a) { return a.trim(); }).filter(Boolean);
      for (let a = 0; a < actions.length; a++) {
        const am = actions[a].match(/^(.+?)\s*=\s*(.+)$/);
        if (am) {
          out += indent + '    ' + modTranspileForExpr(am[1], baseArr, itemVar) + ' = ' + modTranspileForExpr(am[2], baseArr, itemVar) + ';\n';
        } else if (actions[a].startsWith('return')) {
          out += indent + '    return ' + modTranspileForExpr(actions[a].slice(7), baseArr, itemVar) + ';\n';
        } else {
          out += indent + '    ' + modTranspileForExpr(actions[a], baseArr, itemVar) + ';\n';
        }
      }
      out += indent + '}\n';
      continue;
    }
    // Regular line
    const assignMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (assignMatch) {
      out += indent + modTranspileForExpr(assignMatch[1], baseArr, itemVar) + ' = ' + modTranspileForExpr(assignMatch[2], baseArr, itemVar) + ';\n';
    } else {
      out += indent + modTranspileForExpr(line, baseArr, itemVar) + ';\n';
    }
  }
  return out;
}

function emitModBody(lines, startIdx, typeNames, depth, allVariants, retType, ctx) {
  let out = '';
  const ind = '    '.repeat(depth);
  const knownVars = ctx.knownVars || [];
  let narrowedVars = (ctx.narrowedVars || []).slice();
  var guardRetVal = 'return';
  if (retType && retType !== 'void') {
    if (retType === 'bool') guardRetVal = 'return false';
    else if (retType === 'i32' || retType === 'i64') guardRetVal = 'return -1';
    else if (retType === 'u8' || retType === 'u16' || retType === 'u32' || retType === 'usize') guardRetVal = 'return 0';
    else if (retType === 'f32' || retType === 'f64') guardRetVal = 'return 0.0';
    else if (retType.startsWith('[]') || retType.startsWith('?') || retType.startsWith('*')) guardRetVal = 'return null';
    else if (retType.startsWith('!')) guardRetVal = 'return error.GuardFailed';
    else guardRetVal = 'return undefined';
  }
  let i = startIdx;
  while (i < lines.length) {
    const L = lines[i]; const text = L.text;
    const activeCtx = extendModCtx(ctx, { narrowedVars: narrowedVars });
    if (!text) { i++; continue; }
    // Guard: cond ? stop : go
    const guardMatch = text.match(/^(.+?)\s+\?\s+stop\s*:\s*go$/);
    if (guardMatch) { out += ind + 'if (' + modTranspileExpr(applyOptionalUnwraps(guardMatch[1], narrowedVars), activeCtx) + ') ' + guardRetVal + ';\n'; i++; continue; }
    // Return
    if (text.startsWith('return ')) { out += ind + 'return ' + modTranspileValue(text.slice(7), activeCtx) + ';\n'; i++; continue; }
    // Multi-line struct init: target = { ... }
    const structBlockMatch = text.match(/^(.+?)\s*=\s*\{$/);
    if (structBlockMatch && !isComparison(structBlockMatch[1])) {
      const target = normalizeAssignTarget(structBlockMatch[1].trim());
      const blockIndent = L.indent;
      i++;
      const fieldLines = [];
      while (i < lines.length) {
        if (lines[i].indent === blockIndent && lines[i].text === '}') break;
        fieldLines.push(lines[i].text);
        i++;
      }
      if (i < lines.length && lines[i].indent === blockIndent && lines[i].text === '}') i++;
      out += ind + target + ' = ' + transpileStructLiteral(fieldLines.join(', ')) + ';\n';
      continue;
    }
    // Struct init: target = { field: val }
    const structAssign = text.match(/^(.+?)\s*=\s*\{(.+)\}\s*$/);
    if (structAssign && !isComparison(structAssign[1])) {
      const target = normalizeAssignTarget(structAssign[1].trim());
      out += ind + target + ' = ' + transpileStructLiteral(structAssign[2]) + ';\n'; i++; continue;
    }
    const inlineStmtTernary = splitInlineStatementTernary(text);
    // Assignment: target = expr (not >= <= == !=)
    const assignMatch = text.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (!inlineStmtTernary && assignMatch && !assignMatch[1].includes('(') && !isComparison(assignMatch[1])) {
      out += emitSingleStatement(text, depth, typeNames, lines, i, guardRetVal, activeCtx);
      i++; continue;
    }
    // Statement ternary / block ternary
    const ternary = readModStatementTernary(lines, i);
    if (ternary) {
      const cond = ternary.cond;
      const thenCtx = extendModCtx(ctx, { scopeLocals: true, narrowedVars: narrowedVars.concat(extractNonNullVars(cond)) });
      const elseCtx = extendModCtx(ctx, { scopeLocals: true, narrowedVars: narrowedVars.concat(extractNullGuardedVars(cond)) });
      out += ind + 'if (' + modTranspileExpr(applyOptionalUnwraps(cond, narrowedVars), activeCtx) + ') {\n';
      out += emitModBranchBody(ternary.thenLines, depth + 1, typeNames, allVariants, retType, thenCtx);
      if (ternary.elseLines.length > 0 && !modBranchIsNoop(ternary.elseLines, activeCtx)) {
        out += ind + '} else {\n';
        out += emitModBranchBody(ternary.elseLines, depth + 1, typeNames, allVariants, retType, elseCtx);
      }
      out += ind + '}\n';
      if (ternary.elseLines.length === 0 && modBranchIsEarlyExit(ternary.thenLines)) {
        narrowedVars = addUniqueVars(narrowedVars, extractNullGuardedVars(cond));
      }
      i = ternary.nextIdx;
      continue;
    }
    // While loop
    const whileMatch = text.match(/^while\s+(.+):$/);
    if (whileMatch) {
      const whileIndent = L.indent; i++;
      const whileBody = [];
      while (i < lines.length && lines[i].indent > whileIndent) { whileBody.push(lines[i]); i++; }
      out += emitWhileLoopV2(whileMatch[1], whileBody, typeNames, depth, allVariants, retType, extendModCtx(ctx, { scopeLocals: true, narrowedVars: narrowedVars, inLoop: true }));
      continue;
    }
    // Switch
    const switchMatch = text.match(/^switch\s+(.+):$/);
    if (switchMatch) {
      out += ind + 'switch (' + switchMatch[1] + ') {\n'; i++;
      while (i < lines.length) {
        const armMatch = lines[i].text.match(/^(.+):$/);
        if (!armMatch) break;
        const armIndent = lines[i].indent;
        const armKey = armMatch[1].trim() === 'else'
          ? 'else'
          : (/^['"]/.test(armMatch[1].trim()) || /^-?\d/.test(armMatch[1].trim())
            ? armMatch[1].trim()
            : '.' + armMatch[1].trim());
        out += ind + '    ' + armKey + ' => {\n'; i++;
        const armBody = [];
        while (i < lines.length && !lines[i].text.match(/^.+:$/) && lines[i].indent > armIndent) { armBody.push(lines[i]); i++; }
        out += emitArmBodyV2(armBody, typeNames, depth + 2, extendModCtx(ctx, { scopeLocals: true, narrowedVars: narrowedVars }));
        out += ind + '    },\n';
      }
      out += ind + '}\n'; continue;
    }
    // For loop
    const forMatch = text.match(/^for\s+(.+?)\s+as\s+(\w+)(?:\s+at\s+(\w+))?:$/);
    if (forMatch) {
      const forIndent = L.indent; i++;
      const forBody = [];
      while (i < lines.length && lines[i].indent > forIndent) { forBody.push(lines[i]); i++; }
      out += emitForLoopV2(forMatch[1], forMatch[2], forMatch[3] || null, forBody, typeNames, depth, extendModCtx(ctx, { scopeLocals: true, narrowedVars: narrowedVars })); continue;
    }
    out += emitSingleStatement(text, depth, typeNames, lines, i, guardRetVal, activeCtx); i++;
  }
  return out;
}
function emitArmBodyV2(lines, typeNames, depth, ctx) {
  let out = ''; const ind = '    '.repeat(depth);
  // Multi-line ternary: condition \n ? true-expr \n : false-expr
  if (lines.length >= 3 && lines[1].text.startsWith('? ') && lines[2].text.startsWith(': ')) {
    const cond = modTranspileExpr(lines[0].text, ctx);
    const trueExpr = lines[1].text.slice(2).trim();
    const falseExpr = lines[2].text.slice(2).trim();
    out += ind + 'if (' + cond + ') {\n';
    out += emitStatementList(trueExpr, ind + '    ');
    out += ind + '} else {\n';
    out += emitStatementList(falseExpr, ind + '    ');
    out += ind + '}\n';
    return out;
  }
  for (let i = 0; i < lines.length; i++) {
    const text = applyOptionalUnwraps(lines[i].text, ctx.narrowedVars || []);
    const am = text.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (am) { out += ind + modTranspileExpr(normalizeAssignTarget(am[1].trim()), ctx) + ' = ' + modTranspileValue(am[2].trim(), ctx) + ';\n'; }
    else { out += ind + modTranspileExpr(text, ctx) + ';\n'; }
  }
  return out;
}
function emitForLoopV2(arrExpr, itemVar, indexVar, bodyLines, typeNames, depth, ctx) {
  let out = ''; const ind = '    '.repeat(depth);
  const spec = parseForExprSpec(arrExpr);
  const iterVar = (!spec.reverse && indexVar) ? indexVar : nextModLoopVar();
  const accessIndexExpr = spec.reverse
    ? buildReverseIndexExpr(spec.startExpr, spec.endExpr, iterVar)
    : iterVar;
  const itemAccessExpr = spec.range ? accessIndexExpr : spec.baseExpr + '[' + accessIndexExpr + ']';

  out += ind + 'var ' + iterVar + ': usize = ' + spec.startExpr + ';\n';
  out += ind + 'while (' + iterVar + ' < ' + spec.endExpr + ') : (' + iterVar + ' += 1) {\n';
  if (spec.reverse && indexVar) {
    out += ind + '    const ' + indexVar + ': usize = ' + accessIndexExpr + ';\n';
  }

  const loopCtx = extendModCtx(ctx, {
    scopeLocals: true,
    knownVars: addUniqueVars(ctx.knownVars || [], [itemVar].concat(indexVar ? [indexVar] : [])),
    localNames: addUniqueVars(ctx.localNames || [], indexVar ? [indexVar] : []),
    inLoop: true,
  });
  const processedLines = bodyLines.map(function(line) {
    return {
      indent: line.indent,
      text: substituteForLoopVars(line.text, itemVar, itemAccessExpr, indexVar, spec.reverse ? accessIndexExpr : null),
    };
  });
  out += emitModBody(processedLines, 0, typeNames, depth + 1, [], 'void', loopCtx);
  out += ind + '}\n';
  return out;
}

function nextModLoopVar() {
  _modLoopSerial += 1;
  return '_mi' + _modLoopSerial;
}

function emitWhileLoopV2(condExpr, bodyLines, typeNames, depth, allVariants, retType, ctx) {
  let out = '';
  const ind = '    '.repeat(depth);
  out += ind + 'while (' + modTranspileExpr(applyOptionalUnwraps(condExpr, (ctx && ctx.narrowedVars) || []), ctx) + ') {\n';
  out += emitModBody(bodyLines, 0, typeNames, depth + 1, allVariants || [], retType || 'void', ctx);
  out += ind + '}\n';
  return out;
}

function emitModBranchBody(branchLines, depth, typeNames, allVariants, retType, ctx) {
  if (!branchLines || branchLines.length === 0) return '';
  if (branchLines.length === 1) {
    return emitInlineStatements(branchLines[0].text, depth, typeNames, branchLines, 0, 'return', ctx);
  }
  return emitModBody(branchLines, 0, typeNames, depth, allVariants || [], retType || 'void', ctx);
}

function modBranchIsNoop(branchLines, ctx) {
  if (!branchLines || branchLines.length === 0) return true;
  if (branchLines.length !== 1) return false;
  const text = (branchLines[0].text || '').trim();
  if (text === 'go') return true;
  if ((ctx && ctx.inLoop) && text === 'continue') return true;
  return false;
}

function modBranchIsEarlyExit(branchLines) {
  if (!branchLines || branchLines.length === 0) return false;
  if (branchLines.length === 1 && branchLines[0].indent == null) return isEarlyExitBranch(branchLines[0].text);
  for (let i = 0; i < branchLines.length; i++) {
    const text = (branchLines[i].text || '').trim();
    if (!text) continue;
    if (!(text.startsWith('return ') || text === 'return' || text === 'stop' || text === 'continue')) return false;
  }
  return true;
}

function readModStatementTernary(lines, startIdx) {
  if (startIdx >= lines.length) return null;
  const first = lines[startIdx];
  if (!first || !first.text) return null;

  const inlineParts = splitInlineStatementTernary(first.text);
  if (inlineParts) {
    return {
      cond: inlineParts.cond,
      thenLines: [{ indent: null, text: inlineParts.thenExpr }],
      elseLines: inlineParts.elseExpr === 'go' ? [] : [{ indent: null, text: inlineParts.elseExpr }],
      nextIdx: startIdx + 1,
    };
  }

  if (startIdx + 1 >= lines.length || !lines[startIdx + 1].text.startsWith('? ')) return null;

  const markerIndent = lines[startIdx + 1].indent;
  let idx = startIdx + 1;
  const thenLines = [];
  const elseLines = [];
  const firstThen = lines[idx].text.slice(2).trim();
  if (firstThen) thenLines.push({ indent: lines[idx].indent, text: firstThen });
  idx += 1;

  while (idx < lines.length) {
    const line = lines[idx];
    if (line.indent === markerIndent && line.text.startsWith(': ')) break;
    if (line.indent <= first.indent) break;
    thenLines.push(line);
    idx += 1;
  }

  if (idx >= lines.length || lines[idx].indent !== markerIndent || !lines[idx].text.startsWith(': ')) {
    return {
      cond: first.text,
      thenLines: thenLines,
      elseLines: [],
      nextIdx: idx,
    };
  }
  const firstElse = lines[idx].text.slice(2).trim();
  if (firstElse && firstElse !== 'go') elseLines.push({ indent: lines[idx].indent, text: firstElse });
  idx += 1;
  while (idx < lines.length && lines[idx].indent > first.indent) {
    elseLines.push(lines[idx]);
    idx += 1;
  }

  return {
    cond: first.text,
    thenLines: thenLines,
    elseLines: elseLines,
    nextIdx: idx,
  };
}

function emitMapFunction(fname, zigParams, zigRet, bodyText, typeNames) {
  const mapMatch = bodyText.match(/return\s+(\w+)\[(\d+)\.\.(\w+)\]\.map\((\w+)\s*=>\s*(\w+)\.(\w+)\)/);
  if (mapMatch) {
    const arr = mapMatch[1]; const end = mapMatch[3]; const field = mapMatch[6];
    let out = 'pub fn ' + zigEscape(fname) + '(buf: []i64) []i64 {\n';
    out += '    var i: usize = 0;\n';
    out += '    while (i < ' + end + ') : (i += 1) {\n';
    out += '        buf[i] = ' + arr + '[i].' + field + ';\n';
    out += '    }\n';
    out += '    return buf[0..' + end + '];\n';
    out += '}\n\n';
    return out;
  }
  return 'pub fn ' + zigEscape(fname) + '(' + zigParams + ') ' + zigRet + ' {\n    // TODO: map\n}\n\n';
}
