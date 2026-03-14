# Agent 4: Event System Expansion

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on **both** — expanding the event system in the runtime and wiring it through the compiler.

## Your Mission

Currently only `onPress` is supported as an event handler. The `EventHandler` struct already has `on_key` defined but it's not wired through the compiler. `onChangeText` for TextInput doesn't exist. You need to:

1. Add `onChangeText` callback to the TextInput system
2. Wire `onPress`, `onChangeText`, `onKeyDown` through the compiler
3. Add `onScroll` handler support
4. Expand the handler body parser to handle more patterns

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/runtime/events.zig` (full ownership)
- `tsz/runtime/input.zig` (full ownership)
- `tsz/runtime/main.zig` — event dispatch section only
- `tsz/compiler/codegen.zig` lines 465-518 (attribute parsing for handlers) and lines 1006-1103 (`emitHandlerExpr`)
- A new test example `tsz/examples/events-test.tsz`

## Step 1: Expand EventHandler struct

File: `tsz/runtime/events.zig`

### Current struct (lines 14-19):
```zig
pub const EventHandler = struct {
    on_press: ?*const fn () void = null,
    on_hover_enter: ?*const fn () void = null,
    on_hover_exit: ?*const fn () void = null,
    on_key: ?*const fn (key: c_int) void = null,
};
```

### Add new handlers:
```zig
pub const EventHandler = struct {
    on_press: ?*const fn () void = null,
    on_hover_enter: ?*const fn () void = null,
    on_hover_exit: ?*const fn () void = null,
    on_key: ?*const fn (key: c_int) void = null,
    on_change_text: ?*const fn () void = null,
    on_scroll: ?*const fn () void = null,
};
```

`on_change_text` is `fn () void` (not passing the text) because the handler body will read the text via `input_mod.getText(id)` directly. This keeps the zero-closure design.

### Update `hasHandlers` (lines 48-53):

```zig
fn hasHandlers(h: *const EventHandler) bool {
    return h.on_press != null or
        h.on_hover_enter != null or
        h.on_hover_exit != null or
        h.on_key != null or
        h.on_change_text != null or
        h.on_scroll != null;
}
```

## Step 2: TextInput onChange Callback

File: `tsz/runtime/input.zig`

### Add callback storage

At the top of the file, after the `inputs` array (line 24):
```zig
var on_change_callbacks: [MAX_INPUTS]?*const fn () void = [_]?*const fn () void{null} ** MAX_INPUTS;
```

### Add registration function:
```zig
/// Set a change callback for an input. Called when text content changes.
pub fn setOnChange(id: u8, callback: *const fn () void) void {
    if (id < MAX_INPUTS) {
        on_change_callbacks[id] = callback;
    }
}
```

### Fire callback on text changes

In `handleTextInput` (line 81), after the text is inserted (end of the function), add:
```zig
// Fire onChange callback
if (on_change_callbacks[id]) |cb| cb();
```

In `handleKey` (line 118), after any operation that modifies text (backspace, delete, paste via Ctrl+V), add the same callback fire. The key places are:
- After backspace deletes a character
- After delete key removes a character
- After Ctrl+X cuts selection
- After Ctrl+V pastes

The simplest approach: add a helper and call it at the end of `handleKey` if the text changed:

```zig
// At the start of handleKey, save the current length
const prev_len = inp.len;

// ... existing handleKey body ...

