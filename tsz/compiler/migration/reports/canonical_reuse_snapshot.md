Snapshot recorded: 2026-04-09 (step 57)

# Fragile Function Reuse Map

Generated: 2026-04-08

Scope:
- This is the second-pass overlap analysis for `FRAGILE_FUNCTION_DECOMPOSITION_MAP.md`.
- The goal here is not to split one function smaller. The goal is to identify where multiple fragile functions are doing the same job under different local names.
- Reuse is only proposed when the semantic job is the same. Similar-looking loops are not enough on their own.

Working rule:
- Extract shared semantic layers first.
- Keep backend-specific serialization local.
- Do not force Zig, Lua, and QJS output paths into one mega-helper.

## Canonical Shape

Most fragile functions in this compiler currently mix four jobs:
- scan tokens or source text
- resolve meaning against `ctx`
- register compiler side effects
- serialize backend-specific output

The best reuse pass changes the shape of those functions into:
- `scan`
- `resolve`
- `register`
- `serialize`

That is the main structural change to aim for. Most of the overlap sits in the middle two stages.

## Reuse Families

### 1. Identity And Field Resolution

Overlaps:
- `smith/attrs.js` → `parseStyleValue`, `parseValueExpr`, `luaParseValueExpr`, `luaParseHandler`
- `smith/parse/element/attrs_text_color.js` → `tryParseTextColorAttr`
- `smith/parse/element/component_brace_values.js` → `parseComponentBraceValue`
- `smith/parse/template_literal.js` → `_resolveTemplateExpr`
- `smith/parse/brace/conditional.js` and `smith/parse/brace/ternary.js`
- `smith/resolve/field_access.js` → `resolveField`
- `smith/core.js` → `peekPropsAccess`, `resolveConstOaAccess`, `resolveConstOaFieldFromRef`

Shared layer to introduce:
- `resolveValueRef(input, ctx, mode)`
- `resolveFieldPath(base, path, ctx, mode)`
- `resolvePropsRef(c, ctx)`
- `resolveConstOaRef(c, ctx)`

What is actually reusable:
- resolving identifier kind: slot, prop, render-local, map item, map index, OA, QJS eval
- resolving `.field` and `.length`
- resolving prop indirection and const OA bracket access
- choosing whether result is compile-time Zig, Lua-safe, or runtime eval

What stays local:
- whether the caller is building a color expression, a style value, a template argument, or a child node

Shape change:
- `tryParseTextColorAttr` becomes an attr shell that asks for `lhs` and `rhs` refs, then only builds the color conditional and dyn-style registration
- `parseComponentBraceValue` becomes a token fold over `resolveNextValueChunk`
- `_resolveTemplateExpr` becomes dispatch over resolved value kinds instead of reimplementing path logic

### 2. Map And Object-Array Access

Overlaps:
- `smith/parse/map/header.js` → `tryParseMapHeader`
- `smith/parse/children/brace_maps.js` → `_tryParseComputedChainMap`
- `smith/parse/children/brace_computed.js` → `_ensureSyntheticComputedOa`
- `smith/parse/children/brace.js`
- `smith/parse/element/component_brace_values.js`
- `smith/parse/template_literal.js`
- `smith/resolve/field_access.js`

Shared layer to introduce:
- `scanMapChain(c)` or `scanMapChainExpr(expr)`
- `parseMapCallbackSignature(c)`
- `resolveMapAccess(nameOrPath, ctx, mode)`
- `ensureComputedOa(plan, ctx)`
- `registerLuaMapWrapper(plan, ctx)`

What is actually reusable:
- finding `.map(...)` after field/slice/filter/sort chains
- extracting item/index params and filter conditions
- resolving `item.field`, parent-map indexes, and nested-array map refs
- synthesizing OA metadata for computed expressions

What stays local:
- whether the caller emits JSX children, template args, component props, or Lua map rebuilders

Shape change:
- `_tryParseComputedChainMap` becomes route planning plus wrapper registration
- `tryParseMapHeader` becomes pure callback-signature parsing
- `_ensureSyntheticComputedOa` becomes OA schema builder only, not half schema builder and half map parser

### 3. Conditional And Ternary Assembly

