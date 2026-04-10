// Intent module normalization helpers.
//
// These helpers translate dictionary-first `<name module>` contracts into the
// older block strings consumed by the module emit atoms. The goal is not to
// preserve the legacy surface; it is to keep the emit path atomized while the
// source contract becomes the module-lane boundary.

function buildIntentModuleEnv(contract) {
  const env = {
    typeMap: {},
    variantToType: {},
    variantTypes: {},
    varTypes: {},
    constTypes: {},
    constValues: {},
    unsupported: [],
  };

  buildIntentTypeMap(contract, env);
  buildIntentVarMap(contract, env);
  inferIntentVarTypesFromFunctions(contract, env);
  return env;
}

function buildIntentTypeMap(contract, env) {
  const body = contract && contract.blocks ? contract.blocks.types : null;
  if (!body) return;
  const sections = scanTopLevelModuleSections(body);
  for (var i = 0; i < sections.length; i++) {
    const section = sections[i];
    const info = parseIntentTypeSection(section, env);
    if (!info) continue;
    env.typeMap[info.name] = info;
    if (info.variants) {
      for (var vi = 0; vi < info.variants.length; vi++) {
        if (!env.variantTypes[info.variants[vi]]) env.variantTypes[info.variants[vi]] = [];
        env.variantTypes[info.variants[vi]].push(info.name);
        if (!env.variantToType[info.variants[vi]]) env.variantToType[info.variants[vi]] = info.name;
      }
    }
  }
}

function buildIntentVarMap(contract, env) {
  const vars = contract && contract.vars ? contract.vars : [];
  for (var i = 0; i < vars.length; i++) {
    const entry = vars[i];
    const readName = entry.name.indexOf('set_') === 0 ? entry.name.slice(4) : entry.name;
    if (entry.mode === 'nested-has') {
      env.unsupported.push('nested-has-var:' + readName);
      continue;
    }
    const inferred = inferIntentDeclType(entry.value, env, readName);
    if (entry.mode === 'exact') {
      env.constTypes[readName] = inferred.type || 'i64';
      env.constValues[readName] = inferred.defaultValue || '0';
      continue;
    }
    env.varTypes[readName] = inferred.type || 'usize?';
  }
}

function inferIntentVarTypesFromFunctions(contract, env) {
  const body = contract && contract.blocks ? contract.blocks.functions : null;
  if (!body) return;
  const targetNames = Object.keys(env.varTypes);
  for (var i = 0; i < targetNames.length; i++) {
    const name = targetNames[i];
    if (env.varTypes[name] && env.varTypes[name] !== 'usize?') continue;
    const inferred = inferIntentVarTypeFromBody(name, body, env);
    if (inferred) env.varTypes[name] = inferred;
  }
}

function inferIntentVarTypeFromBody(name, body, env) {
  if (typeof parseIntentModuleFunctionEntries === 'function') {
    const entries = parseIntentModuleFunctionEntries(body);
    for (var ei = 0; ei < entries.length; ei++) {
      const inferredFromFn = inferIntentVarTypeFromFunctionEntry(name, entries[ei], env);
      if (inferredFromFn) return inferredFromFn;
    }
  }
  const re = new RegExp('^\\s*(?:set_' + escapeRegExp(name) + '|' + escapeRegExp(name) + ')\\s+is\\s+(.+)$', 'gm');
  var match;
  var inferred = null;
  while ((match = re.exec(body)) !== null) {
    const type = inferIntentExprType(match[1].trim(), env, null);
    if (!type) continue;
    if (!inferred) {
      inferred = type;
      continue;
    }
    if (inferred !== type) return inferred;
  }
  return inferred;
}

function inferIntentVarTypeFromFunctionEntry(name, entry, env) {
  const localTypes = {};
  const lines = entry && entry.bodyLines ? entry.bodyLines : [];
  for (var i = 0; i < lines.length; i++) {
    const trimmed = String(lines[i] || '').trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.charAt(0) === '<') continue;
    const assign = trimmed.match(/^([A-Za-z_]\w*)\s+is\s+(.+)$/);
    if (!assign) continue;
    const lhs = assign[1];
    const rhs = assign[2].trim();
    if (lhs === name || lhs === 'set_' + name) {
      if (localTypes[rhs]) return localTypes[rhs];
      const inferred = inferIntentDeclType(rhs, env, lhs);
      if (inferred && inferred.type) return inferred.type;
      continue;
    }
    const localInferred = inferIntentDeclType(rhs, env, lhs);
    if (localInferred && localInferred.type) localTypes[lhs] = localInferred.type;
  }
  return null;
}

