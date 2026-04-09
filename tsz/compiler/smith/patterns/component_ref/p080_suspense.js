(function() {
// ── Pattern 080: Suspense boundary ───────────────────────────────
// Index: 80
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Suspense fallback={<Loading />}>
//     <LazyComponent />
//   </Suspense>
//
//   <Suspense fallback={<Spinner />}>
//     {asyncData && <DataView data={asyncData} />}
//   </Suspense>
//
// Mixed syntax (hybrid):
//   <Suspense fallback={<Spinner />}>
//     <Cartridge src="lazy.so" />
//   </Suspense>
//
// Zig output target:
//   // Suspense becomes a boundary node with fallback
//   .{
//     .tag = .Suspense,
//     .props = .{
//       .fallback = &[_]Node{ .{ .tag = .Loading } },
//     },
//     .sub_nodes = &[_]Node{
//       .{ .tag = .Cartridge, .props = .{ .src = "lazy.so" } },
//     },
//   }
//
// Notes:
//   Suspense provides a loading boundary for async content. When child
//   content (lazy components, async data) is loading, the fallback UI
//   is shown. Once loaded, children replace it.
//
//   Props:
//     - fallback (required): JSX to show while loading
//     - children: Content that may suspend
//
//   In native compilation, this coordinates with:
//     - Cartridge loading system for lazy components
//     - Async operation callbacks for data fetching
//
//   The Suspense node tracks the loading state of its children.
//   When all children are ready, the fallback is hidden.
//
//   Implemented in soup.js → parseJSXElement() which recognizes the
//   Suspense tag and builds a boundary node with fallback reference.

function match(c, ctx) {
  // <Suspense> element
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  return c.textAt(c.pos + 1) === 'Suspense';
}

function compile(c, ctx) {
  // Delegate to parseJSXElement — Suspense is treated as a regular
  // container element. The fallback prop is parsed as a JSX expression
  // prop. Children are parsed normally. The runtime handles loading
  // boundary behavior via the Cartridge system.
  return parseJSXElement(c);
}

_patterns[80] = {
  id: 80,
  name: 'suspense',
  status: 'complete',
  match,
  compile,
};

})();
