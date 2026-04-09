(function() {
// ── Pattern 085: IIFE in JSX ────────────────────────────────────
// Index: 85
// Group: conditional_rendering
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box>
//     {(() => {
//       if (x > 10) return <BigWidget />;
//       if (x > 5) return <MediumWidget />;
//       return <SmallWidget />;
//     })()}
//   </Box>
//
// Mixed syntax (hybrid):
//   <Box>
//     <if x above 10>
//       <BigWidget />
//     </if>
//     <else if x above 5>
//       <MediumWidget />
//     </else>
//     <else>
//       <SmallWidget />
//     </else>
//   </Box>
//
// Zig output target:
//   // Compiles as chained conditionals, same as p081/p083/p084:
//   // Conditional 0: (state.getSlot(N) > 10)
//   // nodes[0] = BigWidget    (condIdx: 0)
//   // Conditional 1: !(prev) and (state.getSlot(N) > 5)
//   // nodes[1] = MediumWidget (condIdx: 1)
//   // Conditional 2: !(prev)
//   // nodes[2] = SmallWidget  (condIdx: 2)
//
// Notes:
//   IIFEs (Immediately Invoked Function Expressions) in JSX are a React
//   escape hatch for imperative control flow inside declarative JSX.
//   The pattern wraps if/else/switch logic in an arrow function that's
//   immediately called: {(() => { ... })()}
//
//   This pattern is NOT APPLICABLE in our compiler because <if>/<else>
//   blocks provide the same capability declaratively. Every IIFE can be
//   mechanically transformed to <if>/<else if>/<else> blocks:
//     - if (cond) return <X /> → <if cond><X /></if>
//     - else if (cond) return <Y /> → <else if cond><Y /></else>
//     - return <Z /> → <else><Z /></else>
//
//   IIFEs are widely considered an anti-pattern even in standard React
//   (they create closures, hurt readability, and prevent static analysis).
//   Our block syntax (<if>/<else>) is strictly superior.

function match(c, ctx) {
  if (c.kind() !== TK.lparen) return false;

  var start = c.pos;
  var depth = 0;
  var end = -1;
  for (var i = start; i < c.count; i++) {
    var kind = c.kindAt(i);
    if (kind === TK.lparen) depth++;
    if (kind === TK.rparen) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end < 0) return false;
  if (end + 2 >= c.count) return false;
  if (c.kindAt(end + 1) !== TK.lparen || c.kindAt(end + 2) !== TK.rparen) return false;

  var hasArrow = false;
  var hasFunction = false;
  for (var j = start + 1; j < end; j++) {
    if (c.kindAt(j) === TK.arrow) hasArrow = true;
    if (c.kindAt(j) === TK.identifier && c.textAt(j) === 'function') hasFunction = true;
    if (hasArrow || hasFunction) break;
  }

  return hasArrow || hasFunction;
}

function compile(c, ctx) {
  var start = c.save();
  if (c.kind() !== TK.lparen) return null;

  var openDepth = 0;
  var end = -1;
  for (var i = start; i < c.count; i++) {
    var kind = c.kindAt(i);
    if (kind === TK.lparen) openDepth++;
    if (kind === TK.rparen) {
      openDepth--;
      if (openDepth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;

  var parsedNode = null;
  for (var j = start + 1; j < end; j++) {
    if (c.kindAt(j) === TK.identifier && c.textAt(j) === 'return') {
      var k = j + 1;
      while (k < end && c.kindAt(k) === TK.lparen) k++;
      if (k < end && c.kindAt(k) === TK.lt) {
        c.restore(k);
        parsedNode = parseJSXElement(c);
      }
      break;
    }
  }

  var after = end + 1;
  if (after + 1 < c.count && c.kindAt(after) === TK.lparen && c.kindAt(after + 1) === TK.rparen) after += 2;
  c.restore(after);

  if (parsedNode) return parsedNode;
  return { iife: true, children: [] };
}

_patterns[85] = { id: 85, match: match, compile: compile };

})();
