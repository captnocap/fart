--[[
  emulator.lua — NES emulation via Agnes for iLoveReact

  Manages NES emulator instances that render into off-screen canvases.
  The painter composites these canvases at layout positions.

  Follows the game.lua pattern:
    syncWithTree() → updateAll() → renderAll() → painter composites

  React usage:
    <Emulator src="game.nes" playing />

  Key design decisions:
  - Each Emulator node gets its own agnes instance (no sharing)
  - ROM is loaded from Love2D filesystem (relative path)
  - Input routes by focus: keyboard goes to focused Emulator
  - Canvas is NES native resolution (256x240), painter scales to layout size
]]

local ffi = require("ffi")

-- Agnes FFI declarations
ffi.cdef[[
  typedef struct agnes agnes_t;
  typedef struct { bool a, b, select, start, up, down, left, right; } agnes_input_t;
  typedef struct { uint8_t r, g, b, a; } agnes_color_t;
  typedef struct agnes_state agnes_state_t;
  agnes_t* agnes_make(void);
  void agnes_destroy(agnes_t*);
  bool agnes_load_ines_data(agnes_t*, void*, size_t);
  void agnes_set_input(agnes_t*, const agnes_input_t*, const agnes_input_t*);
  bool agnes_next_frame(agnes_t*);
  agnes_color_t agnes_get_screen_pixel(const agnes_t*, int, int);
  void agnes_get_screen_buffer(const agnes_t*, uint8_t*);
  size_t agnes_state_size(void);
  void agnes_dump_state(const agnes_t*, agnes_state_t*);
  bool agnes_restore_state(agnes_t*, const agnes_state_t*);
]]

-- Load the agnes shared library from lua/emulator/
local agnesLib = nil
local function loadAgnes()
  if agnesLib then return agnesLib end
  -- Try multiple paths (storybook symlink vs project copy)
  local paths = {
    "lua/emulator/libagnes.so",
    "./lua/emulator/libagnes.so",
  }
  for _, path in ipairs(paths) do
    local ok, lib = pcall(ffi.load, path)
    if ok then
      agnesLib = lib
      io.write("[emulator] Loaded libagnes.so from " .. path .. "\n"); io.flush()
      return agnesLib
    end
  end
  io.write("[emulator] ERROR: Could not load libagnes.so\n"); io.flush()
  return nil
end

local NES_W = 256
local NES_H = 240

local Emulator = {}
local instances = {}     -- nodeId -> { agnes, canvas, imageData, image, src, playing, input1, input2, bounds }
local focusedNodeId = nil
local rgbaBuf = nil      -- Shared RGBA buffer (256*240*4 bytes) — reused across instances

-- Keyboard state (updated by keypressed/keyreleased)
local keyState = {}

function Emulator.init()
  loadAgnes()
  rgbaBuf = ffi.new("uint8_t[?]", NES_W * NES_H * 4)
end

-- Map keyboard state to agnes input struct
local function buildInput()
  local input = ffi.new("agnes_input_t")
  input.up     = keyState["up"]     or false
  input.down   = keyState["down"]   or false
  input.left   = keyState["left"]   or false
  input.right  = keyState["right"]  or false
  input.a      = keyState["z"]      or false
  input.b      = keyState["x"]      or false
  input.start  = keyState["return"] or false
  input.select = keyState["rshift"] or keyState["lshift"] or false
  return input
end

