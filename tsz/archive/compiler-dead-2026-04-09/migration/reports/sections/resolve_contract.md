# Resolve Contract — Shared Resolution Functions

## Function/File Pairs

- `resolveConstOaAccess` — smith/core.js → smith/resolve/const_oa.js
- `resolveConstOaFieldFromRef` — smith/core.js → smith/resolve/const_oa.js
- `tryResolveObjectStateAccess` — smith/core.js → smith/resolve/state_access.js
- `resolveField` — smith/resolve/field_access.js (already in resolve/)
- `peekPropsAccess` — smith/core.js (stays in core — used widely)

## Shared Layer (future)

- `resolveValueRef(input, ctx, mode)` — unify slot/prop/render-local/map-item/OA/eval resolution
- `resolveFieldPath(base, path, ctx, mode)` — unify `.field` and `.length` resolution
- `resolvePropsRef(c, ctx)` — prop indirection
- `resolveConstOaRef(c, ctx)` — const OA bracket access
