#!/usr/bin/env bash
# CartridgeOS build.sh — Alpine + QuickJS, no LLVM
#
# Surgical rootfs: install Alpine packages into a temp tree,
# cherry-pick only the exact binaries and .so files needed.
# QuickJS replaces LuaJIT. LLVM (154M) replaced with a stub .so.
#
# Dependencies: zig, qemu-system-x86_64, cpio, gzip, readelf
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
STAGING="$DIST_DIR/staging"
PARTS="$DIST_DIR/parts"
CACHE_DIR="$DIST_DIR/cache"
QJS_SRC="$REPO_ROOT/love2d/quickjs"

ALPINE_VERSION="v3.21"
ALPINE_MIRROR="https://dl-cdn.alpinelinux.org/alpine"
ALPINE_ARCH="x86_64"

echo ""
echo "  CartridgeOS build (Zig + QuickJS)"
echo "  repo: $REPO_ROOT"
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
echo ""

# ── Step 2: Build QuickJS (static musl binary) ────────────────────────
echo "  [2/7] Building QuickJS..."
QJS_BUILD="$DIST_DIR/qjs-build"
mkdir -p "$QJS_BUILD"

QJS_SRCS=(
    "$QJS_SRC/quickjs.c"
    "$QJS_SRC/quickjs-libc.c"
    "$QJS_SRC/cutils.c"
    "$QJS_SRC/dtoa.c"
    "$QJS_SRC/libregexp.c"
    "$QJS_SRC/libunicode.c"
    "$QJS_SRC/qjs.c"
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

# ── Step 4: Install Alpine packages into parts bin ─────────────────────
echo "  [4/7] Installing Alpine packages..."
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
    sdl2 \
    mesa-dri-gallium \
    mesa-egl \
    mesa-gbm \
    mesa-gl \
    mesa-gles \
    libdrm \
    libstdc++ \
    libgcc \
    eudev-libs \
    font-liberation \
    freetype \
    linux-virt \
    2>&1 | grep -E "^(\(|OK:)" || true

PARTS_SIZE=$(du -sm "$PARTS" | cut -f1)
echo "        parts bin: ${PARTS_SIZE}M (throwaway)"
echo ""

# ── Step 5: Extract kernel ─────────────────────────────────────────────
echo "  [5/7] Extracting kernel..."
cp "$PARTS/boot/vmlinuz-virt" "$DIST_DIR/vmlinuz"
echo "        kernel: $(du -sh "$DIST_DIR/vmlinuz" | cut -f1)"

# ── Step 6: Build surgical staging tree ────────────────────────────────
echo "  [6/7] Building surgical staging tree..."
rm -rf "$STAGING"
mkdir -p "$STAGING"/{dev,proc,sys,tmp,app,os}
mkdir -p "$STAGING"/{bin,lib,usr/bin,usr/lib/dri}

# ── Binaries ──
cp "$PARTS/bin/busybox"  "$STAGING/bin/busybox"
cp "$DIST_DIR/qjs"       "$STAGING/usr/bin/qjs"
chmod +x "$STAGING/bin/busybox" "$STAGING/usr/bin/qjs"

# ── musl libc ──
MUSL=$(find "$PARTS/lib" -name 'ld-musl-x86_64.so*' -type f | head -1)
cp "$MUSL" "$STAGING/lib/ld-musl-x86_64.so.1"
ln -sf /lib/ld-musl-x86_64.so.1 "$STAGING/lib/libc.musl-x86_64.so.1"

# ── .so dependency tracer ──
echo "        tracing .so dependencies..."

copy_lib() {
    local name="$1"
    [[ "$name" == *"LLVM"* ]] || [[ "$name" == *"llvm"* ]] && return 0
    [[ "$name" == *"musl"* ]] && return 0
    [ -f "$STAGING/usr/lib/$name" ] && return 0
    local src
    src=$(find "$PARTS/usr/lib" "$PARTS/lib" -name "$name" \( -type f -o -type l \) 2>/dev/null | head -1)
    [ -n "$src" ] && [ -L "$src" ] && src=$(readlink -f "$src")
    if [ -z "$src" ] || [ ! -f "$src" ]; then
        local base="${name%.so*}"
        local soversion="${name#*.so}"
        src=$(find "$PARTS/usr/lib" "$PARTS/lib" -name "${base}.so${soversion}*" -type f 2>/dev/null | head -1)
    fi
    if [ -z "$src" ]; then
        echo "        WARNING: $name not found"
        return 0
    fi
    cp "$src" "$STAGING/usr/lib/$name"
}

trace_deps() {
    local path="$1"
    local deps
    deps=$(readelf -d "$path" 2>/dev/null | grep 'NEEDED' | sed 's/.*\[\(.*\)\]/\1/' || true)
    for dep in $deps; do
        [[ "$dep" == *"LLVM"* ]] || [[ "$dep" == *"llvm"* ]] || [[ "$dep" == *"musl"* ]] && continue
        [ -f "$STAGING/usr/lib/$dep" ] && continue
        copy_lib "$dep"
        [ -f "$STAGING/usr/lib/$dep" ] && trace_deps "$STAGING/usr/lib/$dep"
    done
}

# Seed: SDL2 + Mesa GL/EGL/GBM stack (dlopen'd, won't appear in DT_NEEDED)
SEED_LIBS=(
    "$(find "$PARTS/usr/lib" -name 'libSDL2-2.0.so.*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libEGL.so.1*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libGL.so.1*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libGLESv2.so.2*' \( -type f -o -type l \) | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libgbm.so.1*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libgallium-*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libglapi.so.0*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libdrm.so.2*' -type f | head -1)"
    "$(find "$PARTS/usr/lib" "$PARTS/lib" -name 'libudev.so.*' \( -type f -o -type l \) 2>/dev/null | head -1)"
    "$(find "$PARTS/usr/lib" -name 'libfreetype.so.*' -type f | head -1)"
)

for seed in "${SEED_LIBS[@]}"; do
    [ -z "$seed" ] && continue
    name=$(basename "$seed")
    cp "$seed" "$STAGING/usr/lib/$name"
    trace_deps "$STAGING/usr/lib/$name"
done

# ── DRI driver (virtio_gpu only) ──
DRI_SRC="$PARTS/usr/lib/xorg/modules/dri"
DRIL=$(find "$DRI_SRC" -name 'libdril_dri.so' -type f 2>/dev/null | head -1)
if [ -n "$DRIL" ]; then
    cp "$DRIL" "$STAGING/usr/lib/dri/libdril_dri.so"
    ln -sf libdril_dri.so "$STAGING/usr/lib/dri/virtio_gpu_dri.so"
    trace_deps "$STAGING/usr/lib/dri/libdril_dri.so"
fi

# ── LLVM stub ──
echo "        creating LLVM stub..."
LLVM_SONAME=$(readelf -d "$STAGING/usr/lib/"libgallium-*.so 2>/dev/null \
    | grep 'NEEDED.*LLVM' | sed 's/.*\[\(.*\)\]/\1/' | head -1)
LLVM_VERSION=$(echo "$LLVM_SONAME" | sed 's/libLLVM.so.//')
if [ -n "$LLVM_SONAME" ]; then
    STUB_C=$(mktemp /tmp/llvm_stub_XXXXXX.c)
    STUB_MAP=$(mktemp /tmp/llvm_stub_XXXXXX.map)

    nm -D "$STAGING/usr/lib/"libgallium-*.so 2>/dev/null \
        | grep " U.*LLVM" | awk '{print $2}' | sed 's/@.*//' | sort -u > /tmp/llvm_syms.txt

    {
        echo "/* Auto-generated LLVM stub */"
        while IFS= read -r sym; do
            echo "void *${sym}(void) { return (void*)0; }"
        done < /tmp/llvm_syms.txt
    } > "$STUB_C"

    {
        echo "LLVM_${LLVM_VERSION} {"
        echo "  global:"
        while IFS= read -r sym; do
            echo "    ${sym};"
        done < /tmp/llvm_syms.txt
        echo "  local: *;"
        echo "};"
    } > "$STUB_MAP"

    SYM_COUNT=$(wc -l < /tmp/llvm_syms.txt)
    zig cc -shared -target x86_64-linux-musl \
        -Wl,-soname,"$LLVM_SONAME" \
        -Wl,--version-script,"$STUB_MAP" \
        -o "$STAGING/usr/lib/$LLVM_SONAME" "$STUB_C" 2>/dev/null

    rm -f "$STUB_C" "$STUB_MAP" /tmp/llvm_syms.txt
    echo "        $LLVM_SONAME: $(du -sh "$STAGING/usr/lib/$LLVM_SONAME" | cut -f1) (stub, $SYM_COUNT symbols)"
else
    echo "        WARNING: could not determine LLVM soname"
fi

# ── Kernel modules: virtio-gpu + input ──
KVER=$(ls "$PARTS/lib/modules/" 2>/dev/null | head -1)
if [ -n "$KVER" ]; then
    SRCMOD="$PARTS/lib/modules/$KVER"
    MODDIR="$STAGING/lib/modules/$KVER"
    mkdir -p "$MODDIR"

    VIRTIO_LINE=$(grep "virtio-gpu.ko" "$SRCMOD/modules.dep" 2>/dev/null || true)
    if [ -n "$VIRTIO_LINE" ]; then
        ALL_MODS=$(echo "$VIRTIO_LINE" | sed 's/:.*//')
        DEPS=$(echo "$VIRTIO_LINE" | sed 's/[^:]*://')
        ALL_MODS="$ALL_MODS $DEPS"
        for mod in $ALL_MODS; do
            mod=$(echo "$mod" | xargs)
            [ -z "$mod" ] && continue
            src="$SRCMOD/$mod"
            if [ -f "$src" ]; then
                mkdir -p "$MODDIR/$(dirname "$mod")"
                cp "$src" "$MODDIR/$mod"
            fi
        done
        echo "        kernel modules: $(echo $ALL_MODS | wc -w) files"
    fi

    INPUT_MODS=(
        "kernel/drivers/input/evdev.ko.gz"
        "kernel/drivers/input/mousedev.ko.gz"
        "kernel/drivers/input/mouse/psmouse.ko.gz"
        "kernel/drivers/virtio/virtio_input.ko.gz"
        "kernel/drivers/hid/hid.ko.gz"
        "kernel/drivers/hid/hid-generic.ko.gz"
        "kernel/drivers/hid/usbhid/usbhid.ko.gz"
    )
    for mod in "${INPUT_MODS[@]}"; do
        if [ -f "$SRCMOD/$mod" ]; then
            mkdir -p "$MODDIR/$(dirname "$mod")"
            cp "$SRCMOD/$mod" "$MODDIR/$mod"
        fi
    done

    for f in modules.dep modules.alias modules.dep.bin modules.alias.bin \
             modules.builtin modules.builtin.bin modules.builtin.modinfo \
             modules.order modules.symbols modules.symbols.bin; do
        cp "$SRCMOD/$f" "$MODDIR/" 2>/dev/null || true
    done
fi

# ── Binary-patch SDL2: ARGB8888 → XRGB8888 ──
SDL2_LIB=$(find "$STAGING/usr/lib" -name 'libSDL2-2.0.so.*' -type f | head -1)
if [ -n "$SDL2_LIB" ]; then
    PATCHED=$(python3 -c "
import sys
with open('$SDL2_LIB', 'rb') as f: data = bytearray(f.read())
old, new = bytes([0x41,0x52,0x32,0x34]), bytes([0x58,0x52,0x32,0x34])
n = 0
i = 0
while True:
    j = data.find(old, i)
    if j == -1: break
    data[j:j+4] = new; n += 1; i = j + 4
with open('$SDL2_LIB', 'wb') as f: f.write(data)
print(n)
")
    echo "        SDL2 patched: ARGB8888→XRGB8888 ($PATCHED occurrences)"
fi

# ── Font ──
mkdir -p "$STAGING/usr/share/fonts"
cp "$PARTS/usr/share/fonts/liberation/LiberationSans-Regular.ttf" \
   "$STAGING/usr/share/fonts/" 2>/dev/null || true

# ── Soname symlinks ──
echo "        creating soname symlinks..."
SYMLINK_COUNT=0
for f in "$STAGING/usr/lib/"*.so.*; do
    [ -L "$f" ] && continue
    [ -f "$f" ] || continue
    name=$(basename "$f")
    soname=$(readelf -d "$f" 2>/dev/null | grep SONAME | sed 's/.*\[\(.*\)\]/\1/')
    if [ -n "$soname" ] && [ "$soname" != "$name" ] && [ ! -e "$STAGING/usr/lib/$soname" ]; then
        ln -sf "$name" "$STAGING/usr/lib/$soname"
        SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
    fi
    base="${name%%.so*}.so"
    if [ "$base" != "$name" ] && [ ! -e "$STAGING/usr/lib/$base" ]; then
        ln -sf "$name" "$STAGING/usr/lib/$base"
        SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
    fi
done
if [ ! -e "$STAGING/usr/lib/libSDL2.so" ]; then
    SDL2_FILE=$(find "$STAGING/usr/lib" -name 'libSDL2-2.0.so*' -type f | head -1)
    [ -n "$SDL2_FILE" ] && ln -sf "$(basename "$SDL2_FILE")" "$STAGING/usr/lib/libSDL2.so"
    SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
fi
echo "        created $SYMLINK_COUNT symlinks"

# ── /init (Zig PID 1) ──
cp "$DIST_DIR/init" "$STAGING/init"

# ── App files ──
# Minimal main.js — proof that QuickJS boots and prints
cat > "$STAGING/app/main.js" << 'MAINJS'
// CartridgeOS — QuickJS entry point
import * as std from 'std';

std.out.puts('\n  ┌─────────────────────────────────────┐\n');
std.out.puts('  │  CartridgeOS — QuickJS Runtime      │\n');
std.out.puts('  │  Alpine Linux · No LLVM · Zig init  │\n');
std.out.puts('  └─────────────────────────────────────┘\n');
std.out.puts('\n');

// Read boot facts if available
try {
    const f = std.open('/run/boot-facts', 'r');
    if (f) {
        const content = f.readAsString();
        f.close();
        std.out.puts('  Boot facts:\n');
        for (const line of content.split('\n')) {
            if (line.length > 0)
                std.out.puts('    ' + line + '\n');
        }
    }
} catch (e) {
    // /run/boot-facts may not exist yet
}

std.out.puts('\n  QuickJS version: ' + scriptArgs[0] + '\n');
std.out.puts('  Ready.\n\n');

// Keep alive — in a real cart this would be the event loop
// For now just prove we booted
MAINJS

echo ""

# ── Report ──
echo "        === staging manifest ==="
echo "        BINARIES:"
echo "          $(du -sh "$STAGING/bin/busybox" | cut -f1)  /bin/busybox"
echo "          $(du -sh "$STAGING/usr/bin/qjs" | cut -f1)  /usr/bin/qjs"
echo "          $(du -sh "$STAGING/init" | cut -f1)  /init"
echo "        LIBRARIES:"
for f in "$STAGING/usr/lib/"*.so*; do
    [ -L "$f" ] && continue
    [ -f "$f" ] || continue
    printf "          %-6s  %s\n" "$(du -sh "$f" | cut -f1)" "/usr/lib/$(basename "$f")"
done
echo "        DRI:"
for f in "$STAGING/usr/lib/dri/"*; do
    [ -f "$f" ] || [ -L "$f" ] || continue
    printf "          %-6s  %s\n" "$(du -sh "$f" 2>/dev/null | cut -f1)" "/usr/lib/dri/$(basename "$f")"
done

STAGING_SIZE=$(du -sm "$STAGING" | cut -f1)
echo ""
echo "        staging total: ${STAGING_SIZE}M"
echo ""

# ── Step 7: Package initramfs ──────────────────────────────────────────
echo "  [7/7] Packaging initramfs..."
(cd "$STAGING" && find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$DIST_DIR/initrd.cpio.gz")
echo "        initrd: $(du -sh "$DIST_DIR/initrd.cpio.gz" | cut -f1)"
echo ""

# ── Cleanup ──
rm -rf "$PARTS"

echo "  Done! Boot with: bash os/run.sh"
echo ""
