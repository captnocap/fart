# Agent 2: State System — String State + Proper Type Detection

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on **both** — the state runtime and the compiler's state detection.

## Your Mission

Currently `useState()` only supports integer initial values. `useState("")` (string), `useState(true)` (boolean), and `useState(0.5)` (float) are all silently treated as `useState(0)`. You need to:

1. Add string support to the runtime state system
2. Make the compiler detect the type of the initial value
3. Emit the correct typed slot creation calls

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/runtime/state.zig` (full ownership)
- `tsz/compiler/codegen.zig` lines 31-35 (`StateSlot` struct) and lines 373-422 (`collectStateHooks`) and lines 1398-1406 (state init in `emitZigSource`)
- `tsz/compiler/codegen.zig` lines 1105-1163 (`emitStateExpr`/`emitStateAtom`) — coordinate with Agent 1 who also touches this. If you need type-aware getters (e.g., `getSlotBool` instead of `getSlot`), add a `stateType()` lookup function near `isState()`/`isSetter()` (lines 159-171) and let Agent 1's expression parser call it.
- A new test example `tsz/examples/string-state-test.tsz`

## Step 1: Runtime — Add String State

File: `tsz/runtime/state.zig`

### Current Value union (line 17-21):
```zig
pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
};
```

### Add string variant:

The challenge: strings need memory. The current design is zero-heap-alloc. For string state, use a fixed buffer per slot — same pattern as `input.zig` which uses `[256]u8` buffers.

Add a string buffer type:
```zig
const STRING_BUF_SIZE = 256;

pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
    string: struct {
        buf: [STRING_BUF_SIZE]u8,
        len: u16,
    },
};
```

### Add string slot functions:

```zig
/// Allocate a new state slot with an initial string value.
pub fn createSlotString(initial: []const u8) usize {
    const id = slot_count;
    std.debug.assert(id < MAX_SLOTS);
    var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = 0 } };
    const copy_len = @min(initial.len, STRING_BUF_SIZE);
    @memcpy(str_val.string.buf[0..copy_len], initial[0..copy_len]);
    str_val.string.len = @intCast(copy_len);
    slots[id] = .{ .value = str_val, .dirty = false };
    slot_count += 1;
    return id;
}

/// Read a string state value.
pub fn getSlotString(id: usize) []const u8 {
    return switch (slots[id].value) {
        .string => |s| s.buf[0..s.len],
        .int => |v| blk: {
            // Format int as string into a scratch buffer
            var buf: [32]u8 = undefined;
            const s = std.fmt.bufPrint(&buf, "{d}", .{v}) catch "";
            break :blk s;
        },
        else => "",
    };
}

/// Set a string state value. Marks dirty if changed.
pub fn setSlotString(id: usize, val: []const u8) void {
    const current = getSlotString(id);
    if (!std.mem.eql(u8, current, val)) {
        var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = 0 } };
        const copy_len = @min(val.len, STRING_BUF_SIZE);
        @memcpy(str_val.string.buf[0..copy_len], val[0..copy_len]);
        str_val.string.len = @intCast(copy_len);
        slots[id].value = str_val;
        slots[id].dirty = true;
        _dirty = true;
    }
}
```

**Note on `getSlotString` returning a slice into the slot buffer:** This is safe because the slot buffer is module-level static memory. The slice is valid until the next `setSlotString` call on the same slot. For template literal formatting, the value is copied into the format buffer immediately, so this is fine.

### Update `saveState` and `loadState`:

The current save/load only handles i64. You need to handle the type tag:

For `saveState` (line 180): Write a type byte (0=int, 1=float, 2=bool, 3=string), then the value data.

For `loadState` (line 199): Read the type byte, then restore the correct type.

This is a breaking change to the state file format, but that's fine — the state file is ephemeral (`/tmp/tsz-state.bin`) and gets deleted after read.

## Step 2: Compiler — State Type Detection

File: `tsz/compiler/codegen.zig`

### Update StateSlot struct (lines 31-35):

```zig
const StateType = enum { int, float, boolean, string };

const StateSlot = struct {
    getter: []const u8,
    setter: []const u8,
    initial_int: i64,
    initial_float: f64,
    initial_string: []const u8,
    slot_type: StateType,
};
```

### Update collectStateHooks (lines 373-422):

Currently at line 397-401, it only parses integer:
```zig
var initial: i64 = 0;
if (self.curKind() == .number) {
    initial = std.fmt.parseInt(i64, self.curText(), 10) catch 0;
    self.advance_token();
}
```

Replace with type-detecting logic:
```zig
var slot_type: StateType = .int;
var initial_int: i64 = 0;
var initial_float: f64 = 0;
var initial_string: []const u8 = "";

if (self.curKind() == .number) {
    const num_text = self.curText();
    // Check if float (contains '.')
    if (std.mem.indexOf(u8, num_text, ".") != null) {
        initial_float = std.fmt.parseFloat(f64, num_text) catch 0.0;
        slot_type = .float;
    } else {
        initial_int = std.fmt.parseInt(i64, num_text, 10) catch 0;
        slot_type = .int;
    }
    self.advance_token();
} else if (self.curKind() == .string) {
    // useState("hello") or useState('')
    const raw = self.curText();
    initial_string = raw[1..raw.len - 1]; // strip quotes
    slot_type = .string;
    self.advance_token();
} else if (self.curKind() == .identifier) {
    const val = self.curText();
    if (std.mem.eql(u8, val, "true")) {
        initial_int = 1;
        slot_type = .boolean;
        self.advance_token();
    } else if (std.mem.eql(u8, val, "false")) {
        initial_int = 0;
        slot_type = .boolean;
        self.advance_token();
    }
}
```

Then update the slot storage:
```zig
self.state_slots[self.state_count] = .{
    .getter = getter,
    .setter = setter,
    .initial_int = initial_int,
    .initial_float = initial_float,
    .initial_string = initial_string,
    .slot_type = slot_type,
};
```

### Add type lookup helper (near lines 159-171):

```zig
fn stateType(self: *Generator, name: []const u8) ?StateType {
    for (0..self.state_count) |i| {
        if (std.mem.eql(u8, self.state_slots[i].getter, name)) return self.state_slots[i].slot_type;
    }
    return null;
}
```

### Update state init emission in emitZigSource (lines 1398-1406):

Currently at line 1401:
```zig
try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
    "    _ = state.createSlot({d});\n", .{self.state_slots[i].initial}));
