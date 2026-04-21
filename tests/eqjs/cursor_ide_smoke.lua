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
  if op.type then parts[#parts + 1] = op.type end
  if op.id then parts[#parts + 1] = "id=" .. tostring(op.id) end
  if op.parentId then parts[#parts + 1] = "p=" .. tostring(op.parentId) end
  if op.childId then parts[#parts + 1] = "c=" .. tostring(op.childId) end
  if op.text then parts[#parts + 1] = "t=" .. tostring(op.text) end
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

local function top_bar(active_search)
  return React.createElement("Row", {
    windowDrag = true,
    style = {
      paddingLeft = 10,
      paddingRight = 10,
      paddingTop = 8,
      paddingBottom = 8,
      backgroundColor = "#1b2230",
      borderBottomWidth = 1,
    },
  },
    React.createElement("Pressable", { onPress = function() return "home" end },
      React.createElement("Box", { style = { width = 12, height = 12, borderRadius = 6, backgroundColor = "#2d62ff" } })
    ),
    React.createElement("Text", { style = { fontWeight = "bold" } }, "reactjit"),
    React.createElement("Pressable", { onPress = function() return "refresh" end },
      React.createElement("Text", nil, "Refresh")
    ),
    React.createElement("Pressable", { onPress = function() return "search" end, active = active_search and 1 or 0 },
      React.createElement("Text", nil, "Search")
    )
  )
end

local function tab_bar(active_id)
  return React.createElement("Row", {
    style = { backgroundColor = "#161b24", borderBottomWidth = 1 },
  },
    React.createElement("Pressable", { key = "home", onPress = function() return "home" end, active = active_id == "home" and 1 or 0 },
      React.createElement("Text", nil, "Projects")
    ),
    React.createElement("Pressable", { key = "editor", onPress = function() return "editor" end, active = active_id == "editor" and 1 or 0 },
      React.createElement("Text", nil, "index.tsx")
    ),
    React.createElement("Pressable", { key = "settings", onPress = function() return "settings" end, active = active_id == "settings" and 1 or 0 },
      React.createElement("Text", nil, "Settings")
    )
  )
end

local function main_surface(mode)
  if mode == "home" then
    return React.createElement("Col", {
      style = { flexGrow = 1, flexBasis = 0, backgroundColor = "#0f141c" },
    },
      React.createElement("Row", { style = { gap = 8, padding = 12 } },
        React.createElement("Text", { style = { fontWeight = "bold" } }, "Project landing"),
        React.createElement("Text", nil, "Branch main"),
        React.createElement("Text", nil, "0 dirty")
      ),
      React.createElement("Box", { style = { flexGrow = 1, flexBasis = 0 } },
        React.createElement("Text", nil, "Recent files")
      )
    )
  end

  return React.createElement("Col", {
    style = { flexGrow = 1, flexBasis = 0, backgroundColor = "#0f141c" },
  },
    React.createElement("Row", { style = { gap = 8, padding = 12 } },
      React.createElement("Text", { style = { fontWeight = "bold" } }, "Editor"),
      React.createElement("Text", nil, "Ln 1"),
      React.createElement("Text", nil, "Col 1")
    ),
    React.createElement("Native", { type = "Terminal", style = { width = "100%", height = "100%" } })
  )
end

return function()
  local emitter = host.newEmitter()
  local prev = nil

  local tree1 = React.createElement("Col", {
    style = { width = "100%", height = "100%", backgroundColor = "#0b0f15" },
  },
    top_bar(false),
    tab_bar("home"),
    main_surface("home"),
    React.createElement("Row", {
      style = { justifyContent = "space-between", paddingLeft = 10, paddingRight = 10, paddingTop = 6, paddingBottom = 6 },
    },
      React.createElement("Text", nil, "dirty 0"),
      React.createElement("Text", nil, "claude-opus-4")
    )
  )

  prev, emitter = reconciler.render(prev, tree1, emitter)
  local first = emitter:flush()
  assert_ops(first, {
    "CREATE|Col|id=1",
    "APPEND_TO_ROOT|c=1",
    "CREATE|Row|id=2",
    "APPEND|p=1|c=2",
    "CREATE|Pressable|id=3",
    "APPEND|p=2|c=3",
    "CREATE|Box|id=4",
    "APPEND|p=3|c=4",
    "CREATE|Text|id=5",
    "APPEND|p=2|c=5",
    "CREATE_TEXT|id=6|t=reactjit",
    "APPEND|p=5|c=6",
    "CREATE|Pressable|id=7",
    "APPEND|p=2|c=7",
    "CREATE|Text|id=8",
    "APPEND|p=7|c=8",
    "CREATE_TEXT|id=9|t=Refresh",
    "APPEND|p=8|c=9",
    "CREATE|Pressable|id=10",
    "APPEND|p=2|c=10",
    "CREATE|Text|id=11",
    "APPEND|p=10|c=11",
    "CREATE_TEXT|id=12|t=Search",
    "APPEND|p=11|c=12",
    "CREATE|Row|id=13",
    "APPEND|p=1|c=13",
    "CREATE|Pressable|id=14",
    "APPEND|p=13|c=14",
    "CREATE|Text|id=15",
    "APPEND|p=14|c=15",
    "CREATE_TEXT|id=16|t=Projects",
    "APPEND|p=15|c=16",
    "CREATE|Pressable|id=17",
    "APPEND|p=13|c=17",
    "CREATE|Text|id=18",
    "APPEND|p=17|c=18",
    "CREATE_TEXT|id=19|t=index.tsx",
    "APPEND|p=18|c=19",
    "CREATE|Pressable|id=20",
    "APPEND|p=13|c=20",
    "CREATE|Text|id=21",
    "APPEND|p=20|c=21",
    "CREATE_TEXT|id=22|t=Settings",
    "APPEND|p=21|c=22",
    "CREATE|Col|id=23",
    "APPEND|p=1|c=23",
    "CREATE|Row|id=24",
    "APPEND|p=23|c=24",
    "CREATE|Text|id=25",
    "APPEND|p=24|c=25",
    "CREATE_TEXT|id=26|t=Project landing",
    "APPEND|p=25|c=26",
    "CREATE|Text|id=27",
    "APPEND|p=24|c=27",
    "CREATE_TEXT|id=28|t=Branch main",
    "APPEND|p=27|c=28",
    "CREATE|Text|id=29",
    "APPEND|p=24|c=29",
    "CREATE_TEXT|id=30|t=0 dirty",
    "APPEND|p=29|c=30",
    "CREATE|Box|id=31",
    "APPEND|p=23|c=31",
    "CREATE|Text|id=32",
    "APPEND|p=31|c=32",
    "CREATE_TEXT|id=33|t=Recent files",
    "APPEND|p=32|c=33",
    "CREATE|Row|id=34",
    "APPEND|p=1|c=34",
    "CREATE|Text|id=35",
    "APPEND|p=34|c=35",
    "CREATE_TEXT|id=36|t=dirty 0",
    "APPEND|p=35|c=36",
    "CREATE|Text|id=37",
    "APPEND|p=34|c=37",
    "CREATE_TEXT|id=38|t=claude-opus-4",
    "APPEND|p=37|c=38",
  }, "first render")

  local tree2 = React.createElement("Col", {
    style = { width = "100%", height = "100%", backgroundColor = "#0b0f15" },
  },
    top_bar(true),
    tab_bar("editor"),
    main_surface("editor"),
    React.createElement("Row", {
      style = { justifyContent = "space-between", paddingLeft = 10, paddingRight = 10, paddingTop = 6, paddingBottom = 6 },
    },
      React.createElement("Text", nil, "dirty 3"),
      React.createElement("Text", nil, "claude-opus-4")
    )
  )

  prev, emitter = reconciler.render(prev, tree2, emitter)
  local second = emitter:flush()
  assert_ops(second, {
    "UPDATE|id=3",
    "REMOVE|p=4",
    "UPDATE|id=7",
    "UPDATE|id=10",
    "UPDATE|id=14",
    "UPDATE|id=17",
    "UPDATE|id=20",
    "UPDATE_TEXT|id=26|t=Editor",
    "UPDATE_TEXT|id=28|t=Ln 1",
    "UPDATE_TEXT|id=30|t=Col 1",
    "REMOVE|p=32|c=33",
    "REMOVE|p=31|c=32",
    "REMOVE|p=23|c=31",
    "CREATE|Native|id=39",
    "APPEND|p=23|c=39",
    "UPDATE_TEXT|id=36|t=dirty 3",
  }, "second render")
end