// At the end of handleKey:
if (inp.len != prev_len) {
    if (on_change_callbacks[id]) |cb| cb();
}
```

This catches all text-modifying operations. It won't fire for cursor movement, which is correct.

Also fire on `deleteSelection` if it's called directly (it already fires via the callers above).

### Add setText with callback:

The existing `setText` function (line 426) should also fire the callback:
```zig
pub fn setText(id: u8, text_val: []const u8) void {
    if (id >= MAX_INPUTS) return;
    var inp = &inputs[id];
    const copy_len: u16 = @intCast(@min(text_val.len, BUF_SIZE - 1));
    @memcpy(inp.buf[0..copy_len], text_val[0..copy_len]);
    inp.len = copy_len;
    inp.cursor = copy_len;
    inp.has_selection = false;
    // Fire callback
    if (on_change_callbacks[id]) |cb| cb();
}
```

## Step 3: Scroll Handler

File: `tsz/runtime/main.zig`

In the main loop event handling, find the `SDL_MOUSEWHEEL` case. Currently it scrolls the container directly. After scrolling, fire the on_scroll handler:

Find the mouse wheel handling section and after `scroll_node.scroll_y = ...`:
```zig
if (scroll_node.handlers.on_scroll) |handler| handler();
```

## Step 4: Compiler — Wire New Event Handlers

File: `tsz/compiler/codegen.zig`

### Attribute parsing (lines 465-518)

Currently only `onPress` is captured (lines 514-518):
```zig
} else if (std.mem.eql(u8, attr_name, "onPress")) {
    on_press_start = self.pos;
    try self.skipBalanced();
    on_press_end = self.pos;
}
```

Add new handler attribute variables before the attribute parsing loop (near line 465):
```zig
var on_key_down_start: ?u32 = null;
var on_key_down_end: ?u32 = null;
var on_change_text_start: ?u32 = null;
var on_change_text_end: ?u32 = null;
var on_scroll_start: ?u32 = null;
var on_scroll_end: ?u32 = null;
```

Add parsing in the attribute loop (after the onPress case):
```zig
} else if (std.mem.eql(u8, attr_name, "onKeyDown")) {
    on_key_down_start = self.pos;
    try self.skipBalanced();
    on_key_down_end = self.pos;
} else if (std.mem.eql(u8, attr_name, "onChangeText")) {
    on_change_text_start = self.pos;
    try self.skipBalanced();
    on_change_text_end = self.pos;
} else if (std.mem.eql(u8, attr_name, "onScroll")) {
    on_scroll_start = self.pos;
    try self.skipBalanced();
    on_scroll_end = self.pos;
}
```

### Handler emission (lines 687-699)

Currently only `on_press` handler is emitted. Add similar blocks for the new handlers.

After the onPress handler block (line 699), add:

```zig
// onKeyDown handler
if (on_key_down_start) |start| {
    const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_key_{d}", .{self.handler_counter});
    self.handler_counter += 1;

    const body = try self.emitHandlerBody(start, on_key_down_end.?);
    // on_key takes a c_int parameter — wrap the body in a function that ignores it for now
    const handler_fn = try std.fmt.allocPrint(self.alloc,
        "fn {s}(_: c_int) void {{\n    {s}\n}}", .{ handler_name, body });
    try self.handler_decls.append(self.alloc, handler_fn);

    // Append to handlers struct
    // Need to handle the case where on_press handler already opened .handlers = .{
    // Strategy: collect all handler fields, emit once
}

// onChangeText handler
if (on_change_text_start) |start| {
    const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_change_{d}", .{self.handler_counter});
    self.handler_counter += 1;

    const body = try self.emitHandlerBody(start, on_change_text_end.?);
    const handler_fn = try std.fmt.allocPrint(self.alloc,
        "fn {s}() void {{\n    {s}\n}}", .{ handler_name, body });
    try self.handler_decls.append(self.alloc, handler_fn);
}

// onScroll handler
if (on_scroll_start) |start| {
    const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_scroll_{d}", .{self.handler_counter});
    self.handler_counter += 1;

    const body = try self.emitHandlerBody(start, on_scroll_end.?);
    const handler_fn = try std.fmt.allocPrint(self.alloc,
        "fn {s}() void {{\n    {s}\n}}", .{ handler_name, body });
    try self.handler_decls.append(self.alloc, handler_fn);
}
```

### Handlers struct emission refactor

Currently (line 695-698):
```zig
try fields.appendSlice(self.alloc, ".handlers = .{ .on_press = ");
try fields.appendSlice(self.alloc, handler_name);
try fields.appendSlice(self.alloc, " }");
```

This only handles one handler. Refactor to collect all handler fields:

```zig
// Build handlers struct with all active handlers
var handler_fields: std.ArrayListUnmanaged(u8) = .{};