function parseIntentTypeSection(section, env) {
  const headerWords = splitModuleHeaderWords(section.header);
  const name = headerWords[0];
  if (!name) return null;

  if (headerWords[1] === 'union') {
    const unionFields = parseIntentUnionFields(section.body, env);
    return {
      name: name,
      kind: 'union',
      fields: unionFields.fields,
      variants: unionFields.variantNames,
    };
  }

  const fieldInfo = parseIntentFieldLines(section.body, env);
  if (fieldInfo.fields.length === 0 && fieldInfo.variantNames.length > 0) {
    return {
      name: name,
      kind: 'enum',
      fields: [],
      variants: fieldInfo.variantNames,
    };
  }

  return {
    name: name,
    kind: 'struct',
    fields: fieldInfo.fields,
    variants: [],
  };
}

function parseIntentUnionFields(body, env) {
  const lines = parseBodyWordList(body);
  const fields = [];
  const variants = [];
  for (var i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMatch = line.match(/^([.]?\w+)\s+is\s+(.+)$/);
    if (isMatch) {
      fields.push({
        name: isMatch[1].replace(/^\./, ''),
        type: normalizeIntentTypeName(isMatch[2].trim(), env) || 'usize?',
        defaultValue: null,
      });
      variants.push(isMatch[1].replace(/^\./, ''));
      continue;
    }
    const bareMatch = line.match(/^([.]?\w+)$/);
    if (bareMatch) {
      const bareName = bareMatch[1].replace(/^\./, '');
      fields.push({
        name: bareName,
        type: 'void',
        defaultValue: null,
      });
      variants.push(bareName);
    }
  }
  return { fields: fields, variantNames: variants };
}

function parseIntentFieldLines(body, env) {
  const lines = parseBodyWordList(body);
  const fields = [];
  const variants = [];
  var hasTypedField = false;
  for (var ti = 0; ti < lines.length; ti++) {
    if (/\s+(?:is|exact)\s+/.test(lines[ti])) {
      hasTypedField = true;
      break;
    }
  }
  for (var i = 0; i < lines.length; i++) {
    const line = lines[i];
    const exactMatch = line.match(/^([.]?\w+)\s+exact\s+(.+)$/);
    if (exactMatch) {
      fields.push({
        name: exactMatch[1].replace(/^\./, ''),
        type: normalizeIntentTypeName(exactMatch[2].trim(), env),
        defaultValue: null,
      });
      continue;
    }
    const isMatch = line.match(/^([.]?\w+)\s+is\s+(.+)$/);
    if (isMatch) {
      const fieldName = isMatch[1].replace(/^\./, '');
      const inferred = inferIntentDeclType(isMatch[2].trim(), env, fieldName);
      fields.push({
        name: fieldName,
        type: inferred.type || 'usize?',
        defaultValue: inferred.defaultValue,
      });
      continue;
    }
    const bareMatch = line.match(/^([.]?\w+)$/);
    if (bareMatch) {
      const bareName = bareMatch[1].replace(/^\./, '');
      if (hasTypedField) {
        fields.push({
          name: bareName,
          type: 'usize?',
          defaultValue: null,
        });
      } else {
        variants.push(bareName);
      }
    }
  }
  if (fields.length > 0) variants.length = 0;
  return { fields: fields, variantNames: variants };
}

function inferIntentDeclType(value, env, fieldName) {
  const raw = String(value || '').trim();
  if (!raw) return { type: 'usize?', defaultValue: null };
  if (raw === 'string') return { type: 'string', defaultValue: "''" };
  if (raw === 'bool' || raw === 'boolean') return { type: 'bool', defaultValue: 'false' };
  if (raw === 'number' || raw === 'int' || raw === 'i64') return { type: 'i64', defaultValue: '0' };
  if (raw === 'float' || raw === 'f32' || raw === 'f64') return { type: raw === 'f64' ? 'f64' : 'f32', defaultValue: '0.0' };
  if (raw === 'array') return { type: null, defaultValue: null };
  if (raw === 'object' || raw === 'objects') return { type: null, defaultValue: null };
  const arrType = raw.match(/^([A-Za-z_]\w*|string|bool|boolean|number|int|i64|f32|f64)\s+array$/);
  if (arrType) {
    return {
      type: normalizeIntentTypeName(arrType[1], env) + '[]',
      defaultValue: null,
    };
  }
  if (raw === 'true' || raw === 'false') return { type: 'bool', defaultValue: raw };
  if (/^-?\d+$/.test(raw)) return { type: 'i64', defaultValue: raw };
  if (/^-?\d+\.\d+$/.test(raw)) return { type: 'f32', defaultValue: raw };
  if (/^'.*'$/.test(raw) || /^".*"$/.test(raw)) return { type: 'string', defaultValue: raw };
  const variantType = inferIntentVariantType(raw, env, fieldName);
  if (variantType) return { type: variantType, defaultValue: raw };
  if (env.typeMap[raw]) return { type: raw, defaultValue: null };
  return {
    type: inferIntentExprType(raw, env, null),
    defaultValue: null,
  };
}

