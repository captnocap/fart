# COMPILER_MAP

Last updated: 2026-04-09.

This document maps the current Smith compiler from React-shaped intake patterns to internal contracts and then to emission atoms.

## Flow

1. Intake
   Primary live entrypoints are [smith/parse.js](./smith/parse.js), [smith/parse/children/brace.js](./smith/parse/children/brace.js), [smith/parse/element/component_props.js](./smith/parse/element/component_props.js), [smith/parse/element/attrs_handlers.js](./smith/parse/element/attrs_handlers.js), and the helper families under `smith/parse/`.

2. Contract fill
   Patterns and parser helpers lower React surface syntax into compiler contracts:
   - `nodeExpr` / `luaNode`
   - `children[]`
   - `propValues[attr]`
   - `ctx.handlers` / `handlerRef`
   - `ctx.stateSlots`
   - `ctx.dynTexts` / `ctx._jsDynTexts`
   - `ctx.maps` / `ctx.objectArrays`
   - `ctx.conditionals`
   - `ctx.renderLocals` / `ctx.propStack`

3. Emission
   [smith/emit.js](./smith/emit.js) chooses:
   - `emitLuaTreeApp()` in [smith/emit/lua_tree_emit.js](./smith/emit/lua_tree_emit.js) when `ctx._luaRootNode` is present
   - `runEmitAtoms()` in [smith/emit_atoms/index.js](./smith/emit_atoms/index.js) otherwise

## Atom Families

- `a001-a003`: preamble/imports
- `a004-a008`: state tree and static node declarations
- `a009-a011`: handlers and effects
- `a012-a018`: object array bridges/storage
- `a019-a032`: map metadata, Zig map pools, Lua map rebuilders
- `a033-a038`: JS/Lua logic blocks and runtime update functions
- `a039-a042`: init/tick/exports/main entrypoints
- `a043-a046`: split/finalize post-processing

## Registry Notes

- React compatibility patterns are loaded from `smith/patterns/`.
- Retired contract-pattern files `c001-c030` were intentionally removed and no longer participate in the bundle.
- The live pattern registry in [smith/patterns/index.js](./smith/patterns/index.js) is sparse and mainly used by brace-child parsing. Many component props, handlers, and element attributes still go through dedicated parser helpers instead of `tryPatternMatch()`.

## Pattern Map

Legend:
- Intake: where the pattern is recognized first in the live compiler.
- Contract: the main internal structure it fills.
- Atoms: the main atom families that materialize the result on the atom path.

### Primitives

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 001 | `smith/patterns/primitives/p001_string_literal.js` | string child literal | brace child / direct text child | `nodeExpr{text}` | `a006-a008` |
| 002 | `smith/patterns/primitives/p002_number_literal.js` | numeric child literal | brace child | `nodeExpr{text}` | `a006-a008` |
| 003 | `smith/patterns/primitives/p003_boolean_render.js` | boolean child swallowed | brace child | consume/no node | none |
| 004 | `smith/patterns/primitives/p004_null_render.js` | `null` child swallowed | brace child | consume/no node | none |
| 005 | `smith/patterns/primitives/p005_undefined_render.js` | `undefined` child swallowed | brace child | consume/no node | none |
| 006 | `smith/patterns/primitives/p006_jsx_element.js` | JSX element | `parseJSXElement()` | `nodeExpr`, `styleFields`, `nodeFields`, `children[]` | `a006-a008`, `a039-a042` |
| 007 | `smith/patterns/primitives/p007_fragment.js` | fragment | `tryParseFragmentElement()` / brace child | flattened `children[]` | `a006-a008` |
| 008 | `smith/patterns/primitives/p008_named_fragment.js` | keyed/named fragment | brace child | flattened `children[]`, fragment hint | `a006-a008`, `a019-a028` when inside maps |
| 009 | `smith/patterns/primitives/p009_variable_interpolation.js` | `{value}` in JSX | brace child | `nodeExpr{text}` or `dynTexts` | `a008`, `a035`, `a033-a034` |
| 010 | `smith/patterns/primitives/p010_expression_interpolation.js` | `{expr}` in JSX | brace child | `nodeExpr{text}`, `dynTexts`, `_jsDynTexts` | `a008`, `a033-a035` |

