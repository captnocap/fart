(function() {
// ── Chad Pattern c021: Classifiers (C.Name) ────────────────────
// Group: visual
// Status: complete
//
// Chad syntax:
//   // Usage in JSX:
//   <C.Card> ... </C.Card>
//   <C.Title>text</C.Title>
//   <C.Btn decrement><C.BtnLabel>-</C.BtnLabel></C.Btn>
//
//   // Definition in .cls.tsz:
//   <C.Row is Box>
//     flexDirection exact row
//     gap is theme-spaceMd
//   </C.Row>
//
//   <C.Btn is Pressable>
//     backgroundColor is theme-primary
//     padding is theme-spaceMd
//   </C.Btn>
//
// ── Route chain ──
//
// COLLECTION:
//   lanes/app.js:collectClassifiers()
//     → scans imported .cls.tsz sources for <C.Name is Primitive> blocks
//     → extracts style properties (is = themeable, exact = locked)
//     → ctx.classifiers[name] = { base, styles }
//
// RESOLUTION (JSX parse):
//   parse/element/attrs_basic.js
//     → <C.Name> → looks up ctx.classifiers[Name]
//     → merges classifier styles into node style fields
//     → base type (Box/Text/Pressable) determines node kind
//   Bare words on Pressable:
//     → resolved as handler names via ctx.scriptFuncs
//     → composition (bounce + decrement) parsed as compound handler
//
// EMIT:
//   emit/node_tree.js:emitNodeTree()
//     → classifier styles become .style = .{ ... } on the node
//     → Pressable handlers → handler dispatch index
//
// ctx fields: ctx.classifiers, ctx.scriptFuncs
//
// Notes:
//   Chad-tier JSX has no style= prop. All visual structure
//   comes from classifiers. Primitives only appear in .cls.tsz.

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }

_patterns['c021'] = { id: 'c021', match: match, compile: compile };

})();
