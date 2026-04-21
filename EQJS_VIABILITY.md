# EQJS cart viability survey

## 1. Summary

No real `.tsx` cart transpiled cleanly through the current vendored EQJS path. Both surveyed carts failed immediately on the first token of the esbuild output: a top-level arrow-function IIFE wrapper, `(() => {`, at line 1. That means the current blocker is not cart-specific React logic; it is baseline modern bundle syntax emitted before any cart code runs. The generated bundles also contain optional chaining and nullish coalescing later in the file, so even after the first syntax blocker there are confirmed additional parser/lowering gaps before bundled carts would be viable.

## 2. Per-cart table

| Cart | Bundle file | Bundle size (bytes) | Transpile status | First error | First unsupported construct |
| --- | --- | ---: | --- | --- | --- |
| `cart/text_chop_test.tsx` | `bundle-text_chop_test.js` | 873903 | failed (`exit=1`) | `EQJS parse error in bundle-text_chop_test.js:1:3-3: UnexpectedToken` | top-level arrow-function IIFE: `(() => {` |
| `cart/tooltip_test.tsx` | `bundle.js` | 875785 | failed (`exit=1`) | `EQJS parse error in bundle.js:1:3-3: UnexpectedToken` | top-level arrow-function IIFE: `(() => {` |

### Error excerpts

`text_chop_test`

```text
EQJS parse error in bundle-text_chop_test.js:1:3-3: UnexpectedToken
  (() => {
  ^
```

`tooltip_test`

```text
EQJS parse error in bundle.js:1:3-3: UnexpectedToken
  (() => {
  ^
```

### Bundle search around the failing construct

`bundle-text_chop_test.js`

```text
1:(() => {
3:  var __esm = (fn, res) => function __init() {
6:  var __commonJS = (cb, mod) => function __require() {
```

`bundle.js`

```text
1:(() => {
3:  var __esm = (fn, res) => function __init() {
6:  var __commonJS = (cb, mod) => function __require() {
```

## 3. Gaps by category

### Proven blocker from this survey

- Arrow functions / arrow-function IIFE wrappers
  - Both bundles fail at byte 1 on `(() => {`.
  - This is emitted by the bundling step before any cart-specific logic runs.
  - As a result, no surveyed cart reaches later syntax or semantics.

### Confirmed additional bundle syntax present after the first blocker

- Optional chaining
  - Seen in both bundles, for example:
    - `err?.stack`
    - `g.console?.error`
    - `COLORS[family]?.[shade]`
- Nullish coalescing
  - Seen in both bundles, for example:
    - `RADIUS[val] ?? void 0`
    - `trans.active = trans.active ?? true`

### Not counted as blockers from this survey

- Class syntax
- Destructuring
- Spread
- Async / await
- Template literals

Those may or may not matter for real carts, but this survey did not prove them as blockers because the transpiler aborts before reaching cart logic or later sections of the bundle. The searches run here were only used to confirm visible next-step syntax, not to claim full syntax inventory.

## 4. Lift per gap

| Gap | Evidence | Likely lift | Why |
| --- | --- | --- | --- |
| Arrow functions | hard failure at line 1 in both bundles | medium | Parser + emitter work in `deps/eqjs/eqjs_transpiler.zig`; needs function-expression lowering and likely expression-body support |
| Optional chaining | present later in both bundles | medium | Parser + lowering work; requires short-circuit semantics, not just token acceptance |
| Nullish coalescing | present later in both bundles | medium | Parser + lowering work; requires correct `null`/`undefined` semantics rather than a plain boolean fallback |
| “Default esbuild bundle syntax” as a target | both bundles blocked before app code | large | Not one syntax patch; requires enough modern-JS coverage to parse and lower real bundled output end-to-end |

## 5. Recommendation

**not worth pursuing now — dominant gaps are large-lift**

Reasoning:

- The failure is not inside app logic. It happens at the bundle wrapper emitted by the normal ReactJIT build path.
- Even if arrow functions were added, the same bundles already contain optional chaining and nullish coalescing later on.
- That means the current EQJS transpiler is still below the minimum syntax floor needed for real bundled carts.
- This is not a fundamental mismatch between LuaJIT and ReactJIT. It is a syntax-coverage gap in the transpiler. But the gap is large enough that this survey does not justify immediate integration work.

If this line of work is revisited, the next experiment should be another survey only after the transpiler can parse:

1. arrow functions
2. optional chaining
3. nullish coalescing

Until then, real `.tsx` carts are not viable inputs for EQJS through the current ReactJIT bundle path.
