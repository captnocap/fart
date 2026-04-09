(function() {
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
  // Detect: const/let [getter, setter] = useState(...) / React.useState(...)
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lbracket) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.comma) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.rbracket) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();

  var isUseState = false;
  if (c.kind() === TK.identifier && c.text() === 'useState') {
    isUseState = true;
  } else if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() === TK.dot) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'useState') isUseState = true;
  }

  if (!isUseState) { c.restore(saved); return false; }
  if (c.kind() === TK.identifier) c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.restore(saved);
  return true;
}

function compile(c, ctx) {
  // Parse declaration and return a concrete hook descriptor.
  var saved = c.save();
  var out = {
    kind: 'hook_use_state',
    getter: null,
    setter: null,
    initialRaw: '0',
    source: null,
  };

  if (!(c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let'))) {
    c.restore(saved);
    return null;
  }
  c.advance();
  if (c.kind() !== TK.lbracket) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.getter = c.text();
  c.advance();
  if (c.kind() !== TK.comma) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.setter = c.text();
  c.advance();
  if (c.kind() !== TK.rbracket) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return null; }
  c.advance();

  if (c.kind() === TK.identifier && c.text() === 'React') {
    out.source = 'React.useState';
    c.advance();
    if (c.kind() === TK.dot) c.advance();
  }
  if (!(c.kind() === TK.identifier && c.text() === 'useState')) { c.restore(saved); return null; }
  if (!out.source) out.source = 'useState';
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();

  var parts = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth === 0) break;
    }
    parts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  out.initialRaw = parts.join(' ').trim() || '0';

  return out;
}

_patterns[94] = { id: 94, match: match, compile: compile };

})();
