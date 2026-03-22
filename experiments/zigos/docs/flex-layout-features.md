# Flex Layout Features

The layout engine implements CSS flexbox with the following properties.

## .tsz API

```tsx
// align-content: distributes wrapped lines on cross axis
<Box style={{ flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', width: 200, height: 200 }}>
  <Box style={{ width: 80, height: 30 }} />
  <Box style={{ width: 80, height: 30 }} />
  <Box style={{ width: 80, height: 30 }} />
</Box>

// margin auto: absorbs free space on main axis
<Box style={{ flexDirection: 'row', width: 300 }}>
  <Box style={{ width: 40 }} />
  <Box style={{ width: 40, marginLeft: 'auto' }} />  // pushed to right
</Box>

// wrap-reverse: wrapped lines stack in reverse cross-axis order
<Box style={{ flexDirection: 'row', flexWrap: 'wrap-reverse', width: 200 }}>
  <Box style={{ width: 90, height: 30 }} />
  <Box style={{ width: 90, height: 30 }} />
</Box>

// order: visual reordering without changing DOM order
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ order: 3 }}>Third visually</Box>
  <Box style={{ order: 1 }}>First visually</Box>
  <Box style={{ order: 2 }}>Second visually</Box>
</Box>
```

## Supported properties

| Property | Values | Default |
|----------|--------|---------|
| flexDirection | row, column | column |
| justifyContent | start, center, end, space-between, space-around, space-evenly | start |
| alignItems | start, center, end, stretch | stretch |
| alignContent | start, center, end, stretch, space-between, space-around, space-evenly | stretch |
| alignSelf | auto, start, center, end, stretch | auto |
| flexWrap | no-wrap, wrap, wrap-reverse | no-wrap |
| flexGrow | f32 | 0 |
| flexShrink | ?f32 | null (defaults to 1) |
| flexBasis | ?f32 | null |
| gap | f32 | 0 |
| order | i32 | 0 |
| margin | f32 or 'auto' | 0 |

## Framework files

- `framework/layout.zig` — all flex layout logic, Style/Node structs, enums

## Compiler files

- `compiler/attrs.zig` — style key mapping (`mapStyleKey`, `mapEnumKey`, `mapEnumValue`)

## Known limitations

- No `row-reverse` or `column-reverse` flex directions
- No separate `rowGap` / `columnGap` (single `gap` only)
- Margin auto encoded as `std.math.inf(f32)` sentinel — negative margins work, auto margins work, but auto on the `margin` shorthand (all sides) is not meaningful
- Column flex-shrink required a fix where `_stretch_h` wasn't set for items shrunk below explicit height
- ScrollView height constraint required a fix to use unlimited innerH for child layout while constraining the container
