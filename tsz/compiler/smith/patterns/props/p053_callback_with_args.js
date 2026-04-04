// ── Pattern 053: Callback with args ─────────────────────────────
// Index: 53
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   <Item onClick={() => select(item.id)} />
//   <Row onDelete={() => removeItem(row.id, row.type)} />
//   <Card onPress={() => navigate(`/item/${item.slug}`)} />
//
// Mixed syntax (hybrid):
//   <Item onPress={() => select(item.id)} />
//   Same structure — the handler body captures closure variables.
//
// Zig output target:
//   // Inside a .map() loop — closure over OA fields:
//   // The handler captures _i and uses OA field at that index.
//   // Handler is generated per-iteration or uses captured index:
//   nodes._arr_0[_i] = .{ .on_press = _handler_press_0 };
//   // Handler body:
//   fn _handler_press_0() void {
//     // QuickJS eval with captured OA field value:
//     qjs_runtime.eval("select(items[__pressed_idx].id)");
//   }
//
// Notes:
//   This is pattern 052 (callback prop) with the additional complexity of
//   closure variables — typically map item fields, state values, or props.
//
//   Implemented via bindPressHandlerExpression() which:
//     1. Parses the arrow function body
//     2. Identifies captured variables:
//        - Map item fields (item.id → OA field reference)
//        - State getters (count → slotGet)
//        - Prop stack values
//        - Script function names
//     3. Generates handler that resolves captures at press time
//
//   Inside .map() loops, the pressed index (__pressed_idx) is captured
//   so the handler knows which item was clicked.
//
//   Partial because:
//     - Closure capture limited to single-level item.field (not item.nested.field)
//     - Multiple arguments partially supported (depends on expression complexity)
//     - Template literal arguments route through QuickJS eval
//     - No destructured closure variables

function match(c, ctx) {
  // Same detection as p052, but inside a map context with item references.
  // Differentiated from p052 by the presence of closure variables in the
  // arrow function body that reference map items, state, or outer scope.
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  // Find arrow
  var la = c.pos, pd = 1; la++;
  while (la < c.count && pd > 0) {
    if (c.kindAt(la) === TK.lparen) pd++;
    if (c.kindAt(la) === TK.rparen) pd--;
    la++;
  }
  if (!(la < c.count && c.kindAt(la) === TK.arrow)) { c.restore(saved); return false; }
  // Check if body references a function call with arguments
  la++; // skip arrow
  var hasCall = false;
  var bd = 0;
  while (la < c.count) {
    if (c.kindAt(la) === TK.lbrace) bd++;
    if (c.kindAt(la) === TK.rbrace) { if (bd === 0) break; bd--; }
    if (c.kindAt(la) === TK.lparen) { hasCall = true; break; }
    la++;
  }
  c.restore(saved);
  return hasCall;
}

function compile(c, ctx) {
  // Delegates to bindPressHandlerExpression() via
  // tryParseComponentHandlerProp() or tryParseElementHandlerAttr().
  // See component_handlers.js and attrs_handlers.js.
  return null;
}
