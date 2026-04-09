(function() {
// ── Pattern 137: Namespaced attrs ──────────────────────────────
// Index: 137
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <use xlinkHref="#icon" />
//   <svg><use xlink:href="#icon" /></svg>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   // preserve the namespaced reference on an SVG-like node
//
// Notes:
//   Namespaced attrs are not compiled today.
//   - `xlinkHref` lexes as a normal identifier attr, but attrs_dispatch.js has
//     no handler for it, so the value is consumed and dropped
//   - `xlink:href` is even less compatible with the token model because the
//     colon splits the name into multiple tokens
//
//   This is blocked on first-class SVG support. Without an SVG target node,
//   preserving namespaced references has nowhere meaningful to land.

function match(c, ctx) {
  // identifier:identifier — namespaced attribute (e.g. xlink:href)
  if (c.kind() !== TK.identifier) return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.colon && c.kindAt(c.pos + 2) === TK.identifier;
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
    attrKind: 'namespaced_attribute',
  };
}

_patterns[137] = { id: 137, match: match, compile: compile };

})();
