local bridge = require("runtime.host")
local host = require("renderer.hostConfig")
local reconciler = require("renderer.reconciler")
local React = require("runtime.react")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

local function op_sig(op)
  local parts = { op.op }
  if op.type then parts[#parts + 1] = "t=" .. op.type end
  if op.id then parts[#parts + 1] = "id=" .. tostring(op.id) end
  if op.parentId then parts[#parts + 1] = "p=" .. tostring(op.parentId) end
  if op.childId then parts[#parts + 1] = "c=" .. tostring(op.childId) end
  if op.text then parts[#parts + 1] = "x=" .. tostring(op.text) end
  return table.concat(parts, "|")
end

local function signatures(ops)
  local out = {}
  for i, op in ipairs(ops) do
    out[i] = op_sig(op)
  end
  return out
end

local function build(view_mode, search_query, on_close, on_query)
  if view_mode == "home" then
    return React.createElement("Col", { style = { width = "100%", height = "100%", backgroundColor = "#0b0f15" } },
      React.createElement("Text", { style = { fontWeight = "bold" } }, "Projects"),
      React.createElement("Pressable", { onPress = function() return "open-search" end }, React.createElement("Text", nil, "Search"))
    )
  end

  return React.createElement("Col", { style = { width = "100%", height = "100%", backgroundColor = "#161b24", borderLeftWidth = 1 } },
    React.createElement("Col", { style = { padding = 14, gap = 8, borderBottomWidth = 1 } },
      React.createElement("Row", { style = { alignItems = "center", justifyContent = "space-between" } },
        React.createElement("Text", { style = { fontWeight = "bold" } }, "Project Search"),
        React.createElement("Text", nil, "reactjit / main"),
        React.createElement("Pressable", { onPress = on_close }, React.createElement("Text", nil, "X"))
      ),
      React.createElement("Box", { style = { padding = 10, borderRadius = 12, borderWidth = 1, backgroundColor = "#202631" } },
        React.createElement("TextInput", { value = search_query, onChange = on_query, placeholder = "rg query", fontSize = 11 })
      ),
      React.createElement("Row", { style = { gap = 8 } },
        React.createElement("Box", nil, React.createElement("Text", nil, "repo")),
        React.createElement("Box", nil, React.createElement("Text", nil, "case")),
        React.createElement("Box", nil, React.createElement("Text", nil, "regex"))
      )
    ),
    React.createElement("ScrollView", { style = { flexGrow = 1, flexShrink = 1, flexBasis = 0, padding = 12 } },
      React.createElement("Col", { style = { gap = 8 } },
        React.createElement("Pressable", { key = "cart/cursor-ide/index.tsx:12:foo", onPress = function() return "open1" end },
          React.createElement("Row", { style = { alignItems = "center", gap = 6 } },
            React.createElement("Text", { style = { fontWeight = "bold" } }, "cart/cursor-ide/index.tsx"),
            React.createElement("Text", nil, ":12"),
            React.createElement("Box", { style = { flexGrow = 1 } }),
            React.createElement("Text", nil, "4")
          ),
          React.createElement("Text", nil, "const [activeTabId, setActiveTabId] = useState('home')")
        ),
        React.createElement("Text", nil, "query: " .. search_query)
      )
    )
  )
end

return function()
  local emitter = host.newEmitter()
  local view_mode = "search"
  local search_query = "rg query"
  local close_press = function()
    view_mode = "home"
  end
  local on_query = function(text)
    search_query = text
  end

  local root = build(view_mode, search_query, close_press, on_query)
  local tree, _ = reconciler.render(nil, root, emitter)
  local first_ops = emitter:flush()
  assert_eq(type(tree), "table", "tree")

  local close_id
  local input_id
  for id, handlers in pairs(emitter.handlerRegistry) do
    if handlers.onPress == close_press then
      close_id = id
    end
    if handlers.onChange ~= nil then
      input_id = id
    end
  end
  assert(close_id ~= nil, "close button handler id not found")
  assert(input_id ~= nil, "input handler id not found")

  local runtime_bridge = bridge.install({}, {
    handlerRegistry = emitter.handlerRegistry,
    getInputText = function() return "cursor ide search" end,
    hostLog = function() end,
  })

  runtime_bridge.__dispatchInputChange(input_id)
  assert_eq(search_query, "cursor ide search", "query changed by input dispatch")

  local next_tree = build(view_mode, search_query, close_press, on_query)
  tree, _ = reconciler.render(tree, next_tree, emitter)
  local second_ops = emitter:flush()

  assert(#first_ops > 0, "first render should emit commands")
  assert(#second_ops > 0, "second render should emit commands")
  assert(table.concat(signatures(first_ops), "\n") ~= table.concat(signatures(second_ops), "\n"), "op stream should change after dispatch")

  local saw_remove_or_update = false
  for _, op in ipairs(second_ops) do
    if op.op == "REMOVE" or op.op == "UPDATE" or op.op == "UPDATE_TEXT" then
      saw_remove_or_update = true
      break
    end
  end
  assert(saw_remove_or_update, "expected changed op stream after dispatch")
end
