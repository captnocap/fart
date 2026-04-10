// Intent module function lowering.
//
// The active dictionary surface uses block control flow (`<if>`, `<for>`,
// `<while>`, `<switch>`) and untyped headers. We lower that contract surface to
// the older line-oriented module body language consumed by the existing module
// emit atoms.

function compileIntentModuleContract(contract, file) {
  if (!contract || contract.syntax !== 'intent-named') return null;
  const env = buildIntentModuleEnv(contract);
  const support = assessIntentModuleSupport(contract, env);
  if (!support.ok) return null;

  const loweredFns = normalizeIntentModuleFunctions(contract, env);
  if (!loweredFns) return null;

  const blocks = normalizeIntentModuleState(contract, env);
  const ctx = {
    file: file,
    moduleName: contract.moduleName,
    blocks: {
      imports: normalizeIntentModuleImports(contract),
      ffi: normalizeIntentModuleFfi(contract),
      types: normalizeIntentModuleTypes(contract, env),
      consts: blocks.consts,
      state: blocks.state,
      functions: loweredFns.block,
    },
    typeNames: [],
    enumVariants: {},
    allVariants: [],
    intentTimers: loweredFns.timers,
    intentCleanupPairs: loweredFns.cleanupPairs,
  };
  const meta = {
    basename: file.split('/').pop(),
    moduleName: contract.moduleName,
    target: globalThis.__modTarget || 'zig',
  };
  const out = runModuleEmitAtoms(ctx, meta);
  return out.replace(/\n+$/, '\n');
}

