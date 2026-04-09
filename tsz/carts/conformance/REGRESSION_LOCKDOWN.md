# Conformance Lockdown — Pattern → Contract → Emit

## Validation Criteria

This document lists the explicit regression coverage for the pattern → contract → emit architecture.

After any change to emit_atoms/, these carts MUST pass:

## Tier 1: Critical Path (Map + Handler)

| Cart | Pattern | Contract | Emit | Status |
|------|---------|----------|------|--------|
| d04_map_handler_captures | ✅ | ✅ | ✅ | LOCKED |
| d10_handler_triple_capture | ✅ | ✅ | ✅ | LOCKED |
| d20_multi_handler_map | ✅ | ✅ | ✅ | LOCKED |
| d110_component_ternary_map_handler | ✅ | ✅ | ✅ | LOCKED |
| d111_cross_map_state_mutation | ✅ | ✅ | ✅ | LOCKED |
| l02_lscript_map_handlers | ✅ | ✅ | ✅ | LOCKED |
| l04_lscript_nested_maps | ✅ | ✅ | ✅ | LOCKED |

## Tier 2: Nested OA Fields

| Cart | Pattern | Contract | Emit | Status |
|------|---------|----------|------|--------|
| d01_nested_maps | ✅ | ✅ | ✅ | LOCKED |
| d09_nested_template_scope | ✅ | ✅ | ✅ | LOCKED |
| d21_nested_object_access | ✅ | ✅ | ✅ | LOCKED |
| d55_deeply_nested_objects | ✅ | ✅ | ✅ | LOCKED |
| d112_triple_nested_component_map | ✅ | ✅ | ✅ | LOCKED |
| d145_elicitation_nested_map | ✅ | ✅ | ✅ | LOCKED |

## Tier 3: Template Text in Maps

| Cart | Pattern | Contract | Emit | Status |
|------|---------|----------|------|--------|
| d48_complex_template_literals | ✅ | ✅ | ✅ | LOCKED |
| d67_conditional_in_map_component | ✅ | ✅ | ✅ | LOCKED |
| d115_conditional_component_in_nested_map | ✅ | ✅ | ✅ | LOCKED |

## Tier 4: Conditionals in Maps

| Cart | Pattern | Contract | Emit | Status |
|------|---------|----------|------|--------|
| d03_conditional_wrapping_map | ✅ | ✅ | ✅ | LOCKED |
| d17_map_conditional_card | ✅ | ✅ | ✅ | LOCKED |
| d25_map_conditional_classifier | ✅ | ✅ | ✅ | LOCKED |
| d61_map_ternary_branch | ✅ | ✅ | ✅ | LOCKED |
| d108_ternary_component_in_map | ✅ | ✅ | ✅ | LOCKED |
| d109_map_in_ternary_in_map | ✅ | ✅ | ✅ | LOCKED |

## Tier 5: Component Props

| Cart | Pattern | Contract | Emit | Status |
|------|---------|----------|------|--------|
| d41_multi_component_props | ✅ | ✅ | ✅ | LOCKED |
| d65_component_8_props | ✅ | ✅ | ✅ | LOCKED |
| d98_callback_prop_chain | ✅ | ✅ | ✅ | LOCKED |
| d116_the_hydra | ✅ | ✅ | ✅ | LOCKED |
| d117_same_component_multi_map | ✅ | ✅ | ✅ | LOCKED |

## Running the Lockdown

```bash
# Run all lockdown tests
./tsz/scripts/conformance-report --fails

# Run specific tier
./tsz/scripts/build tsz/carts/conformance/mixed/d04_map_handler_captures.tsz
./tsz/scripts/build tsz/carts/conformance/mixed/d01_nested_maps.tsz
./tsz/scripts/build tsz/carts/conformance/mixed/d55_deeply_nested_objects.tsz
```

## Architecture Compliance Check

Emit atoms MUST NOT:
- [ ] Parse strings to extract field names
- [ ] Resolve prop references from ctx.propStack
- [ ] Re-infer map identities from source text
- [ ] Access globalThis.__source
- [ ] Call token cursor methods

Verify with:
```bash
grep -r "c\.kind\|c\.advance\|c\.text\|propStack" tsz/compiler/smith/emit_atoms/
grep -r "__source" tsz/compiler/smith/emit_atoms/
```

Expected: No matches (or only in comments)

## File Ownership

| File Type | Location | Responsibility |
|-----------|----------|----------------|
| Patterns | `tsz/compiler/smith/patterns/*` | Syntax recognition only |
| Contract | `tsz/compiler/smith/contract/*` | Normalized semantic data |
| Emit | `tsz/compiler/smith/emit_atoms/maps_lua/*` | Final Lua assembly only |

## Deleted Files

These files were deleted/disconnected from the live path:
- ~~`tsz/compiler/smith/emit_ops/emit_lua_element.js`~~ → `lua_map_node.js`
- ~~`tsz/compiler/smith/emit_ops/emit_lua_text.js`~~ → `lua_map_text.js`
- ~~`tsz/compiler/smith/emit_ops/emit_lua_style.js`~~ → `lua_map_style.js`
- ~~`tsz/compiler/smith/emit_ops/emit_lua_rebuild.js`~~ → `a034_lua_logic_block.js`

## Wrapper-Only Files

These files are reduced to wrappers:
- `a034_lua_logic_block.js` — Wraps `lua_tree_nodes.js`, delegates all work

---

**Architecture Verification Date:** 2026-04-09  
**Co-Authored-By:** Kimi-K2.5 <noreply@moondream.ai>
