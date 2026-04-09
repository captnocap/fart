(function() {
// ── Pattern 075: Dynamic component variable ──────────────────────
// Index: 75
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   const C = components[type];
//   <C />
//   const Element = condition ? Box : Text;
//   <Element>content</Element>
//
// Mixed syntax (hybrid):
//   // Limited support — prefer explicit component selection
//   const C = type === 'box' ? Box : Text;
//   <C />
//
// Zig output target:
//   // Dynamic components compile to runtime dispatch
//   // If component is known at compile time (inlineable):
//   .{
//     // direct component output
//   }
//   // If component determined at runtime:
//   .{
//     .tag = .Dynamic,
//     .props = .{ .component_id = _resolveComponentId(C) },
//   }
//
// Notes:
//   When a variable (not literal) is used as JSX tag: <Component />.
//   The variable's value determines which component renders.
//
//   For static analysis:
//     - If variable is a known import or local binding, treat as p073
//     - If variable is computed (function result, array access), error
//
//   The compiler limits dynamic components to cases where the set of
//   possible components is known at compile time. True runtime dynamic
//   components require a component registry and dynamic dispatch.
//
//   Implemented in parse.js → parseJSXElement() which checks if the
//   tag name resolves to a known component. If not, it attempts to
//   trace the variable definition or falls back to error.

function match(c, ctx) {
  // Dynamic variable component: uppercase identifier NOT in the static
  // component registry. p073 handles known components; this handles
  // the case where the tag is a variable holding a component reference.
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  var name = c.textAt(c.pos + 1);
  var ch = name.charCodeAt(0);
  if (ch < 65 || ch > 90) return false;
  // Dot notation is p074
  if (c.pos + 2 < c.count && c.kindAt(c.pos + 2) === TK.dot) return false;
  // Check if NOT a known component — that's p073's territory
  if (typeof findComponent === 'function') {
    var comp = findComponent(name);
    if (comp) return false;
  }
  return true;
}

function compile(c, ctx) {
  // Delegate to parseJSXElement which handles unknown uppercase tags
  // by tracing the variable binding or emitting a placeholder.
  return parseJSXElement(c);
}

_patterns[75] = {
  id: 75,
  name: 'dynamic_variable',
  status: 'complete',
  match,
  compile,
};

})();
