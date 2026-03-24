# TSZ Primitive API Map

This is a source map for the current primitive-facing API in `tsz/`.

It is not the cleaned-up user documentation yet. The goal here is to answer:

- what primitives exist
- where their syntax is accepted
- where their props/styles are lowered
- where runtime behavior actually lives
- which docs/examples already exist
- which areas are missing or drifting

One important distinction for the next pass:

- a tag can exist in validation/declarations without constituting a real usable API surface
- some surfaces are not just “primitives” but actual API systems with their own internal sub-surfaces and composition model

Examples:

- `TextInput value={...}` currently appears in carts, but that does not mean the compiler/runtime surface actually supports it
- `Canvas` is not just a leaf primitive; it is an API system with sub-surfaces like `Canvas.Node`, `Canvas.Path`, and `Canvas.Clamp`

The docs should explicitly distinguish:

- declared surface
- compiler-lowered surface
- runtime-backed surface
- system-level API surface

## Primary source files

### Compiler acceptance and lowering

- `tsz/compiler/validate.zig`
  - Canonical primitive allowlist for validation.
  - Current list includes `Box`, `Text`, `Image`, `Video`, `Render`, `Pressable`, `ScrollView`, `TextInput`, `TextArea`, `Canvas`, `Effect`, `Physics`, `Terminal`, `Graph`.
  - Important: presence here only proves declaration/acceptance, not full runtime-backed API completeness.
- `tsz/compiler/html_tags.zig`
  - HTML tag aliases to primitives.
  - Important because some user-facing surface is effectively documented by alias support, not primitive names.
- `tsz/compiler/jsx.zig`
  - Main primitive attribute parser.
  - Resolves HTML tags and classifiers.
  - Lowers `ScrollView` to `Box + overflow: auto`.
  - Lowers `TextArea` to multiline `TextInput`.
  - Emits handlers, `href`, `tooltip`, placeholder, image/video/render sources, etc.
- `tsz/compiler/attrs.zig`
  - Style parsing and normalization.
  - Real source of truth for supported style keys, enum values, color keys, theme tokens, transition syntax.
- `tsz/compiler/lint.zig`
  - Useful secondary source for what the compiler considers valid, suspicious, or unsupported.
  - Contains warnings/errors for unsupported shorthand and unknown style properties.

### Runtime semantics

- `tsz/framework/layout.zig`
  - Source of truth for `Style` and `Node` fields after lowering.
  - Best place to derive the actual style/property surface.
- `tsz/framework/engine.zig`
  - Paint/runtime behavior for text, links, text input, opacity, media, effects, terminal, 3D.
- `tsz/framework/input.zig`
  - `TextInput` and `TextArea` state model: focus, cursor, selection, submit/change behavior.
- `tsz/framework/events.zig`
  - Interactive behavior and hit testing, especially for `Pressable` and `href`.

### Existing examples/specs

- `tsz/carts/`
  - Primary evidence for the real API surface in practice.
  - This is where features have been exercised, stretched, and regressed against over time.
- `tsz/carts/conformance/`
  - Good source for language and component-behavior edge cases.
- `tsz/carts/tools/`, `tsz/carts/browser/`, `tsz/carts/inspector/`, `tsz/carts/hackernews/`
  - Better than Storybook for “what the engine is actually expected to support”.
- `tsz/carts/wpt-flex/`
  - Layout behavior corpus for `Box`/`ScrollView` style semantics.
- `tsz/carts/storybook/Primitives_c.tsz`
  - Thin demo page, useful as a quick sample but not authoritative coverage.
- `tsz/carts/storybook/tiles/`
  - Small focused demos. Useful, but still secondary to the broader cart corpus.

## Primitive matrix

This section covers the core UI primitives first.

Not everything accepted by `validate.zig` belongs here. Some accepted tags are better documented as API systems or special built-in surfaces.

### Box

