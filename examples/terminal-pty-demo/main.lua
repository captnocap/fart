local ReactLove = require("lua.init")
local pty = require("pty")

local function registerPtyRpcHandlers()
  ReactLove.rpc("pty:start", function(args)
    local status, err = pty.start(args or {})
    if not status then
      error(err or "failed to start PTY session")
    end
    return status
  end)

  ReactLove.rpc("pty:write", function(args)
    local ok, err = pty.write(args and args.data or "")
    if not ok then
      error(err or "failed to write to PTY")
    end
    return { ok = true }
  end)

  ReactLove.rpc("pty:resize", function(args)
    local ok, err = pty.resize(args and args.cols, args and args.rows)
    if not ok then
      error(err or "failed to resize PTY")
    end
    return pty.status()
  end)

  ReactLove.rpc("pty:drain", function(args)
    return pty.drain(args and args.maxBytes)
  end)

  ReactLove.rpc("pty:status", function()
    return pty.status()
  end)

  ReactLove.rpc("pty:stop", function()
    pty.stop()
    return pty.status()
  end)
end

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
  ReactLove.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = "lib/libquickjs",
  })
  registerPtyRpcHandlers()
end

function love.update(dt)
  ReactLove.update(dt)
end

function love.draw()
  ReactLove.draw()
end

function love.mousepressed(x, y, button)
  ReactLove.mousepressed(x, y, button)
end

function love.mousereleased(x, y, button)
  ReactLove.mousereleased(x, y, button)
end

function love.mousemoved(x, y, dx, dy)
  ReactLove.mousemoved(x, y)
end

function love.wheelmoved(x, y)
  ReactLove.wheelmoved(x, y)
end

function love.resize(w, h)
  ReactLove.resize(w, h)
end

function love.keypressed(key, scancode, isrepeat)
  ReactLove.keypressed(key, scancode, isrepeat)
end

function love.keyreleased(key, scancode)
  ReactLove.keyreleased(key, scancode)
end

function love.textinput(text)
  ReactLove.textinput(text)
end

function love.filedropped(file)
  ReactLove.filedropped(file)
end

function love.directorydropped(dir)
  ReactLove.directorydropped(dir)
end

function love.joystickadded(joystick)
  ReactLove.joystickadded(joystick)
end

function love.joystickremoved(joystick)
  ReactLove.joystickremoved(joystick)
end

function love.gamepadpressed(joystick, button)
  ReactLove.gamepadpressed(joystick, button)
end

function love.gamepadreleased(joystick, button)
  ReactLove.gamepadreleased(joystick, button)
end

function love.gamepadaxis(joystick, axis, value)
  ReactLove.gamepadaxis(joystick, axis, value)
end

function love.quit()
  pty.stop()
  ReactLove.quit()
end
