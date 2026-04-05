(function() {
// ── Chad Pattern c005: <types> block ────────────────────────────
// Group: core
// Status: complete
//
// Chad syntax:
//   <types>
//     <mode>
//       time
//       date
//       system
//     </mode>
//   </types>
//
// ── Route chain ──
//
// PARSE:
//   chad.js:compileChadLane()
//     → extractPageBlock(inner, 'types') gets raw block content
//     → regex: /<(\w+)>([\s\S]*?)<\/\1>/g matches each type sub-block
//     → splits body on newlines, trims, filters comments
//     → stores: ctx._typeVariants[variantName] = typeName
//       e.g., ctx._typeVariants['time'] = 'mode'
//
// EFFECT ON COMPILATION:
//   page.js:_quoteTypeVariant()
//     → when transpiling set_X is <bareword>, checks ctx._typeVariants
//     → if bareword is a known variant, quotes it: set_mode('time')
//     → prevents bare identifiers from being treated as variable references
//
// EMIT:
//   emit_split.js → JS_LOGIC block:
//     → "set_mode('time');" instead of "set_mode(time);"
//   No direct Zig type definition emitted (variants are JS strings)
//
// ctx fields: ctx._typeVariants
//
// Notes:
//   Struct types and tagged unions (<Vec2>, <Payload union>) are
//   documented in the dictionary but only used in .mod.tsz modules,
//   which go through smith/mod/, not the chad lane.

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c005'] = { id: 'c005', match: match, compile: compile };

})();
