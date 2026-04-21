local host = require("renderer.hostConfig")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

local function assert_table_eq(got, expected, label)
  local function normalize(value)
    if type(value) ~= "table" then
      return value
    end
    local out = {}
    for k, v in pairs(value) do
      out[k] = normalize(v)
    end
    return out
  end

  local function serialize(value)
    if type(value) ~= "table" then
      return tostring(value)
    end
    local keys = {}
    for k in pairs(value) do
      keys[#keys + 1] = k
    end
    table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
    local parts = {}
    for _, k in ipairs(keys) do
      parts[#parts + 1] = tostring(k) .. "=" .. serialize(value[k])
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end

  if serialize(normalize(got)) ~= serialize(normalize(expected)) then
    error(label .. " mismatch:\n  got: " .. serialize(got) .. "\n  expected: " .. serialize(expected), 2)
  end
end

return function()
  local clean, handlers = host.extractHandlers({
    title = "card",
    style = { width = 10, height = 20 },
    onClick = function() return "click" end,
    children = "ignored",
  })

  assert_eq(clean.title, "card", "title")
  assert_eq(clean.style.width, 10, "style.width")
  assert_eq(clean.style.height, 20, "style.height")
  assert_eq(handlers.onClick() , "click", "handler")

  local diff = host.diffCleanProps(
    { title = "card", style = { width = 10, height = 20 }, stale = true },
    { title = "card", style = { height = 30 }, fresh = true }
  )
  assert(diff, "diff expected")
  assert_eq(diff.diff.title, nil, "unchanged prop")
  assert_eq(diff.diff.fresh, true, "new prop")
  assert_table_eq(diff.diff.style, { height = 30 }, "style diff")
  assert_table_eq(diff.removeKeys, { "stale" }, "remove keys")
  assert_table_eq(diff.removeStyleKeys, { "width" }, "remove style keys")

  local coalesced = host.coalesceCommands({
    { op = "UPDATE", id = 1, props = { style = { width = 1, height = 2 } } },
    { op = "UPDATE", id = 1, props = { style = { width = 3 } } },
    { op = "UPDATE", id = 2, props = { alpha = 1 } },
  })

  assert_eq(#coalesced, 2, "coalesced count")
  assert_table_eq(coalesced[1].props.style, { width = 3, height = 2 }, "merged style")
  assert_eq(coalesced[2].id, 2, "second update id")

  local emitter = host.newEmitter()
  local view_id = emitter:createInstance("View", {
    title = "card",
    style = { width = 10, height = 20 },
    onClick = function() return "click" end,
  })
  emitter:appendToRoot(view_id)
  emitter:update(view_id, { style = { width = 10, height = 20 }, title = "card" }, { style = { width = 30, height = 20 }, title = "card-2" }, { onClick = function() end }, {})

  local ops = emitter:flush()
  assert_eq(#ops, 3, "op count")
  assert_eq(ops[1].op, "CREATE", "create op")
  assert_eq(ops[1].hasHandlers, true, "create handlers")
  assert_eq(ops[2].op, "APPEND_TO_ROOT", "append root")
  assert_eq(ops[3].op, "UPDATE", "update op")
  assert_table_eq(ops[3].props.style, { width = 30 }, "update style diff")
  assert_eq(ops[3].removeKeys, nil, "update remove keys")
end
