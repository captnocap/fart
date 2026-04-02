# Master Tree

What the source tree looks like when everything is in place.

```
tsz/
│
├── compiler/                          ── THE COMPILER ──────────────────
│   ├── forge.zig                      Zig kernel: lex, bridge, file I/O
│   ├── smith_bridge.zig               QuickJS bridge
│   ├── lexer.zig                      Tokenizer (stays in Zig for speed)
│   ├── cli.zig                        CLI entry point
│   └── smith/                         JS compiler intelligence
│       ├── core.js                    Main entry, orchestrator
│       ├── rules.js                   Validation rules
│       ├── soup.js                    Soup lane (HTML→native mapping)
│       ├── parse.js                   Parse orchestrator
│       ├── parse/                     Parsing subsystem
│       │   ├── build_node.js
│       │   ├── children/
│       │   │   ├── text.js
│       │   │   ├── conditional_blocks.js
│       │   │   └── ...
│       │   └── brace/
│       │       ├── ternary.js
│       │       ├── map.js
│       │       └── ...
│       ├── emit/                      Zig codegen
│       │   ├── node.js
│       │   ├── handler.js
│       │   ├── map_pools.js
│       │   ├── runtime_updates.js
│       │   └── ...
│       ├── collect/                   Collection passes
│       ├── preflight/                 Tier detection, validation
│       ├── lanes/                     Entry dispatch
│       │   ├── chad.js
│       │   ├── page.js
│       │   ├── shared.js
│       │   └── ...
│       └── DICTIONARY.md             Smith internal layout map
│
├── plumbing/                          ── INTERNAL SUBSTRATE ────────────
│   │                                  Authors NEVER see this.
│   │                                  External deps + core engine.
│   │
│   ├── sdl/                           SDL3 bindings
│   │   ├── init.zig
│   │   ├── events.zig
│   │   ├── window.zig
│   │   └── audio_stream.zig
│   │
│   ├── gpu/                           GPU pipeline
│   │   ├── wgpu.zig                   wgpu_native bindings
│   │   ├── vello.zig                  Vello 2D renderer (Rust FFI)
│   │   ├── pipeline.zig              Render pipeline orchestration
│   │   ├── surfaces.zig              Surface painting
│   │   └── shaders/
│   │       ├── rect.wgsl
│   │       ├── text.wgsl
│   │       └── effect.wgsl
│   │
│   ├── text/                          Text rendering
│   │   ├── freetype.zig              FreeType bindings
│   │   ├── shaping.zig               Glyph shaping
│   │   ├── atlas.zig                 Texture atlas
│   │   └── measure.zig              Text measurement
│   │
│   ├── layout/                        Layout engine (custom, not yoga)
│   │   ├── flex.zig                   Flex layout algorithm
│   │   ├── measure.zig               Node measurement
│   │   ├── scroll.zig                Scroll containers
│   │   └── constraints.zig           Size constraints
│   │
│   ├── runtime/                       Script runtimes
│   │   ├── quickjs/                   QuickJS integration
│   │   │   ├── qjs_runtime.zig
│   │   │   ├── qjs_value.zig
│   │   │   ├── qjs_ipc.zig
│   │   │   └── qjs_c.zig
│   │   ├── luajit/                    LuaJIT integration
│   │   │   ├── luajit_runtime.zig
│   │   │   ├── luajit_worker.zig
│   │   │   └── lua_guard.zig
│   │   └── applescript.zig            macOS AppleScript bridge
│   │
│   ├── state/                         Reactive state
│   │   ├── slots.zig                  State slot allocation
│   │   ├── reconciler.zig             Diff + update
│   │   └── events.zig                Event dispatch
│   │
│   ├── core/                          Engine lifecycle
│   │   ├── engine.zig                 Main loop
│   │   ├── api.zig                    C ABI exports
│   │   ├── windows.zig               Window management
│   │   ├── cartridge.zig             .so cartridge loading
│   │   └── dev_shell.zig             Hot-reload host
│   │
│   └── lib.so                         All plumbing linked together
│
├── framework/                         ── AUTHOR-FACING STDLIB ──────────
│   │                                  Everything here is .tsz authored.
│   │                                  Authors use these as ambients.
│   │
│   ├── tsz/                           Source (.tsz authored, dogfooded)
│   │   │
│   │   ├── sqlite/
│   │   │   ├── sqlite.tsz            <sqlite lib>
│   │   │   ├── connection.mod.tsz    <connection module>
│   │   │   └── query.mod.tsz         <query module>
│   │   │
│   │   ├── http/
│   │   │   ├── http.tsz              <http lib>
│   │   │   ├── client.mod.tsz        <client module>
│   │   │   ├── server.mod.tsz        <server module>
│   │   │   └── websocket.mod.tsz     <websocket module>
│   │   │
│   │   ├── fs/
│   │   │   ├── fs.tsz                <fs lib>
│   │   │   ├── files.mod.tsz         <files module>
│   │   │   ├── watch.mod.tsz         <watch module>
│   │   │   ├── archive.mod.tsz       <archive module>
│   │   │   └── path.mod.tsz          <path module>
│   │   │
│   │   ├── audio/
│   │   │   ├── audio.tsz             <audio lib>
│   │   │   ├── playback.mod.tsz      <playback module>
│   │   │   ├── mixer.mod.tsz         <mixer module>
│   │   │   ├── effects.mod.tsz       <effects module>
│   │   │   └── recorder.mod.tsz      <recorder module>
│   │   │
│   │   ├── video/
│   │   │   ├── video.tsz             <video lib>
│   │   │   ├── player.mod.tsz        <player module>
│   │   │   └── capture.mod.tsz       <capture module>
│   │   │
│   │   ├── images/
│   │   │   ├── images.tsz            <images lib>
│   │   │   ├── decode.mod.tsz        <decode module>
│   │   │   ├── resize.mod.tsz        <resize module>
│   │   │   └── convert.mod.tsz       <convert module>
│   │   │
│   │   ├── crypto/
│   │   │   ├── crypto.tsz            <crypto lib>
│   │   │   ├── hash.mod.tsz          <hash module>
│   │   │   ├── encrypt.mod.tsz       <encrypt module>
│   │   │   └── keys.mod.tsz          <keys module>
│   │   │
│   │   ├── net/
│   │   │   ├── net.tsz               <net lib>
│   │   │   ├── tcp.mod.tsz           <tcp module>
│   │   │   ├── udp.mod.tsz           <udp module>
│   │   │   └── socket.mod.tsz        <socket module>
│   │   │
│   │   ├── process/
│   │   │   ├── process.tsz           <process lib>
│   │   │   ├── spawn.mod.tsz         <spawn module>
│   │   │   ├── exec.mod.tsz          <exec module>
│   │   │   └── pty.mod.tsz           <pty module>
│   │   │
│   │   ├── physics/
│   │   │   ├── physics.tsz           <physics lib>
│   │   │   ├── physics2d.mod.tsz     <physics2d module>
│   │   │   └── physics3d.mod.tsz     <physics3d module>
│   │   │
│   │   ├── store/
│   │   │   ├── store.tsz             <store lib>
│   │   │   ├── local.mod.tsz         <local module> (key-value)
│   │   │   └── session.mod.tsz       <session module>
│   │   │
│   │   ├── ui/
│   │   │   ├── ui.tsz                <ui lib>
│   │   │   ├── canvas.mod.tsz        <canvas module>
│   │   │   ├── graph.mod.tsz         <graph module> (SVG paths)
│   │   │   ├── transition.mod.tsz    <transition module>
│   │   │   ├── easing.mod.tsz        <easing module>
│   │   │   ├── tooltip.mod.tsz       <tooltip module>
│   │   │   └── context_menu.mod.tsz  <context_menu module>
│   │   │
│   │   ├── debug/
│   │   │   ├── debug.tsz             <debug lib>
│   │   │   ├── log.mod.tsz           <log module>
│   │   │   ├── telemetry.mod.tsz     <telemetry module>
│   │   │   ├── crashlog.mod.tsz      <crashlog module>
│   │   │   └── testharness.mod.tsz   <testharness module>
│   │   │
│   │   ├── ifttt/
│   │   │   ├── ifttt.tsz             <ifttt lib>
│   │   │   ├── triggers.mod.tsz      <triggers module>
│   │   │   └── actions.mod.tsz       <actions module>
│   │   │
│   │   └── random/
│   │       ├── random.tsz            <random lib>
│   │       └── random.mod.tsz        <random module>
│   │
│   ├── generated-zig/                 Compiled from tsz/ (build artifact)
│   │   ├── sqlite/
│   │   │   ├── connection.gen.zig
│   │   │   └── query.gen.zig
│   │   ├── http/
│   │   │   ├── client.gen.zig
│   │   │   ├── server.gen.zig
│   │   │   └── websocket.gen.zig
│   │   ├── fs/
│   │   │   ├── files.gen.zig
│   │   │   ├── watch.gen.zig
│   │   │   ├── archive.gen.zig
│   │   │   └── path.gen.zig
│   │   ├── audio/
│   │   │   ├── playback.gen.zig
│   │   │   ├── mixer.gen.zig
│   │   │   ├── effects.gen.zig
│   │   │   └── recorder.gen.zig
│   │   └── ...                        (mirrors tsz/ structure)
│   │
│   └── lib/                           Compiled .so per capability
│       ├── sqlite.so
│       ├── http.so
│       ├── fs.so
│       ├── audio.so
│       ├── video.so
│       ├── images.so
│       ├── crypto.so
│       ├── net.so
│       ├── process.so
│       ├── physics.so
│       ├── store.so
│       ├── ui.so
│       ├── debug.so
│       ├── ifttt.so
│       ├── random.so
│       └── framework.so               All of the above linked together
│
├── sys/                               ── SYSTEM AMBIENTS ───────────────
│   │                                  Always available. Read-only.
│   │                                  Not .so — compiled into engine.
│   │
│   ├── time.zig                       time.now, time.timestamp, time.delta
│   ├── device.zig                     device.os, device.screen, device.gpu
│   ├── input.zig                      input.mouse, input.keyboard, input.touch
│   ├── math.zig                       math.floor, math.clamp, math.sin, math.lerp
│   ├── locale.zig                     locale.language, locale.region, locale.rtl
│   └── privacy.zig                    privacy.level, privacy.consent
│
├── carts/                             ── USER APPLICATIONS ─────────────
│   │
│   ├── conformance/                   Test suite (420+ tests)
│   │   ├── mixed/                     JSX + script syntax
│   │   │   ├── d01_nested_maps.tsz
│   │   │   ├── d125_command_classifier.tsz
│   │   │   ├── parity/               Real-app clones
│   │   │   │   ├── spotify-clone/
│   │   │   │   ├── slack-clone/
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── chad/                      Intent dictionary syntax
│   │   │   ├── counter.tsz
│   │   │   ├── media_player.tsz
│   │   │   ├── apps/                  Multi-file apps
│   │   │   │   ├── filebrowser/
│   │   │   │   ├── chat/
│   │   │   │   └── ...
│   │   │   └── libs/                  Library tests
│   │   │       ├── sqlite/
│   │   │       └── ...
│   │   ├── soup/                      Raw React/HTML syntax
│   │   │   ├── s01a_counter.tsz
│   │   │   ├── 04_permission_dialog.tsz
│   │   │   └── ...
│   │   ├── parity/                    Same spec, all lanes must match
│   │   │   ├── counter/
│   │   │   │   ├── manifest.md
│   │   │   │   ├── soup/
│   │   │   │   ├── mixed/
│   │   │   │   └── chad/
│   │   │   └── app_vs_widget/
│   │   │       ├── manifest.md
│   │   │       ├── app/
│   │   │       └── widget/
│   │   ├── wpt-flex/                  Layout conformance (75 tests)
│   │   ├── lscript/                   Lua bridge tests
│   │   └── ...
│   │
│   ├── storybook/                     Component showcase
│   ├── tools/                         Developer tools
│   │   ├── Tools.tsz
│   │   └── progress/                  Build metrics dashboard
│   ├── inspector/                     Runtime devtool
│   ├── benchmarks/                    Performance measurement
│   └── supervisor-dashboard/          Multi-terminal host
│
├── scripts/                           ── BUILD & TOOLING ───────────────
│   ├── build                          Main build script (the only command)
│   ├── build-all-conformance          Batch baseline runner
│   ├── conformance-report             Query conformance.db
│   ├── flight-check                   Source↔generated integrity
│   ├── link.lua                       LuaJIT linker
│   └── regression-hook                Git hook for regression detection
│
├── docs/                              ── DOCUMENTATION ──────────────────
│   ├── INTENT_DICTIONARY.md           Chad syntax SSoT
│   ├── MASTER_TREE.md                 This file
│   ├── CONFORMANCE_VERIFY.md          Human verification workflow
│   ├── MODULES.md                     Framework module architecture
│   └── ...
│
├── bin/                               ── FROZEN BINARIES ───────────────
│   ├── tsz                            Reference compiler (frozen)
│   └── tsz.frozen                     Backup
│
├── conformance.db                     Build results database
├── build.zig                          Zig build system
└── CLAUDE.md                          AI assistant instructions
```

