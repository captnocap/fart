// Classic-JSX factory shim. esbuild is configured with jsxFactory: 'h' /
// jsxFragment: 'Fragment', so every .tsx file's JSX lowers to h(...) /
// <Fragment> at bundle time. This file is inject'd into every build so
// those identifiers are always in scope without an explicit import.
//
// MUST use require('react'), not ESM named imports. ESM re-exports from
// 'react' create a circular dependency in the bundle (jsx_shim → ambient →
// __toESM(require_react()) → init_jsx_shim() again) that causes
// require_react() to return a partial module at runtime in V8, producing
// 'TypeError: React3.memo is not a function'.
const React: any = require('react');
export const h = React.createElement;
export const Fragment = React.Fragment;
