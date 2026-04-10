// ── Contract: Module Source Schema ─────────────────────────────
// Builds a normalized module contract for both compatibility block modules
// (`<module name>`) and active intent-named modules (`<name module>`).
//
// This contract is the module-lane boundary between authored syntax and emit.
// Emit may still consume raw block bodies during the transition, but the lane
// now routes through a stable module contract object first.

function isCompatModuleBlockSource(source) {
  return /<module\s+\w+>/.test(source || '');
}

function isIntentNamedModuleSource(source) {
  return /^\s*<\w+\s+module>/m.test(source || '');
}

function buildModuleSourceContract(source, file) {
  const target = globalThis.__modTarget || 'zig';
  if (isCompatModuleBlockSource(source)) return buildCompatModuleContract(source, file, target);
  if (isIntentNamedModuleSource(source)) return buildIntentModuleContract(source, file, target);
  return {
    version: 'module-contract-v1',
    file: file,
    moduleName: inferModuleNameFromFile(file),
    syntax: 'legacy-line',
    target: target,
    sections: [],
    blocks: {},
    uses: [],
    ffi: [],
    types: [],
    vars: [],
    functions: [],
    topLevelDurings: [],
    legacyExtensions: [],
    unsupportedForEmit: ['legacy-line-transpiler'],
  };
}

function compileModuleFromSourceContract(contract, source, file) {
  void source;
  if (!contract) return null;
  if (contract.syntax === 'compat-block' && typeof compileCompatModuleContract === 'function') {
    return compileCompatModuleContract(contract, file);
  }
  if (contract.syntax === 'intent-named' && typeof compileIntentModuleContract === 'function') {
    return compileIntentModuleContract(contract, file);
  }
  return null;
}

function buildCompatModuleContract(source, file, target) {
  const moduleMatch = source.match(/<module\s+(\w+)>/);
  const moduleName = moduleMatch ? moduleMatch[1] : inferModuleNameFromFile(file);
  const inner = extractCompatModuleInner(source, moduleName);
  const blocks = {
    imports: extractCompatModuleBlock(inner, 'imports'),
    ffi: extractCompatModuleBlock(inner, 'ffi'),
    types: extractCompatModuleBlock(inner, 'types'),
    consts: extractCompatModuleBlock(inner, 'const'),
    state: extractCompatModuleBlock(inner, 'state'),
    functions: extractCompatModuleBlock(inner, 'functions'),
  };
  return {
    version: 'module-contract-v1',
    file: file,
    moduleName: moduleName,
    syntax: 'compat-block',
    target: target,
    sections: scanTopLevelModuleSections(inner),
    blocks: blocks,
    uses: [],
    ffi: blocks.ffi ? parseCompatFfiSummary(blocks.ffi) : [],
    types: blocks.types ? parseCompatTypeEntries(blocks.types) : [],
    vars: blocks.state ? parseCompatStateSummary(blocks.state) : [],
    functions: blocks.functions ? parseCompatModuleFunctionHeaders(blocks.functions) : [],
    topLevelDurings: [],
    legacyExtensions: ['compat-block-surface'],
    unsupportedForEmit: [],
  };
}

