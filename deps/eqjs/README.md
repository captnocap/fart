# EQJS v0.1 (Experimental)

This is a greenfield experiment for an AOT pipeline:

1. Parse a constrained JavaScript subset in Zig.
2. Transpile to LuaJIT source.
3. Execute inside LuaJIT with a small runtime that provides:
   - exports collection
   - prototype-like object creation via metatables
   - typed arrays mapped to FFI buffers
   - explicit cartridge-instance lifecycle/closure rooting

It is intentionally incomplete and opinionated. The goal is to test the architecture,
not spec correctness.

## Layout

- `eqjs_transpiler.zig`
  - Minimal JS→Lua transpiler.
  - Emits `exports = { ... }` table for `export function`.
- `eqjs_runtime.lua`
  - LuaJIT runtime for loading a transpiled cartridge.
  - Provides a `Runtime` API exposed as `eqjs` to loaded cartridges.
- `samples/hello.js`
  - A tiny sample program using `new Float64Array(...)`, loops, exports.

## Supported input shape (for now)

- `export` + function declarations
- `let` / `const` / `var` (mapped to local)
- `return`, `if`, `while`
- assignments and basic expressions
- calls/member/indexing
- `new Float64Array(...)` / `new Int32Array(...)` / etc.

Unsupported in this phase (explicitly):

- no `eval`, no `new Function`, no `with`
- no `async` / generators / classes / modules
- incomplete operator coverage
- no spec-level JS coercion semantics

## Build the transpiler

```
zig build-exe eqjs_transpiler.zig
./eqjs_transpiler samples/hello.js samples/hello.lua
```

or run directly:

```
zig run eqjs_transpiler.zig -- samples/hello.js samples/hello.lua
```

## Run a cartridge from LuaJIT

```lua
local eqjs = require("eqjs_runtime")

local js = [[
  export function main() {
    let sum = 1 + 2
    return sum
  }
]]

local cart = eqjs.from_js(js, {
  transpiler = "zig run eqjs_transpiler.zig --",
  label = "my.cartridge",
  render = function(payload)
    -- optional direct host hook
  end,
})

print(cart.exports.main())
cart:close()
```

## Smoke test

Run the regression matrix:

```
./run_matrix.sh
```

or:

```
make smoke
```

The matrix runner prefers `./eqjs_transpiler` when it exists, and falls back to
`zig run eqjs_transpiler.zig --`. You can override that with `EQJS_TRANSPILER`.

## Benchmark suite

Run the benchmark matrix:

```
./bench_matrix.sh
```

or:

```
make bench
```

The benchmark runner writes:

- `bench/results.md`
- `bench/results.tsv`

It compares EQJS and QuickJS where the benchmark is source-compatible, and marks
EQJS-only cases as `n/a` on the QuickJS side.

You can override the QuickJS binary with `QJS_BIN` if needed.

## Host shared memory demo

The Zig host demo allocates a file-backed shared command buffer and launches a
LuaJIT bridge that maps the same file zero-copy:

```
zig run shared_memory_host.zig
```

## Current architecture notes

### Closure GC strategy

- Each loaded cartridge is represented by a runtime `Runtime` instance.
- Exported functions are wrapped in closure bridges that capture the owning instance.
- `close()` clears the instance root set so cross-cartridge references are revoked deterministically.
- `sealed`/metatable flags prevent prototype mutation from mutating runtime fast paths unexpectedly.

### FFI bypass

- The transpiler lowers `new Float64Array(...)` and relatives to `eqjs.typed_array(...)`.
- Runtime currently stores buffers in LuaJIT FFI arrays and exposes index access via a metatable wrapper.

This is an intentionally aggressive starting point and should be treated as a prototype.
