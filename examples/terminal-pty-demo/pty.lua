--[[
  pty.lua

  Demo-level PTY bridge implemented fully in LuaJIT FFI.
  React code only handles layout/state and talks to this module through RPC.

  Linux-only in this demo build.
]]

local ffi = require("ffi")
local bit = require("bit")

ffi.cdef[[
typedef int pid_t;
typedef long ssize_t;
typedef unsigned long size_t;

struct termios;
struct winsize {
  unsigned short ws_row;
  unsigned short ws_col;
  unsigned short ws_xpixel;
  unsigned short ws_ypixel;
};

int forkpty(int *amaster, char *name, const struct termios *termp, const struct winsize *winp);
int openpty(int *amaster, int *aslave, char *name, const struct termios *termp, const struct winsize *winp);
int login_tty(int fd);
pid_t fork(void);
int setsid(void);
int execvp(const char *file, char *const argv[]);
pid_t waitpid(pid_t pid, int *status, int options);
int kill(pid_t pid, int sig);
int close(int fd);
ssize_t read(int fd, void *buf, size_t count);
ssize_t write(int fd, const void *buf, size_t count);
int fcntl(int fd, int cmd, ...);
int ioctl(int fd, unsigned long request, ...);
char *getenv(const char *name);
int setenv(const char *name, const char *value, int overwrite);
int chdir(const char *path);
char *strerror(int errnum);
void _exit(int status);
]]

local Pty = {}
local C = ffi.C

local F_GETFL = 3
local F_SETFL = 4
local O_NONBLOCK = 2048
local WNOHANG = 1
local TIOCSWINSZ = 0x5414

local SIGHUP = 1
local SIGWINCH = 28

local EAGAIN = 11
local EWOULDBLOCK = 11
local EIO = 5

local READ_CHUNK = 16384

local supportsPty = ffi.os == "Linux"
local unavailableReason = supportsPty and nil or "PTY demo currently supports Linux only"
local libutil = nil

if supportsPty then
  local ok, loaded = pcall(ffi.load, "util")
  if ok then
    libutil = loaded
  end
end

local state = {
  masterFd = -1,
  pid = 0,
  running = false,
  exited = false,
  exitCode = nil,
  exitSignal = nil,
  shell = nil,
  cols = 0,
  rows = 0,
  startedAt = 0,
  error = nil,
}

local readBuffer = ffi.new("uint8_t[?]", READ_CHUNK)

local function nowSeconds()
  if love and love.timer and love.timer.getTime then
    return love.timer.getTime()
  end
  return 0
end