if (on_press handler was created) {
    if (handler_fields.items.len > 0) try handler_fields.appendSlice(self.alloc, ", ");
    try handler_fields.appendSlice(self.alloc, ".on_press = ");
    try handler_fields.appendSlice(self.alloc, press_handler_name);
}
if (on_key_down handler was created) {
    if (handler_fields.items.len > 0) try handler_fields.appendSlice(self.alloc, ", ");
    try handler_fields.appendSlice(self.alloc, ".on_key = ");
    try handler_fields.appendSlice(self.alloc, key_handler_name);
}
if (on_change_text handler was created) {
    if (handler_fields.items.len > 0) try handler_fields.appendSlice(self.alloc, ", ");
    try handler_fields.appendSlice(self.alloc, ".on_change_text = ");
    try handler_fields.appendSlice(self.alloc, change_handler_name);
}
if (on_scroll handler was created) {
    if (handler_fields.items.len > 0) try handler_fields.appendSlice(self.alloc, ", ");
    try handler_fields.appendSlice(self.alloc, ".on_scroll = ");
    try handler_fields.appendSlice(self.alloc, scroll_handler_name);
}

if (handler_fields.items.len > 0) {
    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
    try fields.appendSlice(self.alloc, ".handlers = .{ ");
    try fields.appendSlice(self.alloc, handler_fields.items);
    try fields.appendSlice(self.alloc, " }");
}
```

To make this work cleanly, restructure the handler creation to save the handler names, then emit the `.handlers` struct once at the end. Use nullable handler name variables:

```zig
var press_handler_name: ?[]const u8 = null;
var key_handler_name: ?[]const u8 = null;
var change_handler_name: ?[]const u8 = null;
var scroll_handler_name: ?[]const u8 = null;

// Create handlers (each block sets the name variable)
if (on_press_start) |start| {
    press_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_press_{d}", .{self.handler_counter});
    self.handler_counter += 1;
    const body = try self.emitHandlerBody(start, on_press_end.?);
    const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ press_handler_name.?, body });
    try self.handler_decls.append(self.alloc, handler_fn);
}
// ... similar for key, change, scroll ...

