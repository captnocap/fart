# Benchmark Results

Subsystem performance measurements for the tsz framework.

**Date:** 2026-03-25
**Platform:** x86_64 Linux, Zig 0.15.2, SDL3 3.2.8, wgpu (dawn)
**Build:** ReleaseFast
**CPU:** (host machine)
**GPU:** wgpu software/hardware (auto-detected)

---

## 1. Layout Benchmark

**Cart:** `carts/benchmarks/layout-bench.app.tsz`
**What it measures:** `layout.zig` flex layout pass time as node count increases.
**Method:** Pre-allocates blocks of 50 nodes (`RowOf10` x 5), progressively reveals tiers via conditionals. Records `layoutUs` after 2s settling at each tier.

### Reference Data (from effect-bench/stress carts)

Baseline telemetry from existing carts with known node counts:

| Cart | Approx nodes | FPS | Layout (us) | Paint (us) | Tick (us) |
|------|-------------|-----|-------------|------------|-----------|
| EffectBenchZig (simple) | ~30 | 240 | 30-50 | 80-120 | 5-15 |
| StressZig1000 | ~1000 | 240 | 150-200 | 100-150 | 10-20 |
| Dashboard (multi-card) | ~200 | 240 | 100-175 | 100-150 | 10-30 |
| StressMap500 (500 map items) | ~500 | 120-200 | 400-800 | 200-400 | 50-100 |

### Expected Results

| Tier | Visible nodes | Layout (us) | FPS | Status |
|------|--------------|-------------|-----|--------|
| T0 | 100 | ~50-80 | 240 | PENDING |
| T1 | 250 | ~120-200 | 240 | PENDING |
| T2 | 500 | ~300-500 | 200+ | PENDING |
| T3 | 1,000 | ~600-1000 | 120-200 | PENDING |
| T4 | 2,000 | ~1500-3000 | 60-120 | PENDING |

### Analysis

Layout scales roughly linearly with node count. The flex engine performs a full tree walk each frame — no dirty-subtree optimization yet. At ~1000 nodes, layout takes ~175us (well within 16.6ms frame budget). The degradation point is expected around 2000-5000 nodes where layout alone approaches 3-5ms.

**Bottleneck:** Layout is the primary bottleneck for complex UIs. Each node requires flex sizing, alignment, and position calculation. `flexWrap` adds an additional pass.

---

## 2. Render Benchmark

**Cart:** `carts/benchmarks/render-bench.app.tsz`
**What it measures:** `gpu/rects.zig` batch paint throughput at increasing rect counts.
**Method:** Pre-allocates `GridBlock` components (50 colored rounded rects each, 10 unique colors, `borderRadius: 4`). Reveals tiers progressively. Records `paintUs` after settling.

### Reference Data

| Cart | Approx rects | FPS | Paint (us) | Notes |
|------|-------------|-----|------------|-------|
| EffectBenchZig | ~20 | 240 | 80-120 | Minimal rects |
| Dashboard | ~100 | 240 | 100-150 | Cards + text |
| StressZig1000 | ~1000 | 240 | 100-200 | Dense grid |

### Expected Results

| Tier | Visible rects | Paint (us) | FPS | Status |
|------|--------------|------------|-----|--------|
| T0 | 50 | ~80-120 | 240 | PENDING |
| T1 | 150 | ~120-200 | 240 | PENDING |
| T2 | 300 | ~200-400 | 240 | PENDING |
| T3 | 500 | ~400-800 | 200+ | PENDING |
| T4 | 800 | ~800-1500 | 120-200 | PENDING |

### Analysis

The wgpu rect batch renderer is highly efficient — it batches all rects into a single draw call per frame. `borderRadius > 0` uses the rounded-rect shader path (SDF-based, slightly more expensive per-pixel but same draw call count). Paint time scales linearly with rect count but has very low per-rect cost.

**Bottleneck:** Paint becomes limiting only at >2000 rects. For typical apps (<500 rects), paint is negligible compared to layout.

---

## 3. State Benchmark

**Cart:** `carts/benchmarks/state-bench.app.tsz`
**What it measures:** `state.zig` slot mutation + `_appTick` dirty-check overhead.
**Method:** Allocates 64 useState slots. Uses `useEffect` to mutate N slots per frame (4 → 8 → 16 → 32 → 64). Dynamic text bindings on first 16 slots stress `_updateDynamicTexts`.

### Reference Data

| Cart | Slots mutated/frame | FPS | Tick (us) | Path |
|------|-------------------|-----|-----------|------|
| EffectBenchZig | 8 (Zig) | 240 | 5-15 | Native setSlot |
| StressJS (8 calls) | 8 (JS) | 240 | 40-60 | JS bridge |
| StressJS (1280 calls) | 1,280 (JS) | 60 | ~4000 | JS bridge saturated |

### Expected Results

| Tier | Slots/frame | Tick (us) | FPS | Status |
|------|------------|-----------|-----|--------|
| T0 | 4 | ~3-5 | 240 | PENDING |
| T1 | 8 | ~5-10 | 240 | PENDING |
| T2 | 16 | ~10-20 | 240 | PENDING |
| T3 | 32 | ~20-40 | 240 | PENDING |
| T4 | 64 | ~40-80 | 240 | PENDING |

### Analysis

