# TextInput and TextArea

`TextInput` is the single-line text entry primitive.

`TextArea` is the multiline form. In the compiler it lowers to multiline `TextInput`.

## Supported attrs

- `style`
- `fontSize`
- `placeholder`
- `onChangeText`
- `onSubmit`
- `tooltip`
- `hoverable`

`TextArea` uses the same parsed attrs, but Enter inserts newlines instead of submitting.

## Runtime behavior

The runtime input system currently provides:

- compile-time input IDs
- focus tracking
- text buffers
- cursor movement
- text selection
- placeholder rendering
- single-line submit on Enter
- multiline newline insertion for `TextArea`

## Important caveat: `value`

`value={...}` appears in several carts, but `tsz/compiler/jsx.zig` does not currently parse a `value` prop.

That means:

- controlled input is not a documented supported surface yet
- examples using `value` are ahead of the actual compiler/runtime API

Until this is implemented, document and treat `TextInput` as an internal-state input surface rather than a controlled React-style input.

## Examples

Single-line:

```tsx
<TextInput
  placeholder="Type here..."
  fontSize={11}
  style={{ height: 28, paddingLeft: 6, paddingRight: 6 }}
  onChangeText={() => {}}
  onSubmit={() => {}}
/>
```

Multiline:

```tsx
<TextArea
  placeholder="Write something..."
  fontSize={11}
  style={{ height: 80, padding: 6 }}
/>
```

## HTML aliases

- `input` resolves to `TextInput`
- `textarea` currently resolves through the HTML alias layer to `TextInput`

For explicit multiline behavior in `.tsz`, prefer `TextArea`.

## Source files

- `tsz/compiler/jsx.zig`
- `tsz/framework/input.zig`
- `tsz/framework/engine.zig`
- `tsz/compiler/html_tags.zig`