### Ternary

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 011 | `smith/patterns/ternary/p011_ternary_element.js` | ternary returning JSX | `tryParseTernaryJSX()` | `ctx.conditionals`, conditional child nodes | `a006-a008`, `a036` |
| 012 | `smith/patterns/ternary/p012_ternary_null.js` | ternary to null | `tryParseTernaryJSX()` / `tryParseTernaryText()` | conditional show/hide contract | `a036` |
| 013 | `smith/patterns/ternary/p013_ternary_string.js` | ternary to string | `tryParseTernaryText()` | `dynTexts` or conditional text node | `a008`, `a035-a036` |
| 014 | `smith/patterns/ternary/p014_ternary_nested.js` | nested ternary | brace child ternary parsing | nested conditional contract | `a036` |
| 015 | `smith/patterns/ternary/p015_ternary_fragment.js` | ternary to fragment | brace child ternary parsing | conditional child splice | `a006-a008`, `a036` |

### Logical

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 016 | `smith/patterns/logical/p016_and_short_circuit.js` | `cond && <X />` | `tryParseConditional()` | `ctx.conditionals`, conditional child nodes | `a006-a008`, `a036` |
| 017 | `smith/patterns/logical/p017_or_fallback.js` | `lhs || rhs` | brace child logical parsing | fallback expression / text contract | `a008`, `a033-a036` |
| 018 | `smith/patterns/logical/p018_nullish_fallback.js` | `lhs ?? rhs` | brace child logical parsing | fallback expression / text contract | `a008`, `a033-a036` |

### Maps

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 019 | `smith/patterns/map/p019_map_element.js` | `arr.map(x => <X />)` | `tryParseMap()` / brace child | `ctx.maps`, `ctx.objectArrays`, map node templates | `a019-a032` |
| 020 | `smith/patterns/map/p020_map_fragment.js` | map to fragment | `tryParseMap()` | `ctx.maps`, flattened map children | `a019-a032` |
| 021 | `smith/patterns/map/p021_map_nested.js` | nested `.map()` | `tryParseNestedMap()` | parent/child map linkage | `a019-a032` |
| 022 | `smith/patterns/map/p022_map_ternary.js` | map body with ternary | `tryParseMap()` + conditional parsing | map template + `ctx.conditionals` | `a019-a032`, `a036` |
| 023 | `smith/patterns/map/p023_map_and_filter.js` | map body with `&&` | `tryParseMap()` + conditional parsing | map template + `ctx.conditionals` | `a019-a032`, `a036` |
| 024 | `smith/patterns/map/p024_map_index_key.js` | index key in map | map parsing | key hint only; map stays OA-backed | `a019-a028` |
| 025 | `smith/patterns/map/p025_map_stable_key.js` | stable key in map | map parsing | key hint only; map stays OA-backed | `a019-a028` |
| 026 | `smith/patterns/map/p026_map_compound_key.js` | compound key in map | map parsing | key hint only; map stays OA-backed | `a019-a028` |
| 027 | `smith/patterns/map/p027_map_destructured.js` | destructured map params | map parsing | map item/index param remap | `a019-a032` |
| 028 | `smith/patterns/map/p028_map_implicit_return.js` | implicit return map body | map parsing | map node template | `a019-a032` |
| 029 | `smith/patterns/map/p029_map_explicit_return.js` | explicit return map body | map parsing | map node template | `a019-a032` |

