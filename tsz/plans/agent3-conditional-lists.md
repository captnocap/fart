# Agent 3: Conditional Rendering + Dynamic Lists

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on the **compiler's JSX parser** to add conditional rendering and dynamic lists.

## Your Mission

Currently the JSX children loop (codegen.zig lines 558-604) only handles:
- Child JSX elements (`<Tag>`)
- Expression blocks with template literals (`{`...`}`)
- Bare identifiers (`{children}`)
- Raw text content

It cannot handle:
- Ternary in JSX: `{condition ? <A/> : <B/>}`
- Logical AND in JSX: `{condition && <A/>}`
- Map: `{items.map(item => <Text>{item}</Text>)}`

You need to add these patterns.

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/compiler/codegen.zig` lines 558-604 (JSX children parsing loop)
- `tsz/compiler/codegen.zig` lines 715-764 (children array construction)
- New helper functions you add (place them after `emitWindowElement`, around line 1208)
- A new test example `tsz/examples/conditional-test.tsz`

Do NOT modify the lexer, state system, handler parsing, or expression parser functions.

## Design Approach: Display Toggle

The node tree in tsz is **static** — it's compiled to fixed `[_]Node{...}` arrays. You can't add/remove nodes at runtime. But you CAN toggle `.style.display` between `.flex` and `.none` at runtime.

**Strategy:** For `{cond ? <A/> : <B/>}`, emit BOTH branches as children, and add runtime code that sets one to `display: none` based on the condition.

This means:
1. Both branches exist in the array at compile time
2. A function runs each frame that sets `.style.display` on each branch based on state
3. Layout skips `display: none` nodes (already implemented in `layout.zig`)

## Step 1: Parse Ternary in JSX Children

In the JSX children loop (line 558-604), inside the `else if (self.curKind() == .lbrace)` branch (line 566), after checking for template literals and identifiers, add ternary detection.

### How to detect ternary

When you see `{` followed by an identifier that is a state getter, followed by tokens that lead to `?`, it's a ternary. The pattern is:

```
{ identifier (operator identifier/number)* ? <JSXElement> : <JSXElement> }
```

But since we don't have a full expression parser in JSX context yet, use a **lookahead scan**: after `{`, scan forward (without consuming) looking for a `?` token before hitting `}`. If found, it's a ternary expression.

### Implementation

Add a helper function `isTernaryAhead`:

```zig
/// Lookahead: check if the expression between { and } contains a ? (ternary)
fn isTernaryAhead(self: *Generator) bool {
    var look = self.pos;
    var depth: u32 = 0;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .lbrace) depth += 1;
        if (kind == .rbrace) {
            if (depth == 0) return false;
            depth -= 1;
        }
        if (kind == .question and depth == 0) return true;
        if (kind == .eof) return false;
        look += 1;
    }
    return false;
}
```

**Note:** This requires the `?` token to exist in the lexer. Agent 1 is adding it as `.question`. If you're building before Agent 1's changes are merged, you'll need to add `.question` to the TokenKind enum and the `?` case to the single-char switch in the lexer yourself (it's one line each).

### Parse the ternary

```zig
// Inside the {expression} branch of children parsing:
if (self.curKind() == .lbrace) {
    self.advance_token(); // skip {

    if (self.curKind() == .template_literal) {
        // ... existing template literal handling ...
    } else if (self.isTernaryAhead()) {
        // Ternary: {condition ? <TrueJSX/> : <FalseJSX/>}
        const ternary = try self.parseTernaryJSX();
        try child_exprs.append(self.alloc, ternary.true_expr);
        try child_exprs.append(self.alloc, ternary.false_expr);
        // Track condition for runtime display toggle
        if (self.cond_count < MAX_CONDS) {
            self.conds[self.cond_count] = .{
                .condition = ternary.condition,
                .true_arr = "", // filled when array is created
                .true_idx = @intCast(child_exprs.items.len - 2),
                .false_idx = @intCast(child_exprs.items.len - 1),
            };
            self.cond_count += 1;
        }
    } else if (self.curKind() == .identifier) {
        // ... existing identifier handling ...
    }

    if (self.curKind() == .rbrace) self.advance_token();
}
```

### The parseTernaryJSX function

Add near line 1208:

```zig
const TernaryResult = struct {
    condition: []const u8,
    true_expr: []const u8,
    false_expr: []const u8,
};