- Accepted as primitive: yes
- HTML aliases: many container tags map here (`div`, `section`, `article`, `main`, `aside`, `header`, `footer`, `nav`, `form`, `fieldset`, `figure`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `td`, `th`, `dl`, `dd`, `dt`, `dialog`, `details`, `summary`, `figcaption`, plus `svg`, `video`, `audio`, `select`)
- Generic attrs from `jsx.zig`:
  - `style`
  - `tooltip`
  - `href`
  - `hoverable`
- Main behavior:
  - Pure layout/container primitive.
  - Also the lowered target for several special surfaces including `ScrollView`, `Video`, `Render`, `Effect`, `Canvas`, `Graph`, and `Scene3D`.
- Existing docs/examples:
  - Broad usage across `tsz/carts/`
  - `tsz/carts/wpt-flex/`
  - `tsz/docs/flex-layout-features.md`
  - `tsz/docs/opacity.md`
  - `tsz/docs/transforms.md`
  - `tsz/docs/animations.md`
- Gaps:
  - No single “Box API” doc that separates layout props from paint props from transform props.

### Text

- Accepted as primitive: yes
- HTML aliases: `span`, `p`, `label`, `h1`-`h6`, `strong`, `em`, `b`, `i`, `u`, `small`, `code`, `pre`, `blockquote`, `a`, `time`, `abbr`, `cite`, `mark`, `sub`, `sup`, `del`, `ins`, `kbd`, `samp`
- Generic attrs:
  - `style`
  - `tooltip`
  - `href`
  - `hoverable`
- Text-specific attrs from `jsx.zig`:
  - `fontSize`
  - `color`
  - `letterSpacing`
  - `lineHeight`
  - `numberOfLines`
  - `noWrap`
- Runtime behavior:
  - Underline is painted for `href`.
  - Text rendering uses `drawTextWrapped`.
- Existing docs/examples:
  - Broad usage across `tsz/carts/`
  - `tsz/docs/hyperlinks.md`
  - `tsz/docs/html-tag-support.md`
- Gaps:
  - No dedicated text API doc for wrapping, truncation, alignment, line metrics, and `href` behavior.
  - Text props are easy to confuse with style props; current HTML-tag doc calls this out but only partially.

### Image

- Accepted as primitive: yes
- HTML alias: `img`
- Primitive-specific attrs from `jsx.zig`:
  - `src`
- Generic attrs:
  - `style`
  - `tooltip`
  - `href`
  - `hoverable`
- Runtime behavior:
  - `src` resolves relative to the input file path during compile.
- Existing docs/examples:
  - No dedicated primitive doc found.
  - Little obvious cart-level coverage surfaced in this pass.
- Gaps:
  - This is the most obvious primitive-doc hole.
  - Needs a clean doc for source resolution, sizing expectations, and interaction with layout styles.

### Pressable

- Accepted as primitive: yes
- HTML alias: `button`
- Primitive-specific attrs from `jsx.zig`:
  - `onPress`
  - `onRightClick`
  - `href`
- Generic attrs:
  - `style`
  - `tooltip`
  - `hoverable`
- Main behavior:
  - Emits handler functions from JSX bodies.
  - Can also function as a hyperlink if `href` is present.
- Existing docs/examples:
  - Many usage examples across `tsz/carts/conformance/`
  - Broad usage across `tsz/carts/`
  - `tsz/docs/hyperlinks.md`
- Gaps:
  - No dedicated Pressable doc describing event semantics, handler lowering, right-click support, and `href` interaction ordering.

### ScrollView

- Accepted as primitive: yes
- Lowering:
  - `jsx.zig` treats `ScrollView` as `Box` with injected `style.overflow = .auto`
- Primitive-specific attrs:
  - No dedicated prop parser beyond normal `style`
- Existing docs/examples:
  - Broad usage across `tsz/carts/`
  - `tsz/docs/flex-layout-features.md`
  - `tsz/docs/nested-maps.md`
  - `tsz/docs/STORYBOOK_HOMEPAGE.md`
  - `tsz/carts/wpt-flex/60_nested_scroll.tsz`
- Gaps:
  - The lowering is only obvious in code, not in one clean API document.
  - Needs a doc that explicitly explains “ScrollView is a Box with overflow semantics” and the height/flex constraints that matter in practice.

