# Routing

Client-side navigation with `<Route>` elements.

## Overview

tsz provides a compile-time routing system for single-page apps. `<Route>` elements in JSX are detected by the compiler and wired to a runtime router (`framework/router.zig`) that manages a memory-based history stack. Navigation toggles child visibility — no page loads, no reconciliation.

## Usage

```tsx
function HomePage() {
  return <Text style={{ fontSize: 24 }}>Home</Text>;
}

function AboutPage() {
  return <Text style={{ fontSize: 24 }}>About</Text>;
}

function App() {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => { navigate('/') }}>
          <Text>Home</Text>
        </Pressable>
        <Pressable onPress={() => { navigate('/about') }}>
          <Text>About</Text>
        </Pressable>
      </Box>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
    </Box>
  );
}
```

## How It Works

### Compile time

1. The compiler detects `<Route path="..." element={...} />` in JSX (Phase 8)
2. Each route's element is parsed as a normal JSX subtree
3. Route info (path + child index) is stored in `routes[]`
4. The compiler emits `updateRoutes()` — a function that reads `router.currentPath()` and toggles display on route children

### Runtime

The router (`framework/router.zig`) maintains:
- A fixed-size history stack (max 64 entries, 256 chars per path)
- Current index into the stack
- A dirty flag checked each frame

### Navigation

`navigate('/path')` in handler bodies compiles to `router.push("/path")`.

In `_appTick`, the engine checks:
```zig
if (router.isDirty()) { updateRoutes(); router.clearDirty(); }
```

`updateRoutes()` calls `router.findBestMatch()` with the registered path patterns and sets display on/off for each route's child node.

## Router API

| Function | Description |
|----------|-------------|
| `router.init(path)` | Set initial path (called in `_appInit`) |
| `router.push(path)` | Navigate to path, truncating forward history |
| `router.replace(path)` | Replace current entry without adding to history |
| `router.back()` | Go back one entry |
| `router.forward()` | Go forward one entry |
| `router.currentPath()` | Get current path string |
| `router.isDirty()` | Check if path changed since last frame |
| `router.clearDirty()` | Reset dirty flag |
| `router.findBestMatch(patterns, path)` | Find best matching route pattern |

## Pattern Matching

Routes support exact path matching. The first route's path is used as the initial route.

## Known Limitations

- Max 32 routes per app
- Max 64 history entries, 256 chars per path
- No dynamic route params (`:id` patterns) — exact match only
- No nested routers — one flat route table per app
- No route guards or middleware
- Routes are display-toggled, not lazily created — all route subtrees exist in the node tree at all times
- Router is stubbed in `.so` mode (dev shell cartridges)
