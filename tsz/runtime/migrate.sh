#!/bin/bash
# migrate.sh — Move runtime to tsz/ source + compiled/ output structure
#
# Run from repo root: bash tsz/runtime/migrate.sh
#
# What it does:
#   1. Creates runtime/tsz/ and runtime/compiled/ directories
#   2. Moves all .tsz files into runtime/tsz/
#   3. Moves layout.tsz from experimental/ into runtime/tsz/
#   4. Compiles all .tsz files → runtime/compiled/
#   5. Moves remaining .zig files (the todo pile) into runtime/compiled/
#      (they'll be replaced as .tsz rewrites happen)
#   6. Updates net/ subdirectory structure
#
# Safe to run multiple times — skips already-moved files.

set -e
cd "$(dirname "$0")/../.." # repo root

RUNTIME="tsz/runtime"
TSZ_DIR="$RUNTIME/tsz"
COMPILED_DIR="$RUNTIME/compiled"
COMPILER="./zig-out/bin/tsz"

echo "=== tsz runtime migration ==="

# Ensure compiler is built
if [ ! -f "$COMPILER" ]; then
    echo "Building compiler..."
    zig build tsz-compiler
fi

# Create directories
mkdir -p "$TSZ_DIR" "$TSZ_DIR/net" "$TSZ_DIR/framework/inspector"
mkdir -p "$COMPILED_DIR" "$COMPILED_DIR/net" "$COMPILED_DIR/user" "$COMPILED_DIR/framework" "$COMPILED_DIR/framework/inspector"

# 1. Move .tsz files from runtime/ to runtime/tsz/
echo ""
echo "--- Moving .tsz source files to $TSZ_DIR/ ---"
for f in "$RUNTIME"/*.tsz; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    if [ ! -f "$TSZ_DIR/$base" ]; then
        echo "  mv $base → tsz/"
        mv "$f" "$TSZ_DIR/$base"
    else
        echo "  skip $base (already in tsz/)"
    fi
done

# Move layout.tsz from experimental/ if it exists
if [ -f "tsz/experimental/layout.tsz" ] && [ ! -f "$TSZ_DIR/layout.tsz" ]; then
    echo "  mv layout.tsz (from experimental/) → tsz/"
    cp "tsz/experimental/layout.tsz" "$TSZ_DIR/layout.tsz"
fi

# Move gpu.tsz from experimental/ if it exists
if [ -f "tsz/experimental/gpu.tsz" ] && [ ! -f "$TSZ_DIR/gpu.tsz" ]; then
    echo "  mv gpu.tsz (from experimental/) → tsz/"
    cp "tsz/experimental/gpu.tsz" "$TSZ_DIR/gpu.tsz"
fi

# 2. Compile all .tsz files → compiled/
echo ""
echo "--- Compiling .tsz → .zig ---"
for f in "$TSZ_DIR"/*.tsz; do
    [ -f "$f" ] || continue
    base=$(basename "$f" .tsz)
    echo "  compile $base.tsz → compiled/$base.zig"
    $COMPILER compile-runtime -o "$COMPILED_DIR" "$f" 2>&1 | grep -v "^\[tsz\]" || true
done

# 3. Move remaining hand-written .zig to compiled/ (they're the todo pile)
echo ""
echo "--- Moving remaining .zig files to $COMPILED_DIR/ ---"
for f in "$RUNTIME"/*.zig; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # Skip if already has a .gen.zig from compilation
    stem=$(basename "$f" .zig)
    if [ -f "$COMPILED_DIR/${stem}.gen.zig" ]; then
        echo "  skip $base (replaced by ${stem}.gen.zig)"
        # Remove the hand-written version — the .gen.zig replaces it
        rm "$f"
        # Rename .gen.zig to .zig for import compatibility
        mv "$COMPILED_DIR/${stem}.gen.zig" "$COMPILED_DIR/$base"
        echo "  rename ${stem}.gen.zig → $base"
        continue
    fi
    if [ ! -f "$COMPILED_DIR/$base" ]; then
        echo "  mv $base → compiled/ (hand-written, needs .tsz rewrite)"
        mv "$f" "$COMPILED_DIR/$base"
    else
        echo "  skip $base (already in compiled/)"
    fi
done

# Move net/ subdirectory
if [ -d "$RUNTIME/net" ]; then
    echo ""
    echo "--- Moving net/ files ---"
    for f in "$RUNTIME/net"/*.zig; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        if [ ! -f "$COMPILED_DIR/net/$base" ]; then
            echo "  mv net/$base → compiled/net/"
            mv "$f" "$COMPILED_DIR/net/$base"
        fi
    done
fi

# Move framework/ files
if [ -d "$RUNTIME/framework" ]; then
    echo ""
    echo "--- Moving framework/ files ---"
    for f in "$RUNTIME/framework/inspector"/*.zig; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        if [ ! -f "$COMPILED_DIR/framework/inspector/$base" ]; then
            echo "  mv framework/inspector/$base → compiled/framework/inspector/"
            mv "$f" "$COMPILED_DIR/framework/inspector/$base"
        fi
    done
fi

# Move stb/ and other non-zig dirs
for subdir in stb; do
    if [ -d "$RUNTIME/$subdir" ] && [ ! -d "$COMPILED_DIR/$subdir" ]; then
        echo "  mv $subdir/ → compiled/"
        mv "$RUNTIME/$subdir" "$COMPILED_DIR/$subdir"
    fi
done

# Move ffi_libs.txt if present
if [ -f "$RUNTIME/ffi_libs.txt" ]; then
    mv "$RUNTIME/ffi_libs.txt" "$COMPILED_DIR/ffi_libs.txt"
fi

# Summary
echo ""
echo "=== Migration complete ==="
echo ""
TSZ_COUNT=$(ls "$TSZ_DIR"/*.tsz 2>/dev/null | wc -l)
ZIG_COUNT=$(ls "$COMPILED_DIR"/*.zig 2>/dev/null | wc -l)
echo "Source files (tsz/):     $TSZ_COUNT .tsz"
echo "Compiled files (compiled/): $ZIG_COUNT .zig"
echo ""
echo "The .zig files in compiled/ that DON'T have a matching .tsz in tsz/"
echo "are the remaining hand-written files that need .tsz rewrites."
echo ""
echo "Next: update build.zig to point at runtime/compiled/ for the engine build."
