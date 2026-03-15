# Overlays, Tooltips, Dropdowns, And Modals Port Plan

## Goal

Port the mature Love2D overlay behavior into `tsz` as one coherent system.

This should not become three unrelated features.
`tooltips`, `dropdowns/select`, `modals`, `popovers`, and later `context menus` all need the same underlying capability:

- render above normal layout
- avoid participating in flex flow
- anchor to screen or a trigger node
- stay correct inside scroll containers
- take input before underlying content when appropriate

The right `tsz` port is therefore a window-scoped overlay/portal system, plus one runtime-owned tooltip manager on top of it.

## Lua Reference Implementations

### Global overlay passes

- `love2d/lua/tooltips.lua`
  - unified hover tooltip system
  - supports `cursor`, `anchor`, and `corner` placement
  - subtracts ancestor scroll offsets before positioning
  - clamps to the viewport

- `love2d/lua/contextmenu.lua`
  - global floating menu
  - owns open state, hover, click selection, arrow-key navigation, and Escape
  - useful reference for overlay-first input capture

- `love2d/lua/init.lua`
  - draws tooltips and other overlays after tree painting
  - the real mature behavior is "tree render first, then late overlay passes"

### Tree-level composition patterns

- `love2d/packages/core/src/Portal.tsx`
  - React-context-based portal reparenting into a host-owned full-screen absolute layer

- `love2d/packages/core/src/Modal.tsx`
  - desired public API shape for modal composition
  - useful as an API reference, not as the `tsz` implementation model

### Interaction and stacking references

- `love2d/lua/events.lua`
  - hit testing uses paint order within a parent
  - scroll containers adjust hit coordinates

- `love2d/lua/painter.lua`
  - siblings are z-sorted during paint
  - this is still parent-local ordering, not a true global overlay system

- `love2d/lua/select.lua`
  - mature dropdown/select interaction rules
  - useful for trigger/open/hover/keyboard behavior

- `love2d/lua/widgets.lua`
  - important detail: active widgets keep receiving mouse-move handling even when the pointer leaves their base bounds

## tsz Reality Check

### What already exists

- `tsz/runtime/layout.zig`
  - already supports `position`, `top/left/right/bottom`, `overflow`, and `z_index`

- `tsz/compiler/codegen.zig`
  - already lowers `position`, `overflow`, `top/left/right/bottom`, and `zIndex`

- `tsz/runtime/compositor.zig`
  - already z-sorts siblings during paint

- `tsz/runtime/windows.zig`
  - already has per-window roots and separate input routing

This means the port is not blocked on flexbox or basic absolute positioning.

### Hard blockers

- There is no portal or overlay root in `tsz`.
- There is no anchor-rect or arbitrary node-geometry API for userland components.
- `tsz/runtime/events.zig` does not z-sort children during hit testing, so paint order and click order already diverge.
- `tsz/compiler/loop_template.txt` routes keys to the focused input or the hovered node, not to an active overlay stack.
- `tsz/runtime/windows.zig` duplicates the same hover/click limitations for secondary windows.
- `tsz/runtime/inspector.zig` has its own deep hit test path and will also miss overlay semantics unless updated.
- `tsz` has no generic runtime props table, so a tooltip port cannot just "store the Lua tooltip object on the node" without explicit compiler/runtime support.

### Important conclusion

`position: 'absolute'` plus a high `zIndex` is not enough for a proper overlay port.

Why:

- paint ordering is still hierarchical
- a deeply nested overlay cannot reliably outpaint later-painted ancestor siblings
- once real overflow clipping is finished, accidental overlay escape will stop working
- keyboard handling still has no concept of "topmost active overlay"

So the port should not copy the `Modal.tsx` comment literally.
It should introduce an explicit overlay layer per window.

## Recommended tsz Shape

### 1. Implicit overlay root per window

`tsz` should have a built-in overlay root attached to each window.
Do not port Love2D's `PortalHost` literally. That host exists because React needs runtime reparenting through context.
`tsz` is compiler-driven and can target the window overlay root directly.

### 2. Compiler-recognized `Portal`

Add a structural `Portal` primitive that renders its subtree into the current window's overlay root instead of the normal parent tree.

This is the main escape hatch for:

