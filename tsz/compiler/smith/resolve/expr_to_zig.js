// resolve/expr_to_zig.js — Three overlapping JS expr → Zig expr transpilers
// Extracted as-is from soup.js, mod.js, emit_split.js. NOT unified.

// ── From soup.js:974 ─────────────────────────────────────────────────────────

function soupExprToZig(expr, warns, inPressable) {
  expr = expr.trim();

  // Simple state getter: {count}
  if (/^\w+$/.test(expr)) {
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var slot = ctx.stateSlots[si];
      if (slot.getter === expr) {
        var bufId = ctx.dynCount++;
        var fmt, fmtArgs, bufSize;
        if (slot.type === 'string') {
          fmt = '{s}'; fmtArgs = 'state.getSlotString(' + si + ')'; bufSize = 128;
        } else if (slot.type === 'boolean') {
          fmt = '{s}'; fmtArgs = 'if (state.getSlotBool(' + si + ')) @as([]const u8, "true") else @as([]const u8, "false")'; bufSize = 8;
        } else if (slot.type === 'float') {
          fmt = '{d:.2}'; fmtArgs = 'state.getSlotFloat(' + si + ')'; bufSize = 64;
        } else {
          fmt = '{d}'; fmtArgs = '@as(i64, state.getSlot(' + si + '))'; bufSize = 64;
        }
        ctx.dynTexts.push({
          bufId: bufId, fmtString: fmt, fmtArgs: fmtArgs,
          arrName: '', arrIndex: 0, bufSize: bufSize,
        });
        var tc = inPressable ? _SC.textWhite : _SC.textP;
        return { str: '.{ .text = "", .text_color = Color.rgb(' + tc + ') }', dynBufId: bufId };
      }
    }
  }

  // Object property access: {currentUser.name} → resolve to field slot
  if (/^\w+\.\w+$/.test(expr) && ctx._soupObjFieldSlots && ctx._soupObjFieldSlots[expr] !== undefined) {
    var fieldSlotIdx = ctx._soupObjFieldSlots[expr];
    var fieldSlot = ctx.stateSlots[fieldSlotIdx];
    var bufId = ctx.dynCount++;
    var fmt, fmtArgs, bufSize;
    if (fieldSlot.type === 'string') {
      fmt = '{s}'; fmtArgs = 'state.getSlotString(' + fieldSlotIdx + ')'; bufSize = 128;
    } else if (fieldSlot.type === 'float') {
      fmt = '{d:.2}'; fmtArgs = 'state.getSlotFloat(' + fieldSlotIdx + ')'; bufSize = 64;
    } else {
      fmt = '{d}'; fmtArgs = '@as(i64, state.getSlot(' + fieldSlotIdx + '))'; bufSize = 64;
    }
    ctx.dynTexts.push({
      bufId: bufId, fmtString: fmt, fmtArgs: fmtArgs,
      arrName: '', arrIndex: 0, bufSize: bufSize,
    });
    var tc = inPressable ? _SC.textWhite : _SC.textP;
    return { str: '.{ .text = "", .text_color = Color.rgb(' + tc + ') }', dynBufId: bufId };
  }

  // Template literal: {`text ${expr}`}
  if (expr.charAt(0) === '`') {
    warns.push('[W] template literal dropped: ' + expr.substring(0, 50));
    return { str: '', dynBufId: -1 };
  }

  // Conditional render: {condition && (<JSX/>)} — MUST check before .map()
  // because the whole expr can contain .map() nested inside the JSX body.
  if (expr.indexOf('&&') >= 0) {
    var andIdx = soupFindTopLevelAnd(expr);
    if (andIdx >= 0) {
      var jsxPart = expr.slice(andIdx + 2).trim();
      // Strip wrapping parens: (\n<div>...</div>\n) → <div>...</div>
      if (jsxPart.charAt(0) === '(') {
        var depth = 0, i = 0;
        while (i < jsxPart.length) {
          if (jsxPart.charAt(i) === '(') depth++;
          else if (jsxPart.charAt(i) === ')') { depth--; if (depth === 0) { jsxPart = jsxPart.slice(1, i); break; } }
          i++;
        }
      }
      jsxPart = jsxPart.trim();
      if (jsxPart.charAt(0) === '<') {
        // Parse the JSX and render it
        var tokens = soupTokenize(jsxPart);
        var tree = soupBuildTree(tokens);
        if (tree) {
          soupExtractInlineHandlers(tree, warns);
          warns.push('[W] conditional render (&&) rendered unconditionally');
          var condResult = soupToZig(tree, warns, inPressable);
          condResult.isConditional = true;
          condResult.condExpr = expr.slice(0, andIdx).trim();
          return condResult;
        }
      }
    }
    // No top-level && found — the && is nested (e.g. inside .filter()).
    // Fall through to other checks (ternary, .map(), etc.)
  }

  // Ternary: {cond ? <A/> : <B/>} — render the true branch
  if (expr.indexOf('?') >= 0) {
    var qIdx = soupFindTopLevelChar(expr, '?');
    if (qIdx >= 0) {
      var afterQ = expr.slice(qIdx + 1).trim();
      // Check if true branch starts with JSX or a string
      if (afterQ.charAt(0) === '<' || afterQ.charAt(0) === '(') {
        var trueBranch = afterQ;
        if (trueBranch.charAt(0) === '(') {
          var depth = 0, i = 0;
          while (i < trueBranch.length) {
            if (trueBranch.charAt(i) === '(') depth++;
            else if (trueBranch.charAt(i) === ')') { depth--; if (depth === 0) { trueBranch = trueBranch.slice(1, i); break; } }
            i++;
          }
        }
        trueBranch = trueBranch.trim();
        if (trueBranch.charAt(0) === '<') {
          var tokens = soupTokenize(trueBranch);
          var tree = soupBuildTree(tokens);
          if (tree) {
            soupExtractInlineHandlers(tree, warns);
            warns.push('[W] ternary rendered true branch only');
            return soupToZig(tree, warns, inPressable);
          }
        }
      }
      // String ternary: {cond ? "text" : "other"} → static text
      var strMatch = afterQ.match(/^["']([^"']*)["']/);
      if (strMatch) {
        return soupPushJsDynText(expr, inPressable);
      }
    }
    // No top-level ? found — the ? is nested (e.g. inside className={}).
    // Fall through to other checks (.map(), etc.)
  }

  // .map() — checked BEFORE generic boolean operators because map bodies
  // contain JSX with < > and filter predicates contain === || && etc.
  // The && conditional and ternary checks above already handle top-level
  // wrappers like {condition && <JSX/>} and {cond ? <A/> : <B/>}.
  if (expr.indexOf('.map(') >= 0) {
    return soupHandleMap(expr, warns, inPressable);
  }

  if (expr.indexOf('&&') >= 0 || expr.indexOf('||') >= 0 ||
      expr.indexOf('===') >= 0 || expr.indexOf('!==') >= 0 ||
      expr.indexOf('==') >= 0 || expr.indexOf('!=') >= 0 ||
      expr.indexOf('>') >= 0 || expr.indexOf('<') >= 0) {
    return soupPushJsDynText(expr, inPressable);
  }

  warns.push('[W] expr dropped: {' + expr.substring(0, 50) + '}');
  return { str: '', dynBufId: -1 };
}

