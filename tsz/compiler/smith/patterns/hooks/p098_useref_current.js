// ── Pattern 098: useRef current ─────────────────────────────────
// Index: 98
// Group: hooks
// Status: not_applicable
//
// Soup syntax (copy-paste React):
//   const inputRef = useRef(null);
//
//   function App() {
//     return (
//       <Box>
//         <TextInput ref={inputRef} />
//         <Pressable onPress={() => inputRef.current.focus()}>
//           <Text>Focus</Text>
//         </Pressable>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   N/A — refs have no direct equivalent in compiled output.
//
// Notes:
//   useRef serves two purposes in React:
//     1. DOM element reference (ref={inputRef}) for imperative access
//     2. Mutable value that persists across renders without triggering
//        re-render (unlike useState)
//
//   In our compiled model:
//
//   For DOM references:
//     - There is no DOM. Nodes are Zig structs in static arrays.
//     - Imperative access (focus, scroll, measure) is handled by
//       the framework directly via node indices, not refs.
//     - TextInput focus is managed by the input system
//       (framework/input.zig), not by ref.current.focus().
//
//   For mutable values:
//     - A non-rendering mutable value is just a Zig var.
//     - If the value is used in render output, it's a state slot.
//     - If it's used only in handlers, it's a script-scope variable
//       in QuickJS or LuaJIT.
//
//   If useRef is encountered, Smith should:
//     - For ref={X}: strip the ref prop (no-op in our model)
//     - For X.current in expressions: treat as opaque JS eval
//     - For mutable value: treat as render local or script var

function match(c, ctx) {
  // const X = useRef(initialValue)
  // Detection: useRef identifier in useState-like destructuring position.
  // But useRef returns { current: value }, not [getter, setter].
  return false;
}

function compile(c, ctx) {
  // Not applicable in the compiled model.
  // ref props are stripped. .current access goes through JS eval.
  return null;
}
