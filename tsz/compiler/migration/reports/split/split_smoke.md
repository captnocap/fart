# Split Smoke

Timestamp: 2026-04-09T00:00:00-07:00
Cart: tsz/carts/conformance/mixed/d01_nested_maps.tsz
Verification Status: pass

- Split modules produced: true
- Produced files: app.zig, children_manifest.json, handlers.zig, logic.zig, maps.zig, nodes.zig, state.zig
- Each produced module compiled: true
- Evidence: `./scripts/build carts/conformance/mixed/d01_nested_maps.tsz` completed successfully and linked from `/tmp/tsz-gen/generated_d01_nested_maps/app.zig`.

Rerun: 2026-04-09T02:47:27-07:00
- Re-verified after cart-specific parity fix.
- `./scripts/build carts/conformance/mixed/d01_nested_maps.tsz` still completed successfully.
- Generated split directory remained `/tmp/tsz-gen/generated_d01_nested_maps/`.
