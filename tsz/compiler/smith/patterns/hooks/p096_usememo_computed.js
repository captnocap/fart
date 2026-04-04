// ── Pattern 096: useMemo computed value ─────────────────────────
// Index: 96
// Group: hooks
// Status: stub
//
// Soup syntax (copy-paste React):
//   const sorted = useMemo(() => {
//     return items.sort((a, b) => a.score - b.score);
//   }, [items]);
//
//   function App() {
//     return (
//       <Box>
//         {sorted.map(item => <Text>{item.name}</Text>)}
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useMemo with array result → render local pointing to sorted OA
//   // useMemo with scalar result → render local with eval expression
//   // The dependency array is irrelevant — we rebuild every frame.
//   //
//   // Not yet implemented.
//
// Notes:
//   useMemo memoizes a computed value, recomputing only when deps
//   change. In our model, the entire node tree is rebuilt on every
//   state change, so memoization semantics are different:
//
//   For scalar values (useMemo(() => a + b, [a, b])):
//     - Could compile to a render local: const sorted = a + b
//     - The dependency array is irrelevant (always recomputed)
//     - Equivalent to a const binding in the function body
//
//   For array values (useMemo(() => items.sort(...), [items])):
//     - The sort/filter/map result is already handled by the OA
//       system and chained pipeline parsing
//     - useMemo is just a wrapper around an expression we already
//       know how to compile
//
//   To implement:
//     1. Detect useMemo in collect pass (similar to render locals)
//     2. Strip the wrapper: useMemo(() => EXPR, [deps]) → EXPR
//     3. Register result as a render local
//     4. Discard dependency array
//
//   The love2d reference doesn't have useMemo — compute blocks
//   handle derived values directly.

function match(c, ctx) {
  // const X = useMemo(() => expr, [deps])
  return false;
}

function compile(c, ctx) {
  // Not yet implemented. Would strip useMemo wrapper and
  // register the inner expression as a render local.
  return null;
}