### TextInput

- Accepted as primitive: yes
- HTML alias: `input`
- Primitive-specific attrs from `jsx.zig`:
  - `placeholder`
  - `onChangeText`
  - `onSubmit`
  - `fontSize`
- Generic attrs:
  - `style`
  - `tooltip`
  - `hoverable`
- Runtime behavior from `framework/input.zig` and `framework/engine.zig`:
  - compile-time `input_id`
  - focus state
  - cursor movement
  - selection
  - submit-on-enter for single-line input
  - placeholder rendering
- Existing docs/examples:
  - Examples exist across app carts, tools, browser, and Storybook tiles.
  - No dedicated doc found.
- Important drift:
  - App/cart code uses `value={...}` in several places.
  - `tsz/compiler/jsx.zig` does not parse a `value` attribute at all.
  - This means “controlled input” is part of the apparent surface by usage, but not part of the actual compiler surface.
- Gaps:
  - Needs a real API doc.
  - Needs a decision on whether `value` is unsupported, planned, or currently broken.

### TextArea

- Accepted as primitive: yes
- HTML alias in `html_tags.zig`:
  - HTML `textarea` currently maps to `TextInput`
- Lowering:
  - `jsx.zig` treats `TextArea` as multiline `TextInput`
- Primitive-specific attrs:
  - same parser surface as `TextInput`
  - multiline behavior comes from `input.registerMultiline`
- Existing docs/examples:
  - Example exists in Storybook tiles; likely more implicit coverage in carts using multiline editing surfaces.
  - No dedicated doc found.
- Gaps:
  - Needs to be documented together with `TextInput`, but with explicit multiline differences.

## API systems and special surfaces

These are accepted tags, but they should not be documented as if they were equivalent to the core six UI primitives.

### Canvas

- Classification:
  - System-level API surface, not just a single primitive
- Accepted tags:
  - `Canvas`
  - `Canvas.Node`
  - `Canvas.Path`
  - `Canvas.Clamp`
- Compiler-backed attrs in `jsx.zig`:
  - `Canvas`
    - `type`
    - `viewX`
    - `viewY`
    - `viewZoom`
    - `driftX`
    - `driftY`
    - `style`
  - `Canvas.Node`
    - `gx`
    - `gy`
    - `gw`
    - `gh`
    - plus normal node children/content
  - `Canvas.Path`
    - `d`
    - `stroke`
    - `strokeWidth`
    - `flowSpeed`
  - `Canvas.Clamp`
    - marker surface, no dedicated attrs beyond declaration
- Runtime shape:
  - This is a graph-space/view-space API with its own composition model.
  - Users can build node/path/clamp structures rather than just styling a box.
- Documentation implication:
  - `Canvas` should get system documentation, not just a primitive prop table.
  - The doc should clearly separate viewport/container behavior from node/path/clamp behavior.

### Graph

- Classification:
  - System-like surface adjacent to `Canvas`
- Accepted tags:
  - `Graph`
  - `Graph.Node`
  - `Graph.Path`
- Compiler-backed attrs in `jsx.zig`:
  - shares much of the canvas view/path lowering
- Documentation implication:
  - likely belongs with `Canvas` in a systems section, not the core primitive section

### Other accepted built-ins that need classification before documentation

- `Video`
- `Render`
- `Effect`
- `Physics`
- `Terminal`
- `Graph`

For each of these, the docs should answer:

- is this just a declarative surface marker
- does it expose a real sub-API
- is the runtime behavior complete enough to document as supported
- should it live with primitives or with systems

## Generic cross-primitive surfaces

These surfaces are not owned by a single primitive doc and should probably become shared reference docs.

### Style surface

Derived from `tsz/compiler/attrs.zig` and `tsz/framework/layout.zig`.

#### Numeric/layout keys

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

#### Color keys

- `backgroundColor`
- `borderColor`
- `shadowColor`
- `gradientColorEnd`

#### Enum keys

