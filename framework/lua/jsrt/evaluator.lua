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
local bindPattern

-- Property read: object/array key lookup. Walks the __proto__ chain for objects,
-- checks Array.prototype for arrays. Anything not found returns UNDEFINED.
lookupProperty = function(obj, key)
  if type(obj) == "table" and obj.__kind == "array" then
    if key == "length" then return obj.length or 0 end
    local method = require("framework.lua.jsrt.builtins").arrayPrototype[key]
    if method then return method end
  end
  if type(obj) == "string" then
    if key == "length" then return #obj end
    local method = require("framework.lua.jsrt.builtins").stringPrototype[key]
    if method then return method end
  end
  if type(obj) == "table" and obj.__kind == "regexp" then
    local method = require("framework.lua.jsrt.builtins").regexpPrototype[key]
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

-- Bind a destructuring pattern against a value, defining the resulting names
-- in `scope`. Handles:
--   Identifier            — direct name binding
--   ArrayPattern          — positional destructuring from arrays
--   ObjectPattern         — named destructuring from objects
--   RestElement           — "collect the rest" at the end of an ArrayPattern
--   AssignmentPattern     — default-value fallback when value is undefined
-- Function params use this same machinery, so `function f({x, y}) {}` works.
bindPattern = function(pattern, value, scope)
  local pt = pattern.type
  if pt == "Identifier" then
    if value == nil then value = Values.UNDEFINED end
    scope:define(pattern.name, value)
    return
  end
  if pt == "AssignmentPattern" then
    if value == nil or value == Values.UNDEFINED then
      value = evalExpression(pattern.right, scope)
    end
    bindPattern(pattern.left, value, scope)
    return
  end
  if pt == "ArrayPattern" then
    local len = 0
    if type(value) == "table" and value.__kind == "array" then
      len = value.length or 0
    end
    for i, elem in ipairs(pattern.elements) do
      if elem == nil then
        -- hole in the pattern, skip
      elseif elem.type == "RestElement" then
        local rest = Values.newArray()
        local restLen = 0
        for j = i, len do
          restLen = restLen + 1
          rest[restLen] = value[j] or Values.UNDEFINED
        end
        rest.length = restLen
        bindPattern(elem.argument, rest, scope)
        return
      else
        local v = Values.UNDEFINED
        if type(value) == "table" and value.__kind == "array" then
          v = value[i]
        end
        bindPattern(elem, v, scope)
      end
    end
    return
  end
  if pt == "ObjectPattern" then
    for _, prop in ipairs(pattern.properties) do
      if prop.type == "RestElement" then
        -- Object rest is rarely needed and requires tracking consumed keys;
        -- punt until a real program needs it.
        error("ObjectPattern RestElement not yet supported", 0)
      end
      local key
      if prop.computed then
        key = evalExpression(prop.key, scope)
      elseif prop.key.type == "Identifier" then
        key = prop.key.name
      else
        key = tostring(prop.key.value)
      end
      local v = lookupProperty(value, key)
      bindPattern(prop.value, v, scope)
    end
    return
  end
  error("bindPattern: unsupported pattern type " .. tostring(pt), 0)