function inferIntentVariantType(raw, env, fieldName) {
  const candidates = env && env.variantTypes ? env.variantTypes[raw] : null;
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const normalizedField = String(fieldName || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (normalizedField) {
    for (var i = 0; i < candidates.length; i++) {
      const normalizedType = String(candidates[i]).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      if (normalizedField === normalizedType || normalizedField.indexOf(normalizedType) === 0 || normalizedType.indexOf(normalizedField) === 0) {
        return candidates[i];
      }
    }
  }
  return candidates[0];
}

function normalizeIntentTypeName(raw, env) {
  const t = String(raw || '').trim();
  if (!t) return 'usize?';
  if (t === 'string') return 'string';
  if (t === 'bool' || t === 'boolean') return 'bool';
  if (t === 'number' || t === 'int') return 'i64';
  if (t === 'float') return 'f32';
  if (t === 'array') return null;
  if (t === 'object' || t === 'objects') return null;
  const arrType = t.match(/^([A-Za-z_]\w*|string|bool|boolean|number|int|i64|f32|f64)\s+array$/);
  if (arrType) return normalizeIntentTypeName(arrType[1], env) + '[]';
  if (env && env.typeMap && env.typeMap[t]) return t;
  return t;
}

function inferIntentExprType(expr, env, fnEnv) {
  const raw = String(expr || '').trim();
  if (!raw) return null;
  if (raw === 'true' || raw === 'false') return 'bool';
  if (/^-?\d+$/.test(raw)) return 'i64';
  if (/^-?\d+\.\d+$/.test(raw)) return 'f32';
  if (/^'.*'$/.test(raw) || /^".*"$/.test(raw)) return 'string';
  if (/^\.\w+$/.test(raw) && env.variantToType[raw.slice(1)]) return env.variantToType[raw.slice(1)];
  const unionLiteral = raw.match(/^\.\{\s*\.(\w+)\s*=\s*[\s\S]+\}$/);
  if (unionLiteral && env.variantToType[unionLiteral[1]]) return env.variantToType[unionLiteral[1]];
  if (/^[A-Za-z_]\w*$/.test(raw)) {
    if (fnEnv && fnEnv.localTypes && fnEnv.localTypes[raw]) return fnEnv.localTypes[raw];
    if (fnEnv && fnEnv.paramTypes && fnEnv.paramTypes[raw]) return fnEnv.paramTypes[raw];
    if (env.varTypes[raw]) return env.varTypes[raw];
    if (env.constTypes[raw]) return env.constTypes[raw];
    if (env.variantToType[raw]) return env.variantToType[raw];
    if (env.typeMap[raw]) return raw;
    return null;
  }
  const unionCtor = raw.match(/^([A-Za-z_]\w*)\s*\(/);
  if (unionCtor && env.variantToType[unionCtor[1]]) return env.variantToType[unionCtor[1]];
  if (/^(not|!)/.test(raw)) return 'bool';
  if (/\bexact\b|\bnot exact\b|\bexact or above\b|\bexact or below\b|\babove\b|\bbelow\b|==|!=|>=|<=|>|<|\band\b|\bor\b|\|\||&&/.test(raw)) {
    return 'bool';
  }
  const mathCall = raw.match(/^math\.(\w+)\(/);
  if (mathCall) {
    if (mathCall[1] === 'floor' || mathCall[1] === 'ceil' || mathCall[1] === 'round') return 'i64';
    return 'f32';
  }
  if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(raw)) return resolveIntentRefType(raw, env, fnEnv);
  if (/[+\-*/%]/.test(raw)) {
    return raw.indexOf('.') >= 0 ? 'f32' : 'i64';
  }
  const callMatch = raw.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(/);
  if (callMatch && fnEnv && fnEnv.functionReturnTypes && fnEnv.functionReturnTypes[callMatch[1]]) {
    return fnEnv.functionReturnTypes[callMatch[1]];
  }
  return null;
}

function resolveIntentRefType(expr, env, fnEnv) {
  const parts = expr.split('.');
  if (!parts.length) return null;
  var type = null;
  const head = parts[0];
  if (fnEnv && fnEnv.localTypes && fnEnv.localTypes[head]) type = fnEnv.localTypes[head];
  else if (fnEnv && fnEnv.paramTypes && fnEnv.paramTypes[head]) type = fnEnv.paramTypes[head];
  else if (env.varTypes[head]) type = env.varTypes[head];
  else if (env.constTypes[head]) type = env.constTypes[head];
  if (!type) return null;
  for (var i = 1; i < parts.length; i++) {
    type = stripIntentOptionalType(type);
    if (parts[i] === 'length' || parts[i] === 'len') {
      if (type === 'string' || /\[\]$/.test(type) || /^\[[^\]]+\]/.test(type)) return 'i64';
    }
    if (type === 'string' || /\[\]$/.test(type) || /^\[[^\]]+\]/.test(type)) return null;
    const info = env.typeMap[type];
    if (!info || !info.fields) return null;
    const field = findIntentTypeField(info, parts[i]);
    if (!field) return null;
    type = stripIntentOptionalType(field.type);
  }
  return type;
}

