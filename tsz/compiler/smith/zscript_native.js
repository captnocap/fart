// Native `<zscript>` support for the active app/page lane.
//
// Source contract owns the backend annotation. This helper takes the
// zscript-tagged function entries and lowers them into native Zig helpers plus
// QuickJS/LuaJIT host wrappers under the authored function names.
//
// Current scope is intentionally exact:
// - native bodies may use params, locals, control flow, and scalar state slots
// - native bodies may call other native zscript functions
// - native bodies may not currently depend on object-array / object / ambient
//   page vars or cross-backend function calls

function isNativeFunc(name) {
  return !!(ctx.nativeFuncs && ctx.nativeFuncs.indexOf(name) >= 0);
}

function nativeExprNeedsLua(expr) {
  if (!expr || !ctx.nativeFuncs || ctx.nativeFuncs.length === 0) return false;
  for (var i = 0; i < ctx.nativeFuncs.length; i++) {
    var name = ctx.nativeFuncs[i];
    if (new RegExp('\\b' + escapeRegExp(name) + '\\s*\\(').test(expr)) return true;
    if (String(expr || '').trim() === name) return true;
  }
  return false;
}

function _intentTypeForPageStateVar(sv) {
  if (!sv) return null;
  if (sv.type === 'int') return 'i64';
  if (sv.type === 'float') return 'f32';
  if (sv.type === 'boolean') return 'bool';
  if (sv.type === 'string') return 'string';
  return null;
}

function _zigLiteralForStateSlot(slot) {
  if (!slot) return '0';
  if (slot.type === 'string') return zigStringLiteral(slot.initial || '');
  if (slot.type === 'boolean') return slot.initial ? 'true' : 'false';
  if (slot.type === 'float') return String(slot.initial != null ? slot.initial : 0.0);
  return String(slot.initial != null ? slot.initial : 0);
}

function _buildPageNativeIntentEnv(stateVars, typesBlock) {
  var env = {
    typeMap: {},
    variantToType: {},
    variantTypes: {},
    varTypes: {},
    constTypes: {},
    constValues: {},
    unsupported: [],
  };

  if (typeof buildIntentTypeMap === 'function' && typesBlock) {
    buildIntentTypeMap({ blocks: { types: typesBlock } }, env);
  }

  for (var i = 0; i < (stateVars || []).length; i++) {
    var sv = stateVars[i];
    var t = _intentTypeForPageStateVar(sv);
    if (t) env.varTypes[sv.name] = t;
  }

  return env;
}

function _seedNativeModuleGlobals(env) {
  _modImportedNames = [];
  _modFnPtrParams = {};
  _modEnumVariants = [];
  _modReservedNames = ['std', 'ptr', 'bits', 'max', 'min', 'is_infinite', 'reverse'];
  _modStateVarTypes = {};
  _modConstVarTypes = {};
  _modTypeFieldMap = {};

  var varNames = Object.keys((env && env.varTypes) || {});
  for (var vi = 0; vi < varNames.length; vi++) _modStateVarTypes[varNames[vi]] = env.varTypes[varNames[vi]];
  var constNames = Object.keys((env && env.constTypes) || {});
  for (var ci = 0; ci < constNames.length; ci++) _modConstVarTypes[constNames[ci]] = env.constTypes[constNames[ci]];
}

function _inferNativeParamType(entry, paramName, env, loweredParamTypes) {
  var known = loweredParamTypes && loweredParamTypes[paramName];
  if (known && known !== 'anytype') return stripIntentOptionalType(known);

  var body = (entry && entry.bodyLines ? entry.bodyLines : []).join('\n');
  if (new RegExp('\\b' + escapeRegExp(paramName) + '\\.length\\b').test(body) ||
      new RegExp('\\b' + escapeRegExp(paramName) + '\\s*\\[').test(body) ||
      new RegExp("['\"][^'\"]*['\"]\\s*\\+\\s*" + escapeRegExp(paramName)).test(body) ||
      new RegExp(escapeRegExp(paramName) + "\\s*\\+\\s*['\"][^'\"]*['\"]").test(body)) {
    return 'string';
  }
  if (new RegExp('\\b' + escapeRegExp(paramName) + '\\s+(?:exact|not exact)\\s+(?:true|false)\\b').test(body) ||
      new RegExp('\\bnot\\s+' + escapeRegExp(paramName) + '\\b').test(body)) {
    return 'bool';
  }
  if (new RegExp('\\b' + escapeRegExp(paramName) + '\\s*(?:[+\\-*%/]|>=|<=|>|<)').test(body) ||
      new RegExp('(?:[+\\-*%/]|>=|<=|>|<)\\s*' + escapeRegExp(paramName) + '\\b').test(body)) {
    return 'i64';
  }
  if (env && env.varTypes && env.varTypes[paramName]) return stripIntentOptionalType(env.varTypes[paramName]);
  return null;
}

