// Mod expression transpiler — extracted from mod.js

function modTranspileType(ts) {
  const t = ts.trim();
  // Type? → optional (suffix form used by intent syntax)
  if (t.endsWith('?')) return '?' + modTranspileType(t.slice(0, -1));
  if (t === 'int') return 'i64';
  if (t === 'i32') return 'i32';
  if (t === 'i64') return 'i64';
  if (t === 'u8') return 'u8';
  if (t === 'u16') return 'u16';
  if (t === 'u32') return 'u32';
  if (t === 'u64') return 'u64';
  if (t === 'usize') return 'usize';
  if (t === 'f32') return 'f32';
  if (t === 'f64') return 'f64';
  if (t === 'float') return 'f32';
  if (t === 'number') return 'i64';
  if (t === 'bool' || t === 'boolean') return 'bool';
  if (t === 'string') return '[]const u8';
  if (t === 'void') return 'void';
  if (t.startsWith('fn(') || t.startsWith('fn (')) return modTranspileFnType(t);
  // ?Type → optional
  if (t.startsWith('?')) return '?' + modTranspileType(t.slice(1));
  // !Type → error union
  if (t.startsWith('!')) return '!' + modTranspileType(t.slice(1));
  // TypeName[N] → [N]TypeName (fixed array)
  const arrMatch = t.match(/^(\w+)\[([A-Za-z_]\w*|\d+)\]$/);
  if (arrMatch) return '[' + arrMatch[2] + ']' + modTranspileType(arrMatch[1]);
  // Type[] → slice — []Type
  if (t.endsWith('[]')) return '[]' + modTranspileType(t.slice(0, -2));
  // Pass through (user-defined types, Zig types)
  return t;
}

function modTranspileFnType(ts) {
  const m = ts.trim().match(/^fn\s*\((.*)\)\s*->\s*(.+)$/);
  if (!m) return ts.trim();
  return '*const fn (' + modTranspileParams(m[1].trim()) + ') ' + modTranspileType(m[2].trim());
}

function modTranspileDefault(val, zigType, typeNames) {
  const v = val.trim();
  // Boolean
  if (v === 'true' || v === 'false') return v;
  // Null
  if (v === 'null') return 'null';
  if (v === 'none' && zigType && zigType.startsWith('?')) return 'null';
  // Numeric
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  // String literal
  if (v.startsWith('"') || v.startsWith("'")) return v.replace(/'/g, '"');
  // Enum variant — identifier (any case) that isn't a type name → prefix with .
  if (/^\w+$/.test(v) && typeNames.indexOf(v) === -1) return '.' + v;
  // Struct init
  if (v === '{}') return '.{}';
  return v;
}

function modTranspileForExpr(expr, baseArr, itemVar) {
  // Replace item.field with baseArr[_i].field
  let e = expr.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), baseArr + '[_i].');
  // Replace bare item with baseArr[_i]
  e = e.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), baseArr + '[_i]');
  return modTranspileExpr(e);
}

function stripModOptionalType(type) {
  var t = String(type || '').trim();
  while (t.charAt(0) === '?' || t.charAt(0) === '!') t = t.slice(1).trim();
  while (t.charAt(t.length - 1) === '?') t = t.slice(0, -1).trim();
  return t;
}

function isModArrayLikeType(type) {
  const t = stripModOptionalType(type);
  if (!t) return false;
  if (t === 'string' || t === '[]const u8') return true;
  if (t.endsWith('[]')) return true;
  if (/^\[[^\]]+\]/.test(t)) return true;
  return /^[A-Za-z_]\w*\[([A-Za-z_]\w*|\d+)\]$/.test(t);
}

function lookupEscapedModType(name, table) {
  if (!table) return null;
  if (Object.prototype.hasOwnProperty.call(table, name)) return table[name];
  const keys = Object.keys(table);
  for (let i = 0; i < keys.length; i++) {
    if (modEscapeLocalName(keys[i]) === name) return table[keys[i]];
  }
  return null;
}

function resolveModRootType(name, ctx) {
  return lookupEscapedModType(name, ctx && ctx.localTypes) ||
    lookupEscapedModType(name, ctx && ctx.paramTypes) ||
    lookupEscapedModType(name, _modStateVarTypes) ||
    lookupEscapedModType(name, _modConstVarTypes) ||
    null;
}

