(function() {
// ── Chad Pattern c012: <switch> / <case> ────────────────────────
// Group: control_flow
// Status: complete
//
// Chad syntax:
//   <switch event.type>
//     <case quit>
//       stop
//     </case>
//     <case resize>
//       updateSize
//     </case>
//     <case else>
//       ignore
//     </case>
//   </switch>
//
// ── Route chain ──
//
// IN FUNCTIONS (<functions> body):
//   page.js:transpilePageBody()
//     → <switch expr>: switch (transpilePageExpr(expr)) {
//     → <case value>: case 'value': {
//     → <case else>: default: {
//     → </case>: break; }
//     → </switch>: }
//     → case values auto-quoted as strings (bare words → 'word')
//   emit_split.js → JS_LOGIC embedded in Zig
//
// IN JSX:
//   Not yet implemented in JSX return(). In JSX, use multiple
//   <during> blocks or <if>/<else if>/<else> chains instead.
//
// ctx fields: ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c012'] = { id: 'c012', match: match, compile: compile };

})();