### Filter / Sort Pipelines

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 030 | `smith/patterns/filter_sort/p030_filter_map.js` | `filter().map()` | brace child map-chain parsing | filtered map metadata | `a019-a032` |
| 031 | `smith/patterns/filter_sort/p031_sort_map.js` | `sort().map()` | brace child map-chain parsing | sorted map metadata | `a019-a032` |
| 032 | `smith/patterns/filter_sort/p032_filter_sort_map.js` | `filter().sort().map()` | brace child map-chain parsing | filtered/sorted map metadata | `a019-a032` |
| 033 | `smith/patterns/filter_sort/p033_reduce_jsx.js` | `reduce()` to JSX | brace child parsing | imperative/dynamic child contract | `a033-a035` or `a006-a008` depending on lowering |
| 034 | `smith/patterns/filter_sort/p034_slice_map.js` | `slice().map()` | brace child map-chain parsing | bounded map metadata | `a019-a032` |
| 035 | `smith/patterns/filter_sort/p035_slice_show_more.js` | paged slice/show-more | brace child map-chain parsing | bounded map metadata + state slot dependency | `a004-a005`, `a019-a032`, `a036` |
| 036 | `smith/patterns/filter_sort/p036_flat_map.js` | `flat().map()` | brace child map-chain parsing | flattened source metadata | `a019-a032` |
| 037 | `smith/patterns/filter_sort/p037_flatmap_element.js` | `flatMap()` | brace child map-chain parsing | flattened source metadata | `a019-a032` |
| 038 | `smith/patterns/filter_sort/p038_spread_concat_map.js` | spread-concat then map | brace child map-chain parsing | computed source metadata | `a019-a032`, `a033-a034` when eval-backed |

### Array Construction

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 039 | `smith/patterns/array_construction/p039_array_fill_map.js` | `Array(n).fill().map()` | brace child map-source parsing | synthetic array/map metadata | `a019-a032` |
| 040 | `smith/patterns/array_construction/p040_array_from_map.js` | `Array.from().map()` | brace child map-source parsing | synthetic array/map metadata | `a019-a032` |
| 041 | `smith/patterns/array_construction/p041_spread_array_map.js` | `[...Array(n)].map()` | brace child map-source parsing | synthetic array/map metadata | `a019-a032` |
| 042 | `smith/patterns/array_construction/p042_object_keys_map.js` | `Object.keys().map()` | brace child map-source parsing | key-array source metadata | `a019-a032` |
| 043 | `smith/patterns/array_construction/p043_object_values_map.js` | `Object.values().map()` | brace child map-source parsing | value-array source metadata | `a019-a032` |
| 044 | `smith/patterns/array_construction/p044_object_entries_map.js` | `Object.entries().map()` | brace child map-source parsing | entry-array source metadata | `a019-a032` |
| 045 | `smith/patterns/array_construction/p045_map_entries.js` | `Map.entries()` mapped | brace child map-source parsing | entry-array source metadata | `a019-a032` |
| 046 | `smith/patterns/array_construction/p046_set_to_array_map.js` | `Set` to array to map | brace child map-source parsing | synthetic array/map metadata | `a019-a032` |

