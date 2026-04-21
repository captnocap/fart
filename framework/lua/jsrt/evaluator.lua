-- Tree-walking evaluator. Walks ESTree AST nodes (same shape as acorn/esprima
-- output) and executes JS semantics.
--
-- Input: AST nodes as Lua tables, straight off a JS parser.
-- Scope: ECMAScript semantics at the language level only. No framework awareness.
--
-- Day-1 coverage:
--   Program, ExpressionStatement, BlockStatement, VariableDeclaration,
--   Literal, Identifier, BinaryExpression (arithmetic + comparison).
--
-- Future features get added as handlers here, not as emission rules elsewhere.

local Values = require("framework.lua.jsrt.values")
local Scope  = require("framework.lua.jsrt.scope")

local M = {}

local evalStatement
local evalExpression
local callFunction
local lookupProperty

-- Property read: object/array key lookup. Walks the __proto__ chain for objects,
-- checks Array.prototype for arrays. Anything not found returns UNDEFINED.
lookupProperty = function(obj, key)
  if type(obj) == "table" and obj.__kind == "array" then
    if key == "length" then return obj.length or 0 end
    local method = require("framework.lua.jsrt.builtins").arrayPrototype[key]
    if method then return method end
  end
  if type(obj) ~= "table" then
    return Values.UNDEFINED
  end
  local current = obj
  while type(current) == "table" do
    local val = rawget(current, key)
    if val ~= nil then return val end
    current = rawget(current, "__proto__")
  end
  return Values.UNDEFINED
end
M.lookupProperty = lookupProperty

-- Call a function value with an array of already-evaluated arguments plus an
-- optional `this` binding. Handles native (host-registered) functions and user
-- JS functions. Uses a pcall + sentinel-table pattern to propagate `return`
-- out of the function body without cluttering every statement handler.
callFunction = function(fn, args, thisVal)
  if type(fn) ~= "table" or fn.__kind ~= "function" then
    error("TypeError: attempted to call a non-function value", 0)
  end
  thisVal = thisVal or Values.UNDEFINED
  if fn.__native then
    return fn.__native(args, thisVal)
  end
  local callScope = Scope.new(fn.closure)
  if not fn.is_arrow then
    callScope:define("this", thisVal)
  end
  for i, name in ipairs(fn.params) do
    local v = args[i]
    if v == nil then v = Values.UNDEFINED end
    callScope:define(name, v)
  end
  -- Expression-bodied arrow: body IS the return expression.
  if fn.is_arrow and fn.body.type ~= "BlockStatement" then
    return evalExpression(fn.body, callScope)
  end
  local ok, err = pcall(evalStatement, fn.body, callScope)
  if ok then return Values.UNDEFINED end
  if type(err) == "table" and err.__return then
    return err.value
  end
  error(err, 0)
end
M.callFunction = callFunction

-- ── Expressions ──────────────────────────────────────────────

