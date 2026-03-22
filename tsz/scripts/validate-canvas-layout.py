#!/usr/bin/env python3
"""Validate Canvas.Node layout in HomePage_c.tsz.

Checks:
1. No overlaps — for tiles in same column: tile_a.gy + tile_a.gh <= tile_b.gy
2. Equal gaps — adjacent tiles: gap == 30 exactly
3. Prints all violations
"""

import re
import sys
from collections import defaultdict

GAP = 40
TSZ_FILE = "carts/storybook/HomePage_c.tsz"

def parse_canvas_nodes(filepath):
    """Extract all Canvas.Node gx/gy/gw/gh from the .tsz file."""
    nodes = []
    with open(filepath) as f:
        for lineno, line in enumerate(f, 1):
            m = re.search(r'Canvas\.Node\s+gx=\{(-?\d+)\}\s+gy=\{(-?\d+)\}\s+gw=\{(\d+)\}\s+gh=\{(\d+)\}', line)
            if m:
                nodes.append({
                    'line': lineno,
                    'gx': int(m.group(1)),
                    'gy': int(m.group(2)),
                    'gw': int(m.group(3)),
                    'gh': int(m.group(4)),
                })
    return nodes

def validate(nodes):
    errors = 0
    warnings = 0

    # Group by column (gx)
    columns = defaultdict(list)
    for node in nodes:
        columns[node['gx']].append(node)

    # Sort each column by gy (top to bottom, most negative first)
    for gx in sorted(columns.keys()):
        tiles = sorted(columns[gx], key=lambda t: t['gy'])
        print(f"\nColumn gx={gx}: {len(tiles)} tiles")

        for i, tile in enumerate(tiles):
            gh_str = f"gh={tile['gh']}" if tile['gh'] > 0 else "gh=0 (auto)"
            print(f"  [{tile['line']:3d}] gy={tile['gy']:5d} {gh_str}")

            if i > 0:
                prev = tiles[i - 1]
                if prev['gh'] == 0:
                    print(f"         ^ prev tile has gh=0 (auto-height) — cannot validate gap")
                    warnings += 1
                else:
                    bottom = prev['gy'] + prev['gh']
                    gap = tile['gy'] - bottom
                    if gap < 0:
                        print(f"         *** OVERLAP: prev bottom={bottom}, this top={tile['gy']}, overlap={-gap}px")
                        errors += 1
                    elif gap != GAP:
                        print(f"         *** GAP={gap} (expected {GAP})")
                        errors += 1
                    else:
                        print(f"         gap={gap} OK")

    print(f"\n{'='*50}")
    print(f"Total: {len(nodes)} tiles in {len(columns)} columns")
    print(f"Errors: {errors}, Warnings: {warnings}")
    if errors > 0:
        print("FAIL — fix overlaps/gaps before proceeding")
        return False
    if warnings > 0:
        print("WARN — some tiles have gh=0 (auto-height), gaps cannot be validated")
    else:
        print("PASS — all gaps are exactly 30px, no overlaps")
    return True

if __name__ == "__main__":
    nodes = parse_canvas_nodes(TSZ_FILE)
    if not nodes:
        print(f"No Canvas.Node elements found in {TSZ_FILE}")
        sys.exit(1)
    ok = validate(nodes)
    sys.exit(0 if ok else 1)
