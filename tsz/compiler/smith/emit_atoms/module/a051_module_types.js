// ── Module Emit Atom 051: Types ─────────────────────────────────

function _a051_module_applies(ctx, meta) {
  return meta && meta.target === 'zig' && !!ctx.blocks.types;
}

function _a051_module_emit(ctx, meta) {
  void meta;
  var out = '// ── Type definitions ────────────────────────────────\n';
  out += emitTypesBlock(ctx.blocks.types, ctx.typeNames, ctx.enumVariants, ctx.allVariants);
  _modEnumVariants = ctx.allVariants.slice();
  return out;
}

_moduleEmitAtoms[51] = {
  id: 51,
  name: 'module_types',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/types.js',
  applies: _a051_module_applies,
  emit: _a051_module_emit,
};