evalExpression = function(node, scope)
  local t = node.type

  if t == "Literal" then
    if node.value == nil then return Values.NULL end
    return node.value
  end

  if t == "Identifier" then
    return scope:get(node.name)
  end

  if t == "ArrayExpression" then
    local arr = Values.newArray()
    local n = 0
    for i, elem in ipairs(node.elements) do
      if elem ~= nil then
        arr[i] = evalExpression(elem, scope)
      else
        arr[i] = Values.UNDEFINED  -- hole in array literal
      end
      n = i
    end
    arr.length = n
    return arr
  end

  if t == "ThisExpression" then
    if scope:has("this") then return scope:get("this") end
    return Values.UNDEFINED
  end

  if t == "ObjectExpression" then
    local obj = Values.newObject()
    for _, prop in ipairs(node.properties) do
      if prop.type == "Property" then
        local key
        if prop.computed then
          key = tostring(evalExpression(prop.key, scope))
        elseif prop.key.type == "Identifier" then
          key = prop.key.name
        elseif prop.key.type == "Literal" then
          key = tostring(prop.key.value)
        else
          error("ObjectExpression: unsupported key type " .. tostring(prop.key.type), 0)
        end
        obj[key] = evalExpression(prop.value, scope)
      end
    end
    return obj
  end

  if t == "MemberExpression" then
    local obj = evalExpression(node.object, scope)
    if obj == nil or obj == Values.NULL or obj == Values.UNDEFINED then
      error("TypeError: cannot read properties of " .. tostring(obj), 0)
    end
    local key
    if node.computed then
      key = evalExpression(node.property, scope)
      if type(obj) == "table" and obj.__kind == "array" and type(key) == "number" then
        key = key + 1
      end
    else
      key = node.property.name
    end
    return lookupProperty(obj, key)
  end

  if t == "AssignmentExpression" then
    local rhs = evalExpression(node.right, scope)
    if node.operator ~= "=" then
      local current = evalExpression(node.left, scope)
      if     node.operator == "+=" then rhs = current + rhs
      elseif node.operator == "-=" then rhs = current - rhs
      elseif node.operator == "*=" then rhs = current * rhs
      elseif node.operator == "/=" then rhs = current / rhs
      elseif node.operator == "%=" then rhs = current % rhs
      else error("AssignmentExpression: unsupported operator " .. tostring(node.operator), 0) end
    end
    if node.left.type == "Identifier" then
      scope:set(node.left.name, rhs)
      return rhs
    end
    if node.left.type == "MemberExpression" then
      local target = evalExpression(node.left.object, scope)
      if type(target) ~= "table" then
        error("TypeError: cannot set property on " .. tostring(target), 0)
      end
      local key
      if node.left.computed then
        key = evalExpression(node.left.property, scope)
        if target.__kind == "array" and type(key) == "number" then
          key = key + 1
        end
      else
        key = node.left.property.name
      end
      target[key] = rhs
      if target.__kind == "array" and type(key) == "number" and key > (target.length or 0) then
        target.length = key
      end
      return rhs
    end
    error("AssignmentExpression: unsupported target type " .. tostring(node.left.type), 0)
  end

  if t == "NewExpression" then
    local ctor = evalExpression(node.callee, scope)
    if type(ctor) ~= "table" or ctor.__kind ~= "function" then
      error("TypeError: value is not a constructor", 0)
    end
    local newObj = Values.newObject()
    newObj.__proto__ = ctor.prototype
    local args = {}
    for i, a in ipairs(node.arguments) do
      args[i] = evalExpression(a, scope)
    end
    local result = callFunction(ctor, args, newObj)
    -- If ctor explicitly returned an object, that's what `new` gives back.
    -- Otherwise, `new` yields the freshly-allocated `this`.
    if type(result) == "table" and (result.__kind == "object" or result.__kind == "array") then
      return result
    end
    return newObj
  end

  if t == "CallExpression" then
    local callee_node = node.callee
    local thisVal = Values.UNDEFINED
    local fn
    if callee_node.type == "MemberExpression" then
      -- Method call: evaluate the object separately so we can pass it as `this`.
      local obj = evalExpression(callee_node.object, scope)
      if obj == nil or obj == Values.NULL or obj == Values.UNDEFINED then
        error("TypeError: cannot read properties of " .. tostring(obj), 0)
      end
      thisVal = obj
      local key
      if callee_node.computed then
        key = evalExpression(callee_node.property, scope)
        if type(obj) == "table" and obj.__kind == "array" and type(key) == "number" then
          key = key + 1
        end
      else
        key = callee_node.property.name
      end
      fn = lookupProperty(obj, key)
    else
      fn = evalExpression(callee_node, scope)
    end
    local args = {}
    for i, arg in ipairs(node.arguments) do
      args[i] = evalExpression(arg, scope)
    end
    return callFunction(fn, args, thisVal)
  end

  if t == "FunctionExpression" or t == "ArrowFunctionExpression" then
    return Values.newFunction(node, scope)
  end

  if t == "LogicalExpression" then
    local left = evalExpression(node.left, scope)
    local op = node.operator
    if op == "||" then
      if Values.truthy(left) then return left end
      return evalExpression(node.right, scope)
    end
    if op == "&&" then
      if not Values.truthy(left) then return left end
      return evalExpression(node.right, scope)
    end
    if op == "??" then
      if left == nil or left == Values.NULL or left == Values.UNDEFINED then
        return evalExpression(node.right, scope)
      end
      return left
    end
    error("LogicalExpression: unsupported operator " .. tostring(op), 0)
  end

  if t == "BinaryExpression" then
    local left  = evalExpression(node.left,  scope)
    local right = evalExpression(node.right, scope)
    local op = node.operator
    if op == "+" then
      if type(left) == "string" or type(right) == "string" then
        return tostring(left) .. tostring(right)
      end
      return left + right
    end
    if op == "-"   then return left - right end
    if op == "*"   then return left * right end
    if op == "/"   then return left / right end
    if op == "%"   then return left % right end
    if op == "===" then return left == right end
    if op == "!==" then return left ~= right end
    if op == "=="  then return left == right end  -- TODO: loose equality coercion rules
    if op == "!="  then return left ~= right end
    if op == "<"   then return left <  right end
    if op == "<="  then return left <= right end
    if op == ">"   then return left >  right end
    if op == ">="  then return left >= right end
    error("BinaryExpression: unsupported operator " .. tostring(op))
  end

  error("evalExpression: unsupported node type " .. tostring(t))