function buildIntentModuleContract(source, file, target) {
  const openMatch = source.match(/^\s*<(\w+)\s+module>/m);
  const moduleName = openMatch ? openMatch[1] : inferModuleNameFromFile(file);
  const inner = extractIntentModuleInner(source, moduleName);
  const sections = scanTopLevelModuleSections(inner);
  const blocks = {
    uses: null,
    types: null,
    var: null,
    state: null,
    functions: null,
  };
  const uses = [];
  const ffi = [];
  const types = [];
  const vars = [];
  const functions = [];
  const topLevelDurings = [];
  const legacyExtensions = [];

  for (var i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section.kind === 'uses') {
      blocks.uses = joinModuleBodies(blocks.uses, section.body);
      const names = parseBodyWordList(section.body);
      for (var ui = 0; ui < names.length; ui++) uses.push(names[ui]);
      continue;
    }
    if (section.kind === 'ffi') {
      ffi.push({
        lib: section.name,
        symbols: parseBodyWordList(section.body),
        rawBody: section.body,
      });
      continue;
    }
    if (section.kind === 'types') {
      blocks.types = joinModuleBodies(blocks.types, section.body);
      const typeEntries = parseIntentTypeEntries(section.body);
      for (var ti = 0; ti < typeEntries.length; ti++) types.push(typeEntries[ti]);
      continue;
    }
    if (section.kind === 'var') {
      blocks.var = joinModuleBodies(blocks.var, section.body);
      const varEntries = parseIntentVarEntries(section.body);
      for (var vi = 0; vi < varEntries.length; vi++) vars.push(varEntries[vi]);
      continue;
    }
    if (section.kind === 'state') {
      blocks.state = joinModuleBodies(blocks.state, section.body);
      legacyExtensions.push('state-block');
      continue;
    }
    if (section.kind === 'functions') {
      blocks.functions = joinModuleBodies(blocks.functions, section.body);
      const fnEntries = parseModuleFunctionHeaders(section.body);
      for (var fi = 0; fi < fnEntries.length; fi++) {
        functions.push(fnEntries[fi]);
      }
      continue;
    }
    if (section.kind === 'during') {
      topLevelDurings.push({
        condition: section.attrs || '',
        rawBody: section.body,
      });
      continue;
    }
  }

  if (blocks.functions && countModuleBlockSections(inner, 'functions') > 1) {
    pushUniqueString(legacyExtensions, 'multiple-functions-blocks');
  }

  const contract = {
    version: 'module-contract-v1',
    file: file,
    moduleName: moduleName,
    syntax: 'intent-named',
    target: target,
    sections: sections,
    blocks: blocks,
    uses: uses,
    ffi: ffi,
    types: types,
    vars: vars,
    functions: functions,
    topLevelDurings: topLevelDurings,
    legacyExtensions: legacyExtensions,
    unsupportedForEmit: [],
  };
  contract.unsupportedForEmit = computeIntentModuleUnsupportedForEmit(contract);
  return contract;
}

function computeIntentModuleUnsupportedForEmit(contract) {
  if (!contract || contract.syntax !== 'intent-named') return [];
  if (typeof buildIntentModuleEnv === 'function' && typeof assessIntentModuleSupport === 'function') {
    const support = assessIntentModuleSupport(contract, buildIntentModuleEnv(contract));
    return support && support.reasons ? support.reasons.slice() : [];
  }
  return ['intent-emit-consumer-missing'];
}

function inferModuleNameFromFile(file) {
  const basename = (file || 'unknown.mod.tsz').split('/').pop();
  return basename.replace(/\.mod\.tsz$/, '').replace(/\.tsz$/, '');
}

function extractCompatModuleInner(source, moduleName) {
  const openRe = new RegExp('<module\\s+' + moduleName + '\\s*>');
  const openMatch = source.match(openRe);
  if (!openMatch) return source;
  const startIdx = openMatch.index + openMatch[0].length;
  const endIdx = source.indexOf('</module>', startIdx);
  if (endIdx < 0) return source;
  return source.slice(startIdx, endIdx);
}

function extractIntentModuleInner(source, moduleName) {
  const openRe = new RegExp('<' + moduleName + '\\s+module\\s*>');
  const openMatch = source.match(openRe);
  if (!openMatch) return source;
  const startIdx = openMatch.index + openMatch[0].length;
  const endIdx = source.indexOf('</' + moduleName + '>', startIdx);
  if (endIdx < 0) return source;
  return source.slice(startIdx, endIdx);
}

function extractCompatModuleBlock(source, tag) {
  const re = new RegExp('^\\s*<' + tag + '>\\s*\\n([\\s\\S]*?)^\\s*<\\/' + tag + '>\\s*$', 'm');
  const m = source.match(re);
  return m ? m[1] : null;
}

function countModuleBlockSections(source, kind) {
  const sections = scanTopLevelModuleSections(source);
  var count = 0;
  for (var i = 0; i < sections.length; i++) {
    if (sections[i].kind === kind) count += 1;
  }
  return count;
}

function scanTopLevelModuleSections(source) {
  const sections = [];
  var pos = 0;
  while (pos < source.length) {
    const next = source.indexOf('<', pos);
    if (next < 0) break;
    const range = readBalancedModuleTagRange(source, next);
    if (!range) {
      pos = next + 1;
      continue;
    }
    if (!range.openTag.closing) {
      sections.push(classifyTopLevelModuleSection(range, source));
      pos = range.end;
      continue;
    }
    pos = next + 1;
  }
  return sections;
}