- modals
- dropdowns
- popovers
- command palettes
- future context menus

### 3. Dedicated tooltip prop, not a portal-only solution

Tooltips should stay runtime-owned.
They are hover-driven, delayed, non-interactive, and geometry-sensitive.
That maps better to a tooltip manager than to userland portal composition.

### 4. Keep visual primitives unchanged

Do not add `Modal`, `Dropdown`, or `Select` as new core visual node types.

The repo philosophy is still right here:

- `Box`
- `Text`
- `Image`
- `Pressable`
- `ScrollView`
- `TextInput`

The port should add overlay plumbing, not special-case UI widgets.

## Port Strategy

### Phase 1: Add A Window-Scoped Overlay Runtime

New runtime module:

- `tsz/runtime/overlay.zig`

Responsibilities:

- keep per-window overlay registrations
- keep per-window anchor registrations
- define overlay layers and topmost ordering
- lay out overlay roots against the window viewport
- resolve anchored placement with flip/clamp rules
- expose overlay-aware paint and hit-test entry points

Each overlay entry should carry at least:

- root pointer
- z-order / layer
- optional anchor target
- placement mode
- modal flag
- whether it participates in hit testing

Likely runtime touchpoints:

- `tsz/runtime/layout.zig`
  - add node metadata fields needed for anchors / tooltip descriptors

- `tsz/runtime/compositor.zig`
  - paint base tree, then overlay roots, then tooltip layer

- `tsz/runtime/windows.zig`
  - each window slot needs its own overlay state

- `tsz/compiler/loop_template.txt`
  - main-window event loop must initialize, update, and query overlay state

This is the foundation. Do not start with a one-off modal implementation.

### Phase 2: Unify Paint Order, Hit Order, And Screen-Space Geometry

Before app overlays ship, fix the ordering mismatch.

Current bug:

- `tsz/runtime/compositor.zig` paints siblings in `z_index` order
- `tsz/runtime/events.zig` hit-tests in raw reverse child order

That will cause "looks on top, clicks underneath" failures immediately.

Required work:

- add one shared sibling-order helper used by compositor, events, and inspector
- make `events.hitTest()` match paint order
- make `events.findScrollContainer()` overlay-aware
- make `tsz/runtime/windows.zig` use the same overlay-first hit logic
- make `tsz/runtime/inspector.zig` understand overlay roots too

Also add one shared screen-space rect helper:

- walk ancestor scroll offsets
- convert a node's computed rect into visible window coordinates

That helper is needed by:

- anchored portals
- tooltips
- inspector overlays

Without this shared helper, the port will duplicate scroll math in three places and drift.

### Phase 3: Add Compiler Support For `Portal` And Anchors

Main compiler file:

- `tsz/compiler/codegen.zig`

Loop integration:

- `tsz/compiler/loop_template.txt`

Compiler work:

- recognize `<Portal>`
- lower its subtree into overlay registrations instead of normal child arrays
- recognize an anchor prop on normal nodes
  - recommended shape: `overlayAnchor="menu-button"`
- assign stable numeric anchor IDs at compile time
- recognize portal placement props

Recommended first portal props:

- `anchor`
- `placement`
- `offset`
- `matchWidth`
- `zIndex`
- `modal`

Compatibility note:

- `PortalHost` should not be required in `tsz`
- if source compatibility matters, it can compile to a no-op wrapper

Why anchors need compiler/runtime support:

- userland `.tsz` code cannot currently ask arbitrary nodes for their screen rects
- dropdown/popover placement needs real trigger geometry
- collision-aware placement needs runtime knowledge of overlay size and viewport size

### Phase 4: Port Tooltips As A Runtime Overlay Channel

Tooltip port should be built-in, not hand-rolled from portals.

New runtime module or overlay submodule:

- `tsz/runtime/tooltip.zig`
  - or fold it into `tsz/runtime/overlay.zig`

Compiler work:

- recognize `tooltip={...}` on any visual node
- lower a restricted tooltip schema into node metadata or side tables

Recommended first tooltip schema:

- `content`
- `type`: `cursor | anchor | corner`
- `anchor`: `top | bottom | left | right`
- `corner`: `top-left | top-right | bottom-left | bottom-right`
- `prefer`
- `layout`
- `delay`
- `maxWidth`
- `maxLines`

