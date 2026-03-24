#!/usr/bin/env bash
# CartridgeOS build.sh — x86_64 kernel + busybox + tsz app + GPU drivers
#
# Cross-compiles tsz (lean tier) to x86_64-linux-musl using an Alpine sysroot.
# Includes Mesa virtio-gpu drivers + SDL2 for DRM/KMS rendering.
#
# Dependencies: zig, qemu-system-x86_64, cpio, gzip, curl
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"
PARTS="$DIST_DIR/parts"
SYSROOT="$DIST_DIR/sysroot"
CACHE_DIR="$DIST_DIR/cache"
QJS_SRC="$REPO_ROOT/love2d/quickjs"

ALPINE_VERSION="v3.21"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
ALPINE_ARCH="x86_64"

echo ""
echo "  CartridgeOS build (x86_64 — tsz + GPU + Linux)"
echo "  Native rendering via virtio-gpu + DRM/KMS"
echo ""

mkdir -p "$DIST_DIR" "$STAGING" "$PARTS" "$CACHE_DIR"

# ── Step 1: Compile init.zig (static musl PID 1) ──────────────────────
echo "  [1/7] Compiling init.zig..."
zig build-exe \
    "$SCRIPT_DIR/init.zig" \
    -target x86_64-linux-musl \
    -OReleaseFast \
    --name init \
    -femit-bin="$DIST_DIR/init" \
    2>&1
chmod +x "$DIST_DIR/init"
echo "        init: $(du -sh "$DIST_DIR/init" | cut -f1)"

# Compile bridge (HTTP server)
echo "        compiling bridge..."
zig build-exe \
    "$SCRIPT_DIR/bridge.zig" \
    -target x86_64-linux-musl \
    -OReleaseFast \
    --name bridge \
    -femit-bin="$DIST_DIR/bridge" \
    2>&1
chmod +x "$DIST_DIR/bridge"
echo "        bridge: $(du -sh "$DIST_DIR/bridge" | cut -f1)"
echo ""

# ── Step 2: Build QuickJS (static musl binary) ────────────────────────
echo "  [2/7] Building QuickJS..."
QJS_SRCS=(
    "$QJS_SRC/quickjs.c"
    "$QJS_SRC/quickjs-libc.c"
    "$QJS_SRC/cutils.c"
    "$QJS_SRC/dtoa.c"
    "$QJS_SRC/libregexp.c"
    "$QJS_SRC/libunicode.c"
    "$QJS_SRC/qjs.c"
    "$QJS_SRC/gen/repl.c"
    "$QJS_SRC/gen/standalone.c"
)

zig cc -target x86_64-linux-musl -O2 -static \
    -D_GNU_SOURCE -DQUICKJS_NG_BUILD \
    -I"$QJS_SRC" \
    "${QJS_SRCS[@]}" \
    -lm \
    -o "$DIST_DIR/qjs" \
    2>&1
chmod +x "$DIST_DIR/qjs"
echo "        qjs: $(du -sh "$DIST_DIR/qjs" | cut -f1)"
echo ""

