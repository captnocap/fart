// ── Pattern 097: useCallback handler ────────────────────────────
// Index: 97
// Group: hooks
// Status: stub
//
// Soup syntax (copy-paste React):
//   const handlePress = useCallback(() => {
//     setCount(count + 1);
//   }, [count]);
//
//   function App() {
//     return (
//       <Pressable onPress={handlePress}>
//         <Text>Press me</Text>
//       </Pressable>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useCallback is identity in our model — the handler is the
//   // function body. No memoization needed (no reconciler diffing).
//   //
//   // onPress={handlePress} where handlePress = useCallback(fn, deps)
//   // compiles identically to onPress={() => { ... }}
//   //
//   // Not yet implemented as a separate collection path.
//
// Notes:
//   useCallback memoizes a function reference to prevent unnecessary
//   re-renders of child components that receive the callback as a
//   prop. In React, referential equality of props determines whether
//   a child re-renders.
//
//   In our compiled model:
//     - There is no re-rendering optimization. The tree rebuilds fully.
//     - Function identity is irrelevant — handlers are compiled to
//       Zig function pointers or inline handler bodies.
//     - useCallback is a no-op wrapper.
//
//   To implement:
//     1. Detect useCallback in collect pass
//     2. Strip wrapper: useCallback(fn, [deps]) → fn
//     3. Register the function as a named handler
//     4. When referenced in onPress={name}, resolve to the handler body
//     5. Discard dependency array
//
//   Currently, inline arrow handlers (onPress={() => ...}) are fully
//   supported. Named handler references (onPress={handlePress}) work
//   when the handler is a render local pointing to a function expression.

function match(c, ctx) {
  // const X = useCallback(() => { ... }, [deps])
  return false;
}

function compile(c, ctx) {
  // Not yet implemented. Would strip useCallback wrapper and
  // register the inner function as a named handler.
  return null;
}
