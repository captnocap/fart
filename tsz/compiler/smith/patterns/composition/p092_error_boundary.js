// ── Pattern 092: Error boundary ─────────────────────────────────
// Index: 92
// Group: composition
// Status: not_applicable
//
// Soup syntax (copy-paste React):
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
// Mixed syntax (hybrid):
//   Same as soup — error boundaries are class-only in React.
//
// Zig output target:
//   N/A — no runtime exceptions in compiled Zig output.
//
// Notes:
//   Error boundaries are a React-specific pattern for catching
//   JavaScript runtime errors during rendering. They exist because
//   React's reconciler can fail mid-render if a component throws.
//
//   In our compiled model:
//     - There is no reconciler. The tree is built statically.
//     - Zig does not have exceptions. Errors are explicit (error unions).
//     - Runtime errors (OOB, null deref) are @panic, not catchable.
//     - The framework has its own crash handler (framework/crash.zig)
//       that catches Zig panics and renders a BSOD.
//
//   Error boundaries are fundamentally incompatible with ahead-of-time
//   compilation. The concept of "catch a render error and show fallback
//   UI" doesn't apply when rendering is deterministic compiled code.
//
//   If class syntax with componentDidCatch is encountered, Smith should
//   warn and skip the class definition. Class components are not
//   supported — only function components.

function match(c, ctx) {
  // class X extends React.Component { ... componentDidCatch ... }
  // Detection: class keyword → not supported in Smith.
  return false;
}

function compile(c, ctx) {
  // Not applicable. Class components are not supported.
  // The crash handler (framework/crash.zig) handles runtime panics.
  return null;
}
