(function() {
// ── Pattern 134: data-* attributes ─────────────────────────────
// Index: 134
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box data-testid="main" />
//   <Pressable data-id={item.id} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   // .test_id = "main"
//   // or a generic metadata field on the compiled node
//
// Notes:
//   Hyphenated attr names are not modeled in the native attr parser. The lexer
//   tokenizes `data-testid` as `identifier(data)` + `minus` + `identifier(testid)`,
//   so parseJSXElement() does not see a single attr name to dispatch.
//
//   Even camelCase variants like `dataTestId` would still fall through the
//   unknown-attr path in parse/element/attrs_dispatch.js and be consumed
//   without attaching anything to the node.
//
//   The only current `test_id` usage in Smith is an internal placeholder for
//   Lua map wrappers, not author-facing data-* attribute support.

function match(c, ctx) {
  // data-* attribute: identifier 'data' followed by minus token
  if (c.kind() !== TK.identifier) return false;
  if (c.text() !== 'data') return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.minus;
}

function compile(c, ctx) {
  var parts = [];
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.gt || c.kind() === TK.slash_gt) break;
    parts.push(c.text());
    if (c.kind() === TK.equals) {
      c.advance();
      if (c.kind() === TK.lbrace) {
        var depth = 1;
        parts.push(c.text());
        c.advance();
        while (c.kind() !== TK.eof && depth > 0) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          parts.push(c.text());
          c.advance();
        }
        break;
      }
      if (c.kind() === TK.string || c.kind() === TK.identifier || c.kind() === TK.number) {
        parts.push(c.text());
        c.advance();
      }
      break;
    }
    c.advance();
  }
  return {
    ignoredAttr: parts.join(''),
    attrKind: 'data_attribute',
  };
}

_patterns[134] = { id: 134, match: match, compile: compile };

})();
