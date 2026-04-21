local React = require("runtime.react")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

return function()
  local runtime = React.createRuntime()
  local events = {}

  runtime:begin("Counter")
  local count, setCount = runtime:useState(0)
  local ref = runtime:useRef("seed")
  runtime:useEffect(function()
    events[#events + 1] = "run:" .. tostring(count)
    return function()
      events[#events + 1] = "cleanup:" .. tostring(count)
    end
  end, { count })
  local dirty = runtime:finish()

  assert_eq(count, 0, "initial state")
  assert_eq(ref.current, "seed", "initial ref")
  assert_eq(dirty, false, "initial dirty")
  assert_eq(events[1], "run:0", "effect run")

  setCount(1)
  assert_eq(runtime.dirty, true, "setter dirtied runtime")

  runtime.dirty = false
  runtime:begin("Counter")
  local next_count = runtime:useState(0)
  local next_ref = runtime:useRef("other")
  runtime:useEffect(function()
    events[#events + 1] = "run:" .. tostring(next_count)
    return function()
      events[#events + 1] = "cleanup:" .. tostring(next_count)
    end
  end, { next_count })
  runtime:finish()

  assert_eq(next_count, 1, "updated state")
  assert_eq(next_ref.current, "seed", "ref persisted")
  assert_eq(events[2], "cleanup:0", "cleanup ordering")
  assert_eq(events[3], "run:1", "rerun ordering")
end
