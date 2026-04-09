(function() {
// ── Pattern 077: React.createElement ─────────────────────────────
// Index: 77
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   React.createElement('div', { className: 'box' }, 'content')
//   React.createElement(MyComponent, props, children)
//   createElement(Box, { style: { padding: 8 } })
//
// Mixed syntax (hybrid):
//   // Rare in mixed - prefer JSX syntax
//   createElement('div', { className: 'box' })
//
// Zig output target:
//   // Transformed to equivalent JSX compilation
//   .{
//     .tag = .Box,
//     .props = .{ .class_name = "box" },
//     .sub_nodes = &[_]Node{
//       .{ .text = "content" },
//     },
//   }
//
// Notes:
//   React.createElement is the underlying JSX primitive. Some codebases
//   use it directly for dynamic tag types or programmatic construction.
//
//   Arguments: (type, props, ...children)
//     - type: string (HTML tag), component function, or fragment symbol
//     - props: object or null
//     - children: rest arguments (strings, numbers, elements, arrays)
//
//   The compiler transforms createElement calls to their JSX equivalents:
//     - String type → native element (div → Box, span → Text)
//     - Component type → component reference
//     - Props → attributes/style
//     - Children arguments → child nodes
//
//   Implemented in soup.js → tryParseCreateElement() which desugars
//   the call to equivalent JSX and delegates to parseJSXElement().

function match(c, ctx) {
  // React.createElement or createElement call
  if (c.kind() !== TK.identifier && c.kind() !== TK.dot) return false;
  var saved = c.save();
  var name = '';
  if (c.kind() === TK.identifier) {
    name = c.text();
    c.advance();
    if (name === 'React' && c.kind() === TK.dot) {
      c.advance();
      if (c.kind() === TK.identifier) {
        name = c.text();
        c.advance();
      }
    }
  }
  var isMatch = name === 'createElement' && c.kind() === TK.lparen;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  // Desugar React.createElement(type, props, ...children) to a node.
  // Skip React. prefix if present
  if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance(); // React
    if (c.kind() === TK.dot) c.advance(); // .
  }
  if (c.kind() === TK.identifier) c.advance(); // createElement
  if (c.kind() !== TK.lparen) return null;
  c.advance(); // (

  // Arg 1: type — string literal or identifier
  var tag = 'Box';
  if (c.kind() === TK.string) {
    tag = resolveTag(c.text().slice(1, -1));
    c.advance();
  } else if (c.kind() === TK.identifier) {
    tag = c.text();
    c.advance();
  }
  if (c.kind() === TK.comma) c.advance();

  // Arg 2: props — null or object literal (skip for now)
  if (c.kind() === TK.identifier && c.text() === 'null') {
    c.advance();
  } else if (c.kind() === TK.lbrace) {
    skipBraces(c);
  }
  if (c.kind() === TK.comma) c.advance();

  // Arg 3+: children — collect as text nodes
  var children = [];
  while (c.kind() !== TK.rparen && c.kind() !== TK.eof) {
    if (c.kind() === TK.string) {
      var text = c.text().slice(1, -1);
      children.push('.{ .text = "' + text.replace(/"/g, '\\"') + '" }');
      c.advance();
    } else if (c.kind() === TK.lt) {
      var child = parseJSXElement(c);
      if (child) children.push(child.nodeExpr);
    } else {
      c.advance();
    }
    if (c.kind() === TK.comma) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();

  if (children.length === 0) return { nodeExpr: '.{}' };
  if (children.length === 1) return { nodeExpr: children[0] };
  return { nodeExpr: '.{}', arrayChildren: children.map(function(e) { return { nodeExpr: e }; }) };
}

_patterns[77] = {
  id: 77,
  name: 'create_element',
  status: 'complete',
  match,
  compile,
};

})();
