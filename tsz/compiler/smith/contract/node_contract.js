// ── Contract: Node Semantic Schema ──────────────────────────────
// This file defines the canonical data structures that build_node.js
// and other parse-phase files MUST produce.
// 
// EMIT FILES MUST NOT REPARSER STRINGS. They consume this contract only.
//
// Status: ACTIVE CONTRACT — read-only for emit atoms
// Owner: parse/* (build_node.js, brace_maps.js, component_inline.js)
// Consumer: emit_atoms/maps_lua/*, emit/lua_tree_nodes.js

// ── Text Node Contract ─────────────────────────────────────────
// Produced by: build_node.js (Text element handling, parse/children/text.js)
// Consumed by: lua_map_text.js → _textToLua()
//
// A text node contract can be ONE of these shapes:
//
// 1. Static string (no dynamic refs):
//    { type: 'static', value: "hello world" }
//
// 2. Field reference (item.field from map):
//    { type: 'field', field: "title", itemParam: "item" }
//
// 3. State variable reference:
//    { type: 'stateVar', name: "count" }
//
// 4. Lua expression (pre-converted from JS):
//    { type: 'luaExpr', expr: "(mode == 0) and 'A' or 'B'" }
//
// 5. Template literal with interpolation:
//    { type: 'template', parts: [
//        { literal: "Hello " },
//        { expr: "item.name" },
//        { literal: "!" }
//      ]
//    }
//
// 6. Ternary text expression:
//    { type: 'ternary', 
//      condition: "item.active", 
//      whenTrue: "Yes", 
//      whenFalse: "No" 
//    }

// ── Map Loop Contract ──────────────────────────────────────────
// Produced by: brace_maps.js, component_inline.js
// Consumed by: lua_map_node.js → _nodeToLua(), lua_map_handler.js
//
// {
//   type: 'mapLoop',
//   oaIdx: 0,                    // Object array index in ctx.objectArrays
//   itemParam: "item",           // Name of item param in source
//   indexParam: "i",             // Name of index param (optional, null if unused)
//   dataVar: "todos",            // Source variable name
//   bodyNode: {...},             // Single child node (the template)
//   isNested: false,             // True if inside another map
//   filterConditions: [...],     // Optional filter expressions
//   
//   // For nested maps on item fields:
//   parentItemParam: "_item",    // Outer map item name
//   parentIndexParam: "_i"       // Outer map index name
// }

// ── Handler Contract ───────────────────────────────────────────
// Produced by: parse/attrs/handler.js, build_node.js
// Consumed by: lua_map_handler.js → _handlerToLua()
//
// {
//   type: 'handler',
//   event: 'onPress',            // onPress, onClick, onChange, etc.
//   jsBody: "toggle(item.id)",   // Original JS handler body
//   luaBody: "toggle(item.id)",  // Transformed Lua equivalent
//   handlerRef: "_handler_0",    // Generated handler reference
//   
//   // Runtime routing:
//   target: 'lua' | 'js',        // Which runtime executes this
//   inMap: true,                 // Whether handler is inside a map
//   mapIdx: 0,                   // Which map context (if inMap)
//   
//   // Closure params for TextInput onChange:
//   closureParams: ["value"]
// }

// ── OA (Object Array) Field Access Contract ────────────────────
// Produced by: parse/element/component_brace_values.js
// Consumed by: lua_map_subs.js → _jsExprToLua(), lua_map_style.js
//
// {
//   type: 'oaField',
//   oaIdx: 0,
//   field: "title",
//   isString: true,              // String fields need special handling
//   iterVar: "_i"                // Iterator variable name
// }

// ── Conditional/Ternary Node Contract ──────────────────────────
// Produced by: parse/brace/conditional.js, parse/brace/ternary.js
// Consumed by: lua_map_node.js → _nodeToLua()
//
// {
//   type: 'conditional',
//   condition: "item.visible",   // JS expression (will be converted to Lua)
//   node: {...},                 // Child node to render when true
//   
//   // Alternative: explicit true/false branches (ternary)
//   trueNode: {...},
//   falseNode: {...}
// }

// ── Prop Forwarding Contract ───────────────────────────────────
// Produced by: parse/element/component_inline.js
// Consumed by: lua_map_subs.js → _normalizePropValueForLua()
//
// Props from inlined components are stored in ctx.propStack as:
//   ctx.propStack[propName] = propValue
//
// propValue can be:
// - String literal: "hello"
// - OA marker: "\x02OA_ITEM:0:_i:_item" (whole item passed)
// - Expression: "state.count + 1"
// - Handler ref: "_handler_press_0"

// ── Style Contract ─────────────────────────────────────────────
// Produced by: build_node.js
// Consumed by: lua_map_style.js → _styleToLua()
//
// Style values arrive as raw strings from Zig field assignment:
//   
//   ".flex_direction = .row"  →  { flex_direction: "row" }
//   ".width = -1"            →  { width: -1 }
//   ".text_color = Color.rgb(...)" → { text_color: "Color.rgb(...)" }
//
// The style object is a plain JS object where:
// - Keys are snake_case (already converted by build_node)
// - Values are the raw Zig expressions (emit atoms convert to Lua)

// ── Node Contract (Full Element) ──────────────────────────────
// Produced by: build_node.js → returns { nodeExpr: "...", luaNode: {...} }
// Consumed by: emit/lua_tree_nodes.js, lua_map_node.js
//
// The luaNode attached to every parse result:
// {
//   tag: "Box",
//   style: { flex_direction: "row", gap: 8 },
//   text: { type: "field", field: "title" },  // Text contract
//   color: "0xff0000",                        // Resolved color
//   fontSize: 16,
//   
//   // Handler contract (optional)
//   handler: "toggle(item.id)",
//   handlerIsJs: false,
//   
//   // Children: array of node contracts
//   children: [
//     { type: 'mapLoop', ... },
//     { tag: "Text", ... },
//     { type: 'conditional', ... }
//   ],
//   
//   // Special node fields (canvas, text input, etc.)
//   _nodeFields: {
//     canvas_path: "true",
//     text_input: "true",
//     input_id: "0"
//   },
//   
//   // Variant styles for dynamic switching
//   _variantStyles: [{...}, {...}]
// }

// This file is documentation + runtime constants only.
// No functions here — just the contract schema.

function _contract_validateLuaNode(node, path) {
  void node; void path;
  // Validation helper for debugging — stripped in production
  return true;
}
