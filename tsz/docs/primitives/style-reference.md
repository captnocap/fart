# Style Reference

This is the shared style surface parsed by `tsz/compiler/attrs.zig` and stored on `framework/layout.zig:Style`.

## Numeric and layout keys

- `width`
- `height`
- `minWidth`
- `maxWidth`
- `minHeight`
- `maxHeight`
- `flexGrow`
- `flexShrink`
- `flexBasis`
- `gap`
- `order`
- `padding`
- `paddingLeft`
- `paddingRight`
- `paddingTop`
- `paddingBottom`
- `margin`
- `marginLeft`
- `marginRight`
- `marginTop`
- `marginBottom`
- `borderRadius`
- `opacity`
- `borderWidth`
- `shadowOffsetX`
- `shadowOffsetY`
- `shadowBlur`
- `top`
- `left`
- `right`
- `bottom`
- `aspectRatio`
- `rotation`
- `scaleX`
- `scaleY`
- `zIndex`

## Color keys

- `backgroundColor`
- `borderColor`
- `shadowColor`
- `gradientColorEnd`

## Enum keys

- `flexDirection`: `row | column`
- `justifyContent`: `start | center | end | space-between | space-around | space-evenly`
- `alignItems`: `start | center | end | stretch`
- `alignSelf`: `auto | start | center | end | stretch`
- `alignContent`: `start | center | end | stretch | space-between | space-around | space-evenly`
- `flexWrap`: `nowrap | wrap | wrap-reverse`
- `position`: `relative | absolute`
- `display`: `flex | none`
- `textAlign`: `left | center | right`
- `overflow`: `visible | hidden | scroll`
- `gradientDirection`: `none | vertical | horizontal`

`ScrollView` injects `overflow: auto` during lowering even though `auto` is not a user-facing enum value in normal style parsing.

## Value forms

- Numbers are accepted directly.
- CSS-like strings such as `"12px"` and `"1.5rem"` are normalized.
- Percentages such as `"100%"` are supported for sizing.
- `"auto"` is supported for margin auto behavior.
- Theme tokens like `theme-primary` are resolved by the compiler.

## Unsupported shorthand

These are linted as unsupported:

- `paddingHorizontal`
- `paddingVertical`
- `marginHorizontal`
- `marginVertical`

Use the side-specific forms instead.

## Kebab-case

Kebab-case style keys are not the public style API. Use camelCase:

- `flexDirection`
- not `flex-direction`

## Transitions

Object-form transitions are supported:

```tsx
<Box style={{
  width: open ? 220 : 120,
  transition: { width: { duration: 200, easing: "easeOut" } }
}} />
```

String shorthand is not implemented.

## Source files

- `tsz/compiler/attrs.zig`
- `tsz/compiler/lint.zig`
- `tsz/framework/layout.zig`
