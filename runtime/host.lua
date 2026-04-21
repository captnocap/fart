local M = {}

local function normalize_string(value)
  if type(value) == "string" then
    return value
  end
  if value == nil then
    return ""
  end
  return tostring(value)
end

local function event_aliases(event_type)
  if event_type == "onClick" then
    return { "onClick", "onPress" }
  end
  if event_type == "onPress" then
    return { "onPress", "onClick" }
  end
  if event_type == "onHoverEnter" then
    return { "onHoverEnter", "onMouseEnter" }
  end
  if event_type == "onHoverExit" then
    return { "onHoverExit", "onMouseLeave" }
  end
  return { event_type }
end

local function dispatch_aliases(registry, id, aliases, ...)
  local handlers = registry and registry[id]
  if not handlers then
    return false
  end

  for _, name in ipairs(aliases) do
    local fn = handlers[name]
    if type(fn) == "function" then
      fn(...)
      return true
    end
  end

  return false
end

local function safe_call(fn, ...)
  if type(fn) ~= "function" then
    return nil
  end
  local ok, result = pcall(fn, ...)
  if ok then
    return result
  end
  return nil
end

function M.install(target, opts)
  target = target or _G
  opts = opts or {}

  local registry = opts.handlerRegistry or target.__eqjsHandlerRegistry or {}
  target.__eqjsHandlerRegistry = registry

  local host_log = opts.hostLog or target.__hostLog
  local get_input_text = opts.getInputText or target.__getInputTextForNode or target.__getInputText
  local get_right_click = opts.getPreparedRightClick or target.__getPreparedRightClick
  local get_scroll = opts.getPreparedScroll or target.__getPreparedScroll
  local prepare_context = opts.prepareContext or target.__prepareContext
  local release_context = opts.releaseContext or target.__releaseEffectContext

  target.__hostFlush = target.__hostFlush or function(_commands) end
  target.__hostLog = host_log or function(_level, _message) end
  target.__beginJsEvent = target.__beginJsEvent or function() end
  target.__endJsEvent = target.__endJsEvent or function() end

  target.__dispatchEvent = function(id, event_type)
    local ok = dispatch_aliases(registry, id, event_aliases(event_type), { targetId = id })
    if not ok and type(host_log) == "function" then
      safe_call(host_log, 0, string.format("[dispatch] id=%s type=%s handlers=(none)", tostring(id), tostring(event_type)))
    end
  end

  target.__dispatchInputChange = function(id)
    local text = normalize_string(safe_call(get_input_text, id))
    dispatch_aliases(registry, id, { "onChangeText", "onChange", "onInput" }, text, { targetId = id, text = text })
  end

  target.__dispatchInputSubmit = function(id)
    local text = normalize_string(safe_call(get_input_text, id))
    dispatch_aliases(registry, id, { "onSubmit", "onSubmitEditing" }, text, { targetId = id, text = text })
  end

  target.__dispatchInputFocus = function(id)
    dispatch_aliases(registry, id, { "onFocus" }, { targetId = id })
  end

  target.__dispatchInputBlur = function(id)
    dispatch_aliases(registry, id, { "onBlur" }, { targetId = id })
  end

  target.__dispatchInputKey = function(id, keyCode, mods)
    dispatch_aliases(registry, id, { "onKeyDown" }, { targetId = id, keyCode = keyCode, mods = mods })
  end

  target.__dispatchRightClick = function(id)
    local payload = { targetId = id }
    local extra = safe_call(get_right_click)
    if type(extra) == "table" then
      for key, value in pairs(extra) do
        payload[key] = value
      end
    end
    dispatch_aliases(registry, id, { "onRightClick", "onContextMenu" }, payload)
  end

  target.__dispatchScroll = function(id)
    local payload = { targetId = id }
    local extra = safe_call(get_scroll)
    if type(extra) == "table" then
      for key, value in pairs(extra) do
        payload[key] = value
      end
    end
    dispatch_aliases(registry, id, { "onScroll" }, payload)
  end

  target.__dispatchCanvasMove = function(id, gx, gy)
    dispatch_aliases(registry, id, { "onMove" }, { targetId = id, gx = gx, gy = gy })
  end

  target.__dispatchEffectRender = function(id, buffer, width, height, stride, time, dt, mouse_x, mouse_y, mouse_inside, frame)
    local handlers = registry and registry[id]
    local fn = handlers and handlers.onRender
    if type(fn) ~= "function" then
      return
    end

    local ctx = safe_call(prepare_context, id, buffer, width, height, stride, time, dt, mouse_x, mouse_y, mouse_inside, frame)
    if ctx == nil then
      ctx = {
        id = id,
        buffer = buffer,
        width = width,
        height = height,
        stride = stride,
        time = time,
        dt = dt,
        mouse_x = mouse_x,
        mouse_y = mouse_y,
        mouse_inside = mouse_inside,
        frame = frame,
      }
    end

    local ok, err = pcall(fn, ctx)
    if not ok and type(host_log) == "function" then
      safe_call(host_log, 2, string.format("[effect] id=%s error: %s", tostring(id), tostring(err)))
    end
  end

  target.__releaseEffectContext = function(id)
    safe_call(release_context, id)
  end

  return target
end

M.dispatchAliases = dispatch_aliases
M.eventAliases = event_aliases

return M
