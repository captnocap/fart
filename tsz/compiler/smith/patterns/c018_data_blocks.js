(function() {
// ── Chad Pattern c018: Named data blocks ────────────────────────
// Group: data
// Status: complete
//
// Chad syntax:
//   // Simple array:
//   <var>colors is array</var>
//   <colors>
//     red
//     green
//     blue
//   </colors>
//
//   // Object array:
//   <var>cards is objects</var>
//   <cards>
//     id: 1, title: Auth flow, col: todo
//     id: 2, title: Write tests, col: todo
//   </cards>
//
// ── Route chain ──
//
// PARSE:
//   chad.js:compileChadLane() (data block loop)
//     → iterates stateVars with type 'array' or 'object_array'
//     → extractPageBlock(inner, varName) gets raw block content
//
//   OBJECTS (dataKind === 'objects'):
//     → splits lines, splits on comma, extracts key: value pairs
//     → discovers fields from first row (name + inferred type)
//     → ctx.objectArrays.push({ fields, getter, setter, oaIdx, constData })
//     → builds JS initial: [{id: 1, title: 'Auth flow'}, ...]
//
//   SIMPLE ARRAY (dataKind === 'array' or 'TYPE array'):
//     → one item per line, registers as OA with _v field + isSimpleArray
//     → ctx.objectArrays.push({ fields: [{name: '_v', type: 'string'}], isSimpleArray })
//     → builds JS initial: ['red', 'green', 'blue']
//
// EMIT:
//   emit/object_arrays.js:emitObjectArrayInfrastructure()
//     → Zig: OA storage arrays, string buffers, const data, unpack fns
//   emit_split.js → JS_LOGIC:
//     → "var cards = [{id: 1, title: 'Auth flow', col: 'todo'}, ...];"
//
// ctx fields: ctx.objectArrays

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c018'] = { id: 'c018', match: match, compile: compile };

})();
