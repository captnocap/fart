# Backend Routing Benchmarks

Every feature gets benchmarked across all three backends. The winner becomes the canonical implementation.

## Backends

| Backend | Runtime | Build | Best for |
|---------|---------|-------|----------|
| Zig native | Compiled, no overhead | `smith --mod` → `.zig` | Layout, GPU, compute |
| LuaJIT | JIT-compiled at load | `<lscript>` block | Handlers, conditionals, hot paths |
| QuickJS | Interpreted JS | `<script>` block | Timers, async, data transforms |

## How to add a feature benchmark

```bash
mkdir feature_name/
```

Create three files:
- `native.mod.tsz` — implementation in TS, compiles to Zig via `forge --mod`
- `script.tsz` — same logic in a `<script>` block (QuickJS)
- `lscript.tsz` — same logic in an `<lscript>` block (LuaJIT)

Create `bench.sh`:
```bash
#!/bin/bash
# Benchmark feature_name across all three backends
set -euo pipefail
cd "$(dirname "$0")"

echo "=== feature_name ==="
# Each implementation exposes the same function signature.
# Bench runner calls it N times and reports ops/sec.
# Use ZIGOS_LOG=telemetry to capture timing.

# Native (Zig)
forge build --mod native.mod.tsz
# ... compile + run with timer ...

# QuickJS
rjit build script.tsz
# ... run with timer ...

# LuaJIT
rjit build lscript.tsz
# ... run with timer ...
```

## Routing Table (fill in as benchmarks complete)

| Feature | QJS | LuaJIT | Zig | Winner | Notes |
|---------|-----|--------|-----|--------|-------|
| hover_tracking | | | | | |
| handler_dispatch | | | | | |
| text_measurement | | | | | |
| physics_tick | | | | | |
| state_dirty_check | | | | | |
| dynamic_text_fmt | | | | | |
| timer_intervals | | | | | |
| canvas_hit_test | | | | | |

## Rules

- Same workload, same data, same machine, same run.
- Measure wall-clock time for N iterations (N ≥ 10000).
- Report ops/sec and relative speedup.
- "Close enough" = within 2x of Zig → pick the more flexible backend.
- Winner goes in the routing table. Losers stay as reference implementations.
