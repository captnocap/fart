(function() {
// ── Chad Pattern c009: <for> iteration ──────────────────────────
// Group: control_flow
// Status: complete
//
// Chad syntax:
//   <for items>                    → implicit item
//   <for channels as ch>           → named binding
//   <for ch.effects as fx>         → nested, OA field iteration
//   <for 0..count as i>            → range (future)
//
// ── Route chain ──
//
// IN JSX (return):
//   parse/children/brace.js → detects <for> as map construct
//   chad.js data block parsing:
//     → var declared as array/objects → data block parsed → ctx.objectArrays
//     → OA fields, constData, getter/setter all registered
//   parse/element/ → <for items> compiles same as {items.map(item => ...)}
//     → ctx.maps.push({ oa, itemParam, iterVar })
//     → ctx.currentMap set during child parsing
//   emit/map_pools.js:emitMapPoolDeclarations()
//     → Zig: var _map0_pool: [MAX_ITEMS]Node = undefined;
//   emit/map_pools.js:emitMapPoolRebuilds()
//     → Zig: for (0.._oa0_len) |_i| { _map0_pool[_i] = .{ ... }; }
//   emit/object_arrays.js:emitObjectArrayInfrastructure()
//     → Zig: OA storage arrays, string helpers, unpack functions
//
// IN FUNCTIONS (<functions> body):
//   Not yet in transpilePageBody — <for> in functions is future work.
//   Currently functions use JS array methods in scriptBlock.
//
// ITEM ACCESS:
//   Inside map: item.field → _oa0_field[_i] (numeric) or
//     _oa0_field[_i][0.._oa0_field_lens[_i]] (string)
//   Bare item (simple array): _oa0__v[_i][0.._oa0__v_lens[_i]]
//
// ctx fields: ctx.maps, ctx.objectArrays, ctx.currentMap

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c009'] = { id: 'c009', match: match, compile: compile };

})();
