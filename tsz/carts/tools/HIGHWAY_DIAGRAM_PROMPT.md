# Highway Diagram — Add to Progress Cart

## What

Add a tab/panel to the progress cart that renders the compiler's lane architecture as a visual diagram using `Graph.Path` on a canvas.

## The Shape

It's NOT a flowchart. It's one straight horizontal line (the compile baseline) with parabolic arcs that leave the line and come back. Think of it like I-5 from Portland to Seattle — one highway, three cars that take scenic exits and rejoin.

```
          ╭─ soup ─╮              ╭─ soup ─╮
         ╱          ╲            ╱          ╲
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
.tsz in   lex    detect   shared parse    shared collect     emit      .zig out
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ╲          ╱            ╲          ╱
          ╰ mixed ─╯              ╰ mixed ─╯
         ╲          ╱            ╲          ╱
          ╰─ chad ─╯              ╰─ chad ─╯
                                 ╲    ╱╲    ╱
                                  ╰──╯  ╰──╯
                                  sub-lanes
```

## How to Draw It

Use `Graph.Path` with SVG-style arc commands. The constraint graph cart (`carts/conformance/mixed/constraint-graph/`) already does exactly this — SVG paths rendered as canvas paths.

### Elements

1. **Baseline** — one horizontal `Graph.Path` line from left edge to right edge, centered vertically. Color: `#475569`. This is I-5.

2. **Stage markers** — vertical tick marks on the baseline at each shared stage:
   - `.tsz in` (start)
   - `lex` 
   - `detect`
   - `shared parse`
   - `shared collect`
   - `emit`
   - `.zig out` (end)
   Label each with `Text` below the baseline.

3. **Soup arcs** (above baseline, color `#22c55e`) — parabolic arcs that leave the baseline at `detect`, peak above, and rejoin at `shared parse`. Then another arc from `shared parse` to `shared collect`. Use quadratic bezier curves (`Q` command in SVG path).

4. **Mixed arcs** (below baseline, color `#3b82f6`) — same shape, mirrored below. Arcs leave at `detect`, rejoin at `shared parse`, leave again, rejoin at `emit`.

5. **Chad arcs** (further below baseline, color `#a855f7`) — same pattern but with nested sub-arcs within the main arc. The main chad arc goes from `detect` to `shared parse`. Within that arc, smaller sub-arcs branch for widget/app/lib/module.

6. **Labels at arc peaks** — at the top of each parabola, label what happens there:
   - Soup: "html mapping", "css normalize", "react compat"
   - Mixed: "jsx parse", "script bridge"
   - Chad: "blocks", "control flow", and nested: "widget", "app", "lib", "module"

### The Point

The baseline is straight and never bends. The parabolas are temporary departures that always come back. The height of each arc = how much lane-specific work happens. Soup's arcs are small (simple mapping). Chad's arcs are tall with nested sub-arcs (complex block parsing with sub-lanes for widget/app/lib/module).

### Reference

- Read `compiler/smith/HIGHWAY.md` for the full metaphor
- Read `compiler/smith/STRUCTURE.md` for the actual directory layout
- Look at `carts/conformance/mixed/constraint-graph/` for how Graph.Path works
