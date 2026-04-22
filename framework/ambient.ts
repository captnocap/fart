// =============================================================================
// AMBIENT PRIMITIVES
// =============================================================================
// Every named export here becomes a globally-available identifier in every
// .tsx source under the build pipeline, via esbuild's `inject` option. A
// source file can write `useState(0)` or `<Box><Text>…</Text></Box>` with no
// imports at the top — esbuild sees the free identifier, matches it against
// an export here, and inserts the equivalent of a named import at bundle
// time. Additive: existing files with explicit imports keep working.
//
// Previously this file did `const React: any = require('react')` to work
// around Hermes/JSRT's __toESM mishandling of the react default export.
// V8 (now the default runtime) has no such issue, and the require path was
// the root cause of cross-file alias collisions (`TypeError:
// React3.memo is not a function`) once enough files mixed `require` and
// `import { memo } from 'react'`. Normal ESM named re-exports fix both.
// =============================================================================

// ── React core + hooks ──────────────────────────────────────────────────────

export {
  createElement,
  cloneElement,
  isValidElement,
  Fragment,
  Children,
  memo,
  forwardRef,
  lazy,
  Suspense,
  createContext,
  startTransition,

  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
  useReducer,
  useId,
  useImperativeHandle,
  useSyncExternalStore,
  useTransition,
  useDeferredValue,
} from 'react';

// ── Runtime primitives ──────────────────────────────────────────────────────
// Re-exported from runtime/primitives.tsx. Keep in sync with the export list
// there — esbuild's inject only matches identifiers it actually finds here,
// so anything missing silently falls through and requires a manual import.

export {
  Box,
  Row,
  Col,
  Text,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  TextArea,
  TextEditor,
  Terminal,
  terminal,
  Canvas,
  Graph,
  Render,
  Effect,
  Native,
} from '../runtime/primitives';