### Props

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 047 | `smith/patterns/props/p047_string_prop.js` | string prop | `collectComponentPropValues()` / attr parsing | `propValues[attr]` string | consumed by inlining; downstream `a006-a008` |
| 048 | `smith/patterns/props/p048_number_prop.js` | numeric prop | component prop parsing | `propValues[attr]` number | `a006-a008` |
| 049 | `smith/patterns/props/p049_boolean_shorthand.js` | boolean shorthand | component/native attr parsing | `propValues[attr]` / style bool | `a006-a008`, `a036-a037` if dynamic |
| 050 | `smith/patterns/props/p050_boolean_explicit.js` | explicit boolean prop | prop parsing | `propValues[attr]` / style bool | `a006-a008`, `a036-a037` if dynamic |
| 051 | `smith/patterns/props/p051_expression_prop.js` | expression prop | component brace prop parsing | `propValues[attr]` expression / eval | `a006-a008`, `a033-a035` |
| 052 | `smith/patterns/props/p052_callback_prop.js` | callback prop | component handler prop parsing | `handlerRef`, `ctx.handlers` | `a009`, `a033-a034`, `a039-a041` |
| 053 | `smith/patterns/props/p053_callback_with_args.js` | callback prop with args | component handler prop parsing | `handlerRef`, closure metadata | `a009`, `a019-a032`, `a033-a034` |
| 054 | `smith/patterns/props/p054_spread_props.js` | spread props | component prop parsing | merged `propValues` | `a006-a008`, `a033-a035` |
| 055 | `smith/patterns/props/p055_spread_override.js` | spread then override | component prop parsing | merged `propValues` with override precedence | `a006-a008`, `a033-a035` |
| 056 | `smith/patterns/props/p056_computed_prop_name.js` | computed prop key | component prop parsing | computed `propValues` | `a006-a008`, `a033-a035` |
| 057 | `smith/patterns/props/p057_object_prop.js` | object prop | component brace prop parsing | object literal / eval contract | `a033-a035` or consumed by inlining |
| 058 | `smith/patterns/props/p058_array_prop.js` | array prop | component brace prop parsing | array literal / eval contract | `a019-a032` or `a033-a035` |
| 059 | `smith/patterns/props/p059_jsx_prop.js` | JSX prop | `tryParseComponentBraceProp()` | `propValues[attr] = { __jsxSlot, result }` | `a006-a008` |
| 060 | `smith/patterns/props/p060_render_prop.js` | render prop | component prop parsing | callback/render contract | `a009`, `a033-a035` |
| 061 | `smith/patterns/props/p061_function_as_children.js` | function-as-children | component prop parsing | callback/render contract | `a009`, `a033-a035` |
| 062 | `smith/patterns/props/p062_destructured_signature.js` | destructured params | component collection/inlining | prop-name to local-name mapping | consumed by inlining |
| 063 | `smith/patterns/props/p063_default_prop_values.js` | default prop values | component collection/inlining | fallback `propValues` synthesis | consumed by inlining |
| 064 | `smith/patterns/props/p064_rest_props.js` | rest props | component collection/inlining | residual `propValues` bag | consumed by inlining / `a033-a035` if runtime |
| 065 | `smith/patterns/props/p065_forwarded_ref.js` | forwarded ref prop | component prop parsing | ref hint / prop passthrough | consumed by inlining |

### Children

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 066 | `smith/patterns/children/p066_single_child.js` | single child | `parseChildren()` | `children[]` | `a006-a008` |
| 067 | `smith/patterns/children/p067_multiple_children.js` | multiple children | `parseChildren()` | `children[]` | `a006-a008` |
| 068 | `smith/patterns/children/p068_string_children.js` | text children | text child parsing | `children[]` / `nodeExpr{text}` | `a006-a008` |
| 069 | `smith/patterns/children/p069_expression_children.js` | expression children | brace child parsing | `dynTexts`, `nodeExpr{text}` | `a008`, `a033-a035` |
| 070 | `smith/patterns/children/p070_mixed_children.js` | mixed text/expr children | `parseChildren()` | mixed `children[]`, `dynTexts` | `a006-a008`, `a035` |
| 071 | `smith/patterns/children/p071_array_children.js` | array of children | brace child parsing | flattened `children[]` | `a006-a008`, `a019-a032` if map-backed |
| 072 | `smith/patterns/children/p072_no_children.js` | self-closing | element flow | empty `children[]` | `a006-a008` |

### Component Reference

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 073 | `smith/patterns/component_ref/p073_direct_component.js` | direct component | `findComponent()` + `inlineComponentCall()` | inlined `nodeExpr`, `propStack` | `a006-a008` |
| 074 | `smith/patterns/component_ref/p074_dot_notation.js` | namespaced component | `normalizeRawTag()` / `findComponent()` | inlined component contract | `a006-a008` |
| 075 | `smith/patterns/component_ref/p075_dynamic_variable.js` | component variable | component-ref parsing | dynamic component hint / fallback | usually `a033-a035` or drop |
| 076 | `smith/patterns/component_ref/p076_dynamic_ternary.js` | ternary component ref | component-ref parsing | dynamic component hint / fallback | `a033-a036` |
| 077 | `smith/patterns/component_ref/p077_create_element.js` | `React.createElement` | function-call parsing | synthetic JSX contract | `a006-a008` |
| 078 | `smith/patterns/component_ref/p078_clone_element.js` | `cloneElement` | function-call parsing | cloned prop/node contract | `a006-a008`, `a033-a035` |
| 079 | `smith/patterns/component_ref/p079_lazy_component.js` | `React.lazy` | component-ref parsing | lazy fallback hint | `a033-a035` |
| 080 | `smith/patterns/component_ref/p080_suspense.js` | `Suspense` | component-ref parsing | fallback/wrapper hint | `a006-a008`, `a036` |

