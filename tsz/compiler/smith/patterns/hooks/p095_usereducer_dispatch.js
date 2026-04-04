// ── Pattern 095: useReducer dispatch ────────────────────────────
// Index: 95
// Group: hooks
// Status: stub
//
// Soup syntax (copy-paste React):
//   const reducer = (state, action) => {
//     switch (action.type) {
//       case 'increment': return { count: state.count + 1 };
//       case 'decrement': return { count: state.count - 1 };
//       default: return state;
//     }
//   };
//   const [state, dispatch] = useReducer(reducer, { count: 0 });
//
//   function App() {
//     return (
//       <Box>
//         <Text>{state.count}</Text>
//         <Pressable onPress={() => dispatch({type: 'increment'})}>
//           <Text>+</Text>
//         </Pressable>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useReducer could compile to multiple state slots (one per field)
//   // with dispatch mapped to a QuickJS eval that runs the reducer
//   // and updates slots. Alternatively, the reducer body could be
//   // analyzed and each case compiled to direct setSlot calls.
//   //
//   // Not yet implemented.
//
// Notes:
//   useReducer is syntactic sugar over useState for complex state
//   transitions. In our model, the reducer function would need to
//   be either:
//     a) Evaluated in QuickJS at runtime (dispatch calls eval)
//     b) Pattern-matched and compiled to direct slot mutations
//
//   Option (b) is preferred for performance but complex. The reducer
//   pattern is essentially a switch statement over action types, where
//   each case produces a new state object. If Smith can see all
//   dispatch call sites and all reducer cases, it could emit direct
//   setSlot calls per case.
//
//   For now, useReducer would fall back to opaque state handling
//   (collectOpaqueState), meaning the state lives in QuickJS and
//   every access goes through the bridge.
//
//   To implement properly:
//     1. Detect useReducer in collect pass
//     2. Parse initial state → per-field slots (like useState({...}))
//     3. Parse reducer body → case map
//     4. At dispatch call sites, resolve action.type → direct setSlot
//
//   The love2d reference handles this in Lua where dispatch is just
//   a function call, making it trivial.

function match(c, ctx) {
  // const [state, dispatch] = useReducer(reducer, initialState)
  return false;
}

function compile(c, ctx) {
  // Not yet implemented. Falls back to opaque state.
  return null;
}
