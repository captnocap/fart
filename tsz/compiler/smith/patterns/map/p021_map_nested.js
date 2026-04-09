(function() {
// ── Pattern 021: nested .map() ─────────────────────────────────
// Index: 21
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {groups.map((group, gi) => (
//     <Box>
//       <Text>{group.name}</Text>
//       {group.items.map((item, ii) => (
//         <Text key={ii}>{item.label}</Text>
//       ))}
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Outer map: for (0.._oa0_len) |_i| { ... }
//   // Inner map: nested pool with per-outer-item child arrays
//   //   _map_pool_1[_i][_j] = .{ .text = _oa1_label[...] };
//   //   _map_count_1[_i] = inner_count;
//
// Notes:
//   The inner map creates a nested OA. Smith detects nested_array fields
//   on the parent OA and creates a child OA with its own oaIdx. The inner
//   map's pool is 2D: [MAX_NESTED_OUTER][MAX_MAP] — outer dimension is
//   the parent map's iteration count.
//
//   tryParseNestedMap() in parse/map/nested.js handles this. It calls
//   tryParseMapHeader with '_j' as the default index param, sets
//   isNested=true and parentMapIdx/parentOaIdx on the mapInfo.
//
//   The love2d reference (tslx_compile.mjs:930-940) builds inner_children
//   inline with a nested for loop. Smith's Zig equivalent uses static 2D
//   arrays (_map_pool_N) indexed by [outer_i][inner_j].
//
//   Key interaction: inner map items that reference outer map fields
//   (e.g. gi in the template literal) need the outer iterator variable
//   available in scope. The emit pass handles this via _parentMi on the
//   nested map's mapInfo.
//
//   See conformance: d01_nested_maps.tsz, d56_multiple_maps_nested.tsz,
//   d109_map_in_ternary_in_map.tsz, d112_triple_nested_component_map.tsz,
//   d141_log_selector_nested_map.tsz, d145_elicitation_nested_map.tsz

function match(c, ctx) {
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    if (c.kind() === TK.identifier && c.text() === 'map') {
      c.advance(); // skip 'map'
      if (c.kind() === TK.lparen) { c.restore(saved); return true; }
    }
    if (c.kind() !== TK.identifier) break;
    c.advance(); // skip field name
  }
  c.restore(saved);
  return false;
}

function compile(c, children) {
  // Nested maps (item.field.map inside a parent .map) are dispatched
  // through _tryParseIdentifierMapExpression which detects nested OA
  // fields and calls tryParseNestedMap() in parse/map/nested.js.
  return _tryParseIdentifierMapExpression(c, children, false);
}

_patterns[21] = { id: 21, match: match, compile: compile };

})();
