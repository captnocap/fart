# .zig → .tsz Migration Checklist

**Rule:** If it's not generating code, it should be generated code.
Every `.zig` in `runtime/compiled/` needs a `.tsz` source in `runtime/tsz/`.

**Done:** 49 / 52 (94%) — remaining 3 are in progress by other sessions

---

## Done (have .tsz source in runtime/tsz/)

- [x] animate.tsz
- [x] archive.tsz
- [x] audit.tsz
- [x] breakpoint.tsz
- [x] bsod.tsz
- [x] canvas.tsz
- [x] classifier.tsz
- [x] compositor.tsz
- [x] crypto.tsz
- [x] events.tsz
- [x] framework/inspector/overlay.tsz
- [x] framework/inspector/panel.tsz
- [x] fs.tsz
- [x] fswatch.tsz
- [x] geometry.tsz
- [x] gpu.tsz
- [x] image.tsz
- [x] input.tsz
- [x] layout.tsz
- [x] leaktest.tsz
- [x] library_index.tsz
- [x] localstore.tsz
- [x] mouse.tsz
- [x] mpv.tsz
- [x] net/http.tsz
- [x] net/http_test.tsz
- [x] net/ring_buffer.tsz
- [x] net/socks5.tsz
- [x] net/tor.tsz
- [x] overlay.tsz
- [x] panels.tsz
- [x] privacy.tsz
- [x] pty.tsz
- [x] query.tsz
- [x] router.tsz
- [x] sqlite.tsz
- [x] state.tsz
- [x] syntax.tsz
- [x] telemetry.tsz
- [x] testassert.tsz
- [x] testdriver.tsz
- [x] testharness.tsz
- [x] vterm.tsz
- [x] watchdog.tsz
- [x] windows.tsz

---

## In progress (3 files — claimed by other sessions)

### Rendering / UI (session 8da3)
- [ ] text.zig — text rendering (FreeType integration)
- [ ] gpu_shaders.zig — GPU shader definitions (wgpu)
- [ ] c.zig — C interop / FFI bindings

### Networking (session 59d1)
- [ ] net/websocket.zig — WebSocket client

## Recently completed

- [x] net/httpserver.tsz (session 87c4)
- [x] net/manager.tsz (session 87c4)
- [x] net/wsserver.tsz (session 87c4)
- [x] fs.tsz (session 87c4)

## Not migration candidates (reclassified)

- `main.zig` — standalone Phase 0+1+2 demo, being replaced by compiler-generated app pipeline
- `generated_app.zig` — ALREADY compiler output (from layout-stress.tsz), not hand-written

---

## Not candidates (stays as-is)

- `stb/stb_image.h` + `stb_image_impl.c` — vendored C library
- `stb/stb_image_write.h` + `stb_image_write_impl.c` — vendored C library
- `ffi_libs.txt` — build config, not code
- `compiler/*.zig` — the compiler itself (can't compile itself)