function assessIntentModuleSupport(contract, env) {
  const reasons = [];
  if (contract.topLevelDurings && contract.topLevelDurings.length) reasons.push('top-level-during');
  if (contract.blocks && contract.blocks.state) reasons.push('legacy-state-block');
  if (contract.legacyExtensions && contract.legacyExtensions.indexOf('multiple-functions-blocks') !== -1) reasons.push('multiple-functions-blocks');
  if (env.unsupported && env.unsupported.length) reasons.push.apply(reasons, env.unsupported);

  const functionsBody = contract && contract.blocks ? contract.blocks.functions : null;
  const varsBody = contract && contract.blocks ? contract.blocks.var : null;
  if (functionsBody && /<(?:lscript|script|zscript)\b/.test(functionsBody)) reasons.push('function-hatch');
  if (functionsBody && /\.\s*(?:concat|where|map|filter|find|reduce)\s*\(/.test(functionsBody)) reasons.push('collection-helper');
  if (functionsBody && /(?:^|\n)\s*[A-Za-z_]\w*(?:\([^)]*\))?(?:\s*\+\s*[A-Za-z_]\w*(?:\([^)]*\))?){1,}\s*$/m.test(functionsBody)) reasons.push('function-composition');
  if (functionsBody && /<case\s+['"]/.test(functionsBody)) reasons.push('string-switch-case');
  if (varsBody && /\bis\s+(?:array|object|objects)\b/.test(varsBody)) reasons.push('dynamic-var-collection');

  return { ok: reasons.length === 0, reasons: reasons };
}

function normalizeIntentModuleFunctions(contract, env) {
  const block = contract && contract.blocks ? contract.blocks.functions : null;
  if (!block) return { block: null, timers: [], cleanupPairs: [] };

  const entries = parseIntentModuleFunctionEntries(block);
  const knownFunctionNames = {};
  for (var ki = 0; ki < entries.length; ki++) {
    knownFunctionNames[entries[ki].name] = true;
    if (entries[ki].cleanup) knownFunctionNames[entries[ki].name + '_cleanup'] = true;
  }
  const fnReturnTypes = {};
  for (var pass = 0; pass < 4; pass++) {
    var changed = false;
    for (var i = 0; i < entries.length; i++) {
      const inferred = inferIntentFunctionReturnType(entries[i], env, fnReturnTypes, knownFunctionNames);
      const compatName = entries[i].cleanup ? entries[i].name + '_cleanup' : entries[i].name;
      if (inferred && fnReturnTypes[compatName] !== inferred) {
        fnReturnTypes[compatName] = inferred;
        changed = true;
      }
    }
    if (!changed) break;
  }

  var out = '';
  const timers = [];
  const cleanupPairs = [];
  for (var ei = 0; ei < entries.length; ei++) {
    const entry = entries[ei];
    const lowered = lowerIntentFunctionEntry(entry, env, fnReturnTypes, knownFunctionNames);
    if (!lowered) return null;
    out += lowered.header + '\n';
    for (var li = 0; li < lowered.lines.length; li++) {
      out += lowered.lines[li] + '\n';
    }
    out += '\n';
    if (entry.every) {
      timers.push({
        name: lowered.compatName,
        interval: entry.every,
      });
    }
    if (entry.cleanup) {
      cleanupPairs.push({
        name: entry.name,
        cleanup: lowered.compatName,
      });
    }
  }

  return {
    block: out || null,
    timers: timers,
    cleanupPairs: cleanupPairs,
  };
}

function parseIntentModuleFunctionEntries(block) {
  const lines = String(block || '').split('\n');
  const entries = [];
  var current = null;
  var inHatch = null;
  for (var i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;
    if (!trimmed) {
      if (current) current.bodyLines.push(raw);
      continue;
    }
    if (trimmed === '<lscript>' || trimmed === '<script>' || trimmed === '<zscript>') {
      inHatch = trimmed.slice(1, -1);
      continue;
    }
    if (trimmed === '</lscript>' || trimmed === '</script>' || trimmed === '</zscript>') {
      inHatch = null;
      continue;
    }
    if (!inHatch && indent <= 4 && /:\s*$/.test(trimmed) && trimmed.charAt(0) !== '<') {
      const parsed = parseSingleModuleFunctionHeader(trimmed.slice(0, -1).trim());
      if (parsed) {
        if (current) entries.push(current);
        current = {
          name: parsed.name,
          params: parsed.params || [],
          cleanup: !!parsed.cleanup,
          every: parsed.every || null,
          rawHeader: parsed.rawHeader,
          bodyLines: [],
        };
        continue;
      }
    }
    if (current) current.bodyLines.push(raw);
  }
  if (current) entries.push(current);
  return entries;
}

function lowerIntentFunctionEntry(entry, env, fnReturnTypes, knownFunctionNames) {
  const compatName = entry.cleanup ? entry.name + '_cleanup' : entry.name;
  const fnEnv = {
    paramTypes: {},
    localTypes: {},
    functionReturnTypes: fnReturnTypes || {},
    knownFunctionNames: knownFunctionNames || {},
  };
  for (var pi = 0; pi < entry.params.length; pi++) fnEnv.paramTypes[entry.params[pi]] = 'anytype';
  inferIntentParamTypesFromBody(entry.bodyLines, env, fnEnv);

  const normalized = normalizeIntentFunctionBodyLines(entry.bodyLines, env, fnEnv);
  const parsed = parseIntentCompatNodes(normalized, 0, normalized.length ? normalized[0].indent : 0);
  const nodes = parsed.nodes;
  collectIntentLocalTypes(nodes, env, fnEnv);
  markIntentTerminalReturns(nodes, true);

  const compatLines = renderIntentCompatNodes(nodes, 4);
  const returnType = fnReturnTypes[compatName] || inferIntentReturnTypeFromNodes(nodes, env, fnEnv) || 'void';
  if (!returnType) return null;
  if (returnType.charAt(0) === '?' && !intentNodesAlwaysReturn(nodes)) compatLines.push('    return null');

  const params = entry.params.map(function(name) { return name + ': anytype'; }).join(', ');
  const header = '    ' + compatName + '(' + params + ')' + (returnType !== 'void' ? ': ' + returnType : '');
  return {
    compatName: compatName,
    header: header,
    lines: compatLines,
    returnType: returnType,
  };
}

function normalizeIntentFunctionBodyLines(bodyLines, env, fnEnv) {
  const out = [];
  for (var i = 0; i < bodyLines.length; i++) {
    const raw = bodyLines[i];
    const trimmed = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;
    if (!trimmed || trimmed.startsWith('//')) continue;

    var match = trimmed.match(/^<if\s+(.+?)\s+as\s+(\w+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'ifbind ' + normalizeIntentExpr(match[1], env, fnEnv) + ' as ' + match[2] + ':' });
      continue;
    }
    match = trimmed.match(/^<if\s+(.+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'if ' + normalizeIntentConditionExpr(match[1], env, fnEnv) + ':' });
      continue;
    }
    match = trimmed.match(/^<else\s+if\s+(.+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'else if ' + normalizeIntentConditionExpr(match[1], env, fnEnv) + ':' });
      continue;
    }
    if (trimmed === '<else>') {
      out.push({ indent: indent, text: 'else:' });
      continue;
    }
    if (trimmed === '</if>' || trimmed === '</else>' || trimmed === '</during>') continue;

    match = trimmed.match(/^<during\s+(.+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'if ' + normalizeIntentConditionExpr(match[1], env, fnEnv) + ':' });
      continue;
    }

    match = trimmed.match(/^<while\s+(.+?)\s+as\s+(\w+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'whilebind ' + normalizeIntentExpr(match[1], env, fnEnv) + ' as ' + match[2] + ':' });
      continue;
    }
    match = trimmed.match(/^<while\s+(.+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'while ' + normalizeIntentConditionExpr(match[1], env, fnEnv) + ':' });
      continue;
    }
    if (trimmed === '</while>') continue;

    match = trimmed.match(/^<for\s+(.+?)\s+as\s+(\w+)(?:\s+at\s+(\w+))?>$/);
    if (match) {
      out.push({
        indent: indent,
        text: 'for ' + normalizeIntentExpr(match[1], env, fnEnv) + ' as ' + match[2] + (match[3] ? ' at ' + match[3] : '') + ':',
      });
      continue;
    }
    if (trimmed === '</for>') continue;

    match = trimmed.match(/^<switch\s+(.+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'switch ' + normalizeIntentExpr(match[1], env, fnEnv) + ':' });
      continue;
    }
    if (trimmed === '</switch>') continue;

    match = trimmed.match(/^<case\s+(.+)>$/);
    if (match) {
      out.push({ indent: indent, text: 'case ' + normalizeIntentCaseValue(match[1], env, fnEnv) + ':' });
      continue;
    }
    if (trimmed === '</case>') continue;

    out.push({ indent: indent, text: normalizeIntentStatement(trimmed, env, fnEnv) });
  }
  return out;
}

