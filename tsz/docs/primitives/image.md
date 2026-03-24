# Image

`Image` is the bitmap image primitive.

Its compiler-facing API is intentionally small right now.

## Supported attrs

- `style`
- `src`
- `tooltip`
- `href`
- `hoverable`

## Behavior

- `src` is parsed as a string.
- For `Image`, the compiler resolves relative paths against the input file directory.
- Layout and sizing come from the normal node/style surface.

Example:

```tsx
<Image
  src="assets/logo.png"
  style={{ width: 96, height: 96, borderRadius: 8 }}
/>
```

## Notes

- `Image` is a real runtime-backed surface, but its documented prop surface is currently narrow.
- There is no separate image-fit/content-mode API documented from the current compiler/runtime surface.
- If you need visual framing, use normal `style` on the image node or wrap it in `Box`.

## HTML alias

- `img` resolves to `Image`

## Source files

- `tsz/compiler/html_tags.zig`
- `tsz/compiler/jsx.zig`
- `tsz/framework/layout.zig`
- `tsz/framework/engine.zig`
