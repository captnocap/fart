# Bun Field Notes — Compiler Patterns for tsz

Field notes from Bun's Zig source. What to steal, what to ignore, what to adapt.

## 1. Arena Allocators (`src/allocators/MimallocArena.zig`)

**What Bun does:**
- Wraps mimalloc (C library) behind Zig's `std.mem.Allocator` interface
- Uses comptime branching: debug builds wrap the heap in `DebugHeap` with `ThreadLock` assertions, release builds have zero overhead
- Explicit owned vs borrowed model: `MimallocArena` owns the heap, `Borrowed` is a non-owning reference — prevents double-free at the type level
- Thread-local default heap via `getThreadLocalDefault()` — fast path avoids heap lookups
- `gc()` and `ownsPtr()` for heap introspection

**What to steal:**
- The comptime debug/release split. Our parser allocates into `std.heap.ArenaAllocator` already, but we don't have safety checks in debug or thread assertions. Adding a `DebugArena` wrapper that validates in debug and vanishes in release is free perf insurance.
- The owned/borrowed pattern for zone-scoped parsing. When we parse `<var>`, `<state>`, `<functions>` zones, each zone could own an arena. Borrowing it to sub-parsers makes lifetime bugs impossible.

**What to ignore:**
- The mimalloc dependency. We don't need a C allocator library — Zig's built-in `ArenaAllocator` is sufficient for our use case (parse, emit, drop). Bun needs mimalloc because they're a runtime; we're a compiler that allocates once and frees once.

## 2. SIMD String Scanning (`src/string/immutable.zig`)

**What Bun does:**
- `AsciiVector = @Vector(16, u8)` — processes 16 bytes at a time (8 on WASM)
- `@splat()` broadcasts a target byte across all lanes for parallel comparison
- `@popCount()` counts matches in a comparison result vector (for `countChar`)
- `@reduce(.Max, vec)` checks if any element exceeds a threshold (for non-ASCII detection)
- Bitwise OR of multiple comparison vectors for multi-character scanning (URL encoding, JS string escaping)
- `@bitCast` reinterprets comparison results as integers for `@ctz` (count trailing zeros) — finds first match position
- Delegates hot paths to `bun.highway` (Google Highway SIMD library via C FFI) for `indexOfChar`, `indexOfNewlineOrNonASCII`, `indexOfNeedsEscapeForJavaScriptString`
- Platform-conditional: `if (comptime Environment.enableSIMD)` gates vectorization, scalar fallback otherwise

**Key pattern — multi-character scanning:**
```
const cmp = @bitCast(vec > max_ascii) | @bitCast(vec == @splat('%')) | @bitCast(vec == @splat('"')) | ...
```
This scans for ANY of multiple characters in one pass. One vector load, multiple comparisons, OR them together, find first hit.

**What to steal:**
- The `@splat` + `@bitCast` + `@ctz` pattern for finding first occurrence of any character in a set. Our soup-tier parser scans for `<`, `{`, `"`, `'`, `=`, `>`, `:`, `;` — currently byte-by-byte. One SIMD load could check all of them.
- `@reduce(.Max, vec) > 127` for non-ASCII detection. When the soup tier hands us `fontFamily: '-apple-system, BlinkMacSystemFont'`, we need to quickly identify it as ASCII-only (no Unicode handling needed).
- The conditional SIMD pattern. Gate behind `comptime` so it works on all targets but accelerates where available.

**What to ignore:**
- The Highway C FFI dependency. We don't need Google Highway — Zig's `@Vector` builtins are sufficient for our scanning patterns. Bun needs Highway because they scan massive JS bundles; we scan individual `.tsz` files that are rarely over 10KB.

## 3. C-ABI Bridge (`src/bun.js/bindings/JSValue.zig`)

**What Bun does:**
- `JSValue` is an `enum(i64)` encoding JavaScriptCore's `EncodedJSValue` — primitives inline, objects as encoded pointers
- Special sentinels: `undefined = 0xa`, `null = 0x2`, `true/false` as constants
- Extern C functions: `extern fn JSC__JSValue__call(...) JSValue`
- String marshalling via `ZigString` (ptr + len, inline struct), `bun.String` (refcounted, must `deref()`), and opaque `JSString` C++ pointers
- `protect()`/`unprotect()` pairs for GC-safe heap storage — reference counting at the bridge level
- `ensureStillAlive()` forces stack references to prevent GC from collecting values during Zig code execution
- Error propagation: extern returns `JSValue`, `.zero` indicates exception, wrapper converts to `bun.JSError!T`

**What to adapt for QuickJS bridge:**
- The enum-encoded value type. Our QuickJS bridge uses raw `JSValue` from the QuickJS C API. We could wrap it in a Zig enum with sentinels for undefined/null/true/false, making the common cases branch-free.
- The protect/unprotect pattern. QuickJS has `JS_DupValue`/`JS_FreeValue` — same concept, different API. Wrapping them in a `Protected(JSValue)` type that auto-frees on scope exit would prevent the leaks we've had.
- The ZigString pattern (ptr + len) for string passing. We already do this but not consistently — sometimes we copy, sometimes we borrow. A single `ZigString` type with explicit ownership rules would clean up the bridge.
- Error propagation via sentinel values. Instead of checking `JS_IsException()` after every call, encode the exception state in the return type and use Zig's error unions.

**What to ignore:**
- The JavaScriptCore-specific encoding. JSC uses NaN-boxing with pointer tagging. QuickJS uses a different value representation (tagged union). The Zig wrapper patterns transfer; the bit layout doesn't.
- The C++ bindings layer. Bun has a massive C++ interop surface for JSC internals. QuickJS is pure C — our bridge is simpler by nature.

## Summary: What to Build

1. **Debug arena wrapper** — comptime split between checked (thread assertions, double-free detection) and unchecked. Use for zone-scoped parsing of `<var>`, `<state>`, `<functions>`.

2. **SIMD token scanner** — `@Vector(16, u8)` with `@splat`/`@bitCast`/`@ctz` for finding the next interesting character in source. Gate behind `comptime Environment.enableSIMD`. Biggest win for soup-tier parsing where we scan through walls of inline CSS.

3. **Protected JSValue wrapper** — Zig type that owns a QuickJS value, auto-frees on scope exit, encodes sentinels for common values, propagates exceptions via error unions. Replaces scattered `JS_DupValue`/`JS_FreeValue` calls.

None of these are urgent. The compiler works. These are the optimizations to reach for when soup-tier compile times need to drop.