function normalizeIntentStatement(text, env, fnEnv) {
  if (text === 'skip') return 'continue';
  if (text === 'stop') return 'stop';
  const assign = text.match(/^(.+?)\s+is\s+(.+)$/);
  if (assign) {
    const lhs = normalizeIntentAssignTarget(assign[1], env, fnEnv);
    const rawRhs = assign[2].trim();
    if (/^[A-Za-z_]\w*$/.test(lhs) && !env.varTypes[lhs] && !env.constTypes[lhs] && !(fnEnv.paramTypes && fnEnv.paramTypes[lhs])) {
      const inferred = inferIntentDeclType(rawRhs, env, lhs);
      if (inferred && inferred.type) fnEnv.localTypes[lhs] = inferred.type;
    }
    const rhs = normalizeIntentExpr(rawRhs, env, fnEnv);
    return lhs + ' = ' + rhs;
  }
  return intentMaybeCallBareReference(normalizeIntentExpr(text, env, fnEnv), env, fnEnv);
}

function normalizeIntentAssignTarget(target, env, fnEnv) {
  void env;
  void fnEnv;
  const trimmed = target.trim();
  if (trimmed.indexOf('set_') === 0 && trimmed.indexOf('.') === -1) return trimmed.slice(4);
  return trimmed;
}

function normalizeIntentExpr(expr, env, fnEnv) {
  var out = String(expr || '').trim();
  out = rewriteIntentLengthRefs(out, env, fnEnv);
  out = out.replace(/\bexact or above\b/g, '>=');
  out = out.replace(/\bexact or below\b/g, '<=');
  out = out.replace(/\bnot exact\b/g, '!=');
  out = out.replace(/\babove\b/g, '>');
  out = out.replace(/\bbelow\b/g, '<');
  out = out.replace(/\bexact\b/g, '==');
  out = out.replace(/\bnot\s+/g, '!');
  const unionCtor = out.match(/^([A-Za-z_]\w*)\(([\s\S]*)\)$/);
  if (unionCtor && env.variantToType[unionCtor[1]]) {
    return '.{ .' + unionCtor[1] + ' = ' + normalizeIntentExpr(unionCtor[2], env, fnEnv) + ' }';
  }
  out = rewriteIntentKnownFunctionRefs(out, env, fnEnv);
  if (/^[A-Za-z_]\w+(?:\.[A-Za-z_]\w+)*$/.test(out)) {
    const type = inferIntentExprType(out, env, fnEnv);
    if (type && stripIntentOptionalType(type) !== 'bool' && (String(type).charAt(0) === '?' || String(type).charAt(String(type).length - 1) === '?')) {
      return out + ' != null';
    }
  }
  return out;
}