Runtime behavior to preserve from Lua:

- hover-driven visibility
- per-node delay
- anchor/cursor/corner placement
- ancestor-scroll correction
- viewport clamping
- non-interactive rendering

Layering rule:

- tooltips should render above normal content
- tooltips should render below modal/dropdown portal layers
- active modal overlays should suppress tooltips for underlying content

That matches the Love2D runtime more closely than making tooltips just another portal node.

### Phase 5: Modal Support As A Composed Portal Pattern

Once `Portal` exists, modal should be a composition pattern, not a new primitive.

Recommended shape:

- full-window portal root
- full-window backdrop `Pressable`
- centered content `Box` / `Pressable`

Required runtime behavior:

- overlay hit testing runs before the base tree
- backdrop blocks underlying pointer input
- modal-marked portal receives key handling before hovered base content
- opening a modal should unfocus an underlying `TextInput`

Likely touchpoints:

- `tsz/compiler/loop_template.txt`
  - route key events to the top modal overlay first

- `tsz/runtime/input.zig`
  - clear or scope focused input when modal overlays activate

Future improvement, not phase one:

- true focus trap / focus restoration for non-input focusable elements

`tsz` does not yet have a full focus system, so phase one should target the behavior it can actually enforce:

- Escape works
- backdrop dismiss works
- underlying clicks and scroll do not leak through

### Phase 6: Dropdowns, Popovers, And Select

Do not port `love2d/lua/select.lua` as a runtime-owned widget architecture.

That Lua design exists largely because Love2D has a JS↔Lua bridge and wants zero-latency interaction on the Lua side.
`tsz` compiles event logic to native Zig already, so once portal + anchor placement exist, dropdown interaction can stay declarative.

Recommended `tsz` shape:

- trigger node with `overlayAnchor`
- portal menu anchored to that trigger
- placement engine handles:
  - `bottom-start`
  - `bottom-end`
  - `top-start`
  - `top-end`
  - left/right variants later
- collision rules flip and clamp against the viewport
- optional `matchWidth` for select menus

Behavior parity worth preserving:

- outside click dismiss
- Escape dismiss
- arrow-key navigation
- Enter to commit
- scroll container correctness

The first canonical demo should be a `Select`-style menu built from:

- `useState`
- `Pressable`
- `Portal`
- anchor placement

That proves the system is general enough without inventing a new primitive.

### Phase 7: Extend The Same System To Future Overlay Cases

Once the above exists, the same substrate can absorb:

- context menus
- command palettes
- toasts / notifications
- inspector overlays
- devtools popouts inside a window

This is why the port should start from overlay infrastructure, not from `Modal` alone.

## Files Likely Touched

- `tsz/runtime/overlay.zig` new
- `tsz/runtime/tooltip.zig` new or merged into overlay runtime
- `tsz/runtime/compositor.zig`
- `tsz/runtime/events.zig`
- `tsz/runtime/windows.zig`
- `tsz/runtime/inspector.zig`
- `tsz/runtime/input.zig`
- `tsz/runtime/layout.zig`
- `tsz/compiler/codegen.zig`
- `tsz/compiler/loop_template.txt`
- `tsz/examples/overlay-stress.tsz` new

## Verification

Add one focused example app:

- `tsz/examples/overlay-stress.tsz`

It should prove all of these in one place:

- modal opened from deep inside nested layout still renders above sibling subtrees
- dropdown anchored inside a scroll container stays aligned while scrolling
- dropdown near the bottom/right edge flips or clamps correctly
- tooltip placement works for `cursor`, `anchor`, and `corner`
- overlay hit testing matches what is visually on top
- opening a modal in one window does not affect another window's overlays

Also add small runtime tests where practical:

- z-sorted hit-order helper
- anchor placement flip/clamp math
- overlay-first click routing

## Recommended Order

1. `overlay.zig` window-scoped registry and layout/paint hooks
2. shared z-order + screen-rect helpers
3. `Portal` + anchor compiler lowering
4. overlay-aware event routing in main loop and windows
5. tooltip runtime channel
6. modal composition example
7. dropdown/select example

That order gets the hard architectural work done once, then lets tooltips, dropdowns, and modals land on stable ground instead of each inventing its own escape hatch.