function _isSupportedNativeScalarType(type) {
  var raw = stripIntentOptionalType(type || '');
  return raw === 'void' || raw === 'string' || raw === 'bool' ||
    raw === 'i64' || raw === 'f32' || raw === 'f64';
}

function _nativeUsesScalarState(entry, scalarNames) {
  var body = (entry && entry.bodyLines ? entry.bodyLines : []).join('\n');
  for (var i = 0; i < scalarNames.length; i++) {
    var name = scalarNames[i];
    if (new RegExp('\\b' + escapeRegExp(name) + '\\b').test(body) ||
        new RegExp('\\bset_' + escapeRegExp(name) + '\\b').test(body)) {
      return true;
    }
  }
  return false;
}

function _nativeMutatesScalarState(entry, scalarNames) {
  var lines = entry && entry.bodyLines ? entry.bodyLines : [];
  for (var i = 0; i < lines.length; i++) {
    var trimmed = String(lines[i] || '').trim();
    if (!trimmed || trimmed.indexOf('//') === 0) continue;
    for (var si = 0; si < scalarNames.length; si++) {
      var name = scalarNames[si];
      if (new RegExp('^' + escapeRegExp(name) + '\\s+is\\s+').test(trimmed) ||
          new RegExp('^set_' + escapeRegExp(name) + '\\s+is\\s+').test(trimmed) ||
          new RegExp('\\bset_' + escapeRegExp(name) + '\\s*\\(').test(trimmed)) {
        return true;
      }
    }
  }
  return false;
}

function _collectNativeUnsupportedReasons(entry, stateVars, ambients, backendMap) {
  var body = (entry && entry.bodyLines ? entry.bodyLines : []).join('\n');
  var reasons = [];

  for (var i = 0; i < (stateVars || []).length; i++) {
    var sv = stateVars[i];
    if (_intentTypeForPageStateVar(sv)) continue;
    if (new RegExp('\\b(?:set_)?' + escapeRegExp(sv.name) + '\\b').test(body)) {
      reasons.push('non-scalar state "' + sv.name + '"');
    }
  }

  for (var ai = 0; ai < (ambients || []).length; ai++) {
    if (new RegExp('\\b' + escapeRegExp(ambients[ai].name) + '\\b').test(body)) {
      reasons.push('ambient "' + ambients[ai].name + '"');
    }
  }

  var fnNames = Object.keys(backendMap || {});
  for (var fi = 0; fi < fnNames.length; fi++) {
    var fnName = fnNames[fi];
    if (fnName === entry.name) continue;
    if (backendMap[fnName] === 'zscript') continue;
    if (new RegExp('\\b' + escapeRegExp(fnName) + '\\s*\\(').test(body)) {
      reasons.push('cross-backend call "' + fnName + '"');
    }
  }

  return reasons;
}