Overlaps:
- `smith/parse/brace/conditional.js` → `tryParseConditional`
- `smith/parse/brace/ternary.js` → `tryParseTernaryJSX`
- `smith/parse/element/attrs_text_color.js`
- `smith/attrs.js` → style/value ternaries
- `smith/parse/template_literal.js`
- `smith/lanes/soup/codegen.js` → `soupExprToZig`
- `smith/emit/runtime_updates.js` for runtime application of registered conditionals

Shared layer to introduce:
- `parseConditionExpr(c, ctx, mode)`
- `normalizeConditionForBackend(cond, backend)`
- `buildConditionalValue(cond, truthy, falsy, mode)`
- `registerConditionalBranchSet(kind, branches, ctx)`

What is actually reusable:
- condition token parsing
- string-comparison normalization
- Lua-safe condition rewriting
- branch registration shape for show/hide vs true/false vs multi-branch chains

What stays local:
- how a branch payload is represented: child node, color value, style field, or template arg

Shape change:
- `tryParseTernaryJSX` becomes `parse branch chain -> register branch set -> emit child wrappers`
- `tryParseConditional` becomes `parse condition -> route payload`
- color/style/template ternary handlers stop owning their own condition normalizers

### 4. Dynamic Value Registration

Overlaps:
- `smith/parse/children/brace.js`
- `smith/parse/element/attrs_text_color.js`
- `smith/lanes/soup/codegen.js`
- `smith/page.js` → `appendPageDynTextBridge`
- `smith/emit/runtime_updates.js`
- `smith/emit_ops/rebuild_map.js`

Shared layer to introduce:
- `registerDynText(spec, ctx)`
- `registerDynStyle(spec, ctx)`
- `registerDynColor(spec, ctx)`
- `bindDynTarget(reg, arrName, arrIndex)`
- `registerMapDynText(spec, ctx)`

What is actually reusable:
- allocating dyn IDs
- storing format strings, args, and buffer sizes
- tracking deferred target binding
- keeping map and non-map registrations structurally consistent

What stays local:
- when a parser decides a value is dynamic
- how the emitted node placeholder should look

Shape change:
- parser functions stop directly mutating `ctx.dynTexts`, `ctx.dynStyles`, `ctx.dynColors`
- parser functions instead ask a registry for an ID and then attach only the local node metadata
- `emitRuntimeSupportSections` becomes a renderer for registry records, not a compensating collector

### 5. Handler Pipeline

Overlaps:
- `smith/attrs.js` → `parseHandler`, `luaParseHandler`
- `smith/parse/handlers/press.js` → `pushInlinePressHandler`, `bindPressHandlerExpression`
- `smith/emit/logic_blocks.js`
- `smith/emit_ops/transforms.js` → `luaTransform`

Shared layer to introduce:
- `captureHandlerSource(c)`
- `compileHandlerBodies(source, ctx)`
- `classifyHandlerDispatch(compiled, ctx)`
- `registerHandlerRecord(rec, ctx)`

What is actually reusable:
- raw source capture
- closure param capture
- Zig/Lua/JS body production
- deciding whether handler can stay Zig or must delegate to JS/Lua

What stays local:
- attr-specific binding behavior
- map-handler vs non-map emission details

Shape change:
- `pushInlinePressHandler` becomes record assembly instead of re-parsing the same handler body through multiple local scans
- `parseHandler` and `luaParseHandler` become backend compilers hanging off one handler-capture step
- `emitLogicBlocks` becomes pure serialization of already-classified handler records

### 6. Style Value Resolution

Overlaps:
- `smith/attrs.js` → `parseStyleValue`, `parseStyleBlock`
- `smith/parse/element/attrs_text_color.js`
- `smith/emit_ops/emit_lua_style.js`
- `smith/collect/classifiers.js` → classifier style assignment

Shared layer to introduce:
- `resolveStyleScalar(key, input, ctx, mode)`
- `resolveColorValue(input, ctx, mode)`
- `normalizeStyleAssignment(key, value, ctx)`
- `splitNodeFieldFromStyleField(key, normalized)`