## Key Boundaries

```
┌─────────────────────────────────────────────────────┐
│                    AUTHOR SEES                       │
│                                                      │
│  framework/tsz/*     ← standard library (ambient)    │
│  sys/*               ← system ambients (read-only)   │
│  carts/*             ← their own apps                │
│                                                      │
├─────────────────────────────────────────────────────┤
│                   AUTHOR NEVER SEES                  │
│                                                      │
│  plumbing/*          ← SDL3, wgpu, FreeType, etc.    │
│  compiler/*          ← forge + smith                 │
│  framework/generated-zig/*  ← build artifacts        │
│  framework/lib/*.so  ← compiled output               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Build Flow

```
framework/tsz/sqlite/query.mod.tsz
        │
        ▼  (forge + smith)
framework/generated-zig/sqlite/query.gen.zig
        │
        ▼  (zig build)
framework/lib/sqlite.so
        │
        ▼  (link)
framework/lib/framework.so  ← all .so combined
        │
        ▼  (cart build links against framework.so)
zig-out/bin/my-app
```

## Dirty Builds

Change `audio/mixer.mod.tsz`:
1. Recompile only `mixer.mod.tsz` → `mixer.gen.zig`
2. Rebuild only `audio.so`
3. Relink `framework.so` (fast — just .so concatenation)
4. Cart builds pick up the new `framework.so` automatically

Everything else stays cached. Seconds, not minutes.
