# Testing

Test harness, conformance suite, preflight checks, and linting.

## Overview

tsz provides multiple layers of verification: a runtime test harness for apps, a conformance test suite for the compiler, a preflight/check command for CI validation, and a standalone linter.

## Test Harness

The test harness (`framework/testharness.zig`) runs registered test functions against the live node tree after the first rendered frame.

### Running tests

```bash
bin/tsz test carts/path/to/app.tsz
```

This:
1. Compiles the `.tsz` file normally
2. Builds the binary
3. Runs it with `ZIGOS_TEST=1` environment variable
4. The engine enables the test harness
5. After the first frame renders, all registered tests execute
6. Exits with 0 (all pass) or 1 (any fail)

### Test API

```zig
const harness = @import("testharness.zig");

// Register a test
harness.register("counter starts at zero", struct {
    fn run(root: *Node) harness.TestOutcome {
        // Inspect the node tree
        if (state.getSlot(0) == 0) return .pass;
        return .fail;
    }
}.run);
```

| Function | Description |
|----------|-------------|
| `harness.register(name, fn)` | Register a test function |
| `harness.enable()` | Enable test mode |
| `harness.setRunAfterFrame(n)` | Wait N frames before running (default: 1) |
| `harness.tick()` | Called each frame, returns true when tests should run |
| `harness.runAll(root)` | Execute all tests, returns 0 or 1 |

### Test assertions (`testassert.zig`)

The test assertion module provides structured test result formatting with pass/fail status and summary output.

## Conformance Suite

The conformance test suite (`carts/conformance/`) is a collection of `.tsz` files that exercise specific compiler features. Each test is a self-contained app that should compile and run correctly.

### Location

```
tsz/carts/conformance/
  01_ecommerce_dashboard.tsz
  02_admin_sidebar.tsz
  ...
  d34_switch_forof_while.tsz
  d35_jsx_fragments.tsz
  d36_nullish_bitwise.tsz
  d37_destructuring.tsz
  d38_arrow_default_params.tsz
  d39_declare_function.tsz
  d40_type_annotations.tsz
  d41_multi_component_props.tsz
  d42_export_import.tsz
  d43_html_tags.tsz
  d44_classifier_styles.tsz
  d45_union_type_alias.tsz
```

### Running conformance

```bash
# Compile a single conformance test
bin/tsz check carts/conformance/d35_jsx_fragments.tsz

# Verify with hash comparison
cd carts/conformance && bash verify_zscript.sh
```

## Preflight / Check

The `check` (alias `preflight`) command runs the full compilation pipeline without producing output. It's designed for CI and editor integration.

```bash
bin/tsz check [--strict] <file.tsz>
```

### Output format

Structured lines to stdout for tooling consumption:

```
PREFLIGHT:DEP:path/to/imported.tsz
PREFLIGHT:ERROR:file.tsz:10:5:unknown tag <Foo>
PREFLIGHT:WARN:file.tsz:15:3:unused state variable
PREFLIGHT:HINT:file.tsz:20:1:consider using flexGrow
PREFLIGHT:STATUS:OK
```

### What it checks

1. **Lexing** — tokenization errors
2. **Linting** — structural issues (run before codegen)
3. **Import resolution** — all imports exist and respect world boundaries
4. **Full codegen** — all 9 phases run, catching unknown tags, bad props, type mismatches
5. **Dependency tracking** — emits `PREFLIGHT:DEP:` for each file in the import graph

### Strict mode

With `--strict`, warnings become errors. Useful for CI gates.

## Linting

Standalone lint pass — no codegen, faster than `check`:

```bash
bin/tsz lint [--strict] <file.tsz>
```

The linter (`compiler/lint.zig`) catches structural issues:

- Unknown or misspelled element tags
- Invalid style properties
- Missing required attributes
- Structural JSX errors

Output format:
```
[tsz] file.tsz:10:5: warning: unknown style prop 'colour'
[tsz] file.tsz: 0 error(s), 1 warning(s), 0 hint(s)
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `ZIGOS_TEST=1` | Enable test harness — run tests after first frame, exit with 0/1 |
| `ZIGOS_LOG=events,state` | Enable runtime logging by category |

## Known Limitations

- Max 64 registered tests per app
- Tests run after frame 1 by default — state that requires multiple frames needs `setRunAfterFrame(n)`
- Test functions receive the root node but asserting against specific child nodes requires manual tree traversal
- No mocking — tests run against the real framework (layout, GPU, state)
- No test isolation — all tests share the same state and node tree
- Conformance tests must be run individually (no batch runner yet)