What is actually reusable:
- key normalization
- color parsing
- percent/enum/numeric handling
- deciding whether a style belongs on `Node.Style` or node-level fields

What stays local:
- cursor walking for JSX style objects vs string-line parsing inside classifier blocks vs Lua object serialization

Shape change:
- `parseStyleBlock` becomes object walker plus calls into a style resolver
- `emitLuaStyle` becomes serializer over normalized style assignments instead of re-deriving meaning from raw values
- classifier parsing can emit the same normalized style records the JSX path uses

### 7. Runtime Eval Classification

Overlaps:
- `smith/parse/element/component_brace_values.js`
- `smith/collect/render_locals.js`
- `smith/parse/template_literal.js`
- `smith/attrs.js`
- `smith/emit_ops/transforms.js`

Shared layer to introduce:
- `classifyExprBackend(expr, ctx)`
- `buildRuntimeEval(expr, ctx, targetBackend)`
- `expandRenderLocalExpr(expr, ctx)`
- `extractEvalInner(expr)`

What is actually reusable:
- deciding compile-time vs Zig expr vs QJS eval vs Lua runtime
- render-local expansion
- converting stored eval wrappers back into inner expressions

What stays local:
- final backend string formatting

Shape change:
- callers stop open-coding `isEval`, `extractInner`, raw render-local expansion, and “if scriptBlock then eval” checks
- many large parse functions lose a whole class of fallback branches

### 8. Emit Feature Planning And Section Orchestration

Overlaps:
- `smith/emit.js` → `emitOutput`
- `smith/emit/runtime_updates.js`
- `smith/emit/entrypoints.js`
- `smith/emit/logic_blocks.js`
- `smith/emit_ops/emit_variant_patch.js`

Shared layer to introduce:
- `computeEmitFeatures(ctx)`
- `buildRuntimePlan(ctx, features)`
- `renderEmitSections(plan, ctx)`
- `renderEntrypoints(plan, ctx)`

What is actually reusable:
- feature flag derivation
- section ordering
- runtime refresh requirements
- app init/tick/export planning

What stays local:
- actual string emission for each section

Shape change:
- `emitOutput` becomes a top-level composer
- `emitRuntimeSupportSections` becomes a renderer for a runtime plan
- `emitRuntimeEntrypoints` becomes a renderer for an entrypoint plan, not a second place that re-derives features

## Shape Changes By Function Cluster

### Parser Hotspots

Target shape:
- small token walker
- call shared resolution layer
- register dyn/conditional/map side effects
- emit local node/value result

Functions most improved by this:
- `tryParseTextColorAttr`
- `parseComponentBraceValue`
- `tryParseBraceChild`
- `tryParseTernaryJSX`
- `tryParseConditional`

### Emit Hotspots

Target shape:
- compute features once
- build section plans once
- render sections in order
- no re-derivation in downstream emitters

Functions most improved by this:
- `emitOutput`
- `emitRuntimeSupportSections`
- `emitRuntimeEntrypoints`
- `emitLogicBlocks`
- `emitVariantPatch`

### Mod/Effect Transpilers

Target shape:
- statement classifier
- expression rewriter
- block renderer

Functions most improved by this:
- `emitModBody`
- `emitFunctionBody`
- `modTranspileExpr`
- `transpileEffectBody`

Notes:
- These overlap less with the JSX parser than the parser/emit clusters overlap with each other.
- Reuse here should stay inside the mod/effect transpile domain unless a shared expression normalizer is clearly identical.

## Best Extraction Order

1. Introduce a shared identity/field resolution layer.
2. Introduce dyn text/style/color registration helpers.
3. Introduce a shared conditional registry and backend normalizer.
4. Introduce a handler capture/classification pipeline.
5. Introduce emit feature planning and section plans.
6. Only then revisit style/classifier normalization and computed map synthesis for broader dedupe.

This order matters because the first three extractions remove the most duplicated decision logic across the hotspot files.

## Non-Goals

These look shared but are probably the wrong first extractions:
- generic brace-depth scanners
- generic token-stream walkers with callback soup
- forcing Lua and Zig serializers to share output string builders
- merging mod/effect transpilers directly into JSX expression resolution

The right reuse seam is semantic, not purely mechanical.