# ── Step 3: Download apk.static (cached) ──────────────────────────────
APK_STATIC="$CACHE_DIR/apk.static"
if [ ! -x "$APK_STATIC" ]; then
    echo "  [3/7] Downloading apk-tools-static..."
    APK_INDEX=$(curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/" \
        | grep -o "apk-tools-static-[^\"]*\.apk" | head -1)
    curl -sL "$ALPINE_MIRROR/$ALPINE_VERSION/main/$ALPINE_ARCH/$APK_INDEX" \
        -o "$CACHE_DIR/apk-tools-static.apk"
    (cd "$CACHE_DIR" && tar xzf apk-tools-static.apk sbin/apk.static 2>/dev/null \
        && mv sbin/apk.static . && rmdir sbin)
    chmod +x "$APK_STATIC"
    echo "        apk.static: $($APK_STATIC --version)"
else
    echo "  [3/7] apk.static cached"
fi
echo ""

# ── Step 4: Install Alpine packages (runtime + kernel) ────────────────
echo "  [4/7] Installing Alpine packages (runtime)..."
rm -rf "$PARTS"
mkdir -p "$PARTS"

"$APK_STATIC" add \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/main" \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/community" \
    -U --allow-untrusted \
    --root "$PARTS" \
    --initdb \
    --arch "$ALPINE_ARCH" \
    --no-scripts \
    --no-cache \
    busybox \
    linux-virt \
    musl \
    sdl2 \
    freetype \
    mesa-dri-gallium \
    mesa-egl \
    mesa-gbm \
    mesa-gl \
    libdrm \
    libxkbcommon \
    eudev-libs \
    2>&1 | grep -E "^(\(|OK:)" || true

PARTS_SIZE=$(du -sm "$PARTS" | cut -f1)
echo "        runtime packages: ${PARTS_SIZE}M"
echo ""

# ── Step 5: Create sysroot with dev packages for cross-compile ────────
echo "  [5/7] Creating cross-compile sysroot..."
rm -rf "$SYSROOT"
mkdir -p "$SYSROOT"

"$APK_STATIC" add \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/main" \
    -X "$ALPINE_MIRROR/$ALPINE_VERSION/community" \
    -U --allow-untrusted \
    --root "$SYSROOT" \
    --initdb \
    --arch "$ALPINE_ARCH" \
    --no-scripts \
    --no-cache \
    musl-dev \
    sdl2-dev \
    freetype-dev \
    mesa-dev \
    libdrm-dev \
    2>&1 | grep -E "^(\(|OK:)" || true

SYSROOT_SIZE=$(du -sm "$SYSROOT" | cut -f1)
echo "        sysroot: ${SYSROOT_SIZE}M"
echo ""

# ── Step 6: Cross-compile tsz app ─────────────────────────────────────
echo "  [6/7] Cross-compiling tsz app (lean tier)..."
cd "$REPO_ROOT/tsz"
zig build dist-lean \
    -Dtarget=x86_64-linux-musl \
    -Doptimize=ReleaseFast \
    -Dsysroot="$SYSROOT" \
    2>&1
TSZ_BIN="$REPO_ROOT/tsz/zig-out/bin/zigos-lean"
if [ -f "$TSZ_BIN" ]; then
    chmod +x "$TSZ_BIN"
    echo "        tsz: $(du -sh "$TSZ_BIN" | cut -f1)"
else
    echo "        ERROR: tsz binary not found at $TSZ_BIN"
    exit 1
fi
cd "$SCRIPT_DIR"
echo ""

# ── Extract kernel ──
echo "        extracting kernel..."
cp "$PARTS/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# ── Step 7: Build staging tree ─────────────────────────────────────────
echo "  [7/7] Building staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{dev,proc,sys,tmp,app,run}
mkdir -p "$STAGING"/{bin,sbin,lib,usr/bin,usr/lib}
mkdir -p "$STAGING"/usr/lib/xorg/modules/dri
mkdir -p "$STAGING"/usr/share/libdrm
mkdir -p "$STAGING"/etc/udev

# Binaries
cp "$PARTS/bin/busybox"  "$STAGING/bin/busybox"
cp "$DIST_DIR/qjs"       "$STAGING/usr/bin/qjs"
chmod +x "$STAGING/bin/busybox" "$STAGING/usr/bin/qjs"

# musl dynamic linker (SDL2 and Mesa are shared libs)
MUSL_LD=$(find "$PARTS/lib" -name 'ld-musl-*.so*' -type f 2>/dev/null | head -1)
if [ -n "$MUSL_LD" ]; then
    cp "$MUSL_LD" "$STAGING/lib/$(basename "$MUSL_LD")"
fi

# musl libc
MUSL_LIBC=$(find "$PARTS/lib" -name 'libc.musl-*.so*' -type f 2>/dev/null | head -1)
if [ -n "$MUSL_LIBC" ]; then
    cp -a "$MUSL_LIBC" "$STAGING/lib/$(basename "$MUSL_LIBC")"
fi

# Shared libraries needed at runtime: SDL2, freetype, Mesa, libdrm, etc.
# Use cp -a with glob patterns to catch all naming variants (e.g., libSDL2-2.0.so.*)
echo "        copying shared libraries..."
for pattern in \
    'libSDL2*so*' 'libfreetype*so*' 'libdrm*so*' \
    'libEGL*so*' 'libGLESv2*so*' 'libgbm*so*' 'libglapi*so*' \
    'libexpat*so*' 'libz.so*' 'libffi*so*' 'libbz2*so*' 'libpng16*so*' \
    'libbrotlidec*so*' 'libbrotlicommon*so*' \
    'libxkbcommon*so*' 'libudev*so*' \
    'libgcc_s*so*' 'libstdc++*so*' \
    'libelf*so*' \
    'libX11*so*' 'libxcb*so*' 'libXau*so*' 'libXdmcp*so*' 'libXext*so*' \
    'libXfixes*so*' 'libxshmfence*so*' 'libXxf86vm*so*' \
    'libbsd*so*' 'libmd*so*' \
    'libxml2*so*' 'libxzd*so*' 'liblzma*so*' 'libzstd*so*' \
    'libwayland*so*' \
    'libGL.so*' 'libGLX*so*'; do
    for dir in "$PARTS/usr/lib" "$PARTS/lib"; do
        for f in $dir/$pattern; do
            [ -e "$f" ] || continue
            cp -a "$f" "$STAGING/usr/lib/" 2>/dev/null || true
        done
    done
done

# Mesa DRI drivers (virtio_gpu_dri.so)
DRI_DIR=$(find "$PARTS/usr/lib" -type d -name "dri" 2>/dev/null | head -1)
if [ -n "$DRI_DIR" ] && [ -d "$DRI_DIR" ]; then
    cp -a "$DRI_DIR"/* "$STAGING/usr/lib/xorg/modules/dri/" 2>/dev/null || true
    # Also put in /usr/lib/dri (Mesa default search path)
    mkdir -p "$STAGING/usr/lib/dri"
    cp -a "$DRI_DIR"/* "$STAGING/usr/lib/dri/" 2>/dev/null || true
fi

# Kernel modules (virtio-gpu)
echo "        copying kernel modules..."
KMOD_DIR=$(find "$PARTS/lib/modules" -maxdepth 1 -type d -name '*-virt' 2>/dev/null | head -1)
if [ -n "$KMOD_DIR" ]; then
    mkdir -p "$STAGING/lib/modules"
    cp -a "$KMOD_DIR" "$STAGING/lib/modules/"
fi

# /init (Zig PID 1) + bridge (HTTP server)
cp "$DIST_DIR/init" "$STAGING/init"
cp "$DIST_DIR/bridge" "$STAGING/usr/bin/bridge"
chmod +x "$STAGING/usr/bin/bridge"

# tsz app binary
cp "$TSZ_BIN" "$STAGING/app/tsz"
chmod +x "$STAGING/app/tsz"

# Default JS app (fallback)
cat > "$STAGING/app/main.js" << 'MAINJS'
print('');
print('  CartridgeOS v0.3 (x86_64)');
print('  tsz + virtio-gpu + DRM/KMS');
print('');
MAINJS

echo ""

# ── Report ──
echo "        === staging manifest ==="
echo "          $(du -sh "$STAGING/bin/busybox" | cut -f1)  /bin/busybox"
echo "          $(du -sh "$STAGING/usr/bin/qjs" | cut -f1)  /usr/bin/qjs"
echo "          $(du -sh "$STAGING/usr/bin/bridge" | cut -f1)  /usr/bin/bridge"
echo "          $(du -sh "$STAGING/init" | cut -f1)  /init"
echo "          $(du -sh "$STAGING/app/tsz" | cut -f1)  /app/tsz"
[ -d "$STAGING/usr/lib/dri" ] && echo "          $(du -sh "$STAGING/usr/lib/dri" | cut -f1)  /usr/lib/dri/"
[ -d "$STAGING/lib/modules" ] && echo "          $(du -sh "$STAGING/lib/modules" | cut -f1)  /lib/modules/"

STAGING_SIZE=$(du -sm "$STAGING" | cut -f1)
echo ""
echo "        staging total: ${STAGING_SIZE}M"
echo ""

# ── Package initramfs ──────────────────────────────────────────────────
echo "  Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "        initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)"
echo ""

# ── Cleanup ──
rm -rf "$PARTS" "$SYSROOT"

echo "  Done!"
echo "  Test:    bash os/run.sh       (QEMU with virtio-gpu)"
echo "  Browser: open os/web/index.html"
echo ""
