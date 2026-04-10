// ── Module Emit Atom 054: Functions ─────────────────────────────

function _a054_module_applies(ctx, meta) {
  return meta && meta.target === 'zig' && !!ctx.blocks.functions;
}

function _a054_module_emit(ctx, meta) {
  void meta;
  prescanModFunctionSigs(ctx.blocks.functions, ctx.typeNames);
  return '// ── Functions ──────────────────────────────────────\n' + emitFunctionsBlock(ctx.blocks.functions, ctx.typeNames, ctx.allVariants);
}

_moduleEmitAtoms[54] = {
  id: 54,
  name: 'module_functions',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/functions.js',
  applies: _a054_module_applies,
  emit: _a054_module_emit,
};
