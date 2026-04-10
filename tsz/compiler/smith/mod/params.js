// Mod params — extracted from mod.js

function modTranspileParams(params) {
  return emitModParams(parseModParams(params), null);
}

function parseModParams(params) {
  if (!params.trim()) return [];
  return params.split(',').map(function(p) {
    const m = p.trim().match(/^(\w+):\s*(.+)$/);
    if (!m) return null;
    return {
      name: m[1],
      rawType: m[2].trim(),
    };
  }).filter(Boolean);
}

function emitModParams(paramInfo, fnName) {
  return paramInfo.map(function(p, idx) {
    let zigType = modTranspileType(p.rawType);
    var isPtr = !!(p.isPtr || (fnName && _modFnPtrParams[fnName] && _modFnPtrParams[fnName][idx]));
    if (isPtr) zigType = '*' + zigType;
    return modEscapeLocalName(p.name) + ': ' + zigType;
  }).join(', ');
}

function buildModParamTypeMap(paramInfo) {
  const out = {};
  for (let i = 0; i < (paramInfo || []).length; i++) out[paramInfo[i].name] = paramInfo[i].rawType || 'anytype';
  return out;
}

function registerModPtrParam(fnName, idx) {
  if (!_modFnPtrParams[fnName]) _modFnPtrParams[fnName] = {};
  _modFnPtrParams[fnName][idx] = true;
}

function inferModParamPointerFlags(fnName, paramInfo, rawBodyLines, typeNames) {
  for (let i = 0; i < paramInfo.length; i++) {
    if (!modTypeCanUsePointer(paramInfo[i].rawType, typeNames)) continue;
    if (!modBodyMutatesParam(paramInfo[i].name, rawBodyLines)) continue;
    registerModPtrParam(fnName, i);
    paramInfo[i].isPtr = true;
  }
}

function modTypeCanUsePointer(rawType, typeNames) {
  const base = stripModTypeWrappers(rawType);
  if (!base) return false;
  return typeNames.indexOf(base) !== -1 || _modImportedNames.indexOf(base) !== -1;
}

function stripModTypeWrappers(rawType) {
  let t = (rawType || '').trim();
  while (t.startsWith('?') || t.startsWith('!')) t = t.slice(1).trim();
  while (t.endsWith('?')) t = t.slice(0, -1).trim();
  if (t.endsWith('[]')) return t.slice(0, -2).trim();
  const arrMatch = t.match(/^(\w+)\[([A-Za-z_]\w*|\d+)\]$/);
  if (arrMatch) return arrMatch[1];
  return t;
}

function modBodyMutatesParam(paramName, rawBodyLines) {
  const assignRe = new RegExp('^' + escapeRegExp(paramName) + '\\s*=(?!=)');
  const fieldRe = new RegExp('^' + escapeRegExp(paramName) + '(?:\\.|\\[|\\.\\?)');
  for (let i = 0; i < rawBodyLines.length; i++) {
    const raw = rawBodyLines[i].trim();
    if (!raw || raw.startsWith('//')) continue;
    if (textMutatesPatterns(raw, assignRe, fieldRe)) return true;
    if (textPassesNameAsPtr(raw, paramName)) return true;
  }
  return false;
}
