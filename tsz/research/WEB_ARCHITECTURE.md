# Web Architecture

## The Rule

There is ONE runtime. It runs inside Alpine Linux inside v86 inside the browser.
The browser-side wasm is a dumb GPU terminal. It receives draw commands. It sends back input.

If QuickJS is running outside the VM, it's wrong.
If layout is computing outside the VM, it's wrong.
If FreeType is measuring outside the VM, it's wrong.
If state lives outside the VM, it's wrong.

## Stack

```
Browser
  └─ v86 (x86 emulator, JS/wasm)
       └─ Alpine Linux (real, 32-bit)
            └─ tsz binary (native x86, compiled by Zig)
                 ├─ Compiler (tsz → Zig)
                 ├─ Layout engine
                 ├─ QuickJS (app logic, state, events)
                 ├─ LuaJIT (compute workers)
                 ├─ FreeType (text measurement)
                 └─ All framework modules
```

## Wire Protocol

Bidirectional over v86 serial port.

### VM → Browser (draw commands)

After layout computes positions, the VM serializes the visible node tree as a flat
array of draw commands. The browser-side wasm paints them via WebGPU.

Draw command types:
- rect: x, y, w, h, bg color, border radius, border color, border width
- text: x, y, font size, color, string data
- glyph: x, y, w, h, atlas UV, color (pre-rasterized by FreeType in VM)

### Browser → VM (input events)

The browser-side wasm receives DOM events and sends them to the VM as input packets.

Input types:
- click: x, y, button
- key: keycode, modifiers, char
- resize: width, height
- scroll: x, y, delta

Hit testing uses the last received node tree (browser has positions from draw commands).

## Browser-Side WASM

This is a thin renderer. It contains:
- WebGPU pipelines (rects, text, curves — already built)
- Serial I/O (read draw commands, write input events)
- Hit testing (walk last frame's node positions)
- Glyph atlas (receives rasterized glyphs from VM, uploads to GPU texture)

It does NOT contain:
- Layout engine
- QuickJS
- LuaJIT
- FreeType
- State management
- Event handlers
- Compiler
- Any framework module

## VM Image

A pre-built Alpine Linux 32-bit image containing:
- The tsz binary (cross-compiled: `zig build -Dtarget=x86-linux-musl`)
- All native deps pre-installed (SDL3 stubbed for headless, FreeType, libvterm, etc.)
- Boot to serial console, auto-launch tsz app

The image is a static asset served alongside the wasm. v86 boots it on page load
or on user action (Boot button).

## What Exists Today

- v86 integration in web/ (JS emulator, Alpine ISO, BIOS images)
- WebGPU pipelines in framework/gpu/ (rects, text, curves, polys, images)
- Serial char export was started (web_serial_char) but wrong approach
- TinyEMU core compiled into wasm (future: replace v86 JS with Zig-compiled emulator)
- engine_web.zig exists but currently runs the full stack locally — needs to become the dumb terminal

## Build

```bash
# Build the tsz binary for the VM (x86 32-bit, static musl)
zig build app -Dtarget=x86-linux-musl

# Build the browser-side renderer (thin wasm)
zig build web

# Package: renderer wasm + VM image + v86
tsz build --web app.tsz
```

## End State

`tsz build --web app.tsz` produces a directory you `tsz serve`. Open it in a browser.
v86 boots Alpine. The tsz app starts. The UI renders through WebGPU at 60fps.
You click buttons, type text, interact with the app. It's real Linux.
The user doesn't know they're in a VM. It just works.
