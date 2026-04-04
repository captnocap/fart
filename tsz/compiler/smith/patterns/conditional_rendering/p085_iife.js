// ── Pattern 085: IIFE in JSX ────────────────────────────────────
// Index: 85
// Group: conditional_rendering
// Status: not_applicable
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
  // Not applicable — IIFEs don't exist in our syntax. The equivalent
  // <if>/<else> blocks are matched by p081.
  return false;
}

function compile(c, ctx) {
  // Not applicable — refactored to <if>/<else> blocks at the source level.
  return null;
}
