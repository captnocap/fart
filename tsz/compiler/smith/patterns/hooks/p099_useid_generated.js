(function() {
// ── Pattern 099: useId generated ─────────────────────────────────
// Index: 99
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const id = useId();
//
//   function App() {
//     return (
//       <Box>
//         <Text>{id}</Text>
//         <TextInput id={id} />
//         <Text aria-describedby={id}>Help text</Text>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useId() → comptime-generated unique string render local.
//   //
//   // const id = useId()
//   //   → render local: id = "__uid_0"
//   //
//   // {id} in JSX text:
//   //   .{ .text = "__uid_0" }
//   //
//   // id={id} as prop:
//   //   Stripped or passed as string prop depending on element type.
//   //
//   // aria-describedby={id}:
//   //   Compiled as accessibility attribute with the unique string.
//
// Notes:
//   useId generates a stable unique string in React, primarily for
//   HTML id/htmlFor pairing and ARIA attributes. In our model:
//
//   - No HTML means no id/htmlFor pairing needed
//   - Node identity is positional (array index), not string-based
//   - But the unique string may be used in text display or as a
//     prop value, so we still need to generate one
//
//   Compilation: generate a comptime unique string "__uid_N" where N
//   is a monotonically increasing counter per compilation unit. This
//   is deterministic and stable across rebuilds (same source → same
//   IDs). The string is registered as a render local.

function match(c, ctx) {
  // const X = useId()
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance(); // variable name
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();
  var isUseId = false;
  if (c.kind() === TK.identifier && c.text() === 'useId') {
    isUseId = true;
  } else if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() === TK.dot) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'useId') isUseId = true;
  }
  c.restore(saved);
  return isUseId;
}

function compile(c, ctx) {
  var saved = c.save();
  var out = {
    kind: 'hook_use_id',
    varName: null,
    generated: null,
    source: null,
  };

  if (!(c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let'))) {
    c.restore(saved);
    return null;
  }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.varName = c.text();
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return null; }
  c.advance();

  if (c.kind() === TK.identifier && c.text() === 'React') {
    out.source = 'React.useId';
    c.advance();
    if (c.kind() === TK.dot) c.advance();
  }
  if (!(c.kind() === TK.identifier && c.text() === 'useId')) { c.restore(saved); return null; }
  if (!out.source) out.source = 'useId';
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() === TK.rparen) c.advance();

  if (!ctx._useIdCounter) ctx._useIdCounter = 0;
  out.generated = '__uid_' + ctx._useIdCounter;
  ctx._useIdCounter++;

  if (!ctx.renderLocals) ctx.renderLocals = {};
  ctx.renderLocals[out.varName] = '"' + out.generated + '"';

  return out;
}

_patterns[99] = { id: 99, match: match, compile: compile };

})();
