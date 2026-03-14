# Router for tsz

## What Love2D Has

`love2d/packages/router/` — ~600 lines of TypeScript. Pure React, no Lua involvement.

| File | Lines | What it does |
|------|-------|-------------|
| `history.ts` | 129 | Memory history adapter — stack of Locations, push/replace/back/forward |
| `matcher.ts` | 129 | Pattern matching — `/users/:id`, `*` wildcard, scoring for specificity |
| `context.tsx` | 97 | RouterProvider + hooks (useRouter, useNavigate, useLocation, useParams, useRoute) |
| `components.tsx` | 145 | Route, Routes, Link, Outlet, Navigate components |
| `types.ts` | 71 | Type definitions |

Reference: All files in `love2d/packages/router/src/`

## tsz Approach: Compile-Time Routing

In React, routing is runtime — React Context provides navigation state, Routes component evaluates matches each render. In tsz, there's no React runtime. Routes are **compiled to a state variable + conditional display toggles**.

### How it works

User writes:
```tsx
function Home() {
  return (
    <Box style={{ padding: 32 }}>
      <Text fontSize={24} color="#ffffff">Home</Text>
    </Box>
  );
}

function Settings() {
  return (
    <Box style={{ padding: 32 }}>
      <Text fontSize={24} color="#ffffff">Settings</Text>
    </Box>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
```

Compiler sees `<Routes>` and emits:
1. All route component trees compiled as siblings (all exist in the static node array)
2. A string state slot holding the current path
3. A `matchRoute()` function that checks path against patterns
4. `updateRoutes()` that toggles `display: none/flex` based on which route matches

