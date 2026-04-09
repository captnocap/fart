(function() {
// ── Pattern 079: React.lazy component ────────────────────────────
// Index: 79
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   const LazyComp = React.lazy(() => import('./Component'));
//   const LazyPage = lazy(() => import('./pages/Home'));
//
// Mixed syntax (hybrid):
//   // Lazy loading handled by cartridge system
//   const LazyPage = lazy(() => import('./pages/Home'));
//   <LazyPage />
//
// Zig output target:
//   // Emitted as Cartridge with lazy loading metadata
//   .{
//     .tag = .Cartridge,
//     .props = .{
//       .src = "Component.so",
//       .lazy = true,
//       .loading = &[_]Node{ .{ .tag = .Spinner } },
//     },
//   }
//
// Notes:
//   React.lazy enables code splitting and dynamic imports. The component
//   is loaded asynchronously when first rendered.
//
//   Pattern: lazy(() => import('./path'))
//     - Argument: loader function returning import() promise
//     - Returns: Lazy component wrapper
//
//   In native compilation, this maps to the Cartridge system:
//     - Import path → .so file path
//     - Loader function → runtime dynamic load trigger
//     - Must be wrapped in Suspense (p080) for loading state
//
//   The compiler extracts the import path and emits a Cartridge node
//   with lazy loading enabled. The runtime handles the actual loading.
//
//   Implemented in soup.js → tryParseLazyComponent() which:
//     1. Extracts import path from the loader function
//     2. Maps to cartridge source path
//     3. Emits Cartridge node with lazy=true

function match(c, ctx) {
  // React.lazy or lazy() call with arrow function containing import()
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
  if (name !== 'lazy' || c.kind() !== TK.lparen) {
    c.restore(saved);
    return false;
  }
  c.advance(); // skip (
  // Check for arrow function: () => import()
  if (c.kind() === TK.lparen) {
    c.advance();
    while (c.kind() !== TK.eof && c.kind() !== TK.rparen) c.advance();
    if (c.kind() === TK.rparen) c.advance();
    if (c.kind() === TK.arrow) {
      c.advance();
      if (c.kind() === TK.identifier && c.text() === 'import') {
        c.restore(saved);
        return true;
      }
    }
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Extract import path from: lazy(() => import('./path'))
  // Maps to a Cartridge node with the .so path derived from the import.
  if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance(); if (c.kind() === TK.dot) c.advance();
  }
  if (c.kind() === TK.identifier) c.advance(); // lazy
  var importPath = '';
  if (c.kind() === TK.lparen) {
    var depth = 1; c.advance();
    // Scan for import('path') inside the arrow function
    while (c.kind() !== TK.eof && depth > 0) {
      if (c.kind() === TK.lparen) depth++;
      if (c.kind() === TK.rparen) { depth--; if (depth === 0) break; }
      if (c.kind() === TK.identifier && c.text() === 'import' &&
          c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
        c.advance(); c.advance(); // import (
        if (c.kind() === TK.string) {
          importPath = c.text().slice(1, -1);
          c.advance();
        }
      }
      c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
  }
  // Map import path to cartridge .so name
  var soName = importPath.split('/').pop().replace(/\.\w+$/, '') + '.so';
  return { nodeExpr: '.{ .src = "' + soName + '" }' };
}

_patterns[79] = {
  id: 79,
  name: 'lazy_component',
  status: 'complete',
  match,
  compile,
};

})();
