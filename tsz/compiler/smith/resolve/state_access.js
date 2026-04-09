// ── Object state access resolution ──────────────────────────────
// Moved from core.js per migration step 562-563.

function tryResolveObjectStateAccess(c) {
  if (c.kind() !== TK.identifier) return null;
  if (!ctx._objectStateShapes) return null;
  var name = c.text();
  var shape = ctx._objectStateShapes[name];
  if (!shape) return null;
  if (c.pos + 2 >= c.count || c.kindAt(c.pos + 1) !== TK.dot || c.kindAt(c.pos + 2) !== TK.identifier) return null;
  var field = c.textAt(c.pos + 2);
  var flatGetter = name + '_' + field;
  var slotIdx = findSlot(flatGetter);
  if (slotIdx < 0) return null;
  c.advance(); c.advance(); c.advance(); // skip name . field
  return slotGet(flatGetter);
}
