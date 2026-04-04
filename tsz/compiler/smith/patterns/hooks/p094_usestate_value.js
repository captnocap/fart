// ── Pattern 094: useState value in JSX ──────────────────────────
// Index: 94
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const [count, setCount] = useState(0);
//   function App() {
//     return <Text>{count}</Text>;
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useState(0) → state slot with getter/setter
//   // {count} in JSX → dynamic text with slot accessor
//   //
//   // State slot declaration (in state init):
//   //   slots[0] = .{ .tag = .int, .value = .{ .int = 0 } };
//   //
//   // Dynamic text in rebuild:
//   //   _ = std.fmt.bufPrint(&_dyn_buf_0, "{d}", .{state.getSlot(0)})
//   //     catch @as([]const u8, "");
//   //   node.text = _dyn_buf_0[0..len];
//
// Notes:
//   useState is THE core state primitive. Smith's collection pass
//   (collect/state.js:collectState) handles it:
//
//   1. Parses: const [getter, setter] = useState(initialValue)
//   2. Determines type from initial value:
//      - number → int (or float if has decimal)
//      - true/false → boolean
//      - "string" → string
//      - [...] → object array (OA) — see p019+ map patterns
//      - {...} → object flat (per-field slots)
//      - new X / identifier → opaque state
//   3. Pushes to ctx.stateSlots with { getter, setter, initial, type }
//
//   In JSX, {count} resolves through findSlot(getter) → slot index.
//   The brace child parser (brace.js) detects state getters and emits
//   dynamic text nodes with:
//     - fmt string: '{d}' for int, '{d:.2}' for float, '{s}' for string
//     - fmt args: state.getSlot(N) or state.getSlotString(N)
//     - bufPrint into _dyn_buf_N
//
//   The setter (setCount) is used in event handlers (onPress, etc.)
//   and compiled to state.setSlot(N, value) calls in the handler
//   system.
//
//   See: virtually every conformance test uses useState.

function match(c, ctx) {
  // Detection: {getter} in JSX where getter is a known state slot.
  // The brace child parser checks findSlot(identifier) to determine
  // if a bare identifier is a state getter.
  return false;
}

function compile(c, ctx) {
  // Compilation:
  //   1. Collection pass creates the slot (collect/state.js)
  //   2. In JSX, findSlot(getter) returns slot index
  //   3. Brace parser emits dynamic text:
  //      - Allocates _dyn_buf_N
  //      - Creates dynText entry with fmt/args
  //      - Node gets .text = buf slice
  //   4. Rebuild pass calls bufPrint with slot accessor
  //   5. Event handlers use state.setSlot(N, value)
  return null;
}
