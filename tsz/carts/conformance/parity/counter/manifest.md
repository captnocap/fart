# Counter — Parity Test

The simplest possible interactive app. Proves all 3 lanes can produce identical output for basic state + handlers + conditional rendering.

## Colors (4)
- Background: #0f172a
- Card background: #1e293b
- Text primary: #e2e8f0
- Accent blue: #3b82f6
- Decrement red: #dc2626
- Reset gray: #334155

## State (1)
- count: number, default 0

## Functions (3)
- increment: count + 1
- decrement: count - 1
- reset: count = 0

## Layout
- Full width/height, centered
- Single card container with padding and border radius
- Title text "Counter"
- Count display (large font)
- Subtitle: "Positive" when count > 0, "Zero" when count == 0, "Negative" when count < 0
- Row of 3 buttons: [-] [Reset] [+]
  - Decrement: red background, calls decrement
  - Reset: gray background, calls reset
  - Increment: blue background, calls increment

## Interactions
- Pressing [-] decreases count by 1
- Pressing [Reset] sets count to 0
- Pressing [+] increases count by 1
- Subtitle text updates based on count value
