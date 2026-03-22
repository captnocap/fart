# HTML Tag Support

The compiler natively accepts HTML element names and maps them to .tsz primitives at parse time.

## .tsz API

```tsx
<div style={{ flexDirection: 'row', gap: 8 }}>
  <span style={{ color: '#FFF' }}>Hello</span>
  <p style={{ fontSize: 14 }}>Paragraph</p>
  <button style={{ padding: 8 }}>Click</button>
</div>
```

75 HTML tags are mapped:

| HTML Tags | Primitive |
|-----------|-----------|
| div, section, article, main, aside, header, footer, nav, form, fieldset, figure, ul, ol, li, table, thead, tbody, tr, td, th, dl, dd, dt, dialog, details, summary, figcaption | Box |
| span, p, h1-h6, label, strong, em, b, i, u, small, code, pre, blockquote, a, time, abbr, cite, mark, sub, sup, del, ins, kbd, samp | Text |
| button | Pressable |
| img | Image |
| input, textarea | TextInput |
| svg, video, audio, select | Box |

## Framework files

- `compiler/html_tags.zig` — mapping table and `resolve()` / `isHtmlTag()` functions

## Compiler files

- `compiler/jsx.zig` — resolves tag name immediately after reading it (line ~100)
- `compiler/jsx_map.zig` — resolves tag name in map template parsing
- `compiler/validate.zig` — `isPrimitive()` accepts HTML tags
- `compiler/lint.zig` — no longer warns about HTML tags, no longer skips them in lint passes

## Known limitations

- `<p>` and `<span>` with `style={{ fontSize, color }}` — these are Text-specific attributes, not layout style properties. They generate warnings but work correctly when used as separate attributes (`fontSize={14}` not inside `style={{}}`)
- Apostrophes in JSX text content (e.g., "doesn't") required a lexer fix to prevent the `'` from being parsed as a string delimiter
- No semantic meaning — all tags map to visual primitives only
