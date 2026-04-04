// ── Pattern 100: Custom hook ────────────────────────────────────
// Index: 100
// Group: hooks
// Status: partial
//
// Soup syntax (copy-paste React):
//   function useApi(url) {
//     const [data, setData] = useState(null);
//     const [loading, setLoading] = useState(true);
//     useEffect(() => {
//       fetch(url).then(r => r.json()).then(d => {
//         setData(d);
//         setLoading(false);
//       });
//     }, [url]);
//     return { data, loading };
//   }
//
//   function App() {
//     const { data, loading } = useApi('/api/items');
//     return (
//       <Box>
//         {loading ? <Text>Loading...</Text> : <Text>{data.name}</Text>}
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Custom hooks are inlined at call sites. The useState calls
//   // inside the hook become top-level state slots. The returned
//   // values become render locals.
//   //
//   // For the example above:
//   //   slots[N]   = data  (string, initially "")
//   //   slots[N+1] = loading (boolean, initially true)
//   //   render_local: data → getSlotString(N)
//   //   render_local: loading → getSlotBool(N+1)
//
// Notes:
//   Custom hooks are functions that compose built-in hooks. In React,
//   they follow the "rules of hooks" (top-level only, consistent
//   call order). In our model, custom hooks are compile-time
//   abstractions that get inlined.
//
//   Current support (partial):
//     - Smith's component collection (collect/components.js) detects
//       function definitions that contain useState calls
//     - The hook's state slots are collected as if they were at the
//       top level (the hook is inlined into the calling component)
//     - The returned destructured values become render locals
//
//   What works:
//     - Custom hooks that wrap useState and return state values
//     - Destructured returns: const { data, loading } = useCustomHook()
//     - State updates from within the hook's returned setters
//
//   What doesn't work yet:
//     - useEffect/useLayoutEffect inside custom hooks (side effects
//       need the <script> block or event handlers, not hooks)
//     - Hooks that return functions (need named handler registration)
//     - Hooks imported from other files (cross-file inlining)
//     - Conditional hook calls (already illegal in React too)
//
//   The chad-tier approach replaces custom hooks with module imports
//   and <script> blocks. useFetch → import { http } from 'net',
//   <script>http.get(url)</script>.

function match(c, ctx) {
  // const { ... } = useCustomHook(args) where useCustomHook is
  // a function defined in the same file containing useState calls.
  return false;
}

function compile(c, ctx) {
  // Partial implementation:
  //   1. Hook function body is inlined at call site
  //   2. useState calls inside become top-level state slots
  //   3. Returned values mapped to render locals
  //   4. Side effects (useEffect) not yet supported — use <script>
  return null;
}
