// ── Module Emit Atom 049: Imports ───────────────────────────────

function _a049_module_applies(ctx, meta) {
  return meta && meta.target === 'zig' && !!ctx.blocks.imports;
}

function _a049_module_emit(ctx, meta) {
  void meta;
  return '// ── Imports ────────────────────────────────────────\n' + emitImportsBlock(ctx.blocks.imports) + '\n';
}

_moduleEmitAtoms[49] = {
  id: 49,
  name: 'module_imports',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/imports.js',
  applies: _a049_module_applies,
  emit: _a049_module_emit,
};
