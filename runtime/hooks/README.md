# runtime/hooks — FFI wrappers

JS-side thin wrappers over framework Zig capabilities. Each module declares:
1. **Public API** — typed exports the cart calls.
2. **Zig registration** — which `registerHostFn` calls the Zig side needs.
3. **Shim** — if applicable, a `install*Shim()` that aliases a browser-standard global (fetch, localStorage, WebSocket) so copy-pasted React code just works.

The generic FFI helpers live in `runtime/ffi.ts` (one level up): `hasHost`, `callHost`, `callHostStrict`, `callHostJson`, `subscribe`.

## Current status

| Module | Framework Zig | JS wrapper | Zig globals registered | Shim |
|---|---|---|---|---|
| `ffi.ts` | n/a | ✅ shipped | n/a | — |
| `useFuzzySearch` | n/a | ✅ shipped | n/a — pure JS scoring/filtering | — |
| `useHotState` | ✅ `framework/hotstate.zig` | ✅ shipped | ⚠️ live wiring, state still resets in practice — fix pending | — |
| `clipboard` | ✅ `qjs_runtime.zig` | ✅ shipped | ✅ live | — |
| `fs` | ✅ `std.fs.cwd()` | ✅ shipped | ✅ live | — |
| `localstore` | ✅ `framework/localstore.zig` | ✅ shipped | ✅ live | `installLocalStorageShim()` |
| `crypto` | ✅ `framework/crypto.zig` + `std.crypto` | ✅ shipped | ✅ live except shamir | — |
| `process.env*/exit` | ✅ `std.posix` / libc | ✅ shipped | ✅ live | — |
| `sqlite` | ✅ `framework/sqlite.zig` (libsqlite3 linked) | ✅ shipped | ✅ live (handle registry + JSON param binding) | — |
| `http` sync | ✅ `curl` CLI via `std.process.Child.run` | ✅ shipped | ✅ live (`__http_request_sync`) | `installFetchShim()` |
| `http` async | ✅ `framework/net/http.zig` worker pool | ✅ shipped | ✅ live (`__http_request_async`); drained via `qjs_bindings.tickDrain()` each frame | — |
| `process.spawn + streaming` | ✅ `framework/process.zig` (no pipes yet) | ✅ stub | ❌ pending — `framework/process.zig` has fork/exec but no stdout/stderr pipes. Add a pipe-enabled `spawnWithPipes()` + per-child fd buffer readable from `tickDrain`. | — |
| `websocket` | ⚠️ `framework/net/websocket.zig` (fails to compile under Zig 0.15) | ✅ stub | ❌ blocked — framework module needs migration first, see below. | `installWebSocketShim()` |

Status legend:
- **Framework Zig**: the underlying capability exists in the Zig runtime already.
- **JS wrapper**: this `runtime/hooks/<module>.ts` file exists with typed signatures.
- **Zig globals registered**: `qjs_runtime.registerHostFn("__<name>", ...)` calls exist so JS can reach the Zig code.

Until the Zig registration column flips to ✅, the JS wrapper returns its graceful-fallback default (`null`, `false`, `[]`, etc.) rather than throwing — carts can develop UI against the hook API today and the data starts flowing as soon as the Zig side lands.

## What just landed (2026-04-19)

All wiring lives in `framework/qjs_bindings.zig`; `registerAll(ctx)` is called from the tail of `qjs_runtime.initVM()`, and `qjs_app.appTick` calls `qjs_bindings.tickDrain()` each frame to flush async events (http responses now, more later).

- **fs**: `__fs_read`, `__fs_write`, `__fs_exists`, `__fs_list_json`, `__fs_mkdir`, `__fs_remove`, `__fs_stat_json` — all via `std.fs.cwd()`, no path confinement.
- **localstore**: `__store_get`, `__store_set`, `__store_remove`, `__store_clear`, `__store_keys_json` — single `"app"` namespace over `framework/localstore.zig`. `qjs_app.appInit` calls `fs_mod.init("reactjit")` + `localstore.init()` so hooks work before the bundle evals.
- **crypto**: `__crypto_random_b64`, `__crypto_hmac_sha256_b64`, `__crypto_hkdf_sha256_b64`, `__crypto_xchacha_encrypt_b64`, `__crypto_xchacha_decrypt_b64`. Shamir split/combine falls back (framework uses hex I/O — easy follow-up).
- **env / exit**: `__env_get`, `__env_set`, `__exit`.
- **sqlite**: `__sql_open`, `__sql_close`, `__sql_exec`, `__sql_query_json`, `__sql_last_rowid`, `__sql_changes`. Handle registry (`AutoHashMap(u32, *Database)`) maps JS ints to heap-owned `Database` structs. `exec`/`query` take `JSON.stringify({sql, params})`; params are bound by JSON value type (null/bool/int/float/string). `query_json` returns a JSON array of row objects keyed by column name.
- **http sync**: `__http_request_sync` shells out to `curl -sSi` via `std.process.Child.run`; parses HTTP response into `{status, headers, body, error?}` JSON.
- **http async**: `__http_request_async` delegates to `framework/net/http.zig`'s worker pool. Each tick, `qjs_bindings.tickDrain()` polls completed responses and fires `__ffiEmit('http:<reqId>', payload)` so `ffi.subscribe('http:<reqId>', …)` gets the result. `fetch()` shim rides on top of this. Response headers are currently empty — `net/http.zig` only captures status + body today (framework improvement tracked separately).