function normalizeIntentConditionExpr(expr, env, fnEnv) {
  const trimmed = String(expr || '').trim();
  if (/^not\s+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(trimmed)) {
    const inner = trimmed.replace(/^not\s+/, '');
    const type = inferIntentExprType(inner, env, fnEnv);
    if (type && stripIntentOptionalType(type) !== 'bool' && (String(type).charAt(0) === '?' || String(type).charAt(String(type).length - 1) === '?')) {
      return inner + ' == null';
    }
  }
  return normalizeIntentExpr(trimmed, env, fnEnv);
}

function normalizeIntentCaseValue(value, env, fnEnv) {
  void env;
  void fnEnv;
  return normalizeIntentExpr(value, env, fnEnv);
}

function intentMaybeCallBareReference(text, env, fnEnv) {
  const trimmed = String(text || '').trim();
  if (!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(trimmed)) return trimmed;
  if (env.varTypes[trimmed] || env.constTypes[trimmed] || env.typeMap[trimmed] || env.variantToType[trimmed]) return trimmed;
  if (fnEnv && (fnEnv.paramTypes[trimmed] || fnEnv.localTypes[trimmed])) return trimmed;
  if (fnEnv && fnEnv.knownFunctionNames && fnEnv.knownFunctionNames[trimmed]) return trimmed + '()';
  if (trimmed.indexOf('.') !== -1) return inferIntentExprType(trimmed, env, fnEnv) ? trimmed : trimmed + '()';
  return trimmed;
}

function rewriteIntentLengthRefs(expr, env, fnEnv) {
  return String(expr || '').replace(/\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.length\b/g, function(_, ref) {
    return resolveIntentRefType(ref + '.length', env, fnEnv) ? ref + '.length' : ref + '.len';
  });
}

function inferIntentParamTypesFromBody(bodyLines, env, fnEnv) {
  const params = Object.keys(fnEnv.paramTypes || {});
  for (var pi = 0; pi < params.length; pi++) {
    const name = params[pi];
    const fields = collectIntentParamFields(name, bodyLines);
    if (!fields.length) continue;
    const inferred = inferIntentStructTypeForFields(fields, env);
    if (inferred) fnEnv.paramTypes[name] = inferred;
  }
}

function collectIntentParamFields(name, bodyLines) {
  const seen = {};
  const re = new RegExp('\\b' + escapeRegExp(name) + '\\.([A-Za-z_][A-Za-z0-9_]*)', 'g');
  for (var i = 0; i < bodyLines.length; i++) {
    const text = String(bodyLines[i] || '');
    var match;
    while ((match = re.exec(text)) !== null) seen[match[1]] = true;
  }
  return Object.keys(seen);
}

