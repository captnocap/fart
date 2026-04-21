local bridge = require("runtime.host")
local host = require("renderer.hostConfig")
local reconciler = require("renderer.reconciler")
local React = require("runtime.react")

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

local emitter = host.newEmitter()
local view_mode = "search"
local search_query = "rg query"
local function on_close()
  view_mode = "home"
end
local function on_query(text)
  search_query = text
end

local root = build(view_mode, search_query, on_close, on_query)
local tree
tree, emitter = reconciler.render(nil, root, emitter)
local first = emitter:flush()
assert(#first > 0, "expected initial flush commands")
__hostFlush(first)

local input_id
local close_id
for id, handlers in pairs(emitter.handlerRegistry) do
  if handlers.onChange ~= nil or handlers.onChangeText ~= nil then
    input_id = id
  end
  if handlers.onPress == on_close then
    close_id = id
  end
end
assert(input_id ~= nil, "input handler id not found")
assert(close_id ~= nil, "close handler id not found")

bridge.install(_G, {
  handlerRegistry = emitter.handlerRegistry,
})

__dispatchInputChange(input_id)
assert(search_query == "cursor ide from zig", "zig host input text not applied")

local next_root = build(view_mode, search_query, on_close, on_query)
tree, emitter = reconciler.render(tree, next_root, emitter)
local second = emitter:flush()
assert(#second > 0, "expected second flush commands")
__hostFlush(second)

local saw_update = false
for _, op in ipairs(second) do
  if op.op == "UPDATE" or op.op == "UPDATE_TEXT" then
    saw_update = true
    break
  end
end
assert(saw_update, "expected update ops after host input dispatch")

__dispatchEvent(close_id, "onPress")
assert(view_mode == "home", "close dispatch should switch back to home")

local final_root = build(view_mode, search_query, on_close, on_query)
tree, emitter = reconciler.render(tree, final_root, emitter)
local third = emitter:flush()
assert(#third > 0, "expected third flush commands")
__hostFlush(third)

print("eqjs-host smoke lua: ok")
