# Plan 3: Statement/Control Flow Codegen — `stmtgen.zig`

## File to create
`tsz/compiler/stmtgen.zig`

## Scope
This file ONLY. Do not touch any other compiler files.

## What it does
Translates TypeScript statements and control flow into Zig statements. Calls `exprgen.emitExpression()` for every expression position. This is where for loops, switch/case, if/else, and variable declarations become Zig.

## Transform rules

### Variable declarations
```typescript
const x = expr;
// →
const x = <expr>;

let x = expr;
// →
var x = <expr>;

let x: number | null = null;
// →
var x: ?f32 = null;

let x: number = 0;
// →
var x: f32 = 0;
```

When there's a type annotation, use `typegen.mapType()` (or inline the mapping). When there's no annotation, let Zig infer from the expression.

### If/else
```typescript
if (cond) {
  body;
}
// →
if (<cond>) {
    <body>
}

if (cond) {
  a;
} else if (cond2) {
  b;
} else {
  c;
}
// →
if (<cond>) {
    <a>
} else if (<cond2>) {
    <b>
} else {
    <c>
}
```

**Truthiness:** In TypeScript, `if (x)` means "not null/undefined/0/false/empty". For nullable types in the layout engine, this means `if (x != null)`. For numbers, `if (x != 0)`. For the prototype, when the condition is a bare identifier or property access, emit `!= null` for nullable contexts. Use exprgen with `context = .condition`.

### For-of loops
```typescript
for (const child of node.children) {
  body;
}
// →
for (node.children) |child| {
    <body>
}
```

**With filtering:**
```typescript
for (const child of node.children) {
  if (child.style.display === Display.None) continue;
  // ...
}
// →
for (node.children) |child| {
    if (child.style.display == .none) continue;
    // ...
}
```

### C-style for loops
```typescript
for (let i = 0; i < n; i++) {
  body;
}
// →
{
    var i: usize = 0;
    while (i < n) : (i += 1) {
        <body>
    }
}
```

The outer block `{ }` scopes the loop variable. Parse the three parts of the for header:
1. Init: `let i = 0` → `var i: usize = 0;`
2. Condition: `i < n` → `i < n`
3. Update: `i++` → `i += 1` (also handle `i += 1`, `i--` → `i -= 1`)

### While loops
```typescript
while (cond) {
  body;
}
// →
while (<cond>) {
    <body>
}
```

### Switch/case
```typescript
switch (justify) {
  case JustifyContent.Center:
    mainOffset = freeMain / 2;
    break;
  case JustifyContent.End:
    mainOffset = freeMain;
    break;
  case JustifyContent.Start:
    break;
}
// →
switch (justify) {
    .center => {
        main_offset = free_main / 2;
    },
    .end_ => {
        main_offset = free_main;
    },
    .start => {},
}
```

**Important details:**
- `case EnumType.Value:` → `.value =>` (strip the enum type prefix, lowercase the variant)
- `break;` is implicit in Zig switch arms — consume it but don't emit
- Multiple statements between case and break become a block `{ ... }`
- `default:` → `else =>`
- Zig reserves `end` as... actually it doesn't, but the convention in the runtime uses `end_` with trailing underscore for the `AlignItems.End` variant. Check the actual enum definitions in `layout.zig` for the exact variant names.

### Return statements
```typescript
return expr;
// →
return <expr>;

return;
// →
return;
```

### Assignment
```typescript
x = expr;
x += expr;
x -= expr;
// →
x = <expr>;
x += <expr>;
x -= <expr>;
```

### Continue / Break
```typescript
continue;
break;
// →
continue;
break;
```

These pass through directly.

## Public API

```zig
const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const TokenKind = lexer_mod.TokenKind;

/// Parse and emit a block of statements (the content between { and }).
/// Assumes pos is AT the opening { token. Advances past the closing }.
/// Returns Zig source for the block body (without outer braces).
/// indent_level controls the indentation depth for the emitted code.
pub fn emitBlock(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) ![]const u8

/// Parse and emit a single statement.
/// Advances pos past the statement (including trailing semicolon if present).
pub fn emitStatement(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) ![]const u8
```

## Dependency on exprgen

Import expression emission:
```zig
const exprgen = @import("exprgen.zig");
```

Call `exprgen.emitExpression()` at every expression position:
- Right side of `=`, `+=`, etc.
- Condition in `if (...)`, `while (...)`, `for (... ; COND ; ...)`
- Value in `return EXPR;`
- Arguments in function calls

**For development without exprgen:** You can stub it by collecting tokens until the expected terminator and joining them with spaces. Replace with real exprgen later.

## Indentation

All emitted code should be properly indented. Pass `indent_level` through recursive calls (increment for nested blocks). Generate indent as `"    " ** indent_level` (4 spaces per level).

## Reference files to READ (do not edit)

- `tsz/compiler/lexer.zig` — Token types
- `tsz/experimental/layout.tsz` — lines 418-967 contain `layoutNode()`, the ultimate stress test for control flow. It has:
  - Nested for loops (both for-of and C-style)
  - Switch/case with enum variants
  - If/else chains
  - Let declarations with type annotations
  - Continue/break
  - Deeply nested blocks (4+ levels)
- `tsz/runtime/layout.zig` — the hand-written Zig target for those same functions

## Statement detection

At the top of `emitStatement()`, peek at the current token to decide which statement to parse:

| Current token | Statement type |
|--------------|---------------|
| `const` | const declaration |
| `let` | let/var declaration |
| `if` | if/else chain |
| `for` | for loop (check for `of` vs `;` to distinguish for-of from C-style) |
| `while` | while loop |
| `switch` | switch/case |
| `return` | return statement |
| `continue` | continue |
| `break` | break |
| `identifier` followed by `=` or `+=` etc. | assignment |
| `identifier` followed by `(` | expression statement (function call) |
| `identifier` followed by `.` | property assignment or method call |
| `{` | nested block |

## Edge cases

- **Empty blocks:** `if (cond) {}` → `if (<cond>) {}`
- **Single-statement if (no braces):** `if (cond) return;` — the layout.tsz file doesn't use this style, but handle it: parse one statement instead of a block
- **Nested switch in if:** proper brace tracking is critical
- **For loop with complex update:** `i += 2` or `i = i + 1` (not just `i++`)
- **Destructuring:** `const { x, y } = expr;` — NOT in layout.tsz, skip for prototype
- **Multiple variable declarations:** `let a = 0, b = 0;` — NOT in layout.tsz, skip

## Testing

```zig
test "if/else" {
    // "if (x > 0) { return x; } else { return 0; }"
}
test "for-of loop" {
    // "for (const child of node.children) { ... }"
}
test "C-style for loop" {
    // "for (let i = 0; i < n; i++) { x += 1; }"
}
test "switch/case" {
    // "switch (dir) { case FlexDirection.Row: ...; break; }"
}
```
