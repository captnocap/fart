(function() {
// ── Pattern 071: Array children ─────────────────────────────────
// Index: 71
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box>{[<A />, <B />]}</Box>
//   <List>{items.map(i => <Item key={i.id} />)}</List>
//
// Mixed syntax (hybrid):
//   <Box>{[<A />, <B />]}</Box>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Array literal children are flattened into parent children array
//   var _arr_0 = [_]Node{
//     .{ .tag = .A, ... },
//     .{ .tag = .B, ... },
//   };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   Array literal children inside braces {[]} are flattened. Each element
//   in the array becomes a sibling child of the parent. This is handled
//   by parseChildren() which detects the array literal and processes each
//   element as a separate child node.
//
//   The array wrapper is transparent — it doesn't create a wrapper node,
//   just contributes children to the parent's child list.
//
//   Implemented in parse/children/brace.js → tryParseArrayLiteralChildren()
//   which handles both inline arrays [{<A />}] and expression arrays
//   that evaluate to JSX elements.

function match(c, ctx) {
  // { [ ... ] } — array literal inside JSX expression braces
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbracket;
}

function compile(c, ctx) {
  // Array literal children {[<A/>, <B/>]} — flatten into parent's child list.
  // Returns an array of child nodeExprs rather than a single nodeExpr.
  // The caller (parseChildren loop) should spread these into the children array.
  if (c.kind() !== TK.lbrace) return null;
  c.advance(); // {
  if (c.kind() !== TK.lbracket) return null;
  c.advance(); // [
  var items = [];
  while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
    if (c.kind() === TK.comma) { c.advance(); continue; }
    if (c.kind() === TK.lt) {
      var child = parseJSXElement(c);
      if (child) items.push(child);
    } else {
      c.advance(); // skip non-JSX tokens
    }
  }
  if (c.kind() === TK.rbracket) c.advance(); // ]
  if (c.kind() === TK.rbrace) c.advance(); // }
  // Return first child or empty — full array flattening is handled by the
  // consumer (parseChildren adds each item individually).
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  // Multiple children: return as a wrapper with .arrayChildren
  return { nodeExpr: items[0].nodeExpr, arrayChildren: items };
}

_patterns[71] = {
  id: 71,
  name: 'array_children',
  status: 'complete',
  match,
  compile,
};

})();
