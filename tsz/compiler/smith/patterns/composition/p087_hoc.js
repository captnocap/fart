(function() {
// ── Pattern 087: Higher-Order Component (HOC) ──────────────────
// Index: 87
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   function withAuth(WrappedComponent) {
//     return function AuthWrapper(props) {
//       const isLoggedIn = useAuth();
//       if (!isLoggedIn) return <Login />;
//       return <WrappedComponent {...props} />;
//     };
//   }
//   const ProtectedDashboard = withAuth(Dashboard);
//   // Usage: <ProtectedDashboard />
//
// Mixed syntax (hybrid):
//   // HOCs dissolve into direct composition. The auth check becomes
//   // a wrapper component with <if>/<else>:
//   function AuthGuard({ children }) {
//     return (
//       <if not isLoggedIn>
//         <Login />
//       </if>
//       <else>
//         {children}
//       </else>
//     );
//   }
//   // Usage: <AuthGuard><Dashboard /></AuthGuard>
//
// Zig output target:
//   // The wrapper component is inlined at call site (p086).
//   // The conditional is compiled as show_hide (p081/p082).
//   // No HOC abstraction exists at compile time.
//
// Notes:
//   HOCs are a React composition pattern where a function takes a
//   component and returns a new enhanced component. Common uses:
//   withAuth, withTheme, withRouter, connect (Redux).
//
//   This pattern is NOT APPLICABLE in our compiler because:
//
//   1. Components are statically inlined, not dynamically instantiated.
//      There's no "component identity" that a HOC could wrap — the
//      compiler flattens everything at compile time.
//
//   2. The HOC pattern exists to solve React's lack of cross-cutting
//      concerns. Our flat state model + <if>/<else> blocks + wrapper
//      components (p086) provide the same capabilities directly:
//      - Auth guards → wrapper component with <if> block
//      - Theme injection → flat state slots (no context needed)
//      - Data fetching → script block + state slots
//
//   3. HOCs require runtime function composition (withX(Component))
//      which our ahead-of-time compiler cannot evaluate.
//
//   Every HOC has a direct equivalent as a wrapper component (p086)
//   with conditional logic (p081). The refactoring is mechanical.

function match(c, ctx) {
  // Detect enhancer(Component), including member helpers like React.memo(App).
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  var sawEnhancer = false;
  while (c.kind() === TK.identifier) {
    var seg = c.text();
    if (seg.length > 0 && seg.charCodeAt(0) >= 97 && seg.charCodeAt(0) <= 122) sawEnhancer = true;
    c.advance();
    if (c.kind() !== TK.dot) break;
    c.advance();
  }
  if (!sawEnhancer || c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var arg = c.text();
  c.restore(saved);
  return arg.length > 0 && arg.charCodeAt(0) >= 65 && arg.charCodeAt(0) <= 90;
}

function compile(c, children, ctx) {
  void children;
  var saved = c.save();
  if (c.kind() !== TK.identifier) return null;

  var enhancerParts = [];
  while (c.kind() === TK.identifier) {
    enhancerParts.push(c.text());
    c.advance();
    if (c.kind() !== TK.dot) break;
    enhancerParts.push('.');
    c.advance();
  }
  var enhancer = enhancerParts.join('');
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }

  c.advance(); // (
  var wrapped = null;
  if (c.kind() === TK.identifier) wrapped = c.text();

  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    else if (c.kind() === TK.rparen) depth--;
    c.advance();
  }

  var out = null;
  if (wrapped && typeof findComponent === 'function') {
    var comp = findComponent(wrapped);
    if (comp && typeof inlineComponentCall === 'function') {
      out = inlineComponentCall(c, comp, wrapped, {}, null);
    }
  }

  if (!ctx._hocHints) ctx._hocHints = [];
  var hocInfo = {
    hoc: true,
    enhancer: enhancer,
    wrapped: wrapped,
    inlined: !!out,
    loweredTo: out ? 'wrapper_component_inline' : 'composition_hint',
    fallbackAtoms: ['a006_static_node_arrays', 'a007_root_node_init', 'a036_conditional_updates'],
  };
  ctx._hocHints.push(hocInfo);

  if (out) {
    out._hocInfo = hocInfo;
    return out;
  }
  return { nodeExpr: '.{ .text = "" }', _hocInfo: hocInfo };
}

_patterns[87] = { id: 87, match: match, compile: compile };

})();