function inferIntentStructTypeForFields(fields, env) {
  const types = env && env.typeMap ? Object.keys(env.typeMap) : [];
  const candidates = [];
  for (var i = 0; i < types.length; i++) {
    const info = env.typeMap[types[i]];
    if (!info || info.kind !== 'struct') continue;
    var ok = true;
    for (var fi = 0; fi < fields.length; fi++) {
      if (!findIntentTypeField(info, fields[fi])) {
        ok = false;
        break;
      }
    }
    if (ok) candidates.push(info.name);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function rewriteIntentKnownFunctionRefs(expr, env, fnEnv) {
  if (!fnEnv || !fnEnv.knownFunctionNames) return expr;
  const names = Object.keys(fnEnv.knownFunctionNames);
  var out = '';
  var quote = null;
  for (var pos = 0; pos < expr.length;) {
    const ch = expr[pos];
    if (quote) {
      out += ch;
      if (ch === quote && expr[pos - 1] !== '\\') quote = null;
      pos += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      pos += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      var end = pos + 1;
      while (end < expr.length && /[A-Za-z0-9_]/.test(expr[end])) end += 1;
      const name = expr.slice(pos, end);
      const before = pos === 0 ? '' : expr[pos - 1];
      const after = end >= expr.length ? '' : expr[end];
      const skip = env.varTypes[name] || env.constTypes[name] || env.typeMap[name] || env.variantToType[name] ||
        (fnEnv.paramTypes && fnEnv.paramTypes[name]) || (fnEnv.localTypes && fnEnv.localTypes[name]);
      const beforeOk = !before || !/[A-Za-z0-9_.]/.test(before);
      const afterIsCall = /^\s*\(/.test(expr.slice(end));
      if (!skip && fnEnv.knownFunctionNames[name] && beforeOk && !afterIsCall) {
        out += name + '()';
        pos = end;
        continue;
      }
      out += name;
      pos = end;
      continue;
    }
    out += ch;
    pos += 1;
  }
  return out;
}

function parseIntentCompatNodes(lines, startIdx, baseIndent) {
  const nodes = [];
  var i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < baseIndent) break;
    if (line.indent > baseIndent) {
      i++;
      continue;
    }

    var match = line.text.match(/^ifbind\s+(.+)\s+as\s+(\w+):$/);
    if (match) {
      const parsedIfBind = parseIntentIfNode(lines, i, baseIndent, true);
      nodes.push(parsedIfBind.node);
      i = parsedIfBind.nextIdx;
      continue;
    }

    match = line.text.match(/^if\s+(.+):$/);
    if (match) {
      const parsedIf = parseIntentIfNode(lines, i, baseIndent, false);
      nodes.push(parsedIf.node);
      i = parsedIf.nextIdx;
      continue;
    }

    match = line.text.match(/^whilebind\s+(.+)\s+as\s+(\w+):$/);
    if (match) {
      const body = parseIntentCompatNodes(lines, i + 1, nextIntentChildIndent(lines, i, baseIndent)).nodes;
      nodes.push({ kind: 'whilebind', expr: match[1], bindName: match[2], body: body });
      i = skipIntentBlock(lines, i + 1, baseIndent);
      continue;
    }

    match = line.text.match(/^while\s+(.+):$/);
    if (match) {
      const whileBody = parseIntentCompatNodes(lines, i + 1, nextIntentChildIndent(lines, i, baseIndent)).nodes;
      nodes.push({ kind: 'while', cond: match[1], body: whileBody });
      i = skipIntentBlock(lines, i + 1, baseIndent);
      continue;
    }

    match = line.text.match(/^for\s+(.+?)\s+as\s+(\w+)(?:\s+at\s+(\w+))?:$/);
    if (match) {
      const forBody = parseIntentCompatNodes(lines, i + 1, nextIntentChildIndent(lines, i, baseIndent)).nodes;
      nodes.push({ kind: 'for', expr: match[1], item: match[2], index: match[3] || null, body: forBody });
      i = skipIntentBlock(lines, i + 1, baseIndent);
      continue;
    }

    match = line.text.match(/^switch\s+(.+):$/);
    if (match) {
      const parsedSwitch = parseIntentSwitchNode(lines, i, baseIndent, match[1]);
      nodes.push(parsedSwitch.node);
      i = parsedSwitch.nextIdx;
      continue;
    }

    if (/^(else if|else:|case\s+)/.test(line.text)) break;
    nodes.push({ kind: 'stmt', text: line.text });
    i++;
  }
  return { nodes: nodes, nextIdx: i };
}

function parseIntentIfNode(lines, idx, baseIndent, isBind) {
  const line = lines[idx];
  const bindMatch = isBind ? line.text.match(/^ifbind\s+(.+)\s+as\s+(\w+):$/) : null;
  const ifMatch = !isBind ? line.text.match(/^if\s+(.+):$/) : null;
  const childIndent = nextIntentChildIndent(lines, idx, baseIndent);
  const thenBody = parseIntentCompatNodes(lines, idx + 1, childIndent);
  var elseNodes = [];
  var nextIdx = thenBody.nextIdx;
  if (nextIdx < lines.length && lines[nextIdx].indent === baseIndent) {
    const nextText = lines[nextIdx].text;
    if (/^else if\s+(.+):$/.test(nextText)) {
      const nested = parseIntentIfNode([
        { indent: baseIndent, text: nextText.replace(/^else /, '') }
      ].concat(lines.slice(nextIdx + 1)), 0, baseIndent, false);
      elseNodes = [nested.node];
      nextIdx = nextIdx + nested.nextIdx;
    } else if (nextText === 'else:') {
      const elseBody = parseIntentCompatNodes(lines, nextIdx + 1, nextIntentChildIndent(lines, nextIdx, baseIndent));
      elseNodes = elseBody.nodes;
      nextIdx = elseBody.nextIdx;
    }
  }
  return {
    node: isBind ? {
      kind: 'ifbind',
      expr: bindMatch[1],
      bindName: bindMatch[2],
      thenNodes: thenBody.nodes,
      elseNodes: elseNodes,
    } : {
      kind: 'if',
      cond: ifMatch[1],
      thenNodes: thenBody.nodes,
      elseNodes: elseNodes,
    },
    nextIdx: nextIdx,
  };
}

function parseIntentSwitchNode(lines, idx, baseIndent, expr) {
  const cases = [];
  var i = idx + 1;
  const caseIndent = nextIntentChildIndent(lines, idx, baseIndent);
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < caseIndent) break;
    if (line.indent > caseIndent) {
      i++;
      continue;
    }
    const caseMatch = line.text.match(/^case\s+(.+):$/);
    if (!caseMatch) break;
    const caseBody = parseIntentCompatNodes(lines, i + 1, nextIntentChildIndent(lines, i, caseIndent));
    cases.push({ value: caseMatch[1], body: caseBody.nodes });
    i = caseBody.nextIdx;
  }
  return {
    node: { kind: 'switch', expr: expr, cases: cases },
    nextIdx: i,
  };
}

