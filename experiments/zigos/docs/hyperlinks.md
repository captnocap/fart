# Hyperlinks (href)

Clickable links that open URLs in the system browser via `xdg-open`.

## .tsz API

```tsx
// Text link (underlined automatically)
<Text href="https://example.com" color="#58a6ff" fontSize={14}>Click me</Text>

// Pressable link (button-style)
<Pressable href="https://wpt.live/css/css-flexbox/" style={{ backgroundColor: '#1a5', padding: 8 }}>
  <Text color="#FFF">Open WPT Tests</Text>
</Pressable>
```

## Framework files

- `framework/layout.zig` — `Node.href: ?[]const u8` field; `hitTest` treats href nodes as interactive
- `framework/events.zig` — `hitTest` also checks `node.href != null`
- `framework/engine.zig` — `openUrl()` spawns `sh -c "xdg-open 'URL' &"`; click handler checks `h.href` after `on_press`; underline drawn after text for href nodes

## Compiler files

- `compiler/jsx.zig` — `href` parsed as string attribute, emitted as `.href = "..."` on Node

## Known limitations

- Linux only — uses `xdg-open`. macOS would need `open`, Windows would need `start`
- URL length capped at 2048 chars (stack buffer)
- Underline is a 1px rect drawn at 60% text color opacity — not a true text decoration
- No hover cursor change (no cursor API yet)
- No visited link tracking or color change
- `href` on a Box/div has no visual indicator — use on Text (underline) or Pressable (button style)
