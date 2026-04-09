(function() {
// ── Pattern 101: Key on element ─────────────────────────────────
// Index: 101
// Group: keys
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box key={item.id} />
//   <ListItem key={`item-${id}`} />
//   <Card key={card.uuid} style={{padding: 8}} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Keys are SILENTLY DROPPED. No Zig output.
//   // The key attribute is skipped during prop parsing:
//   //   if (propName === 'key') continue;
//   // The element compiles as if key were not present:
//   nodes._arr_0[0] = .{ .style = .{ .padding = 8 } };
//
// Notes:
//   Implemented in soup.js line 231:
//     if (propName === 'style' || propName === 'key' || propName === 'className') continue;
//
//   Keys are a React reconciliation concept — they tell the virtual DOM
//   diffing algorithm how to match elements across re-renders. Smith
//   compiles to a static Zig node tree with no virtual DOM and no diffing.
//   Re-renders are handled by direct slot updates (state.setSlot) and
//   map rebuilds (_rebuildMap), not by tree reconciliation.
//
//   Therefore keys serve no purpose in the compiled output and are
//   correctly dropped. This is not a missing feature — it's an intentional
//   design decision because the runtime model doesn't need them.
//
//   The key value expression (item.id, template literal, etc.) may still
//   appear in the OA field list if it's referenced elsewhere in the map
//   body (e.g., as a prop or text child).
//
//   Status is "complete" because the behavior (drop silently) is correct
//   and intentional for this compiler's architecture.

function match(c, ctx) {
  if (c.kind() !== TK.identifier || c.text() !== 'key') return false;
  return c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.equals;
}

function compile(c, ctx) {
  var saved = c.save();
  if (!(c.kind() === TK.identifier && c.text() === 'key')) {
    c.restore(saved);
    return null;
  }
  c.advance(); // key
  if (c.kind() !== TK.equals) {
    c.restore(saved);
    return null;
  }
  c.advance(); // =

  var valueKind = 'bare';
  var valueRaw = '';
  if (c.kind() === TK.string) {
    valueKind = 'string';
    valueRaw = c.text().slice(1, -1);
    c.advance();
  } else if (c.kind() === TK.lbrace) {
    valueKind = 'expr';
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
    valueRaw = parts.join(' ').trim();
  } else if (c.kind() === TK.identifier || c.kind() === TK.number) {
    valueRaw = c.text();
    c.advance();
  }

  var keyInfo = {
    kind: 'key_element',
    valueKind: valueKind,
    valueRaw: valueRaw,
    dropped: true,
    mapScope: !!ctx.currentMap,
    mapItemParam: ctx.currentMap ? (ctx.currentMap.itemParam || '_item') : null,
    mapIndexParam: ctx.currentMap ? (ctx.currentMap.indexParam || '_i') : null,
  };
  if (!ctx._keyHints) ctx._keyHints = [];
  ctx._keyHints.push(keyInfo);
  return keyInfo;
}

_patterns[101] = { id: 101, match: match, compile: compile };

})();