### Conditional Rendering

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 081 | `smith/patterns/conditional_rendering/p081_if_else_early_return.js` | `if/else` early returns | conditional parsing | `ctx.conditionals`, branch nodes | `a036`, `a006-a008` |
| 082 | `smith/patterns/conditional_rendering/p082_guard_null.js` | guard `return null` | conditional parsing | guard condition + swallow branch | `a036` |
| 083 | `smith/patterns/conditional_rendering/p083_switch_return.js` | switch returns | conditional parsing | multi-branch `ctx.conditionals` | `a036`, `a006-a008` |
| 084 | `smith/patterns/conditional_rendering/p084_object_lookup.js` | lookup table rendering | conditional/value parsing | branch/value lookup contract | `a033-a036` |
| 085 | `smith/patterns/conditional_rendering/p085_iife.js` | JSX IIFE | brace child parsing | `iife_conditional` hint + parsed branch node | `a036`, `a006-a008` |

### Composition

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 086 | `smith/patterns/composition/p086_wrapper.js` | wrapper component | component inlining | wrapped `nodeExpr`, `children[]` splice | `a006-a008` |
| 087 | `smith/patterns/composition/p087_hoc.js` | HOC / enhancer | expression parsing | `_hocInfo`, wrapper inline hint | `a006-a008`, `a036` |
| 088 | `smith/patterns/composition/p088_forwarded_ref.js` | `forwardRef` | component parsing | ref-forward contract | consumed by inlining |
| 089 | `smith/patterns/composition/p089_context_provider.js` | context provider | JSX tag normalization | transparent wrapper / provider hint | `a006-a008` |
| 090 | `smith/patterns/composition/p090_context_consumer.js` | `useContext` | expression parsing | `_contextInfo`, optional `stateSlots` + `dynTexts` | `a033-a035` |
| 091 | `smith/patterns/composition/p091_portal.js` | portal | expression parsing | child node in place; target dropped | `a006-a008` |
| 092 | `smith/patterns/composition/p092_error_boundary.js` | error boundary | component parsing | boundary wrapper hint | `a006-a008`, `a036` |
| 093 | `smith/patterns/composition/p093_slot_pattern.js` | named slot JSX props | component brace prop parsing | `{ __jsxSlot, result, _slotInfo }` | `a006-a008` |

### Hooks

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 094 | `smith/patterns/hooks/p094_usestate_value.js` | `useState` | hook parsing | `ctx.stateSlots`, getter/setter pair | `a004-a005`, `a033-a042` |
| 095 | `smith/patterns/hooks/p095_usereducer_dispatch.js` | `useReducer` | hook parsing | state slot + dispatch wrapper | `a004-a005`, `a009`, `a033-a042` |
| 096 | `smith/patterns/hooks/p096_usememo_computed.js` | `useMemo` | hook parsing | render local / cached eval contract | `a033-a035` |
| 097 | `smith/patterns/hooks/p097_usecallback_handler.js` | `useCallback` | hook parsing | `handlerRef`, `ctx.handlers` | `a009`, `a033-a041` |
| 098 | `smith/patterns/hooks/p098_useref_current.js` | `useRef` | hook parsing | render local/ref placeholder | mostly consumed by parser/inlining |
| 099 | `smith/patterns/hooks/p099_useid_generated.js` | `useId` | hook parsing | state/local id contract | `a004-a005`, `a033-a035` |
| 100 | `smith/patterns/hooks/p100_custom_hook.js` | custom hook call | hook parsing | render locals, state slots, callback contracts | `a004-a005`, `a009`, `a033-a035` |