function classifyModMemberRef(ref, memberName, ctx) {
  const parts = String(ref || '').split('.');
  if (!parts.length) return null;
  var type = resolveModRootType(parts[0], ctx);
  if (!type) return null;
  for (let i = 1; i < parts.length; i++) {
    type = stripModOptionalType(type);
    if (isModArrayLikeType(type)) return null;
    const fields = _modTypeFieldMap[type];
    if (!fields || !Object.prototype.hasOwnProperty.call(fields, parts[i])) return null;
    type = fields[parts[i]];
  }
  type = stripModOptionalType(type);
  if (isModArrayLikeType(type)) return 'collection';
  const fields = _modTypeFieldMap[type];
  if (fields && Object.prototype.hasOwnProperty.call(fields, memberName)) return 'field';
  return null;
}

function resolveModRefType(expr, ctx) {
  const parts = String(expr || '').split('.');
  if (!parts.length) return null;
  var type = resolveModRootType(parts[0], ctx);
  if (!type) return null;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    type = stripModOptionalType(type);
    if (part === 'length' || part === 'count' || part === 'len') {
      if (isModArrayLikeType(type)) return 'i64';
    }
    if (isModArrayLikeType(type)) return null;
    const fields = _modTypeFieldMap[type];
    if (!fields || !Object.prototype.hasOwnProperty.call(fields, part)) return null;
    type = fields[part];
  }
  return stripModOptionalType(type);
}

function rewriteModMemberRefs(expr, memberName, replacementName, ctx) {
  const re = new RegExp('\\b([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)\\.' + memberName + '\\b', 'g');
  return String(expr || '').replace(re, function(_, ref) {
    return classifyModMemberRef(ref, memberName, ctx) === 'field'
      ? ref + '.' + memberName
      : ref + '.' + replacementName;
  });
}

function rewriteModLengthRefs(expr, ctx) {
  var out = rewriteModMemberRefs(expr, 'length', 'len', ctx);
  out = rewriteModMemberRefs(out, 'count', 'len', ctx);
  return out;
}

function transpileAmbientMathCall(name, args, ctx) {
  const loweredArgs = [];
  for (let i = 0; i < args.length; i++) loweredArgs.push(modTranspileExpr(args[i].trim(), ctx));
  if (name === 'clamp' && loweredArgs.length === 3) return 'std.math.clamp(' + loweredArgs.join(', ') + ')';
  if (name === 'lerp' && loweredArgs.length === 3) return '(' + loweredArgs[0] + ' + ((' + loweredArgs[1] + ') - (' + loweredArgs[0] + ')) * (' + loweredArgs[2] + '))';
  if (name === 'min' && loweredArgs.length === 2) return 'min(' + loweredArgs.join(', ') + ')';
  if (name === 'max' && loweredArgs.length === 2) return 'max(' + loweredArgs.join(', ') + ')';
  if (name === 'abs' && loweredArgs.length === 1) return '@abs(' + loweredArgs[0] + ')';
  if (name === 'floor' && loweredArgs.length === 1) return '@as(i64, @intFromFloat(@floor(' + loweredArgs[0] + ')))';
  if (name === 'ceil' && loweredArgs.length === 1) return '@as(i64, @intFromFloat(@ceil(' + loweredArgs[0] + ')))';
  if (name === 'round' && loweredArgs.length === 1) return '@as(i64, @intFromFloat(@round(' + loweredArgs[0] + ')))';
  return 'math.' + name + '(' + loweredArgs.join(', ') + ')';
}

