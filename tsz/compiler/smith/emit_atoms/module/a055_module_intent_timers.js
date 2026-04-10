// ── Module Emit Atom 055: Intent Timer Manifest ─────────────────

function _a055_module_applies(ctx, meta) {
  return meta && meta.target === 'zig' && !!(ctx.intentTimers && ctx.intentTimers.length);
}

function _a055_module_emit(ctx, meta) {
  void meta;
  var out = '// ── Intent timer manifest ──────────────────────────\n';
  out += 'pub const SmithEvery = struct { name: []const u8, interval_ms: usize };\n';
  out += 'pub const smith_every = [_]SmithEvery{\n';
  for (var i = 0; i < ctx.intentTimers.length; i++) {
    out += '    .{ .name = "' + ctx.intentTimers[i].name + '", .interval_ms = ' + ctx.intentTimers[i].interval + ' },\n';
  }
  out += '};\n\n';
  return out;
}

_moduleEmitAtoms[55] = {
  id: 55,
  name: 'module_intent_timers',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/intent_functions.js',
  applies: _a055_module_applies,
  emit: _a055_module_emit,
};
