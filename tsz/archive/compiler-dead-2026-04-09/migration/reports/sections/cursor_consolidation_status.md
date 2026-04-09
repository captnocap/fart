# Cursor Consolidation Status — S548-587

Timestamp: 2026-04-09
Step range: 565-573

## Moved Helpers

From parse/utils.js:
- lastTokenOffset
- skipBraces
- offsetToLine

From parse/children/brace_util.js:
- _joinTokenText
- _normalizeJoinedJsExpr
- _findLastTopLevelAmpAmp

To: parse/cursor.js (loaded before parse/utils.js in smith_LOAD_ORDER.txt)

## Consumer Files (no import changes needed — flat global namespace)

parse/build_node.js, parse/children/brace.js, parse/brace/conditional.js, parse.js, parse/element/attrs_dispatch.js, parse/element/attrs_basic.js, parse/element/attrs_canvas.js, parse/children/brace_render_local.js, parse/children/brace_computed.js, parse/element/attrs_handlers.js, parse/element/attrs_spatial.js, debug.js