`runtime/hooks/index.ts:installBrowserShims()` still installs `fetch` + `localStorage` + `WebSocket`; `fetch` + `localStorage` are now fully live. `WebSocket` remains a no-op client until the ws module below lands.

## Pending work

### websocket (blocked at framework level)

`framework/net/websocket.zig` fails to compile under Zig 0.15 because `std.net.Stream.writer` now requires a buffer argument (old signature: `stream.writer()`; new: `stream.writer(buf: []u8)`). Before ws hooks can wrap it, the framework module needs migration — update both call sites (lines 80 and 329) to pass a buffer.

Once the framework module compiles:
1. Add a handle registry + `wsOpen/Send/Close` bindings (~80 lines).
2. Add a `wsTickDrain()` that iterates registered sockets, calls `.update()`, and emits `ws:open|message|close|error:<id>` via `__ffiEmit`.
3. Hook `wsTickDrain()` from `tickDrain()`.

Scope restriction once landed: plain `ws://` only. `wss://` needs a TLS client in front of the raw socket — separate task.

### process.spawn with stdout/stderr streaming

`framework/process.zig` spawns via `fork + execvp` but does not set up stdout/stderr pipes — so there's no streamable data to emit. To wire this:
1. Add a `spawnWithPipes(opts)` variant in `framework/process.zig` that creates three `pipe2(O_CLOEXEC | O_NONBLOCK)` pairs before fork, dup2s them into the child's 0/1/2, and returns the parent-side fds alongside the Pid.
2. Keep a registry of `{pid, stdout_fd, stderr_fd, line_buf}` in `qjs_bindings.zig`.
3. In `tickDrain()`: for each active child, non-blocking read both pipes into a line buffer, emit `proc:stdout:<pid>` / `proc:stderr:<pid>` per complete line, and — after `alive()` flips false — read remaining bytes then emit `proc:exit:<pid>`.

JS hooks in `runtime/hooks/process.ts` are already shaped for this; only the Zig side is missing.

## Design anchor: `tickDrain()`

Instead of background-thread event queues, the async subsystems reuse framework poll-based APIs (`net/http.poll()`, future `net/websocket.update()`) and drain them once per frame from `qjs_app.appTick`. This means:

- No mutexes, no MPSC channels — the poll buffer IS the shared state, owned by the framework module and read from the main thread.
- Subscriber callbacks run via `ffi.subscribe` → `__ffiEmit` → `setTimeout(0)` → listener, so a single frame drains many responses without reentrancy loops.
- Back-pressure is natural: slow responders don't flood QuickJS because the poll buffer is bounded.

## Async pattern

- **Sync wrapper**: returns the result directly. Blocks the frame. OK for fast ops.
- **Async wrapper**: returns a Promise. Zig side takes a request ID, fires `__ffiEmit('channel:<reqId>', payload)` when done. `ffi.subscribe('channel:<reqId>', …)` wires it up.
- **Streaming**: multiple events per request (WS frames, stdout lines, llama tokens). Consumer subscribes via `ffi.subscribe` and unsubscribes when done.

The `__ffiEmit` handler in `ffi.ts` defers subscriber callbacks via `setTimeout(0)` to avoid setState-during-commit loops (learned the hard way from the inspector's network capture).

## Future modules (not yet stubbed)

- `audio` — start/stop streams, DSP graph control (`framework/audio.zig`)
- `video` — play/pause/seek (`framework/videos.zig`)
- `terminal` — spawn PTY + feed/read (`framework/vterm.zig`, `framework/pty.zig`)
- `canvas` — camera/viewport control (`framework/canvas.zig`)
- `window` — open secondary windows (`framework/windows.zig`)
- `physics` — body create/apply-force/joint (`framework/physics2d.zig`, `physics3d.zig`)
- `applescript` — macOS automation (`framework/applescript.zig` — already partially exposed via `__applescript`)
- `llm` — llama.cpp inference (`framework/llama_exports.zig`)
- `claude` / `codex` — agent SDKs (`framework/claude_sdk/`, `framework/codex_sdk.zig`)
- `archive` — tar/zip (`framework/archive.zig`)
- `ipc` — cross-process messaging (`framework/qjs_ipc.zig`)

Add these in the same shape (JS stub → Zig register → optional shim) as work demands.
