(function() {
// ── Pattern 098: useRef current ─────────────────────────────────
// Index: 98
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const inputRef = useRef(null);
//   const counterRef = useRef(0);
//
//   function App() {
//     return (
//       <Box>
//         <TextInput ref={inputRef} />
//         <Pressable onPress={() => inputRef.current.focus()}>
//           <Text>Focus</Text>
//         </Pressable>
//         <Text>{counterRef.current}</Text>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useRef(initialValue) → opaque state in QuickJS.
//   // The ref object { current: value } lives in JS runtime.
//   //
//   // For ref={inputRef} on elements:
//   //   The ref prop is stripped from the node. The framework's
//   //   input system manages focus via node indices directly.
//   //
//   // For counterRef.current in JSX text:
//   //   Compiled as a QuickJS eval: qjs_eval("counterRef.current")
//   //   → dynamic text with bridge call
//   //
//   // For counterRef.current in handlers:
//   //   The handler body runs in QuickJS where the ref object exists.
//   //   counterRef.current = 5 → direct JS assignment.
//
// Notes:
//   useRef serves two purposes in React:
//     1. DOM element reference (ref={inputRef}) for imperative access
//     2. Mutable value that persists without triggering re-render
//
//   In our compiled model, both map to existing mechanisms:
//
//   DOM references:
//     Nodes are Zig structs in static arrays, accessed by index.
//     The framework manages focus, scroll, and measure via node
//     indices. The ref prop on elements is stripped — it's a no-op
//     because there's no DOM node to capture.
//
//   Mutable values:
//     The ref object { current: value } is held in QuickJS as opaque
//     state. Reads go through the bridge (qjs eval). Writes in
//     handlers execute directly in QuickJS. This is identical to
//     how any non-slot JS value is handled.

function match(c, ctx) {
  // const X = useRef(initialValue)
  // Note: useRef uses const X = pattern, NOT [getter, setter] =
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();
  var isRef = false;
  if (c.kind() === TK.identifier && c.text() === 'useRef') {
    isRef = true;
  } else if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() === TK.dot) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'useRef') isRef = true;
  }
  c.restore(saved);
  return isRef;
}

function compile(c, ctx) {
  var saved = c.save();
  var out = {
    kind: 'hook_use_ref',
    refName: null,
    initialRaw: 'null',
    source: null,
  };

  if (!(c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let'))) {
    c.restore(saved);
    return null;
  }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.refName = c.text();
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return null; }
  c.advance();

  if (c.kind() === TK.identifier && c.text() === 'React') {
    out.source = 'React.useRef';
    c.advance();
    if (c.kind() === TK.dot) c.advance();
  }
  if (!(c.kind() === TK.identifier && c.text() === 'useRef')) { c.restore(saved); return null; }
  if (!out.source) out.source = 'useRef';
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();

  var initialParts = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth === 0) break;
    }
    initialParts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  out.initialRaw = initialParts.join(' ').trim() || 'null';

  // Bridge ref object through opaque state marker.
  registerOpaqueStateMarker(out.refName, null);
  if (!ctx._refInitials) ctx._refInitials = {};
  ctx._refInitials[out.refName] = out.initialRaw;

  return out;
}

_patterns[98] = { id: 98, match: match, compile: compile };

})();
