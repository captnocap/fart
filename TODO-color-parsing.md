# TODO: Unified Color Parsing Across All Lua Modules

## Problem

Color parsing is duplicated across three Lua files, each with its own `parseColor` / `setColor` function. Until just now, all three silently failed on 3-digit shorthand hex (`#fff`, `#000`, `#f00`). We patched shorthand support into each one individually, but the real issue is that:

1. **Three separate implementations** — `painter.lua:setColor()`, `animate.lua:parseColor()`, `textinput.lua:parseColor()`. Any new color format has to be added in three places.
2. **Only hex strings and RGBA tables are supported** — no CSS named colors, no `rgb()`, no `hsl()`. If someone writes `color: 'white'` or `color: 'rgb(255, 0, 0)'`, it silently does nothing.
3. **Silent failure** — when a color string doesn't match, the function returns without setting any color (painter) or returns nil/fallback. There's no warning, no error. The text just renders invisible or with the wrong color. This is the worst failure mode because it looks like a rendering bug, not a color bug.

## Current state (what works)

| Format | Example | Supported |
|--------|---------|-----------|
| 6-digit hex | `#ff00ff` | Yes |
| 8-digit hex (with alpha) | `#ff00ff80` | Yes |
| 3-digit shorthand | `#fff` | Yes (just fixed) |
| 4-digit shorthand (with alpha) | `#fff8` | Yes (just fixed) |
| `"transparent"` | `transparent` | Yes |
| RGBA table (0-1 range) | `{1, 0, 0, 1}` | Yes |
| CSS named colors | `white`, `red`, `blue` | No |
| `rgb()` / `rgba()` | `rgb(255, 0, 0)` | No |
| `hsl()` / `hsla()` | `hsl(0, 100%, 50%)` | No |

## Plan

### 1. Single `color.lua` module (source of truth)

Create `lua/color.lua` with one function that handles everything:

```lua
local Color = {}

--- Parse any valid color into {r, g, b, a} (0-1 range).
--- Returns nil if the input is not a recognized color format.
function Color.parse(c)
  -- table passthrough: {r, g, b, a}
  -- "transparent"
  -- "#rgb" / "#rgba" shorthand
  -- "#rrggbb" / "#rrggbbaa"
  -- "rgb(r, g, b)" / "rgba(r, g, b, a)"
  -- "hsl(h, s%, l%)" / "hsla(h, s%, l%, a)"
  -- CSS named colors (lookup table)
end

--- Set Love2D drawing color from any valid color value.
function Color.set(c)
  local r, g, b, a = Color.parse(c)
  if r then love.graphics.setColor(r, g, b, a) end
end

return Color
```

### 2. Replace all three implementations

- `painter.lua`: `Painter.setColor(c)` → calls `Color.set(c)`
- `animate.lua`: `parseColor(c)` → calls `Color.parse(c)`
- `textinput.lua`: `parseColor(c, fallback)` → calls `Color.parse(c)` with fallback

### 3. CSS named color table

Include the full CSS named color set (148 colors). It's a static lookup table, zero runtime cost:

```lua
local NAMED = {
  white = {1, 1, 1, 1},
  black = {0, 0, 0, 1},
  red = {1, 0, 0, 1},
  -- ... all 148
}
```

### 4. Warning on unrecognized colors

When `Color.parse()` gets a string it can't match, print a one-time warning to the console:

```
[color] Unrecognized color: "not-a-color" (falling back to transparent)
```

This turns silent invisible-text bugs into obvious console messages.

### 5. Lint rule (optional)

Add a lint rule to `cli/commands/lint.mjs` that warns on color strings that aren't in a known format. Catches typos at build time instead of runtime.

## Files to touch

| File | Change |
|------|--------|
| `lua/color.lua` | New — single source of truth for color parsing |
| `lua/painter.lua` | Replace inline `setColor` hex parsing with `Color.set()` |
| `lua/animate.lua` | Replace inline `parseColor` with `Color.parse()` |
| `lua/textinput.lua` | Replace inline `parseColor` with `Color.parse()` |
| `lua/init.lua` | Require `color.lua` if needed for global access |