function _emitNativeStateGlobals(slotMeta) {
  if (!slotMeta.length) return '';
  var out = '// ── Native zscript scalar mirrors ─────────────────────\n';
  for (var i = 0; i < slotMeta.length; i++) {
    out += 'var ' + slotMeta[i].getter + ': ' + modTranspileType(slotMeta[i].intentType) + ' = ' + _zigLiteralForStateSlot(slotMeta[i]) + ';\n';
  }
  out += '\n';
  for (var si = 0; si < slotMeta.length; si++) {
    out += 'fn ' + slotMeta[si].setter + '(v: ' + modTranspileType(slotMeta[si].intentType) + ') void { ' + slotMeta[si].getter + ' = v; }\n';
  }
  out += '\n';
  out += 'fn _zscript_sync_state_in() void {\n';
  for (var ii = 0; ii < slotMeta.length; ii++) {
    var slot = slotMeta[ii];
    if (slot.type === 'float') out += '    ' + slot.getter + ' = state.getSlotFloat(' + slot.slotIdx + ');\n';
    else if (slot.type === 'boolean') out += '    ' + slot.getter + ' = state.getSlotBool(' + slot.slotIdx + ');\n';
    else if (slot.type === 'string') out += '    ' + slot.getter + ' = state.getSlotString(' + slot.slotIdx + ');\n';
    else out += '    ' + slot.getter + ' = state.getSlot(' + slot.slotIdx + ');\n';
  }
  out += '}\n\n';

  out += 'fn _zscript_commit_state() void {\n';
  for (var oi = 0; oi < slotMeta.length; oi++) {
    var outSlot = slotMeta[oi];
    if (outSlot.type === 'float') out += '    state.setSlotFloat(' + outSlot.slotIdx + ', ' + outSlot.getter + ');\n';
    else if (outSlot.type === 'boolean') out += '    state.setSlotBool(' + outSlot.slotIdx + ', ' + outSlot.getter + ');\n';
    else if (outSlot.type === 'string') out += '    state.setSlotString(' + outSlot.slotIdx + ', ' + outSlot.getter + ');\n';
    else out += '    state.setSlot(' + outSlot.slotIdx + ', ' + outSlot.getter + ');\n';
  }
  out += '    state.markDirty();\n';
  out += '}\n\n';

  out += 'fn _zscript_sync_qjs_globals(ctx: ?*qjs.JSContext) void {\n';
  out += '    if (!HAS_NATIVE_QUICKJS or ctx == null) return;\n';
  out += '    const c2 = ctx.?;\n';
  out += '    const global = qjs.JS_GetGlobalObject(c2);\n';
  out += '    defer qjs.JS_FreeValue(c2, global);\n';
  for (var qi = 0; qi < slotMeta.length; qi++) {
    var qslot = slotMeta[qi];
    if (qslot.type === 'string') out += '    _ = qjs.JS_SetPropertyStr(c2, global, "' + qslot.getter + '", qjs.JS_NewStringLen(c2, ' + qslot.getter + '.ptr, @intCast(' + qslot.getter + '.len)));\n';
    else if (qslot.type === 'float') out += '    _ = qjs.JS_SetPropertyStr(c2, global, "' + qslot.getter + '", qjs.JS_NewFloat64(c2, ' + qslot.getter + '));\n';
    else if (qslot.type === 'boolean') out += '    _ = qjs.JS_SetPropertyStr(c2, global, "' + qslot.getter + '", qjs.JS_NewBool(c2, if (' + qslot.getter + ') 1 else 0));\n';
    else out += '    _ = qjs.JS_SetPropertyStr(c2, global, "' + qslot.getter + '", qjs.JS_NewFloat64(c2, @floatFromInt(' + qslot.getter + ')));\n';
  }
  out += '}\n\n';

  out += 'fn _zscript_sync_lua_globals(L: ?*lua.lua_State) void {\n';
  out += '    if (L == null) return;\n';
  for (var li = 0; li < slotMeta.length; li++) {
    var lslot = slotMeta[li];
    if (lslot.type === 'string') out += '    lua.lua_pushlstring(L, ' + lslot.getter + '.ptr, @intCast(' + lslot.getter + '.len));\n';
    else if (lslot.type === 'boolean') out += '    lua.lua_pushboolean(L, if (' + lslot.getter + ') 1 else 0);\n';
    else if (lslot.type === 'float') out += '    lua.lua_pushnumber(L, ' + lslot.getter + ');\n';
    else out += '    lua.lua_pushnumber(L, @floatFromInt(' + lslot.getter + '));\n';
    out += '    lua.lua_setglobal(L, "' + lslot.getter + '");\n';
  }
  out += '}\n\n';

  out += 'fn _zscript_sync_qjs_to_lua(ctx: ?*qjs.JSContext) void {\n';
  out += '    _zscript_sync_qjs_globals(ctx);\n';
  for (var ql = 0; ql < slotMeta.length; ql++) out += '    qjs_runtime.syncScalarToLua("' + slotMeta[ql].getter + '");\n';
  out += '}\n\n';

  out += 'fn _zscript_sync_lua_to_qjs(L: ?*lua.lua_State) void {\n';
  out += '    _zscript_sync_lua_globals(L);\n';
  for (var lq = 0; lq < slotMeta.length; lq++) out += '    qjs_runtime.syncLuaToQjs("' + slotMeta[lq].getter + '");\n';
  out += '}\n\n';

  return out;
}

