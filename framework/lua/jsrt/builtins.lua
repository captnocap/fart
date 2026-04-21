-- JS global built-ins: Object, Array, String, Math, Number, JSON, Error,
-- Map, Set, WeakMap, Symbol, console, and their prototype methods.
--
-- Every entry here is a JS-language built-in. Nothing framework-specific.
-- React is a JS program; it calls the same `Array.prototype.map` that any other
-- JS program calls. There is no special case here for React.

local Values = require("framework.lua.jsrt.values")

local M = {}

-- Invoke a JS function value. Uses a lazy require on evaluator to avoid a
-- load-time circular dependency; by the time these prototype methods run, the
-- evaluator module is already in the package.loaded cache.
local function callJs(fn, args, thisVal)
  local Evaluator = require("framework.lua.jsrt.evaluator")
  return Evaluator.callFunction(fn, args, thisVal or Values.UNDEFINED)
end

-- ── Array.prototype ────────────────────────────────────────

M.arrayPrototype = {}

M.arrayPrototype.reduce = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local acc = args[2]
  local start = 1
  if acc == nil then
    acc = thisVal[1]
    start = 2
  end
  local n = thisVal.length or 0
  for i = start, n do
    acc = callJs(fn, { acc, thisVal[i], i - 1, thisVal })
  end
  return acc
end)

M.arrayPrototype.map = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  local result = Values.newArray()
  for i = 1, n do
    result[i] = callJs(fn, { thisVal[i], i - 1, thisVal })
  end
  result.length = n
  return result
end)

M.arrayPrototype.filter = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  local result = Values.newArray()
  local j = 0
  for i = 1, n do
    if Values.truthy(callJs(fn, { thisVal[i], i - 1, thisVal })) then
      j = j + 1
      result[j] = thisVal[i]
    end
  end
  result.length = j
  return result
end)

M.arrayPrototype.forEach = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  for i = 1, n do
    callJs(fn, { thisVal[i], i - 1, thisVal })
  end
  return Values.UNDEFINED
end)

M.arrayPrototype.push = Values.newNativeFunction(function(args, thisVal)
  local n = thisVal.length or 0
  for i = 1, #args do
    n = n + 1
    thisVal[n] = args[i]
  end
  thisVal.length = n
  return n
end)

M.arrayPrototype.join = Values.newNativeFunction(function(args, thisVal)
  local sep = args[1]
  if sep == nil or sep == Values.UNDEFINED then sep = "," end
  local parts = {}
  for i = 1, thisVal.length or 0 do
    local v = thisVal[i]
    if v == Values.UNDEFINED or v == Values.NULL then
      parts[i] = ""
    else
      parts[i] = tostring(v)
    end
  end
  return table.concat(parts, sep)
end)

-- ── install ────────────────────────────────────────────────

-- ── Error ─────────────────────────────────────────────────
-- `new Error(msg)` creates an object with .message and .name.
-- JS's error hierarchy (TypeError, RangeError, etc.) can be added as targets
-- require them — same shape, different `name`.

local function makeErrorCtor(name)
  local ctor = Values.newNativeFunction(function(args, thisVal)
    local msg = args[1]
    if msg == nil or msg == Values.UNDEFINED then
      thisVal.message = ""
    else
      thisVal.message = tostring(msg)
    end
    thisVal.name = name
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  proto.name = name
  proto.message = ""
  ctor.prototype = proto
  return ctor
end

-- ── Map ──────────────────────────────────────────────────
-- Insertion-ordered, keyed by raw Lua equality (close enough to JS
-- SameValueZero for primitives and identity for objects). `.size` is a live
-- field rather than a getter — JS distinguishes these but nothing in React
-- depends on the distinction.

local function buildMap()
  local ctor = Values.newNativeFunction(function(args, thisVal)
    thisVal.__map_keys = {}
    thisVal.__map_vals = {}
    thisVal.__map_lookup = {}
    thisVal.size = 0
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  ctor.prototype = proto

  proto.set = Values.newNativeFunction(function(args, thisVal)
    local key, value = args[1], args[2]
    local idx = thisVal.__map_lookup[key]
    if idx then
      thisVal.__map_vals[idx] = value
    else
      local n = thisVal.size + 1
      thisVal.__map_keys[n] = key
      thisVal.__map_vals[n] = value
      thisVal.__map_lookup[key] = n
      thisVal.size = n
    end
    return thisVal
  end)

  proto.get = Values.newNativeFunction(function(args, thisVal)
    local idx = thisVal.__map_lookup[args[1]]
    if idx then return thisVal.__map_vals[idx] end
    return Values.UNDEFINED
  end)

  proto.has = Values.newNativeFunction(function(args, thisVal)
    return thisVal.__map_lookup[args[1]] ~= nil
  end)

  proto.delete = Values.newNativeFunction(function(args, thisVal)
    local idx = thisVal.__map_lookup[args[1]]
    if not idx then return false end
    -- Shift entries down. O(n); fine for small maps and React's Map usage.
    for i = idx, thisVal.size - 1 do
      thisVal.__map_keys[i] = thisVal.__map_keys[i + 1]
      thisVal.__map_vals[i] = thisVal.__map_vals[i + 1]
      thisVal.__map_lookup[thisVal.__map_keys[i]] = i
    end
    thisVal.__map_keys[thisVal.size] = nil
    thisVal.__map_vals[thisVal.size] = nil
    thisVal.__map_lookup[args[1]] = nil
    thisVal.size = thisVal.size - 1
    return true
  end)

  return ctor
end

-- ── Set ──────────────────────────────────────────────────

local function buildSet()
  local ctor = Values.newNativeFunction(function(args, thisVal)
    thisVal.__set_items = {}
    thisVal.size = 0
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  ctor.prototype = proto

  proto.add = Values.newNativeFunction(function(args, thisVal)
    local v = args[1]
    if thisVal.__set_items[v] == nil then
      thisVal.__set_items[v] = true
      thisVal.size = thisVal.size + 1
    end
    return thisVal
  end)

  proto.has = Values.newNativeFunction(function(args, thisVal)
    return thisVal.__set_items[args[1]] == true
  end)

  proto.delete = Values.newNativeFunction(function(args, thisVal)
    if thisVal.__set_items[args[1]] then
      thisVal.__set_items[args[1]] = nil
      thisVal.size = thisVal.size - 1
      return true
    end
    return false
  end)

  return ctor
end

function M.install(scope)
  scope:define("Error",       makeErrorCtor("Error"))
  scope:define("TypeError",   makeErrorCtor("TypeError"))
  scope:define("RangeError",  makeErrorCtor("RangeError"))
  scope:define("SyntaxError", makeErrorCtor("SyntaxError"))
  scope:define("Map",         buildMap())
  scope:define("Set",         buildSet())
  -- TODO: install Math, Object.keys, JSON, console, WeakMap, Symbol, etc.
end

return M
