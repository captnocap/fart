// ── Pattern 091: Portal ─────────────────────────────────────────
// Index: 91
// Group: composition
// Status: not_applicable
//
// Soup syntax (copy-paste React):
//   {createPortal(
//     <Modal><Text>Content</Text></Modal>,
//     document.body
//   )}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   N/A — portals have no direct equivalent in this compilation model.
//
// Notes:
//   React portals (createPortal) render children into a DOM node that
//   exists outside the parent component's DOM hierarchy. This is used
//   for modals, tooltips, and overlays that need to break out of
//   parent overflow:hidden or z-index stacking contexts.
//
//   In our compiled model, there is no DOM. The layout engine is a
//   single tree with absolute positioning, z-index, and overflow
//   control. Modals and overlays are achieved by:
//     1. Placing the overlay element at the root level of the tree
//     2. Using position: 'absolute' with zIndex
//     3. Toggling display: .none / .flex via a boolean slot
//
//   The framework's window system (framework/windows.zig) provides
//   independent rendering surfaces for true window-level separation.
//
//   If portal-like syntax is encountered, Smith should either:
//     - Warn and compile the children as a normal subtree
//     - Or treat it as a no-op wrapper (render children in place)
//
//   The document.body target argument is meaningless in our model
//   and would be discarded.

function match(c, ctx) {
  // createPortal( ... , target )
  // Detection: identifier 'createPortal' followed by (
  return false;
}

function compile(c, ctx) {
  // Not applicable. If encountered, compile children in place
  // and discard the portal target argument.
  return null;
}
