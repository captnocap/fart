(function() {
// ── Pattern 135: ARIA / role attrs ─────────────────────────────
// Index: 135
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box aria-label="close" role="button" />
//   <Text aria-hidden="true">Decorative</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   // accessibility metadata attached to the generated node tree
//
// Notes:
//   There is no ARIA attr compilation path today.
//   - Hyphenated names like `aria-label` are split by the lexer and never
//     arrive as a single attr key.
//   - Bare identifier attrs like `role` *do* parse as a key, but unknown attrs
//     fall through attrs_dispatch.js and are simply consumed and dropped.
//
//   The framework may grow a native accessibility layer later, but that would
//   need explicit node fields and emit plumbing. React/HTML ARIA strings are
//   not currently preserved.

function match(c, ctx) {
  // aria-* attribute or role attribute
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t === 'role') return true;
  if (t === 'aria') {
    if (c.pos + 1 >= c.count) return false;
    return c.kindAt(c.pos + 1) === TK.minus;
  }
  return false;
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
    attrKind: 'aria_attribute',
  };
}

_patterns[135] = { id: 135, match: match, compile: compile };

})();
