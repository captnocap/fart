(function() {
// ── Pattern 092: Error boundary ─────────────────────────────────
// Index: 92
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   // Definition (class component):
//   class ErrorBoundary extends React.Component {
//     constructor(props) {
//       super(props);
//       this.state = { hasError: false };
//     }
//     static getDerivedStateFromError(error) {
//       return { hasError: true };
//     }
//     componentDidCatch(error, info) {
//       logErrorToService(error, info);
//     }
//     render() {
//       if (this.state.hasError) return <FallbackUI />;
//       return this.props.children;
//     }
//   }
//
//   // Usage:
//   <ErrorBoundary fallback={<Text>Something went wrong</Text>}>
//     <MyApp />
//   </ErrorBoundary>
//
// Mixed syntax (hybrid):
//   Same as soup — error boundaries are class-only in React.
//
// Zig output target:
//   // Error boundary usage compiles as a passthrough wrapper.
//   // <ErrorBoundary><MyApp /></ErrorBoundary>
//   //   → compiles as: <MyApp />  (children rendered directly)
//   //
//   // The fallback prop is compiled but wired to the framework's
//   // crash handler rather than to React error catching.
//   //
//   // For the children:
//   // .{ .style = .{ ... }, .children = &_arr_0 }  // MyApp inlined
//
// Notes:
//   Error boundaries catch JS exceptions during React rendering.
//   In our compiled model, rendering is deterministic Zig — it doesn't
//   throw. Runtime panics (OOB, null deref) are caught by the
//   framework's crash handler (framework/crash.zig) which renders
//   a BSOD screen.
//
//   Compilation strategy:
//   - Class definition: skip entirely (class components not supported)
//   - Usage as JSX wrapper: compile as passthrough, render children
//   - Fallback prop: compile and wire to crash handler's fallback UI
//
//   The crash handler already provides error recovery UI. An error
//   boundary in soup code maps to: "if the app panics, show this
//   fallback" — which is exactly what the crash handler does.

function match(c, ctx) {
  // Case 1: class ErrorBoundary extends ...
  if (c.kind() === TK.identifier && c.text() === 'class') {
    var savedClass = c.save();
    c.advance();
    if (c.kind() === TK.identifier) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'extends') {
      c.restore(savedClass);
      return true;
    }
    c.restore(savedClass);
  }

  // Case 2: JSX usage <ErrorBoundary ...>
  if (c.kind() === TK.lt &&
      c.pos + 1 < c.count &&
      c.kindAt(c.pos + 1) === TK.identifier &&
      c.textAt(c.pos + 1) === 'ErrorBoundary') {
    return true;
  }

  return false;
}

function compile(c, ctx) {
  if (c.kind() === TK.identifier && c.text() === 'class') {
    c.advance(); // class
    var className = null;
    if (c.kind() === TK.identifier) {
      className = c.text();
      c.advance();
    }
    while (c.pos < c.count && c.kind() !== TK.lbrace && c.kind() !== TK.eof) c.advance();
    if (c.kind() !== TK.lbrace) return { errorBoundaryClass: className, skipped: true };
    c.advance(); // {
    var depth = 1;
    while (c.pos < c.count && depth > 0) {
      if (c.kind() === TK.lbrace) depth++;
      else if (c.kind() === TK.rbrace) depth--;
      c.advance();
    }
    return { errorBoundaryClass: className, skipped: true };
  }

  if (c.kind() === TK.lt) {
    return parseJSXElement(c);
  }

  return { errorBoundary: true };
}

_patterns[92] = { id: 92, match: match, compile: compile };

})();