This is the **same pattern as conditional rendering** (Agent 3's work) — just generalized to N branches instead of 2.

## Implementation

### Phase 1: Runtime — History + Matcher

**New file: `tsz/runtime/router.zig`**

#### Memory History

Reference: `love2d/packages/router/src/history.ts:29-76`

```zig
const MAX_HISTORY = 64;
const MAX_PATH_LEN = 256;

var history: [MAX_HISTORY][MAX_PATH_LEN]u8 = undefined;
var history_lens: [MAX_HISTORY]u16 = [_]u16{0} ** MAX_HISTORY;
var history_count: usize = 0;
var history_index: usize = 0;
var _dirty: bool = false;

pub fn init(initial_path: []const u8) void;
pub fn push(path: []const u8) void;      // truncate forward, append, advance
pub fn replace(path: []const u8) void;   // overwrite current entry
pub fn back() void;                       // decrement index if > 0
pub fn forward() void;                    // increment index if < count-1
pub fn currentPath() []const u8;          // return current entry
pub fn isDirty() bool;                    // changed since last check
pub fn clearDirty() void;
```

Push truncates forward entries (standard browser behavior):
```zig
pub fn push(path: []const u8) void {
    // Truncate forward entries
    history_count = history_index + 1;
    // Append new entry
    if (history_count < MAX_HISTORY) {
        const len = @min(path.len, MAX_PATH_LEN);
        @memcpy(history[history_count][0..len], path[0..len]);
        history_lens[history_count] = @intCast(len);
        history_count += 1;
        history_index = history_count - 1;
        _dirty = true;
    }
}
```

Reference: `love2d/packages/router/src/history.ts:44-50` (push truncates forward, appends, advances)

#### Pattern Matcher

Reference: `love2d/packages/router/src/matcher.ts:24-98`

```zig
pub const RouteMatch = struct {
    matched: bool,
    score: u32,
    params: [8]Param,  // max 8 URL params
    param_count: u8,
};

pub const Param = struct {
    name: [32]u8,
    name_len: u8,
    value: [128]u8,
    value_len: u8,
};

pub fn matchRoute(pattern: []const u8, pathname: []const u8) RouteMatch;
```

Matching rules (reference: `matcher.ts:29-58`):
- Split pattern and pathname by `/`
- For each segment:
  - `:name` → capture as param, score +3
  - `:name?` → optional param, score +2
  - `*` → wildcard (rest of path), score +1
  - literal → exact match required, score +4
- All segments must match (unless optional/wildcard)

```zig
pub fn findBestMatch(patterns: []const []const u8, pathname: []const u8) ?usize {
    var best_idx: ?usize = null;
    var best_score: u32 = 0;
    for (patterns, 0..) |pattern, i| {
        const m = matchRoute(pattern, pathname);
        if (m.matched and m.score > best_score) {
            best_score = m.score;
            best_idx = i;
        }
    }
    return best_idx;
}
```

Reference: `love2d/packages/router/src/matcher.ts:112-128` (findBestMatch iterates, picks highest score)

### Phase 2: Compiler — Route Detection

**File: `tsz/compiler/codegen.zig`**

#### Detect `<Routes>` and `<Route>` in JSX

When the compiler sees `<Routes>`:
1. Parse child `<Route>` elements
2. Extract `path` attribute (string) and `element` attribute (JSX element or component reference)
3. Compile each route's element tree into the static node array
4. Record route metadata: `{ path_pattern, node_index }`

#### Emit routing infrastructure

In the generated code:
```zig
// Route path patterns (compile-time constants)
const _route_patterns = [_][]const u8{ "/", "/settings", "/users/:id" };

// Route node indices in the array (which children to show/hide)
const _route_indices = [_]u32{ 0, 1, 2 };

fn updateRoutes() void {
    const path = router.currentPath();
    const best = router.findBestMatch(&_route_patterns, path);
    // Hide all routes
    for (_route_indices) |idx| {
        _arr_root[idx].style.display = .none;
    }
    // Show the matched route
    if (best) |idx| {
        _arr_root[_route_indices[idx]].style.display = .flex;
    }
}
```

This is the **exact same display-toggle pattern** used by conditional rendering — just with N branches and pattern matching instead of a boolean condition.

### Phase 3: Navigation Hooks

#### `useNavigate()`

In .tsz:
```tsx
function App() {
  const navigate = useNavigate();
  // ...
  <Pressable onPress={() => navigate('/settings')}>
```

Compiler detects `useNavigate()` and:
- Makes `navigate` a known function name
- In handler bodies, `navigate('/settings')` emits `router.push("/settings");`

#### `useLocation()`

```tsx
const location = useLocation();
// location used in template literals: {`Path: ${location}`}
```

Compiler maps `useLocation()` to `router.currentPath()` — returns the current path string.

This requires **string state** (Agent 2's work) or direct string access. Since `router.currentPath()` returns `[]const u8`, it can be used directly in template literals with `{s}` format.

#### `useParams()`

```tsx
function UserProfile() {
  const params = useParams();
  return <Text>{`User: ${params.id}`}</Text>;
}
```

This is more complex — params are route-specific and change on navigation. For v0, params can be accessed via a runtime function:

```zig
router.getParam("id") // returns ?[]const u8
```

Compiler maps `params.id` in template literals to `router.getParam("id")`.

### Phase 4: `<Link>` Component

```tsx
<Link to="/settings">
  <Text>Go to Settings</Text>
</Link>
```

Compiler treats `<Link>` as a `<Pressable>` with an auto-generated `onPress` handler that calls `router.push(to)`.

Reference: `love2d/packages/router/src/components.tsx:85-107` (Link renders clickable element, onClick calls navigate)

### Phase 5: `<Navigate>` Component (Redirect)

```tsx
<Route path="/old" element={<Navigate to="/new" />} />
```

Compiler emits: when this route activates, immediately call `router.replace("/new")`. This is a mount effect on the route.

Reference: `love2d/packages/router/src/components.tsx:136-144` (Navigate calls navigate on mount via useEffect)

## Files

| File | Change |
|------|--------|
| `tsz/runtime/router.zig` | **New** — memory history + pattern matcher |
| `tsz/compiler/codegen.zig` | Detect Routes/Route/Link/Navigate, emit routing code |
| `tsz/compiler/codegen.zig` | Detect useNavigate/useLocation/useParams, map to router API |
| `build.zig` | Add router.zig to engine imports |

## Dependencies

- **Conditional rendering** (Agent 3) — display toggle pattern, already landed
- **useEffect** — for Navigate component (mount effect), already landed
- **String state** (Agent 2) — for useLocation display in template literals, already landed
- **Multi-statement handlers** or at minimum `navigate()` as a handler expression — needed for Link/Pressable onPress

## Implementation Order

1. `router.zig` — history stack + pattern matcher (pure runtime, no compiler)
2. `<Routes>` + `<Route>` in compiler — display toggle routing
3. `navigate()` in handler expressions — Link-style navigation
4. `useNavigate()` / `useLocation()` hooks
5. `useParams()` — param extraction and template literal access
6. `<Link>` and `<Navigate>` components

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/router-test.tsz
```

Example .tsz:
```tsx
function Home() {
  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={24} color="#ffffff">Home Page</Text>
      <Pressable onPress={() => navigate('/settings')} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Go to Settings</Text>
      </Pressable>
    </Box>
  );
}

function Settings() {
  return (
    <Box style={{ padding: 32, backgroundColor: '#2d2d3d' }}>
      <Text fontSize={24} color="#ffffff">Settings Page</Text>
      <Pressable onPress={() => navigate('/')} style={{ padding: 16, backgroundColor: '#569cd6', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Back to Home</Text>
      </Pressable>
    </Box>
  );
}

function App() {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Box>
  );
}
```

Expected: App starts on Home. Click "Go to Settings" → Settings page appears, Home disappears. Click "Back to Home" → Home reappears.
