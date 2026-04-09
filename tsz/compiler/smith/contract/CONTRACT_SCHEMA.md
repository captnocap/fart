# Contract Schema — Pattern → Contract → Emit

## Overview

This directory contains the **semantic contracts** that bridge the pattern recognition phase and the emit phase. 

**Rule: Emit atoms MUST NOT re-parse strings, re-resolve props, or re-infer map identity.**
They consume contracts produced by the pattern phase.

## Three-Phase Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: PATTERNS                                          │
│  Location: tsz/compiler/smith/patterns/*                    │
│  Responsibility: Recognize .tsz syntax only                 │
│  Output: Markers attached to parse context                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: CONTRACT (This Directory)                         │
│  Location: tsz/compiler/smith/contract/*                    │
│  Responsibility: Normalized semantic data only              │
│  Input: Parse results from Phase 1                          │
│  Output: Structured contracts (luaNode objects)             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: EMIT                                              │
│  Location: tsz/compiler/smith/emit_atoms/maps_lua/*         │
│  Responsibility: Final Lua/JS/Zig assembly only             │
│  Input: Contracts from Phase 2                              │
│  Output: Lua source strings                                 │
└─────────────────────────────────────────────────────────────┘
```

## Contract Types

### Node Contract (`luaNode`)

Produced by: `tsz/compiler/smith/parse/build_node.js`

```javascript
{
  tag: 'Text' | 'Box' | 'Image' | 'Pressable' | 'ScrollView' | ...,
  text: TextContract | null,
  style: StyleContract | null,
  handler: HandlerContract | null,
  children: ChildContract[],
  terminal: boolean,
  terminal_id: number,
  text_input: boolean,
  input_id: number,
  multiline: boolean,
  // Internal markers
  _variantStyles: StyleContract[] | null,
  _nodeFields: Record<string, string> | null,
}
```

### Text Contract

Produced by: Pattern phase, consumed by `lua_map_text.js`

```javascript
// Field reference: item.field
{ field: "title" }

// State variable expression
{ stateVar: "expr" }

// Pre-translated Lua expression
{ luaExpr: "..." }

// Template literal parts
{ parts: TextPart[] }

// Plain string (fallback)
"literal string"
```

### Text Part Contract

```javascript
{
  type: 'literal' | 'expression',
  value: string
}
```

### Style Contract

Produced by: Pattern phase, consumed by `lua_map_style.js`

```javascript
{
  [key: string]: StyleValue
}

// StyleValue can be:
// - number: 16, 100
// - string: "center", "row", "#ff0000", "0xRRGGBB"
// - complex expression: (transformed by emit, not re-parsed)
```

### Handler Contract

Produced by: Pattern phase, consumed by `lua_map_handler.js`

```javascript
{
  body: string,           // Handler body expression
  isJs: boolean,          // true if JS handler, false if Lua
  mapIdx: number,         // Which map this handler belongs to
  inMap: boolean,         // Whether handler is inside a map
}
```

### Child Contract

```javascript
// Regular child node
{ node: luaNode }

// Conditional child
{
  condition: string,
  node: luaNode
}

// Ternary conditional
{
  ternaryCondition: string,
  trueNode: luaNode,
  falseNode: luaNode
}

// Nested map
{
  nestedMap: {
    field: string,
    bodyNode: luaNode,
    itemParam: string,
    indexParam: string | null
  }
}

// Inline map loop
{
  luaMapLoop: {
    dataVar: string,
    bodyNode: luaNode | null,
    bodyLua: string | null,
    itemParam: string,
    indexParam: string | null,
    oaIdx: number | null,
    filterConditions: FilterCondition[]
  }
}
```

### Map Rebuilder Contract

Produced by: Pattern phase, consumed by `lua_tree_nodes.js`

```javascript
{
  bodyNode: luaNode,
  itemParam: string,
  indexParam: string | null,
  dataVar: string,
  rawSource: string,
  isNested: boolean
}
```

## Contract Boundaries

### What Emit Atoms CAN Access

✅ `ctx.stateSlots` — state getter/setter metadata  
✅ `ctx.objectArrays` — OA field definitions  
✅ `ctx._luaRootNode` — the full lua tree contract  
✅ `ctx._luaMapRebuilders` — map loop contracts  
✅ `ctx.handlers` — handler contracts  
✅ Other emit atoms via shared functions (e.g., `_jsExprToLua`)  

### What Emit Atoms MUST NOT Do

❌ Parse strings to extract field names  
❌ Resolve prop references from `ctx.propStack`  
❌ Re-infer map identities from source text  
❌ Access `globalThis.__source`  
❌ Call token cursor methods (`c.kind()`, `c.advance()`)  

## Files

| File | Purpose |
|------|---------|
| `CONTRACT_SCHEMA.md` | This file — contract documentation |
| `node_contract.js` | Node contract builders (future) |
| `text_contract.js` | Text contract builders (future) |
| `style_contract.js` | Style contract builders (future) |
| `handler_contract.js` | Handler contract builders (future) |

## Migration Status

- ✅ Pattern phase produces contracts
- ✅ Emit phase consumes contracts
- ✅ `lua_map_*.js` files only read contracts
- 🚫 `emit_ops/emit_lua_*.js` — DELETED (did not exist)
- 🚫 `a034_lua_logic_block.js` — REDUCED TO WRAPPER

## Validation

To verify pattern → contract → emit compliance:

1. No `match()` calls in emit_atoms/
2. No `c.kind()` / `c.advance()` in emit_atoms/
3. No string parsing of OA refs in emit (use contract fields)
4. No `ctx.propStack` access in emit

## Regression Tests

See: `tsz/carts/conformance/REGRESSION_LOCKDOWN.md`

Targeted tests:
- d41: Multi-component props
- d55: Deeply nested objects
- d04: Map handler captures
- d10: Handler triple capture
- d20: Multi handler map
- d110: Component ternary map handler
- l02: LScript map handlers
- l04: LScript nested maps

---

**Co-Authored-By:** Kimi-K2.5 <noreply@moondream.ai>
