--[[
  effects/spirograph.lua — Parametric spirograph curves

  Classical hypotrochoid/epitrochoid mathematical curves that self-animate
  via continuous rotation. Driven by time with sensible defaults; optional
  props override internal values for external control (audio, gamepad, etc).

  React usage:
    <Spirograph />
    <Spirograph speed={1.5} decay={0.03} chaos={0.5} />
    <Spirograph bass={bassValue} mid={midValue} high={highValue} beat={onBeat} />
    <Spirograph background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local floor, random = math.floor, math.random

local Spirograph = {}

function Spirograph.create(w, h, props)
  local cx, cy = w / 2, h / 2
  local scale = math.min(w, h) * 0.35

  return {
    time = 0,
    angle = 0,
    -- Spirograph parameters (will be modulated)
    R1 = scale * 0.8,     -- outer radius
    R2 = scale * 0.35,    -- inner radius
    d  = scale * 0.45,    -- pen distance
    -- Drawing state
    prevX = nil,
    prevY = nil,
    cx = cx,
    cy = cy,
    scale = scale,
    -- Trail points for smooth curves
    lineWidth = 1.5,
    -- Color state
    hue = random() * 1.0,
    cleared = false,
  }
end

function Spirograph.update(state, dt, props, w, h)
  local speed = Util.prop(props, "speed", 1.0)
  local chaos = Util.prop(props, "chaos", 0.3)
  local decay = Util.prop(props, "decay", 0.03)

  -- External driving signals (override time-based defaults if present)
  local bass = Util.prop(props, "bass", nil)
  local mid  = Util.prop(props, "mid", nil)
  local high = Util.prop(props, "high", nil)
  local beat = Util.boolProp(props, "beat", false)

  state.time = state.time + dt * speed
  local t = state.time

  -- Update center if canvas resized
  state.cx = w / 2
  state.cy = h / 2
  state.scale = math.min(w, h) * 0.35

  local sc = state.scale

  -- Derive R1, R2, d from driving signals or time-based oscillation
  if bass then
    state.R1 = sc * (0.6 + bass * 0.8)
  else
    state.R1 = sc * (0.6 + (sin(t * 0.23) + 1) * 0.4)
  end

  if mid then
    state.R2 = sc * (0.3 + mid * 0.7)
  else
    state.R2 = sc * (0.3 + (sin(t * 0.31 + 1.2) + 1) * 0.35)
  end

  if high then
    state.d = sc * (0.2 + high * 0.8)
  else
    state.d = sc * (0.2 + (sin(t * 0.41 + 2.5) + 1) * 0.4)
  end

  -- Rotation speed
  local rotSpeed = (0.015 + chaos * 0.03) * speed
  state.angle = state.angle + rotSpeed

  -- Beat → angle jump
  if beat then
    state.angle = state.angle + 0.3 + chaos * 0.5
  end

  -- Line width from amplitude-like oscillation
  local amp = bass and (bass * 0.5 + (mid or 0.5) * 0.3 + (high or 0.5) * 0.2)
              or (sin(t * 0.7) + 1) * 0.35 + 0.3
  state.lineWidth = 0.8 + amp * 2.5

  -- Color drift
  if bass then
    state.hue = (state.hue + dt * 0.05) % 1
  else
    state.hue = (state.hue + dt * 0.02 * speed) % 1
  end

  state.decay = decay
end

function Spirograph.draw(state, w, h)
  local R = state.R1
  local r = state.R2
  local d = state.d
  local cx, cy = state.cx, state.cy
  local angle = state.angle

  -- Background decay (semi-transparent overlay for trailing effect)
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  -- Prevent division by zero
  if r < 1 then r = 1 end
  local ratio = (R - r) / r

  -- Draw a batch of curve segments per frame for density
  local stepsPerFrame = 120
  local dt = 0.02
  love.graphics.setLineWidth(state.lineWidth)

  for i = 0, stepsPerFrame - 1 do
    local t = angle + i * dt
    local x = cx + (R - r) * cos(t) + d * cos(ratio * t)
    local y = cy + (R - r) * sin(t) - d * sin(ratio * t)

    if state.prevX and state.prevY then
      -- Color varies along the curve
      local segHue = (state.hue + i / stepsPerFrame * 0.15) % 1
      local segSat = 0.7 + (sin(t * 0.5) + 1) * 0.15
      local segLit = 0.45 + (sin(t * 0.3 + 1) + 1) * 0.15
      local cr, cg, cb = Util.hslToRgb(segHue, segSat, segLit)
      love.graphics.setColor(cr, cg, cb, 0.85)
      love.graphics.line(state.prevX, state.prevY, x, y)
    end

    state.prevX = x
    state.prevY = y
  end

  -- Advance angle for next frame
  state.angle = state.angle + stepsPerFrame * dt

  -- Glow at current position
  local glowR, glowG, glowB = Util.hslToRgb(state.hue, 0.9, 0.6)
  love.graphics.setColor(glowR, glowG, glowB, 0.4)
  love.graphics.circle("fill", state.prevX or cx, state.prevY or cy, 4)
end

Effects.register("Spirograph", Spirograph)

return Spirograph