fn parseTernaryJSX(self: *Generator) !TernaryResult {
    // Parse condition tokens until ?
    var cond: std.ArrayListUnmanaged(u8) = .{};

    while (self.curKind() != .question and self.curKind() != .eof) {
        const name = self.curText();
        if (self.curKind() == .identifier) {
            if (self.isState(name)) |slot_id| {
                try cond.appendSlice(self.alloc,
                    try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id}));
            } else {
                try cond.appendSlice(self.alloc, name);
            }
        } else {
            // Operators: ==, !=, >, <, etc.
            try cond.appendSlice(self.alloc, " ");
            try cond.appendSlice(self.alloc, self.curText());
            try cond.appendSlice(self.alloc, " ");
        }
        self.advance_token();
    }

    if (self.curKind() == .question) self.advance_token(); // skip ?

    // Parse true branch — should be a JSX element
    const true_expr = try self.parseJSXElement();

    // Skip : (colon token)
    if (self.curKind() == .colon) self.advance_token();

    // Parse false branch — should be a JSX element
    const false_expr = try self.parseJSXElement();

    return .{
        .condition = try self.alloc.dupe(u8, cond.items),
        .true_expr = true_expr,
        .false_expr = false_expr,
    };
}
```

## Step 2: Conditional Display Toggle

### Add tracking state to Generator

At the top of the Generator struct (around line 46), add:

```zig
const MAX_CONDS = 32;

const CondInfo = struct {
    condition: []const u8,  // Zig expression that returns i64 or bool
    true_arr: []const u8,   // array name
    true_idx: u32,          // index of true branch in array
    false_idx: u32,         // index of false branch in array
};

