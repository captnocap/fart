local ReactLove = require("lua.init")

-- The audio engine is loaded and managed by the framework (lua/audio/engine.lua).
-- The React app uses @ilovereact/audio hooks to create modules and control params.
-- Keyboard events are forwarded to the audio engine for zero-latency note triggering.

-- Module ID for the polysynth (set after React initializes the rack)
local synthModuleId = "synth"

function love.load()
  love.graphics.setBackgroundColor(0.06, 0.06, 0.08)
  ReactLove.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = "lib/libquickjs",
  })
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
  -- Octave shift via arrow keys (direct to audio engine)
  local audioEngine = require("lua.audio.engine")
  if audioEngine and audioEngine.getGraph() then
    if key == "up" then
      local mod = audioEngine.getGraph():getModule(synthModuleId)
      if mod then
        local shift = (mod.params.octaveShift or 0) + 12
        if shift > 36 then shift = 36 end
        require("lua.audio.module").setParam(mod, "octaveShift", shift)
      end
      return
    elseif key == "down" then
      local mod = audioEngine.getGraph():getModule(synthModuleId)
      if mod then
        local shift = (mod.params.octaveShift or 0) - 12
        if shift < -36 then shift = -36 end
        require("lua.audio.module").setParam(mod, "octaveShift", shift)
      end
      return
    end

    -- Route keyboard to polysynth for zero-latency note triggering
    if not isrepeat then
      audioEngine.keyNoteOn(synthModuleId, key)
    end
  end

  ReactLove.keypressed(key, scancode, isrepeat)
end

function love.keyreleased(key, scancode)
  local audioEngine = require("lua.audio.engine")
  if audioEngine and audioEngine.getGraph() then
    audioEngine.keyNoteOff(synthModuleId, key)
  end
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
  ReactLove.quit()
end
