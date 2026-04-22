// =============================================================================
// AMBIENT PRIMITIVES — Phase 1
// =============================================================================
// Every named export in this file becomes a globally-available identifier in
// every .tsx source under the build pipeline, via esbuild's `inject` option.
// A source file can write `useState(0)` or `<Box><Text>…</Text></Box>` with no
// imports at the top — esbuild sees the free identifier, matches it against an
// export here, and inserts the equivalent of a named import at bundle time.
//
// This file is additive. Existing .tsx files that explicitly
// `import { Box } from '../../runtime/primitives'` continue to work unchanged;
// esbuild only injects for identifiers that are *free* in the source.
// =============================================================================

// Direct CJS require matches the pattern in runtime/jsx_shim.ts — bypasses
// esbuild's __toESM wrapping which Hermes/JSRT mis-handles on the react
// default export path.
const React: any = require('react');

// ── React core + hooks ───────────────────────────────────────────────────────

export const createElement    = React.createElement;
export const cloneElement     = React.cloneElement;
export const isValidElement   = React.isValidElement;
export const Fragment         = React.Fragment;

export const useState         = React.useState;
export const useEffect        = React.useEffect;
export const useLayoutEffect  = React.useLayoutEffect;
export const useCallback      = React.useCallback;
export const useMemo          = React.useMemo;
export const useRef           = React.useRef;
export const useContext       = React.useContext;
export const useReducer       = React.useReducer;
export const useId            = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useTransition    = React.useTransition;
export const useDeferredValue = React.useDeferredValue;

export const createContext    = React.createContext;
export const memo             = React.memo;
export const forwardRef       = React.forwardRef;

// ── Runtime primitives ──────────────────────────────────────────────────────
// Re-exported from runtime/primitives.tsx. Keep this list in sync with the
// export list there; esbuild's inject only matches identifiers it actually
// finds here, so missing ones silently fall through and require a manual
// import in the source file.

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
