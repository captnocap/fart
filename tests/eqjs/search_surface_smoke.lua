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

local function assert_ops(actual, expected, label)
  assert_eq(#actual, #expected, label .. " length")
  for i = 1, #expected do
    local got = op_sig(actual[i])
    if got ~= expected[i] then
      error(string.format("%s[%d] expected %s, got %s", label, i, expected[i], got), 2)
    end
  end
end

local function has_sig(ops, needle)
  for _, op in ipairs(ops) do
    if op_sig(op) == needle then
      return true
    end
  end
  return false
end

return function()
  local function build(query)
    return React.createElement("Col", { style = { width = "100%", height = "100%", backgroundColor = "#161b24", borderLeftWidth = 1 } },
      React.createElement("Col", { style = { padding = 14, gap = 8, borderBottomWidth = 1 } },
        React.createElement("Row", { style = { alignItems = "center", justifyContent = "space-between" } },
          React.createElement("Text", { style = { fontWeight = "bold" } }, "Project Search"),
          React.createElement("Text", nil, "reactjit / main"),
          React.createElement("Pressable", { onPress = function() return "close" end }, React.createElement("Text", nil, "X"))
        ),
        React.createElement("Box", { style = { padding = 10, borderRadius = 12, borderWidth = 1, backgroundColor = "#202631" } },
          React.createElement("TextInput", { value = query, onChange = function() return "change" end, placeholder = "rg query", fontSize = 11 })
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
          React.createElement("Pressable", { key = "cart/cursor-ide/components/search.tsx:8:bar", onPress = function() return "open2" end },
            React.createElement("Row", { style = { alignItems = "center", gap = 6 } },
              React.createElement("Text", { style = { fontWeight = "bold" } }, "cart/cursor-ide/components/search.tsx"),
              React.createElement("Text", nil, ":8"),
              React.createElement("Box", { style = { flexGrow = 1 } }),
              React.createElement("Text", nil, "2")
            ),
            React.createElement("Text", nil, "const compactBand = props.widthBand === 'narrow'")
          )
        )
      ),
      React.createElement("Row", { style = { justifyContent = "space-between", alignItems = "center", padding = 12, borderTopWidth = 1 } },
        React.createElement("Text", nil, "results in workspace"),
        React.createElement("Pressable", { onPress = function() return "refresh" end }, React.createElement("Text", nil, "Refresh"))
      )
    )
  end

  local emitter = host.newEmitter()
  reconciler.render(nil, build("rg query"), emitter)
  local ops = emitter:flush()
  assert_eq(#ops > 0, true, "search render emitted")
  assert_eq(op_sig(ops[1]), "CREATE|t=Col|id=1", "search root")
  assert_eq(op_sig(ops[2]), "APPEND_TO_ROOT|c=1", "search root append")
  assert_eq(has_sig(ops, "CREATE|t=TextInput|id=12"), true, "search input mounted")
end
