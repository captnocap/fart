(function() {
// ── Chad Pattern c006: <props> block ────────────────────────────
// Group: core
// Status: complete
//
// Chad syntax:
//   <counter component>
//     <props>
//       initial is 0        → optional, default 0
//       max exact number     → required, typed
//       onSave               → bare, required callback
//     </props>
//
// ── Route chain ──
//
// PARSE:
//   chad.js:compileChadLane()
//     → component blocks detected via detectChadBlock() with type='component'
//     → extractPageBlock(inner, 'props') extracts raw props content
//     → props parsed same as <var>: is = default, exact = typed, bare = required
//
// RESOLUTION (at call site):
//   parse/element/attrs_basic.js
//     → <Counter initial=5 max=50 /> resolves prop values
//     → string props: value="hello"
//     → numeric props: count={5} or count=5
//     → callback props: onSave=persistCard → handler lookup in ctx.scriptFuncs
//   parse/element/component_brace_values.js
//     → resolves {expr} prop values via identity resolution
//
// STACK:
//   ctx.propStack pushed when entering component, popped on exit
//   → child elements see parent's props during parse
//   → conditional_blocks.js:parseBlockCondition() checks ctx.propStack
//
// EMIT:
//   emit/node_tree.js:emitNodeTree()
//     → prop values resolve to style fields or handler indices on the node
//   Callback props → handler dispatch entries
//
// ctx fields: ctx.propStack, ctx.scriptFuncs

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c006'] = { id: 'c006', match: match, compile: compile };

})();