// Emit handlers struct
var hf: std.ArrayListUnmanaged(u8) = .{};
if (press_handler_name) |n| {
    try hf.appendSlice(self.alloc, ".on_press = ");
    try hf.appendSlice(self.alloc, n);
}
if (key_handler_name) |n| {
    if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
    try hf.appendSlice(self.alloc, ".on_key = ");
    try hf.appendSlice(self.alloc, n);
}
if (change_handler_name) |n| {
    if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
    try hf.appendSlice(self.alloc, ".on_change_text = ");
    try hf.appendSlice(self.alloc, n);
}
if (scroll_handler_name) |n| {
    if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
    try hf.appendSlice(self.alloc, ".on_scroll = ");
    try hf.appendSlice(self.alloc, n);
}
if (hf.items.len > 0) {
    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
    try fields.appendSlice(self.alloc, ".handlers = .{ ");
    try fields.appendSlice(self.alloc, hf.items);
    try fields.appendSlice(self.alloc, " }");
}
```

### Wire onChangeText to input_mod

For TextInput elements, the generated code needs to register the callback. In `emitZigSource` after input registration (lines 1408-1416), if the TextInput has an onChangeText handler, emit:

```zig
input_mod.setOnChange({input_id}, {handler_name});
```

To track this, add a field to the Generator that maps input IDs to their change handler names:
```zig
input_change_handlers: [16]?[]const u8,
```
Initialize to all null. Set it when parsing the TextInput element. Then in emitZigSource:
```zig
for (0..self.input_count) |i| {
    if (self.input_change_handlers[i]) |handler_name| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    input_mod.setOnChange({d}, {s});\n", .{i, handler_name}));
    }
}
```

## Step 5: Expand emitHandlerExpr

File: `tsz/compiler/codegen.zig` lines 1006-1103

Currently the handler body parser recognizes:
- State setters: `setCount(count + 1)`
- FFI functions: `time(0)`
- Built-ins: `playVideo`, `stopVideo`, etc.
- `console.log`

### Add multi-statement handlers

Currently handlers are single expressions. For onChangeText, users will want:
```tsx
onChangeText={() => {
  setName(getText(0));
  setCount(count + 1);
}}
```

To support multi-statement handlers, detect `{` after `=>` and emit multiple statements:

In `emitHandlerBody` (line 989), after skipping `() =>`:
```zig
if (self.curKind() == .lbrace) {
    // Multi-statement handler: { stmt; stmt; ... }
    self.advance_token(); // skip {
    var stmts: std.ArrayListUnmanaged(u8) = .{};
    while (self.curKind() != .rbrace and self.curKind() != .eof) {
        const stmt = try self.emitHandlerExpr();
        try stmts.appendSlice(self.alloc, stmt);
        try stmts.appendSlice(self.alloc, "\n    ");
        if (self.curKind() == .semicolon) self.advance_token();
    }
    if (self.curKind() == .rbrace) self.advance_token();
    return try self.alloc.dupe(u8, stmts.items);
}
```

### Add getText as a handler expression atom

In `emitHandlerExpr` (line 1006), add a case for `getText`:
```zig
if (std.mem.eql(u8, name, "getText")) {
    self.advance_token();
    if (self.curKind() == .lparen) self.advance_token();
    const id = self.curText();
    self.advance_token();
    if (self.curKind() == .rparen) self.advance_token();
    return try std.fmt.allocPrint(self.alloc, "input_mod.getText({s})", .{id});
}
```

Wait — `getText` returns `[]const u8` but state setters expect `i64` (for int state). For string state (Agent 2's work), `setName(getText(0))` would use `state.setSlotString`. For now, handle `getText` as an expression that can be passed to string state setters. This will work correctly once Agent 2's typed state is merged.

## Step 6: Test Example

Create `tsz/examples/events-test.tsz`:

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [scrolled, setScrolled] = useState(0);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888888">{`Scrolled: ${scrolled}`}</Text>

      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Press Me</Text>
      </Pressable>

      <TextInput placeholder="Type here..." style={{ padding: 8, backgroundColor: '#2d2d3d', marginTop: 8, height: 40 }} />

      <ScrollView onScroll={() => setScrolled(scrolled + 1)} style={{ height: 200, backgroundColor: '#2d2d3d', marginTop: 8 }}>
        <Box style={{ height: 600, padding: 16 }}>
          <Text fontSize={16} color="#ffffff">Scroll this content to increment the counter</Text>
          <Text fontSize={14} color="#888888" style={{ marginTop: 200 }}>Keep scrolling...</Text>
          <Text fontSize={14} color="#888888" style={{ marginTop: 200 }}>Almost there...</Text>
        </Box>
      </ScrollView>
    </Box>
  );
}
```

This tests: onPress (existing), TextInput (existing), onScroll (new).

## Verification

```bash
cd /home/siah/creative/reactjit
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/events-test.tsz
```

Run the binary. Press the button (count increments). Type in the text input. Scroll the ScrollView (scrolled counter increments).

## What NOT to Touch

- Do not modify `lexer.zig` — Agent 1 owns that
- Do not modify `state.zig` — Agent 2 owns that
- Do not modify `collectStateHooks` (lines 373-422) — Agent 2 owns that
- Do not modify `emitStateExpr`/`emitStateAtom` (lines 1105-1163) — Agent 1 owns that
- Do not modify the JSX children loop (lines 558-604) — Agent 3 owns that

## Commit

After verification, commit with: `feat(tsz): add onChangeText, onKeyDown, onScroll event handlers`
