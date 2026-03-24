# TSZ Primitives Overview

This folder documents the current primitive-facing API in `tsz/` from the code that actually parses, lowers, and runs it.

## What counts as a primitive here

The core UI primitives are:

- `Box`
- `Text`
- `Image`
- `Pressable`
- `ScrollView`
- `TextInput`
- `TextArea`

These are the surfaces most app code composes directly.

## Important distinction

Not every accepted JSX tag should be documented like a core primitive.

- Some tags are only parser/validator declarations.
- Some tags lower into another primitive.
- Some tags are API systems with sub-surfaces of their own.

Examples:

- `ScrollView` lowers to `Box` with `overflow: auto`.
- `TextArea` lowers to multiline `TextInput`.
- `Canvas` is a system, not just a leaf primitive. See [`../systems/canvas.md`](../systems/canvas.md).

## Source of truth

- `tsz/compiler/validate.zig`
- `tsz/compiler/jsx.zig`
- `tsz/compiler/attrs.zig`
- `tsz/framework/layout.zig`
- `tsz/framework/engine.zig`
- `tsz/framework/input.zig`

## Docs in this folder

- `style-reference.md`
- `box.md`
- `text.md`
- `pressable.md`
- `scrollview.md`
- `textinput.md`
- `image.md`

## Known caveat

`TextInput value={...}` appears in several carts, but `tsz/compiler/jsx.zig` does not currently parse a `value` prop. Treat controlled input as unsupported until the compiler/runtime surface is implemented.
