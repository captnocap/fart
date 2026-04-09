(function() {
// ── Pattern 047: String prop ───────────────────────────────────
// Index: 47
// Group: props
// Status: complete
//
// Matches: attr="value" — cursor at string token after =
// Compile: extracts string content, advances cursor, returns value
//
// React:   <Card title="hello" />
// Zig:     propValues["title"] = "hello"

function match(c, ctx) {
  return c.kind() === TK.string;
}

function compile(c, ctx) {
  // Strip quotes from string token
  var raw = c.text();
  var value = raw.slice(1, -1);
  c.advance();
  return value;
}

_patterns[47] = { id: 47, group: 'props', name: 'string_prop', match: match, compile: compile };

})();
