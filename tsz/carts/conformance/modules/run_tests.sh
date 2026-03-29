#!/bin/bash
# Module conformance test runner
# Usage: ./run_tests.sh [test_name]
#   ./run_tests.sh          — run all m*.mod.tsz tests
#   ./run_tests.sh m01      — run only m01

set -euo pipefail
cd "$(dirname "$0")/../../.."

FORGE="./zig-out/bin/forge"
PASS=0
FAIL=0
ERRORS=""

if [ ! -f "$FORGE" ]; then
    echo "Building forge..."
    zig build forge || { echo "FATAL: forge build failed"; exit 1; }
fi

FILTER="${1:-}"

for input in carts/conformance/modules/m*.mod.tsz; do
    name=$(basename "$input" .mod.tsz)

    # Skip if filter provided and doesn't match (prefix match: m01 matches m01_types)
    if [ -n "$FILTER" ] && [[ "$name" != ${FILTER}* ]]; then
        continue
    fi

    expected="carts/conformance/modules/${name}.expected.zig"
    if [ ! -f "$expected" ]; then
        echo "SKIP $name — no .expected.zig"
        continue
    fi

    echo -n "TEST $name ... "

    # Run forge in mod mode
    # Forge keeps .mod in the stem: generated_m01_types.mod.zig
    stem=$(basename "$input" .tsz)  # e.g. m01_types.mod
    actual_file="generated_${stem}.zig"
    if $FORGE build --mod "$input" 2>/tmp/forge_stderr_$$; then
        if [ -f "$actual_file" ]; then
            # Strip integrity header lines added by stampIntegrity()
            sed -i '/^\/\/! integrity:/d; /^\/\/! DO NOT EDIT/d' "$actual_file"
            # Compare output
            if diff -u "$expected" "$actual_file" > "/tmp/diff_${name}_$$" 2>&1; then
                echo "PASS"
                PASS=$((PASS + 1))
            else
                echo "FAIL (output differs)"
                cat "/tmp/diff_${name}_$$"
                FAIL=$((FAIL + 1))
                ERRORS="$ERRORS\n  $name: output differs"
            fi
            rm -f "$actual_file"
        else
            echo "FAIL (no output file)"
            FAIL=$((FAIL + 1))
            ERRORS="$ERRORS\n  $name: forge produced no output"
        fi
    else
        echo "FAIL (forge error)"
        cat /tmp/forge_stderr_$$ 2>/dev/null || true
        FAIL=$((FAIL + 1))
        ERRORS="$ERRORS\n  $name: forge exited with error"
    fi

    rm -f /tmp/forge_stderr_$$ "/tmp/diff_${name}_$$"
done

echo ""
echo "═══════════════════════════════════"
echo "  PASS: $PASS  FAIL: $FAIL"
if [ $FAIL -gt 0 ]; then
    echo -e "  Failures:$ERRORS"
fi
echo "═══════════════════════════════════"

exit $FAIL
