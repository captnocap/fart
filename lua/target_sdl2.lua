--[[
  target_sdl2.lua -- SDL2 + OpenGL target implementation

  Drop-in replacement for target_love2d.lua. Provides the same
  { name, measure, painter } interface backed by FreeType + OpenGL
  instead of Love2D's graphics APIs.

  The sdl2 target has no Love2D dependency. It runs via:
    luajit sdl2_init.lua   (from the project root)

  Images: not yet implemented (will use stb_image in a future pass).
  Videos: not supported on this target.
]]

local Target = {}

Target.name    = "sdl2"
Target.measure = require("lua.sdl2_measure")
Target.painter = require("lua.sdl2_painter")
Target.images  = nil   -- TODO: stb_image FFI
Target.videos  = nil   -- not supported

return Target
