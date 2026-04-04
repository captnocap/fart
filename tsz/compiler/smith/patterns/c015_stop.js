(function() {
// ── Chad Pattern c015: stop / skip ──────────────────────────────
// Group: functions
// Status: complete
//
// Chad syntax:
//   <if input exact ''>
//     stop
//   </if>
//
//   <for items as item>
//     <if not item.active>
//       skip
//     </if>
//     process
//   </for>
//
// ── Route chain ──
//
// STOP:
//   page.js:transpilePageLine()
//     → line === 'stop' → emits: return;
//     → in composed chain (a + b + c), each is a call inside a wrapper
//       function, so return; exits the wrapper → halts entire chain
//     → guard shorthand: "expr ? stop : go" →
//       if (transpilePageExpr(expr)) return;
//
// SKIP:
//   Not yet in transpilePageLine. Future: skip → continue;
//   Only valid inside <for> / <while> loops.
//
// EMIT:
//   emit_split.js → JS_LOGIC:
//     → "if (input === '') return;"
//
// ctx fields: ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c015'] = { id: 'c015', match: match, compile: compile };

})();
