// ── Pattern 057: Object prop ────────────────────────────────────
// Index: 57
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   <Box style={{color: 'red', padding: 8}} />
//   <Chart config={{showGrid: true, animate: false}} />
//   <Theme value={{primary: '#ff0000', bg: '#000'}} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // style={{...}} is the primary case — emits struct fields:
//   nodes._arr_0[0] = .{
//     .style = .{
//       .color = Color.rgb(255, 0, 0),
//       .padding = .{ .top = 8, .right = 8, .bottom = 8, .left = 8 },
//     },
//   };
//   // Non-style object props passed to components:
//   // Flattened into individual prop values in propValues map:
//   // propValues["config.showGrid"] = "true"
//   // propValues["config.animate"] = "false"
//   // Or for simple cases, the entire object collected as raw text.
//
// Notes:
//   Two distinct code paths depending on the attribute name:
//
//   1. style={{...}} — FULLY SUPPORTED
//      Handled by parseStyleBlock() in attrs.js. Parses key:value pairs
//      where values can be:
//        - Numbers (padding: 8)
//        - Strings/colors (color: 'red', background: '#ff0000')
//        - State getters (width: count → slotGet)
//        - Map item fields (color: item.color → OA field)
//        - Ternary expressions (color: active ? 'red' : 'blue')
//        - Arithmetic (width: base * 2)
//      Maps CSS property names to Zig struct fields (paddingLeft → padding.left,
//      backgroundColor → bg_color, etc.)
//
//   2. Generic object prop (config={{...}}) — LIMITED
//      parseComponentBraceValue() sees the inner { and collects tokens as raw
//      text. For components, this becomes a string in propValues that gets
//      inlined wherever the component references the prop. Works when the
//      component destructures specific fields but not for pass-through.
//
//   Partial because style is complete but generic object props are raw text.

function match(c, ctx) {
  // attr={  {  — double brace opening
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbrace;
}

function compile(c, ctx) {
  // For style: delegates to parseStyleBlock() in attrs.js.
  // For other attrs: parseComponentBraceValue() collects inner tokens.
  return null;
}