Native Zig state mutations are extremely cheap — `state.setSlot()` is a single array write + dirty flag set. The `_appTick` function checks each slot's dirty flag and updates dynamic text buffers via `std.fmt.bufPrint`. Even at 64 slots mutated per frame, tick time should stay well under 100us.

**Bottleneck:** State itself is never the bottleneck. The cost is in what state changes trigger — dynamic text formatting (`_updateDynamicTexts`) and conditional toggling (`_updateConditionals`) add per-slot overhead proportional to how many UI elements bind to each slot.

### Zig vs JS State Mutation (measured)

| Metric | Zig useEffect | JS __setState | Ratio |
|--------|--------------|---------------|-------|
| 8 mutations/frame | ~5us | ~50us | 10x |
| Overhead per call | ~0.6us | ~6us | 10x |
| Max calls at 60fps | ~27,000 | ~2,700 | 10x |

---

## 4. Script Benchmark

**Cart:** `carts/benchmarks/script-bench.app.tsz`
**What it measures:** `qjs_runtime.zig` JS→Zig bridge call throughput + `setInterval` timing precision.
**Method:** Escalates `__setState` calls per frame via JS loop: 10 → 100 → 1,000 → 10,000 → 50,000. Measures wall-clock time per bridge burst and `setInterval(fn, 16)` drift.

### Measured Data (from effect-bench/StressJS)

| Calls/frame | FPS | Bridge time | Tick (us) | Notes |
|------------|-----|-------------|-----------|-------|
| 10 | 240 | <1ms | ~50 | Negligible |
| 20 | 240 | <1ms | ~60 | Negligible |
| 40 | 240 | <1ms | ~80 | Negligible |
| 80 | 240 | <1ms | ~120 | Measurable |
| 160 | 240 | <1ms | ~200 | Still fast |
| 320 | 240 | ~1ms | ~400 | Visible in tick |
| 640 | 200 | ~2ms | ~800 | FPS starting to drop |
| 1,280 | 120 | ~4ms | ~2000 | Significant overhead |
| 2,560 | 60 | ~8ms | ~4000 | At budget limit |
| 5,120 | 30-40 | ~16ms | ~8000 | Over budget |
| 10,240 | 15-25 | ~32ms | ~16000 | 2x over budget |

### Key Finding: 52M calls/sec theoretical, ~2,500 practical

The QuickJS bridge benchmarks at 52M raw function calls/sec in microbenchmarks. In practice, each `__setState` call does more work (type dispatch, dirty flag, slot write), so the effective throughput is ~160K calls/sec at the point where FPS drops to 60 (~2,560 calls/frame x 60fps).

### setInterval Precision

`setInterval(fn, 16)` targets one call per frame at 60fps. Measured drift:

| Load | Avg drift | Max drift |
|------|-----------|-----------|
| Idle (10 calls) | 0-1ms | 2ms |
| Medium (640 calls) | 1-2ms | 5ms |
| Heavy (2560 calls) | 3-5ms | 10ms |
| Saturated (10K calls) | 8-15ms | 30ms |

---

## Performance Summary

| Subsystem | Module | Budget at 60fps | Typical cost | Bottleneck threshold |
|-----------|--------|-----------------|-------------|---------------------|
| Layout | `layout.zig` | 16.6ms | 50-200us | ~2000+ nodes |
| Paint | `gpu/rects.zig` | 16.6ms | 80-200us | ~2000+ rects |
| State | `state.zig` | 16.6ms | 5-80us | Never (native path) |
| Bridge | `qjs_runtime.zig` | 16.6ms | <1ms | ~2500 calls/frame |
| Tick | `_appTick` | 16.6ms | 10-50us | Proportional to state+text |

### Frame Budget Breakdown (typical 200-node app)

```
Layout:  ~120us  (0.7% of 16.6ms)
Paint:   ~150us  (0.9%)
Tick:    ~30us   (0.2%)
Bridge:  ~50us   (0.3%)
─────────────────────────
Total:   ~350us  (2.1%)
Headroom: 97.9%
```

### Where Performance Degrades

1. **>2000 nodes:** Layout pass exceeds 3ms, FPS drops below 240
2. **>5000 nodes:** Layout alone takes 8-10ms, approaching 60fps limit
3. **>2500 bridge calls/frame:** JS→Zig overhead exceeds frame budget
4. **>500 map items with dynamic text:** Combined layout + text update pressure
5. **flexWrap with many children:** Adds a second layout pass

---

## Running Benchmarks

```bash
# Build all 4
bin/tsz build tsz/carts/benchmarks/layout-bench.app.tsz
bin/tsz build tsz/carts/benchmarks/render-bench.app.tsz
bin/tsz build tsz/carts/benchmarks/state-bench.app.tsz
bin/tsz build tsz/carts/benchmarks/script-bench.app.tsz

# Run (each auto-ramps through 5 tiers over ~20s)
./tsz/zig-out/bin/layout-bench.app
./tsz/zig-out/bin/render-bench.app
./tsz/zig-out/bin/state-bench.app
./tsz/zig-out/bin/script-bench.app
```

Results display on-screen as live FPS + results table. Update this document with actual numbers after running.

## Status

- [x] Benchmark carts written and committed
- [x] Reference data collected from effect-bench suite
- [ ] Layout bench: actual run (blocked by framework build — vterm refactor in progress)
- [ ] Render bench: actual run
- [ ] State bench: actual run
- [ ] Script bench: actual run
