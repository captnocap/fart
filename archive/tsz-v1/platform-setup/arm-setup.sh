#!/bin/bash
set -euo pipefail

# Shared setup for all aarch64 boards
# Works on: Pi 5, Pi 4B, Orange Pi 5, Le Potato
# Run as your normal user (uses sudo where needed)

cat <<'BANNER'
============================================
 ReactJIT ARM Setup
 Zig 0.15.2 + deps + Claude Code + repo
============================================
BANNER

ZIG_VERSION="0.15.2"

# Detect board
if [ -f /proc/device-tree/model ]; then
    MODEL=$(tr -d '\0' < /proc/device-tree/model)
    echo "Detected: $MODEL"
else
    MODEL="Unknown ARM board"
    echo "Board: could not detect model"
fi
echo ""

# -------------------------------------------
# 1. System packages
# -------------------------------------------
echo "[1/6] Installing system packages..."
sudo apt update
sudo apt install -y \
    build-essential \
    curl \
    git \
    libsdl2-dev \
    libfreetype-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    libmpv-dev \
    pkg-config \
    xz-utils

echo ""

# -------------------------------------------
# 2. Zig 0.15.2 aarch64-linux
# -------------------------------------------
echo "[2/6] Installing Zig ${ZIG_VERSION}..."
if command -v zig &>/dev/null && [ "$(zig version)" = "$ZIG_VERSION" ]; then
    echo "Zig $ZIG_VERSION already installed, skipping."
else
    cd /tmp
    curl -L -o zig.tar.xz "https://ziglang.org/builds/zig-linux-aarch64-${ZIG_VERSION}.tar.xz"
    tar xf zig.tar.xz
    sudo rm -rf /opt/zig
    sudo mv "zig-linux-aarch64-${ZIG_VERSION}" /opt/zig
    rm zig.tar.xz

    # Add to PATH if not already there
    if ! grep -q '/opt/zig' ~/.bashrc; then
        echo 'export PATH=$PATH:/opt/zig' >> ~/.bashrc
    fi
    export PATH=$PATH:/opt/zig
    echo "Zig installed: $(zig version)"
fi
echo ""

# -------------------------------------------
# 3. Node.js 22 (for Claude Code)
# -------------------------------------------
echo "[3/6] Installing Node.js 22..."
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge 20 ]; then
        echo "Node $(node -v) already installed, skipping."
    else
        echo "Node too old ($(node -v)), upgrading..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo ""

# -------------------------------------------
# 4. Claude Code
# -------------------------------------------
echo "[4/6] Installing Claude Code..."
if command -v claude &>/dev/null; then
    echo "Claude Code already installed, skipping."
else
    sudo npm install -g @anthropic-ai/claude-code
fi
echo ""

# -------------------------------------------
# 5. Clone repo
# -------------------------------------------
echo "[5/6] Cloning reactjit..."
REPO_DIR="$HOME/reactjit"
if [ -d "$REPO_DIR" ]; then
    echo "Repo exists, pulling latest..."
    cd "$REPO_DIR"
    git pull
else
    git clone https://github.com/captnocap/reactjit.git "$REPO_DIR"
    cd "$REPO_DIR"
fi
echo ""

# -------------------------------------------
# 6. Test build
# -------------------------------------------
echo "[6/6] Test build..."
cd "$REPO_DIR"

echo "Building tsz-compiler..."
if zig build tsz-compiler 2>&1; then
    echo "  tsz-compiler: OK"
else
    echo "  tsz-compiler: FAILED (see above)"
fi

echo "Building engine..."
if zig build engine 2>&1; then
    echo "  engine: OK"
else
    echo "  engine: FAILED (see above)"
fi

echo ""
echo "============================================"
echo " Setup complete on: $MODEL"
echo "============================================"
echo ""
echo " Zig:    $(zig version 2>/dev/null || echo 'not in PATH — restart shell')"
echo " Node:   $(node -v 2>/dev/null || echo 'not found')"
echo " Git:    $(git --version 2>/dev/null || echo 'not found')"
echo " Claude: $(claude --version 2>/dev/null || echo 'not found')"
echo " Repo:   $REPO_DIR"
echo ""
echo " To start Claude Code:"
echo "   cd $REPO_DIR && claude"
echo ""
echo " If zig is not found, run: source ~/.bashrc"
echo "============================================"
