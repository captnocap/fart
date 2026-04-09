(function() {
// ── Pattern 100: Custom hook ────────────────────────────────────
// Index: 100
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   function useCounter(initial) {
//     const [count, setCount] = useState(initial);
//     const increment = () => setCount(count + 1);
//     const decrement = () => setCount(count - 1);
//     return { count, increment, decrement };
//   }
//
//   function App() {
//     const { count, increment, decrement } = useCounter(0);
//     return (
//       <Box>
//         <Text>{count}</Text>
//         <Pressable onPress={increment}><Text>+</Text></Pressable>
//         <Pressable onPress={decrement}><Text>-</Text></Pressable>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Custom hooks are inlined. useState inside → top-level slots.
//   // Returned values → render locals. Returned functions → handlers.
//   //
//   // useCounter(0) inlines to:
//   //   slots[N] = .{ .tag = .int, .value = .{ .int = 0 } };  // count
//   //   render_local: count → state.getSlot(N)
//   //   render_local: increment → () => setCount(count + 1)
//   //   render_local: decrement → () => setCount(count - 1)
//   //
//   // {count} → dynamic text: bufPrint("{d}", state.getSlot(N))
//   // onPress={increment} → handler: state.setSlot(N, state.getSlot(N) + 1)
//
// Notes:
//   Custom hooks are compile-time abstractions. They compose built-in
//   hooks (useState, useMemo, useCallback) and return derived state +
//   handlers. In our model, they are fully inlined at call sites — the
//   hook function body is expanded and its internals become top-level
//   compiler constructs.
//
//   Collection pass (collect/components.js):
//     Functions starting with "use" that contain useState are detected
//     as custom hooks. The collector:
//       1. Enters the hook function body
//       2. Collects useState calls → state slots (same as top-level)
//       3. Collects const assignments → render locals
//       4. Maps the return object's fields to the collected values
//
//   Call site resolution:
//     When const { a, b } = useMyHook(args) is encountered:
//       1. The hook function is looked up by name
//       2. Its state slots are added to the global slot array
//       3. Its render locals are merged into ctx.renderLocals
//       4. The destructured fields (a, b) are mapped to the hook's
//          return values through render local resolution
//
//   What this covers:
//     - useState inside hooks → state slots (int, float, string, bool, OA)
//     - Computed values → render locals (const x = a + b)
//     - useMemo inside hooks → stripped wrapper (pattern 096)
//     - useCallback inside hooks → stripped wrapper (pattern 097)
//     - Returned state getters → render local → slot accessor
//     - Returned state setters → handler body capture
//     - Returned functions → named handler render locals
//     - Destructured returns: { a, b } = useHook()
//     - Array returns: [a, b] = useHook()
//
//   Side effects (useEffect, useLayoutEffect):
//     These are React-specific lifecycle hooks. In our model, side
//     effects happen in <script> blocks (run once at init) or in
//     event handlers (run on user interaction). If a custom hook
//     contains useEffect, the effect body is captured and runs in
//     QuickJS at init time — equivalent to a <script> block.
//
//   Cross-file hooks:
//     Hooks defined in imported files are resolved through the
//     import system. The import resolution inlines the hook's
//     source at the call site, same as component imports.
//
//   Chad-tier equivalent:
//     Custom hooks map to module imports in chad syntax:
//       import { counter } from './counter.mod'
//     The module's <state> block defines slots; <functions> block
//     defines handlers. Same compilation, different surface syntax.

function match(c, ctx) {
  // const { ... } = useCustomHook(args)
  // Detection: destructured const assignment where RHS starts with
  // 'use' prefix (React convention) and resolves to a function in
  // the same file (or imported) that contains useState.
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  // Skip destructured pattern { ... } or [ ... ]
  if (c.kind() !== TK.lbrace && c.kind() !== TK.lbracket) {
    // Could also be: const result = useHook()
    if (c.kind() === TK.identifier) c.advance();
    else { c.restore(saved); return false; }
  } else {
    var depth = 1;
    c.advance();
    while (c.pos < c.count && depth > 0) {
      if (c.kind() === TK.lbrace || c.kind() === TK.lbracket) depth++;
      if (c.kind() === TK.rbrace || c.kind() === TK.rbracket) depth--;
      if (depth > 0) c.advance();
    }
    if (depth === 0) c.advance();
  }
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();
  var isHook = c.kind() === TK.identifier && c.text().startsWith('use') && c.text().length > 3;
  c.restore(saved);
  return isHook;
}

function compile(c, ctx) {
  var saved = c.save();
  var out = {
    kind: 'hook_custom',
    hookName: null,
    bindingKind: null, // object | array | identifier
    bindings: [],
    argsRaw: '',
  };

  if (!(c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let'))) {
    c.restore(saved);
    return null;
  }
  c.advance();

  if (c.kind() === TK.lbrace) {
    out.bindingKind = 'object';
    c.advance();
    while (c.pos < c.count && c.kind() !== TK.rbrace) {
      if (c.kind() === TK.identifier) out.bindings.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
  } else if (c.kind() === TK.lbracket) {
    out.bindingKind = 'array';
    c.advance();
    while (c.pos < c.count && c.kind() !== TK.rbracket) {
      if (c.kind() === TK.identifier) out.bindings.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbracket) c.advance();
  } else if (c.kind() === TK.identifier) {
    out.bindingKind = 'identifier';
    out.bindings.push(c.text());
    c.advance();
  } else {
    c.restore(saved);
    return null;
  }

  if (c.kind() !== TK.equals) { c.restore(saved); return null; }
  c.advance();
  if (!(c.kind() === TK.identifier && c.text().startsWith('use') && c.text().length > 3)) {
    c.restore(saved);
    return null;
  }
  out.hookName = c.text();
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();

  var args = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth === 0) break;
    }
    args.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  out.argsRaw = args.join(' ').trim();

  if (!ctx._customHookCalls) ctx._customHookCalls = [];
  ctx._customHookCalls.push(out);

  return out;
}

_patterns[100] = { id: 100, match: match, compile: compile };

})();
