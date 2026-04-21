# JSRT — JavaScript runtime in LuaJIT

JSRT is the replacement for QuickJS. JS source stays JS at every stage. There is no tool that translates JS to Lua. The Lua code in this directory is an **evaluator**: it reads JS (or its pre-parsed AST) as *data* and executes JS semantics against it.

## The line to hold

**Scope ends at ECMAScript.** The evaluator knows:

- var / let / const, function calls, closures, arrow functions
- prototype chain, `this`, `new`, classes
- try / catch / throw, finally
- Map, Set, WeakMap, WeakSet, Symbol, iterator protocol
- Object / Array / String / Math / Number / JSON / Error built-ins
- Template literals, destructuring, spread / rest
- Loops, conditionals, switch, break / continue / labels

The evaluator does **NOT** know:

- React, hooks, JSX, components, reconcilers
- Anything framework-specific

esbuild lowers JSX to `React.createElement(...)` calls before anything hits JSRT. By the time the evaluator sees a bundle, React library code looks the same as any other JS program. There is no point at which the evaluator needs React awareness. **If you catch yourself writing evaluator code that names `useState`, `hook`, `fiber`, `component`, or any React concept — STOP. That is the trap.**

## Why this shape and not a transpiler

Transpiler / compiler / codegen all do the same activity: read source, produce source or code. Label is not the thing. The real axis is **scope**: does the tool know about the framework?

- A tool that reads JS and emits Lua can be written at the language level (translate ECMAScript syntax to Lua syntax, preserve semantics via runtime helpers). That's what the original EQJS was supposed to be — now deleted; the transpile direction is the trap.
- But because the translated output has to encode JS semantics *through the emitted Lua*, every JS feature = emitter code. Every new pattern in an input bundle = emitter bug. The emitter is tempted to peek above JS into framework territory to make specific patterns emit better Lua — that's where it drifts and scope blows up.
- An **evaluator** (this thing) puts all semantics in ONE place. The evaluator file *is* JS semantics. Adding a new JS feature means adding a handler in the evaluator, not emitting code everywhere. The evaluator can't drift into React-awareness because it never sees "React" — it sees identifier `React` referring to a bound value, same as any identifier.

LuaJIT's trace JIT handles this pattern well. It specializes the evaluator loop for the hot paths in the program being interpreted → effective JIT compilation of the JS running through it. Usually 2-5× native speed, which is 10-20× faster than QJS for closure-heavy code.

## Architecture

```
Cart .tsx
    │
    ▼ esbuild (unchanged)
JS bundle (.js)
    │
    ▼ optional: acorn parse at build time
AST (Lua table literal)              ← DATA, never code
    │
    ▼ LuaJIT loads
JSRT evaluator (this directory)      ← Lua code that executes JS semantics
    │
    ▼ React library code runs inside the evaluator
React.createElement, hostConfig, reconciler — all plain JS, executed
    │
    ▼ hostConfig calls host FFI
__hostCreate / __hostAppend / __hostUpdate (globals exposed to evaluator)
    │
    ▼ framework/luajit_runtime.zig bindings
Zig applies mutations to node tree
    │
    ▼ framework/engine.zig
Layout → paint → GPU
```

Event dispatch runs the reverse direction: Zig receives input → calls into the evaluator → the JS event handler runs through the evaluator → React schedules re-render → reconciler emits mutation ops → back to Zig.

## File map (being built)

- `README.md` — this file (manifesto + scope guardrail + file map)
- `evaluator.lua` — the tree-walking evaluator. Handles Program / Statement / Expression nodes. THE thing that makes JSRT work.
- `values.lua` — value representation. Null vs undefined sentinels, object + array tables with prototype metatables, function value shape.
- `scope.lua` — environment records. Variable bindings, parent-chain lookup, function call frames.
- `builtins.lua` — global objects and prototype methods: Object, Array, String, Math, Number, JSON, Error, Map, Set, WeakMap, Symbol, console.
- `host.lua` — the globals that cross into Zig (`__hostCreate`, `__hostAppend`, `__dispatchEvent`, etc). Pure thin wrappers over `framework/luajit_runtime.zig`'s registered host-fns.
- `init.lua` — entry point: loads AST, constructs a root scope with builtins + host globals, calls evaluator on the Program node.

## What's *not* here and shouldn't be

- No `emit.lua`, no `compile.lua`, no `transpile.lua`, no `codegen.lua`. If a file with one of these names shows up in this directory, someone is building the trap. Delete it.
- No `react_*.lua`, no `hooks.lua`, no `component_runtime.lua`. If the evaluator needs to know about React, the evaluator has drifted above its scope. Back it out.
- No `bundle.lua.generated` file. The output of the build pipeline is JS (or JS AST as a table literal of data). Not Lua source. Ever.

## Working integration

Once the evaluator is stable, integration looks like:

1. `framework/luajit_runtime.zig` loads the AST data (Lua table literal produced by build step) and calls `init.lua:run(ast)`.
2. The evaluator executes the program. React mounts. React's hostConfig (running through the evaluator) calls the `__host*` globals.
3. Mutation command stream crosses into Zig via the registered host-fns — the *same* stream shape the current QJS bridge produces and `renderer/reconciler.lua` / `renderer/hostConfig.lua` already consume.
4. Zig's node tree / layout / paint pipeline consumes the stream unchanged.

Existing pieces that already fit this shape:

- `renderer/reconciler.lua` + `renderer/hostConfig.lua` — Lua-side reconciler + emitter, already works. Serves as the host-config target for JSRT and as correctness baseline.
- `framework/lua/jsrt/test/reconciler_bridge.lua` — end-to-end proof that JSRT drives the Lua reconciler: boots a JS counter, mounts into a retained tree, dispatches a click, verifies the text update.
- `framework/lua/jsrt/test/host_config_golden.lua` — unit test for the reconciler emitter protocol in isolation.
- `framework/luajit_runtime.zig` — LuaJIT host with input dispatch parity already wired (commit 2909030c0).

## Progress

Milestones and their status live in `TARGET.md` next to this file. Each milestone is a specific JS source + expected runtime behavior. Run:

```bash
./framework/lua/jsrt/test/run_targets.sh
```

to see which targets pass, which are pending, and which are failing. Targets are ordered — work them in sequence. A failing target is fixed by fixing the evaluator (or adding a built-in), never by weakening the target.

Every feature added must be a JS-language feature. If a gap surfaces that looks like "the evaluator doesn't handle this React pattern," the framing is wrong — the correct framing is "the evaluator doesn't handle this JS expression." React patterns come out of ordinary JS evaluation, not out of evaluator React-awareness.
