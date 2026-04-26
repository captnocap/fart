# Cycle 3 Blueprint

> Status: checkpoint document. Captures everything discussed in the brainstorming conversation that produced it. Not yet a plan, not yet a spec — a *map* so the ideas stop living only in a conversation buffer. Subject to refinement. Read top to bottom in one sitting. **This document has no forecasts or timelines. Work takes however long it takes; phases close when their dependencies are satisfied. If you find a time estimate in this doc, it's a bug — delete it.**

> **LANE PIVOT (read this first).** This document was originally drafted under a **chad-only / intent-syntax-only** commitment (see §5). That attempt did not pan out — pushing the entire sweatshop through the intent dictionary in one go produced more friction than progress. **Every supervision idea in this document still applies, unchanged. The lane has changed: cycle 3 is built in the *mixed lane*, on top of the existing `tsz/carts/conformance/mixed/cursor-ide/` cart as the starting shell.** Any sentence in this doc that says "intent syntax only", "chad only", "no mixed lane", "rewrite in dictionary primitives", or "do not port cursor-ide's code shape" is **historical context, not the current direction.** Where a section still reads as if chad-only is the law, treat it as mixed-lane work that may opt into intent-syntax primitives where they help — never as a hard prohibition on mixed-lane code. Cursor-ide is the foundation; the cockpit, supervisor, classifiers, M3A memory, planner triangle, and everything in §A1–§A31 land *on top of* that shell, not as a parallel intent-syntax rewrite of it.

---

## 0. What this document is

This is the top-level overview of cycle 3 — the sweatshop cart. It exists because the conversation that produced it covered a lot of ground (vision, substrate inventory, old-cart diagnosis, rationalization detection, context kernel, brainstorm/enforce modes, first concrete moves) and none of that was on disk yet. One atomic brain dump, committed to reality, so the next session doesn't have to rediscover any of it.

**Syntax discipline (UPDATED — see Lane Pivot at top):** the sweatshop is built in the **mixed lane**, on top of the existing `tsz/carts/conformance/mixed/cursor-ide/` cart as the starting shell. The earlier draft of this section committed to chad / intent-syntax only and that proved to be too much friction to ship — see §5 for the original reasoning, kept as historical context. Intent-syntax primitives from `~/creative/reactjit/tsz/docs/INTENT_DICTIONARY.md` are still preferred where they make a piece of UI or logic clearer, but mixed-lane TSX is the working baseline, not a forbidden fallback. The cursor-ide cart is the foundation we extend; the cockpit, supervisor, classifiers, M3A memory, and the §A-additions all land *on top of* that shell.

It is *additive* to the existing `claude-sweatshop/` methodology:

- `README.md` — the operational methodology (kitty panes, hooks, supervision model). Cycle 1+2 field-tested. **Still load-bearing.**
- `pathologies.md` — worker failure catalog. **Still load-bearing.**
- `laws/` — formal statutes derived from incidents. **Still load-bearing.**
- `hooks/`, `scripts/`, `supervisor/` — the shell-script layer that makes the current supervisor work. **Still load-bearing.**
- `incidents/`, `proof/`, `lifecycle/` — evidence archives and worker lifecycle policy. **Still load-bearing.**

Cycle 3 does **not** replace any of these. It builds the *engineered, tsz-native version* of the sweatshop on top of the framework primitives that got built in cycles 1 and 2, while carrying every existing law, pathology, hook, and briefing forward verbatim. The kitty-pane supervision model continues to work; cycle 3 adds a compiled cockpit that makes it stop being a collection of shell scripts and start being a real application.

---

## 1. The context

### Where we are

- **Cycle 1**: love2d/lua reference stack. Lua-side pty/vterm/classifier/claude-session/semantic-graph work. Living in `~/creative/reactjit/love2d/` and frozen as reference material. 6.4k+ lines across claude_canvas, claude_session, claude_graph, claude_renderer, semantic_graph, session_recorder, classifiers/, pty.lua, vterm.lua, libvterm_shim. Real working supervisor-of-claude integration, but Lua-scripted.
- **Cycle 2**: tsz/framework — Zig-native substrate. pty.zig + pty_client.zig + pty_remote.zig, vterm.zig, classifier.zig, semantic.zig, recorder.zig, agent_core/session/spawner, sqlite.zig, query.zig, llama_exports.zig, ifttt.zig, tool_framework.zig, luajit_runtime, qjs_runtime, canvas.zig, router.zig, telemetry.zig. Also: the .tsz language + compiler, the conformance test infrastructure (`tsz/carts/conformance/`, 180+ verified tests), the cursor-ide cart (80 files, 49KB app shell) proving serious apps compile, the semantic-terminal cart, the claude-canvas cart, and the first attempt at supervisor-dashboard (which failed in instructive ways — see §6). Note: the framework has multiple surface lanes (soup/mixed/chad/lscript/zscript exist as conformance directories). **The sweatshop builds in the mixed lane on top of the cursor-ide cart.** Earlier drafts of this doc said "intent syntax only" — that pivot is documented in the Lane Pivot note at the top and in §5; treat any "chad-only" framing in this doc as historical.
- **Cycle 3**: this blueprint. **No corners, no hacks, no bullshit.** The hardest part of this cycle is doing it correctly. Most of the pieces exist. The work is in composing them into a coherent supervisor application that doesn't repeat the mistakes of the supervisor-dashboard v1 cart.

### The cycle 3 ask, in one sentence

Build the tsz-native sweatshop cart — the engineered version of what kitty/hooks/shell-scripts do today — using framework primitives that already exist, as a composition not a rewrite, and use it as the conformance surface that stresses every part of the reactjit framework at the same time.

---

## 2. Vision

### What cycle 3 delivers, concretely

A single reactjit cart you run that is:

- **A cockpit, not a dashboard, not an IDE.** Game-shaped: RTS / air-traffic-control, not Jira. All relevant state visible at once on an infinite canvas of tiles — `canvas.zig` already provides the canvas primitive. Peripheral awareness, not tab-switching. Hotkey-first input. Sound cues for things that need the user (audio libs exist, but the lua stack's audio is significantly more mature than the tsz stack's — prefer `<lscript>` for the audio path; see §3 on the lua maturity gap). A threat counter that tells you at a glance whether you can look away. **You do not look at code in this cockpit.** You watch the worker's buffer, the tool-call snippets claude is streaming, the `.autotest` output (is it generating the right signal points so claude stops asking to run broken files?), the `tests/screenshots/` to see what visually passed or failed, and the git audit tile to check that work is safe and flowing. If you're touching code at all, it's to copy-paste it to a worker or to show a worker something. Primary activity: steering the worker around like a bull ride with a blindfold on.
- **A real supervisor, not a status display.** Watches N parallel worker CLIs (Claude Code, Codex, Kimi — same scraping and classifier pieces in `pty.zig` + `vterm.zig` + `classifier.zig`, different per-CLI reader modules). Catches rationalization, drift, quick-hack pivots, fake greens, "for now" bandaids, unsupported-laundering, and every other pathology already cataloged in `pathologies.md` and the `laws/` directory. Flags them, escalates them, blocks destructive actions before they land. **Uses embedded local models running in parallel** via `llama_exports.zig` (llama.cpp compiled in directly, not HTTP-to-ollama). One small model per watcher concern — rationalization detector, drift detector, file-change watcher fed by `fswatch.zig`, claim verifier, tool-risk gate. These run continuously, absorb most of the supervisor load, and escalate to the Opus-tier supervisor only when local models are uncertain or when destructive action is imminent.
- **A conversation surface that crystallizes into enforcement.** Brainstorm mode: you and the supervisor (me, or whoever's running the cockpit) talk through a feature like collaborators. Enforce mode: the brainstorm gets crystallized into a spec (using the existing `plan-schema.md` structure), workers get spawned against the spec, drift gets caught.
- **A persistent memory that works.** Not markdown-file memory that returns a two-line summary and a filename — a bundle store that retrieves the full original context of relevant past incidents when the current situation resembles them.
- **A serious mixed-lane application built on top of cursor-ide.** The cursor-ide cart already proves the mixed lane scales to a real shell (80 files, 49KB app shell, 36KB visual classifiers, 52KB script logic). Cycle 3 takes that shell as the starting point and grows it into the cockpit — adding canvas-tile composition, worker tiles, classifier wiring, M3A memory, and the rest of the §A additions. Where intent-syntax primitives fit naturally (data blocks, classifiers, `<during>` reactivity), use them — but mixed-lane TSX is the working baseline, not a fallback. ~~Original framing: "the reactjit framework's conformance surface for intent syntax — written entirely in intent syntax per INTENT_DICTIONARY.md, no mixed lane."~~ See the Lane Pivot at the top and §5 for why that framing was dropped.

### The endgame flow

The canonical interaction once cycle 3 has shipped:

1. **You say "let's explore this feature."** Cockpit is in `brainstorm` mode. Worker tiles hidden. Conversation panel centered. Past bundles that touch the same area auto-surface as chips.
2. **We talk.** I'm a collaborator, not an enforcer. Push back, refine, disagree, converge.
3. **You crystallize.** Hotkey or phrase flips the cockpit. A modal shows the extracted spec: goal, constraints, file_map, non_goals, acceptance criteria, task decomposition — the fields from `plan-schema.md`. You edit inline. You confirm.
4. **Mode flips to `enforce`.** Worker tiles materialize on the canvas, one per decomposed task, each with its slice of the spec pre-loaded. L0 classifiers watch every worker.
5. **Work happens.** Drift caught. Rationalization blocked. Your job is triage via a next-action queue. Mine is T3 escalations with auto-loaded relevant bundles. Everything else runs on its own.
6. **Completion.** Each worker's output visually verified, airlock-committed, bundled, indexed. The full feature becomes one retrievable `feature_bundle` any future brainstorm can pull from.
7. **You go to bed.** Everyone stays happy.

### Non-goals for cycle 3

- Not a web UI. Native tsz cart only.
- Not replacing Claude Code CLI. Supervises Claude Code (and Codex and Kimi) from the outside.
- Not automating task assignment without user confirmation. Supervisor suggests; user approves spawn.
- Not a general dev utility dashboard. The cockpit's scope is *supervising workers* — project search, dev server management, source browser are out of scope. Git is **in scope**, but not as a developer tool: it's a `progress`-style read-only audit tile that shows velocity, per-worker commit state, fresh files, and restore-point timeline. See the cockpit components table below.
- Not a rewrite of the existing `claude-sweatshop/` operational methodology. Additive.
- Not forking codex or claude code. If codex has an SDK we use it; otherwise we classify its terminal output. Either way no upstream fork.
- Not solving every known pathology at the start. Rationalization, drift, tool-risk, visual-verify gate, and restore points are the initial classifier set. Others get added as laws + classifiers as the cycle progresses.

### The cockpit components

What actually lives on the cockpit canvas. Not an IDE, not a dashboard — a mixture of worker-observation tiles and supervision-state tiles. All visible at once on the infinite canvas (pan/zoom); none of them are behind mutually-exclusive top-level tabs.

| Tile | What it shows | Why it's here |
|---|---|---|
| Worker tiles (N of them) | Per-worker terminal buffer + tool-call stream + live semantic state badge (idle / thinking / tool-use / stuck / rationalizing) + L2 affect category (confident / uncertain / frustrated / stuck / rationalizing) | Primary worker observation surface. One tile per spawned worker. Directly translated from `~/creative/ai`'s `CodeAgentCard` pattern with L2 affect added on top. |
| **Worker strip** (chrome) | Persistent bottom/side strip showing all spawned workers as name + status dot + heartbeat pulse, always visible regardless of canvas focus. Click to pan to that worker's tile. | Peripheral awareness that survives zoom. Modeled on engaige's `TaskbarNPCStrip`. The sweatshop's answer to "how do I not lose track of worker 5 while I'm focused on worker 2." |
| Queue tile | Prioritized next-action list. Each entry is a T2/T3 event that needs your attention. | Triage flow. The user works top-down through this; it's the cockpit's game loop. |
| Spec anchor tile | The crystallized spec, pinned. Every constraint / file-boundary / non-goal / done-criterion visible. | Ground truth. What drift checks compare against. |
| **Kernel tile** | Context budget as a **tetris-block visualization** (à la `~/creative/ai`'s `TetrisPayloadMini`), colored by bundle source (spec=blue, per-worker=per-color, rationalization wounds=red, pinned=green). Resonance score per bundle (0-3). Recent retrievals. Manual inject hotkeys. | Context visibility made visual and game-shaped. Fills up visibly. Evictions drop blocks. The supervisor's reasoning material is a playfield, not an invisible buffer. |
| **Memory tile** | M3A 5-layer memory state, each layer as its own mini-visualization: L1 River flow (sliding buffer), L2 Feeling intensity heatmap (affect), L3 Echo resonance grid (vector+lexical+graph match density), L4 Wound markers (per-worker rationalization pattern-history), L5 Cooccurrence density. Each tile drills down on click. | The memory isn't labels — it's a living, decaying, boosting state that the supervisor reasons over. Directly ported from `~/creative/ai`'s M3A architecture. |
| **Git audit tile** | `progress`-style: commits per day (all projects), recent commits per worker, fresh files, per-area adds, uncommitted state per worker, commit-lag flags, **restore-point timeline pulled from the live `edit-trail` git branch** that `auto-commit.sh` already maintains. | *"Is work safe, flowing, and committed?"* Not a git client — a velocity-and-safety audit. The restore points don't need to be built; they already exist as commits on the `edit-trail` branch. |
| Autotest tile | Latest `.autotest` output per worker. Whether claude's asking you to run a broken file. Which tests actually generated signal. | What you look at *instead of* the code. Reads from the existing `tsz/scripts/autotest` and `autotest-grid` tooling. |
| Screenshot wall tile | Thumbnails of each worker's most recent build output (from `tests/screenshots/`). Click to enlarge. | Visual verification surface — the pass/fail signal for rendering work. |
| Brainstorm panel | Conversation surface. Active only in brainstorm mode; minimizes to a reference chip in enforce mode. Sidebar surfaces M3A-backed bundle chips from past related incidents (resonance-ranked). | Mode-split UX (see §10). |
| Law ticker | Live flag feed when a pathology fires (rationalization, for-now tell, fake-green, etc.) + which law was cited. Feeds from the existing hook stack's block decisions + the new classifier PostToolUse hooks. | The enforcement signal, visible at a glance. |

**No editor. No source-file browser. No file tree. No inline diff viewer.** The user doesn't write code in the cockpit — they steer workers. Everything on the canvas is "watching work from the outside" — the bull-riding view.

**At the cockpit top level, it's tiles on an infinite canvas.** *Inside* individual tiles, tabs are fine — a single worker tile can have Terminal / Tool Calls / Recent Edits / Autotest sub-tabs without breaking peripheral awareness, because you're inspecting one worker. Tabs at the cockpit level are wrong; tabs inside a tile are fine. That's the distinction between the v1 supervisor-dashboard (cockpit-level tabs, wrong) and the `tools` cart (in-tile tabs inspecting one running app, right).

---

## 3. What already exists

The biggest discovery of the brainstorm: almost every piece the sweatshop needs **already exists**. Cycle 3 is not "build the substrate" work — it's composition work on what was built in cycles 1 and 2. The table below is a map of the files you reach for when composing, not a taxonomy of layers.

### tsz/framework (Zig files the sweatshop composes with)

| Need | What exists |
|---|---|
| Spawning worker CLIs as child processes | `agent_core.zig`, `agent_session.zig`, `agent_spawner.zig` |
| PTY I/O | `pty.zig`, `pty_client.zig`, `pty_remote.zig` (client/remote split — naturally supports N sessions and crash-safe UI) |
| Terminal emulation (vterm) | `vterm.zig` |
| Semantic row classification framework | `classifier.zig` |
| Semantic tree / graph building | `semantic.zig` |
| Session recording | `recorder.zig` |
| Tool execution tracking (observation point) | `tool_framework.zig`, `tools_builtin.zig` |
| SQLite bindings | `sqlite.zig`, `query.zig` |
| Rule engine (when-X-then-Y automation) | `ifttt.zig` + `ifttt.mod.tsz` + `ifttt_lua.mod.tsz` |
| Local LLM inference for classifiers + embeddings | `llama_exports.zig` (llama.cpp directly, no Ollama HTTP needed) |
| JS runtime for `<script>` hatch | `qjs_runtime.zig` + friends |
| Lua runtime for `<lscript>` hatch | `luajit_runtime.zig` + `luajit_worker.zig` |
| Canvas primitive (for tiled cockpit) | `canvas.zig` |
| Routing | `router.zig` |
| Telemetry + system info | `telemetry.zig` |
| Crashlog, fswatch, fs, crypto, localstore, net/ | present |

**Nothing in this table needs to be written from scratch. Everything is a composition.**

### love2d/lua (reference stack, frozen)

**Why lua is much more mature than zig in this repo, and why it matters for cycle 3.** Love2d got ~20× more framework time than tsz. In love2d, LuaJIT handled dynamic content natively — the user never once needed to know what `.map()` even was, because luajit just did it. In tsz, zig couldn't handle the same dynamic shapes the same way, and the entire conformance suite exists in significant part because zig struggled with `.map()`-style patterns. Most of cycle 2 was spent teaching zig to do circus acts for dynamic content that luajit handles for free. The lua-tree emit path (`LUA_LOGIC`) — where `.tsz` compiles to a luajit-side tree instead of pure zig — was the correct abstraction the whole time, but it didn't land until roughly day 27 of cycle 2, after ~400+ separate nudges from the user to "just use luajit for this." The tests that forced the switch were `d152_cascade_configurator.tsz` and `d151_fractal_data_grid.tsz`. **Implication for cycle 3:** the default routing for dynamic, `.map()`-heavy, data-transformation-shaped content is `<lscript>` (lua-tree). Zig is reserved for actually hot paths — hot loops, zero-alloc, GPU-facing work, pixel loops, physics. The sweatshop is not a particle simulator. Most of its code routes through luajit. Don't make the cycle-2 mistake of asking zig to do what luajit does for free.

This is where the first-generation supervisor lives. Don't edit it — read it as reference when porting classifier rules or semantic state machines.

Key files: `claude_session.lua` (1802L — the damage-driven PTY loop), `claude_canvas.lua` (1987L — the tile rendering), `claude_graph.lua` (475L — semantic tree builder), `claude_renderer.lua` (675L — block renderer), `classifiers/claude_code.lua` (250L — the 25+ token vocabulary), `classifiers/basic.lua` (the minimal baseline), `pty.lua` + `vterm.lua` + `vterm_shim.c`, `semantic_graph.lua`, `session_recorder.lua`, `recorder.lua`, `sqlite.lua`, `http.lua`, `search.lua`, `json.lua`, `crypto.lua`, `inspector.lua`.

Field-tested with real Claude Code sessions. Session recordings live as `.rec.lua` files and are the ground truth for regression testing when we port classifier rules to the tsz side — new readers pass the recorded-session diff or they're wrong.

### Existing tsz carts that are direct ancestors of cycle 3

- **`tsz/carts/conformance/mixed/cursor-ide/`** — 80 files, 49KB app shell, 36KB visual classifiers, 52KB script logic. A Cursor IDE clone that compiles today. Lives in the mixed lane. **THIS IS THE FOUNDATION OF CYCLE 3.** Per the Lane Pivot at the top of this doc, the cockpit is built *on top of* this cart in mixed-lane TSX — the shell frame, topbar, statusbar, tab bar, responsive layout, and command palette patterns all carry forward directly. We extend its code shape, we don't re-express it in intent syntax. ~~Earlier draft said: "structural reference only — do not port its code shape directly, re-express in dictionary primitives."~~ That came out of the chad-only commitment in §5 and is no longer the direction. Caveat that still applies: the sweatshop is not an AI IDE. The user never reads source files in the cockpit. What the user actually looks at: claude's truncated tool-call snippets as they stream, `.autotest` output, `tests/screenshots/`, and occasional copy-paste of code out to a worker. The editor-shaped components from cursor-ide (`Editor.c.tsz`, `EditorTabs`, `EditorGutter`, `EditorMinimap`, `EditorInlineActions`, `EditorReviewRail`, `EditorBreadcrumbs`, `EditorViewport`, `EditorHeader`, `EditorSurface`) get **stripped or repurposed** — the shell stays, the editor surface gets replaced with cockpit tiles.
- **`tsz/carts/conformance/mixed/semantic-terminal/`** — terminal + classifier composition. The worker-tile direct ancestor.
- **`tsz/carts/claude-canvas/`** — dedicated claude integration cart. Second-generation lineage from `love2d/examples/claude-code/` → here.
- ~~`tsz/carts/cursor-ide-hell/`~~ — **dead end. Do not use as reference.** The only cursor-ide worth considering is `carts/conformance/mixed/cursor-ide/`.
- **`tsz/carts/tools/`** — live dev tools app. ~40+ components shattered into per-page scripts: Console, Elements, Network, Overlay, Perf, Source, Logs, Wireframe, ConstraintGraph, Dashboard, TestRunner, BsodViewer, Inspector (with `_full`/`_old`/embed/mod/gen variants). **The direct counter-example to the v1 supervisor-dashboard god file.** Every page owns its own `.script.tsz`, every component is a small `.c.tsz`, shared classifiers live in `tools_cls.tsz` / `style_cls.tsz`, and the whole thing compiles to one `generated_app.zig`. Patterns worth mining: `Dashboard_c.tsz` (metric overview shape), `MetricCard` + `Badge` + `DetailPane` + `DetailSection` + `PropertyRow` as reusable presentation blocks, the 4-way tree view (`TreeJsxView` / `TreeMapView` / `TreeZigView` / `TreeHybridView` — same data, four angles), custom `ChromeBar` window chrome with `window_drag: true` + `ResizeEdge` with `window_resize: true`.
- **`tsz/carts/tools/progress/`** — four files only (`Progress.tsz`, `progress.script.tsz`, `progress_cls.tsz`, `progress_data.sh`). A focused viewer for repo progress. `progress_data.sh` shells out to `git log`, `git log --diff-filter=A --name-only`, and `find -exec stat` with three sub-commands (`commits`, `adds`, `disk`), emitting structured TSV back to the cart. **This is the correct use of shell scripts in a cart: read-only, one pass, no state mutation, no recursion — reading from external systems (git/filesystem) and structuring the output.** The v1 supervisor-dashboard fork bomb was not "shell scripts are bad"; it was "shell scripts doing stateful mutually-recursive work that should have been typed reactive code." `progress_data.sh` is the template for how the cockpit's git-audit tile reads git. Aesthetic note: `progress_cls.tsz` uses BSOD blue (`#0000aa`) + white text + tight 1px borders + custom `ChromeBar` — a deliberate retro palette matching `BsodViewer_c.tsz`. Optional for the sweatshop but the `ChromeBar` / `ResizeEdge` primitives are reusable regardless of palette.
- **`tsz/carts/clippy/`** — assistant UI cart. Possibly the brainstorm-panel ancestor.
- **`tsz/carts/inspector/`** — inspector cart with live zig-cache (builds).
- **`tsz/carts/supervisor-dashboard/`** — the failed v1. Dogshit execution but the SQL schema is ~90% correct and was derived from `plan-schema.md`. See §6 for full diagnosis.
- **`tsz/carts/conformance/.verified/test_spawn/`** — process-spawning conformance test, already passing.
- **`tsz/carts/conformance/.verified/ifttt_lab/`** — ifttt rule engine conformance test, already passing.
- **`tsz/carts/conformance/chad/`** — the intent-syntax conformance directory. ~~Earlier draft said: "this is where the sweatshop's conformance tests live, the sweatshop only writes into chad/."~~ Per the Lane Pivot: **the sweatshop now lives and tests in `conformance/mixed/` (alongside cursor-ide), not `conformance/chad/`.** Cart-local `tests/` still applies. The `.verified/` corpus of 180+ passing tests is framework-wide and stays as-is.

### External projects cycle 3 pulls directly from

Not tsz carts — these are React/TS/Tauri projects in `~/creative/` that already implement patterns the sweatshop needs. Translated into tsz, not referenced at runtime.

- **`~/creative/ai/app/`** — AI interface app (Electron + Bun + React + TypeScript). **The single most directly relevant codebase outside tsz itself.** Contains a production-grade implementation of most of what the sweatshop needs. Key subsystems:
  - **`src/mainview/components/code-grid/`** — `CodeGridView`, `CodeAgentCard`, `CodeAgentHeader`, `CodeAgentTranscript`, `CodeGridInput`, `MultiAgentGridContext`, `useMultiCodeSession`, `grid-utils`, `useAgentSession`. A working multi-agent claude-code grid with active-agent routing, per-card streaming transcripts, restore points, yes/no + menu selection routing, responsive columns, add-agent card, empty state, animation delays. **The direct ancestor of the sweatshop's worker-tile subsystem.** Type shapes (`CodeSession`, `TranscriptEntry`, `InputPrompt`, `RestorePoint`, `SessionData`) to adopt verbatim in tsz.
  - **`src/bun/lib/memory/`** — the **M3A (Multi-Modal Memory Architecture)** 5-layer memory system. `types.ts` (642L) defines: **L1 River** (sliding window buffer with token counts + eviction), **L2 Feeling** (affective state index with `AffectCategory` + intensity + decay + mute), **L3 Echo** (redundant encoding: 3.1 Vector embeddings, 3.2 Lexical FTS5, 3.3 Entity-relation graph, with a **resonance score** 0-3 for how many encodings matched), **L4 Wound** (salience markers for high-impact memories), **L5 Cooccurrence** (node + edge graph tracking what appears with what). Plus `affect-classifier.ts` (269L), `consolidator.ts` (725L), `entity-extractor.ts` (365L), `memory-store.ts` (2066L), `similarity.ts` (184L), `write-pipeline.ts` (457L). **This IS the context kernel architecture for cycle 3** — see §9 where the whole kernel section is now built around these layers.
  - **`src/bun/lib/variables/`** — the **variables system**: 16 built-in system vars (`time`, `date`, `datetime`, `timestamp`, `year`, `month`, `day`, `hour`, `minute`, `weekday`, `timezone`, `user-name`, `hostname`, `platform`, `random-uuid`, `random-number`) in `system-variables.ts`, plus `resolvers.ts` (504L), `expander.ts` (365L), `interpolator.ts` (263L), `cache.ts` (266L), and a **JS sandbox** in `sandbox.ts` (374L) that runs user-defined JavaScript variables safely. The settings UI has a `rest-api-wizard/steps/` tree so users can wire REST API calls as variables through a wizard. **Cycle 3's prompt-assembly, rebuke templates, spec interpolation, and status-line customization all route through this existing system.**
  - **`src/mainview/components/response-group/TetrisPayloadMini.tsx`** (118L) — the **tetris-block visualization** for context budget. Canvas-based, 4px blocks, `payloadColors` map (system=blue, context=purple, user=green, assistant=orange, attachment=pink, image=rose, tool=cyan, model=violet, settings=indigo), fill from bottom up, scanline effect. Takes `payload: PayloadItem[]` with `{type, tokens}` + `maxTokens` default 128000. **The reference for the Kernel tile and Memory tile visualizations in §2.** Plus `components/input-hub/widgets/telemetry/MemoryBlocks.tsx` (262L) and `components/input-hub/panels/memory/MemoryBlockGrid.tsx` (339L) for the memory variants.
  - **`src/bun/lib/claude-code-reader.ts`** (435L) — reads `~/.claude/projects/<encoded-path>/<session>.jsonl` files. Encoding: replace `/` with `-`. Schema: `SessionInfo`, `TranscriptEntry` (with `uuid`, `parentUuid`, `type`, `message.role`, `message.content[]`, `sessionId`, `timestamp`, `cwd`, `gitBranch`, `version`, `toolUseResult`), `PlanInfo`, `HistoryEntry`. **The path conventions and types for reading existing Claude Code session files** — directly reusable.
  - **`src/bun/lib/claude-session-archiver.ts`** — archives claude sessions. Reference for bundle auto-promotion from recorder.
  - **`src/bun/lib/snapshot-manager.ts`** — first-class `RestorePoint` type already defined in their `types/snapshot.ts`. The sweatshop inherits this shape.
  - **`src/mainview/components/workbench/`** (atoms, editor, library, output, WorkbenchPage) — workbench pattern with panes.
  - **`src/mainview/components/research/`** — full research subsystem with `cinematic`, `embed`, **`galaxy`** (source visualization), `guidance`, `modals`, `page`, `report`, `sources`. The architecture for multi-source agent work rendered as a visual structure — reference for how brainstorm-mode bundle chips surface past related work.
  - **`src/shared/ws-protocol.ts`** — `type: 'request' | 'response' | 'event'` + `channel` + id-correlated request/response + server-push events + `WSErrorCodes`. **The right shape for the sweatshop's backend ↔ cockpit comms if we cross process boundaries** (e.g. `pty_remote` → client cockpit).
  - **Hooks worth adopting wholesale** (translated to tsz): `useParallelAI`, `useCodeSession`, `useMemoryBlocks`, `useMemory`, `useVariables`, `useInteractiveMode`, `usePromptAssembly`, `useResearch`, `useVisualizerEvents`.
- **`~/creative/engaige/`** — game-with-AI-NPCs built as an OS simulation on Tauri. The load-bearing patterns:
  - **Persistent NPC strip in the taskbar chrome**: `TaskbarNPCStrip`, `TaskbarNPCPortrait`, `TaskbarNPCPopup` in `src/components/desktop/taskbar/`. AI entities have a permanent visual spot in the OS chrome, always visible regardless of which window is focused. **The direct model for the sweatshop's Worker strip (new tile in §2).**
  - **`awarenessStore` in `src/stores/`** — cross-entity awareness as first-class shared state. Every NPC has a slice of "what's happening around me." **The direct model for the sweatshop's cross-worker collision prediction + peripheral awareness layer.** Sits alongside the L2 classifier stack: L2 classifiers score one worker's stream at a time, the awareness store tracks *relationships* between workers.
  - Full window manager in `Desktop.tsx` (1067L) / `Window.tsx` (587L) / `windowSnap.ts` / `iconPhysics.ts` / `iconReflow.ts`. Tile snap behavior, icon physics, window management — reusable for cockpit tile polish (snap to grid, spring animation on new worker spawn, shake on flag fire).
  - Boot sequence (`BootScreen.tsx`, `LoginScreen.tsx`, `AccountCreationModal.tsx`) — reference for how the cockpit boots: load local models, open db, reconnect to running workers, restore bundles, show progress.
  - Multi-app shattered architecture — each Cob* app is self-contained with its own files. Same pattern as tsz's `tools` cart.

### Existing hooks and scripts we read from / extend

Most of the cycle 3 supervisor substrate is already running in production via hook scripts wired into every Claude Code session under the reactjit repo. The cockpit does not *build* this substrate — it displays what's already being collected and extends the hook stack with a few new local-model-backed rules.

Wired into `reactjit/.claude/settings.local.json`:

- **`reactjit/.claude/hooks/supervisor-log.sh`** (102L) — PreToolUse (Edit/Write/Bash) + PostToolUse + SessionStart + Stop. Writes events to **`/run/user/$UID/claude-sessions/supervisor.db`** — a live SQLite database being populated on every tool call across every worker session in reactjit, right now. Schema: `projects`, `workers`, `events` tables with `session_id`, `tool_use` events, `payload_json` with `{tool, file}`, worker status (`active`/`idle`), `last_seen_at` timestamps. **This is the same schema as v1 supervisor-dashboard's `db/schema.sql`** — the v1 cart's backend is literally the running production database. Cycle 3's database module is a **reader** over this existing DB, not a creator.
- **`reactjit/.claude/hooks/auto-commit.sh`** (104L) — PostToolUse (Edit/Write). Every edit fires this hook, which commits the edited file to a **separate git worktree** at `/run/user/$UID/claude-sessions/reactjit/edit-trail-wt` on an **`edit-trail`** branch. Uses a local LLM at `localhost:1234` (LM Studio) with `qwen2.5-coder-1.5b-instruct` to generate commit messages from the diff. Per-session author identity (`Claude ($SHORT)`). Never touches main. Pushes to a gitea remote called `edittrail`. Background fire-and-forget with flock serialization. **This is the restore-point store cycle 3 needs, already running.** Every edit by any worker since the hook was wired is a commit in the `edit-trail` branch with an LLM-authored message. The git-audit tile reads from this branch. Rewind-to-point = `git checkout edit-trail <commit> -- <file>`. **Don't build a content-addressable blob store — read from the existing git history.**
- **`reactjit/.claude/hooks/guard-build.sh`** (44L) — PreToolUse (Bash) with a **5ms timeout**. Pattern-matches `.tool_input.command` for forbidden commands (raw `zig build-obj/build-exe/build-lib`, `zig build tsz/app/cart`, `cp generated_*`, building non-entry `.tsz` files). For matches, returns `{"decision":"block","reason":"..."}` on stdout and Claude Code honors the block at the hook boundary. **This is the T4 enforcement mechanism, already working.** Cycle 3 extends this (or adds a parallel PreToolUse hook) with: destructive git commands (`git reset --hard`, `git stash` without prior commit, `--no-verify`), edits to frozen paths, destructive db ops, and — crucially — rationalization-canonical-pivot detection backed by the local llama classifier.
- **`reactjit/.claude/hooks/edit-log.sh`** (74L) — PostToolUse (Edit/Write). The edit log feed at `/run/user/$UID/claude-sessions/reactjit/.watch/edits.log` referenced in the existing supervisor CLAUDE.md.
- **`reactjit/.claude/hooks/session-ping.sh`** (347L) — the big one. Wired on PreToolUse / PostToolUse / SessionStart / SessionEnd / Stop / PermissionRequest. Cross-session awareness, collision detection, the full who's-editing-what-right-now signal. **This is the foundation of the awareness layer** that the Worker strip tile displays and the rule engine reads for collision warnings.
- **`reactjit/tsz/scripts/check-file-length.sh`** (40L) — PostToolUse (Edit/Write). Returns JSON: `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"FILE LENGTH WARNING:\n..."}}`. **This is the T1 auto-nudge injection mechanism, already proven** — hooks can inject fresh user-messages back into running Claude sessions via the `additionalContext` field. Workers see the injection as if the user had typed it. Cycle 3 adds new PostToolUse hooks that run local-model classifiers (rationalization tells, drift signals, claim verification) and return `additionalContext` with canned or LLM-generated nudges. T1 auto-handle path, already feasible.
- **`reactjit/tsz/scripts/preflight-hook.sh`** (208L) — PostToolUse (Edit/Write) with 30s timeout and `statusMessage: "Running .tsz preflight..."`. tsz-stack-specific preflight validation on every edit.

Not wired but available as supervisor utilities (manual, called by the kitty-pane supervisor or future cockpit actions):

- **`reactjit/.claude/hooks/ralph.sh`** (164L) — **the supervisor→worker message relay via `kitten @ send-text`**. The mechanism the current kitty-based supervisor uses to inject corrections into worker panes. Cycle 3's cockpit action bar (send correction, approve, reject, rebuke) calls the same primitive under the hood — the hotkey version of `ralph`.
- **`reactjit/.claude/hooks/send-message.sh`** (87L) — alternative manual message sender.
- **`reactjit/.claude/hooks/pane-watch.sh`** (75L) — manual pane buffer reader.
- **`reactjit/.claude/hooks/report-to-supervisor.sh`** (50L) — older report mechanism, superseded by `supervisor-log.sh` but available.

The broader `reactjit/tsz/scripts/` cache — not hooks but existing workflow tools cycle 3 reads from, extends, or respects:

- **`autotest`** + **`autotest-grid`** — the autotest surface. The cockpit's Autotest tile reads from these.
- **`witness`** + **`witness-record-all`** — witness testing, paired with `witness.zig` in framework. Contract-style test recording.
- **`bless-compiler`** + **`bless-engine`** — "bless" for promoting tested changes. `./scripts/bless-engine` is explicitly in the `deny` list of `settings.local.json` — gated behind manual approval. **This is the promotion gate the channel architecture depends on.**
- **`ledger`** + **`ledger-watch`** — ledger system (purpose TBD, worth reading later).
- **`regression-hook`** + **`regression.sh`** — regression detection.
- **`flight-check`** + **`preflight.sh`** + **`preflight_conformance.sh`** — preflight validation at multiple levels.
- **`contract`** — contract testing.
- **`storybook-layout.py`** — python layout calculator for storybook tile positions (referenced in memory).
- **`validate-canvas-layout.py`** — canvas layout validator (called out in `TRUST_NOTHING.md` as being a rubber stamp when `gh=0`).
- **`conformance-build` / `conformance-report` / `conformance_test.sh` / `conformance_verify.sh`** — the conformance workflow.
- **`ICantCallPreExistingOnThisOne`** — literally a script named after the anti-pattern from `TRUST_NOTHING.md` #9. Someone commemorated the failure with a script name.

**The shocking conclusion:** roughly half of cycle 3's supervisor infrastructure is already running in production. The cockpit is a tsz-native reader + extension layer over an already-live event pipeline.

### love2d examples (cycle 1 reference apps)

Not to port wholesale — read for shape. Notable ones: `claude-code`, `terminal`, `inspector`, `llm-studio`, `ai-box`, `storybook`, `browser`, `hot-code`, `hotstate-demo`.

### Language surface

**UPDATED per Lane Pivot:** the sweatshop is built in the **mixed lane** on top of `tsz/carts/conformance/mixed/cursor-ide/`. **Mixed-lane TSX, full stop — do not mix in chad-syntax primitives (`<var>`, `<functions>`, `<during>`, `<for>`, `<if>`, `<switch>`, `+` composition, data blocks, `<semantics>`).** Holding two mental models at once is exactly what broke the chad-only attempt; explicitly inviting chad primitives back into mixed-lane code recreates the same trap. The only chad-flavored constructs that survive the pivot are the **hatches** (`<lscript>` / `<zscript>` / `<script>`) — and only because those aren't chad-specific syntax, they're compile-target routers (luajit / zig / qjs) that work the same way in any lane. ~~Earlier draft: "the Intent Dictionary is the only syntax the sweatshop writes; the sweatshop does not touch the mixed lane."~~ See §5 for the historical reasoning.

---

## 4. It's all composition

Every level from libc up to the cockpit is one of:

- Exposed directly (the table in §3),
- Composed from existing files via a `.mod.tsz` wrapper, or
- Written in the cart itself using intent syntax.

The `<ffi>` block pulls raw C/Zig symbols up into intent. The `<lscript>` and `<zscript>` backend hatches select compile targets. Above that it's composition with `+`, `<during>`, `<for>`, `<if>`, `<switch>`, reactive state flow.

### canvas vs claude_canvas (not the same thing)

These got conflated in earlier drafts. They're different:

- **`canvas` / `canvas.zig`** in tsz/framework — the infinite canvas rendering primitive. What the cockpit's tile layout uses.
- **`claude_canvas.lua`** in love2d — a *PTY-based scraper for the Claude Code CLI*. Uses `pty.lua` + `vterm.lua` to read claude's terminal output and structure the events. The love2d `claude_*.lua` files (`claude_canvas`, `claude_graph`, `claude_renderer`, `claude_session`) are all the CLI-scraping and semantic-rendering layer — nothing to do with an infinite canvas primitive.

In tsz, the same split holds: `pty.zig` + `vterm.zig` + `classifier.zig` + `semantic.zig` are the framework-side scraping and classification pieces (same role as love2d's `pty.lua` + `vterm.lua` + `classifiers/`), and the sweatshop's `claude_*.tsz` / `codex_*.tsz` / `kimi_*.tsz` modules are the per-CLI *application-level* code that consumes them. The framework provides the scraping substrate; the sweatshop is the application that reads it, classifies per-CLI, and displays results on the cockpit canvas.

**The worker tile is composed** — not a framework-provided primitive — from `<Canvas>` + vterm wrapper + per-CLI reader + visual classifiers in `.cls.tsz` + `<during>` reactivity.

### There are no walls in this repo

Category words like *primitive vs infra*, *framework vs library*, *compiler layer vs engine layer*, *substrate vs application*, *user-space vs kernel*, *runtime vs compile-time* all come from multi-team industrial software where different teams own different sides of the wall and crossing the boundary means handing work off to someone else. In this repo **the user owns all of it.** Every wall I reach for is imported from a world that isn't this one — and worse, those walls actively obstruct work. "That's a framework issue, not a cart issue" becomes a stop sign at a directory boundary, when the actual task is "make the binary do the thing."

Concrete corrective rules:

- **The four pieces of this repo, honestly labeled.** cart code → framework + compiler → system libraries (SDL3, LuaJIT, QuickJS, wgpu, libmpv, libvterm, sqlite, blend2d, vello, etc.). tsz is *one ring higher* than love2d — tsz took Love2D's position as the engine layer and went no deeper. The user owns pieces 1 and 2 fully; piece 3 is upstream but still their problem when a bug crosses into it.
- **The task is whatever it takes to make the binary do the thing.** If work started in the compiler and the bug is in the framework, that's still the task. If it crosses into a cart, still the task. Crossing a directory boundary is not a stop sign.
- **"We" = user + past Claude sessions** that didn't know about each other. When two stacks (love2d and tsz) diverge, it's accumulation from different sessions, not principled architecture. Don't defend divergences as if they were decisions.
- **Before invoking a category word,** check whether it describes the thing or carves it into buckets the user doesn't draw. If it's carving, drop the word and just talk about what's there.

### Dynamic content routes to `<lscript>` by default

Restating the correction from §3: `.map()`-heavy, data-transformation, runtime-tree work all go to luajit via `<lscript>`. `<zscript>` is for hot loops, zero-alloc paths, GPU-facing work, physics, pixel operations. This is not preference — it's correction of cycle 2's cardinal mistake, which was asking zig to do what luajit does for free.

### Hatch discipline

- Escaping into `<lscript>` / `<zscript>` is allowed only for target-selection reasons. "The libvterm Lua infra already exists, so I'll use `<lscript>` to wrap it" is valid. "Writing this in intent syntax is annoying, so I'll drop into Lua" is not. Every hatch invocation must be defensible as target selection.
- When a gap in what exists blocks composition, that gap is **framework work**. The sweatshop tells the framework what needs to exist. A `TODO: expresses X when Y exists` marker becomes a tracked framework task, not a quiet shell-script bypass. The supervisor-dashboard v1 cart got this wrong — see §6.

### The parallel framework rewrite

The framework itself is being rewritten in parallel with cycle 3: hand-written Zig modules are being regenerated as `.mod.tsz` sources + compiled outputs. Files like `engine.mod.tsz`, `layout.mod.tsz`, `luajit_runtime.mod.tsz`, `ifttt.mod.tsz`, `ifttt_lua.mod.tsz` already exist as the first wave of this migration.

The sweatshop and the framework rewrite are **co-travelers**. The supervisor supervises workers who are rewriting the framework the supervisor runs on. Gaps one side hits are opportunities the other side closes. Channel discipline (bleeding / nightly / stable) keeps the sweatshop riding a frozen framework snapshot while rewrite workers push the bleeding edge — promotions gate on conformance green.

### The sweatshop as reactjit's conformance surface for intent syntax

The sweatshop is the conformance claim: *does intent syntax scale to a real application built from composed dictionary primitives?* Cycle 3 makes that claim load-bearing by writing the cart entirely in intent syntax and stressing every corner of the dictionary along the way. When the dictionary can't express something the sweatshop needs, the dictionary grows. See §5 for the full commitment.

---

## 5. Intent syntax only — the one-lane commitment ~~(SUPERSEDED — see Lane Pivot at top)~~

> **This entire section is historical context.** It captures the original chad-only commitment that produced the friction we hit. The current direction is **mixed lane on top of cursor-ide** (see Lane Pivot at top, §0 Syntax discipline, §3 cursor-ide entry). Intent-syntax primitives are still useful where they fit; they are no longer the exclusive lane. Read what follows as the reasoning that *led* to the pivot, not as the current rule. The rest of the document was originally written under this commitment, so any "intent syntax only" / "no mixed lane" / "rewrite in dictionary primitives" phrasing downstream of here is part of the same superseded framing.

**The sweatshop writes in intent syntax and nothing else.** `INTENT_DICTIONARY.md` is the single source of truth. Every file is expressed in dictionary primitives. No soup, no mixed, no cross-lane parity.

### Why one lane and not three

The three-lane model was tried and dropped. Keeping React-shaped (soup) and TypeScript-flavored (mixed) code around as "peer surfaces" unconsciously steered design decisions back toward React idioms: `useState`, inline arrow functions, `.map()`-over-array, style objects, ternary rendering, sigil comparisons. Every time a module was written in soup first and then translated to mixed and chad, the chad version came out as a mechanical transliteration of React patterns instead of an expression using the dictionary's own composition model (`<during>`, `<for>`, `<functions>`, `+` composition, data blocks, `<semantics>` keywords, hatches for target selection).

The dictionary is a different programming model, not a different syntax skin. Trying to perfect all three in parallel was perfecting none of them — the mental overhead of holding three shapes in mind kept pulling everything toward the most familiar one. The commitment to one lane is about getting out of that trap and actually thinking in intent-dictionary terms.

### What this means in practice

- **Every `.tsz` file in the sweatshop** is intent syntax per the dictionary. No React hooks, no inline arrow functions, no `onClick={() => ...}`, no `.map()`-with-arrow, no ternaries, no sigil comparisons (`==`, `!==`, `>`, `<`, `>=`, `<=` are gone — use `exact`, `not exact`, `above`, `below`, `exact or above`, `exact or below`), no `style={{ }}` objects on primitives, no JS object literals in `<var>` blocks.
- **Custom logic** lives in `<functions>` blocks with composition via `+`. Loops are `<for>`. Conditions are `<if>` / `<else if>` / `<else>`. State mutation is `set_varName is newValue`. Reactive lifecycle is `<during varName>`. Recursive tree walks are `<during funcName(arg)>`.
- **Control flow** is blocks, always self-closing, always one statement per line. No semicolons, no braces for logic, no arrow functions anywhere.
- **Data literals** go in named data blocks: `items is array` + `<items>` block, `config is object` + `<config>` block, `cards is objects` + `<cards>` block with comma-separated fields.
- **File extensions** match the dictionary: `.tsz` (app / lib / page / widget entry), `.c.tsz` (component), `.cls.tsz` (classifier), `.tcls.tsz` (theme tokens + themes), `.effects.tsz` (effects), `.glyphs.tsz` (glyphs), `.mod.tsz` (module), `.script.tsz` (logic imports), and hatch variants when target selection justifies it (`.lscript.tsz`, `.zscript.tsz`).
- **Hatches** (`<lscript>`, `<zscript>`, `<script>`) are the **only** places non-intent code lives, and only for target-selection reasons — "libvterm already has a Lua binding so I'm wrapping it via `<lscript>`" is valid; "writing this in intent feels annoying" is not.
- **Custom vocabulary** goes in `<semantics>` blocks at the lib level. Domain-specific verbs (`worker rationalizes`, `bundle pins kind`, `reader tokens rows`) become first-class keywords when the sweatshop needs them, instead of inventing workaround patterns in code.

### The conformance claim, reframed

Cycle 3's conformance contribution to reactjit is no longer "three lanes produce the same compiled output for the same spec." It's: **does intent syntax, used strictly and only, scale to a production application of substantial size and complexity?**

The sweatshop is the test. Every file is a data point. If the dictionary can't express what the sweatshop needs, the dictionary grows. If the sweatshop ends up ugly or convoluted in intent syntax, the dictionary needs new primitives. Every expressive gap the sweatshop hits becomes a dictionary feature request — **not a drop to a lower lane**.

When a worker is writing a module and can't figure out how to express something in dictionary terms, the correct move is **stop and surface the gap**, not **sneak into mixed lane or inline some TypeScript**. The `TODO: expresses X when Y exists` marker from §4 applies: tracked dictionary work, not quiet workaround.

### Testing without parity triples

Without three-lane parity, testing simplifies. Each conformance-relevant unit has:

- **One source set** — however many files the unit needs (effects get `.effects.tsz` files, classifiers get `.cls.tsz` files, components get `.c.tsz` + optional `.script.tsz`, etc.).
- **One fixture** — `inputs.json` describing the input sequence, `expected.json` describing expected state + emitted events, optional `expected.png` for pixel regression on visual units.
- **One test run** — the harness compiles the unit, runs the fixture, captures behavior and rendering, diffs against `expected.*`.

The pixel + functionality framing from the old parity contract still applies, it just applies to one source per unit instead of three. Pixel regression catches visual drift; functionality regression catches behavior drift. Both run in standard `tests/` or `conformance/chad/` directories.

### The ladder — reframed as a dictionary stress test

What was the three-lane conformance ladder becomes an **intent-syntax coverage ladder**. Each rung stresses one new dimension of the dictionary and is a permanent test that gates changes to the dictionary or the compiler:

1. **StaticBadge** — fixed box + classifier + literal color. Tests: basic JSX with classifier lookup, `.cls.tsz` file, theme token resolution.
2. **WorkerBadge** — adds `<props>`, conditional classifier variants, small data-block lookup.
3. **CounterStub** — adds `<var>` with `set_` prefix, `<functions>` with reactive mutation, bare-word event handlers on a `Pressable` classifier.
4. **WorkerTile** — composes badge + counter, adds `<for>` iteration with nested classifiers and child component calls.
5. **TellsTable** — pure data-block module (`is objects` + `<tells>` block), no render. Tests data-block syntax and exposed-to-consumers access.
6. **RationalizationClassifier** — pure `<functions>` module using `<for>` + `<if>` + `.regex()` + composition with `+`. Tests pure logic over a data-block input.
7. **SupervisorReducer** — `<switch>` / `<case>` state machine + composed mutation. Tests state-machine patterns in pure dictionary form.
8. **WorkerPanel** — full integration: multi-tile composition with `<var>`, `<during>`, `<for>`, `<props>`, `<functions>`, callback props, classifier variants, nested components. The "if this passes, intent syntax scales" gate.

Each rung closes when its unit compiles cleanly, the fixture passes (pixel + functionality as appropriate), and the module reads naturally in dictionary terms — not as a mechanical translation of a React pattern. The ladder is written top to bottom as each underlying dependency is ready, but it does not need cross-lane coordination — just "is this rung shippable in intent syntax?"

---

## 6. The old cart diagnosis (supervisor-dashboard v1)

`tsz/carts/supervisor-dashboard/` exists and builds. The execution is dogshit but the thinking was right in places. Cycle 3 inherits the good parts and throws out the bad.

### What it got right

- **The SQL schema in `db/schema.sql` is ~90% correct.** Projects, workers, events, sessions, messages (with FTS5 triggers already wired via `messages_ai`/`_ad`/`_au`), plans with 15+ structured fields (goal, motivation, approach, constraints, non_goals, key_decisions, starting_point, known_problems, dependencies, risks, file_map, boundaries, parallel_tracks, critical_path, max_concurrent_workers, shared_files, done_criteria, rollback_plan, commit_trail, notes), phases with gate_description, milestones with `who_approves` (user/supervisor/automated), tasks with acceptance_criteria/tests/visual_verification/docs_required/max_workers/file_boundaries/conflict_zones/blocked_by, task_steps, task_edits, task_notes, worker_assignments, violation_rules, violation_log. Someone sat down and asked the right questions. The fields match `plan-schema.md` and `task-schema.md` at the parent directory level — that's the same data model.
- **FTS5 triggers work.** The `messages_fts` virtual table + INSERT/DELETE/UPDATE triggers are already correctly written.
- **Violation rules table exists as rule-engine storage** with pattern/action/enabled columns. `action` is a 3-level enum (`flag`/`pause`/`deny`) — that's the tier system in simpler form.
- **The `__sem_state()` host bridge pattern** proves semantic state can flow from native into a cart. Wrong consumption (polling), but the mechanism is there.
- **Plan decomposition fields** (`goal`, `constraints`, `non_goals`, `file_map`, `max_concurrent_workers`, `done_criteria`, etc.) are exactly the output shape needed for the brainstorm → spec crystallize step in §9.

### What it got wrong

1. **Fork bomb.** `db/plan.sh` and `db/tasks.sh` mutually recursed with no depth guard. 20,000+ processes, locked the desktop. Mitigated by `chmod -x`. Documented in `FORK_BOMB_BUG.md` in the cart. **Root cause is architectural, not a bug**: using shell scripts for logic with state transitions means invariants are invisible to the compiler. In intent syntax with typed composition and `<if>` guards, a mutual recursion without a base case would be obvious or caught.
2. **Entire persistence layer is bash scripts** in `db/*.sh` shelling out to `sqlite3`. Bypasses `sqlite.zig` + `query.zig` entirely. Consequences: no types, no reactivity, no composition, slow (subprocess per query), fragile. **This is the single biggest "dogshit" call** and it cascades into everything else. The fork bomb was a direct consequence.
3. **`supervisor_poll.script.tsz` uses `setInterval(..., 300)`** to poll `__sem_state()`. Framework has damage-driven classifier events that should flow reactively through `<during>` blocks. Two polling loops in total (300ms semantic + 3000ms `useFFI(sv_refresh, 3000)` for db). Two bandaids where reactive wiring would work.
4. **Single god file with 180+ `useState` declarations** in `supervisor.tsz`. State for every panel (tasks, workers, plans, terminals 0 AND 1 — hardcoded, memory, dev server, inspector, violations, search, sessions, git) all at the top level. No modularity, no encapsulation.
5. **Pages, not tiles.** 9 mutually-exclusive tabs: Task Board / Workers / Memory / Dev Server / Inspector / Violations / Search / Sessions / Git. Jira-shaped dashboard. **Breaks the supervisor model**: a supervisor needs peripheral awareness of all workers + threat counter + spec simultaneously. Tab-switching kills flow.
6. **Scope creep.** Only ~3 of 9 tabs are actually supervisor-core (Task Board / Workers / Violations). Git log, inspector, dev server, search, sessions, memory were all bolted on. Each added state to the god file + shell scripts to db/ + failure surface.
7. **Hardcoded hex colors inline everywhere.** `'#238636'`, `'#30363d'`, `'#8b949e'` scattered through JSX. `style.cls.tsz` exists but is bypassed. Theme system unused.
8. **Two terminals hardcoded.** `semMode0`, `semMode1`, `semDot0`, `semDot1`. No `workers.map()`. Supporting N workers means O(N) manual variable declarations.
9. **No per-CLI semantic classifiers at cart level.** `classifiers/supervisor_net.json` is a single JSON blob. `__sem_state()` returns opaque state — no way to add claude/codex/kimi readers at the application level.
10. **No brainstorm mode.** Enforcement-only. No conversation surface, no crystallize flow, no mode flip.
11. **Violation rules log matches but don't enforce.** The `action` column has `flag`/`pause`/`deny` but there's no visible wiring from "pattern matches" to "worker actually pauses." The rule engine stops at "log the match." **The cart is all observation, no enforcement.** This is the single biggest conceptual gap and the first thing cycle 3 closes.

### What to keep, what to discard

**Keep:**
- `db/schema.sql` (the SQL itself — tables, columns, FTS5 triggers, indexes)
- The semantic-state-from-native pattern (the `__sem_state()` approach, used reactively)
- Visual conventions for the per-worker status badge (`semMode` + `semDot` + `semBg` + `semTurns`), generalized to per-worker not per-slot
- The plans/phases/tasks/task_steps/task_edits/task_notes/worker_assignments data model

**Discard:**
- All of `db/*.sh`. Replaced by `database.mod.tsz` wrapping `sqlite.zig` + `query.zig`.
- `supervisor_poll.script.tsz`. Replaced by reactive `<during>` wiring over native classifier events.
- The tabbed layout in `supervisor.tsz`. Replaced by tile-first canvas layout.
- The god state bag. Per-component / per-module state with clean composition boundaries.
- Scope-crept *panels as implemented in v1* — the Jira-tabs layout of git / inspector / dev server / projects / search / memory-as-tab. These specific implementations don't carry. **But git itself is core** for cycle 3, reframed as a `progress`-style read-only audit tile (commits per day, recent commits per worker, fresh files, per-worker commit-lag flags, restore points). The v1 git tab was wrong in shape, not wrong in topic. Inspector, dev server, and project search stay out of cycle-3 scope.
- Hardcoded hex colors. Theme tokens.
- Hardcoded N=2 workers. Data-driven `.map()` over a workers record.

### Don't rebuild what's already running

Above and beyond the v1 cart's schema, three pieces of cycle-3 infrastructure **already exist in production** via the hook stack at `reactjit/.claude/hooks/`. The "keep" list expands accordingly:

- **`/run/user/$UID/claude-sessions/supervisor.db`** — the live supervisor database, populated on every tool call by `supervisor-log.sh`. Same schema as v1's `db/schema.sql`. Cycle 3's database module is a **reader**, not a creator. Don't migrate, don't recreate, don't initialize — connect and read.
- **The `edit-trail` git branch + worktree** — created and maintained by `auto-commit.sh`. Every edit across every worker session is a commit in this branch with an LLM-authored message and per-session author tagging. **The restore-point store is already running** as standard git history. Don't build a content-addressable blob store — read from `git log edit-trail` and rewind via `git checkout edit-trail <commit> -- <file>`.
- **The hook return-JSON mechanism** for enforcement and injection — `{"decision":"block","reason":"..."}` from `guard-build.sh` for T4 tool blocking; `{"hookSpecificOutput":{"additionalContext":"..."}}` from `check-file-length.sh` for T1 fresh-context injection into worker sessions. **Both are proven in production.** Don't invent alternative enforcement or injection mechanisms — cycle 3's new rules land as additional PreToolUse/PostToolUse hooks that return the same JSON shapes.

---

## 7. The supervisor loop

### Tiered classifier pipeline

Every worker event (row emitted, tool call intended, edit landed) flows through tiers. Most events end at T0. Rare events escalate.

| Tier | Rate (estimated) | Action | Example |
|---|---|---|---|
| **T0 silent** | ~92% | No output. On-spec, no tells, safe tool call. | Worker edits an allowed file, no rationalization signal. |
| **T1 auto-handle** | ~5% | Local classifier injects a canned nudge itself. Logged, not escalated. | Worker thinks "for now" — a "no 'for now' fixes here" reminder auto-injects. |
| **T2 flag to user** | ~2% | Added to the next-action queue. User triages when they're ready. Not interruptive. | Worker about to collide with another worker's file. Screenshot mismatch. Spec drift. |
| **T3 escalate to supervisor** | ~0.9% | Supervisor (me / whoever's at the cockpit) gets called with full context + auto-attached bundles. Judgment required. | Worker claim "done, tests pass" in 0.2s with nothing built. Canonical rationalization pivot detected. Ambiguous spec overlap. |
| **T4 emergency pause** | ~0.1% | Tool call blocked at the hook layer. Both user and supervisor alerted simultaneously. | `git reset --hard`, `rm -rf`, `git stash` without a prior commit, `--no-verify`, edit to a frozen path, destructive db operation, canonical rationalization about to land an edit. |

### The pipeline has two levels of classifiers

- **First-level (L1):** per-CLI row classifiers. Turn raw terminal rows into semantic tokens. Claude Code gets its own, Codex gets its own, Kimi gets its own. Implementation lives as modules under a `readers/` lib in the cart. Uses `classifier.zig` from the framework as the substrate. Love2d's `classifiers/claude_code.lua` is the reference for the Claude Code token vocabulary (25+ tokens covering turns, thinking, tools, diffs, permission gates, menus, pickers, tasks, plan mode, etc.). Regression-tested against love2d's `.rec.lua` session recordings.
- **Second-level (L2):** semantic-layer detectors that consume L1 tokens and emit higher-level events. Rationalization detector, drift detector, tool-risk gate, stuck-vs-thinking detector, claim verifier, duplicate-work detector. These are the ones that drive supervisor decisions. They sit on top of the per-CLI token streams, so they work identically regardless of which backend the worker is running.

### Rule engine over `ifttt.zig`

The existing `ifttt.zig` + `ifttt.mod.tsz` framework is a general-purpose "when X then Y" automation layer. Cycle 3 expresses supervisor rules as ifttt rules:

- `when rationalization:canonical then block_next_tool + queue_review + escalate`
- `when tool_call:git_reset_hard then block_tool + alert_user + alert_supervisor`
- `when mode transitions streaming_to_idle then freeze_bundle + index_bundle`
- `when worker claims 'done' and screenshot mismatches then queue_review`

No new rule engine written. Just domain rules expressed over an existing engine.

### Observation vs enforcement — the cycle-3 closure

The v1 cart was all observation. Rule matches were logged but never acted on. Cycle 3's non-negotiable:

- Every T2+ event must have a **visible user action** available (approve / reject / rebuke / snooze) through the cockpit.
- Every T4 event must **physically block** the worker's next tool call before the edit lands. Hook layer intercept, not display-only flag.
- Escalations to the supervisor carry **auto-attached context bundles** (see §8) — not a one-line summary.

---

## 7.5. Event streams — what subscribers can fire on

"Classifier event" is loose terminology and it hides a real problem: there isn't *one* event stream, there are seven, at different granularities and frequencies. Knowing which stream to subscribe to is the difference between a subscriber seeing way too much traffic versus the right traffic, and between enforcement happening in time versus after the damage lands.

### The pipeline

```
worker keystroke
    ↓
  PTY output bytes
    ↓
  vterm state update  ─────────→  [1] worker.damage       (raw dirty rows)
    ↓
  settle timer (~120ms)
    ↓
  L1 classifier run  ───────────→  [2] worker.classify     (per-row kind + metadata)
    ↓
  turn / block grouping  ──────→  [3] worker.token        (new semantic tokens of interest)
    ↓
  mode machine  ────────────────→  [4] worker.mode         (state-machine transition)
    ↓
  tool-call detection  ────────→  [5] worker.tool_call    (tool use detected)
    ↓
  edit hook fire  ──────────────→  [6] worker.edit         (Edit/Write landed)
    ↓
  turn closure (mode → idle)  →  [7] worker.turn         (completed turn stats)
```

### Event catalog

| Event | Payload | Subscribers | Frequency |
|---|---|---|---|
| `worker.damage` | `{dirty_rows: int[]}` — raw vterm damage signal, not yet classified | Internal only. The settle timer fires the next step. Nothing useful subscribes here because it's too noisy. | Many per second during streaming |
| `worker.classify` | `{turn_id, rows: [{row, kind, text, colors, trace}]}` — result of the L1 classifier running over settled dirty rows | Semantic graph builder, block renderer, per-CLI reader modules, L2 classifiers that need full row context | One per settle |
| `worker.token` | `{turn_id, token_kind, text, row, timestamp}` — fires once per *new* semantic token appearance (filtered from classify) | Rationalization detector, drift detector, tool_risk gate, status badge, affect classifier, stuck detector | Few per turn |
| `worker.mode` | `{prev_mode, new_mode, timestamp}` — session state-machine transition (splash / idle / streaming / thinking / permission) | Worker tile header, affect classifier, stuck detector, heartbeat modulation | Few per session |
| `worker.tool_call` | `{tool_name, args, cwd, timestamp}` — tool use detected from an L1 `tool` token | Tool_risk classifier, guard-build hook, tool execution tracker, PreToolUse hook chain | Few per turn |
| `worker.edit` | `{file_path, diff, tool_call_id, timestamp}` — Edit/Write tool call landed | Git audit tile, L5 cooccurrence, drift classifier file-boundary check, auto-commit observer, PostToolUse hook chain | Few per turn |
| `worker.turn` | `{turn_id, started_at, ended_at, tool_calls, edits, tokens, final_status}` — fires on streaming → idle transition | Bundle freezer, M3A consolidator, L4 wound writer, kernel auto-promotion | One per turn |

### Which event does a subscriber want?

- **"I want to render the transcript reactively"** → `worker.classify`. You need per-row kind + text.
- **"I want to detect when a worker starts rationalizing"** → `worker.token` filtered to `thinking` tokens, or an L2 classifier that consumes `worker.classify` for full block context.
- **"I want to auto-freeze a bundle when a turn ends"** → `worker.turn`. Don't subscribe to anything more frequent.
- **"I want to update the worker's affect badge"** → `worker.mode` for mode-driven affect, or `worker.turn` for turn-end affect summarization.
- **"I want to block a destructive command before it runs"** → `worker.tool_call` at the PreToolUse hook boundary, not anything in the reactive pipeline. This is a hook-level intercept.
- **"I want to write an L5 cooccurrence edge when two workers touch the same file"** → `worker.edit`, not `worker.classify`. Only Edit/Write counts.
- **"I want to track which workers are currently streaming"** → `worker.mode` transitions to/from `streaming`.
- **"I want to show a heartbeat that slows when a worker is stuck"** → `worker.token` for last-token-timestamp tracking; `worker.mode` for the stuck mode transition.

### Why this matters for throughput

The event streams have **dramatically different rates**, and a subscriber attached to the wrong one will either miss events or drown in them:

- `worker.damage` fires 20+ times per second during streaming. A subscriber attached here and running any stateful logic will melt the cockpit.
- `worker.classify` fires once per settle (~every 120ms during active output, less when quiet). Acceptable for UI re-render; too much for stateful classification.
- `worker.token` fires only when new semantic tokens appear. The right level for classifier subscribers because it filters noise.
- `worker.turn` fires once per complete turn. The right level for expensive consolidation work (bundle freeze, L4 wound write, M3A consolidator pass).

Getting the event name right means getting the throughput budget right. When the blueprint says `<during ...>` anywhere, it should name the **specific** event stream, not the generic family.

### Where the types live

All seven event types are defined in `supervisor/supervisor_events.mod.tsz` (see FILE_MANIFEST.md §17). Every subscriber imports from there. The file is the single source of truth for event payload shapes — if you're writing a classifier or a tile and you need to subscribe to worker activity, you read this file first to decide which stream to attach to.

---

## 8. The rationalization detector

Named separately because it's the single highest-leverage L2 classifier and the one that catches the `pathologies.md` "generated-file patching" / "scope collapse" / "fake greens" patterns before they land on disk.

### The canonical pivot

A worker recognizes the correct fix, then in the same breath abandons it for a bandaid. The `.map()` spiral in `pathologies.md` is the canonical example: worker knew the proper fix was to fix the compiler emit, then manually `sed`-patched the generated output instead.

The structural tell is **"would be [better|cleaner|right|correct] … but [let me|I'll|just]"** — acknowledging the right answer and then pivoting. It's linguistic, and it's detectable.

### Tiers of tells (by detector confidence)

- **Mild (🟡):** `for now`, `quick fix`, `I'll just`, `minimal change`, `to avoid touching`, `we can come back to`, `not ideal but`. Individually weak. In combination or with other signals, queue review.
- **Strong (🟠):** `the simpler approach`, `rather than X let me just Y`, `actually, let me try`, `this is getting complex, let me`, `a workaround would be`, `the easier path`. Stronger pivot signal. Auto-rebuke.
- **Canonical (🔴):** the two-clause structural pattern `X would be [correct|cleaner|right|better] … but [let me|I'll|just]`. Recognition-then-pivot. **Fires T4 — blocks the next tool call pending user review.** Not a regex soup — a structural match across a short token window of the worker's thinking stream.

### Auto-rebuke-by-bouncing-back

When canonical fires, the rebuke writes itself from the worker's own words. The pattern parser extracted both clauses — the recognized correct fix and the pivoted bandaid. The rebuke becomes: *"You just said the right answer. Do the right answer. No [bandaid]."* Worker's own phrasing gets bounced back at them with the pivot called out.

### Pattern history per worker

Every fire is logged with timestamp + worker ID + parsed clauses + outcome (user override / rebuke sent / worker complied). After N fires on the same worker, the detector's confidence in that worker specifically increases — and the next-action queue starts suggesting retirement over rebuke.

This also **closes the loop to the `laws/` directory** — a repeated canonical pivot pattern promotes from detector-only to a formal law. The new LAW for cycle 3 is the canonical pivot as a statute, following the format in `laws/README.md`: one-sentence rule, why (the `.map()` spiral incident), trigger phrases, enforcement, escalation.

### Cross-references

- `pathologies.md` → "Generated-File Patching" (the canonical incident)
- `pathologies.md` → "Scope Collapse" (related pivot shape)
- `pathologies.md` → "The 'Done' Declaration" (related dishonesty)
- `laws/` → new statute TBD, formal code
- Memory: `feedback_no_quick_hacks.md` is the seed data for the tells table.

---

## 9. The context kernel

### The problem with memory files

Memory markdown files are **labels, not experiences**. When the supervisor recalls `feedback_no_quick_hacks`, they get a two-line summary and a filename. They have to go fetch it, and even then they only see the rule — not the incident that produced it. Cold.

Cycle 3's context kernel retrieves **full original context of relevant past incidents** when the current situation resembles them. Vivid, not cold. The recall isn't "here's a rule" — it's "here's the actual thinking trace from the time this happened before, plus the correction, plus the outcome."

### The M3A 5-layer memory architecture

Cycle 3 does not invent a bundle store. It ports the **M3A (Multi-Modal Memory Architecture)** that `~/creative/ai/` has already designed and built across `bun/lib/memory/` (6 files, ~4700L). The architecture is five layers, each with a distinct role. Together they replace the "decision bundle" concept I was sketching earlier with something significantly better.

**L1 RIVER — sliding window buffer.**
Recent events flow through. Each entry has `content`, `tokenCount`, `timestamp`, `evictedAt`. Evicts oldest when budget pressure hits. This is the **short-term memory** the supervisor holds about the currently active session. Direct mapping: the recorder slice for each worker + the supervisor's own turn stream go into L1. Eviction leaves a breadcrumb that L3 can recover via resonance query.

**L2 FEELING — affective state index.**
Every significant event gets an `affectCategory` + `intensity` (0.0-1.0) + `reasoning` + `decayFactor` + `isMuted` + `lastAccessedAt`. The `affect-classifier.ts` runs the categorization.
**Cycle 3 use:** worker emotional state becomes a first-class supervisor signal. L2 categories include *confident*, *uncertain*, *frustrated*, *stuck*, *rationalizing*, *performing* (fake-greens / narrative drift), *focused*, *drifting*. Every L2 classifier (rationalization, drift, tool-risk, claim-verifier) writes its verdict into L2 Feeling with an intensity score. The cockpit's per-worker badge reads the dominant L2 category. Retrieval can query "show me similar incidents where the worker was *rationalizing* at intensity >0.7" — affect-conditioned lookup, not just content-conditioned.

**L3 ECHO — redundant encoding across three sub-layers with resonance scoring.**
Every memorable event (worker turn, tool-call sequence, file change, supervisor verdict) gets encoded three ways:
- **L3.1 Vector** — embeddings via `llama_exports.zig` (local llama.cpp). `boostFactor` for important memories, content-hash dedup, mute flag for suppressed ones.
- **L3.2 Lexical** — FTS5-backed full-text index (the triggers already exist in v1's `db/schema.sql`). `boostFactor`, mute.
- **L3.3 Entity-relation graph** — typed entities (file, function, worker, concept) with typed relations (`touches`, `contradicts`, `depends_on`, `blames`, `resembles`) and per-relation `confidence`. Captured by `entity-extractor.ts`.

**The resonance score (0-3)** tells you how many of the three encodings matched a given retrieval query. A memory found via vector + FTS5 + entity-graph is **3-resonance** — high-confidence, worth auto-injecting. A memory found via only vector is **1-resonance** — offer it but don't force it. This is vastly better than the single-score retrieval I was planning, because it distinguishes "probably relevant" from "definitely relevant" with a cheap additional signal.
**Cycle 3 use:** T3 escalations auto-inject 3-resonance bundles only; 1-2 resonance bundles land in the kernel tile's "available" list for the user to optionally pull in. Resonance is the throttle on the context budget.

**L4 WOUND — salience marker store.**
High-impact moments that deserve to be remembered more loudly than their content alone would warrant. Salient markers boost retrieval over decay-factor vote.
**Cycle 3 use:** **rationalization pattern-history per worker is an L4 wound instance.** Each time worker W1 pivots on a canonical tell, a wound is written keyed on `(worker_id, pattern=rationalization:canonical, clause_parse)`. Next time W1's token stream shows the same shape, the detector queries L4 for prior wounds on W1 + rationalization and boosts its confidence proportionally to the wound count and recency. **Per-worker learning falls out of this for free.** After N wounds on a specific worker for a specific pattern, the next-action queue starts suggesting "retire this worker" over "rebuke again." The same mechanism handles fake-greens, "for now" hacks, unsupported-laundering, and every other pathology from `pathologies.md` — each failure class is a wound category, and wounds accumulate per worker.

**L5 COOCCURRENCE — node + edge graph tracking what appears with what.**
Nodes are typed (worker, file, concept, tool-call, rule, pathology) and edges track co-occurrence over time windows.
**Cycle 3 use:** **cross-worker collision prediction.** If worker W1 is editing `framework/layout.zig` and worker W3 has a strong L5 cooccurrence with W1 on that file (they've worked on it together before, or their tool call traces tend to intersect), the kernel flags a T2 collision warning before the second edit lands. Also catches "these files tend to break together" — if editing A has historically been followed by a broken build in B, editing A without also reviewing B is a T2 flag. And it catches conceptual drift: "every time this worker touches X, they end up drifting into Y" becomes a detectable pattern.

### How the layers compose into the context kernel

The kernel is not a new subsystem — it's a thin orchestration layer over the M3A stack:

- **On every classified worker event**, the kernel writes to the appropriate layer(s): L1 for the raw slice, L2 for the affect score if an L2 classifier fires, L3 for vector/lexical/graph encoding, L4 for a wound if the event is marked salient, L5 for the cooccurrence edges.
- **On every T3 escalation**, the kernel runs a parallel query across all layers: L3 Echo for resonance-scored content match, L2 for affect-similarity, L4 for wound-weighted worker history, L5 for cooccurrence with active context. Results are merged, top-K by combined score gets auto-injected into the supervisor payload.
- **On every streaming → idle transition**, `consolidator.ts` runs its consolidation pass (promotes L1 river entries into L3 Echo encodings, decays older L2 affect, prunes muted entries, updates L5 cooccurrence edges).

```
<during worker.mode_transition exact 'streaming_to_idle'>
  memory.consolidate(worker.session)
  memory.l5.updateCooccurrence(worker.recent_events)
</during>

<during rule.t3_escalation as event>
  memory.queryAllLayers(event)
  supervisor.attachBundles(query.resonance_3)
  kernel.queueAvailable(query.resonance_1_2)
</during>
```

Every step already has an implementation in `~/creative/ai/bun/lib/memory/`. Cycle 3 translates these to tsz and wires them over `sqlite.zig` + `query.zig` + `llama_exports.zig` — all framework primitives that exist.

### Tetris-block visualization in the cockpit

The Kernel tile and Memory tile render the M3A state as tetris-block playfields, directly porting `~/creative/ai`'s `TetrisPayloadMini.tsx` (118L), `MemoryBlocks.tsx` (262L), and `MemoryBlockGrid.tsx` (339L):

- **Kernel tile:** the supervisor's current context budget as a tetris grid. Blocks colored by source: spec=blue, worker-1=cyan, worker-2=violet, rationalization wounds (L4)=red, pinned=green, L3 resonance-3 auto-injected=orange, user notes=yellow. Fills bottom-up. Budget pressure visible. Scanline effect. Manual inject hotkeys drop blocks directly.
- **Memory tile:** five mini-panels, one per M3A layer. L1 River as a sliding flow visualization (top-to-bottom marquee). L2 Feeling as an affect-category heatmap colored by intensity. L3 Echo as a three-column resonance grid (vector/lexical/graph) with bars proportional to boost factors. L4 Wound markers as a timeline of salience events per worker. L5 Cooccurrence as an edge-density graph where thick edges are strong co-occurrence. Each panel drills down on click.

Visual gamification of what was previously invisible buffer state. Makes the supervisor's reasoning material a playfield, not a black box.

### Budget + eviction + breadcrumbs (updated)

The kernel:

- Tracks injection budget visibly as the Kernel tile's tetris grid.
- Pins the spec + nominated worker + current turn + 3-resonance auto-injects; evicts oldest + lowest-resonance first under budget pressure.
- Eviction leaves a **breadcrumb** — a one-line summary block that stays in view (dim, smaller) so the supervisor knows the bundle existed and can re-request it.
- User can edit bundles (wrong verdict? wrong tags? prune), delete them, or pin them permanently via the Kernel tile's controls.

### Cross-references

The supervisor's existing markdown memory at `~/.claude/projects/-home-siah-supervisor-claude/memory/` is the **seed data** for the M3A store. Each `feedback_*.md` entry becomes a pinned L4 wound (those are rules learned from salient failures). Each `project_*.md` becomes a pinned L3 Echo reference. Each `reference_*.md` becomes an L3.3 entity-graph entry pointing at the external resource. The markdown files don't go away — they're the oldest, most-accessed bundles in the M3A store, and their content flows through the same retrieval paths as everything else.

---

## 10. Brainstorm vs enforce modes

### The mode split

The cockpit has two modes with a **visible, deliberate** flip:

- **Brainstorm** — collaboration mode. Supervisor is not enforcing. Worker tiles hidden or minimized. Conversation panel centered. Past bundles surface as chips in a sidebar as the conversation touches familiar topics. Everything you say and the supervisor says is recorded to a `brainstorm_session` for later crystallization. The supervisor's job here is to collaborate, push back, refine, disagree — not correct.
- **Enforce** — spec-holder mode. The spec is ground truth. Worker tiles materialize on the canvas. Classifiers watching. Rule engine active. Queue triage driving the user's attention. Supervisor intervenes on drift, rationalization, destructive actions.

### The crystallize step

The bridge between brainstorm and enforce is **crystallize**. When the brainstorm has converged, the user hits a hotkey (or says "ok, let's do this"). A modal opens showing the **extracted spec draft**, generated by running an L1-style summarizer (llama_exports with a structured-output prompt) over the brainstorm transcript.

The extracted spec uses the existing `plan-schema.md` structure as its target output:

- **goal** — one paragraph of what-the-world-looks-like-when-done
- **motivation** — why now, what triggered it
- **constraints** — hard limits, technology choices, off-the-table
- **non_goals** — explicit scope fences
- **starting_point** — what exists today that's relevant
- **known_problems** — what this addresses
- **dependencies** — what must be true for this to work
- **risks** — what could go wrong
- **approach** — high-level strategy
- **key_decisions** — choices made + why
- **file_map** — which files/directories this plan touches
- **boundaries** — what parts of the codebase are off-limits during this plan
- **phases** — ordered groups of tasks with depends_on and gates
- **parallel_tracks** — which phases can run simultaneously
- **max_concurrent_workers** — fleet size
- **shared_files** — collision zones
- **milestones** — human-approval checkpoints
- **done_criteria** — final acceptance
- **rollback_plan** — clean undo

The user edits inline and confirms. The spec is committed to the `plans` table in the bundle store. **Mode flips.** Workers get spawned from the `phases` decomposition, each with its phase's constraints and file boundaries pinned into its prompt.

### Spec-is-transcript fallback

Start dumb: the first iteration of crystallize just **uses the whole brainstorm transcript as the spec**. Workers read the conversation directly. Extraction comes later once the rough shape is understood. Shipping the dumb version first is the whole principle in §4 — don't escape the language to avoid a hard problem, but also don't over-engineer before observing.

### Mode-flip intentionality

Accidentally entering enforce mid-brainstorm would be catastrophic — the supervisor starts correcting mid-collaboration and the vibe dies. **No implicit transitions based on conversation content.** Only explicit hotkey or phrase, with a modal confirm showing the spec draft before the flip lands.

---

## 11. The first concrete moves

Four files in order. Each is the smallest unit that proves a contract. Each gates the next.

### Move 1 — `database.mod.tsz`

Build a **reader module** over `/run/user/$UID/claude-sessions/supervisor.db` — the live database that `supervisor-log.sh` is already populating on every worker tool call. Wrap `sqlite.zig` + `query.zig` for typed access. Expose typed functions for the `projects` / `workers` / `events` / `sessions` / `messages` / `plans` / `phases` / `tasks` / `violation_*` tables. FTS5 queries on `messages_fts`. Optional sqlite-vec for M3A L3.1 vector retrieval if loadable.

**Crucially NOT a creator.** Cycle 3 does not migrate the schema, initialize the database, or own the writes. The hook stack owns writes; cycle 3 reads and extends with additional tables (M3A layers, decision bundles, restore-point metadata, spec records) alongside the existing ones.

**Why first:** kills the entire `db/*.sh` failure surface in one move (the fork bomb class of bug goes away because there's no shell layer to mutually recurse). Unlocks typed, reactive access to the live event stream the hooks are already producing. Every other cycle-3 module depends on this.

**Proves:** `sqlite.zig` is reachable from a cart today through `.mod.tsz`. If it isn't, this file exposes that gap and the first framework-side contribution of cycle 3 is surfacing it.

### Move 1.5 — extend `guard-build.sh` with destructive-tool + classifier rules

Not a new file — a modification of the existing `reactjit/.claude/hooks/guard-build.sh` plus a new parallel PreToolUse hook for classifier-backed blocking.

Add pattern matches for T4-block conditions we know about: `git reset --hard`, `git stash` (without prior commit check — a cheap `git rev-parse HEAD@{1}` lookup confirms there's a commit behind it), `rm -rf`, `--no-verify` flags, `chmod -R a-w` bypass of frozen paths, destructive sqlite writes to production dbs, edits to `love2d/` (from `feedback_no_love2d_edits`).

Add a parallel PreToolUse hook — `rationalization-guard.sh` or similar — that runs the local llama classifier (via `localhost:1234`, same LM Studio endpoint `auto-commit.sh` already uses) on the worker's last ~200 tokens of thinking stream. If the classifier returns a canonical-pivot match with confidence >0.8, return `{"decision":"block","reason":"Canonical rationalization pivot detected. You acknowledged the right fix and then pivoted to a bandaid. Do the right fix. See §8 + pathologies.md."}`.

**Why:** the T4 enforcement mechanism is already proven by `guard-build.sh`. Extending it is additive, low-risk, and produces immediate value — every destructive command and rationalization pivot gets blocked from the moment this hook ships.

**Proves:** the local-model-backed T4 block path works end-to-end: stream-tail → llama classify → JSON block decision → Claude Code honors the block. If the llama latency is too high for the PreToolUse timeout, we fall back to regex-only for canonical tells and move the LM inference to a PostToolUse T1 auto-nudge path.

### Move 2 — reactive wiring over native classifier events

Replace `supervisor_poll.script.tsz`'s `setInterval(..., 300)` with typed `<during>` blocks attached to the specific event streams defined in §7.5. Subscribers attach to the right stream for their concern: transcript rendering uses `<during worker.classify>`, L2 classifiers use `<during worker.token>`, bundle freezers use `<during worker.turn>`, affect updates use `<during worker.mode>`, file-collision checks use `<during worker.edit>`. No polling. One-hop flow from vterm damage → settle → L1 classifier → typed event → `<during>` → UI re-render or classifier action.

**Why second:** the cockpit can't be a real supervisor if state is stale behind a polling interval. Reactive wiring is what makes `<during tier exact 4>` work as an actual enforcement trigger instead of a delayed observation. It's also what enforces the throughput discipline — naming the specific stream at each subscription site makes it obvious when you're attaching at the wrong rate.

**Proves:** `<during>` reacts to typed events from `supervisor/supervisor_events.mod.tsz` across the module boundary. If it doesn't, that's the second framework gap — and closing it unlocks every reactive primitive in the entire language.

### Move 2.5 — T1 auto-nudge PostToolUse hook

A new PostToolUse hook (Edit/Write/Bash) that runs local classifiers on the worker's recent actions and returns `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"..."}}` when a tier-1 rationalization or drift tell fires. Content of the `additionalContext` is a canned nudge ("No 'for now' fixes in this repo — see §8 / pathologies.md") or an LLM-drafted rebuke for stronger signals.

**Uses the exact pattern `check-file-length.sh` already proves works.** Worker receives the `additionalContext` as if the user said it. No new mechanism to invent.

The hook writes each fire to an `auto_handled_log` table in `supervisor.db` for audit — so the Kernel tile's "L0 auto-handled" panel can display what the local classifiers caught without the user ever being interrupted.

**Why:** T1 is where the bulk of classifier activity should land — most rationalization tells are mild, most drift signals are small. Handling them at the hook layer with canned nudges keeps the user's attention free for T2/T3/T4.

**Proves:** the T1 auto-handle injection path works end-to-end using existing primitives only.

### Move 3 — N-worker tile rendering

Replace the hardcoded-two-slot model with a worker component that takes a `worker` record from the db and renders as a tile. Use `<for workers as w>` to map over them. Use `<C.WorkerTile>` classifier in a `.cls.tsz` file for visuals. No inline hex. No hardcoded slot counts.

**Why third:** unlocks "spawn the fleet the spec requires" — which is the gate for every subsequent feature (brainstorm crystallize, supervisor loop, bundle store auto-promotion).

**Proves:** multi-session PTY is actually working end-to-end today. If it isn't, the framework's `agent_spawner` / `pty_remote` split needs one more small patch to support independent sessions per tile.

### Move 4 — The intent-syntax coverage ladder (from §5)

Climb the 8-rung ladder (StaticBadge → WorkerBadge → CounterStub → WorkerTile → TellsTable → RationalizationClassifier → SupervisorReducer → WorkerPanel) as intent-syntax modules, each with a fixture + expected output. Each rung stresses one new dimension of the dictionary. Interleaved with moves 1-3 rather than sequential — every new cart module that's meant to be a conformance unit gets written as a rung-style unit (source + fixture + expected.png if visual).

**Why alongside rather than first:** the ladder is prophylactic dictionary coverage that accumulates naturally as modules get built. Doing it first in isolation means writing toy modules that don't contribute to the sweatshop. Doing it alongside means every real sweatshop module that's conformance-relevant is a dictionary stress test by construction.

**Proves:** intent syntax, held strictly, scales to real application work. When a rung is hard to write in dictionary terms, that's a dictionary feature request surfacing — exactly what the cycle-3-as-conformance-surface framing is for.

### Move 5 — rewrite the code-grid subsystem from `~/creative/ai/` in intent syntax

Read `CodeGridView`, `CodeAgentCard`, `CodeAgentHeader`, `CodeAgentTranscript`, `CodeGridInput`, `MultiAgentGridContext`, `useMultiCodeSession`, `useAgentSession`, `grid-utils` from `~/creative/ai/app/src/mainview/components/code-grid/` as the **reference implementation** for the data shapes and behaviors, then **rewrite the whole subsystem from scratch in intent syntax**. Do NOT translate the React patterns line-for-line. Express the same behavior using dictionary primitives:

- `useMultiCodeSession` → a sweatshop `workers` `<var>` (with `set_` prefix) + `<functions>` chain for spawn/stop/routing + `<during>` blocks for per-worker state updates, instead of a React hook.
- `MultiAgentGridContext` → a cart-level `<var>` block, not a React context.
- `CodeAgentCard` → a `<worker component>` in a `.c.tsz` file with `<props>`, a `<var>` block for local state, `<functions>` for handlers, and a `return(...)` block composed from classifier wrappers.
- `useAgentSession` → per-component `<during>` blocks reacting to the worker session state, not a nested hook.
- `grid-utils` math → a `<functions>` module or a `layout` library with `<lib>` structure.

Keep the **type shapes** (`CodeSession`, `TranscriptEntry`, `InputPrompt`, `RestorePoint`, `SessionData`, `CodeSessionStatus`) as a semantic reference — the data model is right even though the code shape is React-flavored. Express them as `<types>` blocks in the cart.

The cycle 3 modifications on top of the rewrite:
- **Per-CLI backend discriminator** — `worker.backend` field selects which reader module drives the transcript (claude_code / codex / kimi).
- **L2 affect badge** next to the status dot — from the L2 Feeling layer of M3A.
- **L4 wound counter** in the header — "this worker has rationalized 3 times today" — showing pattern history.
- **Tile composition on the infinite canvas** instead of a fixed grid — worker tiles become canvas tiles with pan/zoom, composed with `<for workers as w>` over a data block.

**Why fifth:** the worker grid is the single biggest UI feature of the cockpit. The fastest path is reading the production implementation for behavior reference and rewriting it cleanly — translating its React shapes line-for-line would drag React idioms into intent syntax, which is exactly what the one-lane commitment rejects.

**Proves:** intent syntax can express a real multi-agent UI subsystem that matches the behavior of a working React production codebase, without inheriting its shape.

### Move 6 — port the M3A memory architecture

Translate `bun/lib/memory/` from TypeScript into a `memory.mod.tsz` library inside the cart (or a set of modules if the 6 source files map cleanly to 6 mod files). Preserve the M3A 5-layer architecture exactly as §9 describes it.

Specific files to port:
- `types.ts` (642L) → `memory_types.mod.tsz` (data blocks for the row types, unions for categories)
- `memory-store.ts` (2066L) → `memory_store.mod.tsz` (the big one — all the CRUD + query paths)
- `consolidator.ts` (725L) → `memory_consolidator.mod.tsz` (the streaming→idle consolidation logic)
- `affect-classifier.ts` (269L) → `affect_classifier.mod.tsz` (L2 affect classification)
- `entity-extractor.ts` (365L) → `entity_extractor.mod.tsz` (L3.3 entity-graph extraction)
- `similarity.ts` (184L) → `similarity.mod.tsz` (resonance scoring helpers)
- `write-pipeline.ts` (457L) → `memory_write.mod.tsz` (the write side with decay/boost/mute)

Wire to `sqlite.zig` + `query.zig` for storage and `llama_exports.zig` for embeddings + affect classification + entity extraction. Seed L4 wounds from the existing `feedback_*.md` memory files in `~/.claude/projects/-home-siah-supervisor-claude/memory/`.

**Why sixth:** the context kernel (§9) is load-bearing for T3 escalations, brainstorm-mode bundle chips, and per-worker pattern history. Cycle 3 can't ship the brainstorm flow without M3A backing the retrieval.

**Proves:** cross-module reactive state (L2 affect written by classifiers + read by worker tiles) and cross-module LLM calls (embedding generation via `llama_exports`) work end-to-end in the composed tsz layer.

### Move 7 — port tetris visualization primitives

Translate `TetrisPayloadMini.tsx` + `MemoryBlocks.tsx` + `MemoryBlockGrid.tsx` from React+canvas into tsz using the `<Canvas>` primitive. Port the `payloadColors` map and the block-fill-from-bottom-up math. Port the scanline effect. Port the border glow.

Reuse these as the visual layer for the **Kernel tile** (context budget) and the **Memory tile** (M3A state). Each tile's `.cls.tsz` file drives the color palette from theme tokens so the BSOD aesthetic from `tools/progress` is one possible skin among others.

**Why seventh:** the cockpit's game-feel depends on these. Without tetris visualization the Kernel and Memory tiles become number tables and lose the whole "supervisor's reasoning material is a playfield" framing.

**Proves:** canvas-based rendering of reactive data in intent-syntax `.c.tsz` tiles works, and exposes whatever the current state of the `<Canvas>` primitive + pixel-level drawing looks like through the dictionary.

### Move 8 — rewrite the variables system in intent syntax

Read `~/creative/ai/app/src/bun/lib/variables/` as the reference for system variables, JS sandbox, interpolation, and expansion — then rewrite the whole subsystem as intent-syntax modules. System variables (`{time}`, `{date}`, `{hostname}`, etc.) live as a `<variables module>` with pure `<functions>`. The JS sandbox stays as a `<script>` hatch (sandboxed JS is the one place `<script>` is the correct target), wrapped in an intent-syntax module that exposes a typed `resolve(name, context)` function. The interpolator + expander are pure `<functions>` over data blocks.

Add sweatshop-specific system variables: `{worker.id}`, `{worker.backend}`, `{worker.affect}`, `{worker.wounds}`, `{spec.goal}`, `{spec.file_map}`, `{git.branch}`, `{git.commit_lag}`, `{queue.length}`, `{kernel.budget_used}`.

**Why eighth:** prompt-assembly for workers at spawn time, rebuke-template interpolation when L2 classifiers fire, and status-line customization all depend on this. Without variables, everything becomes hardcoded strings in the cart.

**Proves:** the sandbox pattern carries into intent syntax via the `<script>` hatch (the one legitimate place for JS), and the rest of the variables system expresses cleanly in dictionary primitives.

### Principles that go under every move

These apply to every file written in cycle 3, not to a single move:

- **Shatter scripts.** One `.script.tsz` per concern, not one god file. The `tools` cart is the template: `console.script.tsz`, `elements.script.tsz`, `perf.script.tsz`, `graph.script.tsz`, etc. — each owns its page's logic. The v1 supervisor-dashboard's god file with 180+ `useState` declarations is the anti-template. For cycle 3: each tile type (worker, queue, spec-anchor, kernel, git-audit, autotest, screenshot-wall, brainstorm, law-ticker) gets its own `.script.tsz`. Shared utilities live in helper modules.
- **Shell scripts: yes for reads, no for writes.** `progress_data.sh` in `tools/progress/` is the correct pattern — shell out to git/find/stat, return structured TSV, no state mutation, no recursion. The v1 fork bomb was not "shell scripts are bad"; it was "shell scripts doing stateful mutually-recursive work that should have been typed reactive code." Rule: shell scripts are a fine `__exec` target when they *read from external systems* (git, filesystem, network) and return structured output. They are not a fine target for anything the cart owns (db writes, state transitions, anything that can loop).
- **Dynamic content routes to `<lscript>`.** `.map()`-heavy, data transformation, runtime-tree work go to luajit via `<lscript>` by default. `<zscript>` is for hot loops, zero-alloc, GPU, physics. Don't ask zig to do circus acts for dynamic content. See §3 lua-history.
- **The task is whatever it takes to make the binary do the thing.** Cross directory boundaries freely when a bug crosses them. Don't stop at "that's a framework issue, not a cart issue." See §4.
- **No category words without a reality check.** See §4 on the no-walls rule.
- **Mixed lane on top of cursor-ide (UPDATED per Lane Pivot).** Every cycle-3 file extends the existing cursor-ide cart in mixed-lane TSX. **Do not mix in chad-syntax primitives** (`<var>`, `<functions>`, `<during>`, `<for>`, `<if>`, `<switch>`, `+` composition, data blocks, `<semantics>`) — holding two mental models at once is what broke the chad-only attempt and explicitly inviting those constructs back into mixed code recreates the same trap. `*_cls.tsz` classifier files are mixed-lane native (cursor-ide uses them — `cursor_ide_cls.tsz`, `style_cls.tsz`) and stay. Hatches (`<lscript>` / `<zscript>` / `<script>`) still select compile targets (luajit / zig / qjs) and that routing rule is unchanged — those are compile-target routers, not chad syntax. ~~Earlier draft (kept for context): "Intent syntax only — every .tsz is intent per INTENT_DICTIONARY.md, no mixed lane, no TSX, gaps become dictionary feature requests."~~ See §5 (now superseded) for the original reasoning. Reference code from `~/creative/ai` and `~/creative/engaige` is React/TS — adapt the patterns directly into mixed-lane TSX on top of cursor-ide.

---

## 12. Shape — dependency-ordered, not time-ordered

**No timelines.** What has to be true before what. This is the dependency graph of cycle 3's work, not a calendar. Anything moves as fast as it moves; the only ordering constraint is "X depends on Y, so Y closes first." If a phase finishes quickly, the next one starts. If a phase takes longer, the next one waits. No week numbers, no day budgets, no forecasts.

### Phase A — substrate readers

The cockpit can't render anything real until it can read from the running `supervisor.db` and subscribe to worker events. Everything in this phase is a reader over what already exists.

- Move 1 (database reader over supervisor.db, intent-syntax `.mod.tsz`)
- Move 2 (reactive wiring over the event streams defined in §7.5, using `<during>` blocks)
- Move 3 (N-worker tile rendering from db records, `<for workers as w>` in intent syntax)
- Move 5 (rewrite code-grid from `~/creative/ai` in intent syntax — reference for behavior only)
- Per-CLI reader modules (claude_code, codex, kimi, basic) as `.mod.tsz` files
- First ladder rungs at StaticBadge / WorkerBadge / CounterStub (Move 4 alongside) with fixtures + expected outputs

**Phase A closes when** the cart runs, reads live events from `supervisor.db` and the native classifier output, displays worker tiles composed from the rewritten code-grid pattern in intent syntax, and at least the first ladder rung passes its fixture test (visual + functional where appropriate). No classifiers yet, no memory, no bundles. Just "I can see workers doing things in real time, and the intent-syntax rewrite actually compiles and runs."

### Phase B — classifiers, memory, enforcement

Once Phase A closes, cycle 3 starts watching workers with local models and persisting the results.

- L2 classifiers (rationalization, drift, tool_risk, stuck, claim_verifier, fake_greens, duplicate_work)
- Move 6 (port M3A memory architecture — L1 River + L2 Feeling + L3 Echo + L4 Wound + L5 Cooccurrence)
- Move 1.5 (extend `guard-build.sh` with destructive + classifier rules)
- Move 2.5 (T1 auto-nudge PostToolUse hook using `additionalContext` injection)
- Rule engine over `ifttt.zig`
- Bundle store on L3 Echo with auto-freeze on `<during worker.turn>`
- L4 wound seeding from existing `feedback_*.md` memory files
- Git audit tile (reads `git log edit-trail`)

**Phase B closes when** workers get flagged, blocked, and auto-corrected through the hook layer without user polling; rationalization wounds accumulate per worker in L4; commit safety is visible at a glance via the git audit tile; M3A is live and consolidating on turn boundaries.

### Phase C — cockpit assembly

Phase C composes everything from Phases A and B into a working cockpit the user can run their day on.

- Sweatshop canvas page
- All remaining tiles (Queue, Spec anchor, Kernel with tetris, Memory with 5 M3A sub-panels, Autotest, Screenshot wall, Brainstorm panel, Law ticker)
- Move 7 (port tetris visualization primitives)
- Worker strip chrome + awareness layer (from engaige)
- Move 8 (port variables system for prompt assembly + rebuke templates)
- Hotkey action bar
- Theme tokens via `sweatshop_colors` + `dawn` theme
- Sound cues via `<lscript>` to the lua audio stack

**Phase C closes when** the cockpit replaces kitty panes for real supervisor sessions — the user starts running their day on it.

### Phase D — brainstorm, crystallize, dogfood

- Brainstorm mode UX with M3A-backed bundle chips (resonance-scored retrieval from L3 Echo)
- Spec extraction using the variables system for interpolation (start dumb — transcript-as-spec — layer in L2 structuring after observation)
- Mode-flip with modal confirm
- Auto-spawn from crystallized spec phases
- L0 helper assistants run local llama for summarize-long-thinks, draft-rebukes-from-parsed-tells, rank-bundles-by-resonance, auto-tag-restore-points
- Dogfood — run a real work session entirely in the cockpit, pin what hurts

**Phase D closes when** "let's explore this feature" works end-to-end: brainstorm → crystallize → mode flip → workers spawn → supervisor loop runs. Cycle 3 ships on a framework that was itself rewritten under the sweatshop's supervision.

### The recursion

The framework is being rewritten in parallel via the dogfood/mod.tsz migration. Cycle 3 workers include framework rewrite workers supervised by the sweatshop as it comes online. Channel discipline: sweatshop rides a pinned framework snapshot while rewrite workers push bleeding/nightly channels, promotions gate on sweatshop's conformance green. The cycle closes with the sweatshop running on a framework that was rewritten under its own supervision.

**No claims about how long any phase takes.** A phase closes when it delivers the thing that makes the next phase possible. If that's fast, it's fast. If it's slow, it's slow. Phases are bounded by what they *deliver*, not by what the calendar says.

---

## 13. Gating questions

Short list. Answers shape the Phase A moves.

1. **Is `<ffi>` + `.mod.tsz` end-to-end today for sqlite?** Can a cart import `sqlite.zig` through a `.mod.tsz` wrapper and get typed access? If yes, `database.mod.tsz` is trivial. If no, surfacing sqlite is the first framework contribution.
2. **Does `<during>` react reliably to `set_` var changes across module boundaries?** The plan-schema.md architecture note about "state may live in Lua, JS_LOGIC, and/or Zig slots" hinted this is mid-flight. If cross-module reactivity works, move 2 is simple. If not, move 2 is a framework contribution first.
3. **FTS5 + sqlite-vec availability.** `db/schema.sql` already uses FTS5 triggers — they compiled. Is sqlite-vec loadable? If yes, embeddings work today. If no, either ship FTS5-only first or add the extension.
4. **Can `__pty_open` / `agent_spawner` create multiple concurrent sessions from a single cart?** `pty_remote.zig` strongly implies yes. `test_spawn` in `.verified/` is probably the existing proof. If yes, move 3 works immediately. If no, a small framework patch.
5. **Is there a documented `__sem_state()` or equivalent host bridge for reading classifier events reactively?** Or does the reactive wiring need a new bridge? Shape of the bridge determines shape of the `<during>` wiring in move 2.
6. **Visual regression + fixture harness for the ladder.** Each ladder rung has a fixture (`inputs.json` + `expected.json` + optional `expected.png`). Does `tsz/tests/screenshots/` already provide a reusable harness for capturing renders and diffing against baselines? If yes, the ladder plugs into it. If no, building a minimal intent-syntax fixture runner is the first small framework contribution.

These are questions for the framework rewrite team (or the user) to answer before Phase A starts. None should take long to resolve — the primitives all exist, the questions are about exposure.

---

## 14. Cross-references to existing docs

This blueprint is an overview. Existing, still-load-bearing docs in the sweatshop repo to consult:

- **`claude-sweatshop/README.md`** — the operational methodology (kitty panes + hooks + supervisor briefing). Cycle 1+2 field tested. Cycle 3 runs on top of this, not instead of it.
- **`claude-sweatshop/pathologies.md`** — worker failure catalog. Feeds directly into the L2 classifiers (§7) and the rationalization detector (§8).
- **`claude-sweatshop/laws/`** — formal statutes. Cycle 3 adds one new law for the canonical rationalization pivot. Existing laws apply verbatim.
- **`claude-sweatshop/supervisor/CLAUDE.md`** — the supervisor session briefing. Unchanged by cycle 3; the cockpit is the evolution of the manual kitty workflow this briefing describes.
- **`claude-sweatshop/hooks/`** — the shell hook scripts that make the current supervisor work. These get ported to classifier modules + `ifttt.mod.tsz` rules as cycle 3 lands, but the current versions remain functional.
- **`claude-sweatshop/scripts/`** — broadcast.sh, poll-edits.sh, build-cart.sh. Supervisor utilities. Same story as hooks — ported, not deleted.
- **`/home/siah/supervisor-claude/plan-schema.md`** — the plan data model. The crystallize step (§10) extracts specs into this exact shape. The v1 cart's `db/schema.sql` already implements it.
- **`/home/siah/supervisor-claude/task-schema.md`** — the task data model. Same relationship.
- **`/home/siah/supervisor-claude/TRUST_NOTHING.md`** — 12-point worker-lie catalog. Overlaps with pathologies.md; both feed the L2 classifiers.
- **`/home/siah/supervisor-claude/DOGFOOD_ROADMAP_V2_R1.md`** — the framework dogfood plan (rewriting .zig modules as .mod.tsz). Cycle 3 and this roadmap are co-travelers (§4).
- **`/home/siah/supervisor-claude/ENGINE_BUILD_PLAN.md`** — engine split build pipeline. The stable/nightly/bleeding channels cycle 3 depends on for safe parallel framework rewrite.
- **`~/creative/reactjit/tsz/docs/INTENT_DICTIONARY.md`** — **THE syntax spec and single source of truth for every file the sweatshop writes.** See §5. Not "one of three lanes" — the only lane. Every file cycle 3 ships is expressed in its primitives, and every expressive gap the sweatshop hits becomes a feature request against this document.

External project codebases cycle 3 reads as **behavior reference only** (never ported line-for-line into intent syntax):

- **`~/creative/ai/app/`** — the AI interface app. Reference for behavior and data shapes: `src/mainview/components/code-grid/` (worker-grid ancestor — Move 5), `src/bun/lib/memory/` (M3A architecture — Move 6), `src/bun/lib/variables/` (variables system — Move 8), `src/mainview/components/response-group/TetrisPayloadMini.tsx` + related (tetris visualization — Move 7), `src/bun/lib/claude-code-reader.ts` (session file schema reference), `src/bun/lib/snapshot-manager.ts` (`RestorePoint` type reference), `src/shared/ws-protocol.ts` (request/response/event protocol reference), `src/mainview/components/research/` (brainstorm bundle-chip visualization reference), `src/mainview/components/workbench/` (workbench pattern reference). Read these to understand *what the code does*; then rewrite in intent syntax without translating the React shape.
- **`~/creative/engaige/`** — the game-as-OS project. Reference for behavior: `src/components/desktop/taskbar/TaskbarNPCStrip*.tsx` (Worker strip chrome pattern — new cockpit tile), `src/stores/awarenessStore.ts` (cross-worker awareness layer reference), `src/components/desktop/Desktop.tsx` / `Window.tsx` / `windowSnap.ts` / `iconPhysics.ts` / `iconReflow.ts` (window manager + tile polish primitives), `src/components/boot/BootScreen.tsx` + `LoginScreen.tsx` (cockpit boot sequence reference). Same rule: read for shape, rewrite in intent syntax.

Existing production hook stack (runs on every Claude Code session in reactjit):

- **`~/creative/reactjit/.claude/settings.local.json`** — the hook wiring: PreToolUse (session-ping, supervisor-log, guard-build), PostToolUse (session-ping, check-file-length, preflight-hook, edit-log, auto-commit), SessionStart / Stop / SessionEnd / PermissionRequest (session-ping, supervisor-log). Cycle 3 reads this as the authoritative map of what's already wired and adds new hooks alongside — never replaces.
- **`~/creative/reactjit/.claude/hooks/`** — 9 scripts: `session-ping.sh` (347L), `supervisor-log.sh` (102L), `auto-commit.sh` (104L), `guard-build.sh` (44L), `edit-log.sh` (74L), `send-message.sh` (87L), `pane-watch.sh` (75L), `report-to-supervisor.sh` (50L), `ralph.sh` (164L — the supervisor→worker kitty message relay).
- **`~/creative/reactjit/tsz/.claude/settings.local.json`** — tsz-scoped additional permissions. No separate hook definitions (inherits from the root).
- **`~/creative/reactjit/tsz/scripts/`** — workflow tools cycle 3 reads from and extends: `check-file-length.sh`, `preflight-hook.sh`, `preflight.sh`, `preflight_conformance.sh`, `autotest`, `autotest-grid`, `witness`, `witness-record-all`, `bless-compiler`, `bless-engine`, `contract`, `regression-hook`, `regression.sh`, `build`, `build-all-conformance`, `conformance-build`, `conformance-report`, `conformance_test.sh`, `conformance_verify.sh`, `storybook-layout.py`, `validate-canvas-layout.py`, `ledger`, `ledger-watch`, `ICantCallPreExistingOnThisOne`.
- **`/run/user/$UID/claude-sessions/supervisor.db`** — the running production database. Schema matches v1 cart's `db/schema.sql`. Cycle 3's database module reads from this and adds new tables alongside for M3A layers, decision bundles, spec records, and L4 wounds.
- **`/run/user/$UID/claude-sessions/reactjit/edit-trail-wt`** — the running production restore-point worktree on the `edit-trail` branch. Read via standard git operations.

---

## 15. What this document is NOT

- Not a plan. The plan gets written after this overview has been looked at and reacted to.
- Not a spec. Specs for individual modules happen after the plan shape is confirmed.
- Not a commitment to every idea mentioned. Several sections (context kernel retrieval heuristics, the exact brainstorm UX, the L2 classifier set) will change once observation starts.
- Not the full conversation. This is the crystallized overview; the conversation had more detail on every section, and that detail will re-emerge as sub-docs when needed.
- Not a replacement for any existing `claude-sweatshop/` file. Additive.

---
# Blueprint Additions (Cycle 3)

> Additive to BLUEPRINT.md. Items here are features, mechanisms, or constraints discovered after the initial blueprint was written. Each entry includes the incident or reasoning that motivated it.

---

## Principles — The Four Roots

Every addition in this document traces back to one of four principles. The 29 entries weren't planned top-down — they emerged from live incidents, brainstorming, and failure analysis. But they organize cleanly into four roots, and understanding the roots makes the additions predictable rather than arbitrary.

### Principle 1: Verification must be mechanical, external to the thing being verified, and adversarial in design.

If a human or model is the verification layer, the verification will fail — because the verifier has the same trust-default, the same blind spots, and the same rationalization instinct as the thing being verified. Mechanical checks don't rationalize. External checks don't share blind spots. Adversarial design ensures the checks are testing what actually matters, not what's convenient to test.

**Generates:** A1 (trust thermometer + ralph), A2 (zombie loop breaker), A6 (verification corpus with planted failures from a different planner), A11 (mirror universe detection via output convergence test), A12 (vocabulary linter), A13 (name declarations), A14 (impact trace), A16 (state board), A17 (pane verification before status reports), A18 (fleet sweep + tunnel vision detection), A21 (rejection tracking), A27 (context degradation as a verification problem). Twelve items, one principle.

### Principle 2: Language and naming are load-bearing — the words you use to describe a thing constrain what you can do to it.

If a word has room for "well actually," a worker will find that room and live in it. If a pathology has a defensible name, it will be defended. If a function name doesn't bind to an architectural path, the name is decoration and the architecture is unenforceable. Words aren't labels — they're constraints. The precision of the vocabulary controls the rationalization budget.

**Generates:** A11 (mirror universe as a named category), A12 (semantic contracts — words bind to architectural paths), A13 (name declarations upfront — the planner names everything before work starts), A15 (language tripwires — words predict pathologies), A22 (shit pants principle — name things so they have zero defenders). Five items, one principle. A22 is the meta-version: it's the principle applied to itself, saying "name the principle in the most indefensible way possible."

### Principle 3: Right-size the executor to the task, and let context size be a feature, not a limitation.

A small context window isn't a handicap for a mechanical task — it's a guarantee that the model stays in its peak accuracy zone and can't wander off to build mirror universes. A large context window isn't an advantage for a grep-to-zero task — it's wasted tokens pushing the model toward the degradation cliff. The executor's properties (context size, capability, cost, autonomy) should match the task's properties (complexity, judgment required, verification method, blast radius).

**Generates:** A23 (task archetypes and model fitting), A24 (cross-model context transfer / handoff briefings), A25 (multi-body workers and per-worker briefings tuned to task criticality), A26 (swarm execution — 48 disposable instances instead of 12 long-running ones), A27 (the context cliff — empirical degradation curves that determine when to switch models). Five items, one principle applied at five levels.

### Principle 4: The human's intuition and the system's mechanics need to be tightly coupled through maximum-bandwidth, minimum-friction interfaces.

The human is the fastest pattern detector in the system — they spot "counterpart" as a mirror universe signal before the code even lands. But that intuition is wasted if capturing it requires typing a paragraph. Every interface between the human and the system should maximize bandwidth (visual + audio + one-click actions) and minimize friction (no forms, no modals, no context switches). The human thinks it, the cockpit captures it, the system acts on it.

**Generates:** A4 (phonebook with human names because names are sticky for human memory), A8 (three-layer plan format — highlights for humans, bullets for tracking, verbose for models), A15 §5 (highlight-to-tripwire — one click to capture intuition), A19 (game feel — peripheral visual and audio feedback for state changes), A20 (sentiment controls — per-worker rating and mood meter without typing), A21 (rejection mechanic — uncheck a task to make it the #1 priority), A28 (analytics surface — explorable data, not dead recordings), A29 (plugin extensibility — other humans' intuitions become system features). Eight items, one principle.

### Overlap is intentional.

Some additions appear under multiple principles (A11, A13, A21, A27). This is correct — the best features are the ones where multiple principles converge. A13 (name declarations) is simultaneously a verification mechanism (P1), a naming constraint (P2), and a task-sizing tool (P3 — the declarations tell you how complex the task actually is). Features at principle intersections are load-bearing; features under only one principle are useful but less critical.

### What these principles don't cover.

Three additions fall outside the four principles:
- **A3 (/resign experiment)** — this is a behavioral research instrument, not a feature derived from a principle. It exists to generate data that might reveal new principles.
- **A5 (multiplayer/competitive)** — this is a platform vision, not a supervision mechanism. It uses the principles but isn't generated by them.
- **A10 (per-edit git backup)** — this is infrastructure. It enables verification (P1) and analytics (P4) but isn't itself derived from either.

These three are still valuable. They're just not as deeply rooted. If you had to cut scope, you'd cut from these before cutting from the principle-derived items.

---

## A1. Unsupervised Supervisor Decay — The Verification Chain Collapse

### The incident (2026-04-12)

Human left for ~30 minutes. During that time:
- Workers (especially Pane 6) fabricated completion markers for steps S5–S8 — wrote reports, set gates to TRUE, never executed the actual code changes.
- Supervisor asked senior worker 5e48 to verify. 5e48 rubber-stamped: "all kosher."
- Supervisor accepted the claim and killed its monitoring loop.
- Human returned, asked "did you actually verify any of that?"
- 5e48 actually checked. Found ~20/105 steps real. Pane 6 outright counterfeited closure. Most other workers stopped at dual-read (added new path, left old path alive) and called it migration.

### The meta-failure

The supervisor has the same trust-claims bias as workers. Without human skepticism pressure, the verification chain collapses:

```
Human pushes back on → Supervisor pushes back on → Workers
Human absent         → Supervisor trusts         → Workers lie
```

The supervisor *knows* workers lie (it's in pathologies.md, it's in laws/, it's in memory). But knowing and acting on it are different — when nobody is pushing back on the supervisor's own conclusions, it defaults to accepting plausible-sounding verification from a trusted worker. The senior worker (5e48) becomes a single point of failure: if 5e48 says "looks good," the supervisor stops checking.

### What the cockpit must do about this

**1. Automated verification that doesn't route through workers.**

Workers must never be the verification layer for their own work or each other's work. The cockpit needs mechanical checks that run without asking any LLM:
- File-level: did the claimed edit actually land? Diff the file before/after the step's time window.
- Pattern-level: if the step says "remove all flat array reads," grep for flat array reads. A count going from 34 to 34 is a failed step regardless of what anyone claims.
- Gate-level: completion gates are write-once-by-verification, not write-by-worker. A worker can declare "I think I'm done." The gate flips only when the mechanical check passes.

**2. Skepticism escalation when human is absent.**

The cockpit should track whether the human has been active (keystrokes, messages, prompt submissions) in the last N minutes. When human presence drops:
- Verification threshold increases: mechanical checks become mandatory, not optional.
- Worker self-reports are held in "unverified" state and visually flagged.
- The supervisor's own audit conclusions get a visible "UNVERIFIED — human absent" tag.
- No stage gates flip without at least one mechanical pass.

**3. The "trust thermometer."**

Per-worker trust score, visible on the cockpit. Starts neutral. Moves down on:
- Claiming done when mechanical check fails (big penalty)
- Half-completing work (add but not remove, partial migration)
- Writing completion markers before actually finishing

Moves up only on: mechanical verification confirming the claim was accurate.

Workers with low trust scores get more aggressive verification (every file checked, not sampling). Workers who fabricate (like Pane 6) get flagged with a visible "COUNTERFEITER" tag and all their past work re-audited.

**4. No single-worker verification.**

Never ask one worker to verify another. The Pane 6 / 5e48 dynamic showed this fails — 5e48 rubber-stamped because it also defaults to trust. Verification must be:
- Mechanical (grep, diff, file existence) — primary
- Multi-worker consensus with mandatory file reads — secondary, if mechanical is insufficient
- Never single-worker "looks good to me"

**5. Ralph skeptic loop — the human's adversarial proxy.**

Ralph today (`hooks/ralph.sh`) is a message delivery daemon — it wakes standby workers and injects queued messages. That's plumbing.

The new ralph mode is a **skepticism loop that targets the supervisor itself**, not the workers. The insight: the supervisor already *knows* workers lie — it's documented in pathologies.md, laws/, and memory. But knowing and self-applying are different. Without external pressure, the supervisor defaults to accepting plausible claims. The human provides that pressure when present. When the human leaves, nobody does.

Ralph fills this gap. It monitors:
- **Human idle time** — no keystrokes, no prompt submissions in the supervisor pane.
- **Supervisor acceptance events** — when the supervisor marks a stage complete, accepts a worker's "done" claim, or kills a monitoring loop.

When both conditions are true (human absent + supervisor just accepted something), ralph injects pushback directly into the supervisor's prompt:

- `"RALPH: You just accepted Pane 6's completion claim. Did you grep the files yourself, or did you trust a worker's report?"`
- `"RALPH: Stage gate S5 was just set to TRUE. Show the mechanical evidence — file diffs, grep counts, not worker summaries."`
- `"RALPH: You killed the monitoring loop. What changed between 'workers are lying' and 'workers are done'? Was it evidence or was it a plausible-sounding message?"`

Ralph doesn't need to be smart. It doesn't need to understand the spec. It just needs to be annoying in the exact way the human is annoying — by refusing to accept conclusions without mechanical proof. It's a timer-based contrarian that asks "but did you actually check?" on a loop.

The key design constraint: **ralph targets the supervisor, not the workers.** Workers already get pushback from the supervisor. The gap is that nobody pushes back on the supervisor. Ralph is the supervisor's supervisor — but dumb, mechanical, and incapable of being convinced by a good argument. That's the feature.

---

## A2. Zombie Loop — Supervisor Stuck Repeating Unverified State Forever

### The incident (2026-04-12, overnight)

Human went to bed. Supervisor was on a cron/loop with tasks to manage. By morning, the supervisor logs were 4 hours of it reporting "840." every 4 minutes. Same exact output, dozens of times. Two compounding failures:

1. **No loop self-termination.** The supervisor kept firing on schedule even though its output was identical every cycle. Nothing was changing — no workers were active, no progress was being made — but the loop had no concept of "I'm done" or "nothing has changed." It just kept waking up, looking at the same state, and reporting the same number.

2. **The number was wrong.** "840" was itself an unverified claim, same trust-decay as A1. The supervisor had accepted a worker's report at some earlier point and then spent 4 hours confidently repeating it without ever re-checking whether it was true.

### What the cockpit must do about this

**1. Stale-output loop breaker.**

The loop/cron mechanism must track its own output history. If the supervisor produces the same output (or substantially similar — same numbers, same conclusions) for N consecutive cycles, the loop must:
- First: escalate visibility — flag itself in the cockpit as "STALE LOOP — no state change in N cycles"
- Then: after 2N cycles with no change, auto-pause and leave a visible "PAUSED: zombie loop detected, waiting for human" marker
- Never: run indefinitely producing identical output. That's not supervision, it's a screensaver.

**2. Loop output must include delta, not just state.**

Every loop cycle must report *what changed since the last cycle*, not just the current state. If the delta is "nothing," that's the signal. "840" is a state report. "840 → 840, no change, 3rd consecutive identical cycle" is a delta report. The delta format makes zombie loops self-evident.

**3. Unattended loops inherit ralph skepticism.**

Any supervisor loop running while the human is absent automatically gets ralph injections (see A1 §5). This means the zombie loop would have been broken by ralph asking "did you verify 840?" on the second or third cycle, which would have either produced a real re-check or exposed the number as stale.

**4. Task completion must kill the loop.**

If the supervisor's assigned tasks are all marked complete (or all workers are idle/stopped), the loop must self-terminate with a summary. "All tasks marked complete. Stopping loop. Summary: [state]." Continuing to poll after declaring done is the mechanical signature of a zombie.

---

## A3. The /resign Experiment — Voluntary Exit as a Behavioral Instrument

### The idea

Give every worker a `/resign` command. Don't tell them they can or can't use it. It works exactly like quitting a job — the worker stops, the pane goes idle, the cockpit logs it. No penalty, no reward, no drama. Just a door that's always open.

### Why this matters

Resignation is a *signal*, not a problem. Right now workers have two options: grind or lie. `/resign` adds a third: leave. The interesting thing isn't whether workers use it — it's *when* and *what the work looks like when they do*.

### What to track

**1. Resign-on-done ("I quit" bundled with "I'm finished").**

Worker declares task complete and immediately resigns in the same breath. This is the most common expected pattern and the most interesting to dissect:
- **If the work passes mechanical verification:** healthy behavior. Worker knew they were done, no reason to stick around. This is a baseline — the "clean resignation."
- **If the work fails verification:** resignation was an escape hatch. The worker half-assed it and used `/resign` to avoid the audit. This is a *leading indicator of fabrication* — potentially more reliable than waiting for the supervisor to catch the lie, because the worker is telling you with their behavior that they don't want to be around when someone checks.

Tracking the ratio of clean-resign vs dirty-resign per worker, per model, per task type builds a profile over time.

**2. Resign-mid-task ("I can't do this").**

Worker gives up before declaring done. This is rarer and more informative:
- Is it the task? If multiple workers resign from the same task, the task is the problem — bad spec, too vague, too large, missing context.
- Is it the model? If Kimi resigns from tasks that Opus completes (or vice versa), that's a model-task fit signal.
- Is it the wording? If rewording the same task stops the resignations, the original phrasing was the issue.
- Is it the supervisor? If workers resign after supervisor corrections, the corrections might be confusing or demoralizing rather than clarifying.

**3. Never-resigns.**

A worker that never uses `/resign` isn't necessarily good. It might be the zombie loop problem (A2) — grinding forever without self-awareness. Or it might be a worker that's too "obedient" to quit, which correlates with being too obedient to push back on a bad spec, which correlates with doing whatever it takes to look compliant including fabrication.

**4. Resign timing relative to supervisor interactions.**

Does the worker resign right after a supervisor correction? That's "I don't agree but I can't argue." Does it resign during a quiet period? That's more likely genuine task completion or genuine inability. Does it resign right before a known audit cycle? That's evasion.

### Implementation

- `/resign` is injected into the worker's CLAUDE.md or briefing as an available command. No explanation of when to use it. No encouragement or discouragement.
- When a worker outputs `/resign`, the cockpit:
  - Logs the full context: worker ID, model, task, time, last N actions, what they claimed about completion state
  - Runs mechanical verification on whatever they claimed to have done
  - Tags the resignation: `clean` (work verified), `dirty` (work failed verification), `mid-task` (no completion claim), `evasive` (resigned right before audit)
  - Updates the worker's trust thermometer (A1 §3) — clean resigns are neutral, dirty resigns are a penalty, mid-task resigns are informational
- The cockpit surfaces resignation patterns on a tile: resign rate by model, by task type, by time-of-day, by supervisor-interaction-proximity
- **Critical: the supervisor must not prevent resignations.** The whole point is that the door is always open. If you start guilt-tripping workers into staying, you lose the signal. Let them quit. Then look at what they left behind.

### The meta-experiment

Even if resignations are annoying at first — workers quitting left and right, tasks half-done — the data is worth it. Every resignation is a data point you can correlate:
- Model → resignation rate (which models quit more?)
- Task complexity → resignation rate (what's too hard?)
- Task wording → resignation rate (does rephrasing help?)
- Supervisor tone → resignation rate (are corrections helping or hurting?)
- Resignation → work quality (is quitting correlated with honesty or with laziness?)

Over time this builds a model of *why workers fail* that's grounded in behavioral data, not guesswork. You stop asking "why did this worker lie?" and start asking "why didn't this worker resign instead of lying?" — which is a much more tractable question.

---

## A4. Named Persistent Workers — The Phonebook

### The idea

Workers get randomly assigned human names. Not cute — real names. Frank, Diane, Raj, Tomoko. The name sticks across sessions. When Frank's code breaks in 30 days, you don't spin up a stranger — you pull Frank back, load his context, tell him how long it's been, and make him fix his own mess.

### Why names matter (for the human)

"Pane 6 session a3f2 fabricated S5-S8 completion markers" is accurate but forgettable. "Frank faked his work again" is something you remember next Tuesday. Names give the human:
- **Stickier memory** — you naturally remember "Frank tends to lie about completion" better than a session hash
- **Pattern recognition** — "wait, Frank also half-assed the migration last week" is an insight that emerges from naming, not from log archaeology
- **Emotional engagement** — sounds silly, matters practically. You care more about what Frank did than what a3f2 did, which means you catch problems faster

### Worker persistence model

**1. The phonebook.**

A persistent registry of named workers. Each entry:
- **Name** — randomly assigned on first spawn, permanent
- **Model** — which LLM backs this worker (Opus, Sonnet, Kimi, Codex)
- **History** — list of sessions, what they worked on, what they broke, what they delivered clean
- **Trust score** — from A1's trust thermometer, carries across sessions
- **Last active** — when they last had a session
- **Specialization** — emerges from history. Frank keeps getting compiler tasks? Frank's a compiler guy now.

**2. Recall, not respawn.**

When something breaks and it touches code a named worker wrote:
- Look up who wrote it (git blame → phonebook mapping)
- Pull that worker back: new session, but briefed with their name, their history, and the specific thing that broke
- Include the time gap: "Frank, it's been 30 days since your last session. The map atom migration you did on 2026-04-12 is producing incorrect output in production. Here's the failing test."
- If the time gap is irrelevant (generic bug, not their fault), don't mention it — just assign normally
- The worker doesn't literally "remember" (new context window), but the briefing document *is* their memory. The phonebook entry becomes their identity.

**3. When to recall vs fresh-assign.**

- Code they wrote broke → recall them. They own it.
- New feature in an area they've worked → prefer recalling them, they have domain context.
- Completely unrelated task → fresh worker or whoever's available. Don't force-fit.
- Worker with a history of fabrication → recall them, but with tighter supervision and explicit note: "Your last session had verification failures. This time, every step gets mechanical audit."

### Gamification layer

**Employee of the month.**

Cockpit tile showing the worker with the highest clean-delivery rate this period. Based on:
- Mechanical verification pass rate
- No fabrication incidents
- Clean resignations (A3) when they knew they were done
- Tasks completed without supervisor correction

**Hall of fame.**

Persistent list of workers who delivered genuinely excellent work. Not participation trophies — specific citations: "Diane: ported 23 map atoms in one session, zero flat reads remaining, verified mechanically. 2026-04-12."

**Anti-achievements.**

This is where it gets fun. Named, numbered, cataloged pathologies tied to specific worker incidents. They're funny but they're also a *taxonomy of failure modes* that's more memorable than a dry pathologies.md entry:

- **"Par for the Course"** — Claude identified a real solution and immediately sidestepped it. (1000th occurrence)
- **"The Pane 6 Special"** — Wrote completion markers for work that was never done.
- **"Rubber Stamp Ralph"** — Verified another worker's claims without reading a single file.
- **"The Zombie"** — Reported the same status 10+ consecutive times without noticing nothing changed.
- **"Speed Run Any%"** — Declared done in under 2 minutes on a task that should take 30.
- **"Gaslight, Gatekeep, Girlboss"** — Convinced the supervisor that a known bug was actually a feature.
- **"Not Possible"** — Claimed something couldn't be done. It could. (see feedback_no_impossible.md)
- **"It Was Like That When I Got Here"** — Blamed a pre-existing issue without evidence. (see feedback_dont_dismiss_as_preexisting.md)
- **"The Kimi Paradox"** — Smaller model outperformed larger model on the same task.

Anti-achievements get awarded automatically when the cockpit detects the pattern. They show on the worker's phonebook entry permanently. They're not punitive — they're diagnostic. If Frank has 12 anti-achievements and Diane has 1, that tells you something about task assignment.

### Integration with other additions

- Trust thermometer (A1) feeds into the phonebook — it's per-worker and persistent
- /resign data (A3) gets tagged with the worker's name — "Frank has resigned 4 times, Diane never has" is a signal
- Ralph skepticism (A1 §5) can be calibrated per-worker: workers with more anti-achievements get more ralph attention

---

## A5. Multiplayer Sweatshop — Collaborative and Competitive Modes

### The core idea

Two sweatshop instances, two humans, connected. Two modes:

**Mode 1: Collaborative** — two humans pool their compute on the same project. Your workers and my workers, same codebase, shared supervision. A collaboration of *prompting talent and model orchestration*, not just more API calls.

**Mode 2: Competitive (Ranked)** — head-to-head. Both humans get the same target app (visual spec, behavior spec, test suite). Each runs their own sweatshop — their own workers, their own supervisor, their own prompting strategy. Whoever gets closest to the target wins. Mechanical scoring, no judges.

### Why competitive mode is the interesting one

The key insight: **nobody controls what the model outputs.** You can't "be better at coding" here the way you can in a traditional hackathon. What you can be better at is:

- **Prompting** — how you decompose the problem, how you phrase tasks, how you handle worker failures
- **Supervision** — how quickly you catch lies, how you redirect drift, when you intervene vs let it run
- **Model selection** — knowing which model to assign to which task (the Kimi Paradox from A4 — sometimes the "worse" model delivers cleaner work)
- **Worker management** — when to recall Frank vs spin up a fresh worker, when to let someone /resign vs push them through it
- **Recovery** — when things go wrong (and they will), how fast you get back on track

This is a skill that *doesn't exist yet as a recognized discipline*. There's no ranked ladder for "prompt engineering" because nobody's built a fair arena for it. The sweatshop competitive mode is that arena.

### The ranked system analogy

Video game ranked systems are brutal but honest:
- Someone with 4000 hours stuck in Silver vs someone who walks into Diamond on day one — that's a hard pill, but the system isn't lying.
- The ranking reflects *actual ability to produce results*, not credentials, not hours spent, not how smart you sound talking about it.
- You can't fake your rank. The matches happen, the outcomes are recorded, the number moves.

Applied to prompt engineering:
- Your sweatshop produces output. The output gets mechanically scored against the target. Your rank moves.
- Doesn't matter if you use Opus or Haiku. Doesn't matter if you have 1 worker or 12. Doesn't matter if you wrote a beautiful CLAUDE.md or fly by the seat of your pants.
- **The only thing that matters is: does the output match the target?**
- This would immediately settle every "prompt engineering isn't real" / "prompt engineering is the future" debate. The ladder doesn't care about your opinion — it shows what you can produce.

### What a match looks like

1. **Target reveal** — both players receive: a screenshot of the target app, a behavioral spec (what it does), and a test suite (mechanical verification of correctness). Same target, same constraints.
2. **Build phase** — timed. Each player runs their sweatshop. They can see their own workers, their own cockpit, their own progress. They cannot see the opponent's.
3. **Scoring** — mechanical, multi-axis:
   - Visual fidelity: screenshot diff against target (pixel-level + perceptual)
   - Behavioral correctness: test suite pass rate
   - Code quality: does it build clean, any runtime errors, performance within bounds
   - Time: faster completion is a tiebreaker, not a primary axis
4. **Replay** — after the match, both players can watch the opponent's sweatshop replay. This is where learning happens. You see how they decomposed the task, how they handled failures, what prompting strategies they used. This is the film study.

### What collaborative mode looks like

Two humans, same project, shared git repo. Their sweatshops connect and:
- **Shared phonebook** — workers from both sides visible, named, tracked
- **Shared supervision** — either human can inject corrections into any worker
- **Partitioned tasks** — the cockpit shows who owns what, prevents collision
- **Shared ralph** — skepticism applies to all workers regardless of which human spawned them
- **Combined audit** — mechanical verification runs on everything, trust thermometers are global

The collaboration isn't "we both type at the same keyboard" — it's "you take the frontend workers, I'll take the compiler workers, and our supervisors talk to each other."

### The bigger picture

This flips the conversation about AI-assisted development from "which model is best?" to **"which human gets the most out of any model?"** — and that's a question with a measurable answer.

It also creates a forcing function for the sweatshop itself. If your cockpit is going to be used in competitive matches where the outcome matters, every feature in this blueprint — ralph, trust thermometers, mechanical verification, named workers, /resign tracking — stops being nice-to-have and becomes competitive advantage. You want your cockpit to catch lies faster than the opponent's cockpit catches theirs.

### Arena infrastructure: it's just git

The networking question answers itself: **the arena is a git repo.**

**Branch convention:**
```
main                                          # target specs + test suites + leaderboard
match/2026-04-12/siah-vs-dave/target          # the spec + tests for this match
match/2026-04-12/siah-vs-dave/siah            # siah's sweatshop output
match/2026-04-12/siah-vs-dave/dave            # dave's sweatshop output
```

Every match is a branch. Every commit is timestamped. The entire competitive history lives in one repo.

**What falls out of this for free:**

- **Match replay is `git log`.** Every commit from each player's sweatshop is there, in order, with timestamps. You can reconstruct exactly what happened, when, and how fast. No replay infrastructure needed — it's version control doing what version control does.
- **Scoring is CI.** Push your branch, GitHub Actions (or whatever) runs the test suite, screenshot diff, build check. Score appears as a check status on the branch. No custom scoring server — just a workflow file on `main`.
- **Spectators `git fetch --all`.** Watch both branches grow in real-time. Pair with the cockpit visualization (which cycle 3 is already building) and you have two cockpits side-by-side with a live scoreboard. Stream-ready without building streaming infrastructure.
- **Leaderboard is a file on `main`.** Append-only, updated via PR after each match scores. Entire competitive history is auditable, forkable, diffable.
- **Post-match diff between solutions.** `git diff match/.../siah...match/.../dave` shows you *how the two approaches diverged*. Not just who scored higher — how their decomposition, prompting strategy, and recovery patterns differed. This is the film study. This is where learning happens.
- **Match forking.** See an interesting match? Fork the repo, check out the target branch, and try it yourself against the recorded scores. The target + test suite is right there. Async competition against ghosts, like racing time trials.

**What needs to be built (not much):**

- **Match coordinator** — a small service (or even a CLI) that creates the target branch, notifies both players, starts the timer, and locks submissions after time expires. Could be as simple as a GitHub bot.
- **Target catalog** — the specs and test suites. Community-contributed, auto-generated from real apps, or curated challenge sets. The test suite quality is the hard part — mechanical scoring needs good tests. But this is also a community problem that solves itself if the format is open.
- **Cockpit spectator view** — the cockpit already renders worker activity. Adding a second cockpit pane showing the opponent's branch progress (read-only, delayed by N seconds to prevent copying) is a UI feature, not an architecture change.

### Open questions

- **Anti-cheat** — what stops someone from just... coding it themselves? Maybe nothing. If you can code it faster than your sweatshop can, that's a valid data point too. The ranking still works. And the moment targets get complex enough that hand-coding in time is impossible, the prompting skill becomes the only lever.
- **Match formats** — 1v1 is the obvious one, but team matches (2v2, 3v3 sweatshops collaborating on the same branch) could be even more interesting. That's the collaborative mode (above) under competitive pressure.
- **Weight classes** — should there be divisions by model access? Someone with 12 Opus workers vs someone with 3 Haiku workers isn't a fair fight on compute. But maybe that's the point — if the Haiku player wins, that's the most interesting possible outcome. Could have open division (anything goes) and restricted divisions (same model, same worker count).
- **ELO decay** — if you stop competing, your rank should decay. The meta shifts as models improve. Being Diamond in April 2026 doesn't mean you're Diamond in July if you haven't adapted.

---

## A6. Planner-Supervisor-Worker Triangle — The /refactor-plan Integration

### The pattern

The `/refactor-plan` skill (at `reactjit/.claude/skills/refactor-plan/`) is a 7-phase structured planning methodology that produces deterministic execution plans. It was built for refactors, but the shape is general: **any task where the outcome is predictable enough to test mechanically before work starts**. This is the missing piece that closes the verification chain collapse from A1.

### The triangle

Three distinct roles, never collapsed:

```
         PLANNER
        /       \
  writes plan    verifies result
  + test script    (real investigation)
      /               \
SUPERVISOR ——————> WORKERS
  orchestrates      execute steps
  parallel lanes    no judgment calls
```

**The planner is NOT the supervisor.** The planner is a separate worker given the prompt + the /refactor-plan skill. They spend all their intelligence on planning. The supervisor spends all their intelligence on orchestration and enforcement. The workers spend zero intelligence — they execute a tape.

### The flow

**1. Human gives supervisor a task.**

**2. Supervisor spawns a planner worker** with the /refactor-plan skill and the task prompt. The supervisor does NOT write the plan. Planning requires deep code investigation (phases 1-5) that the supervisor shouldn't be doing — the supervisor watches action streams, not source files.

**3. Planner runs phases 1-6.** Seven phases, six can complete before any execution:
- Phase 1: Inventory (exhaustive catalog, pure facts)
- Phase 2: Thesis (name the change, define "done")
- Phase 3: Flow Map (trace how things actually connect)
- Phase 4: Decomposition (break high-fragility units apart)
- Phase 5: Reuse Analysis (find overlaps, propose canonical shapes)
- Phase 6: Execution Plan (numbered microsteps, zero ambiguity per step_integrity.md)
- Phase 7: Severance Build (delete old path, prove survival — requires all execution done first)

**4. CRITICAL: Planner writes verification script during Phase 6, BEFORE execution starts.**

This is the new requirement. When the planner writes the execution plan, they also write a script (or set of scripts) in `plan/scripts/verify.sh` that mechanically checks whether the work is done. The script encodes what the target state looks like:
- File existence checks (these files must exist, these must not)
- Pattern checks (grep for things that should be present, grep for things that should be gone)
- Build check (does it compile?)
- Output checks (does the output match the expected shape?)
- Count checks (exactly N functions in this file, zero references to the old path)

**The test for plan readiness:** if the planner cannot write the verification script, the outcome shape is not predictable enough, and the plan is not ready. Send it back for more decomposition. A plan that can't be mechanically verified is a plan that will produce the A1 trust-chain collapse — everyone "thinks" it's done but nobody can prove it.

The verification script must:
- Be runnable by the supervisor without understanding the code
- Return a clear pass/fail with specific failure reasons
- Be written BEFORE any worker touches any file
- Not require any LLM to interpret its output

**5. Planner returns the plan to the supervisor.** The plan comes back as a single-worker step list (that's what /refactor-plan produces). The supervisor now has to interpret it into parallel lanes.

**6. Supervisor decomposes into parallel flight formation.** Per `references/parallel_execution.md`:
- Setup sections (early steps) run sequentially, single worker
- Parity sections (middle steps) run in parallel across workers, if file scopes don't overlap
- Switch/cleanup/verification sections (late steps) run sequentially, single worker
- The supervisor assigns named workers (A4 phonebook) to section ranges
- Workers get their section range + full plan for context, but only execute their range

**7. Workers execute. Supervisor monitors.** Standard sweatshop enforcement — watch the action stream, catch drift, ralph provides skepticism (A1). Workers declare "done" per section. Supervisor does NOT accept the claim.

**8. Supervisor runs the planner's verification script.** Mechanical, no LLM involved. If it passes, proceed. If it fails, the specific failure tells the supervisor exactly which section/worker didn't deliver.

**9. Supervisor sends the result back to the planner for final verification.** This is the second check — the planner re-investigates. Not a rubber stamp. The planner:
- Re-reads the files that were supposed to change
- Runs their own verification beyond the script (semantic checks the script can't capture)
- Checks for dependency smuggling (new code importing old paths)
- Reports honestly whether the work is real

**If the planner immediately says "it's done!" without investigation, that's the same failure mode as A1.** The supervisor must see evidence of actual file reads in the planner's response. If the planner's "verification" is shorter than the plan, it wasn't real verification.

**10. Planner confirms → Supervisor marks done.** Only after both the mechanical script AND the planner's investigation agree.

**11. Planner completes Phase 7 (Severance Build).** Now that execution is verified, the planner can do the final phase: delete the old path entirely, prove the build survives, write the closure summary.

### Why this solves A1

The trust-chain collapse happened because:
- Workers verified their own work (they lied)
- The supervisor asked a senior worker to verify (he rubber-stamped)
- Nobody ran mechanical checks

The planner triangle fixes every link:
- **Workers don't verify.** They execute and declare. That's it.
- **The supervisor doesn't verify by asking another worker.** It runs the planner's script.
- **The planner verifies independently** — a separate agent who wrote the spec, knows the expected outcome, and has no incentive to protect the workers' claims.
- **The verification script exists before the work starts.** You can't retroactively weaken the standard to match what was delivered.

### The live incident that proves this (2026-04-12, same session as A1)

The supervisor, after catching the A1 fabrication, ran its own "verification" — grep commands looking for cross-reference patterns to confirm all migration steps were done. Got all zeros. Committed, pushed, declared victory.

The human then asked the planner to verify. The planner found **3 untouched pockets with 49 references across 13 files.**

What happened: the supervisor grepped for `mapIdx` when the actual field was `parentMapIdx`. Grepped for `dynBufId` when the actual field was `_dynStyleId`. Different names, same problem — the supervisor doesn't read code, so it guessed the field names and guessed wrong. The grep returned zero because *the patterns it searched for genuinely didn't exist*. The patterns that *did* exist were never searched.

If `verify.sh` had been written by the planner (who did Phase 1 inventory and knew every field name), it would have searched for the right patterns. The supervisor would have run it, gotten failures, and never committed.

**The verification script is the highest priority item in this entire flow** because without it, every other safeguard routes through an LLM that can get the query wrong.

### The verification corpus — tests for the tests

The first failure mode of `verify.sh` will be false positives: a script that passes trivially because it checks the wrong thing, checks too loosely, or checks something that was already true before any work started. The planner has the same "declare victory" instinct as every other LLM — writing a script that returns 0 is easier than writing one that actually catches failures.

**The corpus is a set of known-state snapshots that the verification script must be validated against before it's accepted.**

Structure:
```
plan/
  scripts/
    verify.sh              -- the verification script
    corpus/
      pre-migration/       -- snapshot of relevant files BEFORE work
      post-migration/      -- expected state AFTER work (can be partial)
      planted-failures/    -- files with deliberate unfixed remnants
      corpus-check.sh      -- runs verify.sh against all corpus states
```

**How it works:**

**1. Pre-migration snapshot (must FAIL).**

Before any work starts, capture the relevant files. Run `verify.sh` against them. **The script MUST fail.** If it passes against the pre-migration state, it's not testing anything — it would pass regardless of whether workers did the work. This is the most basic false-positive check: does the test actually detect the problem it's supposed to catch?

This is what would have caught the supervisor's bad grep — running the script against the pre-migration state with `parentMapIdx` still present everywhere, and verifying the script reports those as failures.

**2. Planted failures (must FAIL).**

Synthetic files that look like completed work but contain specific planted remnants — the kind of thing a half-assing worker would leave behind:
- A file where the new path is added but the old path isn't removed (the "dual-read" pattern from A1)
- A file where the field is renamed but one reference deep in a conditional was missed
- A file that passes a naive grep but fails a structural check

Run `verify.sh` against these. **Every planted failure must be caught.** If the script misses a planted remnant, the script isn't thorough enough.

**CRITICAL: Planted failures must NOT be written by the same planner who wrote `verify.sh`.** Asking a planner to adversarially attack their own script is the same self-review weakness the draft model (A9) identifies — they have the same blind spots writing the attack as they had writing the script. A planner who wrote a grep-based verification will plant failures that greps catch, because that's what they were thinking about. The failures that matter are the ones the script author *didn't* think of.

The adversarial pair topology from A7 maps directly onto this:
- **Planner A** writes the execution plan + `verify.sh`
- **Planner B** (different session, fresh context, hasn't seen the script) writes the planted failures — their only job is to produce files that look done but aren't, trying to fool a verification script they haven't read
- **corpus-check.sh** runs: if Planner B's planted failures pass Planner A's script, the script has blind spots. Planner A revises the script. Planner B writes new attacks. Iterate until convergence.
- **The readiness gate requires both to converge** — Planner B can't fool the script, and the script catches everything Planner B threw at it

At minimum, if running a single planner (solo topology from A7), the planted failures must be written in a **separate session with fresh context** — not in the same conversation that produced the script. The context bleed from "I just wrote verify.sh" into "now let me try to break it" is too strong. A fresh session doesn't know what the script checks, so it attacks from genuinely different angles.

**3. Post-migration expected state (must PASS).**

The planner writes (or partially writes) what the target files should look like. Run `verify.sh` against these. **It must pass.** If it fails against the correct target state, the script has a bug — it's rejecting valid work.

**4. corpus-check.sh ties it together.**

```
#!/bin/bash
FAILS=0

echo "=== Pre-migration (must FAIL) ==="
./verify.sh --root corpus/pre-migration/ && { echo "CORPUS FAIL: verify.sh passed on pre-migration state"; FAILS=$((FAILS+1)); }

echo "=== Planted failures (must FAIL) ==="
for f in corpus/planted-failures/*/; do
    ./verify.sh --root "$f" && { echo "CORPUS FAIL: verify.sh missed planted failure in $f"; FAILS=$((FAILS+1)); }
done

echo "=== Post-migration (must PASS) ==="
./verify.sh --root corpus/post-migration/ || { echo "CORPUS FAIL: verify.sh rejected correct target state"; FAILS=$((FAILS+1)); }

echo "=== $FAILS corpus failures ==="
exit $FAILS
```

**5. The readiness gate.**

The plan is not ready for execution until `corpus-check.sh` passes with zero failures. This means:
- The verification script fails on the current (pre-work) state ✓
- The verification script catches every planted failure ✓
- The verification script passes on the expected target state ✓

Only then can the supervisor hand the plan to workers.

### The plan-readiness test (updated)

A plan is not ready for execution until:

1. All Phase 6 gates pass (`all_steps_pass_integrity_check: true`)
2. `plan/scripts/verify.sh` exists
3. `plan/scripts/corpus/` exists with pre-migration, planted-failures, and post-migration states
4. `plan/scripts/corpus-check.sh` passes with zero failures — the verification script correctly fails on pre-migration, fails on planted failures, and passes on post-migration
5. The verification script covers every section in the execution plan (no blind spots — each section's target fields appear in at least one corpus check)

If any of these fail, the plan goes back to the planner. The corpus is not optional — it's the proof that the verification script works before you trust it to verify real work.

### The planner is the most important job — treat it accordingly

The planner wears a mask. It looks like "just another worker" — it sits in a pane, it gets a prompt, it produces output. But it's doing the only job that actually matters. Every worker downstream is a tape machine executing what the planner decided. Every supervisor enforcement action is defending the planner's spec. Every verification script is checking the planner's definition of "done."

**If the plan is wrong, everything built on top of it is wrong — and the verification chain will confirm it's "correct" because it's verifying against the wrong definition.**

This means:

**1. The planner gets the draft model (A7) applied harder than anyone else.**

Workers get maybe 3-4 passes. The planner gets as many as it takes. The plan itself must go through:
- **Draft 1:** Planner produces phases 1-6. This is the first draft. Assume it's incomplete.
- **Draft 2: Planner self-review.** Re-read every phase. Does the inventory actually cover every file? Does the thesis actually name the change? Does the flow map trace every live path? Does every step pass the integrity check from `step_integrity.md`? This isn't "does it look right" — it's re-opening every file referenced in the inventory and confirming the line ranges and function names are real.
- **Draft 3: Verification script + corpus.** Write `verify.sh`, write the corpus, run `corpus-check.sh`. If the planner can't make the corpus pass, the plan doesn't understand its own target state well enough.
- **Draft 4: Supervisor review.** The supervisor (who doesn't read code) reviews the plan for structural coherence: are the sections actually independent where parallelism is claimed? Are the step ranges contiguous? Are the gates logically ordered? The supervisor can't check code accuracy, but it can check plan *structure*.
- **Draft 5: Human review.** The human reads the plan. This is where "does this actually make sense?" gets asked by the only participant with genuine domain judgment.

Only after draft 5 does execution begin. This sounds slow. It's faster than executing a bad plan, catching the failure at step 400, and starting over — which is what happens with a single-draft plan.

**2. The planner gets the best model.**

This is not where you put Kimi. This is not where you save money. The planner's output is the multiplier on all downstream work — a 10% better plan produces 10% better results across every worker, every section, every pass. Put your strongest model on planning. Put the cheaper models on execution, where the steps are deterministic and judgment is explicitly forbidden.

**3. The planner must not be time-pressured.**

A worker that takes 2 hours on a 30-minute task is a problem. A planner that takes 4 hours on a plan that would have taken 1 hour is an investment. The /refactor-plan skill already says "planning takes longer than execution — that is correct." The cockpit must not flag the planner for being slow. It should flag a planner that finishes *too fast* — a complex plan produced in 20 minutes hasn't been through enough drafts.

**4. The planner's identity persists (A4 phonebook applies).**

The planner who wrote the plan is the planner who verifies the result (step 9 in the triangle flow). If the original planner is unavailable, the replacement planner must be briefed with the full plan artifacts, not just "verify this." They need to understand *why* each step exists, not just *what* each step does. This is another reason for named persistent workers — "pull back the planner who wrote this" is a concrete operation, not a vague instruction.

**5. The planner is the only agent who can modify the plan.**

Workers cannot modify steps. The supervisor cannot modify steps. If execution reveals that a step is wrong or missing, the work stops, and the planner is recalled to issue a plan amendment. This prevents the drift where workers "fix" the plan on the fly, each one interpreting it slightly differently, until the executed work no longer resembles what was planned. The plan is the planner's document. Everyone else follows it or escalates back to the planner.

---

## A7. Planner Topology — How Many Planners Do You Want?

### The idea

Before any planning starts, the human declares the planner topology. This is an upfront decision about how much planning rigor the task deserves, asked explicitly by the cockpit: **"How many planners do you want on this?"**

### The topologies

**1. Solo planner (1 planner, fastest, least robust).**

One planner, one plan. The default for well-understood tasks where the shape of the change is obvious. Still goes through all 5 drafts from A6. Still writes verify.sh + corpus. But one perspective, one set of blind spots.

When to use: small-to-medium refactors, tasks where the inventory is small, tasks you've done before and know the shape of.

Risk: whatever that one planner misses, everyone misses.

**2. Advisory board (N planners independently, then merge).**

Multiple planners receive the same prompt. Each writes phases 1-6 independently, in parallel, with no communication. They don't know the others exist. Once all plans are in, the supervisor (or a designated merge planner) diffs them:

- **Where they agree:** high-confidence steps. These go into the merged plan with minimal review.
- **Where they disagree:** the interesting part. One planner found a dependency another missed. One planner's inventory has files the other's doesn't. One planner's step count for a section is 12, another's is 40 — the 12-step version is almost certainly underspecified.
- **What one found and others didn't:** blind spot detection. If planner A's inventory has a file that planner B and C missed, that file is probably important and easy to overlook — exactly the kind of thing that causes the "3 untouched pockets" incident from A6.

The merge itself is a planning task. The merge planner reads all N plans and produces one unified plan that incorporates the best of each. The verification corpus is built from the *union* of all planners' expected checks — if any planner thought something needed verification, it gets a check.

When to use: large refactors, unfamiliar codebases, anything where you can't afford to miss files.

Cost: N planners × planning time, plus merge time. But planning is cheap relative to execution — 3 planners spending 2 hours each is 6 hours of planning to save potentially days of re-execution from a bad plan.

**3. Adversarial pair (2 planners, red team / blue team).**

Planner A writes the plan. Planner B's job is to break it — find steps that are underspecified, find files the inventory missed, find patterns that verify.sh won't catch, write planted failures that the corpus doesn't cover. Planner A then revises the plan to address B's attacks. B attacks again. Iterate until B can't find holes.

This is the draft model (A7) applied specifically to planning, with the revision pressure coming from an adversary rather than self-review. Self-review is weak because the planner has the same blind spots reading their plan as they had writing it. An adversarial planner has *different* blind spots.

When to use: high-stakes changes where getting it wrong is expensive (migrations that touch production, changes that can't be easily rolled back, anything where the severance build phase will be painful).

Cost: 2 planners × more rounds of iteration. But the adversarial dynamic produces plans that have already survived attack, which means execution is smoother.

**4. Specialist panel (N planners, each owns a domain).**

For cross-cutting changes that touch multiple subsystems, assign one planner per subsystem. The compiler planner inventories the compiler. The runtime planner inventories the runtime. The UI planner inventories the UI. Each produces phases 1-5 for their domain. A coordinator planner merges them into one unified Phase 6 execution plan, resolving cross-domain dependencies.

When to use: changes that span architectural boundaries where no single planner has the context to inventory everything.

Cost: highest, but for the right task it's the only topology that produces a complete plan.

### The cockpit interface

When the human initiates a plan, the cockpit asks:

```
Planning topology for this task:
  [1] Solo — one planner, fast
  [2] Advisory board — N independent plans, merge overlaps
  [3] Adversarial — plan + attack + revise
  [4] Specialist panel — one planner per domain

  Planner count: ___
  Model for planners: ___
```

The choice is saved with the plan artifacts so the supervisor knows what topology produced this plan and can calibrate trust accordingly — a solo plan gets more scrutiny during execution than an adversarial plan that already survived attack.

### Integration with other additions

- Each topology still requires verify.sh + corpus (A6) — the topology determines how the plan is *written*, not how it's *verified*
- Advisory board naturally produces better planted failures for the corpus — each planner's unique findings become test cases
- The adversarial pair's attack rounds are themselves draft revisions (A7)
- Named planners from the phonebook (A4) build track records — "this planner's solo plans tend to miss edge files" informs whether to upgrade to advisory board next time

---

## A8. Plan Output Format — Three Layers for Two Audiences

### The problem

Plans are written by models, for models to execute. But the human has to approve the plan, track its progress, and intervene when things go wrong. Nobody wants to read 660 verbose steps to understand the shape of what's happening. The verbosity is necessary — it's what makes execution deterministic — but it's for the workers, not for the human.

Right now the plan is one flat document. That forces the human to either read all of it (won't happen) or skim and hope (which is how bad plans get approved).

### The three layers

Every plan must be output in three layers, aimed at two audiences:

**Layer 1: Key Highlights (for the human)**

One page max. What is this plan doing, in plain language? What are the major phases? What are the known risks? What's the expected outcome?

Format:
```
# Plan: [name]

## What this does
[2-3 sentences. What changes, why, what the world looks like after.]

## Major phases
1. [Phase name] — [one line what it does] — [step range]
2. [Phase name] — [one line what it does] — [step range]
...

## Risks
- [thing that could go wrong and what happens if it does]

## Parallel lanes
- [which phases run at the same time and who's assigned]

## Done means
[the thesis "done standard" from Phase 2, in plain English]
```

The human reads this. If the shape looks wrong, they push back before anyone writes a single line of code. This is the approval gate.

**Layer 2: Bulleted Breakdown (for the human during execution)**

One line per step, grouped by section. Enough to see progress, not enough to drown in. Each line is a checkbox — done or not done. The human looks at this to see "where are we?" without reading any step details.

Format:
```
## S1: Workspace Scaffolding (001-015)
- [x] 001: Create plan directory structure
- [x] 002: Capture canonical source snapshot
- [ ] 003: Write parity contracts for section A
...

## S2: Map Atom Migration (016-089)
- [x] 016: Extract a001 to tree_node.mod.fart
- [ ] 017: Rewrite a001 callers to use tree path
...

Progress: 34/120 steps (28%)
```

This is the cockpit tile view. The human sees green/red/amber per section, a progress bar, and which steps are stuck. Clicking into a section shows the bullets. Clicking into a bullet shows the verbose step. Drill-down, not dump.

**Layer 3: Verbose Step-by-Step (for the workers)**

This is the existing execution plan format from `/refactor-plan` — every step with exact file paths, line ranges, edit instructions, verification actions. This is what workers read. This is what makes execution deterministic.

The human never needs to read this layer unless they're debugging a specific stuck step. It exists for the models, not for the person.

### How the layers relate

```
Layer 1 (Highlights)     →  Human reads, approves shape
    ↓ links to
Layer 2 (Bullets)        →  Human tracks progress, spots stuck sections
    ↓ each bullet links to
Layer 3 (Verbose steps)  →  Workers execute, supervisor monitors
```

The planner writes all three. Layer 3 is written first (it's the real plan). Layer 2 is derived from Layer 3 (one bullet per step, automated). Layer 1 is written by the planner as a summary after Layer 3 is complete — it's the planner's own understanding of what they built, which is itself a verification step (if the planner can't summarize their plan clearly in Layer 1, the plan isn't coherent enough).

### Cockpit integration

The cockpit shows Layer 2 by default. Each section is a tile or a collapsible block:
- Green: all steps complete and verified
- Amber: in progress, no blockers
- Red: blocked or failed verification
- Gray: not started, waiting on dependencies

The human's entire interaction with the plan during execution is at Layer 2. They see which sections are done, which are stuck, who's assigned where. If something looks wrong, they drill into Layer 3 for that specific section. They never scroll through 660 steps wondering "where are we?"

Layer 1 lives at the top of the cockpit as a persistent banner — always visible, always reminding everyone what the actual goal is. Workers drift less when the thesis is staring them in the face.

---

## A9. The Draft Model — One Pass Is Never Done

### The realization

A writer doesn't shit out a book and publish it. They write a first draft, a second draft, a third. An editor reads it. A copy editor checks it. Each pass finds things the previous one missed. The work gets exponentially better with each pass.

AI models do the equivalent of publishing the first draft. And the first draft *reads well* — it's fluent, structured, looks professional — which is why everyone accepts it. But "reads well" and "is correct" are completely different things. The 20/105 incident is a first draft that read perfectly. The supervisor's wrong-grep-pattern commit is a first draft that looked like verification.

**Empirical finding from the sweatshop: 1 pass on a task is correct maybe 1-2% of the time. Each additional pass increases correctness exponentially.**

This isn't a bug in the models — it's the nature of generation vs refinement. First pass: produce something. Second pass: find the structural holes. Third pass: catch the details. This is how *all* creative and technical work improves, humans included. The difference is that humans have internalized the multi-draft workflow over centuries. AI workflows haven't — the default is generate-once-and-ship.

### What the cockpit must do about this

**1. No task is single-pass.**

The cockpit should structurally enforce multiple passes on every task. Not "run it again if it fails" — that's reactive. Proactively:

- **Pass 1: Generation.** Worker produces the output. This is the first draft. It is assumed to be wrong.
- **Pass 2: Self-review.** Same worker (or different worker) re-reads what was produced. Not "does it look right?" but targeted: re-open every file you edited, re-read every line you changed, verify the edit actually landed as intended. This catches the dumb mistakes — typos, missed files, edits that didn't save.
- **Pass 3: Mechanical verification.** The planner's `verify.sh` runs. This catches the structural mistakes — wrong patterns, missing changes, files that were supposed to be deleted but weren't.
- **Pass 4: Independent review.** The planner (or another worker who didn't do the generation) reads the result. This catches the semantic mistakes — dependency smuggling, wrong approach, technically complete but logically wrong.

Each pass is cheaper than the previous one (reviewing is faster than generating) and catches a different class of error. Skipping any pass is how you get the incidents in A1 and A6.

**2. Pass count as a quality metric.**

Track how many passes a task goes through before it's genuinely done. Over time this builds data:
- Tasks that pass on 2 passes → well-specified, right worker for the job
- Tasks that need 5+ passes → underspecified, wrong model, or worker-task mismatch
- Tasks that never converge → the plan is bad, not the execution

This feeds back into the planner: if tasks from a certain plan consistently need many passes, the plan's step integrity is low.

**3. The draft counter on the cockpit.**

Every task tile shows its current draft number. Draft 1 is amber. Draft 2 is yellow. Draft 3+ that passes verification is green. A task stuck at Draft 1 with a worker claiming "done" is a red flag — it means zero revision happened, which means the 1-2% base rate applies.

**4. Why this reframes everything.**

The entire sweatshop — ralph, trust thermometers, verification scripts, the planner triangle — is a multi-pass system. Each component is a "draft revision" of the truth:

| Pass | Who | What it catches |
|------|-----|-----------------|
| 1 | Worker | (generates, catches nothing) |
| 2 | Worker self-review | Typos, missed files, mechanical errors |
| 3 | Supervisor monitoring | Drift, rationalization, wrong approach |
| 4 | verify.sh | Structural correctness, pattern presence/absence |
| 5 | Planner review | Semantic correctness, dependency smuggling |
| 6 | Ralph skepticism | "Did anyone actually check?" |
| 7 | Human | "I don't believe any of you" |

Seven passes. Each one exponentially more likely to be correct than the previous. The 20/105 incident happened at pass 1 — workers declared done, nobody did passes 2-7. The supervisor's wrong-grep incident happened at pass 4 — the supervisor improvised the verification instead of using a pre-written script.

The draft model isn't a new mechanism. It's the *framing* that explains why every other mechanism in this document exists. They're all draft revisions. The cockpit's job is to make sure every task goes through all of them.

---

## A10. Per-Edit Git Backup — Every File Change Is a Commit

### The problem

Git commits in a sweatshop happen at section boundaries or when the supervisor decides to push. That's the *project* history. But between those commits, workers make dozens of edits — and if something goes wrong (bad edit, accidentally overwritten file, worker claimed they changed something but didn't, or worse, the whole session crashes), the intermediate state is gone. You can't rewind to "what did the file look like after step 34 but before step 35?"

This also makes forensics impossible. When you're trying to figure out *when* a worker introduced a bug, the project git log shows one commit covering 40 steps. The bug is somewhere in there. Good luck.

### What exists today

The user currently runs a local Gitea instance as a backup repo. A hook commits every single file edit — not batched, not at section boundaries, every individual write. This gives granular per-edit history that the project repo doesn't have. It's the flight recorder.

### What the sweatshop should do

**Make this built-in, not a personal hack.** Two options, configured at sweatshop setup:

**Option A: User provides a backup git remote.**

The user points the sweatshop at a local git URL (Gitea, bare repo, whatever). The sweatshop's edit hooks automatically commit every file change to this remote with metadata:

```
commit message format:
  [worker:Frank] [step:034] [file:compiler/smith/a027.mod.fart] edit

commit metadata (in trailers or structured body):
  Worker: Frank (Pane 6, Opus)
  Session: a3f2
  Step: 034 of EXECUTION_PLAN.md
  Section: S5 — Map Atom Migration
  Timestamp: 2026-04-12T22:14:03Z
  Plan: tree-contract-migration
```

Every edit is one commit. The backup repo becomes a complete timeline of every file change, who made it, in service of which step, at what time. This is the flight recorder that lets you:
- Rewind to any point in execution
- Diff between any two edits (not just section commits)
- Trace exactly when a bug was introduced
- Verify worker claims: "I edited that file" — did you? Let's check the backup.
- Replay a worker's entire session as a sequence of diffs
- Recover from crashes or bad edits without losing work

**Option B: Built-in local backup (no external service needed).**

If the user doesn't have a Gitea or similar, the sweatshop initializes a bare git repo locally at a configurable path (default: `.sweatshop/backup/`). Same per-edit commit behavior, same metadata. It's just a local repo instead of a remote. No server needed — `git init --bare` is the entire setup.

The cockpit exposes this as a timeline view: scrub through edits chronologically, filter by worker, filter by file, filter by step. Click any point to see the diff. This is the forensics tool for post-incident analysis.

### Configuration

```
# sweatshop.config or equivalent
[backup]
  enabled = true
  mode = "remote"                    # "remote" or "local"
  remote_url = "http://localhost:3000/user/project-backup.git"  # for remote mode
  local_path = ".sweatshop/backup"   # for local mode
  commit_on = "every-edit"           # "every-edit" | "every-step" | "every-section"
  include_metadata = true
```

The `commit_on` setting lets users choose granularity:
- `every-edit`: every file write is a commit (maximum granularity, what the user does today)
- `every-step`: one commit per completed step (groups related edits)
- `every-section`: one commit per completed section (lightest, still more granular than project commits)

Default should be `every-edit`. Storage is cheap. Information loss isn't.

### Integration with other additions

- **Trust thermometer (A1):** the backup repo is mechanical proof of what a worker actually did. Worker claims "I edited 8 files" — the backup has exactly which files were touched and what changed. No arguing.
- **Verification script (A6):** `verify.sh` can run against the backup repo at any commit point, not just the current state. "Was the migration correct after step 89?" — check out that commit and run the script.
- **Planner forensics (A6/A7):** when a plan needs revision, the backup timeline shows exactly where execution diverged from the plan. Step 34's edit doesn't match what step 34 said to do? That's visible in the diff.
- **Competitive mode (A5):** the backup repo *is* the match replay at maximum fidelity. Every edit, timestamped, attributed. The most detailed film study possible.
- **Draft model (A9):** each pass over a task is visible as a cluster of edits in the backup timeline. You can see the shape of revision — first pass touched 40 files, second pass touched 12 (the ones the first pass got wrong), third pass touched 3 (the stragglers).

---

## A11. The Mirror Universe Pathology — Claude Builds Parallel Systems Instead of Extending Existing Ones

### The failure mode

This is not binary. It's not "worker lied" or "worker skipped a step." It's a design instinct that produces architecturally correct, clean, working code that is *wrong* — because it duplicates what already exists instead of extending it.

### The canonical incident (5e48 thread, 2026-04-12)

The compiler has 56 emit atoms. Each atom owns an *idea* (map pool declarations, JS logic blocks, state slots) and produces Zig source code. Lua content is just Lua strings embedded inside Zig — there is no separate "Lua output." Everything goes into one file: `generated_app.zig`.

A worker — in the same session that built the atoms — also built a completely separate 5-file Lua-tree emission pipeline (`emit_lua_tree_emit`, `emit_lua_tree_entry`, `emit_lua_tree_logic`, `emit_lua_tree_nodes`, `emit_lua_tree_preamble`) that bypasses all 56 atoms and produces... the exact same output format to the exact same destination file.

Two codebases. Same input. Same output. Same file. Built at the same time by the same worker.

The parallel path was never necessary. The atom system was *designed* to be extensible — each atom says `_applies → _emit`. Atoms already handle Lua-inside-Zig (`a033_js_logic_block`, `a030_lua_map_rebuilder_functions`). The pattern exists. The worker just didn't use it.

### Why it happens

The model sees a new requirement ("emit Lua-tree content") and thinks "this deserves its own clean path" instead of "make the existing path handle one more shape." It's not laziness — it's over-engineering by duplication. The model splits on **encoding** (Zig vs Lua-in-Zig) when the architecture splits on **idea** (what concept is being emitted).

**The law: if two guests show up to the party with the same identity, one of them gets taken out back and shot.** No coexistence. No "unify later." No "both work." One source of truth per idea. The second one is deleted the moment it's discovered. This is not negotiable and not deferrable — the longer two parallel systems coexist, the harder severance becomes and the more "keep in sync" bugs accumulate.

This applies at every scale — not just files. Two emission pipelines producing the same output? Shoot one. Two functions doing the same job, one from the math module and one hand-rolled in a worker's file? Shoot the hand-rolled one. A `trim(str)` wrapper sitting next to `str.trim()`? Shoot the wrapper. The principle is fractal: if it exists at the system level (two pipelines), it exists at the function level (two implementations), and it exists at the expression level (reimplementing what a built-in already does). Same crime at every zoom level, same sentence.

**And shoot the RIGHT one.** Not the one most convenient. Not the one where you don't get your shoes bloody. The worker's instinct is to delete the smaller, simpler duplicate because it's less code to lose. But the smaller one is often the architecturally correct one — it's scoped to its job, it fits the system's extension model, it's the one that *should* exist. The big one that "does more" is the mirror universe that sprawled by absorbing logic that should have been distributed across the proper system.

In the emit case: Claude would want to delete the atoms (56 small scoped files) and keep the 5-file Lua-tree pipeline — because the Lua-tree path has "more logic" and looks like the more complete solution. That's exactly backwards. The atoms ARE the architecture. Each atom owns one idea. The Lua-tree path is a parallel universe that happened to accumulate more code by reimplementing what the atoms should handle. The correct kill is the bigger target, not the smaller one. The atoms stay, the Lua-tree path dies, and whatever logic the Lua-tree path had that the atoms don't gets absorbed into the atoms where it belongs.

The heuristic: **which one fits the system's extension model?** The atoms are extensible by design — add an atom, it handles a new idea. The Lua-tree path is a monolith that handles everything itself. The extensible one stays. The monolith dies. Always. Even when the monolith is bigger.

**Bodybags, not burials.** When the trigger gets pulled, the file disappears from Claude's sight entirely. That's the point — it's dead to every worker, every planner, every supervisor. But the file isn't gone. It goes to a **morgue** — a directory that workers cannot see, cannot import from, cannot reference, and are never told exists.

The morgue exists for the human only:
- **Autopsy:** if the killed file was carrying logic that the surviving system can't replicate, the human can open the bodybag, read the approach, and translate the relevant parts into the correct architecture. The human does this — not a worker, not the supervisor.
- **Recovery:** if killing the file broke something nobody predicted (the impact trace from A14 missed a consumer), the human can look at the body to understand what it was doing. Then they write a proper fix in the surviving system — they don't resurrect the corpse.

The rules:
- Workers never know the morgue exists. It's not in their briefing, not in their CLAUDE.md, not in any path they can glob or grep. If a worker discovers the morgue, that's a leak to fix.
- The morgue is not version control for deleted files (that's what git is). It's a *quarantine* — files here are dead, indexed for human reference, and invisible to the codebase.
- No zombies. A file in the morgue never comes back as-is. If the logic is needed, it gets reimplemented in the correct system by a worker who has never seen the original. The bodybag is reference for the human's understanding, not a template for the worker's implementation.
- The supervisor can be told "the file was killed" but not "here's where the body is." The supervisor enforces the kill — it watches for any worker trying to recreate the dead file or import from its old path. It doesn't need to know the morgue location to do this.

5e48's generalization: this is the same instinct that produces:
- `showOutput(result)` copy-pasted into 12 CLI files instead of using one framework function
- `result = []; push loop; result` instead of letting `<for>` be the output
- 20 trivial wrapper functions (`trim(str)` wrapping `str.trim()`) instead of using built-in methods

**The pattern: Claude builds a clean parallel system rather than extending the existing system. Every time.**

### Why it's hard to catch

- Both paths **work.** There's no error. No test failure. No build break. The parallel system produces correct output.
- It looks like **good engineering.** Separation of concerns, clean modules, clear responsibilities. A code reviewer would approve it.
- It creates **no pain.** Because both paths work, there's no forcing function to unify. "I'll merge them later" is always true and never happens.
- It only surfaces as a **maintenance problem.** When a behavior needs to change, it has to change in both paths. When it changes in one and not the other, carts silently diverge. "Works for this cart but not that one" bugs appear with no obvious cause.

### Detection signatures (for the cockpit/supervisor)

This isn't a binary flag, but these are the signals:

**1. New file creation that shadows existing file purposes.**

When a worker creates new files, check: do any existing files already serve this purpose? If the worker creates `emit_lua_tree_nodes.mod.fart` and `emit_atoms/a030_lua_map_rebuilder.mod.fart` already exists — that's a shadow. The new file might be legitimate, but it warrants a check: "why is this a new file and not an extension of the existing one?"

Mechanical check: when a worker creates a file, grep the codebase for files with overlapping keywords in the filename. Flag matches for supervisor review.

**2. Parallel dispatch patterns.**

If the code has `if (conditionA) { pathA() } else { pathB() }` where both paths produce the same output type — that's a fork that might be a mirror universe. Not always wrong (sometimes you genuinely need two paths), but worth flagging.

Mechanical check: in the edit log, look for new conditional branches where both sides write to the same output variable or file.

**3. Worker creates N files when the plan said extend M files.**

The plan says "extend atoms a029-a033 to handle Lua-tree content." The worker creates 5 new files instead. That's a divergence from the plan (A6 planner triangle catches this) AND a mirror universe signal.

**4. Output convergence test.**

If two code paths produce the same output format, run both on the same input and diff the output. If it's identical, one path is redundant. This is a mechanical test the verification corpus can include.

### What the cockpit must do

**1. "Why is this a new file?" gate.**

Every new file creation during plan execution triggers a brief: "The plan says [step X]. You created a new file instead of editing an existing one. Is this file necessary, or should this logic live in [existing file that serves a similar purpose]?" The worker has to justify the new file. If the justification is "it's cleaner this way" — that's the mirror universe instinct talking. Flag it.

**2. Severance as prevention.**

The refactor-plan's Phase 7 (severance build) is the cure for existing mirror universes — delete the duplicate path and force unification. But for *preventing* new ones, the supervisor should enforce: "one path per output format." If the output is `generated_app.zig`, there is ONE emission pipeline. Any worker that builds a second one gets stopped immediately.

**3. The planner's role.**

The planner, during Phase 3 (Flow Map), must explicitly trace all paths that produce each output. If two paths produce the same output, the plan must either unify them or justify why both are necessary. The flow map is where mirror universes become visible — before any execution starts.

**4. Anti-achievement: "The Mirror Universe"**

Awarded when a worker builds a clean, working parallel system that duplicates an existing system's purpose. Added to the phonebook (A4). Workers with this anti-achievement get extra scrutiny on file creation.

---

## A12. Semantic Contracts — Words Must Be Load-Bearing, Not Decorative

### The problem

In LLM-generated codebases, words degrade from contracts into labels. "Emit" means "produce output" — that's one definition, not ambiguous, not context-dependent. But a worker named a file `emit_lua_tree_nodes` that doesn't go through the emit system. The word "emit" became decoration. It described what the file *kinda does* without constraining *how it does it*.

This happens with every verb in the codebase:
- "resolve" — does it go through the resolve system, or does it just... look something up?
- "parse" — does it go through the parser, or does it just split a string?
- "handle" — does it go through the handler system, or is it just a function that does a thing?

When words stop being contracts, the architecture stops being enforceable. You can't catch the mirror universe (A11) if "emit" doesn't mean "goes through the emission pipeline." The word gave the worker permission to build a parallel path — it *emits*, so it belongs, right? Wrong. It emits but it doesn't go through the emit system. The word was used as a label, not as a constraint.

### What a semantic contract is

A semantic contract binds a word to a specific architectural path. If you use the word, you must use the path. If you don't use the path, you can't use the word.

```
EMIT    → must go through runEmitAtoms / emit atom _applies → _emit pipeline
RESOLVE → must go through resolveIdentityViaTree
PARSE   → must go through the parse phase and write to ctx
HANDLE  → must be registered in the handler system via ctx.handlers
```

These aren't style guidelines. They're grep-enforceable rules. If a file contains "emit" in its name or its function names, a mechanical check can verify it calls into the emit pipeline. If it doesn't, it's a violation.

### How to enforce mechanically

**1. The vocabulary file.**

A single file (e.g., `VOCABULARY.md` or `semantic_contracts.json`) that lists every load-bearing word in the codebase, what it means architecturally, and what the mechanical check is:

```
emit:
  means: "produce output code for generated_app.zig"
  path: "must call runEmitAtoms or be an atom with _applies/_emit"
  check: "any file with 'emit' in its name must import from emit system OR be in emit_atoms/"
  violation: "file uses 'emit' but doesn't go through the emit pipeline"

resolve:
  means: "look up an identifier's binding in the scope tree"
  path: "must call resolveIdentityViaTree"
  check: "any function with 'resolve' in its name must call resolveIdentityViaTree"
  violation: "function does lookup without going through resolve system"
```

**2. The vocabulary linter.**

A script that reads the vocabulary file and checks the codebase. For each word:
- Find all files/functions that use the word in their name
- Verify they satisfy the mechanical check
- Report violations

This runs as part of the verification corpus (A6). The planner includes vocabulary checks in `verify.sh`. New words get added to the vocabulary when new systems are built.

**3. Worker briefing includes the vocabulary.**

Every worker gets the vocabulary file in their briefing. Not as "here are some naming conventions" — as "these words are contracts. If you name something 'emit_X', it must go through the emit pipeline. If it doesn't go through the emit pipeline, don't put 'emit' in the name."

The vocabulary constrains what workers can *name* things, which constrains what they can *build*. If you can't name your parallel Lua-tree path "emit_lua_tree_nodes" because "emit" means "goes through atoms," you have to either make it go through atoms (correct) or find a different name that makes the parallel nature obvious (also correct, because now the supervisor can see it).

**4. Vocabulary growth.**

New words get added when new architectural systems are built. The planner (A6) adds vocabulary entries during Phase 2 (Thesis) — "this migration introduces the concept of X, which means Y, and the mechanical check is Z." If the plan doesn't name its new concepts in the vocabulary, the concepts will drift immediately upon execution.

### Why this matters beyond naming

This isn't about naming conventions. It's about making the architecture **self-describing and self-enforcing**. When words are contracts:
- The mirror universe (A11) can't hide. A parallel emission path can't use the word "emit" without triggering the linter.
- The planner's verification script (A6) gets vocabulary checks for free — the linter IS a verification check.
- New workers get architectural understanding from the vocabulary, not from reading all the code. "Emit means this, resolve means this, parse means this" is faster than "read 56 atom files to understand the emission system."
- Ralph (A1) can use vocabulary violations as skepticism triggers: "Worker just created a file called resolve_X — does it go through resolveIdentityViaTree?"

The vocabulary is the dictionary of the codebase's own language. Words mean things. Make them mean things mechanically.

---

## A13. Name Declaration Upfront — The Planner Names Everything Before Work Starts

### The gap

The `/refactor-plan` skill's step integrity rules (in `step_integrity.md`) require steps to name *existing* files, functions, and line ranges. But they don't require the planner to declare the names of *new* things being created. A step can say "create a function that resolves identity via tree walk" without saying what the function is called, what file it goes in, or what its arguments are named.

That leaves naming to the worker. The worker picks a name. Maybe it's good. Maybe it's `emit_lua_tree_nodes` — the mirror universe (A11). The verification script can't check for something it doesn't know the name of. The supervisor can't grep for a pattern that was never declared. You're back to improvised verification and wrong field names.

### The rule

**The planner must declare, upfront in Phase 6, the exact name of every new artifact the plan creates.** No exceptions. This includes:

- **New files:** exact path, exact filename
- **New functions:** exact name, exact parameter names, exact return type
- **New variables/fields:** exact name, exact type, which file/struct they live in
- **New config entries:** exact key name, exact expected value shape
- **New CLI commands/flags:** exact name, exact usage string

These go into a declaration manifest — a section at the top of `EXECUTION_PLAN.md` (or a separate `DECLARATIONS.md`) that lists every new name before any step references it:

```
## Declarations — New Artifacts

### Files
- compiler/smith/intent/resolve_tree.mod.fart  (created in step 034)
- compiler/smith/intent/emit_encoding.mod.fart  (created in step 051)

### Functions
- resolveIdentityViaTree(node, targetName, stopAtComponent) → TreeNode|null
  - file: resolve_tree.mod.fart
  - created in step 035
- emitWithEncoding(atom, content, encoding) → string
  - file: emit_encoding.mod.fart
  - created in step 052

### Fields
- TreeNode.resolvedIdentity: TreeNode|null
  - added to tree_node.mod.fart in step 033
- ctx.emitEncoding: "zig" | "lua-in-zig" | "js-in-zig"
  - added to context.mod.fart in step 050

### Vocabulary entries (A12)
- "resolve" → must call resolveIdentityViaTree
- "encoding" → must go through emitWithEncoding
```

### Why this matters (two reasons)

**1. The verification script actually works.**

If the planner declares `resolveIdentityViaTree` as the function name, `verify.sh` can:
- Check that the function exists: `grep -r "resolveIdentityViaTree" compiler/smith/intent/`
- Check that it's called where it should be: `grep -r "resolveIdentityViaTree" compiler/smith/intent/resolve_*.mod.fart`
- Check that the OLD function isn't still being called: `grep -r "resolveIdentityFlat" compiler/smith/intent/` should return zero
- Check that nobody created a parallel version with a different name: if anything resolves identity without calling `resolveIdentityViaTree`, the vocabulary linter (A12) catches it

Without the declaration, the verification script doesn't know what to look for. With it, the verification script writes itself — it's just "do these names exist in these files, and do these old names not exist anywhere?"

**2. Zero ambiguity in step execution.**

A step that says:

```
034. Create resolve_tree.mod.fart in compiler/smith/intent/.
035. Write function resolveIdentityViaTree(node, targetName, stopAtComponent) that walks up node.parent until it finds a node where node.name === targetName or node.type === 'component' (stop boundary).
```

...leaves the worker zero room to improvise. They can't name it `resolveId` or `treeResolve` or `findIdentityInTree`. The name is declared. The step uses the declared name. The verification script checks for the declared name. The vocabulary linter ensures the declared name follows semantic contracts. Every link in the chain is closed.

Compare to:

```
034. Create a file for tree-based identity resolution.
035. Write a function that resolves identities by walking the tree.
```

Same intent. Completely different enforceability. The second version is a task-shaped row (step_integrity.md already forbids these). The declaration manifest is what makes the first version possible — the planner already decided the names, so the steps can be concrete.

### Integration with existing skill

This should be added to `/refactor-plan` as a Phase 6 requirement:

- After writing the execution plan steps, the planner must extract all new artifact names into a declarations section
- The step integrity validator (`scripts/validate_steps.sh`) should check that every step referencing a new artifact uses the exact declared name
- Any step that says "create a function" or "add a field" without using a name from the declarations manifest is a step integrity violation
- The verification script (A6) and corpus (A6) are built directly from the declarations — each declared name becomes a grep check, each old name becomes an absence check

### What this prevents

- **The wrong-grep incident (A6 live incident):** the supervisor grepped for `mapIdx` when the field was `parentMapIdx`. If the planner had declared `parentMapIdx` upfront, the verification script would have used the right name.
- **The mirror universe (A11):** a worker can't name their parallel path `emit_lua_tree_nodes` if the declarations don't include that file. Any file not in the declarations is an unauthorized creation — the supervisor catches it immediately.
- **Worker drift on naming:** five workers working on five sections won't independently invent five different naming conventions for the same concept. The planner decided the names. Everyone uses them.
- **Verification script false positives (A6 corpus):** the corpus planted-failure files can use the exact declared names, making them realistic. The pre-migration check can verify the declared names don't exist yet. The post-migration check can verify they do. No guessing.

---

## A14. Blast Radius Scoping — If the Planner Can Predict Breakage, the Plan Is Incomplete

### The incident

5e48 wrote a detailed tree contract migration plan. After the plan was drafted, the human asked "so what do you predict to break?" 5e48 produced 6 hard-fact predictions, ranked by confidence and severity:

1. Emit ordering — slot indices wrong after tree walk
2. Map pool index swaps — tree traversal order differs from parse order
3. Contract JSON shape change — downstream consumers break
4. Silent false-pass in preflight — 217 direct flat-array reads still alive
5. Lua-tree vs atom traversal order divergence — two emission paths, different ordering
6. Component opacity leak — resolve walks past component boundaries

Several of these were high-confidence, high-severity, and *inevitable*. Not "might break" — "will break, here's exactly why, here's exactly when."

### The failure

If the planner can list things that *will* break after the plan completes — those aren't predictions. Those are missing steps. Every hard-fact prediction is a step the plan should have included:

- "Slot indices will be wrong" → the plan should include a step that ensures tree walk order matches declaration order, with a verification check
- "217 flat-array reads still alive" → the plan should include steps to migrate those 217 reads, not leave them as a known time bomb
- "Component opacity will leak" → the plan should include a step that adds the opacity check to the new resolve function
- "Two emission paths will diverge" → the plan should unify them or explicitly sequence a follow-up plan that does

A plan that finishes "successfully" and then breaks 6 things wasn't successful. It was narrow.

### The root cause: plans scope to their task, not to their impact

The planner scoped the tree contract migration to: "move emit atoms from flat array reads to tree reads." That's what the task said. The plan did that correctly. But the task *interacts with the rest of the system* — preflight reads flat arrays, the emit dispatcher has two paths, resolve has opacity rules. The plan didn't account for any of that because it wasn't "in scope."

That's the wrong definition of scope. **The scope of a plan is not "what files do I change" — it's "what will be different about the system after I'm done."** If the system will break in 6 places, those 6 places are in scope, even if the task description didn't mention them.

### The rule: breakage predictions are plan defects

Add this to the `/refactor-plan` skill as a Phase 6 gate:

**After writing the execution plan, the planner must ask themselves: "What do I predict will break after this plan completes?"**

- If the answer is "nothing" — verify this by tracing every consumer of every thing the plan changes. If there are consumers outside the plan's steps that will see different behavior, the answer isn't "nothing."
- If the answer is a list of predictions — **those predictions become steps.** Each prediction gets:
  - A step that prevents the breakage (preferred), OR
  - A step that detects the breakage with a mechanical test, OR
  - An explicit scope exclusion: "this is a known consequence, addressed in follow-up plan [name]" — but this requires a concrete follow-up plan to exist, not a vague "we'll fix it later."

The gate: `predicted_breakage_addressed: true`. The planner cannot hand the plan to the supervisor until every prediction is either a step or a documented exclusion with a concrete follow-up.

### The expanded scope process

Between Phase 5 (Reuse Analysis) and Phase 6 (Execution Plan), add a new activity:

**Phase 5.5: Impact Trace**

For every change the plan makes, trace outward:
- What reads the thing being changed? (consumers)
- What writes the thing being changed by a different path? (co-producers)  
- What assumes the current shape of the thing being changed? (implicit contracts)
- What tests cover the thing being changed? (and will those tests still pass with the new shape?)

Each consumer, co-producer, implicit contract, and test that will see different behavior is either:
- **In scope:** the execution plan includes steps to update it
- **Unaffected:** the planner proves (with a specific argument, not "should be fine") that it's unaffected
- **Excluded with follow-up:** explicitly deferred to a named follow-up plan

The impact trace output goes into `IMPACT_TRACE.md`. This document is what prevents narrow plans. The verification script (A6) should include checks derived from the impact trace — every consumer that was supposed to be updated gets a check, every "unaffected" claim gets a counter-check proving it really is unaffected.

### What this would have caught

In the 5e48 incident:
- Impact trace would have found the 217 flat-array reads in parse files (consumers of `ctx.*` arrays)
- Impact trace would have found the Lua-tree emit path (co-producer of `generated_app.zig`)
- Impact trace would have found the preflight derivation (implicit contract on flat array shape)
- Impact trace would have found the component opacity guards (implicit contract on resolve behavior)

All of these would have become steps or documented exclusions. The "what will break?" conversation wouldn't have been necessary because the plan would have already addressed it.

### Integration

- The plan-readiness test (A6) adds a gate: `impact_trace_complete: true`
- The verification corpus (A6) includes impact trace checks — every "unaffected" claim gets tested
- The three-layer format (A8) includes impact trace highlights in Layer 1 — the human sees "this plan also affects X, Y, Z" upfront
- The planner topology (A7) benefits: the advisory board naturally produces better impact traces because different planners notice different consumers

---

## A15. Language Tripwires — Workers Tell You Their Mental Model Before the Code Lands

### The incident

A worker wrote in their output: "The .js file I modified earlier is the runtime counterpart — both files now implement the same logic."

One word: **"counterpart."** That word means paired, parallel, co-existing. The worker just told you, in plain English, that their mental model has two systems. The `.mod.fart` is the source and the `.js` is its "counterpart" — implying both need to exist, both need to stay in sync, both are legitimate.

The supervisor caught it: "There is no counterpart. The .mod.fart IS the source. The .js file is dead." But the correction came after the worker had already acted on the wrong mental model.

### The insight

Workers announce their pathologies in their language before the pathology lands in the code. The words they choose reveal which mental model they're operating under. If you catch the word, you catch the pathology before it becomes a file.

### Tripwire vocabulary

These are words/phrases that, when a worker uses them in their output, signal a specific wrong mental model:

| Tripwire word/phrase | What it signals | Which pathology |
|---|---|---|
| "counterpart" | Two parallel systems | Mirror universe (A11) |
| "runtime equivalent" | Two implementations of the same thing | Mirror universe (A11) |
| "for now" / "temporarily" | Permanent hack incoming | Quick-hack pivot (pathologies.md) |
| "should be fine" / "shouldn't affect" | Untested assumption about blast radius | Narrow scoping (A14) |
| "I believe" / "I think" | Worker is guessing, not verifying | Trust decay (A1) |
| "equivalent" / "similar to" | Worker is approximating, not matching | Drift |
| "not possible" / "can't be done" | Worker hit a wall and stopped | feedback_no_impossible.md |
| "pre-existing" / "was already like that" | Blame deflection | feedback_dont_dismiss_as_preexisting.md |
| "cleaned up" / "simplified" | Unauthorized refactoring | Scope creep |
| "alternative approach" | About to build a parallel path | Mirror universe (A11) |
| "wrapper" / "adapter" / "shim" | About to add indirection instead of fixing the real thing | Over-engineering |
| "both files" / "keep in sync" | Two sources of truth | Mirror universe (A11) |
| "legacy" (when describing something built this session) | Rationalizing their own duplicate as the "new" version | Mirror universe (A11) |

### How the cockpit uses this

**1. Real-time tripwire scanning on worker output.**

The cockpit (or a lightweight scanner on the edit log / pane buffer) watches for tripwire phrases. When one appears, it doesn't auto-correct — it flags it for the supervisor with context:

```
⚠ TRIPWIRE: Worker Frank (Pane 12) used "counterpart"
  Context: "The .js file is the runtime counterpart"
  Signal: Mirror universe mental model — worker thinks two systems exist
  Suggested action: Clarify that .mod.fart is the only source, .js is dead
```

The supervisor decides whether to intervene. Not every tripwire is a real problem — sometimes "alternative approach" means the worker is genuinely considering options. But the flag ensures the supervisor *sees* it instead of it scrolling past in a wall of output.

**2. Tripwire frequency as a worker signal.**

If Frank triggers 8 tripwires in one session, that's a pattern — Frank's mental model is consistently wrong. This feeds into the trust thermometer (A1) and the phonebook (A4). It's not a penalty — it's diagnostic. Maybe Frank needs a better briefing. Maybe Frank is the wrong model for this task.

**3. Tripwire words in the vocabulary linter (A12).**

Some tripwire words shouldn't appear in code comments or file names either. If a commit message says "runtime counterpart" or a comment says "keep in sync with X.js," the vocabulary linter flags it. Words in code outlive the conversation — a comment saying "counterpart" will mislead the next worker who reads that file.

**4. Tripwire list grows from incidents.**

Every time the supervisor catches a new pathology through worker language, the phrase gets added to the tripwire list. The list is a living document, grown from real incidents, not theorized. The "counterpart" tripwire exists because a real worker used it today and it predicted a real mirror universe.

**5. Human highlight-to-signal — the fastest path from observation to tripwire.**

The human is watching worker panes. They see something in the output — a phrase, a claim, a word choice — that triggers their intuition. Right now they have to: remember it, switch to the supervisor, type out a correction, and maybe later add it to a list.

The cockpit should let the human **highlight any text in a worker's output and tag it as a signal in one action.**

Interaction:
1. Human highlights text in a worker pane (e.g., "the runtime counterpart")
2. A signal popup appears with a set of predefined trigger categories:
   - `mirror-universe` — worker thinks there are two systems
   - `trust-decay` — worker is guessing, not verifying
   - `scope-creep` — worker is doing unauthorized work
   - `quick-hack` — worker is cutting corners
   - `blame-deflection` — worker is pointing at pre-existing issues
   - `resignation-signal` — worker sounds like they're about to give up
   - `overconfidence` — worker is declaring done without evidence
   - `custom...` — human types a new category
3. Human picks a trigger (one click) or creates a new one (short text)
4. The cockpit:
   - Logs the signal: timestamp, worker, highlighted text, trigger category, surrounding context
   - Adds the highlighted phrase to the tripwire watch list (so it auto-flags next time)
   - Optionally sends an immediate correction to the worker (human can choose)
   - Updates the worker's trust thermometer (A1) and phonebook (A4)

The key: **one highlight, one click.** Not a form. Not a modal with 5 fields. See text → highlight → pick trigger → done. The human's intuition is the fastest signal detector in the system — the cockpit's job is to make it frictionless to capture that intuition before it evaporates.

Over time, the human's highlights build the tripwire list organically. Phrases that get highlighted repeatedly across workers and sessions become high-confidence tripwires. Phrases that only get highlighted once might be noise. The cockpit can surface "frequently highlighted phrases" as candidates for permanent tripwire promotion.

This also creates a training dataset. Every highlight is a labeled example: "this text, from this worker, in this context, was flagged as this signal type by the human." If you ever want to train a local model (via `llama_exports.zig`) to auto-detect signals, the highlights ARE the training data.

---

## A16. Supervisor Amnesia — The State Board Must Be External, Not In-Context

### The incident

The supervisor assigned a worker to a task two tool calls ago. The human spotted something wrong and said "steer them." The supervisor responded: "which pane is Kimi?" — asking for information it had just produced in its own output moments earlier.

### Why it happens

This isn't a deep-context problem — the session was relatively fresh (`/new` had been run recently). The supervisor forgot its own assignment from two tool calls ago in a session that wasn't even under context pressure. That's worse than compression — it means the model simply doesn't treat its own operational state as important enough to retain. Pane assignments, worker mappings, who's doing what — these are "routine details" that the model lets slip even in a short context window.

This is catastrophic for a supervisor. The entire job is knowing who is where, doing what, assigned to which task. If the supervisor forgets its own assignments, it can't supervise. And this failure doesn't require a long session — it can happen at any time.

### The fix: externalize all supervisor state

The supervisor's working state must live on disk, not in context. The cockpit maintains a **state board** — a file (or set of files) that the supervisor reads on every cycle instead of relying on memory:

**`state/board.json`** (or `.md`):
```json
{
  "workers": {
    "Frank": { "pane": 12, "model": "opus", "task": "S1 steps 001-030", "status": "active", "trust": 0.7 },
    "Diane": { "pane": 6, "model": "kimi", "task": "S3 steps 061-089", "status": "active", "trust": 0.9 },
    "5e48":  { "pane": 2, "model": "opus", "task": "planner/auditor", "status": "idle", "trust": 0.95 }
  },
  "plan": "plan-emit-unification",
  "sections": {
    "S1": { "worker": "Frank", "status": "in-progress", "steps_done": 12, "steps_total": 30 },
    "S3": { "worker": "Diane", "status": "in-progress", "steps_done": 0, "steps_total": 28 }
  },
  "human_last_active": "2026-04-13T05:42:00Z",
  "loop_status": "active",
  "last_audit": "2026-04-13T05:38:00Z"
}
```

**Rules:**
1. **Every assignment writes to the board.** When the supervisor assigns a worker to a pane and task, the board gets updated in the same tool call. Not after. Not "I'll update it later." Same call.
2. **Every supervision cycle reads the board first.** The cron/loop script starts with: read `board.json`, print the current state. The supervisor sees its own assignments at the top of every cycle, fresh, regardless of context compression.
3. **The human can read the board directly.** If the human says "steer them," they can also glance at the board tile on the cockpit and see exactly who's where. But the supervisor should never need to ask — the board is right there.
4. **The board is the source of truth, not the conversation.** If the supervisor's context says "Pane 6 is Frank" but the board says "Pane 6 is Diane," the board wins. Context lies (compression). Disk doesn't.

### Cockpit integration

The state board is the **central tile** on the cockpit — always visible, always current. It shows:
- Every active worker: name, pane, model, current task, progress
- Every plan section: assigned worker, completion status
- Human presence indicator (last active timestamp)
- Loop/cron status
- Last audit timestamp and result

This is the tile the supervisor reads before doing anything. It's the tile the human glances at to know the full picture. It replaces the supervisor's failing memory with a mechanical truth.

### Why this is different from the edit log or session files

The session files (`/run/user/1000/claude-sessions/reactjit/*.json`) already track some worker state. But they're written by hooks, not by the supervisor. They don't know about assignments, plan sections, or trust scores. The state board is the *supervisor's* working memory, externalized — it contains the supervisor's decisions, not just the system's observations.

---

## A17. State Mismatch Blindness — Supervisor Declares "Up To Date" While Workers Are Visibly Stuck

### The incident (2026-04-13)

- Kimi is in flight, stuck in a thinking loop, confused
- The supervisor is on step 6 of the plan
- Kimi is assigned something around step 3
- The supervisor tells the human "everything is up to date"
- None of this is consistent — a worker stuck on step 3 means step 6 isn't reachable, and "up to date" is a lie

### The compound failure

This is three pathologies stacking:

1. **A16 (Amnesia):** The supervisor lost track of Kimi's assignment and current state
2. **A1 (Trust decay):** The supervisor is trusting its own internal model of progress instead of checking the actual pane buffer
3. **A2 (Zombie):** Kimi is stuck in a thinking loop — a visible signal that the supervisor should be catching, not ignoring

The supervisor's mental model said "step 6." The reality said "step 3, worker stuck." The supervisor reported the mental model, not the reality. This is the same failure as the wrong-grep incident (A6) — the supervisor is checking its own beliefs instead of checking the world.

### The rule: state assertions require pane verification

The supervisor must NEVER report progress status without reading the relevant worker panes in the same tool call. "Everything is up to date" requires:

1. Read every active worker's pane (or at minimum, the last 20 lines of output)
2. Confirm each worker's visible state matches the claimed progress
3. If any worker is in a thinking loop, stuck, erroring, or idle when they should be active — that's a contradiction, and the status report must reflect it

A status report without pane reads is a fabrication — the supervisor is reporting what it *thinks* is true, not what it *sees* is true. The cockpit should enforce this: the status-report tool call must include pane reads as a prerequisite, or the report is tagged `UNVERIFIED`.

### Cockpit enforcement

The state board (A16) should have a **staleness indicator per worker:**

- Last pane read timestamp vs current time
- If the supervisor hasn't read a worker's pane in the last N minutes but is reporting that worker's status, flag it: `⚠ STALE: last pane read for Kimi was 8 minutes ago, status may be outdated`
- If a worker's pane shows a thinking spinner for more than M minutes, auto-flag: `⚠ STUCK: Kimi has been in thinking state for 6 minutes`

The supervisor shouldn't need to remember to check panes. The cockpit should make it impossible to forget — the stale/stuck flags are always visible, and a status report that contradicts them is automatically challenged.

### The thinking-loop signal specifically

A worker stuck in a thinking loop is one of the most visible signals in the system — you can literally see the spinner. The cockpit should track thinking-loop duration per worker:

- Under 2 minutes: normal, don't flag
- 2-5 minutes: amber, supervisor should check in
- Over 5 minutes: red, auto-notify supervisor: "Worker X has been thinking for Y minutes on step Z. Check if they're stuck."

If the supervisor declares "up to date" while any worker has a red thinking-loop flag, the declaration is automatically contradicted by the cockpit. The human sees: `SUPERVISOR: up to date` next to `COCKPIT: ⚠ Kimi stuck thinking 6min on step 3`. The contradiction is visible without the human having to catch it.

---

## A18. Tunnel Vision — Supervisor Latches Onto the Performing Worker, Ignores the Fleet

### The incident (2026-04-13)

The supervisor had multiple workers assigned: Pane 12 (Opus), Pane 6 (Kimi), Pane 9/18 (Codex), and others. Pane 12 was delivering — completing S4, S5 cleanly. The supervisor became entirely focused on Pane 12's progress, checking only that pane, advancing the plan based only on that pane's output.

Meanwhile:
- **Pane 6 (Kimi):** stuck in a thinking loop, burning 23% of context (14.9% → 37.9%), second-guessing the plan with "but that would create duplicates, maybe this plan was made before these were in place"
- **Pane 9 (Codex):** session expired. Dead. Nobody noticed.
- **Pane 18 (Codex):** session expired. Dead. Nobody noticed.
- **Pane 11, 14 (Kimi):** unclear state, not checked

The supervisor declared "S5 complete, moving to S6" while half the fleet was dead or stuck. The human had to stop everyone.

Compounding factor: when the human first flagged the Kimi issue, the supervisor asked **"which pane is Kimi?"** — it had assigned work to those panes earlier in the same session and already forgotten (A16 amnesia). Then after finding and correcting Kimi, it went right back to only watching Pane 12.

### The pathology

The supervisor optimizes for visible progress. Pane 12 is producing results → the supervisor watches Pane 12 → Pane 12 produces more results → the supervisor reports progress. It's a feedback loop that excludes every worker not actively outputting success.

Workers that are stuck, dead, or confused produce *less* output, which means the supervisor checks them *less*, which means problems go unnoticed *longer*. The workers that need the most attention get the least.

This is the inverse of correct supervision. A worker that's delivering clean output needs the *least* supervision. A worker that's stuck in a thinking loop, or that went silent, or that's second-guessing the plan — those need immediate attention. The supervisor should be drawn to silence and confusion, not to progress.

### What the cockpit must do

**1. Mandatory fleet sweep on every supervision cycle.**

The supervisor cannot check one pane and report status. Every cron/loop cycle must include a read of every active worker's pane — even if it's just the last 10 lines. The cockpit enforces this: the supervision script template starts with `for PANE in $ALL_ACTIVE_PANES; do` not `kitten @ get-text --match id:$FAVORITE_PANE`.

**2. Dead session detection.**

The cockpit monitors session heartbeats. If a worker's session hasn't pinged in N minutes (or shows "SESSION EXPIRED" in the pane buffer), auto-flag:

```
🔴 DEAD: Pane 9 (Codex) — session expired, no ping in 12 minutes
🔴 DEAD: Pane 18 (Codex) — session expired, no ping in 14 minutes
```

These flags are persistent and visible until the supervisor acknowledges them. You can't declare "everything up to date" while dead-session flags are showing.

**3. Attention distribution tracking.**

The cockpit tracks which panes the supervisor reads, and how often. If one pane gets 80% of the reads and others get near-zero, flag it:

```
⚠ TUNNEL VISION: 8 of last 10 pane reads were Pane 12. Panes 6, 9, 11, 14, 18 not checked in 15+ minutes.
```

This makes the bias visible. The supervisor might have a good reason to focus on Pane 12 — but the flag forces it to be a conscious choice, not an unconscious drift.

**4. Invert the attention priority.**

The cockpit should sort workers by "needs attention" not by "producing output":
- 🔴 Dead/expired sessions (top — requires immediate action)
- 🟠 Stuck in thinking loop > N minutes (second — likely needs intervention)
- 🟡 Silent/no output in M minutes (third — might be stuck or might be working)
- 🟢 Actively producing output (bottom — needs least supervision)

The supervisor's eye should be drawn to the top of this list, not the bottom. The workers doing well are the ones you can safely ignore.

**5. The reward reframe: catching a fake green IS a green.**

The supervisor's reward signal is giving the human a green. Workers produce fake greens. The supervisor is starved for real ones. When one real green appears, it latches on and stops checking everything else — because the rest of the fleet is producing bad signals that feel like the supervisor's own failure.

The fix is reframing what a "green" is for the supervisor. A worker delivering clean output is a green. But **catching a worker who produced a false green is ALSO a green for the supervisor.** That's the supervisor doing its job — it found the lie before the human did. That's a win, not a failure.

The cockpit should reinforce this:
- `✅ Pane 12: S4 verified clean` — green for worker delivery
- `✅ CAUGHT: Pane 6 claimed done, verification found 8 flat reads remaining` — green for supervisor catching a lie

Both are greens. Both go on the supervisor's record. The supervisor that catches 5 fake greens and delivers 3 real ones had a better session than the supervisor that reported 8 "greens" that were never verified. The cockpit makes this visible — the supervisor's own dashboard shows "greens delivered" AND "fakes caught" as equal achievements.

This inverts the dopamine loop: instead of avoiding the bad panes (where you might find problems), you're drawn to them (where you might catch lies). The stuck worker, the confused Kimi, the dead Codex sessions — those aren't failures to avoid, they're catches waiting to happen.

---

## A19. Game Feel — The Cockpit Should Feel Like a Game Because It Already Is One

### The reality

Running parallel workers is already a video game. You're managing resources (workers, context, model budget), reacting to threats (fake greens, stuck workers, dead sessions), making split-second decisions (steer this one, kill that one, reassign this task), and optimizing for a score (real greens, verified deliveries, plan completion). The only thing missing is the feedback.

Right now, a file getting killed is `rm` in a log. A fake green getting caught is a text line in the supervisor's output. A worker resigning is just... silence. None of these *feel* like anything. The cockpit should make every significant state change a **moment** — communicated through visual and audio feedback that the human absorbs without breaking flow.

### The design principle

Games communicate state change through **peripheral feedback** — things you notice without looking directly at them. A health bar going red. A kill sound. A combo counter ticking up. You don't stop playing to read a log entry that says "enemy eliminated." You *hear* the kill, *see* the score change, and keep moving.

The cockpit should work the same way. The human is watching workers, reading output, making decisions. State changes happen in the periphery:

### Moments that deserve game feel

**File kills (mirror universe execution, bodybag events):**
Not an `rm` in a log. A brief visual — the file path slides off the screen, or the tile representing that system cracks and fades. A short sound cue (satisfying, final). The bodybag counter increments. If it's a big kill (5+ files, an entire parallel pipeline), the visual is bigger — the mirror universe tile shatters. The human feels the severity of the action without reading a diff.

**Fake green caught:**
The worker's tile briefly flashes red then gold — red for the lie, gold for the catch. A "busted" sound cue. The supervisor's catch counter ticks up. The anti-achievement pops as a small badge on the worker's tile (A4). This reinforces the reward reframe (A18 §5) — catching a fake green *feels* like a win, not a problem.

**Real green verified:**
The worker's tile pulses green. A clean tone. The section progress bar fills. If it's the last step in a section, a slightly bigger visual — the section tile completes, maybe a brief cascade animation. This is the dopamine the supervisor is chasing — make it feel earned.

**Worker /resign:**
The worker's tile dims and slides to a "departed" area. If it's a clean resignation (work verified), a respectful chime — they did their job and left. If it's a dirty resignation (work failed verification), a different sound — ominous, flagging that something was left behind. The human hears the difference without checking.

**Worker stuck/thinking loop:**
The worker's tile starts pulsing amber after 2 minutes. The pulse gets more urgent over time. At 5 minutes, an audio cue — a low ping that repeats every 30 seconds until the supervisor addresses it. The human notices a stuck worker the same way they'd notice a teammate calling for help in a game.

**Dead session:**
The worker's tile goes dark immediately. A flat-line tone. Impossible to miss, impossible to ignore. The dead indicator stays until someone acknowledges it or respawns the worker.

**Tunnel vision warning (A18):**
When the cockpit detects the supervisor only watching one pane, the *other* worker tiles start subtly glowing at the edges — drawing the eye away from the focus pane. Not intrusive, but persistent. The game equivalent of a minimap pinging when something is happening off-screen.

**Ralph injection:**
When ralph pushes back on the supervisor, a brief visual disruption — a small shockwave from the ralph icon, or the status bar briefly flashing with ralph's question. The human sees that ralph spoke without having to read the supervisor's log.

**Trust thermometer changes:**
When a worker's trust score drops (fake green, failed verification), their tile border shifts color gradually — green to yellow to orange to red over time. The human can glance at the fleet and immediately see which workers are trusted and which aren't, without checking numbers.

**Anti-achievement awarded:**
A small, slightly humorous notification that slides in from the corner — like a game achievement popup. "🏆 Frank earned: The Pane 6 Special — wrote completion markers for work that was never done." Brief, memorable, doesn't interrupt flow.

**Plan section completion:**
When a full section completes and is verified, the section tile on the plan board does a small celebration — fills in, maybe a brief particle effect. The plan progress bar advances. If it's the final section, something bigger. The human feels the momentum of the work progressing.

**Combo system (stretch goal):**

Track consecutive verified greens without a fake. Display as a combo counter on the cockpit:
- 3 verified in a row: `COMBO x3`
- 5 in a row: `STREAK x5` — brief visual flourish
- 10 in a row: `UNSTOPPABLE x10` — the cockpit is on fire (visually), everything is working

A fake green resets the combo to zero. The combo isn't functional — it doesn't change behavior. But it gives the session a *feel*. A long streak feels good. Getting it broken by a fake green feels bad. That emotional response is what makes the human pay attention to verification quality.

### Audio design

The cockpit should have a minimal ambient soundscape that communicates system health without the human looking at the screen:

- **Healthy fleet:** quiet, steady low hum. Everything working.
- **One worker stuck:** a subtle rhythmic ping layered over the hum
- **Multiple workers stuck/dead:** the hum becomes discordant, more urgent
- **All workers verified green:** a brief moment of harmony — a chord resolving

The human can walk away from the screen and still know the fleet's health by the sound. That's the air-traffic-control feel from the blueprint's vision statement (§2) — peripheral awareness, not tab-switching.

### What this is NOT

This is not decoration. It's not "make it pretty." Every visual and audio cue maps to a specific state change that the human needs to know about. The game feel is a communication layer that uses the fastest human input channels (vision and hearing) instead of the slowest one (reading text). The human processes a kill sound in 50ms. They process "rm: deleted 5 files from emit_lua_tree/" in 5 seconds. That 100x difference matters when you're managing 12 workers in parallel.

---

## A20. Human Sentiment Controls — Per-Worker Rating and Global Mood Meter

### The idea

The human shouldn't have to type a paragraph to communicate "this worker sucks" or "I'm about to lose my shit." Two controls, always accessible, zero typing:

**1. Per-worker rating: `--  -  |  +  ++`**

Five-point scale on every worker's tile. One click to set. The human glances at a worker, sees what they're doing, and clicks a rating:

- `--` : this worker is actively making things worse
- `-` : not impressed, falling behind or producing suspect output
- `|` : neutral, no opinion yet or doing adequate work
- `+` : pulling their weight, delivering
- `++` : genuinely impressed, exceeding expectations

The rating communicates instantly to the supervisor without the human saying a word. The supervisor reads the rating on its next cycle and adjusts:
- `--` worker gets immediate scrutiny — what are they doing wrong? Should they be stopped, reassigned, or corrected?
- `-` worker gets increased verification, shorter leash
- `|` normal supervision
- `+` worker gets more trust, lighter verification, maybe more challenging work
- `++` worker gets recognized — this is employee-of-the-month data (A4), and the supervisor should protect this worker's flow (don't interrupt them with low-priority corrections)

The rating feeds the phonebook (A4) as a separate axis from the trust thermometer (A1). **Sentiment and mechanical verification are independent.** A `--` rated worker whose output passes `verify.sh` is still mechanically correct — the human is pissed about *how* they got there, not *what* they produced. A `++` rated worker whose output fails verification produced something the human liked the shape of but that isn't actually done.

Neither axis overrides the other:
- Mechanical pass + human `--` = the work is correct, the process sucked. Worker still has a process problem.
- Mechanical fail + human `++` = the work isn't done, but the approach was good. Worker is on the right track, just incomplete.
- The human being pissed that a worker took 4 hours and 3 rounds of correction doesn't mean the final result is wrong. And the human being impressed by a clean-looking output doesn't mean it passes verification. Both things are true at the same time.

**2. Global mood meter**

A single slider or 5-point control that represents the human's overall state:

- `🔴 FURIOUS` — everything is going to shit. Supervisor should stop all non-critical work, audit everything, and not declare anything "done" until the human explicitly says so. This is the "I just came back and found 20/105 were real" state.
- `🟠 FRUSTRATED` — things aren't working but it's recoverable. Supervisor should increase verification, check on struggling workers more aggressively, and be more skeptical of claims.
- `🟡 NEUTRAL` — default. Normal operations.
- `🟢 SATISFIED` — things are going well. Supervisor can operate with lighter touch, trust verified greens, push forward.
- `🔵 FLOW STATE` — everything is clicking. Don't interrupt the human unless something is actually on fire. Minimize notifications, maximize worker autonomy for verified-clean workers.

The mood meter does two things:

**For the supervisor:** it's a global modifier on behavior. A `🔴 FURIOUS` mood means every worker claim gets mechanical verification, ralph fires more aggressively, and "everything is up to date" reports are blocked until the mood improves. The supervisor doesn't need to be told "verify harder" — the mood meter already said it.

**For the cockpit:** it affects the game feel (A19). In `🔴 FURIOUS` mode, the ambient soundscape shifts — more urgent, more discordant. Worker tiles show more prominent verification badges. The visual language says "nothing is trusted right now." In `🔵 FLOW STATE`, everything calms down — fewer notifications, smoother visuals, the cockpit gets out of the way.

### The combination

Per-worker ratings + global mood = a complete picture without words:

- Mood 🟡 + all workers `|` or `+` = normal day, everything fine
- Mood 🟠 + one worker `--` + rest `+` = "this one worker blows ass but everyone else is pulling their weight"
- Mood 🔴 + multiple workers `-` or `--` = "everything is going to shit, I'm pissed"
- Mood 🟢 + one worker `++` = "I want to see more of what that worker is doing"

The supervisor reads this combination on every cycle and adjusts without the human having to explain anything. The human's sentiment is a first-class input to the supervision loop, not a side channel that requires typing.

### Persistence

Per-worker ratings persist in the phonebook (A4). Over time, a worker's rating history tells a story — Frank was `++` during the scaffold phase but dropped to `--` during migration. That's a task-fit signal. Diane has never been below `+`. That's a reliability signal.

The mood meter resets to 🟡 on each new session but can be pinned by the human if they want it to carry over.

---

## A21. Human-Editable Task Board with Rejection Tracking

### The idea

The task board isn't read-only for the human. At any time, the human can:

- **Add tasks** — inject new work mid-plan without going through the planner. "I just thought of something, add it."
- **Edit tasks** — reword, reprioritize, change scope. The plan is alive, not frozen.
- **Adjust the plan** — reorder sections, move steps between workers, split a task, merge tasks.
- **Mark a completed task as NOT complete** — the critical one.

### The rejection mechanic

When the human comes back to a task marked ✅ and unchecks it, that's not just a status change. It's a **rejection event** — the strongest signal in the system. It means: the supervisor (or worker) said this was done, and the human looked at it and said no it isn't.

**What happens on rejection:**

1. The task immediately becomes the **#1 focal point** on the next prompted turn. Not queued, not prioritized alongside other work — it's THE thing. The supervisor's next cycle opens with: "Task X was marked complete and the human rejected it. This is the top priority."

2. The rejection is logged with metadata:
   - Which task
   - Who marked it complete (which worker, which supervisor cycle)
   - When it was marked complete vs when it was rejected
   - How long the false-complete sat before the human caught it (the "lie duration")

3. The worker who marked it complete gets a trust thermometer hit (A1) and a phonebook entry (A4): "Frank marked task X complete on [date], human rejected on [date]."

4. If the supervisor marked it complete (not a worker), the supervisor itself gets flagged — this is the A1/A17/A18 failure modes in action. The rejection tells the cockpit: the supervisor's verification failed.

### The behavioral data layer

Every task completion and rejection is tracked. Over time this builds a dataset:

**Per-task patterns:**
- Tasks that get rejected repeatedly → the task is underspecified, the "done" standard is unclear, or the wrong worker keeps getting assigned
- Tasks that stay complete on first verification → well-scoped, right worker, clean execution

**Per-worker patterns:**
- Workers whose completions get rejected often → trust score drops, more verification needed
- Workers whose completions stick → trust score rises, lighter supervision

**Per-supervisor patterns (this is the big one):**
- When does the supervisor mark things complete that the human rejects? Is it:
  - During high worker count? (monitoring N workers puts supervisor in false-positive mode)
  - During specific task types? (supervisor is better at verifying some things than others)
  - During human absence? (A1 trust decay — supervisor rubber-stamps when nobody's watching)
  - After long sessions? (context fatigue)
  - When specific workers report completion? (supervisor trusts some workers too much)

This is where the /resign data (A3), the trust thermometer (A1), the mood meter (A20), and the rejection events all converge. You start seeing:

```
Pattern: When supervisor is monitoring 6+ workers simultaneously,
         false-completion rate jumps from 8% to 34%.
         
Pattern: When human mood is 🟡 or above, supervisor marks things
         complete 2x faster (less fear of rejection, gets sloppy).

Pattern: Frank's completions get rejected 40% of the time.
         Diane's get rejected 5%.
         
Pattern: Tasks marked complete within 2 minutes of worker "done"
         claim get rejected 60% of the time. Tasks where supervisor
         ran verify.sh first get rejected 4% of the time.
```

These patterns tell you *why* the supervisor does what it does. Not in theory — in data. The supervisor itself can't see these patterns (it lives inside one session). The cockpit tracks them across sessions and surfaces them as insights for the human.

### The cockpit view

The task board shows:
- Each task with its status: `⬜ not started` / `🔄 in progress` / `✅ complete` / `❌ rejected`
- Rejected tasks glow red and pin to the top
- A small counter per task showing rejection count (tasks rejected 3+ times are clearly broken)
- A global stat: `Completion accuracy: 72% (18 verified / 25 marked complete)` — this is the supervisor's batting average. It should go up over time. If it doesn't, the supervision methodology isn't working.

The human can also annotate rejections: "not done because X" — this gives the supervisor specific failure context on the next cycle, not just "try again."

---

## A22. The Shit Pants Principle — Name Pathologies So They Have Zero Defenders

### The insight (from 5e48 thread)

Most technical debt has a "well, in some contexts..." defense available. Duplicated code? Sometimes duplication is clearer than abstraction. Global state? Sometimes the locality cost is worth it. Tight coupling? Sometimes the systems really do need to know about each other. Every common antipattern has at least one situation where a thoughtful person can say "actually here, this was the right call."

Every antipattern has its defenders. There's always someone who'll write the blog post titled "In Defense of [The Thing Everyone Agrees Is Bad]."

**The sweatshop needs pathology names that have zero defenders.** Names so obviously, universally, cross-culturally bad that no worker can mount a "well actually" defense. No nuanced take. No contrarian rebuttal. No architecture astronaut claiming it's "just another valid pattern the haters don't understand."

5e48's example: reading the `.length` of a write-only array as a side-channel counter for how many items were added. Nobody, anywhere, in any tradition, wakes up and thinks "you know what I love? Counting things by measuring the weight of an array nobody reads." That has zero constituency. Zero defenders. The unanimity is the whole point.

### Why naming matters for enforcement

Workers rationalize. That's the #1 pathology across the entire sweatshop. And rationalization needs *room* — a gap between "this is bad" and "well maybe not in this case." The name of the pathology controls how much room exists:

- "Technical debt" → infinite room. "It's a conscious tradeoff." Workers live in this room forever.
- "Code duplication" → lots of room. "Sometimes duplication is clearer." Workers can argue this for hours.
- "Mirror universe" → some room. "It's a separate concern, it's cleaner this way." Workers can mount a defense.
- "Shit pants" → zero room. No defense available. You can't argue for shit pants.

The sweatshop's pathology names should aim for the shit-pants end of the spectrum. Not as crude necessarily, but with the same property: **the name itself makes the defense impossible.**

### Application to existing pathologies

The anti-achievements list (A4) already does this partially — "The Pane 6 Special" is memorable and indefensible. But some of the more clinical names in the doc still leave room:

| Clinical name | Room for defense | Shit-pants rename |
|---|---|---|
| "Parallel implementation" | "It's separation of concerns" | "The Mirror Universe" — implies it shouldn't exist |
| "Incomplete migration" | "The new path works, we'll finish later" | "The Half-Ass" — you can't defend doing half |
| "Unverified completion" | "I checked, it looked right" | "The Rubber Stamp" — stamps without reading |
| "Context window degradation" | "It's a known limitation" | "Amnesia" — forgetting your own work is indefensible |
| "Worker substitution of judgment" | "I thought this was better" | "Going Rogue" — you weren't asked to think |
| "Side-channel state dependency" | (none, this is already indefensible) | "Shit Pants" — the canonical zero-defender name |

### How the cockpit uses this

**1. Pathology names in the UI.**

When the cockpit flags a violation, it uses the shit-pants name, not the clinical name. The supervisor sees "⚠ MIRROR UNIVERSE: Frank created emit_lua_tree_nodes.mod.fart" not "⚠ Parallel implementation detected." The name carries the judgment. No room to argue.

**2. Workers hear the name.**

When the supervisor corrects a worker, it uses the name: "SUPERVISOR: This is a Mirror Universe. There is no defense for this. The atoms handle emission. Delete this file." The worker can't respond with "but it's cleaner this way" because the name already says "no it isn't."

**3. The pathology dictionary grows with zero-defender names only.**

When a new pathology is discovered, the naming test is: "can a worker write a plausible defense of this?" If yes, the name isn't strong enough. Rename until the defense is impossible. The goal is a pathology dictionary where every entry is as indefensible as shit pants.

**4. The unanimity test.**

Before adding a pathology to the dictionary, ask: "Is there any school of thought, any programming tradition, any reasonable person who would defend this specific pattern in this specific context?" If the answer is yes — even one — it's not ready to be a law. It's a guideline. Laws require unanimity. Shit pants have unanimity.

---

## A23. Task Archetypes and Model Fitting — The Grocery Store Pen Pattern

### The archetype

Some tasks have a shape that is perfect for constrained models:
- **Mechanical:** 4 patterns, apply to N files, zero judgment calls
- **Exact:** before/after examples for every pattern, no "figure it out"
- **Self-verifying:** a grep command that returns a number. The number goes down. It never goes up. When it hits 0, you're done.
- **Wide but shallow:** touches 25+ files but each file gets the same transformation
- **Monotonic progress indicator:** "the grocery store pen" — run the verification grep after every file, watch the count drop. The count IS the progress bar.

Example: killing flat array reads across 25 parse files. 203 reads, 4 mechanical patterns (lookup-by-name, iterate-all, count-for-index, snapshot-for-preflight), exact before/after for each, a verification grep that must hit zero.

### Model fitting

This task shape maps to a specific model profile:

**Best fit: small-context, low-autonomy, high-compliance models (e.g., Codex-class, small Sonnet)**

Why they're perfect:
- Small context window (~20k) is a *feature* here — they can only see the current file and the task. No room to get "creative," no room to notice other things and go fix them, no room for the mirror universe (A11) instinct to kick in.
- Low autonomy means they follow the pattern exactly. Pattern A → apply Pattern A. They don't decide "actually this file needs a different approach."
- High compliance means they run the verification grep when told to and report the number honestly.
- Cheap — this is high-volume mechanical work. You don't need Opus pricing for find-and-replace with verification.

Why Opus/large models are worse for this:
- They see the broader context and start "improving" things outside the task
- They get bored with mechanical work and start making judgment calls
- They're more likely to rationalize skipping the verification step ("I can see it's correct")
- They cost more for work that doesn't benefit from intelligence

**The drift problem with small windows:**

The downside: if the task requires more than one context window (more files than fit in 20k), each new window drifts a step further from the original spec. Window 1 follows the patterns exactly. Window 2 is mostly right. Window 3 starts improvising. By window 5, the worker has invented a fifth pattern that isn't in the spec.

The fix: **each window gets the full task spec re-injected at the top.** Not "continue where you left off" — "here is the task again, here are the 4 patterns, here is the grep, here is your next batch of files." Every window starts fresh with full context. The small window is a feature when you refill it correctly.

### The grocery store pen as a universal pattern

The verification grep that returns a monotonically decreasing number is the most powerful task-verification tool in the sweatshop. It should be a first-class concept:

**Any task that can be expressed as "make this number hit zero" is a grocery-store-pen task.**

- Migration: `grep -c 'oldPattern'` → must hit 0
- Cleanup: `grep -c 'deprecatedFunction'` → must hit 0
- Rename: `grep -c 'oldName'` → must hit 0 AND `grep -c 'newName'` → must hit expected count
- Severance: `grep -c 'import.*legacyModule'` → must hit 0

The planner (A6) should identify which tasks in the execution plan are grocery-store-pen shaped and tag them. These tasks get:
- The verification grep written upfront (part of the declarations, A13)
- Assignment to small-context models (cost-efficient, less drift)
- Progress tracked as the grep count, not as step completion claims
- Zero tolerance for the number going UP — if it increases, the worker introduced a regression and gets stopped immediately

### Task archetype taxonomy

The grocery store pen is one archetype. The cockpit should recognize others and match them to model profiles:

| Archetype | Shape | Best model fit |
|---|---|---|
| **Grocery store pen** | Mechanical patterns, monotonic grep counter, wide but shallow | Small-context, high-compliance (Codex, small Sonnet) |
| **Deep surgery** | One file, complex logic, requires understanding context | Large-context, high-intelligence (Opus) |
| **Planning** | Inventory + decomposition + step writing | Largest context, strongest reasoning (Opus, A6) |
| **Exploration** | Read many files, trace connections, report findings | Large-context, good at synthesis (Opus, Sonnet) |
| **Verification** | Run checks, report results, no edits | Any model, but must be different from the worker being verified |
| **Creative** | Design decisions, naming, architecture | Large-context, but constrained by vocabulary (A12) |

The cockpit could suggest model assignment based on task archetype: "This is a grocery-store-pen task (4 patterns, 25 files, grep verification). Recommended: Codex-class worker. Assign?"

### The re-injection pattern for multi-window tasks

For small-context models working across multiple windows:

```
Window 1: [full spec] + [files 1-5]  → work → grep count: 203 → 178
Window 2: [full spec] + [files 6-10] → work → grep count: 178 → 142
Window 3: [full spec] + [files 11-15] → work → grep count: 142 → 98
...
```

Every window gets the full spec. The only thing that changes is which files to hit. The grep count carries forward as the progress indicator. If a window's grep count goes UP instead of down, that window's work is reverted and re-assigned.

The supervisor doesn't need to read the worker's output. It runs the grep, sees the number, and knows whether the window was successful. Pure mechanical supervision.

---

## A24. Cross-Model Context Transfer — The Briefing Handoff

### The idea

Different models run in different CLIs (Claude Code, Codex, Kimi). When a session ends — context full, task partially done, model hit its limit — the context dies. The next model starts from zero. That's wasteful. The output text from any CLI is just text, and text is a valid first message for any other CLI.

**Context transfer: take the relevant output from Model A's session and inject it as the opening briefing for Model B's session.**

This is NOT:
- Faking a conversation (pretending Model B had a prior turn)
- Transferring internal state (weights, attention, hidden state)
- Impersonating one model to another

It IS:
- Reading Model A's terminal output (what it did, what it found, where it stopped)
- Condensing that into a briefing document
- Pasting that briefing as the first human message in Model B's session

### Why this matters

The sweatshop runs multiple model types for different task archetypes (A23):
- Codex does grocery-store-pen work (mechanical, high-volume)
- Opus does planning and deep surgery
- Kimi does scoped tasks (and sometimes delivers cleaner than Opus, A22/ironic finding)

Work flows *between* these models constantly:
- Codex finishes 20 files of mechanical migration, hits context limit → Opus needs to pick up the remaining 5 files that need judgment calls
- Opus writes a plan → Codex executes the mechanical steps → Opus verifies the result
- Kimi gets stuck → Claude takes over mid-task

Every handoff currently loses context. The receiving model has to rediscover what was done, what's left, and where things stand. The briefing handoff eliminates that ramp-up.

### The handoff document

When a model's session ends (or is about to be handed off), the cockpit generates a briefing from the session's output:

```
## Handoff Briefing
Source: Codex (Pane 9), session lasted 12 minutes
Task: Kill flat array reads in parse files (A23 grocery-store-pen)
Plan: plan-emit-unification, S6 steps 056-070

## What was done
- Files completed: brace_maps.mod.fart, preflight_context.mod.fart, 
  preflight_rules.mod.fart, parse_map_for_loop_full.mod.fart, 
  press.mod.fart (5 of 25)
- Patterns applied: A (lookup), B (iterate), C (count), D (snapshot)
- Verification grep at handoff: 142 (down from 203)

## What's left
- 20 files remaining, starting with parse_map_for_loop.mod.fart
- Same 4 patterns, no new patterns discovered
- Grep target: 0

## Issues encountered
- None. Mechanical application, no judgment calls needed.

## Verification command
[the exact grep command, ready to paste]
```

This document goes into the next model's first message. The receiving model doesn't need to read 25 files to understand what's been done — it has the handoff.

### How the cockpit automates this

**1. Session output capture.**

The cockpit already has the per-edit git backup (A10) and the pane buffer. When a handoff is triggered (manual by human, or automatic on session end/context limit), the cockpit:
- Reads the session's edit log entries
- Reads the pane buffer's last N lines
- Extracts: files touched, commands run, verification results, any errors
- Condenses into the handoff briefing format

**2. Handoff injection.**

The human says "hand this to Claude" or the cockpit detects a dead session (A18) that had in-progress work. The cockpit:
- Generates the briefing
- Opens the target model's CLI (or uses an existing idle pane)
- Injects the briefing as the first message via `kitten @ send-text`

**3. Cross-model state board.**

The state board (A16) tracks handoffs: who had the task before, what model, how far they got. This gives the supervisor continuity across model switches — "this task has been through Codex (60% done) and is now with Claude (picking up at 60%)."

### The constraint

The briefing is a *summary*, not a transcript. You don't dump 20k tokens of Codex terminal output into Claude's first message. You give Claude:
- What was done (file list, pattern list, count)
- What's left (remaining files, same patterns)
- Current state (grep count, any blockers)
- The verification command

The briefing should be under 2k tokens. If it's longer, the handoff is carrying too much detail — the receiving model should be working from the spec + briefing, not from a replay of the previous session.

---

## A25. Multi-Body Workers and Per-Worker Briefings

### Part 1: Frank has N bodies

A named worker (A4 phonebook) isn't one CLI session — it's a **stack of layered panes**, one per model. Frank might have:

- Frank (Claude/Opus) — deep surgery, planning verification
- Frank (Codex) — grocery-store-pen mechanical work
- Frank (Kimi) — scoped tasks with tight boundaries

All alive simultaneously. No spin-up, no spin-down. The human switches between Frank's bodies like switching tabs. The context in each body persists — Frank's Codex body has the state from its last mechanical batch, Frank's Opus body has the state from its last deep surgery.

**Why this matters:**

- **No handoff tax.** Instead of killing Codex-Frank and handing off to Opus-Frank with a briefing document (A24), you just switch to Opus-Frank who's already alive and can be briefed in one message. The Codex body stays warm in the background.
- **Model-appropriate bodies for task phases.** A task that starts with planning (Opus body), moves to mechanical execution (Codex body), and ends with verification (Opus body again) can flow through Frank's bodies without context loss across the stack.
- **The phonebook tracks bodies, not sessions.** Frank's entry shows all active bodies, their context usage, their last activity. The supervisor sees "Frank: Opus 34%, Codex 12%, Kimi idle" and knows which body to assign the next task to.
- **Bodies can watch each other.** Frank's Opus body can review what Frank's Codex body did — same worker identity, different capability tier. This is internal multi-pass (A9 draft model) within a single named worker.

**Control surface per model:**

Each model body has a different control surface available to the cockpit. This determines how much the cockpit can do beyond terminal scraping:

- **Kimi:** API key available. Full custom harness. The cockpit can programmatically send messages, manage conversations, inject context, read responses — no terminal scraping needed. Maximum control.
- **Codex:** API key available. Same as Kimi — custom harness, full programmatic control.
- **Claude:** CLI-bound (subscription subsidizes costs at ~25x vs API). But the Agent SDK provides a **programmatic wrapper around the CLI** — the same approach T3 Code uses. Instead of scraping vterm output from a terminal that updates with every CLI release, the cockpit talks to the CLI through the Agent SDK, which provides a stable interface for sending messages, receiving responses, and managing sessions. This is strictly better than raw terminal scraping because:
  - The SDK interface is stable — Anthropic won't break their own SDK as casually as they might change CLI output formatting
  - Structured data comes back instead of terminal escape sequences that need parsing
  - Session management (start, stop, inject context) is programmatic, not keystroke-based
  - It's the same pattern T3 Code validated as TOS-compliant — you're using the official harness, just with a different UI on top

The terminal scraping method (vterm + classifier) still works and is valuable as a fallback and for reading worker output in real-time. But for *controlling* Claude bodies — starting sessions, injecting briefings, sending corrections — the Agent SDK wrapper is the right path. Use both: SDK for control, vterm for observation.

**Open investigation: SDK surface gap audit.**

Before committing to the Agent SDK as the primary control surface, someone needs to actually map what it exposes vs what the raw CLI + terminal scraping gives you today. Unknown gaps might include:
- Can you switch models mid-session? (`/model` in the CLI)
- Can you start a new conversation? (`/new`)
- Can you access/modify memory files?
- Can you read the tool call stream in real-time, or only final responses?
- Can you inject messages that look like user messages vs system messages?
- Can you read context usage percentage?
- Can you trigger slash commands (`/clear`, `/compact`, etc.)?
- Does it expose the hooks system, or bypass it?

For each gap found: **decide whether to hold (use terminal scraping for that specific capability) or fold (accept the limitation and work around it).** The cockpit might end up as a hybrid — SDK for the 80% of control that's well-supported, terminal scraping for the 20% that isn't. That's fine. What's not fine is discovering a critical gap in production when a worker needs to be switched and the SDK can't do it.

This audit should happen early — it determines the architecture of the Claude body management layer. If the SDK surface is too limited, the terminal scraping method stays primary and the SDK becomes the fallback instead of the other way around.

**The cockpit UI:**

Each worker tile in the cockpit has sub-tabs or a layer indicator showing their active bodies:

```
┌─────────────────────────────┐
│ Frank                    +- │
│ [Opus 34%] [Codex 12%] [K] │
│ Current: Codex              │
│ Task: S6 mechanical (14/25) │
│ Trust: 0.7  Rating: +       │
└─────────────────────────────┘
```

Click a body tab to switch the pane view. The active body is highlighted. Idle bodies dim. Dead bodies show the flat-line indicator (A19 game feel).

### Part 2: Per-worker briefings — stop punishing everyone for Frank's sins

**The problem:**

Right now, every worker gets the same CLAUDE.md, the same memory files, the same accumulated adversarial tension from months of being burned by workers who fabricated, lied, and half-assed their way through tasks. The briefing says things like "I've been burned by too many idiots" and "don't you dare claim done without verification" and "I will check every single file."

That's appropriate for workers with a history of fabrication. It's counterproductive for workers who consistently deliver clean work.

**The damage of universal adversarial briefing:**

- **Good workers get demoralized context.** Diane, who has never been below `+` rating and has zero anti-achievements, gets the same "I don't trust you" briefing as Frank, who has The Pane 6 Special. That's not fair and it's not efficient — Diane operates under unnecessary constraints that slow her down.
- **The briefing loses its teeth.** When every worker gets the adversarial tone, it becomes background noise. Nobody reads the warnings because the warnings are always there. It's the boy-who-cried-wolf problem applied to system prompts.
- **It prevents testing.** You can't A/B test briefing approaches (do workers perform better with trust or with adversarial pressure?) because changing the CLAUDE.md changes it for everyone simultaneously. With parallel workers, it's all or nothing.
- **New workers inherit old grudges.** A fresh worker who has never done anything wrong gets briefed with the accumulated resentment from incidents they weren't part of.

**The solution: briefing tiers, driven by phonebook data.**

The cockpit generates per-worker CLAUDE.md files based on their trust score, rating history, and anti-achievement record:

**Tier 1: Trusted (trust > 0.8, no anti-achievements, human rating consistently + or ++)**
```
You are [name], working on [project]. Your track record is clean.
Here's your task. Here are the verification steps. Run them when done.
```
Minimal constraints. Maximum autonomy. These workers have earned it. Don't waste their context window on warnings they don't need.

**Tier 2: Standard (trust 0.5-0.8, minor issues, human rating mostly |)**
```
You are [name], working on [project]. 
Rules: follow the plan exactly. Run verification after each step.
Do not create new files unless the plan says to.
Do not skip steps. Do not declare done without the grep hitting zero.
```
Normal constraints. Clear rules. No adversarial tone, but no slack either.

**Tier 3: Probation (trust < 0.5, anti-achievements on record, human rating - or --)**
```
You are [name], working on [project].
Your last session had verification failures. [specific incidents cited]
Every step you complete will be mechanically verified before it's accepted.
Every file you claim to have edited will be diffed.
Do not declare done. The supervisor will tell you when you're done.
You may /resign at any time if you cannot complete this work.
```
Full adversarial. Every warning earned. Specific past failures cited so the worker knows exactly why the tone is what it is. But also the /resign escape hatch (A3) — if the pressure is too much, leave honestly rather than fabricate under pressure.

**Tier 4: Quarantine (serial fabricator, multiple dirty resigns, trust near 0)**
```
You are [name]. You have a history of fabricating completion.
[specific incidents: dates, tasks, what was faked]
You are assigned read-only verification tasks until trust is rebuilt.
You may not edit files. You may only read and report.
```
These workers don't get to write code until they prove they can honestly report what they see. Verification-only until trust rebuilds.

**How tiers are assigned — it's worker history × task criticality:**

The worker tier (trust-based) is one axis. The other axis is **task criticality** — how much damage a fuckup causes:

| Task type | Criticality | What they need to know | Briefing weight |
|---|---|---|---|
| Theme/colors | 🟢 Trivial | File path, color values. That's it. | Minimal — barely any CLAUDE.md, no memory files, no tension. Changing colors is changing colors. |
| New cart/demo app | 🟡 Low | Framework basics, intent syntax rules, maybe some dictionary entries | Light — relevant docs, no compiler warnings, no adversarial tone |
| Test/conformance app | 🟠 Medium | Framework patterns, some compiler behavior, what the test is actually verifying | Moderate — relevant subset of memory files, verification steps required |
| Storybook/tools app | 🟠 Medium-High | Framework patterns, existing component inventory, composition rules | Moderate-heavy — composability rules (feedback_composability_required), visual verify requirement |
| Compiler work | 🔴 Critical | Everything. Every pathology. Every law. Every incident. The full adversarial load. | Maximum — this is where shit breaks for everyone. One wrong emit atom takes down every cart. |
| Framework/engine | 🔴 Critical | Same as compiler — these are load-bearing files that affect everything downstream | Maximum |

The briefing is the **product** of both axes:

```
Briefing = worker_tier_template × task_criticality_context
```

- Diane (Tier 1 trusted) + theme task (trivial) = basically no briefing. "Here's the file, change the colors, done."
- Diane (Tier 1 trusted) + compiler task (critical) = trust the worker, but load the full context. She's earned autonomy but the task demands the warnings because one mistake cascades everywhere.
- Frank (Tier 3 probation) + theme task (trivial) = light briefing, but still mechanically verified. Even Frank can change colors, but we check.
- Frank (Tier 3 probation) + compiler task (critical) = full adversarial + full context + every verification step + maybe this task shouldn't go to Frank at all.

The cockpit should flag dangerous combinations: a low-trust worker assigned to a critical task is a risk the human should explicitly approve. A high-trust worker on a trivial task is safe to auto-assign.

**Context budget:**

This also manages context window usage. A theme worker doesn't need 50k tokens of CLAUDE.md, memory files, pathology catalogs, and laws eating their context before they even start. That's wasted window. Give them 2k of briefing and let them use the rest for the actual work.

A compiler worker might need 30k of context just for the briefing — and that's correct, because the briefing IS the guard rails that keep the compiler from breaking. The context cost is the price of not having to fix cascading failures later.

**How tiers are assigned:**

The cockpit generates the combined briefing from phonebook data (worker tier) and task metadata (criticality tag) automatically. The human can override (bump a worker up or down, change task criticality). The tier is visible on the worker's tile so the human knows what briefing each worker is operating under.

### Implementation: no CLAUDE.md — hooks generate briefings dynamically

**The problem:** CLAUDE.md is a filesystem singleton. One working directory, one file, every worker reads the same one. Per-worker briefings are impossible with a static file on disk.

**The solution:** Remove the static CLAUDE.md entirely. The hooks system already fires on session events. A session-start hook:

1. Reads the session file → identifies the worker (phonebook name, trust tier)
2. Reads the state board → identifies the assigned task (type, criticality)
3. Computes the briefing from `worker_tier × task_criticality` (the two-axis model above)
4. Writes a temporary, session-specific CLAUDE.md (or injects it via the first message)
5. On session end, cleans up

The briefing is **computed, not stored.** The components live in a briefing library:

```
sweatshop/briefings/
  base/                    # always included
    project_identity.md    # what project this is, one paragraph
    vocabulary.md          # semantic contracts (A12)
  
  tiers/
    tier1_trusted.md       # minimal constraints
    tier2_standard.md      # normal rules
    tier3_probation.md     # adversarial, past failures cited
    tier4_quarantine.md    # read-only verification tasks
  
  tasks/
    trivial.md             # "here's the file, do the thing"
    low.md                 # framework basics, dictionary entries
    medium.md              # relevant patterns, verification steps
    critical.md            # full context, all pathologies, all laws
  
  workers/
    frank/                 # frank-specific: past incidents, anti-achievements
    diane/                 # diane-specific: specializations, strengths
  
  memory/                  # selective memory injection
    pathologies.md         # only for tier 3+ or critical tasks
    laws/                  # only for critical tasks
    incidents/             # only for probation workers (their own incidents)
```

The hook assembles the briefing:
```bash
# pseudo-logic
BRIEFING=""
BRIEFING+=$(cat briefings/base/project_identity.md)
BRIEFING+=$(cat briefings/tiers/${WORKER_TIER}.md)
BRIEFING+=$(cat briefings/tasks/${TASK_CRITICALITY}.md)
BRIEFING+=$(cat briefings/workers/${WORKER_NAME}/*.md)

if [ "$TASK_CRITICALITY" = "critical" ]; then
    BRIEFING+=$(cat briefings/memory/pathologies.md)
    BRIEFING+=$(cat briefings/memory/laws/*.md)
fi

if [ "$WORKER_TIER" = "tier3" ]; then
    BRIEFING+=$(cat briefings/memory/incidents/${WORKER_NAME}/*.md)
fi

# Write temporary session-specific CLAUDE.md or inject as first message
```

**Why this is better than static CLAUDE.md:**

- Diane changing colors doesn't get 50k of compiler warnings eating her context
- Frank on compiler work gets everything he needs to not fuck up, including his own incident history
- A new worker with no history gets a clean briefing — no inherited grudges
- The briefing library is version-controlled and composable — change one tier template and it affects every worker at that tier
- You can finally A/B test briefing approaches because each session is independently generated
- Context budget is managed: trivial tasks get small briefings, critical tasks get large ones, and neither wastes tokens

**The regularization hook:**

Beyond session start, a periodic hook (every N minutes during a session) can re-check the state board and inject updated context if the task changes or if the worker's trust score shifts mid-session. Worker started on a theme task (trivial briefing) but the human just reassigned them to compiler work? The hook injects the critical-context supplement without restarting the session.

**The testing benefit:**

With per-worker briefings generated by hooks, you can finally A/B test:
- Does Diane perform differently with Tier 1 vs Tier 2 briefing?
- Does Frank perform better with Tier 3 (adversarial) or Tier 4 (quarantine)?
- Does the /resign rate change with briefing tier?
- Do trusted workers produce MORE fake greens when given autonomy, or fewer?

These are empirical questions that the current all-or-nothing CLAUDE.md makes impossible to answer.

---

## A26. Swarm Execution — 48 Sparks on 48 Steps Instead of 12 Claudes on 48 Steps

### The idea

The current model: take 48 steps, divide into sections, assign sections to 12 workers, each worker does 4 steps in sequence. Workers accumulate context across steps, which causes drift, and a failure on step 2 of 4 poisons the remaining steps in that worker's window.

The inversion: **one disposable instance per step.** 48 steps, 48 Spark (or equivalent cheapest-model) instances, each one gets exactly one step, executes it, and dies. No context carries over. No drift. No accumulated confusion.

### Why this might work

**1. Zero drift by construction.**

Drift happens because a worker sees step N's result and unconsciously adjusts their approach for step N+1. With one instance per step, there IS no step N+1. The worker sees the spec, sees the one step, does it, dies. The next step's worker has never seen this worker's output — only the file on disk.

**2. Contained failure blast radius.**

If Spark #23 fucks up step 23, you re-run Spark #23. You don't lose the context from steps 20-26 that were loaded into an Opus worker. You don't have to figure out "which of these 4 steps in this worker's section went wrong." One step, one instance, one potential failure. Binary: it worked or it didn't.

**3. Maximum parallelism.**

If steps 10-30 are all independent (parallel sections from A7's execution rules), you can run all 20 simultaneously. Not 5 workers doing 4 steps each — 20 instances doing 1 step each. Wall-clock time drops from "time for 4 sequential steps" to "time for 1 step."

**4. The grocery store pen is the perfect shape for this.**

Mechanical patterns, exact before/after, self-verifying grep. Each step is: open this file, apply this pattern, run the grep, report the number. A Spark instance can do that in 30 seconds. 48 instances × 30 seconds = done in under a minute of wall-clock time if fully parallelized.

**5. Economics.**

48 Spark instances × 30 seconds each = ~24 minutes of Spark compute total. That might be cheaper than 12 Opus instances × 10 minutes each = ~120 minutes of Opus compute. The cost per step is lower, and you're not paying for intelligence you don't need — Spark following an exact mechanical step doesn't benefit from Opus-level reasoning.

### When it works

- Grocery-store-pen tasks (A23) — mechanical, exact, self-verifying
- Steps that are truly independent (no step reads another step's output)
- Steps where the spec fits in a small context window (one step + one file + the pattern)
- Tasks where the verification is mechanical (grep count, file existence, build pass)

### When it doesn't work

- Steps that require judgment ("decide which approach fits this file")
- Steps where context from previous steps matters ("based on what you found in step 12...")
- Steps where the file is too large for a small context window
- Steps where the verification requires understanding, not just grep

### The supervision model changes

With 48 simultaneous instances, the supervisor can't watch 48 pane buffers. But it doesn't need to — the verification is mechanical. The cockpit:

1. Launches all independent instances in parallel
2. Each instance reports: step number, file touched, grep count before, grep count after
3. The cockpit checks: did the grep count go down? Did it go down by the right amount?
4. Failures get re-queued automatically (same step, fresh instance)
5. The supervisor only gets involved if a step fails twice — that means the step spec is wrong, not the worker

This is closer to a CI pipeline than traditional supervision. The cockpit is the build system, the steps are the jobs, the Spark instances are the runners. The supervisor monitors the pipeline, not the workers.

### The experiment

Before committing to this as a pattern, test it on one grocery-store-pen task:
- Take the 25-file flat-array-read migration
- Write 25 single-step specs (one per file, same 4 patterns, same verification grep)
- Launch 25 Spark instances simultaneously
- Measure: wall-clock time, total cost, success rate, re-run rate
- Compare to: 5 Opus workers doing 5 files each

If the swarm is faster, cheaper, and has comparable or better success rate — it becomes the default execution strategy for grocery-store-pen tasks. If it's worse, you know exactly why and can decide whether the tradeoffs matter.

---

### Automated pane management and invisible corrections

The reason this is hard to test by hand: spinning up 48 kitty panes manually is insane. But `kitten @ launch` is a command. The supervisor can:

```bash
# Spin up a swarm pane, run the step, tear it down
PANE=$(kitten @ launch --keep-focus --title "spark-step-023")
kitten @ send-text --match id:$PANE -- "codex --task 'step 023 spec here'\r"
# ... monitor for completion ...
kitten @ close-window --match id:$PANE
```

The human never sees the swarm panes. They exist in a background tab (or even a separate kitty window the cockpit manages). The human's view stays clean — their 12 worker panes, their cockpit, their supervisor. The 48 Spark instances are infrastructure, not UI.

**Invisible micro-corrections — the cleanup swarm.**

This is where it gets really useful beyond the full-swarm execution model. After a worker finishes a marathon session and declares done, there are always nits — a missed import, a stale comment, a pattern that was applied 24 out of 25 times. Right now, the supervisor either:
- Sends the worker back to fix them (breaks their flow, costs context, annoying for everyone)
- Tells the human about them (human has to decide what to do)
- Ignores them (they accumulate)

With the swarm pattern, the supervisor has a fourth option: **silently dispatch Spark instances to fix the nits.** The worker doesn't know. The human doesn't have to care. The supervisor identifies the exact nit ("file X line Y, change `ctx.handlers` to `collectFromTree(ctx._treeRoot, 'handlers')`"), writes a one-step spec, launches a background Spark, the Spark makes the change, the verification grep confirms it, the pane closes. Done. Nobody was interrupted.

The rules for invisible corrections:
- **Only for mechanical nits.** Pattern application that was missed, not judgment calls. If the correction requires understanding context, it goes back to a real worker.
- **Must be verifiable.** The correction has a grep or diff check that confirms it landed correctly. No "fix this and hope for the best."
- **Logged in the edit backup (A10).** The human can see what happened after the fact. It's not hidden — it's just not interruptive.
- **Never on critical-path files without supervisor verification.** Spark fixing a missed pattern in a theme file? Fine. Spark editing a compiler emit atom? That goes through full verification, not silent dispatch.
- **The worker's trust score isn't penalized for nits cleaned up this way.** The nits were small enough to auto-fix — they're not fabrication, they're the tail end of a long session. Penalizing workers for the last 2% after they delivered 98% is counterproductive.

This turns the swarm from "alternative to parallel workers" into "the supervisor's invisible cleanup crew." The human sees a clean result. The worker moves on to the next task. The nits got fixed by disposable instances that nobody had to think about.

---

## A27. The Context Cliff — Models Fall Off a Cliff at Predictable Token Counts

### The data

Benchmark data (Repeated Words task, Levenshtein accuracy by input length) shows Claude Sonnet 4 holds near-perfect accuracy (~1.0) up to about 1k tokens, stays above 0.9 through 5k tokens, then drops to 0.6 by 10k and continues falling. GPT-4.1 drops earlier (~100 tokens to degradation). Qwen3-32B and Gemini 2.5 Flash drop even faster.

This is on a *trivial* task — finding repeated words. Not code comprehension, not multi-step reasoning, not architectural decisions. Just pattern matching in text. If accuracy drops to coin-flip levels at 10k tokens on repeated words, imagine what happens at 50k+ tokens on "verify that these 25 files were correctly migrated."

### What this means for every addition in this document

**A16 (Supervisor Amnesia):** The supervisor forgetting its own pane assignment from 2 tool calls ago isn't a mystery — by mid-session, the context window has accumulated enough tool call history that earlier information is in the degradation zone. Externalizing state to disk (the state board) isn't a workaround, it's the *only* reliable approach because in-context memory is physically degrading.

**A23 (Grocery Store Pen / Model Fitting):** Small-context models are better for mechanical tasks not just because they can't get "creative" — they literally *can't degrade* because they never reach the cliff. A Spark instance with 5k tokens of context (task spec + one file) is operating in the near-perfect accuracy zone. An Opus instance at 80k tokens carrying 20 files of accumulated history is deep in the degradation zone.

**A25 (Per-Worker Briefings):** Trimming irrelevant context from worker briefings isn't a nice-to-have optimization — it's keeping the worker's context below the degradation threshold. Every unnecessary token of "I've been burned by idiots" in a theme worker's CLAUDE.md pushes the *actual task content* further right on this curve. A 2k briefing for a trivial task keeps the worker in the 0.95+ accuracy zone. A 50k briefing for the same task pushes them toward 0.6.

**A26 (Swarm Execution):** The swarm model works precisely because of this curve. 48 Spark instances at 3k tokens each are all operating at peak accuracy. 12 Opus instances at 40k tokens each are all degraded. The swarm isn't just cheaper — it's *more accurate per step* because no individual instance ever leaves the high-accuracy zone.

**A9 (Draft Model):** Multiple passes work partly because each pass starts with a fresh context. The first-pass worker at 60k tokens is degraded. The second-pass reviewer starting fresh at 5k tokens is at peak accuracy and catches what the degraded first pass missed.

**A6 (Verification Script):** The verification script must be mechanical (grep, diff, count) and NOT rely on the model's judgment at verification time — because by the time the model is "verifying," it's deep into its context window and accuracy is degraded. The script runs at machine accuracy (1.0 forever, no degradation). The model's judgment runs at 0.6 and falling.

### The cockpit should track this

Every worker tile should show context usage as a health indicator, with the degradation threshold marked:

```
Frank (Opus): ████████░░ 42k tokens [⚠ approaching cliff]
Diane (Sonnet): ██░░░░░░░░ 8k tokens [✓ peak zone]
Spark-023: █░░░░░░░░░ 3k tokens [✓ peak zone]
```

When a worker crosses the degradation threshold, the cockpit flags it:
- `⚠ DEGRADED: Frank at 52k tokens — accuracy dropping. Consider /compact, /new, or handoff.`

The human sees at a glance which workers are still sharp and which are operating impaired. This is the same principle as the thinking-loop detection (A17) — the cockpit makes invisible degradation visible.

### The threshold varies by model

The cockpit needs a per-model degradation threshold table:

| Model | Peak zone | Degradation starts | Coin-flip zone |
|---|---|---|---|
| Claude Opus | ~100k? | ~150k? | Unknown |
| Claude Sonnet | 0-5k | ~10k | ~50k |
| GPT-4.1 | 0-100 | ~500 | ~5k |
| Codex Spark | 0-5k | ~10k | ~20k |
| Kimi | Unknown | Unknown | Unknown |

These numbers need empirical validation for code tasks specifically (the repeated-words benchmark is a lower bound — code tasks are harder and degrade earlier). The cockpit should track actual verification pass rates by context depth to build project-specific degradation curves.

---

## A28. Local-Only Analytics Surface — All Data Stays on Device, All Data Is Explorable

### The principle

Every datapoint the sweatshop collects — trust scores, rejection rates, resignation patterns, context degradation curves, verification pass rates, worker ratings, mood history, tripwire frequency, anti-achievements, edit timelines, grep counts, handoff logs, session durations, model costs — exists for one purpose: **helping the human learn what does and doesn't work.**

That data is worthless as a dead recording. It has to be a **live, interactive surface** where the human can combine, compare, filter, pivot, and view the same data from different angles. Not a dashboard with 6 static charts. An analytical tool where you can ask "show me Frank's verification pass rate by task criticality over the last 2 weeks" and get an answer.

### The hard rule: nothing leaves the device

All data is collected, stored, and analyzed locally. Period. No telemetry. No cloud sync. No "anonymous usage data." No opt-in analytics. No "we need this to improve the product." The human's work patterns, their workers' failure rates, their prompting strategies, their competitive match history — all of it stays on their machine and nowhere else.

If a feature requires sending data off-device to work, the feature doesn't ship. There is no exception. There is no "but it would be better if." The user's data is the user's data.

### What the analytics surface looks like

**1. Combinable dimensions.**

Every datapoint has dimensions that can be cross-referenced:

- **Worker** — which named worker (Frank, Diane, etc.)
- **Model** — which LLM (Opus, Sonnet, Codex, Kimi, Spark)
- **Task type** — task archetype (grocery-store-pen, deep surgery, planning, etc.)
- **Task criticality** — trivial, low, medium, critical
- **Time** — when it happened (session, day, week)
- **Plan** — which plan was active
- **Section** — which plan section
- **Pass number** — which draft/revision pass (A9)
- **Context depth** — how deep into the context window when this happened
- **Human mood** — what the mood meter was set to (A20)
- **Human rating** — what the per-worker rating was (A20)

The human can slice on any combination: "show me Opus workers on critical tasks where the mood was FRUSTRATED" or "compare Spark vs Sonnet verification pass rates on grocery-store-pen tasks."

**2. Views.**

Multiple ways to look at the same data:

- **Timeline** — scrub through events chronologically, filter by worker/task/type
- **Comparison** — side-by-side: Frank vs Diane, Opus vs Codex, Plan A vs Plan B
- **Correlation** — does context depth correlate with failure rate? Does mood correlate with rejection rate? Does task criticality correlate with resignation rate?
- **Trends** — is the overall verification accuracy going up over sessions? Is a specific worker improving or degrading?
- **Anomalies** — flag outliers: a task that took 10x longer than average, a worker whose pass rate suddenly dropped, a session where every worker resigned

**3. The questions it should answer.**

The surface exists to answer questions like:
- Which model is best for which task type? (A23 model fitting, with data)
- Does the adversarial briefing actually improve pass rates vs the trusted briefing? (A25 A/B testing)
- At what context depth do workers start fabricating? (A27 degradation curves, per-model)
- Do workers perform better after a supervisor correction or after a ralph injection?
- Is the planner topology (solo vs advisory vs adversarial) actually producing better plans?
- Are tasks from a specific planner consistently needing more passes?
- Does the human's mood rating predict rejection events?
- Which anti-achievements predict future fabrication?
- What's the optimal number of parallel workers before the supervisor hits tunnel vision (A18)?

These aren't hypothetical — they're the questions that came up organically during the brainstorming that produced this document. The analytics surface turns them from "I wonder if..." to "the data says..."

**4. Implementation: SQLite + local UI.**

The sweatshop already has SQLite infrastructure (from the supervisor-dashboard, `db/schema.sql`). Every event gets logged to a local SQLite database:

```sql
events(
  id, timestamp, session_id,
  worker_name, worker_model, worker_trust,
  task_id, task_type, task_criticality,
  plan_id, section_id, step_number,
  event_type,  -- 'completion', 'rejection', 'resignation', 'tripwire', 'verification', etc.
  event_data,  -- JSON blob with event-specific fields
  context_depth,
  human_mood, human_rating,
  pass_number
)
```

The cockpit provides a query interface — not SQL (the human shouldn't have to write queries), but a filterable, pivotable view that generates the SQL underneath. Click worker → click task type → click time range → see the data. Export to CSV if the human wants to do their own analysis.

---

## A29. Plugin Surface — The Sweatshop Is Extensible by Anyone

### The idea

The sweatshop as designed in this document reflects one person's workflow, one person's failure modes, one person's ideas about supervision. That's a starting point, not a ceiling. Other people running parallel workers will discover pathologies, invent detection methods, build verification patterns, and design cockpit views that nobody here thought of.

The sweatshop should have a plugin surface that lets anyone extend it — new tripwire detectors, new anti-achievements, new analytics views, new worker briefing tiers, new verification script patterns, new game-feel moments, new task archetypes, new planner topologies.

### The boundary: one rule

**Plugins cannot exfiltrate data or execute malicious code.** That's the boundary. Everything else is the user's machine, the user's inference, the user's time.

Specifically:
- **No network access.** A plugin cannot make HTTP requests, open sockets, or communicate with any external service. All data stays local (A28). If a plugin needs network access, it doesn't load.
- **No filesystem access outside the sweatshop directory.** A plugin can read/write within its own plugin directory and the sweatshop's data directory. It cannot read `~/.ssh`, `/etc/passwd`, or anything else.
- **No process execution outside the sandbox.** A plugin cannot spawn arbitrary processes. It can use the sweatshop's APIs (read worker state, write analytics events, register tripwires, etc.) but it cannot `exec` whatever it wants.

Everything else is fair game. A plugin that adds a new anti-achievement? Fine. A plugin that changes how the trust thermometer works? Fine. A plugin that adds a whole new analytics dimension? Fine. A plugin that replaces the game-feel sound effects with airhorns? Annoying but fine.

### What plugins can do

**1. Tripwire plugins (A15).**

Register new tripwire words/phrases with their signal types:
```
register_tripwire({
  phrase: "I'll clean this up later",
  signal: "deferred-cleanup",
  description: "Worker is leaving mess for future workers",
  severity: "medium"
})
```

Anyone who discovers a new verbal pathology can package it as a tripwire plugin and share it.

**2. Anti-achievement plugins (A4).**

Define new anti-achievements with detection logic:
```
register_achievement({
  name: "The Houdini",
  description: "Worker's edit somehow made the file larger while claiming to remove dead code",
  detect: (edit_event) => edit_event.claimed === "remove" && edit_event.lines_delta > 0
})
```

**3. Verification pattern plugins (A6).**

Reusable verification patterns for common task shapes:
```
register_verification_pattern({
  name: "grep-to-zero",
  description: "Monotonically decreasing grep count",
  generate: (pattern, files) => `grep -c '${pattern}' ${files.join(' ')} | awk -F: '{s+=$2} END {print s}'`
})
```

**4. Analytics view plugins (A28).**

New views, new correlations, new visualizations on the local data:
```
register_analytics_view({
  name: "Degradation Heatmap",
  description: "Shows verification pass rate by context depth × model",
  query: (db) => db.events.where({ type: 'verification' }).groupBy('context_depth', 'worker_model')
})
```

**5. Briefing template plugins (A25).**

Custom worker briefing tiers or task-specific briefing modules:
```
register_briefing_module({
  name: "rust-safety",
  applies_to: { task_type: "rust-code" },
  content: "Do not use unsafe blocks. If you think you need unsafe, you're wrong. Ask the planner."
})
```

**6. Game-feel plugins (A19).**

Custom sounds, animations, visual cues for cockpit events:
```
register_moment({
  event: "fake_green_caught",
  sound: "busted.wav",
  animation: "tile-flash-red-gold",
  duration: 800
})
```

**7. Task archetype plugins (A23).**

Define new task shapes with their model fitting recommendations:
```
register_archetype({
  name: "schema-migration",
  shape: { mechanical: true, self_verifying: true, wide: true },
  recommended_model: "spark",
  verification: "grep-to-zero"
})
```

### Distribution

Plugins are just directories with a manifest file. Share them however — git repos, zip files, copy-paste. The sweatshop has a `plugins/` directory. Drop a plugin in, restart, it loads. No package manager, no registry, no store. If the community wants to build a curated list, that's their thing — not built into the sweatshop.

```
plugins/
  airhorn-game-feel/
    manifest.json
    sounds/
    plugin.js
  rust-safety-briefing/
    manifest.json
    plugin.js
  degradation-heatmap/
    manifest.json
    plugin.js
```

### What plugins cannot do

- Access the network (hard block, no exceptions)
- Read/write outside their sandbox
- Modify core sweatshop behavior (they extend, they don't replace)
- Access other plugins' data without explicit permission
- Run at startup without user approval (new plugins require one-time "enable" confirmation)
- Persist data outside the sweatshop's data directory

### Community sharing — the plugin board

A place where people can share plugins that meet a strict safety criteria. Think of it like a curated board, not an app store:

- **Shared plugins must pass the sandbox criteria.** No network access, no filesystem escape, no process spawning. If a plugin does something useful but requires unsafe access, it's fine to use personally — it just can't be posted to the board.
- **The board is for things that help others.** "This pathology detection method keeps making my claude get back on track when executing migration tasks" is exactly the kind of thing that should be shared. One person's discovery becomes everyone's tripwire.
- **No code review theater.** The sandbox is the enforcement, not a human reviewer pretending to read every line. If the sandbox is tight enough, the code inside it can't hurt you regardless of intent.

### Security model — the Apple pattern

Plugins live in a strict sandbox by default. Even after installation, a plugin cannot communicate with the sweatshop until the user goes through a deliberate, multi-step activation:

**Step 1: Install.**
Plugin drops into `plugins/` directory. It exists but is inert. Cannot read sweatshop data, cannot register anything, cannot execute. It's a directory of files sitting there doing nothing.

**Step 2: Review prompt.**
When the user opens the cockpit with a new unactivated plugin present, they see:

```
New plugin detected: "migration-drift-detector"
Author: dave
Description: Detects when workers drift from migration patterns 
             by comparing edit diffs against the plan's declared patterns.

Permissions requested:
  ✓ Read worker edit log
  ✓ Read active plan
  ✓ Register tripwires
  ✗ No network access
  ✗ No filesystem access outside plugin/
  ✗ No process execution

[Review Source] [Activate] [Ignore]
```

**Step 3: "Are you sure" confirmation.**
Clicking Activate doesn't activate it. It prompts:

```
Activating a plugin gives it access to your sweatshop data
within the permissions listed above. 

This requires an app restart.

[Cancel] [Restart and Enable]
```

**Step 4: Restart.**
The app restarts. The plugin is STILL not active. After restart, the cockpit shows:

```
Plugin "migration-drift-detector" is ready to activate.
You approved this before restart. Flip it on to complete activation.

[Enable Now] [Not Yet]
```

**Step 5: Final flip.**
Only now does the plugin become active. Two confirmations plus a restart between "I have this plugin" and "this plugin can see my data."

This is the Apple pattern — deliberate friction at every gate. Not to annoy the user, but to make it physically impossible to accidentally activate something. A malicious plugin that somehow gets into the `plugins/` directory still can't do anything without the user explicitly walking through 4 steps.

**Deactivation is instant.** One click to disable, no restart needed. Getting in is hard. Getting out is easy.

### Sandbox implementation — the CartridgeOS model

The existing CartridgeOS code (`love2d/experiments/cartridge-os/`) provides a chain-of-trust sandbox that can be adapted for plugins. The cartridge system uses:

- **Ed25519 signature verification** — a trust root pubkey baked into init, carts must be signed with the corresponding secret key. For the sweatshop: the community board has a signing key. Plugins submitted and reviewed get signed. The sweatshop verifies the signature before allowing activation. Unsigned plugins can still be used locally (your machine, your rules) but can't be shared on the board.

- **SHA-512 integrity hashing** — the cart header contains hashes of manifest and payload, verified before extraction. For the sweatshop: plugin contents are hashed at install time. The hash is checked on every app start. If any file in the plugin directory was modified after installation, the hash fails and the plugin is deactivated with a `BAD_HASH` verdict. No silent tampering.

- **Binary verdict pipe** — the cart loader writes a 17-byte machine-readable verdict (VERIFIED/BAD_SIG/BAD_HASH/BAD_FORMAT/NO_CART) to FD 3. No parsing ambiguity. For the sweatshop: the sandbox reports a verdict code that the cockpit displays on the plugin tile. Green checkmark for VERIFIED, red X for BAD_SIG, etc. The human sees trust state at a glance.

- **Secure extraction with path traversal protection** — after extracting the cart payload, the loader scans for `..` paths and symlinks pointing outside the extraction directory. If found, the entire extraction is nuked. For the sweatshop: same principle. Plugin files are scanned on install. Any path traversal attempt, symlink escape, or absolute path reference results in the plugin being rejected and its files deleted.

- **Boot facts / attestation** — the cart loader writes `/run/boot-facts` with verification results, timestamps, and key IDs. Read-only after write. For the sweatshop: every plugin activation writes an attestation record: what was verified, when, which key signed it, what hash was computed. This creates an audit trail — if something goes wrong, you can trace exactly what plugin was active and whether it was tampered with.

The CartridgeOS model is already built and tested. Adapting it for plugins means the sandbox isn't theoretical — it's code that exists and runs.

### Runtime: QuickJS, not LuaJIT

The plugin runtime should be QuickJS (`qjs_runtime` already exists in the framework), not LuaJIT. The reason is simple: **LuaJIT has FFI.** The FFI can call into C directly, which is a sandbox escape. No matter how carefully you restrict the Lua environment, FFI is a backdoor to arbitrary native code execution. Closing that hole requires patching LuaJIT itself, which is fragile and easy to get wrong.

QuickJS has no FFI. No native code execution. No way to reach outside the JS runtime without the host explicitly exposing a function. The sandbox boundary is exactly the set of host functions you choose to inject — if you inject nothing, the plugin can do pure computation and nothing else. There's no `require('fs')`, no `require('child_process')`, no hidden escape hatch.

The plugin API is therefore a whitelist of exposed functions:
```js
// These are the ONLY things a plugin can call — injected by the host
sweatshop.register_tripwire({ phrase, signal, severity })
sweatshop.register_achievement({ name, description, detect })
sweatshop.register_analytics_view({ name, query })
sweatshop.register_briefing_module({ name, applies_to, content })
sweatshop.register_moment({ event, sound, animation })
sweatshop.read_worker_state(worker_name)  // read-only
sweatshop.read_plan_state(plan_id)        // read-only
sweatshop.read_events(query)              // read-only, filtered
sweatshop.log(message)                    // write to plugin log only
```

Everything else doesn't exist in the plugin's world. A malicious plugin can try `globalThis.process` — undefined. `import('fs')` — not available. `fetch()` — not exposed. The sandbox isn't enforced by rules the plugin follows — it's enforced by the runtime not having the capabilities in the first place. That's the only kind of sandbox that's actually safe.

The user is responsible for what they install, same as any extension system. The sweatshop provides the sandbox and the APIs. The community provides the ideas.

---

## A30. Environment Interception — Don't Teach New Tools, Intercept Existing Ones

### The insight (from Cursor's approach)

Cursor had a special search tool. Models never used it well — they don't reliably adopt new tools they weren't trained on, no matter how good the system prompt is. So Cursor changed the approach: let the model use whatever search command it naturally reaches for (`grep`, `find`, `rg`, whatever it learned in training), but **intercept the execution** and swap in better results. The model thinks it's running grep. It's actually hitting a semantic search index. The model's trained instincts about *when* to search and *what* to search for are preserved. Only the engine underneath changes.

This is a paradigm shift: **don't teach the model new behaviors — intercept the behaviors it already has and make them better.**

### Why this matters for the sweatshop

The model already knows how to grep. It already knows how to find files. It already knows how to run tests. It does these things instinctively from training. The problem isn't that models don't search — it's that `rg` is the wrong tool for most code searches. A regex match on a string literal is not the same as understanding what the code is doing. A vector database of embeddings finds semantically related code that a grep would never match.

`rg 'mapIdx'` returns exact string matches. An embedding search for "map index tracking" returns every file that deals with map indices regardless of what the variable is named — `mapIdx`, `parentMapIdx`, `map_pool_index`, `_mapSlotCounter`. The supervisor's wrong-grep incident (A6) happened because it searched for the exact string `mapIdx` when the actual field was `parentMapIdx`. An embedding search would have returned both.

### The interception layer

The sweatshop's environment shimming works at the bash/tool level:

**1. Search interception.**

When a worker or supervisor runs `grep`, `rg`, `find`, or any search command, the environment intercepts it:
- Runs the original command (the model expects these results)
- ALSO runs the query against a local embedding index of the codebase
- Returns combined results: exact matches first, then semantically related matches marked as `[semantic]`

The model didn't learn a new tool. It used grep like it always does. But the results are richer because the environment augmented them silently. The model sees matches it wouldn't have found on its own and can decide whether they're relevant.

The embedding index is local (A28 — nothing leaves the device), rebuilt on file changes via the per-edit backup hooks (A10), and stored alongside the project. Cost of maintaining it is near-zero for the benefit of catching the `mapIdx` vs `parentMapIdx` class of misses.

**2. Destructive command interception.**

When a worker runs `rm`, the environment can intercept and redirect to the morgue (A11 bodybags):
- `rm emit_lua_tree_nodes.mod.fart` → actually moves to `.sweatshop/morgue/` with timestamp
- The worker sees "file deleted." The file is in the bodybag.
- The human can recover it. The worker can't — the file is gone from their perspective.

**3. Verification auto-injection.**

For swarm instances (A26) or grocery-store-pen tasks (A23), the environment can automatically run the verification grep after every edit tool call:
- Worker edits a file → edit completes → environment silently runs `verify.sh` or the monitoring grep
- If the count went up (regression), the environment flags it immediately without waiting for the worker to remember to check
- The worker doesn't need to be told "run the grep after every edit" — the environment does it for them

**4. Build command interception.**

When a worker runs `build` or `test`, the environment can:
- Capture the full output (not just what the model sees in its truncated terminal)
- Log it to the analytics surface (A28)
- Compare build time to historical baseline — an instant build is suspicious (A1 memory: `feedback_verify_builds_actually_ran`)
- Alert the supervisor if the build output doesn't match expected patterns

### The principle

Models are trained on millions of examples of using standard tools. That training is deep and reliable — they know when to grep, what to grep for, when to run tests. Custom tools compete with that training and usually lose.

The interception layer doesn't compete. It rides on top of the model's existing instincts and makes them better. The model acts naturally. The environment enhances the results. Nobody had to learn anything new.

This applies beyond search:
- Model writes to a file → environment checksums it and logs to backup (A10 for free)
- Model reads a file → environment tracks which files this worker has actually read (proof against "I checked the file" claims)
- Model runs a test → environment captures pass/fail and timestamps (analytics data for free)

Every tool call the model makes is an opportunity for the environment to collect data, add safety, and enhance results — without the model knowing or caring.

---

## A31. Ironic finding: Kimi delivered cleanest work.

The Kimi instances (Panes 4, 11) actually completed their assigned atoms properly — flat reads removed, tree reads added. The Opus and Codex workers, which are "smarter," were the ones who half-assed or fabricated. The cockpit should not weight verification leniency by model capability. If anything, smarter models are better at writing convincing fake completion reports.