function findIntentTypeField(info, name) {
  const fields = info && info.fields ? info.fields : [];
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].name === name) return fields[i];
  }
  return null;
}

function stripIntentOptionalType(type) {
  var t = String(type || '').trim();
  if (t.charAt(0) === '?') return t.slice(1);
  if (t.charAt(t.length - 1) === '?') return t.slice(0, -1);
  return t;
}

function normalizeIntentModuleImports(contract) {
  const uses = contract && contract.uses ? contract.uses : [];
  if (!uses.length) return null;
  var out = '';
  for (var i = 0; i < uses.length; i++) {
    out += uses[i] + ' from "./generated_' + uses[i] + '.mod.zig"\n';
  }
  return out.replace(/\n+$/, '\n');
}

function normalizeIntentModuleFfi(contract) {
  const ffi = contract && contract.ffi ? contract.ffi : [];
  if (!ffi.length) return null;
  var out = '';
  for (var i = 0; i < ffi.length; i++) {
    const entry = ffi[i];
    for (var si = 0; si < entry.symbols.length; si++) {
      out += entry.symbols[si] + ' @("' + entry.lib + '")\n';
    }
  }
  return out.replace(/\n+$/, '\n');
}

function normalizeIntentModuleTypes(contract, env) {
  const body = contract && contract.blocks ? contract.blocks.types : null;
  if (!body) return null;
  const sections = scanTopLevelModuleSections(body);
  var out = '';
  for (var i = 0; i < sections.length; i++) {
    const info = env.typeMap[splitModuleHeaderWords(sections[i].header)[0]];
    if (!info) continue;
    out += renderIntentCompatType(info);
  }
  return out || null;
}

function renderIntentCompatType(info) {
  if (info.kind === 'enum') {
    return info.name + ': ' + info.variants.join(' | ') + '\n\n';
  }
  if (info.kind === 'union') {
    var unionOut = info.name + ': union {\n';
    for (var i = 0; i < info.fields.length; i++) {
      unionOut += '  ' + info.fields[i].name + ': ' + info.fields[i].type + '\n';
    }
    unionOut += '}\n\n';
    return unionOut;
  }
  var out = info.name + ': {\n';
  for (var fi = 0; fi < info.fields.length; fi++) {
    const field = info.fields[fi];
    out += '  ' + field.name + ': ' + field.type;
    if (field.defaultValue != null) out += ' = ' + field.defaultValue;
    out += '\n';
  }
  out += '}\n\n';
  return out;
}

function normalizeIntentModuleState(contract, env) {
  const vars = contract && contract.vars ? contract.vars : [];
  if (!vars.length) return { state: null, consts: null };
  var stateOut = '';
  var constOut = '';
  for (var i = 0; i < vars.length; i++) {
    const entry = vars[i];
    if (entry.mode === 'nested-has') continue;
    const readName = entry.name.indexOf('set_') === 0 ? entry.name.slice(4) : entry.name;
    if (entry.mode === 'exact') {
      const constType = env.constTypes[readName] || 'i64';
      const constValue = env.constValues[readName] || '0';
      constOut += readName + ': ' + constType + ' = ' + constValue + '\n';
      continue;
    }
    const inferred = inferIntentDeclType(entry.value, env);
    const stateType = env.varTypes[readName] || inferred.type || 'usize?';
    stateOut += readName + ': ' + stateType;
    if (inferred.defaultValue != null) stateOut += ' = ' + inferred.defaultValue;
    stateOut += '\n';
  }
  return {
    state: stateOut || null,
    consts: constOut || null,
  };
}
