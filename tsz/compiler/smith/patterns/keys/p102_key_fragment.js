(function() {
// ── Pattern 102: Key on fragment ─────────────────────────────────
// Index: 102
// Group: keys
// Status: complete
//
// Soup syntax (copy-paste React):
//   <React.Fragment key={id}><A /><B /></React.Fragment>
//   <Fragment key={item.id}><Text>{item.name}</Text></Fragment>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Keys are SILENTLY DROPPED. Fragment compiles to its children
//   // flattened into the parent, same as a keyless fragment:
//   //   <A /> and <B /> become sibling nodes in the parent array.
//   // No wrapper node is emitted for the Fragment.
//
// Notes:
//   Keyed fragments exist in React to maintain identity of a group of
//   elements during reconciliation (e.g., in a map where each iteration
//   returns multiple elements wrapped in a Fragment).
//
//   In Smith, fragments (both <></> and <React.Fragment>) are transparent
//   — their children are flattened into the parent's child array. The key
//   attribute is dropped by the same mechanism as p101 (key on element).
//
//   For maps returning multiple elements per iteration, Smith uses the
//   OA (object array) system to track per-iteration data. The fragment
//   wrapper and its key are not needed.
//
//   Status is "complete" because dropping the key is the correct behavior.

function match(c, ctx) {
  // <Fragment key= or <React.Fragment key=
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip <
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var name = c.text();
  if (name === 'React') {
    c.advance(); // skip React
    if (c.kind() !== TK.dot) { c.restore(saved); return false; }
    c.advance(); // skip .
    if (c.kind() !== TK.identifier || c.text() !== 'Fragment') { c.restore(saved); return false; }
    c.advance(); // skip Fragment
  } else if (name === 'Fragment') {
    c.advance(); // skip Fragment
  } else {
    c.restore(saved); return false;
  }
  // scan attrs for key=
  while (c.pos < c.count) {
    var k = c.kind();
    if (k === TK.gt || k === TK.slash_gt || k === TK.eof) break;
    if (k === TK.identifier && c.text() === 'key') {
      if (c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.equals) {
        c.restore(saved); return true;
      }
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  void children;
  var saved = c.save();
  if (c.kind() !== TK.lt) { c.restore(saved); return null; }
  c.advance();

  var fragKind = null;
  if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() !== TK.dot) { c.restore(saved); return null; }
    c.advance();
    if (!(c.kind() === TK.identifier && c.text() === 'Fragment')) { c.restore(saved); return null; }
    c.advance();
    fragKind = 'React.Fragment';
  } else if (c.kind() === TK.identifier && c.text() === 'Fragment') {
    c.advance();
    fragKind = 'Fragment';
  } else {
    c.restore(saved);
    return null;
  }

  var keyRaw = '';
  var keyKind = 'missing';
  while (c.pos < c.count) {
    if (c.kind() === TK.gt || c.kind() === TK.slash_gt || c.kind() === TK.eof) break;
    if (c.kind() === TK.identifier && c.text() === 'key' && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.equals) {
      c.advance(); // key
      c.advance(); // =
      if (c.kind() === TK.string) {
        keyKind = 'string';
        keyRaw = c.text().slice(1, -1);
        c.advance();
      } else if (c.kind() === TK.lbrace) {
        keyKind = 'expr';
        c.advance();
        var parts = [];
        var depth = 1;
        while (c.pos < c.count && depth > 0) {
          if (c.kind() === TK.lbrace || c.kind() === TK.lparen || c.kind() === TK.lbracket) depth++;
          if (c.kind() === TK.rbrace || c.kind() === TK.rparen || c.kind() === TK.rbracket) {
            depth--;
            if (depth === 0) break;
          }
          parts.push(c.text());
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
        keyRaw = parts.join(' ').trim();
      } else if (c.kind() === TK.identifier || c.kind() === TK.number) {
        keyKind = 'bare';
        keyRaw = c.text();
        c.advance();
      }
      continue;
    }
    c.advance();
  }
  if (c.kind() === TK.gt || c.kind() === TK.slash_gt) c.advance();

  var out = {
    kind: 'key_fragment',
    fragment: fragKind,
    keyKind: keyKind,
    keyRaw: keyRaw,
    dropped: true,
    loweredTo: 'fragment_children_flattened',
    fallbackAtoms: ['a006_static_node_arrays', 'a019_map_metadata', 'a026_flat_map_rebuild'],
    mapScope: !!ctx.currentMap,
    mapItemParam: ctx.currentMap ? (ctx.currentMap.itemParam || '_item') : null,
    mapIndexParam: ctx.currentMap ? (ctx.currentMap.indexParam || '_i') : null,
  };
  if (!ctx._keyHints) ctx._keyHints = [];
  ctx._keyHints.push(out);

  c.restore(saved);
  var parsed = parseJSXElement(c);
  if (parsed && typeof parsed === 'object') parsed._keyHint = out;
  return parsed || { nodeExpr: '.{ .text = "" }', _keyHint: out };
}

_patterns[102] = { id: 102, match: match, compile: compile };

})();
