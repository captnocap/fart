# ScrollView

`ScrollView` is the scroll container primitive.

In the compiler it is not a distinct runtime node type. It lowers to `Box` with overflow behavior enabled.

## Supported attrs

- `style`
- `tooltip`
- `href`
- `hoverable`

There are no ScrollView-only props in `jsx.zig`.

## Lowering

`ScrollView` injects:

```zig
.style = .{ .overflow = .auto, ... }
```

So the effective model is “scrollable box”, not a separate widget class.

## Practical rules

- Give it a real height or a flex-constrained slot.
- `flexGrow: 1` is common, but it still needs a parent layout that gives it bounded height.
- A child column inside the scroll view is the common pattern.

Example:

```tsx
<ScrollView style={{ height: 160, padding: 8 }}>
  <Box style={{ flexDirection: "column", gap: 6 }}>
    <Text>Item 1</Text>
    <Text>Item 2</Text>
  </Box>
</ScrollView>
```

## Notes

- Scroll behavior is tightly tied to layout constraints.
- If the container collapses or never gets bounded height, scrolling will not behave like you expect.

## Source files

- `tsz/compiler/jsx.zig`
- `tsz/framework/layout.zig`
- `tsz/docs/flex-layout-features.md`
- `tsz/docs/STORYBOOK_HOMEPAGE.md`
- `tsz/carts/wpt-flex/60_nested_scroll.tsz`
