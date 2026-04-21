-- Lexical environment records.
--
-- A scope is a binding table plus a parent pointer. Variable lookup walks
-- the parent chain. Each function call and each block with let/const creates
-- a new scope.

local M = {}

local Scope = {}
Scope.__index = Scope

function M.new(parent)
  return setmetatable({
    bindings = {},
    parent = parent,
  }, Scope)
end

function Scope:define(name, value)
  self.bindings[name] = value
end

function Scope:set(name, value)
  local s = self
  while s do
    if s.bindings[name] ~= nil then
      s.bindings[name] = value
      return
    end
    s = s.parent
  end
  error("ReferenceError: " .. name .. " is not defined")
end

function Scope:get(name)
  local s = self
  while s do
    if s.bindings[name] ~= nil then
      return s.bindings[name]
    end
    s = s.parent
  end
  error("ReferenceError: " .. name .. " is not defined")
end

function Scope:has(name)
  local s = self
  while s do
    if s.bindings[name] ~= nil then return true end
    s = s.parent
  end
  return false
end

return M
