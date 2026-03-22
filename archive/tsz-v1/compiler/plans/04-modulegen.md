# Plan 4: Module Orchestrator — `modulegen.zig`

## File to create
`tsz/compiler/modulegen.zig`

## Scope
This file ONLY. Do not touch any other compiler files.

## What it does
Top-level orchestrator for imperative .tsz files (files with NO JSX, no `function App()`). Scans the full token stream, identifies top-level declarations, and delegates to typegen/stmtgen/exprgen to produce a complete Zig module.

This is the "conductor" — it doesn't do deep parsing itself, it recognizes what's at the top level and calls the right specialist.

## Output structure

For an imperative .tsz file, the generated .zig should have this structure:
```zig
//! ──── GENERATED FILE — DO NOT EDIT ────
//! Source: <input_file>

const std = @import("std");

// ── Imports ────────────────────────────────
const events = @import("events.zig");
// ... other imports from `import { X } from './Y'`

// ── Type definitions ───────────────────────
// (emitted by typegen)
pub const FlexDirection = enum { row, column };
pub const Style = struct { ... };
// ...

// ── Module state ───────────────────────────
var measure_fn: ?MeasureTextFn = null;
var measure_image_fn: ?MeasureImageFn = null;
const LAYOUT_BUDGET: usize = 100000;
var layout_count: usize = 0;

// ── Functions ──────────────────────────────
pub fn setMeasureFn(f: ?MeasureTextFn) void {
    measure_fn = f;
}

fn padLeft(s: *const Style) f32 {
    return s.padding_left orelse s.padding;
}

pub fn layout(root: *Node, x: f32, y: f32, w: f32, h: f32) void {
    layout_count = 0;
    root._flex_w = w;
    root._stretch_h = h;
    layoutNode(root, x, y, w, h);
}
// ...
```

## Top-level declaration scanning

Walk the token stream and classify each top-level construct:

| Pattern | Classification | Handler |
|---------|---------------|---------|
| `enum Name { ... }` | Type declaration | → typegen |
| `interface Name { ... }` | Type declaration | → typegen |
| `type Name = ...` | Type alias | → typegen |
| `import { X } from 'Y'` | Import | → self (emit `const Y = @import(...)`) |
| `export function name(...)` | Public function | → self + stmtgen for body |
| `function name(...)` | Private function | → self + stmtgen for body |
| `let name = expr;` | Module variable | → self (emit `var name = ...`) |
| `let name: Type = expr;` | Typed module variable | → self (emit `var name: Type = ...`) |
| `const name = expr;` | Module constant | → self (emit `const name = ...`) |
| `// comment` | Comment | → passthrough or skip |

## Function declarations

For each function:

### Signature parsing
```typescript
export function layoutNode(node: Node, px: number, py: number, pw: number, ph: number) {
```
→
```zig
pub fn layoutNode(node: *Node, px: f32, py: f32, pw: f32, ph: f32) void {
```

Steps:
1. `export` → `pub`
2. Function name: camelToSnake (but keep it as-is if it's already snake_case — layout functions are camelCase in the .tsz)
3. Parameters: parse `name: Type` pairs, map types via typegen
4. Return type: if `: ReturnType` after `)`, map it. If omitted, infer `void` for functions that don't return, or the mapped type for functions that do.
5. For struct/interface parameter types: pass as pointer (`*Node`, `*const Style`) since Zig structs are passed by value (which is expensive for large structs)

### Body
Delegate to `stmtgen.emitBlock()` for the function body.

### Return type inference
- If the function has `return expr;` where expr is not void → infer from return type annotation or expression
- If the function has no return value → `void`
- If the function has `: number` return → `f32`
- If the function has `: boolean` return → `bool`
- If the function has `: Type` return → mapped Type

## Import handling

```typescript
import { EventHandler } from './events';
```
→
```zig
const events = @import("events.zig");
const EventHandler = events.EventHandler;
```

For imports from relative paths:
- `'./events'` → `"events.zig"`
- `'../types'` → `"../types.zig"` (preserve relative path, add .zig)

For imports of specific names: emit a const alias that pulls from the imported module.

## Module-level variables

```typescript
let measureFn: MeasureTextFn | null = null;
```
→
```zig
var measure_fn: ?MeasureTextFn = null;
```

```typescript
const LAYOUT_BUDGET = 100000;
```
→
```zig
const LAYOUT_BUDGET: usize = 100000;
```

```typescript
let layoutCount = 0;
```
→
```zig
var layout_count: usize = 0;
```

Apply camelToSnake to variable names. Map types. For `const` with numeric literal and ALL_CAPS name, use `usize` or `comptime_int`.

## Public API

```zig
const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;

/// Generate a complete Zig module from an imperative .tsz file.
/// This is the entry point — called instead of codegen.Generator.generate()
/// when the .tsz file has no App function and no JSX.
pub fn generate(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    input_file: []const u8,
) ![]const u8
```

## Dependencies

```zig
const typegen = @import("typegen.zig");
const stmtgen = @import("stmtgen.zig");
const exprgen = @import("exprgen.zig");
```

**For development without the other modules:** Stub the imports. For typegen, you can inline basic type mapping. For stmtgen, collect tokens in function bodies and emit them as comments. Wire in the real modules later.

## Reference files to READ (do not edit)

- `tsz/compiler/lexer.zig` — Token types
- `tsz/compiler/codegen.zig` — Look at `emitZigSource()` and `emitRuntimeFragment()` for how the existing orchestrator structures its output. Also look at `generate()` for the phase-based scanning approach.
- `tsz/experimental/layout.tsz` — the full input file (968 lines)
- `tsz/experimental/layout.gen.zig` — the current (broken) output to replace
- `tsz/runtime/layout.zig` — the hand-written target (~1000 lines of Zig). Your output should approach this.

## Ordering within the output

The Zig output must be ordered so that types are defined before they're used:

1. File header + imports
2. Forward declarations (if needed — Zig handles this via lazy compilation, so usually not needed)
3. Type definitions (enums first, then structs that reference enums, then structs that reference other structs)
4. Module-level variables
5. Helper functions (private, used by other functions)
6. Public API functions
7. Entry point / export markers

For the prototype, just emit in source order — the .tsz file already has types before functions.

## Edge cases

- **Functions that call each other:** Zig supports mutual recursion between functions in the same file. No forward declarations needed.
- **Circular struct references:** `Node` contains `children: []Node`. Zig handles this for slices (not for by-value). Make sure Node.children is `[]Node` (slice) not `[N]Node` (array).
- **Generic helper functions:** `resolveMaybePct` takes `number | null` and returns `number | null`. This maps to `fn resolveMaybePct(val: ?f32, parent: f32) ?f32`.
- **Method-style calls on arrays:** `node.text.slice(a, b)` — these are expressions, handled by exprgen. But modulegen needs to recognize them as expression statements.
- **Empty functions:** `export function setMeasureFn(f) { measureFn = f; }` — valid, just a single assignment.

## Testing

The ultimate test is:
```bash
zig build tsz-compiler
./zig-out/bin/tsz compile-runtime tsz/experimental/layout.tsz
# Check tsz/experimental/layout.gen.zig for valid Zig output
zig build  # verify the output compiles (if wired into build.zig)
```

For incremental testing, add a test block:
```zig
test "module generation" {
    // Tokenize a small .tsz module, generate, verify output contains expected patterns
}
```
