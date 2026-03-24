#!/usr/bin/env python3
"""Storybook infinite canvas layout calculator.

Computes Canvas.Node gx/gy positions for the HomePage tile grid.
Each column has a staggered start_y so there's no hard horizontal
edge across the top. Within each column, tiles stack with GAP=30.

Usage:
    python3 scripts/storybook-layout.py

Workflow for new tiles:
    1. Pick an existing column with room (prefer denser grid over wider)
    2. Append height=300 (default) to that column's heights array
    3. Run script to get gx/gy, add Canvas.Node with gh=300
    4. Build & run — measure actual rendered height
    5. Update heights array with real measured value
    6. Re-run script to get final gx/gy positions
"""

GAP = 30
TILE_WIDTH = 260

# Column data: gx -> (start_y, [measured_heights], [tile_labels])
# start_y is staggered per column — no uniform top edge.
# Heights are MEASURED from rendered output, not guesses.
columns = {
    -1050: (-630, [144, 62, 86, 72, 134, 66],
            ["Bar Chart", "Toggles", "Progress", "Status Dots", "Bar Chart B", "Neutral Scale"]),
    -750:  (-650, [123, 87, 65, 101, 118, 84],
            ["Typography", "Cards", "Text Input", "Large Title", "Spacing", "Borders"]),
    -450:  (-650, [112, 76, 110, 86, 300],
            ["Accent Colors", "Nested Boxes", "Surfaces", "Color Palette", "Transitions"]),
    -150:  (-660, [72, 67, 60, 88, 300],
            ["Action Row", "Badges", "Graph Nodes", "Buttons", "3D Scene"]),
    150:   (-670, [74, 96, 82, 134, 300],
            ["Flex Column", "Flex Wrap", "Flex Row", "Distribution", "ScrollView"]),
    450:   (-680, [80, 66, 92, 87, 300],
            ["Pills", "Input States", "Cards B", "Shapes", "Hyperlinks"]),
    750:   (-640, [139, 66, 66, 122, 300],
            ["Warm Scale", "Cool Scale", "Bar Chart C", "Elevation", "Opacity"]),
    1050:  (-640, [139, 58, 65, 66, 300],
            ["Tags", "Outline Buttons", "Purple Scale", "Bar Chart D", "TextArea"]),
}


def compute_positions():
    """Compute and print all tile positions."""
    print(f"Storybook Layout — GAP={GAP}, TILE_WIDTH={TILE_WIDTH}")
    print(f"{'='*60}")
    for gx in sorted(columns.keys()):
        start_y, heights, labels = columns[gx]
        gy = start_y
        print(f"\nColumn gx={gx} (start_y={start_y}):")
        for i, (h, label) in enumerate(zip(heights, labels)):
            print(f"  Tile {i} ({label}): gx={gx} gy={gy} gw={TILE_WIDTH} gh={h}")
            gy += h + GAP
        bottom = gy - GAP
        print(f"  — bottom edge: {bottom}")

    # Grid lines
    min_gx = min(columns.keys()) - 150
    max_gx = max(columns.keys()) + 150 + TILE_WIDTH
    print(f"\nGrid lines: x from {min_gx} to {max_gx} (step 300)")
    x = min_gx
    while x <= max_gx:
        print(f"  <Canvas.Path d=\"M {x},-2000 L {x},2000\" stroke=\"#1c2333\" strokeWidth={{1}} />")
        x += 300

    num_cols = len(columns)
    print(f"\nhopToTile: hopTo((idx % {num_cols}) * 300 - 1050, 0);")


if __name__ == "__main__":
    compute_positions()
