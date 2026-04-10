// ── Module Emit Atom 050: FFI Imports ───────────────────────────

function _a050_module_applies(ctx, meta) {
  return meta && meta.target === 'zig' && !!ctx.blocks.ffi;
}

function _a050_module_emit(ctx, meta) {
  void meta;
  return '// ── FFI Imports ────────────────────────────────────\n' + emitFfiBlock(ctx.blocks.ffi) + '\n';
}

_moduleEmitAtoms[50] = {
  id: 50,
  name: 'module_ffi',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/ffi.js',
  applies: _a050_module_applies,
  emit: _a050_module_emit,
};