// ── From mod.js:701 ──────────────────────────────────────────────────────────

function modTranspileExpr(expr, ctx) {
  let e = expr.trim();
  // exact → ==
  e = e.replace(/\bexact\b/g, '==');
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
  if (e.indexOf(" + ") !== -1 && e.indexOf("'") !== -1) {
    var bufPrint = transpileStringConcat(e);
    if (bufPrint) return bufPrint;
  }
  return rewriteKnownFunctionCalls(e, ctx);
}

// ── From emit_split.js:105 ───────────────────────────────────────────────────

// Transpile a JS expression to Zig, replacing e.method() calls with ctx_e equivalents
function transpileExpr(expr, p, arrayVars) {
  if (!expr) return '0';
  let e = expr.trim();
  // e.time → ctx_e.time
  e = e.replace(new RegExp(`\\b${p}\\.time\\b`, 'g'), 'ctx_e.time');
  // e.width / e.height → ctx_e.width / ctx_e.height (as f32)
  e = e.replace(new RegExp(`\\b${p}\\.width\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.width))');
  e = e.replace(new RegExp(`\\b${p}\\.height\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.height))');
  // e.hsv(h, s, v) → effect_ctx.EffectContext.hsvToRgb(h, s, v) — returns [3]f32
  e = e.replace(new RegExp(`\\b${p}\\.hsv\\(`, 'g'), 'effect_ctx.EffectContext.hsvToRgb(');
  // e.hsl(h, s, l) → effect_ctx.EffectContext.hslToRgb(h, s, l) — returns [3]f32
  e = e.replace(new RegExp(`\\b${p}\\.hsl\\(`, 'g'), 'effect_ctx.EffectContext.hslToRgb(');
  // e.dt → ctx_e.dt, e.frame → ctx_e.frame_count
  e = e.replace(new RegExp(`\\b${p}\\.dt\\b`, 'g'), 'ctx_e.dt');
  e = e.replace(new RegExp(`\\b${p}\\.frame\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.frame))');
  // Mouse
  e = e.replace(new RegExp(`\\b${p}\\.mouseX\\b`, 'g'), 'ctx_e.mouse_x');
  e = e.replace(new RegExp(`\\b${p}\\.mouseY\\b`, 'g'), 'ctx_e.mouse_y');
  e = e.replace(new RegExp(`\\b${p}\\.mouseInside\\b`, 'g'), '(if (ctx_e.mouse_inside) @as(f32, 1.0) else @as(f32, 0.0))');
  // e.sin(x) → @sin(x), e.sqrt(x) → @sqrt(x) — Zig builtins, not methods
  e = e.replace(new RegExp(`\\b${p}\\.(sin|cos|sqrt|abs|floor|ceil)\\(`, 'g'), '@$1(');
  e = e.replace(new RegExp(`\\b${p}\\.pow\\(`, 'g'), 'std.math.pow(f32, ');
  e = e.replace(new RegExp(`\\b${p}\\.fmod\\(`, 'g'), '@mod(');
  e = e.replace(new RegExp(`\\b${p}\\.mod\\(`, 'g'), '@mod(');
  e = e.replace(new RegExp(`\\b${p}\\.fract\\(`, 'g'), '@mod(1.0, ');  // fract(x) ≈ @mod(x, 1.0) — approximate
  e = e.replace(new RegExp(`\\b${p}\\.atan2\\(`, 'g'), 'std.math.atan2(');
  e = e.replace(new RegExp(`\\b${p}\\.atan\\(`, 'g'), 'std.math.atan(');
  e = e.replace(new RegExp(`\\b${p}\\.tan\\(`, 'g'), '@tan(');
  e = e.replace(new RegExp(`\\b${p}\\.exp\\(`, 'g'), '@exp(');
  e = e.replace(new RegExp(`\\b${p}\\.log\\(`, 'g'), '@log(');
  // Interpolation — ctx_e method calls
  e = e.replace(new RegExp(`\\b${p}\\.mix\\(`, 'g'), 'ctx_e.lerp(');
  e = e.replace(new RegExp(`\\b${p}\\.lerp\\(`, 'g'), 'ctx_e.lerp(');
  e = e.replace(new RegExp(`\\b${p}\\.clamp\\(`, 'g'), 'ctx_e.clampVal(');
  e = e.replace(new RegExp(`\\b${p}\\.smoothstep\\(`, 'g'), 'ctx_e.smoothstep(');
  e = e.replace(new RegExp(`\\b${p}\\.remap\\(`, 'g'), 'ctx_e.remap(');
  e = e.replace(new RegExp(`\\b${p}\\.dist\\(`, 'g'), 'ctx_e.dist(');
  e = e.replace(new RegExp(`\\b${p}\\.min\\(`, 'g'), '@min(');
  e = e.replace(new RegExp(`\\b${p}\\.max\\(`, 'g'), '@max(');
  e = e.replace(new RegExp(`\\b${p}\\.step\\(`, 'g'), 'ctx_e.step(');
  // Noise — ctx_e method calls
  e = e.replace(new RegExp(`\\b${p}\\.noise\\(`, 'g'), 'ctx_e.noise(');
  e = e.replace(new RegExp(`\\b${p}\\.noise3\\(`, 'g'), 'ctx_e.noise3(');
  e = e.replace(new RegExp(`\\b${p}\\.fbm\\(`, 'g'), 'ctx_e.fbm(');
  e = e.replace(new RegExp(`\\b${p}\\.voronoi\\(`, 'g'), 'ctx_e.voronoi(');
  // Math.PI
  e = e.replace(/\bMath\.PI\b/g, '3.14159265');
  // Convert .x/.y/.z to [0]/[1]/[2] for array-typed vars (voronoi, hsv, hsl results)
  if (arrayVars && arrayVars.size > 0) {
    for (const av of arrayVars) {
      e = e.replace(new RegExp(`\\b${av}\\.x\\b`, 'g'), `${av}[0]`);
      e = e.replace(new RegExp(`\\b${av}\\.y\\b`, 'g'), `${av}[1]`);
      e = e.replace(new RegExp(`\\b${av}\\.z\\b`, 'g'), `${av}[2]`);
    }
  }
  return e;
}
