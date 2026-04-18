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
  // Scrub any residual OA_ITEM sentinels (see parse/element/component_brace_values.js:57).
  // Any surviving sentinel in final output is a compiler bug; resolving it is always correct.
  // Handles \x02-prefixed, bare, and quote-wrapped forms — some paths quote the sentinel
  // as a string literal (e.g. template-literal substitution), which must be unwrapped.
  if (out.indexOf('OA_ITEM:') >= 0) {
    // Quoted + field access: '\x02OA_ITEM:0:_i:_item'.name → _item.name
    out = out.replace(/['"]\x02?OA_ITEM:\d+:[^:]+?:(\w+)['"]\s*\.\s*(\w+)/g, function(_, itemParam, field) {
      return itemParam + '.' + field;
    });
    // Quoted bare: '\x02OA_ITEM:0:_i:_item' → _item
    out = out.replace(/['"]\x02?OA_ITEM:\d+:[^:]+?:(\w+)['"]/g, function(_, itemParam) {
      return itemParam;
    });
    // Unquoted + field access
    out = out.replace(/\x02?OA_ITEM:\d+:[^:]+?:(\w+)\s*\.\s*(\w+)/g, function(_, itemParam, field) {
      return itemParam + '.' + field;
    });
    // Unquoted bare
    out = out.replace(/\x02?OA_ITEM:\d+:[^:]+?:(\w+)/g, function(_, itemParam) {
      return itemParam;
    });
  }
  // Within lua_on_press / js_on_press assignments, convert `"str" + X` to
  // `"str" .. X`. The handler value is a Lua concat expression built at
  // Lua-assignment time; `+` is arithmetic in Lua and throws on strings.
  // Scoped to just those keys so JS_LOGIC's `+` operators are untouched.
  out = out.replace(/((?:lua|js)_on_press\s*=\s*)((?:"[^"\\]|\\.)*")/g, function(all, prefix, value) {
    // naive: just look for `"..." +` inside this value string and rewrite to ` .. `
    return prefix + value.replace(/(["'][^"'\n]{0,200}?["'])\s*\+\s*/g, '$1 .. ');
  });
  // Simpler fallback: any `"..." + ident.field` on a line that contains `on_press = "`
  out = out.replace(/^.*on_press\s*=\s*".*$/gm, function(line) {
    return line.replace(/(["'][^"'\n]{0,200}?["'])\s*\+\s*(_[A-Za-z_]\w*(?:\s*\.\s*\w+)?)/g, '$1 .. $2');
  });
  if (globalThis.__splitOutput == 1) return splitOutput(out, file);
  return out;
}