function nextIntentChildIndent(lines, idx, baseIndent) {
  for (var i = idx + 1; i < lines.length; i++) {
    if (lines[i].indent > baseIndent) return lines[i].indent;
    if (lines[i].indent <= baseIndent) break;
  }
  return baseIndent + 2;
}

function skipIntentBlock(lines, idx, baseIndent) {
  var i = idx;
  while (i < lines.length) {
    if (lines[i].indent <= baseIndent) break;
    i++;
  }
  return i;
}

function markIntentTerminalReturns(nodes, terminal) {
  if (!terminal || !nodes || !nodes.length) return;
  const last = nodes[nodes.length - 1];
  if (last.kind === 'stmt') {
    if (intentStmtNeedsReturn(last.text)) last.text = 'return ' + last.text;
    return;
  }
  if (last.kind === 'if' || last.kind === 'ifbind') {
    markIntentTerminalReturns(last.thenNodes, true);
    if (last.elseNodes && last.elseNodes.length) markIntentTerminalReturns(last.elseNodes, true);
    return;
  }
  if (last.kind === 'switch') {
    for (var ci = 0; ci < last.cases.length; ci++) {
      markIntentTerminalReturns(last.cases[ci].body, true);
    }
  }
}

function intentStmtNeedsReturn(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  if (trimmed === 'continue' || trimmed === 'stop') return false;
  if (trimmed.indexOf('return ') === 0) return false;
  if (/^[^=!<>]+?\s*=\s*[^=]/.test(trimmed)) return false;
  return true;
}

function renderIntentCompatNodes(nodes, baseIndent) {
  var out = [];
  for (var i = 0; i < nodes.length; i++) {
    out = out.concat(renderIntentCompatNode(nodes[i], baseIndent));
  }
  return out;
}

function renderIntentCompatNode(node, baseIndent) {
  const ind = repeatIntentIndent(baseIndent);
  if (node.kind === 'stmt') return [ind + node.text];
  if (node.kind === 'if') return renderIntentCompatIf(node.cond, node.thenNodes, node.elseNodes, baseIndent);
  if (node.kind === 'ifbind') {
    var bindLines = [ind + node.bindName + ' = ' + node.expr];
    const cond = node.bindName + ' != null';
    return bindLines.concat(renderIntentCompatIf(cond, node.thenNodes, node.elseNodes, baseIndent));
  }
  if (node.kind === 'while') {
    var whileLines = [ind + 'while ' + node.cond + ':'];
    return whileLines.concat(renderIntentCompatNodes(node.body, baseIndent + 2));
  }
  if (node.kind === 'whilebind') {
    const synthetic = {
      kind: 'if',
      cond: node.bindName + ' != null',
      thenNodes: node.body,
      elseNodes: [{ kind: 'stmt', text: 'stop' }],
    };
    return [ind + 'while true:', repeatIntentIndent(baseIndent + 2) + node.bindName + ' = ' + node.expr]
      .concat(renderIntentCompatNode(synthetic, baseIndent + 2));
  }
  if (node.kind === 'for') {
    var forHead = ind + 'for ' + node.expr + ' as ' + node.item + (node.index ? ' at ' + node.index : '') + ':';
    return [forHead].concat(renderIntentCompatNodes(node.body, baseIndent + 2));
  }
  if (node.kind === 'switch') {
    var lines = [ind + 'switch ' + node.expr + ':'];
    for (var ci = 0; ci < node.cases.length; ci++) {
      lines.push(repeatIntentIndent(baseIndent + 2) + node.cases[ci].value + ':');
      lines = lines.concat(renderIntentCompatNodes(node.cases[ci].body, baseIndent + 4));
    }
    return lines;
  }
  return [];
}