--- Load a ROM file into an agnes instance.
--- @param src string ROM path (relative to Love2D filesystem)
--- @return agnes_t*|nil
local function loadROM(src)
  local agnes = loadAgnes()
  if not agnes then return nil end

  local emu = agnes.agnes_make()
  if emu == nil then
    io.write("[emulator] agnes_make() failed\n"); io.flush()
    return nil
  end

  -- Read ROM file via Love2D filesystem
  local ok, data = pcall(love.filesystem.read, "data", src)
  if not ok or not data then
    io.write("[emulator] Failed to read ROM: " .. tostring(src) .. " — " .. tostring(data) .. "\n"); io.flush()
    agnes.agnes_destroy(emu)
    return nil
  end

  local romPtr = ffi.cast("void*", ffi.cast("const char*", data))
  if not agnes.agnes_load_ines_data(emu, romPtr, #data) then
    io.write("[emulator] Failed to parse iNES data: " .. tostring(src) .. "\n"); io.flush()
    agnes.agnes_destroy(emu)
    return nil
  end

  io.write("[emulator] Loaded ROM: " .. src .. " (" .. #data .. " bytes)\n"); io.flush()
  return emu
end

--- Called per-frame from init.lua. Discovers Emulator nodes, loads ROMs, manages canvases.
function Emulator.syncWithTree(nodes)
  local seen = {}
  for id, node in pairs(nodes) do
    if node.type == "Emulator" then
      seen[id] = true
      local src = node.props and node.props.src
      local playing = node.props and node.props.playing ~= false  -- default: playing

      if src and not instances[id] then
        -- New emulator node: load ROM
        local emu = loadROM(src)
        if emu then
          instances[id] = {
            agnes = emu,
            canvas = love.graphics.newCanvas(NES_W, NES_H),
            imageData = love.image.newImageData(NES_W, NES_H),
            image = nil,
            src = src,
            playing = playing,
            bounds = nil,
          }
          instances[id].canvas:setFilter("nearest", "nearest")
          if not focusedNodeId then focusedNodeId = id end
          io.write("[emulator] Created instance for node " .. id .. "\n"); io.flush()
        end
      end

      local entry = instances[id]
      if entry then
        entry.playing = playing

        -- Track layout bounds for input hit testing
        local c = node.computed
        if c then
          entry.bounds = { x = c.x or 0, y = c.y or 0, w = c.w or 0, h = c.h or 0 }
        end

        -- Handle ROM change
        if src and src ~= entry.src then
          local agnes = loadAgnes()
          if agnes and entry.agnes then
            agnes.agnes_destroy(entry.agnes)
          end
          entry.agnes = loadROM(src)
          entry.src = src
        end
      end
    end
  end

  -- Clean up removed nodes
  for id, entry in pairs(instances) do
    if not seen[id] then
      local agnes = loadAgnes()
      if agnes and entry.agnes then
        agnes.agnes_destroy(entry.agnes)
      end
      if entry.canvas then entry.canvas:release() end
      instances[id] = nil
      if focusedNodeId == id then focusedNodeId = nil end
      io.write("[emulator] Destroyed instance for node " .. id .. "\n"); io.flush()
    end
  end
end

--- Called per-frame: advance emulation for each playing instance.
function Emulator.updateAll(dt, pushEvent)
  local agnes = loadAgnes()
  if not agnes then return end

  local input1 = buildInput()
  local input2 = ffi.new("agnes_input_t")  -- Player 2: empty for now

  for id, entry in pairs(instances) do
    if entry.playing and entry.agnes ~= nil then
      agnes.agnes_set_input(entry.agnes, input1, input2)
      agnes.agnes_next_frame(entry.agnes)
    end
  end
end

--- Called per-frame: render each emulator's framebuffer to its canvas.
function Emulator.renderAll()
  local agnes = loadAgnes()
  if not agnes then return end

  for id, entry in pairs(instances) do
    if entry.agnes ~= nil and entry.canvas then
      -- Bulk read framebuffer into RGBA buffer
      agnes.agnes_get_screen_buffer(entry.agnes, rgbaBuf)

      -- Copy RGBA data into Love2D ImageData
      local ptr = ffi.cast("uint8_t*", entry.imageData:getFFIPointer())
      ffi.copy(ptr, rgbaBuf, NES_W * NES_H * 4)

      -- Update or create Image from ImageData
      if entry.image then
        entry.image:replacePixels(entry.imageData)
      else
        entry.image = love.graphics.newImage(entry.imageData)
        entry.image:setFilter("nearest", "nearest")
      end

      -- Draw Image to Canvas
      love.graphics.push("all")
      love.graphics.setCanvas(entry.canvas)
      love.graphics.clear(0, 0, 0, 1)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.draw(entry.image, 0, 0)
      love.graphics.pop()
    end
  end
end

--- Get the pre-rendered canvas for a node (called by painter).
--- @param nodeId number
--- @return love.Canvas|nil
function Emulator.get(nodeId)
  local entry = instances[nodeId]
  return entry and entry.canvas
end

-- ============================================================================
-- Input routing
-- ============================================================================

function Emulator.keypressed(key, scancode, isrepeat)
  keyState[key] = true
end

function Emulator.keyreleased(key, scancode)
  keyState[key] = false
end

function Emulator.mousepressed(x, y, button)
  -- Click to focus
  for nodeId, entry in pairs(instances) do
    local b = entry.bounds
    if b and x >= b.x and x < b.x + b.w and y >= b.y and y < b.y + b.h then
      focusedNodeId = nodeId
      return true
    end
  end
  return false
end

return Emulator