function classifyTopLevelModuleSection(range, source) {
  const open = range.openTag;
  const parts = splitModuleHeaderWords(open.header);
  var kind = parts[0] || 'unknown';
  var attrs = parts.slice(1).join(' ');
  if (parts.length === 2 && parts[1] === 'ffi') {
    kind = 'ffi';
    attrs = 'ffi';
  }
  if (parts.length === 1 && parts[0] === 'during') {
    attrs = '';
  }
  if (parts.length > 1 && parts[0] === 'during') {
    kind = 'during';
    attrs = open.header.slice('during'.length).trim();
  }
  return {
    kind: kind,
    name: open.name,
    header: open.header,
    attrs: attrs,
    start: range.start,
    end: range.end,
    body: source.slice(range.bodyStart, range.bodyEnd),
    openTag: open.raw,
    closeTag: range.closeTag ? range.closeTag.raw : null,
    raw: source.slice(range.start, range.end),
  };
}

function readBalancedModuleTagRange(source, startIdx) {
  const open = readModuleTag(source, startIdx);
  if (!open || open.closing || open.selfClosing) return null;
  var pos = open.end;
  var depth = 1;
  while (pos < source.length) {
    const next = source.indexOf('<', pos);
    if (next < 0) break;
    const tag = readModuleTag(source, next);
    if (!tag) {
      pos = next + 1;
      continue;
    }
    if (tag.name === open.name && !tag.selfClosing) {
      depth += tag.closing ? -1 : 1;
      if (depth === 0) {
        return {
          start: startIdx,
          end: tag.end,
          bodyStart: open.end,
          bodyEnd: tag.start,
          openTag: open,
          closeTag: tag,
        };
      }
    }
    pos = tag.end;
  }
  return null;
}

function readModuleTag(source, startIdx) {
  if (source.charAt(startIdx) !== '<') return null;
  const endIdx = source.indexOf('>', startIdx + 1);
  if (endIdx < 0) return null;
  var inner = source.slice(startIdx + 1, endIdx).trim();
  if (!inner) return null;
  var closing = false;
  if (inner.charAt(0) === '/') {
    closing = true;
    inner = inner.slice(1).trim();
  }
  var selfClosing = false;
  if (inner.charAt(inner.length - 1) === '/') {
    selfClosing = true;
    inner = inner.slice(0, -1).trim();
  }
  const name = splitModuleHeaderWords(inner)[0] || '';
  return {
    raw: source.slice(startIdx, endIdx + 1),
    header: inner,
    name: name,
    closing: closing,
    selfClosing: selfClosing,
    start: startIdx,
    end: endIdx + 1,
  };
}

function splitModuleHeaderWords(header) {
  return String(header || '').trim().split(/\s+/).filter(Boolean);
}

function parseBodyWordList(body) {
  return String(body || '')
    .split('\n')
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line && !line.startsWith('//'); });
}

function parseIntentTypeEntries(body) {
  const sections = scanTopLevelModuleSections(body);
  const entries = [];
  for (var i = 0; i < sections.length; i++) {
    const section = sections[i];
    const headerWords = splitModuleHeaderWords(section.header);
    const name = headerWords[0] || section.name;
    var kind = 'struct';
    if (headerWords.length > 1 && headerWords[1] === 'union') kind = 'union';
    else if (headerWords.length > 1 && headerWords[1] === 'has') kind = 'has';
    else {
      const members = parseBodyWordList(section.body);
      var enumLike = members.length > 0;
      for (var mi = 0; mi < members.length; mi++) {
        if (!/^[.]?\w+$/.test(members[mi])) {
          enumLike = false;
          break;
        }
      }
      if (enumLike) kind = 'enum';
    }
    entries.push({
      name: name,
      kind: kind,
      memberCount: parseBodyWordList(section.body).length,
      rawBody: section.body,
    });
  }
  return entries;
}

function parseIntentVarEntries(body) {
  const nested = scanTopLevelModuleSections(body);
  var plainBody = String(body || '');
  for (var ri = nested.length - 1; ri >= 0; ri--) {
    plainBody = plainBody.slice(0, nested[ri].start) + plainBody.slice(nested[ri].end);
  }
  const lines = plainBody.split('\n');
  const entries = [];
  for (var i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    if (trimmed.charAt(0) === '<' || trimmed.indexOf('</') === 0) continue;
    const exactMatch = trimmed.match(/^([.]?\w+)\s+exact\s+(.+)$/);
    if (exactMatch) {
      entries.push({
        name: exactMatch[1],
        mode: 'exact',
        value: exactMatch[2].trim(),
        setter: exactMatch[1].indexOf('set_') === 0,
      });
      continue;
    }
    const isMatch = trimmed.match(/^([.]?\w+)\s+is\s+(.+)$/);
    if (isMatch) {
      entries.push({
        name: isMatch[1],
        mode: 'is',
        value: isMatch[2].trim(),
        setter: isMatch[1].indexOf('set_') === 0,
      });
      continue;
    }
    const bareMatch = trimmed.match(/^([.]?\w+)$/);
    if (bareMatch) {
      entries.push({
        name: bareMatch[1],
        mode: 'bare',
        value: null,
        setter: bareMatch[1].indexOf('set_') === 0,
      });
    }
  }
  for (var ni = 0; ni < nested.length; ni++) {
    const nestedWords = splitModuleHeaderWords(nested[ni].header);
    if (nestedWords.length > 1 && nestedWords[1] === 'has') {
      entries.push({
        name: nestedWords[0],
        mode: 'nested-has',
        value: null,
        setter: nestedWords[0].indexOf('set_') === 0,
      });
    }
  }
  return entries;
}

