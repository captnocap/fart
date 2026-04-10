// ── Smith Module Emit Atom Registry ─────────────────────────────

var _moduleEmitAtoms = {};

function runModuleEmitAtoms(ctx, meta) {
  var out = '';
  for (var i = 47; i <= 56; i++) {
    var atom = _moduleEmitAtoms[i];
    if (atom && atom.applies(ctx, meta)) out += atom.emit(ctx, meta);
  }
  return out;
}