function _emitNativeQjsWrapper(fnMeta) {
  var out = 'fn _zscript_qjs_' + fnMeta.name + '(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\n';
  if (fnMeta.paramOrder.length > 0) out += '    if (argc < ' + fnMeta.paramOrder.length + ') return QJS_UNDEFINED;\n';
  if (fnMeta.usesState) out += '    _zscript_sync_state_in();\n';
  for (var i = 0; i < fnMeta.paramOrder.length; i++) {
    var name = fnMeta.paramOrder[i];
    var type = fnMeta.paramTypes[name];
    if (type === 'string') {
      out += '    const _arg_cstr_' + i + ' = qjs.JS_ToCString(ctx, argv[' + i + ']);\n';
      out += '    if (_arg_cstr_' + i + ' == null) return QJS_UNDEFINED;\n';
      out += '    defer qjs.JS_FreeCString(ctx, _arg_cstr_' + i + ');\n';
      out += '    const ' + name + ': []const u8 = std.mem.span(_arg_cstr_' + i + ');\n';
    } else if (type === 'bool') {
      out += '    const ' + name + ': bool = qjs.JS_ToBool(ctx, argv[' + i + ']) != 0;\n';
    } else if (type === 'f32' || type === 'f64') {
      out += '    var _arg_num_' + i + ': f64 = 0;\n';
      out += '    _ = qjs.JS_ToFloat64(ctx, &_arg_num_' + i + ', argv[' + i + ']);\n';
      out += '    const ' + name + ': ' + type + ' = @floatCast(_arg_num_' + i + ');\n';
    } else {
      out += '    var _arg_int_' + i + ': f64 = 0;\n';
      out += '    _ = qjs.JS_ToFloat64(ctx, &_arg_int_' + i + ', argv[' + i + ']);\n';
      out += '    const ' + name + ': i64 = @intFromFloat(_arg_int_' + i + ');\n';
    }
  }
  var callExpr = fnMeta.name + '(' + fnMeta.paramOrder.join(', ') + ')';
  if (fnMeta.returnType === 'void') {
    out += '    ' + callExpr + ';\n';
    if (fnMeta.mutatesState) {
      out += '    _zscript_commit_state();\n';
      out += '    _zscript_sync_qjs_to_lua(ctx);\n';
    }
    out += '    return QJS_UNDEFINED;\n';
    out += '}\n\n';
    return out;
  }
  out += '    const _result = ' + callExpr + ';\n';
  if (fnMeta.mutatesState) {
    out += '    _zscript_commit_state();\n';
    out += '    _zscript_sync_qjs_to_lua(ctx);\n';
  }
  if (fnMeta.returnType === 'string') out += '    return qjs.JS_NewStringLen(ctx, _result.ptr, @intCast(_result.len));\n';
  else if (fnMeta.returnType === 'bool') out += '    return qjs.JS_NewBool(ctx, if (_result) 1 else 0);\n';
  else if (fnMeta.returnType === 'f32' || fnMeta.returnType === 'f64') out += '    return qjs.JS_NewFloat64(ctx, _result);\n';
  else out += '    return qjs.JS_NewFloat64(ctx, @floatFromInt(_result));\n';
  out += '}\n\n';
  return out;
}

function _emitNativeLuaWrapper(fnMeta) {
  var out = 'fn _zscript_lua_' + fnMeta.name + '(L: ?*lua.lua_State) callconv(.c) c_int {\n';
  if (fnMeta.usesState) out += '    _zscript_sync_state_in();\n';
  for (var i = 0; i < fnMeta.paramOrder.length; i++) {
    var argName = fnMeta.paramOrder[i];
    var argType = fnMeta.paramTypes[argName];
    var luaIdx = i + 1;
    if (argType === 'string') {
      out += '    var _arg_len_' + i + ': usize = 0;\n';
      out += '    const _arg_ptr_' + i + ' = lua.lua_tolstring(L, ' + luaIdx + ', &_arg_len_' + i + ');\n';
      out += '    const ' + argName + ': []const u8 = if (_arg_ptr_' + i + ' != null) @as([*]const u8, @ptrCast(_arg_ptr_' + i + '))[0.._arg_len_' + i + '] else "";\n';
    } else if (argType === 'bool') {
      out += '    const ' + argName + ': bool = lua.lua_toboolean(L, ' + luaIdx + ') != 0;\n';
    } else if (argType === 'f32' || argType === 'f64') {
      out += '    const ' + argName + ': ' + argType + ' = @floatCast(lua.lua_tonumber(L, ' + luaIdx + '));\n';
    } else {
      out += '    const ' + argName + ': i64 = @intFromFloat(lua.lua_tonumber(L, ' + luaIdx + '));\n';
    }
  }
  var callExpr = fnMeta.name + '(' + fnMeta.paramOrder.join(', ') + ')';
  if (fnMeta.returnType === 'void') {
    out += '    ' + callExpr + ';\n';
    if (fnMeta.mutatesState) {
      out += '    _zscript_commit_state();\n';
      out += '    _zscript_sync_lua_to_qjs(L);\n';
    }
    out += '    return 0;\n';
    out += '}\n\n';
    return out;
  }
  out += '    const _result = ' + callExpr + ';\n';
  if (fnMeta.mutatesState) {
    out += '    _zscript_commit_state();\n';
    out += '    _zscript_sync_lua_to_qjs(L);\n';
  }
  if (fnMeta.returnType === 'string') out += '    lua.lua_pushlstring(L, _result.ptr, @intCast(_result.len));\n';
  else if (fnMeta.returnType === 'bool') out += '    lua.lua_pushboolean(L, if (_result) 1 else 0);\n';
  else out += '    lua.lua_pushnumber(L, _result);\n';
  out += '    return 1;\n';
  out += '}\n\n';
  return out;
}

