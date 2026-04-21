local React = {}

React.Fragment = { __eqjs_fragment = true }

local function shallow_copy(tbl)
  local out = {}
  for k, v in pairs(tbl or {}) do
    out[k] = v
  end
  return out
end

function React.createElement(type_name, props, ...)
  local children = { ... }
  local packed_children = nil

  if #children == 1 then
    packed_children = children[1]
  elseif #children > 1 then
    packed_children = children
  end

  return {
    type = type_name,
    props = props and shallow_copy(props) or {},
    children = packed_children,
  }
end

local Runtime = {}
Runtime.__index = Runtime

function React.createRuntime()
  return setmetatable({
    slots = {},
    refs = {},
    effects = {},
    effectQueue = {},
    currentKey = nil,
    hookIndex = 0,
    dirty = false,
  }, Runtime)
end

function Runtime:begin(key)
  self.currentKey = key
  self.hookIndex = 1
  self.effectQueue = {}
end

local function sameDeps(a, b)
  if a == nil or b == nil then
    return false
  end
  if #a ~= #b then
    return false
  end
  for i = 1, #a do
    if a[i] ~= b[i] then
      return false
    end
  end
  return true
end

function Runtime:useState(initial)
  assert(self.currentKey, "useState called outside begin()")
  local key = self.currentKey
  local slots = self.slots[key]
  if not slots then
    slots = {}
    self.slots[key] = slots
  end

  local idx = self.hookIndex
  self.hookIndex = idx + 1

  if slots[idx] == nil then
    if type(initial) == "function" then
      slots[idx] = initial()
    else
      slots[idx] = initial
    end
  end

  local function setState(next_value)
    local value = next_value
    if type(next_value) == "function" then
      value = next_value(slots[idx])
    end
    if slots[idx] ~= value then
      slots[idx] = value
      self.dirty = true
    end
  end

  return slots[idx], setState
end

function Runtime:useRef(initial)
  assert(self.currentKey, "useRef called outside begin()")
  local key = self.currentKey
  local refs = self.refs[key]
  if not refs then
    refs = {}
    self.refs[key] = refs
  end

  local idx = self.hookIndex
  self.hookIndex = idx + 1

  if refs[idx] == nil then
    refs[idx] = { current = initial }
  end

  return refs[idx]
end

function Runtime:useEffect(effect, deps)
  assert(self.currentKey, "useEffect called outside begin()")
  local key = self.currentKey
  local effects = self.effects[key]
  if not effects then
    effects = {}
    self.effects[key] = effects
  end

  local idx = self.hookIndex
  self.hookIndex = idx + 1

  local prev = effects[idx]
  local run = prev == nil or not sameDeps(prev.deps, deps)

  if run then
    self.effectQueue[#self.effectQueue + 1] = function()
      if prev and type(prev.cleanup) == "function" then
        pcall(prev.cleanup)
      end
      local cleanup = effect()
      effects[idx] = {
        deps = deps and shallow_copy(deps) or nil,
        cleanup = cleanup,
      }
    end
  end
end

function Runtime:finish()
  local queue = self.effectQueue
  self.effectQueue = {}
  for _, run_effect in ipairs(queue) do
    run_effect()
  end
  self.currentKey = nil
  self.hookIndex = 0
  return self.dirty
end

return React