local function cstring(str)
  return ffi.new("char[?]", #str + 1, str)
end

local function errnoMessage(prefix)
  local err = ffi.errno()
  local msg = C.strerror(err)
  local suffix = msg ~= nil and ffi.string(msg) or ("errno " .. tostring(err))
  return string.format("%s: %s", prefix, suffix)
end

local function resetExitState()
  state.exited = false
  state.exitCode = nil
  state.exitSignal = nil
end

local function updateExitState()
  if not state.running or state.pid <= 0 then
    return
  end

  local status = ffi.new("int[1]", 0)
  local waited = C.waitpid(state.pid, status, WNOHANG)
  if waited ~= state.pid then
    return
  end

  state.running = false
  state.exited = true

  local raw = tonumber(status[0])
  local signal = bit.band(raw, 0x7f)
  if signal == 0 then
    state.exitCode = bit.band(bit.rshift(raw, 8), 0xff)
    state.exitSignal = nil
  else
    state.exitCode = nil
    state.exitSignal = signal
  end
end

local function statusSnapshot(extra)
  updateExitState()
  local out = {
    supported = supportsPty,
    running = state.running,
    exited = state.exited,
    pid = state.pid > 0 and state.pid or nil,
    shell = state.shell,
    cols = state.cols,
    rows = state.rows,
    exitCode = state.exitCode,
    exitSignal = state.exitSignal,
    error = state.error or unavailableReason,
    uptimeSeconds = state.startedAt > 0 and math.max(0, nowSeconds() - state.startedAt) or 0,
  }
  if extra then
    for k, v in pairs(extra) do
      out[k] = v
    end
  end
  return out
end

local function setNonBlocking(fd)
  local flags = C.fcntl(fd, F_GETFL, 0)
  if flags < 0 then
    return nil, errnoMessage("fcntl(F_GETFL) failed")
  end
  if C.fcntl(fd, F_SETFL, bit.bor(flags, O_NONBLOCK)) ~= 0 then
    return nil, errnoMessage("fcntl(F_SETFL) failed")
  end
  return true
end

local function closeInheritedFds()
  -- Close all file descriptors above stderr (fd 2) that were inherited from
  -- the parent Love2D process. forkpty sets up the PTY slave on fds 0/1/2,
  -- but the child still holds the parent's X11 socket, OpenGL context fd,
  -- libmpv fds, etc. If these survive into execvp, they corrupt the parent's
  -- X11 connection and freeze SDL_PumpEvents on the next frame.
  for fd = 3, 1023 do
    C.close(fd)
  end
end

local function runChild(shell, cwd)
  closeInheritedFds()

  C.setenv("TERM", "xterm-256color", 1)
  C.setenv("COLORTERM", "truecolor", 1)

  if cwd and #cwd > 0 then
    C.chdir(cwd)
  end

  local shellArg = cstring(shell)
  local interactiveArg = cstring("-i")
  local argv = ffi.new("char *[3]")
  argv[0] = shellArg
  argv[1] = interactiveArg
  argv[2] = nil

  C.execvp(shellArg, argv)

  local msg = "execvp failed\n"
  C.write(2, msg, #msg)
  C._exit(127)
end

local function getEnv(name)
  local value = C.getenv(name)
  if value == nil then return nil end
  return ffi.string(value)
end

local function callForkpty(masterPtr, ws)
  if libutil and libutil.forkpty then
    return libutil.forkpty(masterPtr, nil, nil, ws)
  end
  return C.forkpty(masterPtr, nil, nil, ws)
end

function Pty.status()
  return statusSnapshot()
end

function Pty.start(args)
  args = args or {}

  if not supportsPty then
    return nil, unavailableReason
  end

  Pty.stop()

  local cols = math.max(20, math.floor(tonumber(args.cols) or 120))
  local rows = math.max(8, math.floor(tonumber(args.rows) or 32))
  local shell = args.shell
  if not shell or #shell == 0 then
    shell = getEnv("SHELL") or "/bin/bash"
  end

  local master = ffi.new("int[1]", -1)
  local ws = ffi.new("struct winsize")
  ws.ws_col = cols
  ws.ws_row = rows
  ws.ws_xpixel = 0
  ws.ws_ypixel = 0

  -- Manual openpty + fork instead of forkpty.
  -- This lets us set FD_CLOEXEC on both master and slave BEFORE forking,
  -- preventing the child from inheriting Love2D's fds through the PTY layer.
  local slave = ffi.new("int[1]", -1)
  local openptyFn = libutil and libutil.openpty or C.openpty
  local loginTtyFn = libutil and libutil.login_tty or C.login_tty

  local ok, openErr = pcall(function()
    if openptyFn(master, slave, nil, nil, ws) ~= 0 then
      error(errnoMessage("openpty failed"))
    end
  end)
  if not ok then
    return nil, tostring(openErr)
  end

  -- Set CLOEXEC on master so child never inherits it
  local FD_CLOEXEC = 1
  local F_SETFD = 2
  C.fcntl(tonumber(master[0]), F_SETFD, FD_CLOEXEC)

  -- Also set CLOEXEC on slave so parent doesn't leak it to other children
  C.fcntl(tonumber(slave[0]), F_SETFD, FD_CLOEXEC)

  local pid
  ok, openErr = pcall(function()
    pid = C.fork()
  end)
  if not ok then
    C.close(tonumber(master[0]))
    C.close(tonumber(slave[0]))
    return nil, tostring(openErr)
  end

  if pid < 0 then
    C.close(tonumber(master[0]))
    C.close(tonumber(slave[0]))
    return nil, errnoMessage("fork failed")
  end

  if pid == 0 then
    -- Child: close master, set up slave as controlling terminal
    C.close(tonumber(master[0]))
    C.setsid()
    loginTtyFn(tonumber(slave[0]))
    closeInheritedFds()
    runChild(shell, args.cwd)
    C._exit(127)
  end

  -- Parent: close slave, keep master
  C.close(tonumber(slave[0]))

  local masterFd = tonumber(master[0])
  if masterFd < 0 then
    return nil, "forkpty returned invalid master fd"
  end

  local nbOk, nbErr = setNonBlocking(masterFd)
  if not nbOk then
    C.close(masterFd)
    return nil, nbErr
  end

  state.masterFd = masterFd
  state.pid = tonumber(pid)
  state.running = true
  state.shell = shell
  state.cols = cols
  state.rows = rows
  state.startedAt = nowSeconds()
  state.error = nil
  resetExitState()

  return statusSnapshot()
end

function Pty.write(data)
  if type(data) ~= "string" or #data == 0 then
    return true
  end

  if state.masterFd < 0 or not state.running then
    return nil, "no active PTY session"
  end

  local size = #data
  local buffer = ffi.new("uint8_t[?]", size)
  ffi.copy(buffer, data, size)

  local offset = 0
  while offset < size do
    local written = C.write(state.masterFd, buffer + offset, size - offset)
    if written > 0 then
      offset = offset + tonumber(written)
    else
      local err = ffi.errno()
      if err == EAGAIN or err == EWOULDBLOCK then
        break
      end
      return nil, errnoMessage("write failed")
    end
  end

  return true
end

function Pty.resize(cols, rows)
  if state.masterFd < 0 then
    return nil, "no active PTY session"
  end

  local nextCols = math.max(20, math.floor(tonumber(cols) or state.cols or 120))
  local nextRows = math.max(8, math.floor(tonumber(rows) or state.rows or 32))

  local ws = ffi.new("struct winsize")
  ws.ws_col = nextCols
  ws.ws_row = nextRows
  ws.ws_xpixel = 0
  ws.ws_ypixel = 0

  if C.ioctl(state.masterFd, TIOCSWINSZ, ws) ~= 0 then
    return nil, errnoMessage("ioctl(TIOCSWINSZ) failed")
  end

  state.cols = nextCols
  state.rows = nextRows
  if state.pid > 0 and state.running then
    C.kill(state.pid, SIGWINCH)
  end

  return true
end

function Pty.drain(maxBytes)
  updateExitState()

  if state.masterFd < 0 then
    return statusSnapshot({ data = "", bytes = 0 })
  end

  local limit = math.max(1024, math.floor(tonumber(maxBytes) or 65536))
  local total = 0
  local chunks = {}

  while total < limit do
    local toRead = math.min(READ_CHUNK, limit - total)
    local readCount = C.read(state.masterFd, readBuffer, toRead)

    if readCount > 0 then
      local n = tonumber(readCount)
      chunks[#chunks + 1] = ffi.string(readBuffer, n)
      total = total + n
    elseif readCount == 0 then
      updateExitState()
      break
    else
      local err = ffi.errno()
      if err == EAGAIN or err == EWOULDBLOCK then
        break
      end
      if err == EIO then
        updateExitState()
        break
      end
      state.error = errnoMessage("read failed")
      break
    end
  end

  return statusSnapshot({
    data = #chunks > 0 and table.concat(chunks) or "",
    bytes = total,
  })
end

function Pty.stop()
  if state.running and state.pid > 0 then
    C.kill(state.pid, SIGHUP)
  end

  if state.masterFd >= 0 then
    C.close(state.masterFd)
    state.masterFd = -1
  end

  updateExitState()
  state.running = false
  return true
end

return Pty