- `flexDirection`
- `justifyContent`
- `alignItems`
- `alignSelf`
- `alignContent`
- `flexWrap`
- `position`
- `display`
- `textAlign`
- `overflow`
- `gradientDirection`

#### Important linted exclusions / traps

- Unsupported shorthand:
  - `paddingHorizontal`
  - `paddingVertical`
  - `marginHorizontal`
  - `marginVertical`
- Kebab-case style keys trigger warnings and are normalized only in some paths.
- `transition` object syntax is supported, but string shorthand is not.

### Generic attrs

Observed in `jsx.zig`:

- `style`
- `tooltip`
- `href`
- `hoverable`

These should probably get their own shared documentation section instead of being repeated inside every primitive page.

### HTML tag compatibility layer

Existing documentation:

- `tsz/docs/html-tag-support.md`

This doc is useful, but should be treated as an alias layer doc, not the primitive reference itself.

## Existing doc coverage

### Already documented reasonably well

- HTML aliases: `tsz/docs/html-tag-support.md`
- Hyperlinks / `href`: `tsz/docs/hyperlinks.md`
- Flex/layout features: `tsz/docs/flex-layout-features.md`
- Opacity: `tsz/docs/opacity.md`
- Transforms: `tsz/docs/transforms.md`
- Animations/transitions: `tsz/docs/animations.md`

### Partially documented through examples only

- Box
- Text
- Pressable
- ScrollView
- TextInput
- TextArea

### Effectively undocumented

- Image
- Shared primitive attribute reference
- Shared style property reference

## Drift and risk list

### Storybook should not be treated as the primitive spec

- `tsz/carts/storybook/Primitives_c.tsz` is a thin demo page, not the authoritative documentation surface.
- The stronger evidence for the API is the wider cart corpus, especially:
  - `tsz/carts/conformance/`
  - `tsz/carts/tools/`
  - `tsz/carts/browser/`
  - `tsz/carts/inspector/`
  - `tsz/carts/wpt-flex/`
- Storybook gaps are still worth noting for discoverability, but they should not drive the API map.

### `value` looks supported by usage but not by compiler

- Found in:
  - `tsz/carts/browser/browser.tsz`
  - `tsz/carts/tools/Dashboard_c.tsz`
  - `tsz/carts/tools/TestRunner_c.tsz`
  - `tsz/carts/storybook/tiles/FormTile_c.tsz`
  - `tsz/carts/storybook/tiles/TerminalTile_c.tsz`
- Not parsed in:
  - `tsz/compiler/jsx.zig`
- This should be resolved before writing polished user docs, otherwise the docs will either lie or cement a bug.

### Primitive list vs “core six” language

- Validation allowlist contains more than the six core primitives.
- For docs, we should distinguish:
  - core UI primitives
  - adjacent built-in surfaces (`Video`, `Render`, `Canvas`, `Effect`, `Physics`, `Terminal`, `Graph`)
  - declared-but-thin surfaces vs actual runtime-backed API systems

### Declaration vs real API surface

- Do not treat parser/validator acceptance alone as proof of a supported public API.
- For each area, the doc pass should verify:
  - declaration in validation
  - attribute parsing in compiler
  - lowering into node/runtime fields
  - actual runtime behavior
- If a surface only extends as far as declarations or partial lowering, document that explicitly instead of implying full support.

## Recommended doc-writing order

1. Shared primitive conventions
   - generic attrs
   - style props
   - HTML aliases
2. Box
3. Text
4. Pressable
5. ScrollView
6. TextInput + TextArea
7. Image
8. Separate “API systems and special surfaces” docs for non-core primitives like `Canvas`

## Proposed deliverables for the next pass

- `tsz/docs/primitives/overview.md`
- `tsz/docs/primitives/box.md`
- `tsz/docs/primitives/text.md`
- `tsz/docs/primitives/pressable.md`
- `tsz/docs/primitives/scrollview.md`
- `tsz/docs/primitives/textinput.md`
- `tsz/docs/primitives/image.md`
- `tsz/docs/primitives/style-reference.md`

Before writing those, confirm whether `TextInput value` should be implemented or documented as unsupported.
