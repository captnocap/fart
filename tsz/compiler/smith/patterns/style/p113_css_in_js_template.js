// ── Pattern 113: CSS-in-JS template literal ─────────────────────
// Index: 113
// Group: style
// Status: not_applicable
//
// Soup syntax (copy-paste React):
//   const Header = styled.div`
//     color: ${theme.primary};
//     padding: 16px;
//   `;
//   // or:
//   css`color: ${props.color}; font-size: 14px;`
//
// Mixed syntax (hybrid):
//   // Not applicable — tagged template literals for CSS are a web pattern.
//   // Mixed: use inline style objects.
//
// Zig output target:
//   // N/A — tagged template literals (styled-components, emotion css``)
//   // generate CSS at runtime via the DOM's CSSOM. No equivalent in native.
//   // The closest native equivalent is the inline style object pattern:
//   //   .{ .style = .{ .color = parseColor("#primary"), .padding = 16 } }
//
// Notes:
//   CSS-in-JS template literals (styled-components, emotion, linaria)
//   use tagged template literals to define component styles. These produce
//   CSS strings injected into the DOM — no Zig equivalent exists.
//   The lexer can tokenize template literals but doesn't handle tagged
//   templates specially. The tag function (styled.div, css) would be
//   treated as a normal expression.
//   To support this, the compiler would need:
//     1. Recognize tagged template literal syntax
//     2. Parse the CSS inside the template
//     3. Map CSS properties to Zig style struct fields
//     4. Handle dynamic interpolations (${props.color})
//   Users should convert to inline style objects.

function match(c, ctx) {
  // Tagged template literals (styled.div`...`, css`...`) are parsed as
  // normal expressions by the lexer. The tag function is treated as an
  // identifier, the template as a template literal. Neither triggers
  // special style handling — the expression falls through to qjs eval
  // or is ignored depending on context.
  return false;
}

function compile(c, children, ctx) {
  // No dedicated compile path. If used as a prop value, the tagged
  // template expression is passed to qjs eval. If used as a variable
  // assignment, it becomes a render-local evaluated at runtime.
  // The CSS string it produces has no effect — no DOM to inject into.
  return null;
}
