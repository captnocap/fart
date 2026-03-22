# Plan 1: Type System Codegen — `typegen.zig`

## File to create
`tsz/compiler/typegen.zig`

## Scope
This file ONLY. Do not touch any other compiler files.

## What it does
Translates TypeScript type declarations (enum, interface, type alias) to Zig type definitions. This is the foundation — every other module needs types to exist first.

## Input patterns and target output

### Enums
```typescript
enum FlexDirection { Row, Column }
```
```zig
pub const FlexDirection = enum { row, column };
```

### Interfaces → Structs
```typescript
interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}
```
```zig
pub const Color = struct {
    r: f32 = 0,
    g: f32 = 0,
    b: f32 = 0,
    a: f32 = 0,
};
```

### Optional fields
```typescript
interface Style {
  width?: number;
  backgroundColor?: Color;
  flexDirection: FlexDirection;
  gap: number;
}
```
```zig
pub const Style = struct {
    width: ?f32 = null,
    background_color: ?Color = null,
    flex_direction: FlexDirection = .column,
    gap: f32 = 0,
};
```

### Function type aliases
```typescript
type MeasureTextFn = (text: string, fontSize: number, maxWidth: number) => TextMetrics;
```
```zig
pub const MeasureTextFn = *const fn (text: []const u8, font_size: f32, max_width: f32) TextMetrics;
```

### Nullable union types
```typescript
let measureFn: MeasureTextFn | null = null;
```
The `| null` part maps to Zig `?T`. This module should expose a helper that other modules call when they encounter `T | null` in type position.

## Type mapping table

| .tsz type | Zig type | When |
|-----------|----------|------|
| `number` | `f32` | struct fields, function params (default) |
| `number` | `i64` | when field name suggests integer (count, index, id) |
| `number` | `usize` | array lengths, loop bounds |
| `string` | `[]const u8` | always |
| `boolean` | `bool` | always |
| `T \| null` | `?T` | union with null |
| `T[]` | `[]T` | array/slice type |
| `T?` (optional field marker) | `?T = null` | interface fields with `?:` |

## Required utility: camelCase to snake_case

Include this as a public function — other modules will import it:
```zig
/// "flexDirection" → "flex_direction"
/// "backgroundColor" → "background_color"
/// "fontSize" → "font_size"
pub fn camelToSnake(alloc: std.mem.Allocator, input: []const u8) ![]const u8
```

Rules:
- Insert `_` before each uppercase letter, then lowercase it
- Consecutive capitals: `getHTTPResponse` → `get_http_response` (lowercase the run)
- Single char: `x` → `x` (no change)

## Public API

```zig
const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;

/// Scan the full token stream and emit all type declarations (enum, interface, type alias).
/// Returns Zig source for the type definition block.
pub fn emitTypeDeclarations(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8) ![]const u8

/// Map a .tsz type annotation to a Zig type string.
/// e.g., "number" → "f32", "string" → "[]const u8", "Color" → "Color"
pub fn mapType(alloc: std.mem.Allocator, tsz_type: []const u8) ![]const u8

/// Map a nullable type: "number | null" → "?f32"
pub fn mapNullableType(alloc: std.mem.Allocator, tsz_type: []const u8) ![]const u8

/// camelCase → snake_case
pub fn camelToSnake(alloc: std.mem.Allocator, input: []const u8) ![]const u8
```

## Defaults for struct fields

When emitting struct fields, non-optional fields need sensible defaults:
- `f32` → `= 0`
- `i64` → `= 0`
- `bool` → `= false`
- `[]const u8` → `= ""`
- enum types → `= .column` (use first variant or a known default)
- struct types → no default (leave it, Zig will require initialization)
- `?T` → `= null`

## Reference files to READ (do not edit)

- `tsz/compiler/lexer.zig` — Token types, Lexer struct, `get()` method
- `tsz/experimental/layout.tsz` — lines 1-155 are all type declarations. This is your test input.
- `tsz/runtime/layout.zig` — lines 1-120ish have the corresponding Zig structs/enums. This is your target output.

## How to test

```bash
zig build tsz-compiler    # must compile (even if not wired in yet)
# Or standalone: zig build-exe tsz/compiler/typegen.zig (if you add a test main)
```

Write a test block at the bottom of the file:
```zig
test "enum declaration" {
    // tokenize "enum Foo { A, B, C }" and verify output
}
test "interface to struct" {
    // tokenize "interface Bar { x: number; y?: string; }" and verify
}
```

## Edge cases to handle

- Empty enum: `enum Empty {}` → `pub const Empty = enum {};`
- Interface extending another: NOT supported in prototype (skip or error)
- Nested interfaces: NOT supported (skip)
- Generic types `T<U>`: NOT supported (skip)
- `readonly` modifier: ignore (Zig const is handled at variable level)
- Comments inside declarations: skip (lexer already filters them)
