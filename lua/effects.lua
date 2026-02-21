--[[
  effects.lua — Generative canvas effect registry and lifecycle manager

  Manages off-screen canvases for procedural visual effects that can render
  standalone (as their own visual surface) or as a living background texture
  on any parent element.

  Follows the GameCanvas pattern: syncWithTree → updateAll → renderAll → painter composites.

  Usage (standalone — fills its own layout box):
    <Spirograph />
    <Spirograph speed={1.5} decay={0.02} />

  Usage (background — lives behind parent's children, no layout, no input):
    <Card>
      <Spirograph background />
      <Text fontSize={18}>Hello</Text>
    </Card>
]]

local Effects = {}

-- Registry: typeName -> effect module { create, update, draw }
local registry = {}

-- Live instances: nodeId -> { type, state, canvas, width, height, background, parentId }
local instances = {}

-- Reverse lookup: parentId -> nodeId (for background effects, so painter can find them)
local backgroundByParent = {}

-- ============================================================================
-- Registration
-- ============================================================================

--- Register an effect type.
--- @param typeName string  The node type React will CREATE (e.g. "Spirograph")
--- @param mod table  Effect module with create(w, h, props), update(state, dt, props, w, h), draw(state, w, h)
function Effects.register(typeName, mod)
  assert(typeName, "Effects.register: typeName required")
  assert(type(mod) == "table", "Effects.register: mod must be a table")
  assert(mod.create, "Effects.register: mod.create required")
  assert(mod.update, "Effects.register: mod.update required")
  assert(mod.draw, "Effects.register: mod.draw required")
  registry[typeName] = mod
end

--- Check if a node type is a registered effect.
function Effects.isEffect(typeName)
  return registry[typeName] ~= nil
end

--- Check if a specific node is a background-mode effect (for layout skip).
--- @param node table  The tree node
function Effects.isBackgroundEffect(node)
  if not registry[node.type] then return false end
  local props = node.props or {}
  return props.background == true
end

-- ============================================================================
-- Tree sync (called per-frame from init.lua)
-- ============================================================================

--- Shallow prop comparison. Returns true if different.
local function propsChanged(a, b)
  if a == b then return false end
  if a == nil or b == nil then return true end
  for k, v in pairs(a) do
    if b[k] ~= v then return true end
  end
  for k in pairs(b) do
    if a[k] == nil then return true end
  end
  return false
end

--- Sync effects with the React tree. Discovers effect nodes, manages canvases.
function Effects.syncWithTree(nodes)
  local seen = {}

  for id, node in pairs(nodes) do
    local mod = registry[node.type]
    if mod then
      seen[id] = true
      local props = node.props or {}
      local isBackground = props.background == true

      if not instances[id] then
        -- New effect: create instance (canvas created on first render when dimensions known)
        instances[id] = {
          type = node.type,
          state = nil,
          canvas = nil,
          width = 0,
          height = 0,
          background = isBackground,
          parentId = node.parent and node.parent.id or nil,
          props = props,
          needsInit = true,
        }
        if isBackground and node.parent then
          backgroundByParent[node.parent.id] = id
        end
      else
        -- Existing: update props reference
        local inst = instances[id]
        inst.props = props
        inst.background = isBackground
        -- Update parent mapping if needed
        local parentId = node.parent and node.parent.id or nil
        if isBackground and parentId then
          if inst.parentId ~= parentId then
            -- Parent changed: clean up old mapping
            if inst.parentId then backgroundByParent[inst.parentId] = nil end
            backgroundByParent[parentId] = id
            inst.parentId = parentId
          end
        end
      end

      -- Resolve target dimensions: parent's for background, own for standalone
      local c
      if isBackground and node.parent then
        c = node.parent.computed
      else
        c = node.computed
      end

      if c then
        local w = math.floor(c.w or 0)
        local h = math.floor(c.h or 0)
        local inst = instances[id]

        if w > 0 and h > 0 and (inst.width ~= w or inst.height ~= h) then
          -- Canvas size changed: recreate
          if inst.canvas then inst.canvas:release() end
          inst.canvas = love.graphics.newCanvas(w, h)
          inst.width = w
          inst.height = h
          inst.needsInit = true
        end
      end
    end
  end

  -- Cleanup: destroy instances whose nodes were removed
  for id, inst in pairs(instances) do
    if not seen[id] then
      if inst.canvas then inst.canvas:release() end
      if inst.background and inst.parentId then
        backgroundByParent[inst.parentId] = nil
      end
      local mod = registry[inst.type]
      if mod and mod.destroy then
        mod.destroy(inst.state)
      end
      instances[id] = nil
    end
  end
end

--- Update all effect instances.
function Effects.updateAll(dt)
  for id, inst in pairs(instances) do
    local mod = registry[inst.type]
    if mod and inst.canvas and inst.width > 0 and inst.height > 0 then
      if inst.needsInit then
        inst.state = mod.create(inst.width, inst.height, inst.props)
        inst.needsInit = false
      end
      mod.update(inst.state, dt, inst.props, inst.width, inst.height)
    end
  end
end

--- Render all effect instances to their off-screen canvases.
function Effects.renderAll()
  for id, inst in pairs(instances) do
    local mod = registry[inst.type]
    if mod and inst.canvas and inst.state and inst.width > 0 and inst.height > 0 then
      love.graphics.push("all")
      love.graphics.setCanvas(inst.canvas)
      -- Do NOT clear — effects manage their own background (trails/accumulation)
      mod.draw(inst.state, inst.width, inst.height)
      love.graphics.pop()
    end
  end
end

-- ============================================================================
-- Canvas retrieval (called by painter)
-- ============================================================================

--- Get the pre-rendered canvas for a standalone effect node.
--- @param nodeId number
--- @return love.Canvas|nil
function Effects.get(nodeId)
  local inst = instances[nodeId]
  return inst and inst.canvas
end

--- Get the background effect canvas for a parent node.
--- @param parentNodeId number
--- @return love.Canvas|nil
function Effects.getBackground(parentNodeId)
  local effectNodeId = backgroundByParent[parentNodeId]
  if not effectNodeId then return nil end
  local inst = instances[effectNodeId]
  return inst and inst.canvas
end

-- ============================================================================
-- Auto-load effects from lua/effects/ directory
-- ============================================================================

function Effects.loadAll()
  local effectFiles = {
    "spirograph",
    "rings",
    "flowparticles",
    "mirror",
    "mandala",
    "cymatics",
  }
  for _, name in ipairs(effectFiles) do
    local ok, err = pcall(require, "lua.effects." .. name)
    if ok then
      io.write("[effects] Loaded: " .. name .. "\n"); io.flush()
    else
      io.write("[effects] Failed to load " .. name .. ": " .. tostring(err) .. "\n"); io.flush()
    end
  end
end

return Effects
