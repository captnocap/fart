(function() {
// ── Pattern 097: useCallback handler ────────────────────────────
// Index: 97
// Group: hooks
// Status: complete
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
//   // useCallback is a no-op. The inner function IS the handler.
//   //
//   // const handlePress = useCallback(() => { setCount(count + 1) }, [count])
//   //   compiles identically to:
//   // const handlePress = () => { setCount(count + 1) }
//   //
//   // onPress={handlePress} resolves to the handler body:
//   //   handler_0: "setCount(count + 1)"
//   //   → state.setSlot(0, state.getSlot(0) + 1) in Zig
//   //   or QuickJS eval for complex expressions
//
// Notes:
//   useCallback exists in React to stabilize function references
//   across re-renders. When a parent passes onPress={fn} to a child,
//   React uses referential equality to decide whether the child needs
//   to re-render. useCallback ensures fn is the same object unless
//   deps change.
//
//   In our compiled model, this concept is meaningless:
//     - There is no reconciler. No referential equality checks.
//     - The tree is rebuilt from scratch on every state change.
//     - Handlers are compiled to static function pointers or eval
//       strings — their "identity" is a compile-time constant.
//     - Passing the same handler to a child component costs nothing.
//
//   Compilation:
//     useCallback(fn, [deps]) → fn
//
//     The wrapper is stripped. The dependency array is discarded.
//     The inner function becomes a render local.
//
//   Collection pass (collect/render_locals.js):
//     When collectRenderLocals encounters:
//       const X = useCallback(() => { body }, [deps])
//     It strips useCallback and registers X as a render local
//     whose value is the function expression () => { body }.
//
//   Handler resolution (attrs_handlers.js):
//     When onPress={handlePress} is encountered, the attr parser
//     looks up handlePress in render locals. If it resolves to a
//     function expression, the function body is extracted and
//     compiled as the handler. This produces the same output as
//     onPress={() => { body }}.
//
//   This is complete because:
//     - Inline handlers (onPress={() => ...}) are fully supported
//     - Named handler references resolve through render locals
//     - useCallback is transparently stripped
//     - The dependency array is irrelevant in our model

function match(c, ctx) {
  // const X = useCallback(...) / React.useCallback(...)
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();
  var isCb = false;
  if (c.kind() === TK.identifier && c.text() === 'useCallback') {
    isCb = true;
  } else if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() === TK.dot) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'useCallback') isCb = true;
  }
  c.restore(saved);
  return isCb;
}

function compile(c, ctx) {
  var saved = c.save();
  var out = {
    kind: 'hook_use_callback',
    target: null,
    callbackExprRaw: '',
    depsRaw: '',
    source: null,
  };

  if (!(c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let'))) {
    c.restore(saved);
    return null;
  }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.target = c.text();
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return null; }
  c.advance();

  if (c.kind() === TK.identifier && c.text() === 'React') {
    out.source = 'React.useCallback';
    c.advance();
    if (c.kind() === TK.dot) c.advance();
  }
  if (!(c.kind() === TK.identifier && c.text() === 'useCallback')) { c.restore(saved); return null; }
  if (!out.source) out.source = 'useCallback';
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();

  var cbParts = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.comma && depth === 1) break;
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) depth--;
    cbParts.push(c.text());
    c.advance();
  }
  out.callbackExprRaw = cbParts.join(' ').trim();

  if (c.kind() === TK.comma) c.advance();
  var depsParts = [];
  depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth === 0) break;
    }
    depsParts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  out.depsRaw = depsParts.join(' ').trim();

  return out;
}

_patterns[97] = { id: 97, match: match, compile: compile };

})();
