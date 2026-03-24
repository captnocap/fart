# Text

`Text` is the text-rendering primitive.

Use it for labels, headings, body copy, counters, badges, inline code, and hyperlink text.

## Supported attrs

- `style`
- `fontSize`
- `color`
- `letterSpacing`
- `lineHeight`
- `numberOfLines`
- `noWrap`
- `tooltip`
- `href`
- `hoverable`

## Content rules

- Static text is supported directly.
- Dynamic text expressions are supported.
- Template literals are supported.
- Avoid mixing raw text and expressions loosely inside the same `Text`; template literals are the safer path.

## Behavior

- Text is rendered with wrapping.
- `numberOfLines` limits the rendered line count.
- `noWrap` disables wrapping.
- `href` makes the text clickable and paints an underline.

The underline is a painted 1px rect, not a full text-decoration system.

## Text props vs style props

These are `Text` attrs, not general layout style keys:

- `fontSize`
- `color`
- `letterSpacing`
- `lineHeight`
- `numberOfLines`
- `noWrap`

Putting text props inside `style={{ ... }}` is not the intended API.

## HTML aliases

Many inline and text-like HTML tags resolve to `Text`, including:

- `span`
- `p`
- `label`
- `h1` through `h6`
- `strong`, `em`, `b`, `i`, `u`
- `code`, `pre`, `blockquote`
- `a`

These aliases are visual only. They do not carry DOM semantics.

## Source files

- `tsz/compiler/html_tags.zig`
- `tsz/compiler/jsx.zig`
- `tsz/framework/layout.zig`
- `tsz/framework/engine.zig`
- `tsz/docs/hyperlinks.md`
