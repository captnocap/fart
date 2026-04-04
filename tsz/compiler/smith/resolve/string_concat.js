// resolve/string_concat.js — String concatenation → std.fmt.bufPrint
// Extracted as-is from mod.js:782

function transpileStringConcat(expr) {
  // Split on + but respect quoted strings
  var parts = [];
  var cur = '';
  var inStr = false;
  for (var c = 0; c < expr.length; c++) {
    if (expr[c] === "'" && !inStr) { inStr = true; cur += expr[c]; continue; }
    if (expr[c] === "'" && inStr) { inStr = false; cur += expr[c]; continue; }
    if (!inStr && expr[c] === '+' && (c === 0 || expr[c-1] === ' ') && (c + 1 >= expr.length || expr[c+1] === ' ')) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += expr[c];
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length < 2) return null;
  // Build format string and args
  var fmt = '';
  var args = [];
  for (var p = 0; p < parts.length; p++) {
    var part = parts[p];
    if (part.startsWith("'") && part.endsWith("'")) {
      // String literal — inline into format
      fmt += part.slice(1, -1);
    } else {
      // Variable — determine format specifier
      // If it looks numeric (or is a .len or bare int var), use {d}
      if (part.match(/\.len$/) || part.match(/^-?\d/) || part === 'code' || part.match(/count|size|len|num|idx|id$/i)) {
        fmt += '{d}';
      } else {
        fmt += '{s}';
      }
      args.push(part);
    }
  }
  var argStr = args.length === 1 ? args[0] : ' ' + args.join(', ') + ' ';
  if (args.length === 1) argStr = args[0];
  else argStr = ' ' + args.join(', ') + ' ';
  return 'std.fmt.bufPrint(&buf, "' + fmt + '", .{' + argStr + '}) catch ""';
}
