// ── Module Emit Atom 056: Intent Cleanup Manifest ───────────────

function _a056_module_applies(ctx, meta) {
  return meta && meta.target === 'zig' && !!(ctx.intentCleanupPairs && ctx.intentCleanupPairs.length);
}

function _a056_module_emit(ctx, meta) {
  void meta;
  var out = '// ── Intent cleanup manifest ────────────────────────\n';
  out += 'pub const SmithCleanup = struct { name: []const u8, cleanup: []const u8 };\n';
  out += 'pub const smith_cleanup = [_]SmithCleanup{\n';
  for (var i = 0; i < ctx.intentCleanupPairs.length; i++) {
    out += '    .{ .name = "' + ctx.intentCleanupPairs[i].name + '", .cleanup = "' + ctx.intentCleanupPairs[i].cleanup + '" },\n';
  }
  out += '};\n\n';
  return out;
}

_moduleEmitAtoms[56] = {
  id: 56,
  name: 'module_intent_cleanup',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/intent_functions.js',
  applies: _a056_module_applies,
  emit: _a056_module_emit,
};
