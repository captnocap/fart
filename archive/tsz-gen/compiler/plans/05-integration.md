# Plan 5: Integration — Wire imperative mode into the CLI

## Files to modify
- `tsz/compiler/main.zig` — routing logic (small change)
- `tsz/compiler/codegen.zig` — NO changes needed (it already errors on missing App)

## Scope
Small integration work. DO THIS LAST, after Plans 1-4 are complete and tested individually.

## What it does
Detect when a .tsz file is "imperative mode" (no JSX, no `function App()`) and route to `modulegen.generate()` instead of `codegen.Generator.generate()`.

## Detection heuristic

After tokenizing, scan for two things:
1. Is there a `function` token followed by `App` token? → JSX mode (existing codegen)
2. Is there any `<` token that looks like JSX (not a comparison)? → JSX mode

If neither: imperative mode → call `modulegen.generate()`.

More precisely:
```
has_app = scan tokens for: identifier("function") followed by identifier("App")
has_jsx = scan tokens for: lt token followed by uppercase identifier (e.g., <Box, <Text)

if (!has_app && !has_jsx) → imperative mode
else → existing JSX codegen
```

## Changes to main.zig

Find the `compileFile()` or equivalent function where `codegen.Generator.generate()` is called. It currently looks roughly like:

```zig
var lex = lexer.Lexer.init(merged_source);
lex.tokenize();

var gen = codegen.Generator.init(alloc, &lex, merged_source, input_file);
const zig_source = gen.generate() catch |err| {
    std.debug.print("[tsz] Compile error: {}\n", .{err});
    return false;
};
```

Add the imperative mode check BEFORE calling `gen.generate()`:

```zig
var lex = lexer.Lexer.init(merged_source);
lex.tokenize();

// Detect imperative mode (no App function, no JSX)
const is_imperative = !hasAppFunction(&lex, merged_source) and !hasJSXTags(&lex, merged_source);

const zig_source = if (is_imperative) blk: {
    const modulegen = @import("modulegen.zig");
    break :blk modulegen.generate(alloc, &lex, merged_source, input_file) catch |err| {
        std.debug.print("[tsz] Compile error (imperative): {}\n", .{err});
        return false;
    };
} else blk: {
    var gen = codegen.Generator.init(alloc, &lex, merged_source, input_file);
    break :blk gen.generate() catch |err| {
        std.debug.print("[tsz] Compile error: {}\n", .{err});
        return false;
    };
};
```

Add the detection helpers (simple token scan functions):
```zig
fn hasAppFunction(lex: *const lexer.Lexer, source: []const u8) bool {
    var i: u32 = 0;
    while (i + 1 < lex.count) : (i += 1) {
        if (lex.get(i).kind == .identifier and
            std.mem.eql(u8, lex.get(i).text(source), "function") and
            lex.get(i + 1).kind == .identifier and
            std.mem.eql(u8, lex.get(i + 1).text(source), "App"))
        {
            return true;
        }
    }
    return false;
}

fn hasJSXTags(lex: *const lexer.Lexer, source: []const u8) bool {
    var i: u32 = 0;
    while (i + 1 < lex.count) : (i += 1) {
        if (lex.get(i).kind == .lt and lex.get(i + 1).kind == .identifier) {
            const name = lex.get(i + 1).text(source);
            if (name.len > 0 and name[0] >= 'A' and name[0] <= 'Z') {
                return true; // <Uppercase — this is JSX
            }
        }
    }
    return false;
}
```

## Output path

For `compile-runtime` mode (fragments), the output path is already determined by the CLI. For `build` mode, the output goes to `generated_app.zig`. For imperative modules, the output should go to the fragment output path since these are library modules, not apps.

Check if the existing `compile-runtime` command already routes correctly — it might already call `generate()` with `mode = .runtime_fragment`. If so, the imperative mode should produce output compatible with that path.

## Build system

The new files need to be importable. In `build.zig`, the compiler executable already compiles `tsz/compiler/main.zig` as root, which can `@import` any other .zig file in the same directory. No build.zig changes should be needed — Zig's lazy compilation will pull in the new files when they're imported.

Verify: `zig build tsz-compiler` should compile everything transitively.

## Testing

```bash
# 1. Build the compiler
zig build tsz-compiler

# 2. Test imperative mode on layout.tsz
./zig-out/bin/tsz compile-runtime tsz/experimental/layout.tsz

# 3. Verify the output is valid Zig (at minimum, no syntax errors)
cat tsz/experimental/layout.gen.zig

# 4. Verify JSX mode still works (no regressions)
./zig-out/bin/tsz build tsz/examples/counter.tsz
./zig-out/bin/tsz build tsz/examples/layout-stress.tsz

# 5. Run all examples
for f in tsz/examples/*.tsz; do
  ./zig-out/bin/tsz build "$f" 2>&1 | grep -q "Built" || echo "FAIL: $f"
done
```

## What NOT to change

- **codegen.zig** — leave it alone. It already returns `error.NoAppFunction` when there's no App, which is fine. The routing happens before it's called.
- **lexer.zig** — no changes needed. The same tokenizer works for both modes.
- **build.zig** — no changes needed (unless the new .zig files have external dependencies, which they don't).

## Future: mixed mode files

Eventually, a .tsz file might have BOTH type declarations AND an App function with JSX. The existing codegen would need to call typegen for the type declarations and its own JSX pipeline for the rest. That's a future integration — for now, it's either/or.
