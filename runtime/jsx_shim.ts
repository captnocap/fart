// Classic-JSX factory shim. esbuild is configured with jsxFactory: 'h' /
// jsxFragment: 'Fragment', so every .tsx file's JSX lowers to h(...) /
// <Fragment> at bundle time. This file is inject'd into every build so
// those identifiers are always in scope without an explicit import.
//
// The legacy version did `const React: any = require('react')` to
// sidestep Hermes/JSRT mishandling of esbuild's __toESM wrapper on the
// react default export. V8 (the default runtime) doesn't have that
// problem, so we use plain ESM named imports — which also stops the
// cross-file React1/React2/React3 aliasing that produced
// `TypeError: React3.memo is not a function` when enough files mixed
// `require` and `import { memo } from 'react'`.
export { createElement as h, Fragment } from 'react';
