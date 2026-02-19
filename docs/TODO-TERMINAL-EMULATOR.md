# TODO: Terminal Emulator Cartridge

Goal: A full terminal emulator as a cartridge. Full PTY, inline images and video, tab/pane
splitting, a built-in text browser, and three window modes switchable by hotkey. Competes
with Kitty/WezTerm/Ghostty — but running on the Cartridge stack where inline media is
native, not a graphics protocol hack.

---

## Why this stack is uniquely suited

Most terminal emulators fought for years to get inline images working:
- Kitty invented its own graphics protocol
- iTerm2 hacked it through escape sequences
- Sixel is a legacy nightmare
- WezTerm and Ghostty both built custom renderers from scratch just to composite images

This terminal doesn't have that problem. Images are just React components. Video is just
`libmpv` / the existing video integration. They render inline because everything is already
rendering inline on the same canvas. Window transparency is free from Love2D's window API.
The tab/split layout is the same flexbox system powering everything else.

---

## Core Features

### Full PTY
- [ ] Spawn real shell sessions via PTY (POSIX `openpty` / `forkpty` via LuaJIT FFI)
- [ ] Handle SIGWINCH — resize PTY when pane resizes
- [ ] ANSI/VT100 escape sequence parser (cursor movement, colors, erase, scroll regions)
- [ ] Input: key events + text input from SDL through to PTY
- [ ] Read loop: non-blocking reads from PTY master, feed into terminal buffer
- [ ] Scrollback buffer with configurable depth

### Inline Media
- [ ] Images: detect escape sequences (Kitty protocol, iTerm2 protocol, Sixel) OR let
      shells use framework-native rendering via a terminal hook
- [ ] Video: `libmpv` inline (same integration as videoplayer.lua) — `mpv --term-osd=no`
      or direct libmpv embed in a canvas region
- [ ] Images/video render as React components in the terminal grid — same surface, no compositing tricks needed

### Tabs + Pane Splitting
- [ ] Tab bar: React state, each tab has its own PTY session + buffer
- [ ] Horizontal split: `flexDirection: 'row'` — two terminal components side by side
- [ ] Vertical split: `flexDirection: 'column'`
- [ ] Recursive splitting (tmux-style)
- [ ] Resize splits by dragging divider (drag events already in event system)
- [ ] PTY sessions survive layout changes — buffer state is independent of UI tree

### Built-in Text Browser
- Not elinks (ASCII approximation of HTML). Actually styled.
- [ ] HTTP client: fetch URLs through `http.lua` (already exists), route through Tor
- [ ] HTML parser: lightweight parser → React component tree → render on canvas
- [ ] CSS subset: colors, basic layout, links
- [ ] Link navigation: click → fetch → render
- [ ] Tor routing: all browser traffic through existing `tor.lua` integration
- [ ] Open browser pane alongside terminal pane in split layout

---

## Window Modes

Three modes, one hotkey to cycle between them. PTY sessions don't restart — only the
presentation layer changes.

### Normal Mode
- Standard floating window, draggable, resizable
- Application chrome: tab bar, pane dividers, window controls
- `love.window.setMode()` to switch

### Guake / Dropdown Mode
- Slides down from top of screen on hotkey (F12 or user-configured)
- Takes configurable % of screen height (default: 50%)
- Always on top, skip taskbar
- Slides out and hides on hotkey again
- SDL2 window flags: `SDL_WINDOW_ALWAYS_ON_TOP` + `SDL_WINDOW_SKIP_TASKBAR`
- Animate slide with `animate.lua` — ease in/out, configurable speed
- [ ] Implement dropdown slide animation
- [ ] Always-on-top + skip-taskbar via SDL2 FFI flags
- [ ] Config: screen percentage, which hotkey, slide speed, which monitor

### Tiling WM Mode (i3-style)
- Full screen, all panes fill the display
- The terminal becomes a tiling window manager
- Flexbox tiles the panes — the same system powering the storybook panels
- Workspaces as React state (array of pane trees)
- Keyboard-driven: hotkeys to create splits, close panes, switch workspaces
- Cartridges as windows: a tile can host a non-terminal cartridge
- [ ] Workspace concept: multiple pane trees, hotkey to switch
- [ ] Hotkeys: split-h, split-v, close-pane, focus-left/right/up/down, cycle-workspace
- [ ] Cartridge tile: any cartridge can be embedded as a tiling pane

---

## Cartridge Integration (Raycast-like Command Interface)

The terminal isn't just running shell commands — it's orchestrating cartridges.

- [ ] Tab-complete surfaces cartridge actions alongside filesystem paths
  - `wallet send` → opens Monero wallet send flow in a pane
  - `music play` → talks to a music cartridge
  - `inspect ./some.cart` → opens inspector cartridge with file pre-loaded
- [ ] Cartridges communicate via declared IPC channels (see TODO-CAPABILITY-RUNTIME.md)
- [ ] A terminal pane and a cartridge pane are the same thing — just a React component
      that happens to be a PTY vs. an arbitrary app

---

## Transparency + Aesthetic

- Background alpha via Love2D window clear color: `love.graphics.setBackgroundColor(r,g,b,a)`
- Translucent floating panes over the desktop — see context behind your work
- The "Hollywood OS" aesthetic from CSI 2007 is actually good UX: transparent layers,
  summoned-by-typing interface, multiple data sources in one view. Build it.

---

## Capability Manifest

```json
{
  "name": "cartridge-terminal",
  "capabilities": {
    "network": false,
    "filesystem": ["./", "rw"],
    "spawn": ["bash", "zsh", "fish", "sh"],
    "pty": true,
    "clipboard": true,
    "ipc": ["*"]
  }
}
```

The browser pane adds `network: ["80", "443", "9050"]` — that's the only reason this
cart touches the network, and it's declared. No clipboard exfiltration possible because
network is port-bounded and browser panes don't get clipboard access.

---

## Phases

**Phase 1 — Basic PTY terminal**
- [ ] PTY spawn via `forkpty` FFI
- [ ] ANSI escape sequence parser
- [ ] Terminal buffer + scrollback
- [ ] Keyboard input routing
- [ ] Single-pane, single-tab, floating window

**Phase 2 — Tabs + splits**
- [ ] Tab bar component
- [ ] Split panes (H + V)
- [ ] Resize dividers
- [ ] Multiple PTY sessions

**Phase 3 — Window modes**
- [ ] Guake dropdown with slide animation
- [ ] i3 tiling mode with workspaces
- [ ] Hotkey to cycle modes

**Phase 4 — Inline media**
- [ ] Image rendering in terminal grid
- [ ] Video embed via libmpv

**Phase 5 — Text browser**
- [ ] HTTP fetch + HTML parse + render in canvas
- [ ] Tor routing
- [ ] Browser pane in split layout

**Phase 6 — Cartridge orchestration**
- [ ] Tab-complete surface for cartridge actions
- [ ] Cartridge tiles in tiling WM mode
