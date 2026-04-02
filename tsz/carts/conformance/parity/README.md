# Parity Suite

Same spec, three syntax lanes, identical output.

## Structure

Each test is a directory with a manifest and three lane subdirectories:

```
parity/dashboard/
  manifest.md           — the spec: what the app must do, look like, contain
  chad/                 — chad-tier implementation (block syntax, self-contained)
  mixed/                — mixed-tier implementation (JSX + script blocks)
  soup/                 — soup-tier implementation (raw React/HTML)
```

## The Manifest

The manifest is the single source of truth for what the app IS. It defines:

- **Colors**: exact hex values that must appear in output
- **Components**: how many, what they render
- **State**: what state variables exist, what they do
- **Interactions**: what pressing buttons does
- **Data**: what data is displayed
- **Layout**: structural requirements (sidebar + main, tabs, list, etc.)

The manifest does NOT prescribe syntax. It says WHAT, never HOW. Each lane implements from the manifest independently using its own idioms.

## The Rule

All 3 lane implementations must produce **byte-identical generated Zig output** after normalization. If they diverge, the compiler lane that diverges has a bug.

## How to verify

```bash
./scripts/parity-check dashboard
```

The script:
1. Builds all 3 versions via `forge`
2. Normalizes generated `.zig` (strip comments, normalize whitespace)
3. Compares output across lanes
4. Reports PASS if all 3 match, FAIL with diff showing where they diverge

## What divergence means

The two lanes that agree are correct. The one that diverges has a compiler bug. Fix the compiler, not the test.

## Manifest example

```markdown
# Dashboard

## Colors
- Background: #0f172a
- Card background: #1e293b
- Text primary: #e2e8f0
- Text secondary: #94a3b8
- Accent: #3b82f6
- Success: #22c55e
- Error: #ef4444

## State (5 variables)
- activeTab: number, default 0
- items: array of objects (name, value, status)
- searchQuery: string, default ''
- sortMode: number, default 0
- selectedItem: number, default 0

## Components (3)
- StatusDot: colored dot based on status field
- StatCard: displays name + value + status dot
- TabBar: horizontal tab buttons, active state highlighted

## Layout
- Full width/height, column layout
- TabBar at top
- Scrollable list of StatCards below
- Footer with item count and search query display

## Interactions
- Tab buttons switch activeTab
- Each tab filters items by status
- Tapping a card sets selectedItem
```

Each lane reads this manifest and implements it. No peeking at the other lanes.