function _emitNativeSupportPreamble() {
  return (
    '// ── Native zscript runtime shims ───────────────────────\n' +
    'const native_build_options = @import("build_options");\n' +
    'const HAS_NATIVE_QUICKJS = if (@hasDecl(native_build_options, "has_quickjs")) native_build_options.has_quickjs else true;\n' +
    'const qjs = if (HAS_NATIVE_QUICKJS) @cImport({\n' +
    '    @cDefine("_GNU_SOURCE", "1");\n' +
    '    @cDefine("QUICKJS_NG_BUILD", "1");\n' +
    '    @cInclude("quickjs.h");\n' +
    '}) else struct {\n' +
    '    pub const JSValue = extern struct { u: extern union { int32: i32 } = .{ .int32 = 0 }, tag: i64 = 0 };\n' +
    '    pub const JSContext = opaque {};\n' +
    '};\n' +
    'const QJS_UNDEFINED = if (HAS_NATIVE_QUICKJS) (qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 }) else qjs.JSValue{};\n' +
    'const lua = luajit_runtime.lua;\n\n'
  );
}

function _emitNativePlanSection(plan, typeSection, fnSection, slotMeta) {
  var out = _emitNativeSupportPreamble();
  if (typeSection) out += '// ── Native zscript types ─────────────────────────────\n' + typeSection;
  if (slotMeta.length) out += _emitNativeStateGlobals(slotMeta);
  out += '// ── Native zscript functions ─────────────────────────\n' + fnSection;
  out += '// ── Native zscript wrappers ──────────────────────────\n';
  for (var i = 0; i < plan.functions.length; i++) {
    out += _emitNativeQjsWrapper(plan.functions[i]);
    out += _emitNativeLuaWrapper(plan.functions[i]);
  }
  return out;
}

