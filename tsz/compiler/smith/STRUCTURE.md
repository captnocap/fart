# Smith Compiler Structure

The compiler is a race track. One lane in, fans to three, each fractures further, all converge to one lane out. The directory structure IS this shape.

```
         ┌─────────┐
         │ core.js  │  ← single entry, reads source, detects tier
         └────┬─────┘
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
    soup.js mixed.js chad.js    ← 3 lane gates (detection + dispatch)
       │      │      │
       ▼      ▼      ▼
    soup/  mixed/  chad/        ← lane internals (fractal sub-lanes)
       │      │      │
       └──────┼──────┘
              │
         ┌────┴─────┐
         │  emit/   │  ← single exit, generates Zig (same output regardless of lane)
         └──────────┘
```

## Directory Layout

```
smith/
  core.js                    ← orchestrator: lex input → detect tier → dispatch to lane → collect output
  parse.js                   ← parse orchestrator (shared across all lanes)
  rules.js                   ← validation rules (shared across all lanes)

  lanes/
    soup.js                  ← SOUP GATE: detects soup source, dispatches into soup/
    mixed.js                 ← MIXED GATE: detects mixed source, dispatches into mixed/
    chad.js                  ← CHAD GATE: detects chad source, dispatches into chad/

    soup/                    ← soup lane internals
      html_mapping.js        ← div→Box, button→Pressable, onClick→onPress, etc.
      style_normalize.js     ← CSS property normalization
      react_compat.js        ← useState, useEffect, import/export handling

    mixed/                   ← mixed lane internals
      app.js                 ← mixed-syntax .tsz app entry
      page.js                ← mixed-syntax page handling
      module.js              ← mixed-syntax module handling
      script_bridge.js       ← <script>/<lscript>/<zscript> integration

    chad/                    ← chad lane internals (the fractal)
      widget.js              ← <X widget> — one file, everything inline
      app.js                 ← <X app> — owns pages, owns components
      lib.js                 ← <X lib> — owns modules
      module.js              ← <X module> — .mod.tsz standalone OR child of lib
      blocks.js              ← <var>, <state>, <types>, <functions> parsing
      control_flow.js        ← <if>, <else>, <for>, <during>, <while>, <switch>

  parse/                     ← shared parsing (used by all lanes)
    build_node.js
    children/
      text.js
      conditional_blocks.js
      ...
    brace/
      ternary.js
      map.js
      ...

  emit/                      ← shared Zig codegen (single exit lane)
    node.js                  ← node tree → Zig structs
    handler.js               ← event handlers → Zig functions
    map_pools.js             ← map/For → Zig array pools
    runtime_updates.js       ← state updates → Zig reactive slots
    state.js                 ← state declarations → Zig createSlot
    ...

  collect/                   ← shared collection passes (pre-parse)
  preflight/                 ← shared validation (pre-emit)
```

## Rules

### 1. Three lanes, three files, three directories

`soup.js`, `mixed.js`, `chad.js` are the only lane gates. Each has exactly one subdirectory with the same name. No lane logic lives outside its own directory.

### 2. Lane gates only detect and dispatch

Each gate file does exactly two things:
- **Detect**: "is this source mine?" (returns bool)
- **Dispatch**: call into the lane's subdirectory for processing

No codegen in a gate file. No parsing. Just routing.

### 3. Sub-lanes are internal to their lane

`chad/widget.js`, `chad/app.js`, `chad/lib.js`, `chad/module.js` are sub-lanes within chad. They don't know about soup or mixed. They don't import from `../soup/` or `../mixed/`.

The sub-lane structure within each lane:

**soup/** — relatively flat, soup is the simplest path
- HTML element mapping
- CSS normalization
- React compatibility (useState, imports, exports)

**mixed/** — moderate depth, handles JSX + script blocks
- App entry handling
- Page handling
- Module handling
- Script bridge (<script>, <lscript>, <zscript>)

**chad/** — deepest fractal, handles block syntax
- Widget (monolith, one file)
- App (owns pages, owns components, ambient resolution)
- Lib (owns modules, ambient resolution)
- Module (standalone .mod.tsz OR child of lib)
- Block parsing (<var>, <state>, <types>, <functions>)
- Control flow (<if>, <else>, <for>, <during>, <while>, <switch>)

### 4. All lanes converge at emit/

No matter which lane processed the source, the output goes through the same `emit/` functions. `emit/` doesn't know which lane produced its input. If a lane needs special emit behavior, it transforms its intermediate representation BEFORE handing it to emit, not by forking emit.

### 5. parse/ and collect/ are shared infrastructure

All three lanes use the same parser and collection passes. Lane-specific parsing logic lives inside the lane's own directory (`chad/blocks.js`), not in the shared `parse/`.

### 6. The module hybrid

`<module>` is the one construct that crosses a boundary:
- As a child of `<lib>` in chad: `chad/module.js` handles it, the lib compiles it
- As a standalone `.mod.tsz`: detected at the core level, routed to the appropriate lane's module handler
- Both paths produce the same `.gen.zig` output

### 7. Parity is structural

If the directory structure is correct, parity tests pass. Three lanes → one emit → identical output. If parity fails, the fix is in the lane that diverged, never in emit.

## Testing Against This Structure

The structure itself is testable:

```bash
# Verify no cross-lane imports
grep -r "require.*soup" smith/lanes/chad/ && echo "FAIL: chad imports soup"
grep -r "require.*chad" smith/lanes/soup/ && echo "FAIL: soup imports chad"
grep -r "require.*mixed" smith/lanes/chad/ && echo "FAIL: chad imports mixed"

# Verify lane gates are thin (detection + dispatch only)
wc -l smith/lanes/soup.js smith/lanes/mixed.js smith/lanes/chad.js
# Each should be <50 lines

# Verify all lanes use shared emit
grep -r "function emit\|function generate" smith/lanes/*/
# Should find ZERO — lanes don't emit, they transform for emit/
```

## Migration Path

Current state → target state:
1. Move root `soup.js` (1084 lines) into `lanes/soup/` as implementation files
2. Create thin `lanes/soup.js` gate (detect + dispatch)
3. Extract mixed logic from `lanes/app.js` + `lanes/page.js` into `lanes/mixed/`
4. Create thin `lanes/mixed.js` gate
5. Move chad sub-logic into `lanes/chad/`
6. Make existing `lanes/chad.js` into a thin gate
7. Delete stubs and root-level lane files
8. Verify parity tests still pass
