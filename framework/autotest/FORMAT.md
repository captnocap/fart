# .autotest — format + runner spec (reactjit port of tsz/tests/*.autotest)

Status: proposal, first committed chunk. Subject to supervisor correction.
Owner: worker-4f14 (autotest infra). Panel-level tests are owned by surface
owners and land separately.

## 1. Heritage

The `.autotest` format originated in the frozen `tsz/` tree. A representative
sample (verbatim from `tsz/tests/04_permission_dialog.autotest`):

```
# 04_permission_dialog: Permission request dialog
expect "Permission Requests"
expect "5 pending"
click "Allow"
expect "Approved"
expect "4 pending"
click "Manual"
expect "Auto-approve"
```

Two verbs: `expect "text"` (assert the string is visible somewhere on
screen), `click "text"` (find the pressable element whose visible label is
this text and dispatch a click). Comments start with `#`. That is the
entire legacy DSL.

We port the **semantic, text-level** model, not a pixel-level one. The
original never did frame hashing. GPU compositing + freetype hinting are
not bit-reproducible across runs on this stack, so pixel hashing would be
flake-prone. Instead we hash the React fiber tree's serialized structure —
this catches behavioral regressions deterministically, which is the stated
goal ("every behavioral bug must be catchable; only visual issues reach the
user").

## 2. File layout

One test per file, `.autotest` extension, UTF-8, LF line endings.

- Blank lines and `#` lines are ignored.
- One statement per line, whitespace-trimmed.
- Statements are `verb arg1 arg2 ...`. String args are `"double-quoted"`;
  simple identifiers and numbers may be bare.
- A test runs top-to-bottom. Statements are synchronous w.r.t. the
  reconciler — each one waits for a render commit before the next.
- Tests target a cart. The cart name is embedded in the file header
  (`@cart cursor-ide`) or inferred from the file's parent directory
  (`cart/<name>/tests/*.autotest`).

Minimal example (`cart/cursor-ide/tests/smoke.autotest`):

```
@cart cursor-ide
@title "open → navigate → close"

expect "Home"
click "Open Folder"
expect "Select directory"
press Escape
expect "Home"
```

## 3. Verbs

Grouped by layer so the runner can implement one layer cleanly at a time.

### 3.1 Interaction (input layer)

| Verb              | Args                                     | Semantics |
| ----------------- | ---------------------------------------- | --------- |
| `click`           | `"text"` or `#id`                        | single left click on the matching node |
| `double_click`    | `"text"`                                 | two clicks within double-click window |
| `right_click`     | `"text"`                                 | context-menu click |
| `long_press`      | `"text" <ms>`                            | press, hold N ms, release |
| `hover`           | `"text"`                                 | move pointer onto node (pointer-enter) |
| `press`           | `<Key>` (e.g. `Escape`, `Ctrl+S`)        | keyboard event dispatched to focused node |
| `type`            | `"literal text"`                         | typed into focused text input |
| `scroll`          | `"text" <dx> <dy>`                       | scroll wheel on node (or focused scrollview) |
| `drag`            | `"from" -> "to"`                         | press-move-release between node centers |
| `set_size`        | `<w> <h>`                                | resize the window (drives layout) |
| `tick`            | `<ms>`                                   | advance the virtual clock N ms (drives animations, effects) |

Targets are resolved by visible text first, then by `#id` (a `data-id` or
`accessibilityId` prop in reactjit primitives). No coordinate targeting —
explicitly excluded to keep tests robust to layout changes.

### 3.2 Assertion (scene-graph layer)

| Verb                | Args                                     | Semantics |
| ------------------- | ---------------------------------------- | --------- |
| `expect`            | `"text"`                                 | visible somewhere in the current frame |
| `expect_not`        | `"text"`                                 | absent from the current frame |
| `expect_count`      | `"text" <n>`                             | exactly N occurrences |
| `expect_focus`      | `"text"` or `#id`                        | that node holds focus |
| `expect_visible`    | `#id`                                    | node rendered and non-zero-size |
| `expect_hidden`     | `#id`                                    | node either unmounted or `display:none` equivalent |
| `expect_prop`       | `#id <name> <json-value>`                | fiber prop equals the given JSON literal |
| `expect_hash`       | `<hex>`                                  | scene-graph hash matches exactly |
| `snapshot_hash`     | `<name>`                                 | record current scene-graph hash into a sidecar `.autotest.snap` |
| `diff_hash`         | `<name>`                                 | compare current hash to the recorded `<name>` — fail on mismatch |

The **scene-graph hash** is computed as `blake3(canonicalize(fiber_tree))`
where `canonicalize` is a stable preorder serialization of
`{type, key, sortedProps, children}` excluding callbacks, refs, and
non-serializable values. This is what replaces "frame hash" in the brief.

### 3.3 Control flow

| Verb      | Args                               | Semantics |
| --------- | ---------------------------------- | --------- |
| `repeat`  | `<n>` `{ ... }` `end`              | run the enclosed block N times (stress mode primitive) |
| `group`   | `"label"` `{ ... }` `end`          | named section, only for reporting; nests ok |
| `with`    | `setting=value` `{ ... }` `end`    | temporarily override a user setting inside the block |
| `wait_for`| `"text"` `<ms>`                    | block until text appears or timeout (for async IO) |

Blocks use brace syntax on their own lines:

```
repeat 100 {
  click "Increment"
  expect "count: ${i}"
}
end
```

`${i}` inside a `repeat` body references the iteration counter (0-based).

### 3.4 Directives (top of file, `@`-prefixed)

- `@cart <name>` — target cart (required if not inferable from path)
- `@title "..."` — human label for reports
- `@requires <feature>` — skip when feature flag missing
- `@setup <name>` / `@teardown <name>` — named fixture hooks
- `@fuzz off|timing|positions|both` — default fuzz policy for this test
- `@timeout <ms>` — per-test budget (default 30s)

## 4. Runner architecture

### 4.1 Substrate

The runner drives the React reconciler directly, not the GPU pipeline. A
headless host shim replaces `framework/renderer/hostConfig.*` with an
in-memory scene-graph recorder that consumes the same mutation command
stream (CREATE / APPEND / UPDATE / REMOVE) the Zig host would. That stream
IS deterministic — it's pure function of React's fiber tree and props.

This means:

- No GPU, no window, no freetype. Runs in Node via the existing
  `scripts/build-bundle.mjs` pipeline with `--target=autotest`.
- 10k+ ops per test is a realistic target: each op is O(fiber-tree-size)
  for layout + hash. For a 500-node scene that's ~20 µs per op in V8 →
  ~200 ms for 10k ops.
- Determinism: React rendering is pure given same props + same order of
  effects. The runner uses a fake clock for `tick`/timers and a seeded
  RNG for any cart that reads `Math.random` via the host bridge.

### 4.2 Process model

`scripts/autotest <cmd>`:

- `run <path>` — run one file or glob, exit non-zero on failure
- `run-all <cart>` — run every `.autotest` in `cart/<cart>/tests/`
- `record <cart> <name>` — launch cart with input recorder attached,
  writes `.autotest` on session end (phase 2 — not in initial commit)
- `diff <path>` — re-run and show scene-graph diff vs. last snapshot
- `fuzz <path> [--iters=N]` — run with timing/position jitter
- `stress <path> [--iters=N]` — run the file N times back-to-back,
  watch for state leaks between iterations
- `list` — enumerate all tests with pass/fail history

### 4.3 Scale guarantees

- **Per-op hash**: O(fiber tree size). Cached incrementally — only dirty
  subtrees re-hash on each mutation, so per-op cost is O(mutation size),
  not O(tree size). This is what makes per-action hashing viable at 10k+ ops.
- **Memory**: hashes are 32-byte blake3 digests. 10k ops → 320 KB. Fine.
- **Parallelism**: `run-all` shards tests across workers; each test is
  independent (fresh React root per file).
- **Fail-fast**: first assertion miss stops the test, logs the last N
  mutations + the full fiber tree for the offending frame.

### 4.4 Fuzz + stress

- `--fuzz=timing`: replay the test with `tick` durations jittered ±20%.
  Assertions must still pass.
- `--fuzz=positions`: click targets get a ±3 px perturbation. Because we
  click-by-text, this only matters for drag/scroll coords — still
  validates handlers don't depend on exact pixels.
- `--stress=N`: runs the file N times in a row in the same process.
  Scene-graph hash at the end of iteration 1 must equal the hash at the
  end of every subsequent iteration. Catches: unreleased effects,
  growing arrays in atoms, listener leaks, timer accumulation.

## 5. Ship integration

`./scripts/ship <cart> --test`:

1. Normal bundle (esbuild → bundle-<cart>.js) as today.
2. Additional bundle with `--target=autotest` → `bundle-<cart>.autotest.js`
   (same React, headless host shim, test runner bootstrap).
3. Invoke `node scripts/autotest run-all <cart>` against that bundle.
4. Exit non-zero on any failure → ship aborts before packaging.

No new Zig code required for the initial runner. Frame-buffer capture
(the supervisor's "frame hash" original framing) is deferred until a
deterministic headless GPU path exists — separate work item.

## 6. Reference test

A single reference test per supervisor's direction (`statusbar` chosen as
the smallest surface with enough interactive state to exercise the runner
at scale: every clickable indicator, every mode toggle, every tooltip
trigger, repeated for stress). Committed as a later chunk, not here.

## 7. What's deferred / not in this spec

- In-app AutotestPanel UI. Supervisor pointed to `tsz/carts/tools/`, which
  is inside the **frozen** `tsz/` tree and cannot be modified per
  CLAUDE.md. Alternative non-frozen location needs to be chosen
  (proposal: `cart/tools/`). Blocking on that decision.
- Input event recorder in `framework/autotest/recorder.zig`. The runner
  can validate authored tests without it; recording is an ergonomics win,
  not a correctness dependency.
- Pixel-level frame hashing. See §1 / §4.1 for why.
- Per-panel `.autotest` files — authored by surface owners per
  supervisor's scope split.
