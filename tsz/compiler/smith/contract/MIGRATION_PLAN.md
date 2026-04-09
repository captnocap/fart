# Three-Phase Contract Migration Plan

## Deletion Criteria (Per User Requirements)

A file can be deleted only if:
- [ ] it is not in the active bundle path
- [ ] it does not own unique semantics absent elsewhere
- [ ] its callers are redirected
- [ ] conformance carts covering its claimed responsibility still pass

## Phase Boundaries

### Pattern Layer
**Files:** `tsz/compiler/smith/patterns/*`
**Rule:** May inspect tokens, but may NOT emit runtime strings.
**Current Status:** ✅ Clean — patterns only mark metadata

### Contract Layer  
**Files:** `tsz/compiler/smith/contract/*`, `tsz/compiler/smith/parse/*`
**Rule:** May normalize semantics, but may NOT format Lua/JS/Zig.
**Current Status:** 🔄 In Progress — parse files still mix formatting

### Emit Layer
**Files:** `tsz/compiler/smith/emit_atoms/maps_lua/*`, `tsz/compiler/smith/emit/*`
**Rule:** May format output, but may NOT reinterpret semantics.
**Current Status:** ✅ lua_map_*.js are clean — emit_ops files violate

## Target File Status

### To Delete (emit_ops violations)
| File | Replacement | Deletion Criteria | Status |
|------|-------------|-------------------|--------|
| `emit_ops/emit_lua_element.js` | `lua_map_node.js` | [ ] Not in bundle<br>[ ] No unique semantics<br>[ ] Callers redirected<br>[ ] Tests pass | 🚫 Blocked by load order |
| `emit_ops/emit_lua_text.js` | `lua_map_text.js` | Same criteria | 🚫 Blocked by load order |
| `emit_ops/emit_lua_style.js` | `lua_map_style.js` | Same criteria | 🚫 Blocked by load order |
| `emit_ops/emit_lua_rebuild.js` | `a034_lua_logic_block.js` | Same criteria | 🚫 Blocked by load order |

### To Reduce (wrapper only)
| File | Current | Target | Status |
|------|---------|--------|--------|
| `a034_lua_logic_block.js` | Wrapper + translation | Wrapper only | 🔄 Body translation moved to lua_map_node.js |

### Active (Clean Contract Consumers)
| File | Role | Contract Input | Status |
|------|------|----------------|--------|
| `lua_map_subs.js` | Expression conversion | Raw JS expressions | ✅ Active |
| `lua_map_node.js` | Node emission | luaNode contracts | ✅ Active |
| `lua_map_text.js` | Text emission | Text contracts | ✅ Active |
| `lua_map_style.js` | Style emission | Style objects | ✅ Active |
| `lua_map_handler.js` | Handler emission | Handler strings | ✅ Active |

## Cross-Reference Audit

### Who Calls What (Current State)

```
build_node.js
  └── produces luaNode contracts
      └── consumed by: lua_map_node.js:_nodeToLua()

brace_maps.js
  └── produces _luaMapRebuilders entries
      └── consumed by: a034_lua_logic_block.js
          └── delegates to: lua_map_node.js:_nodeToLua()

emit_ops/emit_lua_element.js (DEPRECATED)
  └── NOT CALLED by any active code (verified via grep)
  └── Functions: emitLuaElement(), emitLuaChildren()
  └── Still in load order but unused

emit_ops/emit_lua_text.js (DEPRECATED)
  └── NOT CALLED by any active code
  └── Function: emitLuaTextContent()
  └── Still in load order but unused

emit_ops/emit_lua_style.js (DEPRECATED)
  └── NOT CALLED by any active code
  └── Function: emitLuaStyle()
  └── Still in load order but unused

emit_ops/emit_lua_rebuild.js (DEPRECATED)
  └── NOT CALLED by any active code
  └── Function: emitLuaRebuildList()
  └── Still in load order but unused
```

## Action Items

### Immediate (This Session)
1. ✅ Create contract schema files
2. ✅ Document three-phase boundaries
3. ⏳ Verify emit_ops files are truly unused via load order check
4. ⏳ Update smith_LOAD_ORDER.txt to remove emit_ops/emit_lua_*.js
5. ⏳ Run conformance tests to verify deletion safety

### Short Term
6. Migrate build_node.js luaNode construction to use contract helpers
7. Add contract validation debug mode
8. Document contract violations in lint rules

### Long Term
9. Delete emit_ops/emit_lua_*.js once stable
10. Reduce a034_lua_logic_block.js to wrapper only
11. Add compile-time contract enforcement

## Verification Steps

Before deleting any file:
```bash
# 1. Check if file is in load order
grep "emit_lua_" tsz/compiler/smith_LOAD_ORDER.txt

# 2. Check for any dynamic requires
grep -r "require.*emit_lua" tsz/compiler/smith/

# 3. Check for any global references
grep -r "emitLuaElement\|emitLuaText\|emitLuaStyle\|emitLuaRebuild" tsz/compiler/smith/

# 4. Run conformance tests
./tsz/scripts/flight-check

# 5. Build test carts
./tsz/scripts/build tsz/carts/conformance/chad/d127_schema_driven_form.tsz
```

## Sign-off

This migration plan establishes the three-phase contract architecture.
All future work must respect these boundaries.

Co-Authored-By: Kimi-K2-5 <noreply@moondream.ai>