function renderIntentCompatIf(cond, thenNodes, elseNodes, baseIndent) {
  const ind = repeatIntentIndent(baseIndent);
  const thenLines = renderIntentCompatNodes(thenNodes || [], baseIndent + 2);
  const elseLines = renderIntentCompatNodes(elseNodes || [], baseIndent + 2);
  const out = [ind + cond];
  if (thenLines.length) {
    out.push(thenLines[0].replace(repeatIntentIndent(baseIndent + 2), repeatIntentIndent(baseIndent + 2) + '? '));
    for (var i = 1; i < thenLines.length; i++) out.push(thenLines[i]);
  } else {
    out.push(repeatIntentIndent(baseIndent + 2) + '? go');
  }
  if (elseLines.length) {
    out.push(elseLines[0].replace(repeatIntentIndent(baseIndent + 2), repeatIntentIndent(baseIndent + 2) + ': '));
    for (var ei = 1; ei < elseLines.length; ei++) out.push(elseLines[ei]);
  }
  return out;
}

function repeatIntentIndent(count) {
  return new Array(count + 1).join(' ');
}

function collectIntentLocalTypes(nodes, env, fnEnv) {
  for (var i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind === 'stmt') {
      const assign = node.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (assign && !env.varTypes[assign[1]] && !env.constTypes[assign[1]] && !fnEnv.paramTypes[assign[1]]) {
        const inferred = inferIntentExprType(assign[2], env, fnEnv);
        if (inferred) fnEnv.localTypes[assign[1]] = inferred;
      }
      continue;
    }
    if (node.kind === 'if' || node.kind === 'ifbind') {
      if (node.kind === 'ifbind') fnEnv.localTypes[node.bindName] = fnEnv.localTypes[node.bindName] || inferIntentExprType(node.expr, env, fnEnv) || 'usize?';
      collectIntentLocalTypes(node.thenNodes || [], env, fnEnv);
      collectIntentLocalTypes(node.elseNodes || [], env, fnEnv);
      continue;
    }
    if (node.kind === 'while' || node.kind === 'whilebind' || node.kind === 'for') {
      if (node.kind === 'whilebind') fnEnv.localTypes[node.bindName] = fnEnv.localTypes[node.bindName] || inferIntentExprType(node.expr, env, fnEnv) || 'usize?';
      collectIntentLocalTypes(node.body || [], env, fnEnv);
      continue;
    }
    if (node.kind === 'switch') {
      for (var ci = 0; ci < node.cases.length; ci++) collectIntentLocalTypes(node.cases[ci].body || [], env, fnEnv);
    }
  }
}

function inferIntentFunctionReturnType(entry, env, fnReturnTypes, knownFunctionNames) {
  const fnEnv = {
    paramTypes: {},
    localTypes: {},
    functionReturnTypes: fnReturnTypes || {},
    knownFunctionNames: knownFunctionNames || {},
  };
  for (var pi = 0; pi < entry.params.length; pi++) fnEnv.paramTypes[entry.params[pi]] = 'anytype';
  inferIntentParamTypesFromBody(entry.bodyLines, env, fnEnv);
  const normalized = normalizeIntentFunctionBodyLines(entry.bodyLines, env, fnEnv);
  const parsed = parseIntentCompatNodes(normalized, 0, normalized.length ? normalized[0].indent : 0);
  collectIntentLocalTypes(parsed.nodes, env, fnEnv);
  markIntentTerminalReturns(parsed.nodes, true);
  return inferIntentReturnTypeFromNodes(parsed.nodes, env, fnEnv);
}

