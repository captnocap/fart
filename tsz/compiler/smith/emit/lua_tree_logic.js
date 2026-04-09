// ── Lua tree: JS_LOGIC generation ───────────────────────────
// Builds the JS_LOGIC string: state bindings, script block cleaning,
// init(state) auto-call.

function emitLuaTreeJsLogic(ctx) {
  // Build JS state bindings so script functions can read/write state
  var jsStateBindings = '';
  // Helper: escape a JS string for safe embedding in a Lua eval single-quoted string
  jsStateBindings += 'function __luaEscStr(s) { var r = "", i, c; for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c === 92) r += "\\\\"; else if (c === 39) r += "\\\\\'"; else if (c === 10) r += "\\\\n"; else if (c === 13) r += ""; else r += s.charAt(i); } return r; }\n';
  jsStateBindings += 'var __batching = false;\n';
  jsStateBindings += 'var __pendingState = [];\n';
  jsStateBindings += 'function __beginJsEvent() { __batching = true; __pendingState = []; }\n';
  jsStateBindings += 'function __endJsEvent() { if (!__batching) return; __batching = false; var q = __pendingState; __pendingState = []; for (var i = 0; i < q.length; i++) q[i](); }\n';
  if (ctx.stateSlots && ctx.stateSlots.length > 0) {
    for (var jsi = 0; jsi < ctx.stateSlots.length; jsi++) {
      var js = ctx.stateSlots[jsi];
      if (js.getter.indexOf('__') === 0) continue; // skip internal slots
      var jsInit = js.initial !== undefined ? JSON.stringify(js.initial) : '0';
      jsStateBindings += 'var ' + js.getter + ' = ' + jsInit + ';\n';
      // JS setter updates local var then calls Lua setter (Lua owns state).
      var _luaSetCall = js.type === 'string'
        ? '__luaEval("' + js.setter + '(\\\'" + __luaEscStr(v) + "\\\')")'
        : '__luaEval("' + js.setter + '(" + v + ")")';
      jsStateBindings += 'function ' + js.setter + '(v) { if (__batching) { __pendingState.push(function(){ ' + js.getter + ' = v; if (__luaReady) { ' + _luaSetCall + '; } else { __markDirty(); } }); return; } ' + js.getter + ' = v; if (__luaReady) { ' + _luaSetCall + '; } else { __markDirty(); } }\n';
    }
  }
  // OA getters in JS — reconstruct initial data from token range
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var _tc = globalThis.__cursor;
    for (var joi = 0; joi < ctx.objectArrays.length; joi++) {
      var joa = ctx.objectArrays[joi];
      var _jsInit = '[]';
      if (!joa.isNested && _tc && joa.initDataStartPos !== undefined && joa.initDataEndPos !== undefined) {
        var _parts = [];
        for (var _ti = joa.initDataStartPos; _ti < joa.initDataEndPos; _ti++) {
          _parts.push(_tc.textAt(_ti));
        }
        var _raw = _parts.join(' ').trim();
        while (_raw.startsWith('(')) _raw = _raw.slice(1).trim();
        while (_raw.endsWith(')')) _raw = _raw.slice(0, -1).trim();
        while (_raw.endsWith(';')) _raw = _raw.slice(0, -1).trim();
        if (_raw.length > 2) _jsInit = _raw;
      }
      jsStateBindings += 'var ' + joa.getter + ' = ' + _jsInit + ';\n';
      if (joa.setter) {
        jsStateBindings += 'function ' + joa.setter + '(v) { ' + joa.getter + ' = v; __markDirty(); }\n';
      }
    }
  }

  var jsContent = 'var __luaReady = false;\n' + jsStateBindings;
  // When FFI decls are present the script block is routed to LUA_LOGIC instead
  if (!ctx._scriptBlockIsLua) {
    if (ctx.scriptBlock) {
      var _jsBlock = ctx.scriptBlock;
      _jsBlock = _jsBlock.replace(/^export\s+/gm, '');
      _jsBlock = _jsBlock.replace(/^declare\s+.*$/gm, '');
      _jsBlock = _jsBlock.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {');
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3');
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*(=)/g, '$1 $3');
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*;/g, '$1;');
      jsContent += _jsBlock;
    }
    if (globalThis.__scriptContent) {
      var _scriptCleaned = globalThis.__scriptContent;
      _scriptCleaned = _scriptCleaned.replace(/^<\/?script>$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/^export\s+/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/^declare\s+.*$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*(=)/g, '$1 $3');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*;/g, '$1;');
      jsContent += (jsContent ? '\n' : '') + _scriptCleaned;
    }
    // Auto-call init(state) if script defines it
    var _scriptSrc = globalThis.__scriptContent || ctx.scriptBlock || '';
    if (/function\s+init\s*\(\s*\w+\s*\)/.test(_scriptSrc)) {
      var _initProps = [];
      if (ctx.objectArrays) {
        for (var _ip = 0; _ip < ctx.objectArrays.length; _ip++) {
          var _oa = ctx.objectArrays[_ip];
          if (_oa.setter) _initProps.push('Object.defineProperty(__is,"' + _oa.getter + '",{set:function(v){' + _oa.setter + '(v)},configurable:true});');
        }
      }
      if (ctx.stateSlots) {
        for (var _is2 = 0; _is2 < ctx.stateSlots.length; _is2++) {
          var _ss = ctx.stateSlots[_is2];
          if (_ss.getter.indexOf('__') === 0) continue;
          _initProps.push('Object.defineProperty(__is,"' + _ss.getter + '",{set:function(v){' + _ss.setter + '(v)},configurable:true});');
        }
      }
      if (_initProps.length > 0) {
        jsContent += '\nvar __is={};' + _initProps.join('') + 'init(__is);\n';
      }
    }
  }

  return jsContent;
}
