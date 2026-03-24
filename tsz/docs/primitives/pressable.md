# Pressable

`Pressable` is the clickable interaction primitive.

Use it when a node should react to presses, right-clicks, or act like a button-shaped link.

## Supported attrs

- `style`
- `onPress`
- `onRightClick`
- `href`
- `tooltip`
- `hoverable`

Children work normally, so the common pattern is:

```tsx
<Pressable onPress={() => { setOpen(open == 0 ? 1 : 0) }}>
  <Box style={{ padding: 8, backgroundColor: "#334155", borderRadius: 6 }}>
    <Text color="#fff">Toggle</Text>
  </Box>
</Pressable>
```

## Behavior

- `onPress` lowers into a generated handler function.
- `onRightClick` lowers into a generated handler with pointer coordinates.
- `href` makes the node open a URL in the system browser.

If `href` is present, treat `Pressable` as a button-like hyperlink surface.

## Notes

- `onClick` is not the public API. Use `onPress`.
- `onContextMenu` is not the public API. Use `onRightClick`.
- Visual button styling is entirely up to you via children and `style`.

## HTML alias

- `button` resolves to `Pressable`

## Source files

- `tsz/compiler/html_tags.zig`
- `tsz/compiler/jsx.zig`
- `tsz/compiler/handlers.zig`
- `tsz/framework/events.zig`
- `tsz/docs/hyperlinks.md`