function inferIntentReturnTypeFromNodes(nodes, env, fnEnv) {
  const exprs = [];
  collectIntentReturnExprs(nodes, exprs);
  if (!exprs.length) return 'void';
  var inferred = null;
  for (var i = 0; i < exprs.length; i++) {
    const type = inferIntentExprType(exprs[i], env, fnEnv);
    if (!type) return null;
    inferred = mergeIntentInferredTypes(inferred, type);
    if (!inferred) return null;
  }
  if (!intentNodesAlwaysReturn(nodes)) return makeIntentOptionalType(inferred || 'void');
  return inferred || 'void';
}

function intentNodesAlwaysReturn(nodes) {
  if (!nodes || !nodes.length) return false;
  return intentNodeAlwaysReturns(nodes[nodes.length - 1]);
}

function intentNodeAlwaysReturns(node) {
  if (!node) return false;
  if (node.kind === 'stmt') return /^return\b/.test(String(node.text || '').trim());
  if (node.kind === 'if' || node.kind === 'ifbind') {
    return !!(node.elseNodes && node.elseNodes.length) &&
      intentNodesAlwaysReturn(node.thenNodes || []) &&
      intentNodesAlwaysReturn(node.elseNodes || []);
  }
  if (node.kind === 'switch') {
    if (!node.cases || !node.cases.length) return false;
    for (var i = 0; i < node.cases.length; i++) {
      if (!intentNodesAlwaysReturn(node.cases[i].body || [])) return false;
    }
    return true;
  }
  return false;
}

function makeIntentOptionalType(type) {
  const raw = String(type || '').trim();
  if (!raw || raw === 'void' || raw.charAt(0) === '?') return raw;
  return '?' + raw;
}

function isIntentOptionalType(type) {
  const raw = String(type || '').trim();
  return raw.charAt(0) === '?' || raw.charAt(raw.length - 1) === '?';
}

function isIntentFloatType(type) {
  const raw = stripIntentOptionalType(type);
  return raw === 'f32' || raw === 'f64' || raw === 'float';
}

function isIntentIntType(type) {
  const raw = stripIntentOptionalType(type);
  return raw === 'i64' || raw === 'i32' || raw === 'u8' || raw === 'u16' ||
    raw === 'u32' || raw === 'u64' || raw === 'usize' || raw === 'int' || raw === 'number';
}

function isIntentNumericType(type) {
  return isIntentFloatType(type) || isIntentIntType(type);
}

function chooseIntentNumericType(a, b) {
  const rawA = stripIntentOptionalType(a);
  const rawB = stripIntentOptionalType(b);
  if (isIntentFloatType(rawA) || isIntentFloatType(rawB)) {
    return rawA === 'f64' || rawB === 'f64' ? 'f64' : 'f32';
  }
  if (rawA === rawB) return rawA;
  if (rawA === 'usize' && rawB === 'usize') return 'usize';
  return 'i64';
}

function mergeIntentInferredTypes(current, next) {
  if (!current) return next;
  if (!next) return current;
  if (current === next) return current;

  const rawCurrent = stripIntentOptionalType(current);
  const rawNext = stripIntentOptionalType(next);
  const optional = isIntentOptionalType(current) || isIntentOptionalType(next);

  if (rawCurrent === 'anytype') return optional ? makeIntentOptionalType(rawNext) : rawNext;
  if (rawNext === 'anytype') return optional ? makeIntentOptionalType(rawCurrent) : rawCurrent;
  if (rawCurrent === rawNext) return optional ? makeIntentOptionalType(rawCurrent) : rawCurrent;

  if (isIntentNumericType(rawCurrent) && isIntentNumericType(rawNext)) {
    const numeric = chooseIntentNumericType(rawCurrent, rawNext);
    return optional ? makeIntentOptionalType(numeric) : numeric;
  }

  return null;
}

function collectIntentReturnExprs(nodes, out) {
  for (var i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind === 'stmt') {
      const match = node.text.match(/^return\s+(.+)$/);
      if (match) out.push(match[1].trim());
      continue;
    }
    if (node.kind === 'if' || node.kind === 'ifbind') {
      collectIntentReturnExprs(node.thenNodes || [], out);
      collectIntentReturnExprs(node.elseNodes || [], out);
      continue;
    }
    if (node.kind === 'while' || node.kind === 'whilebind' || node.kind === 'for') {
      collectIntentReturnExprs(node.body || [], out);
      continue;
    }
    if (node.kind === 'switch') {
      for (var ci = 0; ci < node.cases.length; ci++) collectIntentReturnExprs(node.cases[ci].body || [], out);
    }
  }
}