function parseModuleFunctionHeaders(body) {
  const lines = String(body || '').split('\n');
  const entries = [];
  for (var i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;
    if (!trimmed || trimmed.startsWith('//') || indent > 4) continue;
    if (trimmed.charAt(0) === '<' || trimmed.indexOf('</') === 0) continue;
    if (!/:\s*$/.test(trimmed)) continue;
    const header = trimmed.slice(0, -1).trim();
    const parsed = parseSingleModuleFunctionHeader(header);
    if (parsed) entries.push(parsed);
  }
  return entries;
}

function parseSingleModuleFunctionHeader(header) {
  const parenMatch = header.match(/^([A-Za-z_]\w*)\(([^)]*)\)\s*(.*)$/);
  var name = '';
  var params = [];
  var rest = '';
  if (parenMatch) {
    name = parenMatch[1];
    params = parenMatch[2].trim() ? parenMatch[2].split(',').map(function(p) { return p.trim(); }) : [];
    rest = (parenMatch[3] || '').trim();
  } else {
    const bareMatch = header.match(/^([A-Za-z_]\w*)\s*(.*)$/);
    if (!bareMatch) return null;
    name = bareMatch[1];
    rest = (bareMatch[2] || '').trim();
  }
  const everyMatch = rest.match(/\bevery\s+(.+)$/);
  if (rest && !/^(cleanup(?:\s+every\s+.+)?|every\s+.+(?:\s+cleanup)?)$/.test(rest)) return null;
  return {
    name: name,
    params: params,
    cleanup: /\bcleanup\b/.test(rest),
    every: everyMatch ? everyMatch[1].trim() : null,
    rawHeader: header,
  };
}

function parseCompatFfiSummary(body) {
  const lines = parseBodyWordList(body);
  const summary = [];
  for (var i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\w+)\s+@\("([^"]+)"/);
    if (!match) continue;
    summary.push({ symbol: match[1], lib: match[2] });
  }
  return summary;
}

function parseCompatStateSummary(body) {
  const lines = parseBodyWordList(body);
  const summary = [];
  for (var i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\w+)\s*:/);
    if (!match) continue;
    summary.push({ name: match[1] });
  }
  return summary;
}

function parseCompatTypeEntries(body) {
  const lines = parseBodyWordList(body);
  const summary = [];
  for (var i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/);
    if (!match) continue;
    var kind = 'alias';
    if (match[2].indexOf('|') !== -1) kind = 'enum';
    else if (match[2].indexOf('union') === 0) kind = 'union';
    else if (match[2].indexOf('{') === 0) kind = 'struct';
    else if (match[2].indexOf('fn(') === 0 || match[2].indexOf('fn (') === 0) kind = 'fn-type';
    summary.push({ name: match[1], kind: kind });
  }
  return summary;
}

function parseCompatModuleFunctionHeaders(body) {
  const lines = String(body || '').split('\n');
  const entries = [];
  for (var i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const indent = raw.match(/^(\s*)/)[1].length;
    if (!trimmed || trimmed.startsWith('//') || indent > 4) continue;
    const match = trimmed.match(/^([A-Za-z_]\w*)\(([^)]*)\)\s*(?::\s*(\S+))?\s*$/);
    if (!match) continue;
    entries.push({
      name: match[1],
      params: match[2].trim() ? match[2].split(',').map(function(p) { return p.trim(); }) : [],
      returnType: match[3] || 'void',
      rawHeader: trimmed,
    });
  }
  return entries;
}

function joinModuleBodies(current, next) {
  if (!next) return current;
  if (!current) return next;
  return current.replace(/\s+$/, '') + '\n\n' + next.replace(/^\s+/, '');
}

function pushUniqueString(list, value) {
  if (list.indexOf(value) === -1) list.push(value);
}