// Add to Generator struct fields:
conds: [MAX_CONDS]CondInfo,
cond_count: u32,
```

Initialize in `Generator.init`:
```zig
.conds = undefined,
.cond_count = 0,
```

### Wire up array names

In the children array construction (lines 715-764), after the array is created, update the condition tracking with the actual array name:

After line 729 (`try self.array_decls.append(...)`) add:
```zig
// Update conditional display references
for (0..self.cond_count) |ci| {
    if (!std.mem.eql(u8, self.conds[ci].true_arr, "")) continue; // already assigned
    // Check if this condition's indices fall within this array
    if (self.conds[ci].true_idx < child_exprs.items.len) {
        self.conds[ci].true_arr = arr_name;
    }
}
```

### Emit updateConditionals function

In `emitZigSource`, after the `updateDynamicTexts` function (around line 1325), emit a new function:

```zig
if (self.cond_count > 0) {
    try out.appendSlice(self.alloc, "fn updateConditionals() void {\n");
    for (0..self.cond_count) |i| {
        const ci = self.conds[i];
        if (ci.true_arr.len == 0) continue;
        // If condition is truthy, show true branch, hide false branch
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    if ({s} != 0) {{ {s}[{d}].style.display = .flex; {s}[{d}].style.display = .none; }}" ++
            " else {{ {s}[{d}].style.display = .none; {s}[{d}].style.display = .flex; }}\n",
            .{ ci.condition, ci.true_arr, ci.true_idx, ci.true_arr, ci.false_idx,
               ci.true_arr, ci.true_idx, ci.true_arr, ci.false_idx }));
    }
    try out.appendSlice(self.alloc, "}\n\n");
}
```

### Call updateConditionals in the main loop

In the state dirty check (line 1424-1426):
```zig
if (self.has_state and self.dyn_count > 0) {
    try out.appendSlice(self.alloc, "        if (state.isDirty()) { updateDynamicTexts(); state.clearDirty(); }\n");
}
```

Expand to also call updateConditionals:
```zig
if (self.has_state) {
    var dirty_body: std.ArrayListUnmanaged(u8) = .{};
    try dirty_body.appendSlice(self.alloc, "        if (state.isDirty()) { ");
    if (self.dyn_count > 0) try dirty_body.appendSlice(self.alloc, "updateDynamicTexts(); ");
    if (self.cond_count > 0) try dirty_body.appendSlice(self.alloc, "updateConditionals(); ");
    try dirty_body.appendSlice(self.alloc, "state.clearDirty(); }\n");
    try out.appendSlice(self.alloc, dirty_body.items);
}
```

Also call updateConditionals at init time (after `updateDynamicTexts()` at line 1417):
```zig
if (self.cond_count > 0) try out.appendSlice(self.alloc, "    updateConditionals();\n");
```

## Step 3: Logical AND in JSX

The pattern `{condition && <Element/>}` is simpler — it's just the true branch with no false branch. The false branch is an invisible placeholder node.

### Detection

Add another lookahead:
```zig
fn isLogicalAndAhead(self: *Generator) bool {
    var look = self.pos;
    var depth: u32 = 0;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .lbrace) depth += 1;
        if (kind == .rbrace) {
            if (depth == 0) return false;
            depth -= 1;
        }
        if (kind == .amp_amp and depth == 0) return true;
        if (kind == .question and depth == 0) return false; // it's a ternary, not &&
        if (kind == .eof) return false;
        look += 1;
    }
    return false;
}
```

**Note:** This requires `.amp_amp` token from Agent 1. Same caveat as ternary — add it yourself if building before merge.

### Parse:

In the children loop, add before the ternary check:
```zig
} else if (self.isLogicalAndAhead()) {
    // Logical AND: {condition && <Element/>}
    const result = try self.parseLogicalAndJSX();
    try child_exprs.append(self.alloc, result.element);
    // Track as conditional (true branch only, false is hidden)
    if (self.cond_count < MAX_CONDS) {
        self.conds[self.cond_count] = .{
            .condition = result.condition,
            .true_arr = "",
            .true_idx = @intCast(child_exprs.items.len - 1),
            .false_idx = @intCast(child_exprs.items.len - 1), // same index, just hide it
        };
        self.cond_count += 1;
    }
}
```

For the `&&` case, the `updateConditionals` emission changes: when true_idx == false_idx, just toggle one element:
```zig
if (ci.true_idx == ci.false_idx) {
    // && pattern: single element, show/hide
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "    {s}[{d}].style.display = if ({s} != 0) .flex else .none;\n",
        .{ ci.true_arr, ci.true_idx, ci.condition }));
} else {
    // ternary pattern: two elements, swap visibility
    // ... existing code ...
}
```

```zig
fn parseLogicalAndJSX(self: *Generator) !struct { condition: []const u8, element: []const u8 } {
    var cond: std.ArrayListUnmanaged(u8) = .{};

    while (self.curKind() != .amp_amp and self.curKind() != .eof) {
        const name = self.curText();
        if (self.curKind() == .identifier) {
            if (self.isState(name)) |slot_id| {
                try cond.appendSlice(self.alloc,
                    try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id}));
            } else {
                try cond.appendSlice(self.alloc, name);
            }
        } else {
            try cond.appendSlice(self.alloc, " ");
            try cond.appendSlice(self.alloc, self.curText());
            try cond.appendSlice(self.alloc, " ");
        }
        self.advance_token();
    }

    if (self.curKind() == .amp_amp) self.advance_token(); // skip &&

    const element = try self.parseJSXElement();

    return .{
        .condition = try self.alloc.dupe(u8, cond.items),
        .element = element,
    };
}
```

## Step 4: Test Example

Create `tsz/examples/conditional-test.tsz`:

```tsx
function App() {
  const [mode, setMode] = useState(0);
  const [show, setShow] = useState(1);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Mode: ${mode}`}</Text>

      <Pressable onPress={() => setMode(mode == 0 ? 1 : 0)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Toggle Mode</Text>
      </Pressable>

      <Pressable onPress={() => setShow(show == 0 ? 1 : 0)} style={{ padding: 16, backgroundColor: '#569cd6', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Toggle Show</Text>
      </Pressable>

      {mode ? (
        <Box style={{ padding: 16, backgroundColor: '#2d5a3d', marginTop: 16 }}>
          <Text fontSize={18} color="#4ec9b0">Mode is ON</Text>
        </Box>
      ) : (
        <Box style={{ padding: 16, backgroundColor: '#5a2d2d', marginTop: 16 }}>
          <Text fontSize={18} color="#c586c0">Mode is OFF</Text>
        </Box>
      )}

      {show && (
        <Box style={{ padding: 16, backgroundColor: '#2d3d5a', marginTop: 8 }}>
          <Text fontSize={18} color="#569cd6">This is conditionally shown</Text>
        </Box>
      )}
    </Box>
  );
}
```

**Note about parentheses in JSX ternary:** The `(` and `)` around JSX branches are common in React. They're just grouping — the lexer already handles `(` and `)` as tokens. You may need to skip them in `parseTernaryJSX`: after `?`, check for `(` and skip it; before `:`, check for `)` and skip it. Same for the false branch.

## Verification

```bash
cd /home/siah/creative/reactjit
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/conditional-test.tsz
```

Run the binary. Click "Toggle Mode" — the green/pink boxes should swap. Click "Toggle Show" — the blue box should appear/disappear.

## What NOT to Touch

- Do not modify `lexer.zig` — Agent 1 owns that
- Do not modify `state.zig` — Agent 2 owns that
- Do not modify `collectStateHooks` (lines 373-422) — Agent 2 owns that
- Do not modify `emitStateExpr`/`emitStateAtom` (lines 1105-1163) — Agent 1 owns that
- Do not modify `emitHandlerExpr` (lines 1006-1103) — Agent 4 owns that
- Do not modify `events.zig`, `input.zig`, `main.zig` — Agent 4 owns those

## Token Dependencies

Your work needs `.question` and `.amp_amp` tokens. Agent 1 is adding these. If you're building before Agent 1's merge:
1. Add `question` and `amp_amp` to the `TokenKind` enum in `lexer.zig`
2. Add `'?' => .question` to the single-char switch
3. Add the `&&` multi-char check to `tokenize()`

Keep these changes minimal so they merge cleanly with Agent 1's full lexer overhaul.

## Commit

After verification, commit with: `feat(tsz): add ternary and logical AND conditional rendering in JSX`
