// ── Emit Atom 041: App exports ──────────────────────────────────
// Index: 41
// Group: entry
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js
//
// Trigger: every app emit.
// Output target: app_get_* exports and state ABI exports.

function _a041_applies(ctx, meta) {
  void ctx; void meta;
  return true;
}

function _a041_emit(ctx, meta) {
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
  var out = '';
  out += 'export fn app_get_init() *const fn () void {\n';
  out += '    const _init = struct {\n';
  out += '        fn init() void {\n';
  for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
    var oa = ctx.objectArrays[oi];
    if (oa.isConst || oa.isNested) continue;
    out += '            luajit_runtime.registerHostFn("__setObjArr' + oa.oaIdx + '", @ptrCast(&_oa' + oa.oaIdx + '_unpack), 1);\n';
  }
  if (hasLuaMaps) {
    for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
      if (ctx._luaMapRebuilders[lmi].isNested) continue;
      var wrapperRef = '__lmw' + lmi;
      out += '            // Lua map ' + lmi + ' wrapper registration\n';
      for (var ai = 0; ai < ctx.arrayDecls.length; ai++) {
        var decl = ctx.arrayDecls[ai];
        var wrapperPattern = '"' + wrapperRef + '"';
        if (decl.indexOf(wrapperPattern) < 0) continue;
        var arrName = decl.match(/^(?:pub )?var (\w+)/);
        if (!arrName) continue;
        var beforeWrapper = decl.substring(0, decl.indexOf(wrapperPattern));
        var elemIdx = 0;
        var commaCount = (beforeWrapper.match(/\.{/g) || []).length - 1;
        if (commaCount >= 0) elemIdx = commaCount;
        out += '            luajit_runtime.setMapWrapper(' + lmi + ', @ptrCast(&' + arrName[1] + '[' + elemIdx + ']));\n';
        break;
      }
    }
    for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
      if (ctx._luaMapRebuilders[ldi].isNested) continue;
      var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += '            qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
    }
    out += '            luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
  }
  if (meta.hasDynText) out += '            _updateDynamicText();\n';
  if (meta.hasConds) out += '            _updateConditionals();\n';
  if (meta.hasDynStyles) out += '            _updateDynamicStyles();\n';
  out += '        }\n';
  out += '    };\n';
  out += '    return &_init.init;\n';
  out += '}\n';
  out += 'export fn app_get_tick() *const fn () void {\n';
  out += '    const _tick = struct {\n';
  out += '        fn tick() void {\n';
  if (meta.hasState) {
    out += '            if (state.isDirty()) {\n';
    out += '                _dirtyTick();\n';
    out += '                state.clearDirty();\n';
    out += '            }\n';
  }
  if (meta.hasScriptRuntime) {
    out += '            qjs_runtime.tick();\n';
    out += '            luajit_runtime.tick();\n';
  }
  out += '        }\n';
  out += '    };\n';
  out += '    return &_tick.tick;\n';
  out += '}\n';
  out += 'export fn app_get_root() *Node { return &_root; }\n';
  out += 'export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n';
  out += 'export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n';
  out += 'export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n';
  out += 'export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n';
  out += 'export fn app_get_title() [*]const u8 { return "' + meta.appName + '"; }\n';
  out += 'export fn app_get_title_len() usize { return ' + meta.appName.length + '; }\n\n';

  out += 'export fn app_state_count() usize { return ' + ctx.stateSlots.length + '; }\n';

  if (meta.hasState && !globalThis.__parityMode) {
    var types = ctx.stateSlots.map(function(s) {
      return ({ int: 0, float: 1, boolean: 2, string: 3 }[s.type] || 0);
    });
    out += 'const _slot_types = [_]u8{ ' + types.join(', ') + ' };\n';
    out += 'export fn app_state_slot_type(id: usize) u8 { if (id < _slot_types.len) return _slot_types[id]; return 0; }\n';
    out += 'export fn app_state_get_int(id: usize) i64 { return state.getSlot(id); }\n';
    out += 'export fn app_state_set_int(id: usize, val: i64) void { state.setSlot(id, val); }\n';
    out += 'export fn app_state_get_float(id: usize) f64 { return state.getSlotFloat(id); }\n';
    out += 'export fn app_state_set_float(id: usize, val: f64) void { state.setSlotFloat(id, val); }\n';
    out += 'export fn app_state_get_bool(id: usize) u8 { return if (state.getSlotBool(id)) 1 else 0; }\n';
    out += 'export fn app_state_set_bool(id: usize, val: u8) void { state.setSlotBool(id, val != 0); }\n';
    out += 'export fn app_state_get_string_ptr(id: usize) [*]const u8 { return state.getSlotString(id).ptr; }\n';
    out += 'export fn app_state_get_string_len(id: usize) usize { return state.getSlotString(id).len; }\n';
    out += 'export fn app_state_set_string(id: usize, ptr: [*]const u8, len: usize) void { state.setSlotString(id, ptr[0..len]); }\n';
    out += 'export fn app_state_mark_dirty() void { state.markDirty(); }\n';
  }

  return out;
}

_emitAtoms[41] = {
  id: 41,
  name: 'app_exports',
  group: 'entry',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js',
  applies: _a041_applies,
  emit: _a041_emit,
};
