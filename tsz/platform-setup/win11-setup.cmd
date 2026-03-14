@echo off
setlocal enabledelayedexpansion
title ReactJIT Windows Setup
echo ============================================
echo  ReactJIT Windows Setup
echo  Zig 0.15.2 + Love2D + Claude Code + Repo
echo ============================================
echo.

:: Create workspace
mkdir C:\dev 2>nul
cd /d C:\dev

:: -------------------------------------------
:: 1. Install Zig 0.15.2
:: -------------------------------------------
echo [1/6] Installing Zig 0.15.2...
curl -L -o zig.zip https://ziglang.org/builds/zig-windows-x86_64-0.15.2.zip
tar -xf zig.zip
ren zig-windows-x86_64-0.15.2 zig
del zig.zip

:: Add Zig to PATH (user-level, persistent)
setx PATH "%PATH%;C:\dev\zig"
set PATH=%PATH%;C:\dev\zig
echo Zig installed: & zig version
echo.

:: -------------------------------------------
:: 2. Install Git (if not present)
:: -------------------------------------------
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/6] Installing Git...
    curl -L -o git-installer.exe https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe
    start /wait git-installer.exe /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"
    del git-installer.exe
    set PATH=%PATH%;C:\Program Files\Git\cmd
    echo Git installed.
) else (
    echo [2/6] Git already installed, skipping.
)
echo.

:: -------------------------------------------
:: 3. Clone the repo
:: -------------------------------------------
echo [3/6] Cloning reactjit...
cd /d C:\dev
if exist reactjit (
    echo Repo already exists, pulling latest...
    cd reactjit
    git pull
) else (
    git clone https://github.com/captnocap/reactjit.git
    cd reactjit
)
echo.

:: -------------------------------------------
:: 4. Install Node.js (needed for Claude Code)
:: -------------------------------------------
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [4/6] Installing Node.js 22 LTS...
    curl -L -o node-installer.msi https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi
    msiexec /i node-installer.msi /qn /norestart
    del node-installer.msi
    set PATH=%PATH%;C:\Program Files\nodejs
    echo Node.js installed.
) else (
    echo [4/6] Node.js already installed, skipping.
)
echo.

:: -------------------------------------------
:: 5. Install Claude Code
:: -------------------------------------------
echo [5/6] Installing Claude Code...
call npm install -g @anthropic-ai/claude-code
echo.

:: -------------------------------------------
:: 6. Install Love2D
:: -------------------------------------------
echo [6/6] Installing Love2D...
curl -L -o love-installer.exe https://github.com/love2d/love/releases/download/11.5/love-11.5-win64.exe
start /wait love-installer.exe /VERYSILENT /NORESTART /NOCANCEL /SP-
del love-installer.exe
:: Default install path
set PATH=%PATH%;C:\Program Files\LOVE
setx PATH "%PATH%;C:\Program Files\LOVE"
echo Love2D installed.
echo.

:: -------------------------------------------
:: Done
:: -------------------------------------------
echo ============================================
echo  Setup complete! Verify:
echo ============================================
echo.
echo Zig:
zig version
echo.
echo Git:
git --version
echo.
echo Node:
node --version
echo.
echo Claude Code:
call claude --version
echo.
echo Love2D:
where love
echo.
echo Repo at: C:\dev\reactjit
echo.
echo Next steps:
echo   cd C:\dev\reactjit
echo   claude
echo.
pause
