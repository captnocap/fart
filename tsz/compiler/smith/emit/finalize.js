// Emit final cleanup/post-pass

function appendEmitDebugSections(out) {
  if (ctx._debugLines && ctx._debugLines.length > 0) {
    out += '\n// ── SMITH DEBUG ──\n';
    for (const line of ctx._debugLines) out += '// ' + line + '\n';
  }
  if (globalThis.__dbg && globalThis.__dbg.length > 0) {
    out += '\n// ── Smith debug log ──\n';
    for (const msg of globalThis.__dbg) out += '// DBG: ' + msg + '\n';
    globalThis.__dbg = [];
  }
  return out;
}

function appendSourcePaletteComment(out) {
  var source = (ctx && ctx._source) || globalThis.__source || '';
  if (!source) return out;

  var srcHexRe = /#[0-9a-fA-F]{3,8}/g;
  var match;
  var seen = {};
  while ((match = srcHexRe.exec(source)) !== null) seen[match[0]] = 1;

  var srcHexKeys = Object.keys(seen);
  if (srcHexKeys.length === 0) return out;

  if (out.indexOf('// source-palette:') >= 0) return out;
  return out + '\n// source-palette: ' + srcHexKeys.join(' ') + '\n';
}

function finalizeEmitOutput(out, file) {
  out = appendEmitDebugSections(out);
  out = appendSourcePaletteComment(out);
  out = out.replace(/^(var \w+: )([^\n=]+) = undefined;$/gm, function(_, prefix, type) {
    return prefix + type + ' = std.mem.zeroes(' + type.trim() + ');';
  });
  if (globalThis.__splitOutput == 1) return splitOutput(out, file);
  return out;
}
