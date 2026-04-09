(function() {
// ── Pattern 122: Template literal as prop ───────────────────────
// Index: 122
// Group: strings
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Button title={`Page ${pageNum}`} />
//   <Image source={`/images/${item.id}.png`} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // String prop with interpolation → dynText buffer:
//   .{ .text = "" }  // dynText: fmtString="Page {d}", fmtArgs="state.getSlot(0)"
//
//   // Map item field in prop:
//   // Resolved during component inlining — the prop value carries the
//   // template literal's resolved Zig expression through the propStack.
//
// Notes:
//   Fully implemented. Template literals in prop values are handled by
//   component_brace_values.js:143. When a TK.template_literal token appears
//   in a prop brace value (e.g., title={`Page ${n}`}), the code calls
//   parseTemplateLiteral() and produces either:
//   a) A static string (no interpolations) → returned as plain prop value
//   b) A dynamic expression → the resolved fmtString/fmtArgs flow through
//      the prop stack into the inlined component
//
//   When the component is inlined and the prop is used in a <Text> child,
//   the dynText machinery picks it up. When used as a non-text prop (e.g.,
//   a key or attribute), the template expression resolves to its Zig form.
//
//   This uses the same parseTemplateLiteral() function as p121 — the
//   resolution rules are identical. The difference is only WHERE the
//   template appears (prop value vs JSX child).

function match(c, ctx) {
  // Template literal token at current position
  return c.kind() === TK.template_literal;
}

function compile(c, ctx) {
  var raw = c.text().slice(1, -1);
  var parsed = parseTemplateLiteral(raw);
  c.advance();
  if (c.kind() === TK.rbrace) c.advance();

  if (!parsed.args || parsed.args.length === 0) {
    return { value: parsed.fmt };
  }

  return {
    fmtString: parsed.fmt,
    fmtArgs: parsed.args.join(', '),
    value: buildEval('`' + raw.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`', ctx),
  };
}

_patterns[122] = { id: 122, match: match, compile: compile };

})();
