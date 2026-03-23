#!/usr/bin/env bash
# Downloads v86 emulator + builds CartridgeOS kernel for browser boot.
# Run once. Everything cached in os/web/v86/ and os/dist/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
V86_DIR="$SCRIPT_DIR/v86"
mkdir -p "$V86_DIR"

echo ""
echo "  CartridgeOS web setup"
echo ""

# ── v86 emulator files ────────────────────────────────────────────────
echo "  [1/3] Downloading v86 emulator..."

dl() {
    local url="$1" dest="$2"
    if [ -f "$dest" ]; then
        echo "        cached: $(basename "$dest")"
        return
    fi
    echo "        fetching: $(basename "$dest")..."
    curl -sL "$url" -o "$dest"
}

dl "https://github.com/copy/v86/releases/download/latest/libv86.js" "$V86_DIR/libv86.js"
dl "https://github.com/copy/v86/releases/download/latest/v86.wasm" "$V86_DIR/v86.wasm"
dl "https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin" "$V86_DIR/seabios.bin"
dl "https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin" "$V86_DIR/vgabios.bin"

echo ""

# ── Build CartridgeOS kernel + initramfs ──────────────────────────────
echo "  [2/3] Building CartridgeOS (if needed)..."
if [ ! -f "$OS_DIR/dist/vmlinuz" ] || [ ! -f "$OS_DIR/dist/initrd.cpio.gz" ]; then
    bash "$OS_DIR/build.sh"
else
    echo "        kernel + initramfs cached"
fi

# Symlink into web dir for serving
ln -sf "$OS_DIR/dist/vmlinuz" "$SCRIPT_DIR/vmlinuz"
ln -sf "$OS_DIR/dist/initrd.cpio.gz" "$SCRIPT_DIR/initrd.cpio.gz"
echo ""

# ── Build tsz-runtime.wasm ───────────────────────────────────────────
echo "  [3/3] Building tsz-runtime.wasm (if needed)..."
REPO_ROOT="$(cd "$OS_DIR/.." && pwd)"
if [ ! -f "$REPO_ROOT/tsz/zig-out/bin/tsz-runtime.wasm" ]; then
    (cd "$REPO_ROOT/tsz" && zig build wasm-rt)
else
    echo "        tsz-runtime.wasm cached"
fi
ln -sf "$REPO_ROOT/tsz/zig-out/bin/tsz-runtime.wasm" "$SCRIPT_DIR/tsz-runtime.wasm"
echo ""

# ── Summary ──────────────────────────────────────────────────────────
echo "  Ready! Files:"
ls -lh "$V86_DIR"/libv86.js "$V86_DIR"/v86.wasm "$V86_DIR"/seabios.bin "$V86_DIR"/vgabios.bin 2>/dev/null | awk '{print "    " $5 "  " $NF}'
ls -lh "$SCRIPT_DIR"/vmlinuz "$SCRIPT_DIR"/initrd.cpio.gz "$SCRIPT_DIR"/tsz-runtime.wasm 2>/dev/null | awk '{print "    " $5 "  " $NF}'
echo ""
echo "  Serve: cd os/web && python3 -m http.server 8080"
echo "  Open:  http://localhost:8080/index.html"
echo ""
