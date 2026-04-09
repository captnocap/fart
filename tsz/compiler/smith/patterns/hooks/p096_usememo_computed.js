(function() {
// ── Pattern 096: useMemo computed value ─────────────────────────
// Index: 96
// Group: hooks
// Status: complete
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
//   // useMemo(() => EXPR, [deps]) compiles to: const sorted = EXPR
//   // The wrapper is stripped. The inner expression becomes a render local.
//   //
//   // Scalar: const total = useMemo(() => a + b, [a, b])
//   //   → render local: total = slotGet(a) + slotGet(b)
//   //   → referenced in JSX as a normal render local
//   //
//   // Array: const sorted = useMemo(() => items.sort(...), [items])
//   //   → render local pointing to the OA (items is already an OA)
//   //   → sorted.map() triggers normal map parsing on the same OA
//   //   → or: computed OA with _computedExpr for JS-eval sort
//
// Notes:
//   useMemo memoizes a computed value in React, recomputing only when
//   dependencies change. In our compiled model, the entire tree rebuilds
//   on every state change — there is no selective recomputation. This
//   makes useMemo a pure no-op wrapper around its inner expression.
//
//   The compilation is straightforward:
//     useMemo(() => EXPR, [deps]) → EXPR
//     useMemo(() => { return EXPR; }, [deps]) → EXPR
//
//   The dependency array [deps] is discarded entirely. It exists for
//   React's reconciler to decide when to recompute. We always recompute.
//
//   Collection pass (collect/render_locals.js):
//     When collectRenderLocals encounters:
//       const X = useMemo(() => EXPR, [deps])
//     It strips the useMemo wrapper and registers X as a render local
//     with the value EXPR. This is the same path as:
//       const X = EXPR
//     The useMemo is transparent to the rest of the compiler.
//
//   For scalar results (numbers, strings, booleans):
//     The expression resolves through the normal slot/render-local
//     system. {total} in JSX becomes a dynamic text node.
//
//   For array results (.sort(), .filter(), derived arrays):
//     The expression feeds into the OA system. If it's a chained
//     pipeline (items.sort().filter()), _tryParseComputedChainMap
//     in brace.js handles it. The computed OA's _computedExpr is
//     the sort/filter JS expression, evaluated in QuickJS at runtime.
//
//   For object results ({ x: a, y: b }):
//     The expression produces an object render local. Field access
//     (sorted.x) resolves through resolve/field_access.js.
//
//   This covers every useMemo return type. The wrapper is always
//   stripped; the inner expression always compiles through existing
//   paths.

function match(c, ctx) {
  // const X = useMemo(...) / React.useMemo(...)
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();
  var isMemo = false;
  if (c.kind() === TK.identifier && c.text() === 'useMemo') {
    isMemo = true;
  } else if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() === TK.dot) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'useMemo') isMemo = true;
  }
  c.restore(saved);
  return isMemo;
}

function compile(c, ctx) {
  var saved = c.save();
  var out = {
    kind: 'hook_use_memo',
    target: null,
    computeExprRaw: '',
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
    out.source = 'React.useMemo';
    c.advance();
    if (c.kind() === TK.dot) c.advance();
  }
  if (!(c.kind() === TK.identifier && c.text() === 'useMemo')) { c.restore(saved); return null; }
  if (!out.source) out.source = 'useMemo';
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();

  var computeParts = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.comma && depth === 1) break;
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) depth--;
    computeParts.push(c.text());
    c.advance();
  }
  out.computeExprRaw = computeParts.join(' ').trim();

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

_patterns[96] = { id: 96, match: match, compile: compile };

})();