end

-- ── Statements ──────────────────────────────────────────────

evalStatement = function(node, scope)
  local t = node.type

  if t == "ExpressionStatement" then
    return evalExpression(node.expression, scope)
  end

  if t == "IfStatement" then
    local condition = evalExpression(node.test, scope)
    if Values.truthy(condition) then
      return evalStatement(node.consequent, scope)
    elseif node.alternate then
      return evalStatement(node.alternate, scope)
    end
    return Values.UNDEFINED
  end

  if t == "FunctionDeclaration" then
    local fn = Values.newFunction(node, scope)
    scope:define(node.id.name, fn)
    return Values.UNDEFINED
  end

  if t == "ClassDeclaration" then
    local ctor = nil
    local proto = Values.newObject()
    for _, def in ipairs(node.body.body) do
      if def.type == "MethodDefinition" then
        local method = Values.newFunction(def.value, scope)
        if def.kind == "constructor" then
          ctor = method
        else
          proto[def.key.name] = method
        end
      end
    end
    if not ctor then
      ctor = Values.newFunction({
        type = "FunctionExpression",
        params = {},
        body = { type = "BlockStatement", body = {} },
      }, scope)
    end
    ctor.prototype = proto
    proto.constructor = ctor
    scope:define(node.id.name, ctor)
    return Values.UNDEFINED
  end

  if t == "ReturnStatement" then
    local value = Values.UNDEFINED
    if node.argument then
      value = evalExpression(node.argument, scope)
    end
    error({ __return = true, value = value }, 0)
  end

  if t == "ThrowStatement" then
    local value = evalExpression(node.argument, scope)
    error({ __throw = true, value = value }, 0)
  end

  if t == "TryStatement" then
    local ok, err = pcall(evalStatement, node.block, scope)
    if ok then
      if node.finalizer then evalStatement(node.finalizer, scope) end
      return Values.UNDEFINED
    end
    -- Return sentinels must pass through try/catch unchanged.
    if type(err) == "table" and err.__return then
      if node.finalizer then evalStatement(node.finalizer, scope) end
      error(err, 0)
    end
    -- Thrown value — catch it.
    if node.handler then
      local catchScope = Scope.new(scope)
      if node.handler.param then
        local thrownValue
        if type(err) == "table" and err.__throw then
          thrownValue = err.value
        elseif type(err) == "string" then
          thrownValue = Values.newObject({ message = err, name = "Error" })
        else
          thrownValue = err
        end
        catchScope:define(node.handler.param.name, thrownValue)
      end
      local handler_ok, handler_err = pcall(evalStatement, node.handler.body, catchScope)
      if node.finalizer then evalStatement(node.finalizer, scope) end
      if not handler_ok then error(handler_err, 0) end
      return Values.UNDEFINED
    end
    -- No handler — finally then re-raise.
    if node.finalizer then evalStatement(node.finalizer, scope) end
    error(err, 0)
  end

  if t == "VariableDeclaration" then
    for _, decl in ipairs(node.declarations) do
      local value = Values.UNDEFINED
      if decl.init then
        value = evalExpression(decl.init, scope)
      end
      scope:define(decl.id.name, value)
    end
    return Values.UNDEFINED
  end

  if t == "BlockStatement" then
    local inner = Scope.new(scope)
    local last = Values.UNDEFINED
    for _, stmt in ipairs(node.body) do
      last = evalStatement(stmt, inner)
    end
    return last
  end

  error("evalStatement: unsupported node type " .. tostring(t))
end

-- ── Program entry ──────────────────────────────────────────

function M.runProgram(ast, scope)
  assert(ast.type == "Program", "expected a Program node at top level")
  local last = Values.UNDEFINED
  for _, stmt in ipairs(ast.body) do
    last = evalStatement(stmt, scope)
  end
  return last
end

-- Exposed for testing individual evaluator paths.
M._evalExpression = evalExpression
M._evalStatement  = evalStatement

return M