### Keys

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 101 | `smith/patterns/keys/p101_key_element.js` | keyed element | attr parsing | `_keyHints`, dropped key metadata | none directly; maps stay `a019-a028` |
| 102 | `smith/patterns/keys/p102_key_fragment.js` | keyed fragment | fragment parsing | `_keyHint`, flattened fragment children | `a006-a008`, `a019-a028` inside maps |
| 103 | `smith/patterns/keys/p103_key_remount.js` | forced remount key | attr parsing | remount hint only | none directly |
| 104 | `smith/patterns/keys/p104_missing_key.js` | missing key warning | map parsing | lint hint / dropped expression note | none directly |

### Style

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 105 | `smith/patterns/style/p105_inline_object.js` | inline style object | style attr parsing | `styleFields` | `a006-a008` |
| 106 | `smith/patterns/style/p106_computed_inline.js` | computed style object | style attr parsing | `styleFields`, `_dynStyles` | `a006-a008`, `a035-a037` |
| 107 | `smith/patterns/style/p107_classname_string.js` | `className` string | style/classifier parsing | style/classifier lookup | `a006-a008` |
| 108 | `smith/patterns/style/p108_classname_ternary.js` | `className` ternary | style/classifier parsing | style choice contract | `a036-a037`, `a006-a008` |
| 109 | `smith/patterns/style/p109_classname_template.js` | class template literal | style/classifier parsing | style lookup / dyn text-style contract | `a035-a037` |
| 110 | `smith/patterns/style/p110_classname_array_join.js` | class join | style/classifier parsing | style merge contract | `a035-a037`, `a006-a008` |
| 111 | `smith/patterns/style/p111_classnames_utility.js` | `classnames` / `clsx` | style/classifier parsing | style merge contract | `a035-a037`, `a006-a008` |
| 112 | `smith/patterns/style/p112_css_module.js` | CSS module class | style/classifier parsing | style lookup contract | `a006-a008` |
| 113 | `smith/patterns/style/p113_css_in_js_template.js` | CSS-in-JS template | style parsing | eval/style contract | `a033-a037` |
| 114 | `smith/patterns/style/p114_css_in_js_object.js` | CSS-in-JS object | style parsing | eval/style contract | `a033-a037` |

### Events

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 115 | `smith/patterns/events/p115_inline_arrow.js` | inline arrow handler | handler attr parsing | `handlerRef`, `ctx.handlers`, `eventKind=inline_arrow` | `a009`, `a033-a041` |
| 116 | `smith/patterns/events/p116_bound_method.js` | bound method ref | handler attr parsing | `handlerRef`, `ctx.handlers`, `eventKind=bound_method` | `a009`, `a033-a041` |
| 117 | `smith/patterns/events/p117_event_param.js` | synthetic event param | handler attr parsing | `handlerRef`, closure param metadata, `eventKind=event_param` | `a009`, `a033-a041` |
| 118 | `smith/patterns/events/p118_prevent_default.js` | `preventDefault()` | handler attr parsing | `handlerRef`, `eventKind=prevent_default` | `a009`, `a033-a041` |
| 119 | `smith/patterns/events/p119_closure_map_item.js` | map-item closure handler | handler attr parsing | map-aware `handlerRef`, `ctx.handlers` | `a019-a032`, `a033-a041` |
| 120 | `smith/patterns/events/p120_synthetic_parent.js` | handler passed to parent | handler attr parsing | forwarded or wrapped `handlerRef` | `a009`, `a033-a041` |

### Strings

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 121 | `smith/patterns/strings/p121_template_literal_jsx.js` | template literal child | template-literal parsing | `dynTexts` or static `nodeExpr{text}` | `a008`, `a035` |
| 122 | `smith/patterns/strings/p122_template_literal_prop.js` | template literal prop | component brace prop parsing | `propValues[attr]` string/expr | `a033-a035`, `a006-a008` |
| 123 | `smith/patterns/strings/p123_string_concat.js` | string concatenation | brace child / prop parsing | `dynTexts`, string expr contract | `a008`, `a033-a035` |
| 124 | `smith/patterns/strings/p124_array_join.js` | array join to string | brace child / prop parsing | string expr contract | `a033-a035` |

