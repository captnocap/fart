// ── Emit Atom 007: Root node init ───────────────────────────────
// Index: 7
// Group: state_tree
// Target: zig
// Status: complete
// Current owner: emit/node_tree.js
//
// Trigger: every successful JSX emit path.
// Output target: _root Node initializer from rootExpr.

function applies(ctx, meta) {
  void ctx;
  return typeof meta.rootExpr === 'string' && meta.rootExpr.length > 0;
}

function emit(ctx, meta) {
  void ctx;
  var rootExpr = meta.rootExpr;
  var nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;
  return 'var _root = Node' + nodeInit + ';\n';
}

module.exports = {
  id: 7,
  name: 'root_node_init',
  group: 'state_tree',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/node_tree.js',
  applies: applies,
  emit: emit,
};
