local host = require("renderer.hostConfig")
local reconciler = require("renderer.reconciler")
local React = require("runtime.react")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

return function()
  local emitter = host.newEmitter()
  local prev = nil

  local tree1 = React.createElement("View", {
    style = { width = 10, height = 20 },
  }, "hello")

  prev, emitter = reconciler.render(prev, tree1, emitter)
  local first = emitter:flush()
  assert_eq(#first, 4, "first render count")
  assert_eq(first[1].op, "CREATE", "first create")
  assert_eq(first[2].op, "APPEND_TO_ROOT", "first root append")
  assert_eq(first[3].op, "CREATE_TEXT", "first text create")
  assert_eq(first[4].op, "APPEND", "first text append")

  local tree2 = React.createElement("View", {
    style = { width = 30, height = 20 },
  }, "world")

  prev, emitter = reconciler.render(prev, tree2, emitter)
  local second = emitter:flush()
  assert_eq(#second, 2, "second render count")
  assert_eq(second[1].op, "UPDATE", "second update")
  assert_eq(second[2].op, "UPDATE_TEXT", "second text update")
end
