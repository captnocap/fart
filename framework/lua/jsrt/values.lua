-- JSRT value representation.
--
-- Most JS values map to Lua types naturally:
--   number  → Lua number
--   string  → Lua string
--   boolean → Lua boolean
--
-- Values Lua can't represent directly:
--   null      → dedicated NULL sentinel (distinct from Lua nil, which stands for
--               "missing binding" / "not declared")
--   undefined → dedicated UNDEFINED sentinel (distinct from NULL — JS treats them
--               as different values: `null === undefined` is false)
--
-- Objects, arrays, and functions: Lua tables with a __kind field.
--   __kind == "object"   → plain object, keys are string properties
--   __kind == "array"    → array, 1-indexed Lua storage + explicit length field
--   __kind == "function" → callable, either { __native = fn } for host fns or
--                          { params, body, closure, is_arrow } for user fns

local M = {}

M.NULL      = setmetatable({}, { __tostring = function() return "null" end })
M.UNDEFINED = setmetatable({}, { __tostring = function() return "undefined" end })

function M.typeof(v)
  if v == M.NULL then return "object" end       -- JS quirk: typeof null === "object"
  if v == M.UNDEFINED then return "undefined" end
  local t = type(v)
  if t == "nil" then return "undefined" end
  if t == "number" or t == "string" or t == "boolean" then return t end
  if t == "table" then
    if v.__kind == "function" then return "function" end
    return "object"
  end
  return "object"
end

-- JS truthiness: 0, "", NaN, null, undefined all falsy (Lua only treats false/nil that way).
function M.truthy(v)
  if v == nil or v == M.NULL or v == M.UNDEFINED then return false end
  if v == false then return false end
  if v == 0 then return false end
  if v == "" then return false end
  if type(v) == "number" and v ~= v then return false end
  return true
end

function M.newObject(props)
  local o = { __kind = "object" }
  if props then
    for k, v in pairs(props) do o[k] = v end
  end
  return o
end

function M.newArray(items)
  local a = { __kind = "array", length = items and #items or 0 }
  if items then
    for i = 1, #items do a[i] = items[i] end
  end
  return a
end

function M.newNativeFunction(fn)
  return { __kind = "function", __native = fn }
end

-- User-authored JS function. Captures the defining scope as its closure.
-- `params` stored as the raw AST nodes (Identifier / ArrayPattern / ObjectPattern /
-- RestElement / AssignmentPattern) so callFunction can use bindPattern for
-- destructuring + rest + defaults.
-- Non-arrow functions get a fresh `prototype` object so they can be used as
-- constructors via `new`. Arrows don't have `prototype` — they can't be `new`'d.
function M.newFunction(node, closure)
  local fn = {
    __kind = "function",
    params = node.params or {},
    body = node.body,
    closure = closure,
    is_arrow = (node.type == "ArrowFunctionExpression"),
  }
  if not fn.is_arrow then
    fn.prototype = M.newObject()
    fn.prototype.constructor = fn
  end
  return fn
end

return M
