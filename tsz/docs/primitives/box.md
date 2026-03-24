# Box

`Box` is the base layout and paint primitive.

Most UI in `tsz/` is composed from `Box` plus `Text`.

## Main purpose

- flex container
- generic painted surface
- wrapper for children
- positioned block

`Box` is also the lowered target for several special surfaces like `ScrollView`, `Video`, `Render`, `Effect`, `Canvas`, `Graph`, and `Scene3D`.

## Supported attrs

- `style`
- `tooltip`
- `href`
- `hoverable`

There are no Box-only attrs beyond the shared node/style surface.

## Supported style categories

See `style-reference.md` for the full list. The most important Box styles are:

- size: `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- flex: `flexDirection`, `flexGrow`, `flexShrink`, `flexBasis`, `gap`, `flexWrap`
- alignment: `justifyContent`, `alignItems`, `alignSelf`, `alignContent`
- spacing: `padding*`, `margin*`
- paint: `backgroundColor`, `borderWidth`, `borderColor`, `borderRadius`, `opacity`
- positioning: `position`, `top`, `left`, `right`, `bottom`, `zIndex`
- transforms: `rotation`, `scaleX`, `scaleY`
- overflow: `overflow`

## Notes

- Root containers usually need `width: "100%", height: "100%"`.
- `flexGrow: 1` is the normal way to fill remaining space.
- `href` works on `Box`, but there is no built-in visual affordance. Use `Text` or `Pressable` when you want obvious link semantics.

## HTML aliases

Many HTML container tags resolve to `Box`, including `div`, `section`, `article`, `main`, `aside`, `header`, `footer`, `nav`, `ul`, `li`, and table-like container tags.

## Source files

- `tsz/compiler/html_tags.zig`
- `tsz/compiler/jsx.zig`
- `tsz/compiler/attrs.zig`
- `tsz/framework/layout.zig`
- `tsz/framework/engine.zig`