function buildNativeZscriptPlan(entries, stateVars, ambients, typesBlock) {
  var nativeEntries = filterFunctionEntriesByBackend(entries || [], ['zscript']);
  if (!nativeEntries.length) return null;

  var env = _buildPageNativeIntentEnv(stateVars, typesBlock);
  var backendMap = buildFunctionBackendMap(entries || []);
  var scalarNames = [];
  var slotMeta = [];

  for (var si = 0; si < (ctx.stateSlots || []).length; si++) {
    var slot = ctx.stateSlots[si];
    var intentType = _intentTypeForPageStateVar({ type: slot.type });
    if (!intentType) continue;
    scalarNames.push(slot.getter);
    slotMeta.push({
      slotIdx: si,
      getter: slot.getter,
      setter: slot.setter,
      type: slot.type,
      intentType: intentType,
      initial: slot.initial,
    });
  }

  var nativeKnownNames = {};
  for (var ni = 0; ni < nativeEntries.length; ni++) nativeKnownNames[nativeEntries[ni].name] = true;

  var fnReturnTypes = {};
  for (var pass = 0; pass < 4; pass++) {
    var changed = false;
    for (var ri = 0; ri < nativeEntries.length; ri++) {
      var inferred = inferIntentFunctionReturnType(nativeEntries[ri], env, fnReturnTypes, nativeKnownNames);
      if (inferred && fnReturnTypes[nativeEntries[ri].name] !== inferred) {
        fnReturnTypes[nativeEntries[ri].name] = inferred;
        changed = true;
      }
    }
    if (!changed) break;
  }

  var compatBlock = '';
  var plan = {
    funcNames: [],
    functions: [],
    registrations: [],
    initJsExprs: [],
    errors: [],
    contractFunctions: [],
    zigSection: '',
  };

  for (var ei = 0; ei < nativeEntries.length; ei++) {
    var entry = nativeEntries[ei];
    var entryErrors = [];
    var reasons = _collectNativeUnsupportedReasons(entry, stateVars, ambients, backendMap);
    if (reasons.length > 0) entryErrors.push('unsupported native body uses ' + reasons.join(', '));

    var lowered = lowerIntentFunctionEntry(entry, env, fnReturnTypes, nativeKnownNames);
    if (!lowered) {
      entryErrors.push('lowering failed');
    }
    if (entryErrors.length > 0) {
      plan.errors.push('zscript ' + entry.name + ': ' + entryErrors.join('; '));
      continue;
    }

    var returnType = stripIntentOptionalType(lowered.returnType || 'void');
    if (!_isSupportedNativeScalarType(returnType)) {
      plan.errors.push('zscript ' + entry.name + ': unsupported return type "' + lowered.returnType + '"');
      continue;
    }

    var paramTypes = {};
    var paramOrder = entry.params ? entry.params.slice() : [];
    if (entry.interval && paramOrder.length > 0) {
      entryErrors.push('scheduled native functions may not declare params');
    }
    for (var pi = 0; pi < paramOrder.length; pi++) {
      var pname = paramOrder[pi];
      var ptype = _inferNativeParamType(entry, pname, env, lowered.paramTypes || {});
      if (!_isSupportedNativeScalarType(ptype)) {
        entryErrors.push('unsupported param "' + pname + '" type');
        continue;
      }
      paramTypes[pname] = stripIntentOptionalType(ptype);
    }
    if (entryErrors.length > 0) {
      plan.errors.push('zscript ' + entry.name + ': ' + entryErrors.join('; '));
      continue;
    }

    compatBlock += lowered.header + '\n';
    for (var li = 0; li < lowered.lines.length; li++) compatBlock += lowered.lines[li] + '\n';
    compatBlock += '\n';

    var usesState = _nativeUsesScalarState(entry, scalarNames);
    var mutatesState = _nativeMutatesScalarState(entry, scalarNames);
    var fnMeta = {
      name: lowered.compatName || entry.name,
      returnType: returnType,
      paramOrder: paramOrder,
      paramTypes: paramTypes,
      usesState: usesState,
      mutatesState: mutatesState,
      interval: entry.interval || 0,
    };

    plan.funcNames.push(fnMeta.name);
    plan.functions.push(fnMeta);
    plan.registrations.push({
      name: fnMeta.name,
      argCount: paramOrder.length,
      qjsWrapper: '_zscript_qjs_' + fnMeta.name,
      luaWrapper: '_zscript_lua_' + fnMeta.name,
    });
    if (fnMeta.interval) {
      plan.initJsExprs.push('setInterval(function(){ ' + fnMeta.name + '(); }, ' + fnMeta.interval + ')');
    }
    plan.contractFunctions.push({
      name: fnMeta.name,
      backend: 'zscript',
      params: paramOrder.map(function(name) { return { name: name, type: paramTypes[name] }; }),
      returnType: returnType,
      usesState: usesState,
      mutatesState: mutatesState,
      interval: fnMeta.interval || 0,
    });
  }

  if (plan.errors.length > 0) return plan;
  if (!plan.functions.length) return null;

  _seedNativeModuleGlobals(env);

  var typeNames = [];
  var allVariants = [];
  var typeSection = '';
  if (typesBlock) {
    var compatTypes = normalizeIntentModuleTypes({ blocks: { types: typesBlock } }, env);
    if (compatTypes) typeSection = emitTypesBlock(compatTypes, typeNames, {}, allVariants);
  }
  var fnSection = emitFunctionsBlock(compatBlock, typeNames, allVariants);
  plan.zigSection = _emitNativePlanSection(plan, typeSection, fnSection, slotMeta);
  return plan;
}

function nativePlanCompileError(plan) {
  if (!plan || !plan.errors || !plan.errors.length) return '';
  var first = plan.errors[0].replace(/"/g, '\\"');
  return '// Smith error: zscript native lowering failed\n' +
    'comptime { @compileError("' + first + '"); }\n';
}

function emitNativeZscriptSection(ctx) {
  return ctx && ctx.nativePlan && ctx.nativePlan.zigSection ? ctx.nativePlan.zigSection : '';
}