function rewriteAmbientMathCalls(expr, ctx) {
  var out = '';
  var quote = null;
  for (let i = 0; i < expr.length;) {
    const ch = expr[i];
    if (quote) {
      out += ch;
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (expr.slice(i, i + 5) === 'math.' && (i === 0 || !/[A-Za-z0-9_.]/.test(expr[i - 1]))) {
      let nameEnd = i + 5;
      if (!/[A-Za-z_]/.test(expr[nameEnd] || '')) {
        out += ch;
        i += 1;
        continue;
      }
      while (nameEnd < expr.length && /[A-Za-z0-9_]/.test(expr[nameEnd])) nameEnd += 1;
      if (expr[nameEnd] !== '(') {
        out += expr.slice(i, nameEnd);
        i = nameEnd;
        continue;
      }
      const end = findMatchingParen(expr, nameEnd);
      if (end === -1) {
        out += ch;
        i += 1;
        continue;
      }
      out += transpileAmbientMathCall(expr.slice(i + 5, nameEnd), splitCallArgs(expr.slice(nameEnd + 1, end)), ctx);
      i = end + 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function modTranspileExpr(expr, ctx) {
  let e = normalizeModStringQuotes(expr.trim());
  e = escapeLocalIdentifiers(e, (ctx && ctx.localNames) || []);
  e = e.replace(/\bexact or above\b/g, '>=');
  e = e.replace(/\bexact or below\b/g, '<=');
  e = e.replace(/\bnot exact\b/g, '!=');
  e = e.replace(/\babove\b/g, '>');
  e = e.replace(/\bbelow\b/g, '<');
  e = e.replace(/\bnot\s+/g, '!');
  // exact → ==
  e = e.replace(/\bexact\b/g, '==');
  e = rewriteModLengthRefs(e, ctx);
  e = e.replace(/\bxor\b/g, '^');
  // Prefix known enum variants with . when used as values (after = or ==)
  // Do NOT prefix when used as LHS of comparison (e.g. paused == true where paused is a var)
  if (_modEnumVariants && _modEnumVariants.length > 0) {
    const localNames = (ctx && ctx.localNames) || [];
    for (let v = 0; v < _modEnumVariants.length; v++) {
      var vname = _modEnumVariants[v];
      if (localNames.indexOf(vname) !== -1) continue;
      // Match after = (assignment or comparison RHS), comma, semicolon, open paren
      // Use capture group instead of variable-length lookbehind for QuickJS compat
      e = e.replace(new RegExp('([=,;(] ?)' + vname + '(?=[\\s;,)=]|$)', 'g'), '$1.' + vname);
      // Also match after == with space
      e = e.replace(new RegExp('(== ?)' + vname + '(?=[\\s;,)=]|$)', 'g'), '$1.' + vname);
      // Bare variant as entire expression
      if (e === vname) e = '.' + vname;
    }
  }
  // and / or
  e = e.replace(/\band\b/g, 'and');
  e = e.replace(/\bor\b/g, 'or');
  // !== and === → != and ==
  e = e.replace(/===/g, '==');
  e = e.replace(/!==/g, '!=');
  // || → or, && → and
  e = e.replace(/\s*\|\|\s*/g, ' or ');
  e = e.replace(/\s*&&\s*/g, ' and ');
  // ?? → orelse
  e = e.replace(/\s*\?\?\s*/g, ' orelse ');
  e = e.replace(/\blog\.enabled\(/g, 'log.isEnabled(');
  e = e.replace(/\blog\.(isEnabled|info|warn|err)\((engine|events|layout|state|selection|gpu|geometry|text|ffi|tick|render)\b/g, 'log.$1(.$2');
  e = rewriteAmbientMathCalls(e, ctx);
  e = rewriteNestedParenTernaries(e, ctx);
  e = rewriteDelimitedTernaries(e, ctx);
  const ternaryExpr = rewriteExpressionTernary(e, ctx);
  if (ternaryExpr) e = ternaryExpr;
  // ── Stdlib method mapping ──
  // Pattern: match complex LHS (words, dots, brackets) before method call
  // x.indexOf(str) → std.mem.indexOf(u8, x, str) orelse x.len
  e = e.replace(/([\w\[\]_.]+)\.indexOf\(([^)]+)\)/g, function(_, obj, arg) {
    var a = arg.trim().replace(/'/g, '"');
    return 'std.mem.indexOf(u8, ' + obj + ', ' + a + ') orelse ' + obj + '.len';
  });
  // x.indexOfChar(c) → std.mem.indexOfScalar(u8, x, c) orelse x.len
  e = e.replace(/([\w\[\]_.]+)\.indexOfChar\(([^)]+)\)/g, function(_, obj, arg) {
    return 'std.mem.indexOfScalar(u8, ' + obj + ', ' + arg.trim() + ') orelse ' + obj + '.len';
  });
  // a.eql(b) → std.mem.eql(u8, a, b)
  e = e.replace(/([\w\[\]_.]+)\.eql\(([^)]+)\)/g, function(_, obj, arg) {
    return 'std.mem.eql(u8, ' + obj + ', ' + arg.trim() + ')';
  });
  // parseInt(str) → std.fmt.parseInt(i32, str, 10) catch 0
  e = e.replace(/parseInt\(([^)]+)\)/g, function(_, arg) {
    return 'std.fmt.parseInt(i32, ' + arg.trim() + ', 10) catch 0';
  });
  // ── FFI call prefixing ──
  if (_modFfiSymbols) {
    for (var sym in _modFfiSymbols) {
      var info = _modFfiSymbols[sym];
      if (_modReservedNames && _modReservedNames.indexOf(sym) !== -1) continue;
      e = e.replace(new RegExp('(?<!\\w\\.)\\b' + sym + '\\(', 'g'), info.prefix + '.' + info.fn + '(');
    }
  }
  // ── Posix constant mapping ──
  // AF_INET → posix.AF.INET, SOCK_STREAM → posix.SOCK.STREAM, O_RDONLY → posix.O.RDONLY, etc.
  if (_modFfiSymbols) {
    // Check if any FFI import is from std.posix
    var hasPosix = false;
    for (var s in _modFfiSymbols) { if (_modFfiSymbols[s].prefix === 'posix') hasPosix = true; }
    if (hasPosix) {
      // Map UPPER_CASE constants: PREFIX_REST → posix.PREFIX.REST
      e = e.replace(/\b(AF|SOCK|IPPROTO|O|POLL|MSG|SO|SOL|SHUT|F|FD|SEEK|MAP|PROT|CLOCK|SIG|SA|S_I|EPOLL|IN)_([A-Z0-9_]+)\b/g, function(_, prefix, rest) {
        return 'posix.' + prefix + '.' + rest;
      });
    }
  }
  // ── String concatenation → std.fmt.bufPrint ──
  // Only trigger when expression contains a string literal with +
  if (e.indexOf(' + ') !== -1 && /['"]/.test(e)) {
    var bufPrint = transpileStringConcat(e);
    if (bufPrint) return bufPrint;
  }
  return rewriteKnownFunctionCalls(e, ctx);
}

function normalizeModStringQuotes(text) {
  var out = '';
  var quote = null;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (!quote) {
      if (ch === "'") {
        quote = "'";
        out += '"';
        continue;
      }
      if (ch === '"') quote = '"';
      out += ch;
      continue;
    }
    if (quote === "'") {
      if (ch === "'" && text[i - 1] !== '\\') {
        quote = null;
        out += '"';
        continue;
      }
      out += ch === '"' ? '\\"' : ch;
      continue;
    }
    out += ch;
    if (ch === '"' && text[i - 1] !== '\\') quote = null;
  }
  return out;
}

function transpileStringConcat(expr) {
  // Split on + but respect quoted strings
  var parts = [];
  var cur = '';
  var quote = null;
  for (var c = 0; c < expr.length; c++) {
    if ((expr[c] === "'" || expr[c] === '"') && !quote) { quote = expr[c]; cur += expr[c]; continue; }
    if (quote && expr[c] === quote && expr[c - 1] !== '\\') { quote = null; cur += expr[c]; continue; }
    if (!quote && expr[c] === '+' && (c === 0 || expr[c - 1] === ' ') && (c + 1 >= expr.length || expr[c + 1] === ' ')) {
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
    if ((part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'))) {
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
  return 'blk: { var _fmt_buf: [256]u8 = undefined; break :blk std.fmt.bufPrint(&_fmt_buf, "' +
    fmt.replace(/"/g, '\\"') + '", .{' + argStr + '}) catch ""; }';
}

function isComparison(lhs) {
  const t = lhs.trim();
  return t.endsWith('>') || t.endsWith('<') || t.endsWith('!') || t.endsWith('=');
}
function inferTypeFromValue(val) {
  const v = val.trim();
  if (v === '0' || /^-?\d+$/.test(v)) return 'i32';
  if (/^-?\d+\.\d+$/.test(v)) return 'f32';
  if (v === 'true' || v === 'false') return 'bool';
  if (v.startsWith('"') || v.startsWith("'")) return '[]const u8';
  return null; // can't infer — don't declare as var
}
// Split struct literal fields respecting brace nesting, then transpile each
function transpileStructLiteral(inner) {
  // Split by commas that aren't inside nested { }
  const fields = [];
  let brace = 0; let paren = 0; let bracket = 0; let cur = ''; let quote = null;
  for (let c = 0; c < inner.length; c++) {
    const ch = inner[c];
    if (quote) {
      cur += ch;
      if (ch === quote && inner[c - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '{') brace++;
    if (ch === '}') brace--;
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (ch === '[') bracket++;
    if (ch === ']') bracket--;
    if (ch === ',' && brace === 0 && paren === 0 && bracket === 0) { fields.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) fields.push(cur.trim());
  // Transpile each field: key: value → .key = value
  const zigFields = fields.map(function(f) {
    const kv = f.match(/^(\w+):\s*(.+)$/);
    if (!kv) return f;
    const val = kv[2].trim();
    if (val === '[]') return '';
    // Check if value is a nested struct literal { ... }
    const nestedMatch = val.match(/^\{(.+)\}$/);
    if (nestedMatch) return '.' + kv[1] + ' = ' + transpileStructLiteral(nestedMatch[1]);
    return '.' + kv[1] + ' = ' + modTranspileExpr(val);
  }).filter(Boolean);
  if (zigFields.length === 0) return '.{}';
  return '.{ ' + zigFields.join(', ') + ' }';
}

function modTranspileValue(expr, ctx) {
  const t = expr.trim();
  const structMatch = t.match(/^\{([\s\S]*)\}$/);
  if (structMatch) return transpileStructLiteral(structMatch[1]);
  return modTranspileExpr(t, ctx);
}

function modTranspileForExprV2(expr, baseArr, itemVar, ctx) {
  let e = expr;
  e = e.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), baseArr + '[_i].');
  e = e.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), baseArr + '[_i]');
  return modTranspileExpr(applyOptionalUnwraps(e, (ctx && ctx.narrowedVars) || []), ctx);
}

function rewriteNestedParenTernaries(expr, ctx) {
  let out = '';
  let quote = null;
  for (let i = 0; i < expr.length;) {
    const ch = expr[i];
    if (quote) {
      out += ch;
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch !== '(') {
      out += ch;
      i++;
      continue;
    }
    const end = findMatchingParen(expr, i);
    if (end === -1) {
      out += ch;
      i++;
      continue;
    }
    const inner = rewriteNestedParenTernaries(expr.slice(i + 1, end), ctx);
    const innerTrimmed = inner.trim();
    const ternary = splitCallArgs(inner).length === 1 ? splitTopLevelTernary(innerTrimmed) : null;
    if (ternary) {
      out += '(if (' + modTranspileExpr(ternary.cond, ctx) + ') ' +
        modTranspileExpr(ternary.thenExpr, ctx) + ' else ' +
        modTranspileExpr(ternary.elseExpr, ctx) + ')';
    } else {
      out += '(' + inner + ')';
    }
    i = end + 1;
  }
  return out;
}

function rewriteDelimitedTernaries(expr, ctx) {
  let out = '';
  let quote = null;
  for (let i = 0; i < expr.length;) {
    const ch = expr[i];
    if (quote) {
      out += ch;
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch !== '(') {
      out += ch;
      i++;
      continue;
    }
    const end = findMatchingParen(expr, i);
    if (end === -1) {
      out += ch;
      i++;
      continue;
    }
    const inner = rewriteDelimitedTernaries(expr.slice(i + 1, end), ctx);
    const args = splitCallArgs(inner);
    if (args.length > 1) {
      const rewrittenArgs = args.map(function(arg) {
        const trimmed = arg.trim();
        const ternary = splitTopLevelTernary(trimmed);
        if (!ternary) return trimmed;
        return 'if (' + modTranspileExpr(ternary.cond, ctx) + ') ' +
          modTranspileExpr(ternary.thenExpr, ctx) + ' else ' +
          modTranspileExpr(ternary.elseExpr, ctx);
      });
      out += '(' + rewrittenArgs.join(', ') + ')';
    } else {
      out += '(' + inner + ')';
    }
    i = end + 1;
  }
  return out;
}
