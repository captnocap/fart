local host = require("runtime.host")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

return function()
  local calls = {}
  local registry = {
    [1] = {
      onClick = function(payload) calls[#calls + 1] = { "click", payload.targetId } end,
      onChange = function(text, payload) calls[#calls + 1] = { "change", text, payload.targetId } end,
      onSubmitEditing = function(text, payload) calls[#calls + 1] = { "submit", text, payload.targetId } end,
      onFocus = function(payload) calls[#calls + 1] = { "focus", payload.targetId } end,
      onBlur = function(payload) calls[#calls + 1] = { "blur", payload.targetId } end,
      onKeyDown = function(payload) calls[#calls + 1] = { "key", payload.keyCode, payload.mods } end,
      onContextMenu = function(payload) calls[#calls + 1] = { "context", payload.extra, payload.targetId } end,
      onScroll = function(payload) calls[#calls + 1] = { "scroll", payload.deltaY, payload.targetId } end,
      onMove = function(payload) calls[#calls + 1] = { "move", payload.gx, payload.gy, payload.targetId } end,
      onRender = function(ctx) calls[#calls + 1] = { "render", ctx.id, ctx.width, ctx.height } end,
    },
  }

  local target = host.install({}, {
    handlerRegistry = registry,
    getInputText = function(id) return "text:" .. tostring(id) end,
    getPreparedRightClick = function() return { extra = "menu" } end,
    getPreparedScroll = function() return { deltaY = 8 } end,
    prepareContext = function(id, _buffer, width, height)
      return { id = id, width = width, height = height }
    end,
    releaseContext = function(id) calls[#calls + 1] = { "release", id } end,
    hostLog = function(level, message) calls[#calls + 1] = { "log", level, message } end,
  })

  assert_eq(type(target.__dispatchEvent), "function", "__dispatchEvent")
  assert_eq(type(target.__dispatchInputChange), "function", "__dispatchInputChange")

  target.__dispatchEvent(1, "onPress")
  target.__dispatchInputChange(1)
  target.__dispatchInputSubmit(1)
  target.__dispatchInputFocus(1)
  target.__dispatchInputBlur(1)
  target.__dispatchInputKey(1, 13, 5)
  target.__dispatchRightClick(1)
  target.__dispatchScroll(1)
  target.__dispatchCanvasMove(1, 2, 3)
  target.__dispatchEffectRender(1, {}, 640, 480, 2560, 0, 16, 0, 0, false, 7)
  target.__releaseEffectContext(1)

  assert_eq(#calls, 11, "call count")
  assert_eq(calls[1][1], "click", "click alias")
  assert_eq(calls[2][1], "change", "change alias")
  assert_eq(calls[2][2], "text:1", "change text")
  assert_eq(calls[3][1], "submit", "submit alias")
  assert_eq(calls[4][1], "focus", "focus")
  assert_eq(calls[5][1], "blur", "blur")
  assert_eq(calls[6][1], "key", "key")
  assert_eq(calls[7][1], "context", "context")
  assert_eq(calls[7][2], "menu", "context payload")
  assert_eq(calls[8][1], "scroll", "scroll")
  assert_eq(calls[8][2], 8, "scroll payload")
  assert_eq(calls[9][1], "move", "move")
  assert_eq(calls[10][1], "render", "render")
  assert_eq(calls[11][1], "release", "release")
end
