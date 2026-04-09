// ── Smith Pattern Registry ───────────────────────────────────────
//
// Global registry for all patterns. Each pattern file wraps itself
// in an IIFE and registers into _patterns[N] when loaded.
// This file declares the registry and must be loaded FIRST.
//
// Pattern dispatch: consumers call tryPatternMatch(c, ctx) to check
// if any registered pattern matches the current cursor position.

var _patterns = {};

// Try all registered patterns against the current cursor.
// Returns true if a pattern matched and handled the brace child, false otherwise.
// Patterns either push to children directly (ternary/conditional) or return
// a { nodeExpr } result which we push here.
function tryPatternMatch(c, children) {
  var before = children.length;
  for (var key in _patterns) {
    var p = _patterns[key];
    if (p && typeof p.match === 'function') {
      var saved = c.save();
      if (p.match(c, ctx)) {
        c.restore(saved);
        var posBefore = c.pos;
        var result = p.compile(c, children, ctx);
        // Pattern pushed to children itself (ternary/conditional delegates)
        if (children.length > before) {
          if (c.kind() === TK.rbrace) c.advance();
          return true;
        }
        // Pattern returned a result — push it
        if (result !== null && result !== undefined && result.nodeExpr) {
          children.push(result);
          if (c.kind() === TK.rbrace) c.advance();
          return true;
        }
        // Pattern consumed tokens but returned null (swallow: bool/null/undefined)
        if (c.pos > posBefore) {
          return true;
        }
      }
      c.restore(saved);
    }
  }
  return false;
}