end
M.bindPattern = bindPattern

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
  for i, paramNode in ipairs(fn.params) do
    if paramNode.type == "RestElement" then
      local rest = Values.newArray()
      local n = 0
      for j = i, #args do
        n = n + 1
        rest[n] = args[j]
      end
      rest.length = n
      bindPattern(paramNode.argument, rest, callScope)
      break
    end
    bindPattern(paramNode, args[i], callScope)
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
    if type(node.value) == "table" and node.value.__regex then
      return Values.newRegExp(node.value.source or "", node.value.flags or "")
    end
    return node.value
  end

  if t == "Identifier" then
    return scope:get(node.name)
  end

  if t == "ArrayExpression" then
    local arr = Values.newArray()
    local n = 0
    for _, elem in ipairs(node.elements) do
      if elem == nil then
        n = n + 1
        arr[n] = Values.UNDEFINED
      elseif elem.type == "SpreadElement" then
        local src = evalExpression(elem.argument, scope)
        if type(src) == "table" and src.__kind == "array" then
          for j = 1, src.length or 0 do
            n = n + 1
            arr[n] = src[j]
          end
        end
      else
        n = n + 1
        arr[n] = evalExpression(elem, scope)
      end
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
    for _, a in ipairs(node.arguments) do
      if a.type == "SpreadElement" then
        local src = evalExpression(a.argument, scope)
        if type(src) == "table" and src.__kind == "array" then
          for j = 1, src.length or 0 do
            args[#args + 1] = src[j]
          end
        end
      else
        args[#args + 1] = evalExpression(a, scope)
      end
    end
    local result = callFunction(ctor, args, newObj)
    -- If ctor explicitly returned an object, that's what `new` gives back.
    -- Otherwise, `new` yields the freshly-allocated `this`.
    if type(result) == "table" and (result.__kind == "object" or result.__kind == "array" or result.__kind == "regexp") then
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
    for _, arg in ipairs(node.arguments) do
      if arg.type == "SpreadElement" then
        local src = evalExpression(arg.argument, scope)
        if type(src) == "table" and src.__kind == "array" then
          for j = 1, src.length or 0 do
            args[#args + 1] = src[j]
          end
        end
      else
        args[#args + 1] = evalExpression(arg, scope)
      end
    end
    return callFunction(fn, args, thisVal)
  end

  if t == "FunctionExpression" or t == "ArrowFunctionExpression" then
    return Values.newFunction(node, scope)
  end

  if t == "UnaryExpression" then
    local op = node.operator
    if op == "typeof" then
      -- Special case: typeof of an undeclared identifier is "undefined" (not an error).
      if node.argument.type == "Identifier" and not scope:has(node.argument.name) then
        return "undefined"
      end
      return Values.typeof(evalExpression(node.argument, scope))
    end
    if op == "delete" then
      -- Simplified: return true. Real delete removes own properties.
      return true
    end
    local val = evalExpression(node.argument, scope)
    if op == "!"    then return not Values.truthy(val) end
    if op == "-"    then return -val end
    if op == "+"    then return tonumber(val) or (0/0) end
    if op == "void" then return Values.UNDEFINED end
    error("UnaryExpression: unsupported operator " .. tostring(op), 0)
  end

  if t == "UpdateExpression" then
    local current = evalExpression(node.argument, scope)
    if type(current) ~= "number" then current = tonumber(current) or (0/0) end
    local newVal
    if     node.operator == "++" then newVal = current + 1
    elseif node.operator == "--" then newVal = current - 1
    else error("UpdateExpression: unsupported operator " .. tostring(node.operator), 0) end
    if node.argument.type == "Identifier" then
      scope:set(node.argument.name, newVal)
    elseif node.argument.type == "MemberExpression" then
      local target = evalExpression(node.argument.object, scope)
      local key
      if node.argument.computed then
        key = evalExpression(node.argument.property, scope)
        if type(target) == "table" and target.__kind == "array" and type(key) == "number" then
          key = key + 1
        end
      else
        key = node.argument.property.name
      end
      target[key] = newVal
    else
      error("UpdateExpression: unsupported argument type " .. tostring(node.argument.type), 0)
    end
    if node.prefix then return newVal end
    return current
  end

  if t == "ConditionalExpression" then
    if Values.truthy(evalExpression(node.test, scope)) then
      return evalExpression(node.consequent, scope)
    end
    return evalExpression(node.alternate, scope)
  end

  if t == "TemplateLiteral" then
    -- Pattern: quasis[0] ++ exprs[0] ++ quasis[1] ++ exprs[1] ++ ... ++ quasis[n]
    local parts = {}
    for i, quasi in ipairs(node.quasis) do
      parts[#parts + 1] = (quasi.value and (quasi.value.cooked or quasi.value.raw)) or ""
      local exprNode = node.expressions[i]
      if exprNode then
        local v = evalExpression(exprNode, scope)
        if v == Values.UNDEFINED then v = "undefined"
        elseif v == Values.NULL then v = "null"
        end
        parts[#parts + 1] = tostring(v)
      end
    end
    return table.concat(parts)
  end

  if t == "SequenceExpression" then
    local last = Values.UNDEFINED
    for _, e in ipairs(node.expressions) do
      last = evalExpression(e, scope)
    end
    return last
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
      bindPattern(decl.id, value, scope)
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

  if t == "EmptyStatement" then
    return Values.UNDEFINED
  end

  if t == "BreakStatement" then
    error({ __break = true, label = node.label and node.label.name }, 0)
  end

  if t == "ContinueStatement" then
    error({ __continue = true, label = node.label and node.label.name }, 0)
  end

  -- runLoopBody: encapsulates the pcall + break/continue handling used by all
  -- loop variants. Returns two values: continueLoop (bool), broke (bool).
  local function runLoopBody(body, s)
    local ok, err = pcall(evalStatement, body, s)
    if ok then return true, false end
    if type(err) == "table" then
      if err.__break then return false, true end
      if err.__continue then return true, false end
    end
    error(err, 0)
  end

  if t == "ForStatement" then
    local loopScope = Scope.new(scope)
    if node.init then
      if node.init.type == "VariableDeclaration" then
        evalStatement(node.init, loopScope)
      else
        evalExpression(node.init, loopScope)
      end
    end
    while true do
      if node.test then
        if not Values.truthy(evalExpression(node.test, loopScope)) then break end
      end
      local _, broke = runLoopBody(node.body, loopScope)
      if broke then return Values.UNDEFINED end
      if node.update then evalExpression(node.update, loopScope) end
    end
    return Values.UNDEFINED
  end

  if t == "WhileStatement" then
    while Values.truthy(evalExpression(node.test, scope)) do
      local _, broke = runLoopBody(node.body, scope)
      if broke then return Values.UNDEFINED end
    end
    return Values.UNDEFINED
  end

  if t == "DoWhileStatement" then
    repeat
      local _, broke = runLoopBody(node.body, scope)
      if broke then return Values.UNDEFINED end
    until not Values.truthy(evalExpression(node.test, scope))
    return Values.UNDEFINED
  end

  if t == "ForOfStatement" then
    local iterable = evalExpression(node.right, scope)
    if type(iterable) == "table" and iterable.__kind == "array" then
      for i = 1, iterable.length or 0 do
        local loopScope = Scope.new(scope)
        if node.left.type == "VariableDeclaration" then
          bindPattern(node.left.declarations[1].id, iterable[i], loopScope)
        elseif node.left.type == "Identifier" then
          scope:set(node.left.name, iterable[i])
        else
          bindPattern(node.left, iterable[i], loopScope)
        end
        local _, broke = runLoopBody(node.body, loopScope)
        if broke then return Values.UNDEFINED end
      end
      return Values.UNDEFINED
    end
    -- TODO: full iterator protocol (Symbol.iterator) for non-array iterables.
    error("ForOfStatement: only arrays supported so far", 0)
  end

  if t == "ForInStatement" then
    local obj = evalExpression(node.right, scope)
    if type(obj) ~= "table" then return Values.UNDEFINED end
    -- Iterate own enumerable string keys, skipping internal (__-prefixed) keys.
    for k in pairs(obj) do
      if type(k) == "string" and k:sub(1, 2) ~= "__" then
        local loopScope = Scope.new(scope)
        if node.left.type == "VariableDeclaration" then
          bindPattern(node.left.declarations[1].id, k, loopScope)
        elseif node.left.type == "Identifier" then
          scope:set(node.left.name, k)
        else
          bindPattern(node.left, k, loopScope)
        end
        local _, broke = runLoopBody(node.body, loopScope)
        if broke then return Values.UNDEFINED end
      end
    end
    return Values.UNDEFINED
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
