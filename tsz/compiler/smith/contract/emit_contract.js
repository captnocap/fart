// ── Contract: Emit Phase Interface ──────────────────────────────
// This file defines what emit atoms are allowed to consume.
//
// EMIT ATOMS MAY ONLY READ:
//   1. ctx.contract.* (semantic data from parse phase)
//   2. Other emit atoms in the same group via shared exports
//
// EMIT ATOMS MUST NEVER:
//   - Re-parse string expressions
//   - Re-resolve prop values
//   - Re-infer map identities
//   - Access raw source text

// ── Emit Groups ────────────────────────────────────────────────
//
// Group: maps_lua
//   Files: lua_map_*.js
//   Input: luaNode contracts from ctx._luaRootNode, ctx._luaMapRebuilders
//   Output: Lua source strings
//   
//   Sub-modules:
//   - lua_map_subs.js:  _jsExprToLua() ONLY js→lua conversion
//   - lua_map_node.js:  _nodeToLua() consumes luaNode contracts
//   - lua_map_text.js:  _textToLua() consumes text contracts
//   - lua_map_style.js: _styleToLua() consumes style contracts
//   - lua_map_handler.js: _handlerToLua() consumes handler contracts
//
// Group: logic_runtime  
//   Files: a033_js_logic_block.js, a034_lua_logic_block.js
//   Input: ctx.handlers, ctx.stateSlots, ctx.objectArrays
//   Output: JS_LOGIC and LUA_LOGIC strings
//
// Group: lua_tree
//   Files: emit/lua_tree_*.js
//   Input: ctx._luaRootNode (the full lua tree contract)
//   Output: Complete Lua source for the app

// ── Shared Conversion Utilities ─────────────────────────────────
// These are the ONLY functions that perform language translation.
// All emit atoms use these — no duplicate translation logic.

// From lua_map_subs.js:
//   _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx)
//     - Converts JS expressions to Lua
//     - Handles OA refs (_oaN_field[_i] → _item.field)
//     - Handles state slots (state.getSlotInt(N) → getter)
//     - Handles ternaries (cond ? a : b → (cond) and a or b)
//     - Handles string concat (a + b → a .. b)
//     - Returns: Lua expression string

// From lua_map_text.js:
//   _textToLua(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx)
//     - Consumes text contract (type: static|field|stateVar|luaExpr|template|ternary)
//     - Returns: Lua expression for the text value

// From lua_map_style.js:
//   _styleToLua(style, itemParam, indexParam, _luaIdxExpr, _currentOaIdx)
//     - Consumes style object (key/value pairs)
//     - Returns: Lua table string for the style

// From lua_map_handler.js:
//   _handlerToLua(handler, itemParam, indexParam, _luaIdxExpr, _currentOaIdx)
//     - Consumes handler string
//     - Returns: Lua string expression for handler body

// From lua_map_node.js:
//   _nodeToLua(node, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx)
//     - Consumes full luaNode contract
//     - Returns: Complete Lua table string for the node

// ── Deprecated / Deleted Files ─────────────────────────────────
// These files VIOLATE the contract model and are being removed:
//
// DELETED (no longer loaded):
//   - emit_ops/emit_lua_element.js  → superseded by lua_map_node.js
//   - emit_ops/emit_lua_text.js     → superseded by lua_map_text.js  
//   - emit_ops/emit_lua_style.js    → superseded by lua_map_style.js
//   - emit_ops/emit_lua_rebuild.js  → superseded by a034_lua_logic_block.js
//
// CONNECTED BUT DEPRECATED:
//   - emit_atoms/logic_runtime/a034_lua_logic_block.js
//     Still emits the wrapper, but delegates to lua_map_node.js for bodies

// ── Migration Path ─────────────────────────────────────────────
// Phase 1 (Complete): lua_map_*.js atoms established
// Phase 2 (Active):    Disconnect emit_ops files from load order
// Phase 3 (Pending):   Move build_node.js luaNode construction to contract/*
// Phase 4 (Future):    Delete emit_ops/emit_lua_*.js entirely

// ── Contract Enforcement Helpers ───────────────────────────────

function _emit_contract_violation(file, reason) {
  print('[EMIT_CONTRACT_VIOLATION] ' + file + ': ' + reason);
  // In strict mode, this would throw
  // throw new Error('Emit contract violation in ' + file + ': ' + reason);
}

function _emit_assertNoReparse(file, value) {
  // Call this at entry points to verify we're receiving contracts, not raw strings
  if (typeof value === 'string' && value.indexOf('state.getSlot') >= 0) {
    _emit_contract_violation(file, 'Received raw Zig expression instead of contract: ' + value.slice(0, 50));
  }
}

// Export contract version for debugging
const EMIT_CONTRACT_VERSION = '2.0.0-three-phase';