```

Replace with type-aware emission:
```zig
for (0..self.state_count) |i| {
    const slot = self.state_slots[i];
    switch (slot.slot_type) {
        .int => try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlot({d});\n", .{slot.initial_int})),
        .float => try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlotFloat({d:.6});\n", .{slot.initial_float})),
        .boolean => try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlotBool({s});\n", .{if (slot.initial_int != 0) "true" else "false"})),
        .string => try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlotString(\"{s}\");\n", .{slot.initial_string})),
    }
}
```

### Update template literal rendering for string state

In `parseTemplateLiteral` (line 931-985), when a state variable appears in `${name}`, it currently emits `state.getSlot({id})` with `{d}` format. For string state, it should emit `state.getSlotString({id})` with `{s}` format.

At line 961-965:
```zig
if (self.isState(expr)) |slot_id| {
    try fmt.appendSlice(self.alloc, "{d}");
    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
    const arg = try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id});
    try args.appendSlice(self.alloc, arg);
}
```

Replace with type-aware version:
```zig
if (self.isState(expr)) |slot_id| {
    const st = self.stateType(expr) orelse .int;
    switch (st) {
        .string => {
            try fmt.appendSlice(self.alloc, "{s}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            const arg = try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{slot_id});
            try args.appendSlice(self.alloc, arg);
        },
        .float => {
            try fmt.appendSlice(self.alloc, "{d:.2}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            const arg = try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{slot_id});
            try args.appendSlice(self.alloc, arg);
        },
        .boolean => {
            try fmt.appendSlice(self.alloc, "{s}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            const arg = try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{slot_id});
            try args.appendSlice(self.alloc, arg);
        },
        .int => {
            try fmt.appendSlice(self.alloc, "{d}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            const arg = try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id});
            try args.appendSlice(self.alloc, arg);
        },
    }
}
```

### Update handler setter emission

In `emitHandlerExpr` (line 1011-1016), the setter currently uses `state.setSlot`. For typed state, it should use the correct setter. However, **Agent 4 owns emitHandlerExpr**. Instead, add a helper that Agent 4 can call:

Near the type lookup helper, add:
```zig
fn stateSetterCall(self: *Generator, slot_id: u32, value_expr: []const u8) ![]const u8 {
    const st = self.state_slots[slot_id].slot_type;
    return switch (st) {
        .int => try std.fmt.allocPrint(self.alloc, "state.setSlot({d}, {s});", .{ slot_id, value_expr }),
        .float => try std.fmt.allocPrint(self.alloc, "state.setSlotFloat({d}, {s});", .{ slot_id, value_expr }),
        .boolean => try std.fmt.allocPrint(self.alloc, "state.setSlotBool({d}, {s});", .{ slot_id, value_expr }),
        .string => try std.fmt.allocPrint(self.alloc, "state.setSlotString({d}, {s});", .{ slot_id, value_expr }),
    };
}

fn stateGetterCall(self: *Generator, slot_id: u32) ![]const u8 {
    const st = self.state_slots[slot_id].slot_type;
    return switch (st) {
        .int => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id}),
        .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{slot_id}),
        .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{slot_id}),
        .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{slot_id}),
    };
}
```

Then update `emitStateAtom` (line 1136-1138) to use `stateGetterCall`:
```zig
if (self.isState(name)) |slot_id| {
    self.advance_token();
    return try self.stateGetterCall(slot_id);
}
```

And update `emitHandlerExpr` line 1016 to use `stateSetterCall`:
```zig
return try self.stateSetterCall(slot_id, arg);
```

## Step 3: Test Example

Create `tsz/examples/string-state-test.tsz`:

```tsx
function App() {
  const [name, setName] = useState("World");
  const [count, setCount] = useState(0);
  const [pi, setPi] = useState(3.14);
  const [active, setActive] = useState(true);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Hello, ${name}!`}</Text>
      <Text fontSize={18} color="#888888">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888888">{`Pi: ${pi}`}</Text>
      <Text fontSize={18} color="#888888">{`Active: ${active}`}</Text>

      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Increment</Text>
      </Pressable>
    </Box>
  );
}
```

This tests: string state display, integer state, float state, boolean state display, all in template literals.

## Verification

```bash
cd /home/siah/creative/reactjit
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/string-state-test.tsz
```

If the compiler builds and the example compiles, check that the generated code in `tsz/runtime/generated_app.zig` uses the correct slot creation calls (`createSlot`, `createSlotFloat`, `createSlotBool`, `createSlotString`) and getter/setter variants.

## What NOT to Touch

- Do not modify the lexer (`lexer.zig`) — Agent 1 owns that
- Do not modify the JSX children loop (lines 558-604) — Agent 3 owns that
- Do not modify `emitHandlerExpr` beyond the one setter line (line 1016) — Agent 4 owns that
- Do not modify `events.zig`, `input.zig`, or `main.zig` — Agent 4 owns those

## Commit

After verification, commit with: `feat(tsz): add string/float/bool state type detection and typed slot creation`
