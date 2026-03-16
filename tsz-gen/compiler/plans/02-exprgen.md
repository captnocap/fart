# Plan 2: Expression Codegen — `exprgen.zig`

## File to create
`tsz/compiler/exprgen.zig`

## Scope
This file ONLY. Do not touch any other compiler files.

## What it does
Translates a single TypeScript expression into a Zig expression. This is the workhorse — called by stmtgen for every expression position (assignments, conditions, return values, function arguments).

## Architecture: Recursive descent expression parser

Parse expressions by precedence (lowest to highest):
1. Logical OR (`||`) → `or`
2. Logical AND (`&&`) → `and`
3. Nullish coalescing (`??`) → `orelse`
4. Equality (`===`, `!==`) → `==`, `!=`
5. Comparison (`<`, `>`, `<=`, `>=`)
6. Additive (`+`, `-`)
7. Multiplicative (`*`, `/`, `%`)
8. Unary (`!`, `-`, `typeof`)
9. Postfix (`++`, `--`)
10. Call/Member access (`a.b`, `a[i]`, `a(x, y)`)
11. Primary (literals, identifiers, parenthesized, object literals)

The token stream comes from the shared lexer. Read tokens via `lex.get(pos)`, advance by incrementing `pos.*`.

## Transform rules

### Property access
```
node.style.width         → node.style.width          (passthrough)
node.text.length         → node.text.len             (.length → .len)
node.children.length     → node.children.len
s.paddingLeft            → s.padding_left            (camelCase → snake_case)
s.flexDirection          → s.flex_direction
```

Import `camelToSnake` from typegen.zig for the name transform. Apply it to ALL property accesses on struct fields. Do NOT apply to local variable names (only after `.`).

### Null handling
```
val === null             → val == null
val !== null             → val != null
x !== undefined          → x != null
```

### Nullish coalescing
```
s.paddingLeft ?? s.padding       → s.padding_left orelse s.padding
resolveMaybePct(val, parent)     → resolveMaybePct(val, parent)   (fn calls pass through)
```

**Important:** `??` has lower precedence than comparison but higher than logical AND/OR.

### Math builtins
```
Math.abs(x)              → @abs(x)
Math.max(a, b)           → @max(a, b)
Math.min(a, b)           → @min(a, b)
Math.floor(x)            → @floor(x)
Math.ceil(x)             → @ceil(x)
Math.sqrt(x)             → @sqrt(x)
```

### Object literals
```
{ x: 0, y: 0, w: 0, h: 0 }     → .{ .x = 0, .y = 0, .w = 0, .h = 0 }
{ r, g, b, a: 255 }              → .{ .r = r, .g = g, .b = b, .a = 255 }
```

Shorthand properties (`{ r, g, b }` where key === value) must expand: `.{ .r = r, .g = g, .b = b }`.

### Array/slice operations
```
arr[i]                   → arr[@intCast(i)]     (when i is signed integer)
str.slice(a, b)          → str[@intCast(a)..@intCast(b)]
new Array(512)           → std.mem.zeroes([512]f32)
```

### Type assertions
```
x as number              → @as(f32, x)
x as i64                 → @as(i64, x)
```

### Ternary
```
cond ? a : b             → if (cond) a else b
```

### String equality
```
a === "hello"            → std.mem.eql(u8, a, "hello")
```

## Public API

```zig
const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;

pub const ExprContext = enum {
    value,        // general expression
    condition,    // inside if/while (result must be bool)
    assignment,   // right side of =
    return_val,   // after return keyword
    argument,     // function call argument
};

/// Parse and emit a Zig expression from the current token position.
/// Advances pos past the consumed tokens.
/// Stops at: semicolon, comma (in argument context), closing paren/brace/bracket at depth 0.
pub fn emitExpression(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
) ![]const u8
```

## How the parser knows when to stop

Expressions end at different tokens depending on context:
- **value/assignment**: stop at `;`
- **condition**: stop at `)` at depth 0
- **argument**: stop at `,` or `)` at depth 0
- **return_val**: stop at `;`

Track paren/bracket/brace depth. Only stop at the terminator when depth == 0.

## Reference: existing expression parsing in codegen.zig

Search for these functions in `tsz/compiler/codegen.zig` — they show how expression parsing already works for the JSX compiler. Your implementation will be more complete but follow the same patterns:

- `emitStateExpr()` — basic expression emitter (handles ternary, comparisons, arithmetic)
- `emitEquality()` — equality/comparison precedence
- `emitComparison()` — relational operators
- `emitPrimary()` — identifiers, literals, parenthesized expressions
- `parseColorValue()` — how `"#hex"` becomes `Color.rgb(r, g, b)` (you may want this too)

## Reference files to READ (do not edit)

- `tsz/compiler/lexer.zig` — Token types, especially: `identifier`, `number`, `string`, `template_literal`, and all operators
- `tsz/experimental/layout.tsz` — lines 176-967 contain real expressions to handle
- `tsz/runtime/layout.zig` — the hand-written Zig equivalents
- `tsz/compiler/codegen.zig` — search for `emitStateExpr`, `emitEquality` for existing patterns

## Edge cases

- **Chained property access:** `node.style.flexDirection` — apply snake_case only to the property names, not the variable
- **Method calls on known types:** `node.children.length` is `.len`, but `someFunc().length` should also be `.len`
- **Negative numbers:** `-1` as unary minus on `1`, not a negative literal
- **String concatenation:** `a + b` where both are strings → this doesn't happen in layout.tsz but flag it if encountered (Zig uses `++` for array concat)
- **Comparison chains:** `a < b && b < c` — these just pass through as `a < b and b < c`
- **Boolean context:** `if (node.text)` in TS means "not null" → `if (node.text != null)` in Zig. When context == .condition and the expression is a bare identifier or property access of nullable type, append `!= null`.

## Testing

Write tests at the bottom of the file:
```zig
test "property access with snake_case" {
    // "node.flexDirection" → "node.flex_direction"
}
test "null coalescing" {
    // "a ?? b" → "a orelse b"
}
test "object literal" {
    // "{ x: 0, y: 1 }" → ".{ .x = 0, .y = 1 }"
}
test "Math builtin" {
    // "Math.abs(x)" → "@abs(x)"
}
```
