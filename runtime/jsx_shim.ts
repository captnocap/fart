// Classic-JSX factory shim. esbuild is configured with jsxFactory: 'h' /
// jsxFragment: 'Fragment', so every .tsx file's JSX lowers to h(...) /
// <Fragment> at bundle time. This file is inject'd into every build so
// those identifiers are always in scope without an explicit import.
//
// MUST use lazy require('react') wrappers, not top-level capture.
// esbuild's inject can place this file's init function inside react/index.js's
// own CJS body. At that moment require('react') returns the partial {}
// module. Capturing React.createElement / React.Fragment at init time stores
// undefined forever. Deferring to JSX execution time (after react finishes
// its body) resolves to the real React.

export const h = function h(...a: any[]) {
  return (require('react') as any).createElement(...a);
};

// Fragment must be the actual well-known Symbol so React.createElement's
// identity check (type === REACT_FRAGMENT_TYPE) succeeds. Symbol.for is
// safe because it does not depend on the React module being loaded.
export const Fragment: any = Symbol.for('react.fragment');
