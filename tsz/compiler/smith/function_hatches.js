// Shared `<functions>` hatch parsing for page/chad lanes.
//
// This keeps the source-contract boundary honest: authored function syntax is
// parsed once, backend ownership is attached there, and emit consumes that
// contract instead of rediscovering hatches later.

function parsePageFunctionHeader(line) {
  var match = String(line || '').trim().match(
    /^(\w+)(?:\s+every\s+(\d+))?(?:\s+requires\s+([\w\s,]+))?(\(([^)]*)\))?\s*:$/);
  if (!match) return null;
  return {
    name: match[1],
    interval: match[2] ? parseInt(match[2], 10) : 0,
    requires: match[3]
      ? match[3].split(',').map(function(part) { return part.trim(); }).filter(Boolean)
      : [],
    params: match[5]
      ? match[5].split(',').map(function(part) { return part.trim(); }).filter(Boolean)
      : [],
    rawHeader: String(line || '').trim(),
  };
}

function parsePageFunctionEntries(block) {
  if (!block) return [];

  var lines = String(block || '').split('\n');
  var entries = [];
  var current = null;
  var backend = 'auto';

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var trimmed = raw.trim();

    if (trimmed === '<script>') { backend = 'script'; continue; }
    if (trimmed === '<lscript>') { backend = 'lscript'; continue; }
    if (trimmed === '<zscript>') { backend = 'zscript'; continue; }
    if (trimmed === '</script>' || trimmed === '</lscript>' || trimmed === '</zscript>') {
      backend = 'auto';
      continue;
    }

    var header = parsePageFunctionHeader(trimmed);
    if (header) {
      if (current) entries.push(current);
      current = {
        name: header.name,
        params: header.params,
        requires: header.requires,
        interval: header.interval,
        backend: backend,
        rawHeader: header.rawHeader,
        bodyLines: [],
      };
      continue;
    }

    if (current) current.bodyLines.push(raw);
  }

  if (current) entries.push(current);
  return entries;
}

function buildFunctionBackendMap(entries) {
  var out = {};
  for (var i = 0; i < (entries || []).length; i++) out[entries[i].name] = entries[i].backend || 'auto';
  return out;
}

function listFunctionNames(entries) {
  var out = [];
  for (var i = 0; i < (entries || []).length; i++) {
    if (out.indexOf(entries[i].name) < 0) out.push(entries[i].name);
  }
  return out;
}

function filterFunctionEntriesByBackend(entries, backendList) {
  var allowed = {};
  for (var i = 0; i < backendList.length; i++) allowed[backendList[i]] = true;
  return (entries || []).filter(function(entry) {
    return !!allowed[entry.backend || 'auto'];
  });
}

function renderFunctionEntriesBlock(entries, backend) {
  var lines = [];
  for (var i = 0; i < (entries || []).length; i++) {
    var entry = entries[i];
    if ((entry.backend || 'auto') !== backend) continue;
    lines.push(entry.rawHeader || (entry.name + ':'));
    for (var bi = 0; bi < entry.bodyLines.length; bi++) lines.push(entry.bodyLines[bi]);
  }
  return lines.join('\n').trim();
}

