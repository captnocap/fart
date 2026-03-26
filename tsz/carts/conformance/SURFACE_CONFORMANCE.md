# Surface Conformance Suite

Three tiers, same pixels. Every test produces identical visual output across all three files.

## File Naming

```
s{NN}a_{name}.tsz    — soup tier
s{NN}b_{name}.tsz    — mixed tier (today's framework)
s{NN}c_{name}.tsz    — chad tier (golden path)
```

## Tiers

### a — Soup

Real-world code from models with zero framework knowledge. These files are
copy-pasted from actual model output (Qwen 1.5B, untrained Haiku, etc).
They contain every sin: div soup, className, CSS imports, DOM APIs,
onclick typos, undefined variables, canvas.getContext, useEffect chains.

**DO NOT "FIX" THESE FILES.** They are intentional. They represent what
real users and AI models actually produce. The compiler's job is to make
them work anyway — gracefully mapping HTML tags, normalizing events,
rejecting impossible DOM APIs with clear errors. If a soup file compiles
and produces correct output, that's a win. If it fails, the error message
is the test.

### b — Mixed

Same app rewritten with today's framework surface. Box, Text, Pressable,
Canvas, Physics, Effect — whatever exists and works right now. Inline
styles, no classifiers. Uses `useState`, `<script>`, `function App()`.
This is "I read the docs but didn't commit."

### c — Chad (Manifest Syntax)

Same app rewritten as the golden path using **manifest syntax**. This is
the spec for what the framework should feel like.

**Key constructs:**

| Old (mixed) | New (chad) |
|---|---|
| `function App() { return (...) }` | `<page route=name>` ... `return(...)` ... `</page>` |
| `const [x, setX] = useState(v)` | `<var>` `x is v` `</var>` + `<state>` `set_x` `</state>` |
| `<script>function f() {...}</script>` | `<functions>` `f:` body `</functions>` |
| `setX(value)` | `set_x to value` |
| `x === y` | `x exact y` |
| `if (x === '') return;` | `x exact '' ? stop : go` |
| `{items.map((item) => (...))}` | `<For each=items>` ... `</For>` |
| `onPress={handler}` | `onPress=handler` |
| `setInterval(() => {...}, 33)` | `<timer interval=33>` fn `</timer>` |
| `import X from './Y'` | `from './Y'` |
| Sub-component functions | Inline content in `<For>` / ternaries |
| `Physics.Body` + `Physics.Collider` + visual | `Physics.Wall` / `Physics.Ball` / `Physics.Box` |
| `3D.Mesh geometry="box"` | `3D.Cube` / `3D.Sphere` / `3D.Floor` / `3D.Cylinder` |
| Inline `onRender` callback | `<Effect name="...">` from `.effects.tsz` |
| Emoji characters | `:name:` shortcodes from `.glyphs.tsz` |

**Functions block rules:**
- No braces, no semicolons. Colon starts body.
- `funcName:` for no-arg, `funcName(args):` for args.
- Body is indented lines. Last expression is return value.
- `set_x to value` for state mutation.
- `condition ? stop : go` for guards (early exit).
- `func1 + func2` for composition (run both sequentially).
- Functions reference vars and other functions by name.

**Classifier system:**
- `.cls.tsz` — base classifiers (`classifier({...})`)
- `.tcls.tsz` — theme tokens (`theme('name', {...})`)
- `.vcls.tsz` — variant overrides (`variants({...})`)
- `.effects.tsz` — named pixel effects (`effects({...})`)
- `.glyphs.tsz` — named inline vector atoms (`glyphs({...})`)
- All use `theme-*` tokens instead of hardcoded hex values.

**Ambient namespaces** (no import needed):
`sys.*`, `time.*`, `device.*`, `locale.*`, `privacy.*`, `input.*`, `math.*`

## Tests

| # | Name | Covers |
|---|------|--------|
| 01 | counter | state, handlers, styled card |
| 02 | todo | lists, filtering, text input, CRUD |
| 03 | chat | scroll, message list, input bar |
| 04 | dashboard | stat cards, data display, status badges |
| 05 | settings | sidebar nav, forms, toggles |
| 06 | kanban | columns, cards, move between lists |
| 07 | node_editor | Canvas, nodes, edges, selection, drag |
| 08 | chart | Canvas viewBox, data-driven paths |
| 09 | physics_sim | Physics.World, Physics.Wall/Ball, timer |
| 10 | pixel_effect | Named Effect, textEffect |
| 11 | text_icons | inline shortcodes, named glyphs, effect text spans |
| 12 | 3d_scene | Scene3D, 3D.Cube/Sphere/Floor/Cylinder |
| 13 | music_player | progress bar, transport controls, computed values |
| 14 | file_browser | tree view, file list, breadcrumbs |
| 15 | spreadsheet | grid, cell selection, computed display |

## Shared Assets

Chad-tier tests import from the manifest's satellite files:
- `s00c_manifest.cls.tsz` — classifiers with theme tokens
- `s00c_manifest.tcls.tsz` — theme definitions (default, light, bios, win95)
- `s00c_manifest.vcls.tsz` — variant overrides (magazine, brutalist, bios, win95)
- `s00c_manifest.effects.tsz` — named effects (plasma, lava, ocean, ember)
- `s00c_manifest.glyphs.tsz` — named inline assets (check, warning, star, flame, etc.)

The manifest itself (`s00c_manifest.tsz`) is the vocabulary spec — every syntax
construct, every module binding, every ambient namespace in one file.
