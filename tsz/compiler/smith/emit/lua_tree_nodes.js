// ── Lua tree: Lua source generation ─────────────────────────
// Builds the Lua source string: state atoms, helpers, state setters,
// FFI, script blocks, OA setters, App() component, __render().

function emitLuaTreeLuaSource(ctx) {
  var lua = [];

  function _looksLikeRawLua(src) {
    if (!src) return false;
    if (/ffi\.cdef\s*\[\[/.test(src)) {
      return true;
    }
    if (/\b(?:const|let|var)\b|===|!==|&&|\|\||=>|console\.|Math\.|\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\bfunction\s+\w+\s*\([^)]*\)\s*\{|\}\s*else(?:\s+if)?\s*\{/.test(src)) {
      return false;
    }
    if (/(?:^|\n)\s*(?:<[/]?(?:if|for|during|else)\b|\w+(?:\s+every\s+[^:]+)?\s*:\s*$|set_[A-Za-z_]\w*\s+is\b|[A-Za-z_][\w.\[\]]*\s+is\s+)/m.test(src)) {
      return false;
    }
    return /(?:^|\n)\s*(?:local\s+\w+|function\s+\w+\s*\(|ffi\.cdef|return\b|if\b.+\bthen\b|elseif\b|for\b.+\bdo\b|while\b.+\bdo\b|end\b|require\s*\(|(?:local\s+)?[A-Za-z_]\w*\s*=\s*\{)/m.test(src);
  }

  function _lowerLscriptHatch(src) {
    var lines = src.split('\n');
    var out = [];
    var stack = [];

    function closeFunctions(indent) {
      while (stack.length > 0) {
        var top = stack[stack.length - 1];
        if (top.kind !== 'function' || indent > top.indent) break;
        out.push(' '.repeat(top.indent) + 'end');
        stack.pop();
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var padMatch = line.match(/^\s*/);
      var pad = padMatch ? padMatch[0] : '';
      var indent = pad.length;
      var trimmed = line.trim();
      if (!trimmed) {
        out.push('');
        continue;
      }

      var m;
      if ((m = trimmed.match(/^<\/(?:if|for|during)>$/))) {
        out.push(pad + 'end');
        if (stack.length > 0) stack.pop();
        continue;
      }
      if ((m = trimmed.match(/^<else if\s+(.+)>$/))) {
        out.push(pad + 'elseif ' + m[1] + ' then');
        continue;
      }
      if (trimmed === '<else>') {
        out.push(pad + 'else');
        continue;
      }
      if ((m = trimmed.match(/^(\w+)(?:\s+every\s+[^:]+)?\s*:\s*$/))) {
        closeFunctions(indent);
        out.push(pad + 'function ' + m[1] + '()');
        stack.push({ kind: 'function', indent: indent });
        continue;
      }
      if ((m = trimmed.match(/^<if\s+(.+)>$/))) {
        out.push(pad + 'if ' + m[1] + ' then');
        stack.push({ kind: 'tag', indent: indent });
        continue;
      }
      if ((m = trimmed.match(/^<during\s+(.+)>$/))) {
        out.push(pad + 'if ' + m[1] + ' then');
        stack.push({ kind: 'tag', indent: indent });
        continue;
      }
      if ((m = trimmed.match(/^<for\s+(.+)\s+as\s+(\w+)\s*,\s*(\w+)>$/))) {
        out.push(pad + 'for ' + m[2] + ', ' + m[3] + ' in pairs(' + m[1] + ') do');
        stack.push({ kind: 'tag', indent: indent });
        continue;
      }
      if ((m = trimmed.match(/^<for\s+(.+)\s+as\s+(\w+)>$/))) {
        out.push(pad + 'for _, ' + m[2] + ' in ipairs(' + m[1] + ') do');
        stack.push({ kind: 'tag', indent: indent });
        continue;
      }

      var lowered = trimmed.replace(/^((?:set_[A-Za-z_]\w*))\s+is\s+(.+)$/, '$1($2)');
      if (lowered === trimmed) {
        lowered = trimmed.replace(/^([A-Za-z_][\w.\[\]]*)\s+is\s+(.+)$/, '$1 = $2');
      }
      out.push(pad + lowered);
    }

    while (stack.length > 0) {
      var top = stack.pop();
      out.push(' '.repeat(top.indent) + 'end');
    }

    return out.join('\n');
  }

  function _compileLscript(src) {
    var cleaned = (src || '').replace(/^<\/?lscript>$/gm, '').trim();
    if (!cleaned) return '';
    if (_looksLikeRawLua(cleaned)) return cleaned;
    return luaTransform(_lowerLscriptHatch(cleaned));
  }

  // State atom pool
  lua.push('local _state = {}');
  lua.push('function _getState(k) return _state[k] end');
  lua.push('function _setState(k, v) _state[k] = v; __markDirty() end');
  lua.push('');

  // Map loop helper — returns a marker table that __flattenChildren expands
  lua.push('function __mapLoop(arr, fn)');
  lua.push('  if not arr then return nil end');
  lua.push('  local r = {}');
  lua.push('  for i, item in ipairs(arr) do');
  lua.push('    r[#r + 1] = fn(item, i)');
  lua.push('  end');
  lua.push('  r.__isMapResult = true');
  lua.push('  return r');
  lua.push('end');
  lua.push('');

  // Flatten children: expand __mapLoop results inline
  lua.push('function __flattenChildren(children)');
  lua.push('  if not children then return {} end');
  lua.push('  local flat = {}');
  lua.push('  for _, child in ipairs(children) do');
  lua.push('    if type(child) == "table" and child.__isMapResult then');
  lua.push('      for _, mc in ipairs(child) do flat[#flat + 1] = mc end');
  lua.push('    elseif child ~= nil then');
  lua.push('      flat[#flat + 1] = child');
  lua.push('    end');
  lua.push('  end');
  lua.push('  return flat');
  lua.push('end');
  lua.push('');

  // State slot setters/getters (compatibility with existing useState pattern)
  if (ctx.stateSlots && ctx.stateSlots.length > 0) {
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var slot = ctx.stateSlots[si];
      var getter = slot.getter;
      var setter = slot.setter;
      var init = slot.initial !== undefined ? slot.initial : 0;
      // Initialize
      lua.push('_state["' + getter + '"] = ' + _luaLiteral(init));
      // Getter as global variable (read from state pool)
      lua.push(getter + ' = _state["' + getter + '"]');
      // Setter function — Lua is SSoT, sync to QJS so js_on_press sees it
      var _syncToJS = (ctx.scriptBlock || globalThis.__scriptContent) ? ' __syncToJS("' + getter + '", v);' : '';
      lua.push('function ' + setter + '(v) _state["' + getter + '"] = v; ' + getter + ' = v;' + _syncToJS + ' __markDirty() end');
    }
    lua.push('');
  }

  // FFI declarations — LuaJIT ffi.cdef + wrappers for each declare function
  if (ctx._ffiDecls && ctx._ffiDecls.length > 0) {
    lua.push('-- FFI-declared functions (via declare function / @ffi)');
    lua.push('local _ffi = require("ffi")');
    var _cdefs = [];
    for (var fdi = 0; fdi < ctx._ffiDecls.length; fdi++) {
      var _fd = ctx._ffiDecls[fdi];
      var _retC = _tsToCType(_fd.returnType);
      var _paramsC = _fd.params.length > 0
        ? _fd.params.map(function(p) { return _tsToCType(p.type); }).join(', ')
        : 'void';
      _cdefs.push('  ' + _retC + ' ' + _fd.name + '(' + _paramsC + ');');
    }
    lua.push('_ffi.cdef[[');
    for (var ci = 0; ci < _cdefs.length; ci++) lua.push(_cdefs[ci]);
    lua.push(']]');
    for (var fwi = 0; fwi < ctx._ffiDecls.length; fwi++) {
      var _fw = ctx._ffiDecls[fwi];
      var _pnames = _fw.params.map(function(p) { return p.name; }).join(', ');
      var _call = '_ffi.C.' + _fw.name + '(' + _pnames + ')';
      if (_fw.returnType === 'void') {
        lua.push('function ' + _fw.name + '(' + _pnames + ') ' + _call + ' end');
      } else if (_fw.returnType === 'string') {
        lua.push('function ' + _fw.name + '(' + _pnames + ') return _ffi.string(' + _call + ') end');
      } else {
        lua.push('function ' + _fw.name + '(' + _pnames + ') return tonumber(' + _call + ') end');
      }
    }
    lua.push('');
  }

  // Script block routed to Lua (when @ffi / declare function present)
  if (ctx._scriptBlockIsLua) {
    var _luaScript = ctx.scriptBlock || globalThis.__scriptContent || '';
    if (globalThis.__scriptContent && ctx.scriptBlock) {
      _luaScript = ctx.scriptBlock + '\n\n' + globalThis.__scriptContent;
    }
    if (_luaScript) {
      // Strip declare statements — they're now wrappers above
      _luaScript = _luaScript.replace(/^declare\s+.*$/gm, '');
      _luaScript = _luaScript.replace(/^<\/?script>$/gm, '');
      _luaScript = _luaScript.trim();
      if (_luaScript) {
        lua.push('-- Script block (compiled to Lua via FFI routing)');
        var _luaLines = luaTransform(_luaScript).split('\n');
        for (var li = 0; li < _luaLines.length; li++) lua.push(_luaLines[li]);
        lua.push('');
      }
    }
  }

  // Explicit <lscript> blocks — collected separately from <script>.
  if (ctx.luaBlock) {
    var _compiledLscript = _compileLscript(ctx.luaBlock);
    if (_compiledLscript) {
      lua.push('-- <lscript> block');
      var _lscriptLines = _compiledLscript.split('\n');
      for (var lsi = 0; lsi < _lscriptLines.length; lsi++) lua.push(_lscriptLines[lsi]);
      lua.push('');
    }
  }

  // OA setters (arrays)
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      var oa = ctx.objectArrays[oi];
      lua.push(oa.getter + ' = {}');
      if (oa.setter) {
        lua.push('function ' + oa.setter + '(v) ' + oa.getter + ' = v; __markDirty() end');
      }
    }
    lua.push('');
  }

  // OA loaders: normalize raw JS objects from __luaMapDataN to Smith's flat field schema.
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var _oaLoaderIdx = 0;
    for (var _oli = 0; _oli < ctx.objectArrays.length; _oli++) {
      var _oaLoad = ctx.objectArrays[_oli];
      if (_oaLoad.isConst || _oaLoad.isNested) continue;
      lua.push('function __loadLuaMapData' + _oaLoaderIdx + '(src)');
      if (_oaLoad.isEmpty || _oaLoad.isPrimitiveArray || !_oaLoad.fields || _oaLoad.fields.length === 0) {
        lua.push('  return src or {}');
      } else {
        lua.push('  if not src then return {} end');
        lua.push('  local out = {}');
        lua.push('  for _ri, _raw in ipairs(src) do');
        lua.push('    local _row = {}');
        for (var _fi = 0; _fi < _oaLoad.fields.length; _fi++) {
          var _field = _oaLoad.fields[_fi];
          if (_field.type === 'nested_array') {
            lua.push('    _row["' + _field.name + '"] = _raw["' + _field.name + '"]');
            continue;
          }
          var _path = (_field.jsPath && _field.jsPath.length > 0) ? _field.jsPath : [ _field.name ];
          lua.push('    local _v' + _fi + ' = _raw');
          for (var _pi = 0; _pi < _path.length; _pi++) {
            lua.push('    if _v' + _fi + ' ~= nil then _v' + _fi + ' = _v' + _fi + '["' + _path[_pi] + '"] end');
          }
          lua.push('    _row["' + _field.name + '"] = _v' + _fi);
        }
        lua.push('    out[_ri] = _row');
        lua.push('  end');
        lua.push('  return out');
      }
      lua.push('end');
      lua.push('');
      _oaLoaderIdx++;
    }
  }

  // Component functions — emit from parsed tree
  if (ctx._luaRootNode) {
    lua.push('function App()');
    lua.push('  return ' + _nodeToLua(ctx._luaRootNode, null, null, '  '));
    lua.push('end');
  } else {
    lua.push('function App()');
    lua.push('  return { text = "App (no luaNode)" }');
    lua.push('end');
  }
  lua.push('');

  // Render function — called on init and on every state change
  lua.push('function __render()');
  lua.push('  __clearLuaNodes()');
  // Sync OA data from __luaMapDataN globals (set by evalLuaMapData)
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var _oaSyncIdx = 0;
    for (var _oasi = 0; _oasi < ctx.objectArrays.length; _oasi++) {
      var _oaSync = ctx.objectArrays[_oasi];
      if (_oaSync.isConst || _oaSync.isNested) continue;
      lua.push('  if __luaMapData' + _oaSyncIdx + ' then ' + _oaSync.getter + ' = __loadLuaMapData' + _oaSyncIdx + '(__luaMapData' + _oaSyncIdx + ') end');
      _oaSyncIdx++;
    }
  }
  lua.push('  local tree = App()');
  lua.push('  if __mw0 then __declareChildren(__mw0, { tree }) end');
  lua.push('end');
  lua.push('');

  // Final sanitization gate — catch any JS operators that emit let through.
  // This is the LAST stop before LUA_LOGIC becomes a string literal.
  // Protect __eval("...") and js_on_press = "..." strings first.
  var result = lua.join('\n');
  function _rewriteLuaSafeEvalAtGate(entry) {
    if (!entry || entry.indexOf('__eval("') !== 0) return entry;
    var m = entry.match(/^__eval\("((?:[^"\\]|\\.)*)"\)$/);
    if (!m) return entry;
    var decoded = m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    function _stripQuotedStrings(str) {
      return str
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    }
    function _rewriteInlineIfExpr(str) {
      var out = str;
      for (var iter = 0; iter < 8; iter++) {
        var mIf = out.match(/\(if\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*([^()?:]+?)\s*else\s*([^()?:]+?)\)/);
        if (!mIf) break;
        out = out.replace(mIf[0], '((' + mIf[1].trim() + ') and ' + mIf[2].trim() + ' or ' + mIf[3].trim() + ')');
      }
      return out;
    }
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)_length\b/g, '#($1)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)\.length\b/g, '#($1)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)_indexOf\(([^)]+)\)\s*>=\s*0\b/g, '(string.find($1, $2, 1, true) ~= nil)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)_indexOf\(([^)]+)\)\s*<\s*0\b/g, '(string.find($1, $2, 1, true) == nil)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)_indexOf\(([^)]+)\)\s*==\s*0\b/g, '(string.find($1, $2, 1, true) == 1)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)\.indexOf\(([^)]+)\)\s*>=\s*0\b/g, '(string.find($1, $2, 1, true) ~= nil)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)\.indexOf\(([^)]+)\)\s*<\s*0\b/g, '(string.find($1, $2, 1, true) == nil)');
    decoded = decoded.replace(/\b((?:_(?:n)?item|[A-Za-z_]\w*)(?:\.[A-Za-z_]\w+)*)\.indexOf\(([^)]+)\)\s*==\s*0\b/g, '(string.find($1, $2, 1, true) == 1)');
    decoded = decoded.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
    decoded = decoded.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
    decoded = _rewriteInlineIfExpr(decoded);
    var scrubbed = _stripQuotedStrings(decoded);
    if (scrubbed.indexOf('&&') >= 0) decoded = decoded.replace(/&&/g, ' and ');
    if (scrubbed.indexOf('||') >= 0) decoded = decoded.replace(/\|\|/g, ' or ');
    if (scrubbed.indexOf('!==') >= 0) decoded = decoded.replace(/!==/g, '~=');
    if (scrubbed.indexOf('===') >= 0) decoded = decoded.replace(/===/g, '==');
    scrubbed = _stripQuotedStrings(decoded);
    if (scrubbed.indexOf('&&') >= 0 || scrubbed.indexOf('||') >= 0 ||
        scrubbed.indexOf('===') >= 0 || scrubbed.indexOf('!==') >= 0 ||
        /\?[^)]*:/.test(scrubbed) ||
        scrubbed.indexOf('_indexOf(') >= 0 || scrubbed.indexOf('.indexOf(') >= 0 ||
        scrubbed.indexOf('_length') >= 0 || scrubbed.indexOf('.length') >= 0 ||
        scrubbed.indexOf('.charAt(') >= 0 || scrubbed.indexOf('||{}') >= 0) {
      return entry;
    }
    return decoded;
  }
  var protected = [];
  result = result.replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(m) {
    protected.push(_rewriteLuaSafeEvalAtGate(m)); return '__JSPROTECT_' + (protected.length - 1) + '__';
  });
  result = result.replace(/js_on_press = "[^"]*"/g, function(m) {
    protected.push(m); return '__JSPROTECT_' + (protected.length - 1) + '__';
  });
  // Convert remaining JS operators to Lua
  result = result.replace(/!==/g, '~=');
  result = result.replace(/===/g, '==');
  result = result.replace(/!=/g, '~=');
  result = result.replace(/\|\|/g, ' or ');
  result = result.replace(/&&/g, ' and ');
  // Fix broken prop inlining: tostring(word "+varName) or tostring(word "text) → tostring(varName)
  result = result.replace(/tostring\(\w+ "[\+"][^)]*\)/g, function(m) {
    var ids = m.match(/[A-Za-z_]\w*/g);
    if (ids && ids.length > 1) return 'tostring(' + ids[ids.length - 1] + ')';
    return '"?"';
  });
  // Catch Zig enum literals the sanitizer missed (e.g. `or .start }`)
  result = result.replace(/([\s(,=])\.(center|row|column|row_reverse|column_reverse|flex_start|flex_end|space_between|space_around|space_evenly|stretch|baseline|wrap|wrap_reverse|nowrap|no_wrap|hidden|visible|scroll|auto|absolute|relative|none|flex|left|right|justify|vertical|horizontal|start|end)(?=[\s),}])/g, '$1"$2"');
  // Restore protected JS strings
  for (var _pi = 0; _pi < protected.length; _pi++) {
    result = result.replace('__JSPROTECT_' + _pi + '__', protected[_pi]);
  }
  return result;
}