### Type Narrowing

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 125 | `smith/patterns/type_narrowing/p125_typeof_gate.js` | `typeof` guard | conditional parsing | `ctx.conditionals` / truthiness expr | `a036` |
| 126 | `smith/patterns/type_narrowing/p126_array_isarray.js` | `Array.isArray` guard | conditional parsing | `ctx.conditionals` / truthiness expr | `a036` |
| 127 | `smith/patterns/type_narrowing/p127_prop_in_obj.js` | `'prop' in obj` | conditional parsing | `ctx.conditionals` / truthiness expr | `a036` |
| 128 | `smith/patterns/type_narrowing/p128_optional_chaining.js` | optional chaining | expr parsing | safe field/value contract | `a033-a036` |
| 129 | `smith/patterns/type_narrowing/p129_non_null_assertion.js` | non-null assertion | expr parsing | narrowed value contract | `a033-a036` |
| 130 | `smith/patterns/type_narrowing/p130_type_predicate.js` | type predicate | conditional parsing | `ctx.conditionals` / predicate contract | `a036` |
| 131 | `smith/patterns/type_narrowing/p131_discriminated_union.js` | discriminated union render | conditional parsing | `ctx.conditionals` / branch nodes | `a036`, `a006-a008` |

### Misc JSX

| ID | Pattern File | React concept | Intake | Contract | Atoms |
| --- | --- | --- | --- | --- | --- |
| 132 | `smith/patterns/misc_jsx/p132_dangerously_set_html.js` | `dangerouslySetInnerHTML` | native attr parsing | raw-html hint / usually dropped | none directly |
| 133 | `smith/patterns/misc_jsx/p133_spread_dom_attrs.js` | spread DOM attrs | native attr parsing | attr merge contract | `a006-a008`, `a035-a037` |
| 134 | `smith/patterns/misc_jsx/p134_data_attributes.js` | `data-*` attrs | native attr parsing | passthrough attr hint | mostly ignored at Zig output |
| 135 | `smith/patterns/misc_jsx/p135_aria_attributes.js` | ARIA/role attrs | native attr parsing | accessibility attr hint | mostly ignored at Zig output |
| 136 | `smith/patterns/misc_jsx/p136_svg_elements.js` | SVG in JSX | tag normalization/canvas parsing | canvas/glyph node contract | `a006-a008`, canvas-specific emit paths |
| 137 | `smith/patterns/misc_jsx/p137_namespaced_attrs.js` | namespaced attrs | native attr parsing | specialized attr contract | `a006-a008` |
| 138 | `smith/patterns/misc_jsx/p138_jsx_comment.js` | JSX comment | child parsing | consume/no node | none |
| 139 | `smith/patterns/misc_jsx/p139_multiline_parens.js` | parenthesized JSX | JSX element parsing | forwarded `nodeExpr` | `a006-a008` |
| 140 | `smith/patterns/misc_jsx/p140_adjacent_fragment.js` | adjacent root elements | child parsing | sibling `children[]` / synthetic fragment | `a006-a008` |

## Practical Summary

- Static structure ends up in `a006-a008`.
- Event handlers and effects end up in `a009-a011`.
- Object-array-backed data and all mapped rendering end up in `a012-a032`.
- JS/Lua runtime code and dynamic refresh functions end up in `a033-a038`.
- App wiring ends up in `a039-a042`.
- Split output and final post-pass happen in `a043-a046`.

- The atom path is the intended end-state replacement for monolithic legacy emission.
- The lua-tree path in [smith/emit/lua_tree_emit.js](./smith/emit/lua_tree_emit.js) still reimplements many of the same concerns inline, especially preamble, state bootstrap, JS/Lua logic blocks, Lua map setup, and entrypoint exports.
