--[[
  effects/mirror.lua — Kaleidoscope / N-fold mirror symmetry

  Flow-field particle system where every particle is reflected N times
  around the center, creating mandala-like kaleidoscope patterns.

  React usage:
    <Mirror />
    <Mirror segments={12} speed={0.8} />
    <Mirror bass={bass} high={high} beat={onBeat} />
    <Mirror background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local atan2, sqrt = math.atan2, math.sqrt
local random, noise = math.random, love.math.noise
local floor = math.floor

local Mirror = {}

local MAX_PARTICLES = 300
local TRAIL_LENGTH = 12

function Mirror.create(w, h, props)
  local particles = {}
  for i = 1, 40 do
    local angle = random() * pi * 2
    local dist = random() * math.min(w, h) * 0.3
    table.insert(particles, {
      x = w / 2 + cos(angle) * dist,
      y = h / 2 + sin(angle) * dist,
      vx = 0, vy = 0,
      trail = {},
      age = 0,
      hue = random(),
      size = 1 + random() * 1.5,
    })
  end

  return {
    time = 0,
    particles = particles,
    fieldScale = 0.004,
    fieldStrength = 1.2,
    turbulence = 1.0,
    hue = random(),
    segments = 8,
    cleared = false,
    spawnAccum = 0,
  }
end

local function sampleField(x, y, time, scale, turbulence)
  local n1 = noise(x * scale, y * scale, time * 0.25) * 2 - 1
  local n2 = noise(x * scale * 2, y * scale * 2, time * 0.25 + 100) * 2 - 1
  return (n1 + n2 * 0.5 * turbulence) * pi * 2
end

function Mirror.update(state, dt, props, w, h)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.05)
  local bass = Util.prop(props, "bass", nil)
  local high = Util.prop(props, "high", nil)
  local beat = Util.boolProp(props, "beat", false)
  local amplitude = Util.prop(props, "amplitude", nil)
  state.segments = floor(Util.prop(props, "segments", 8))

  state.time = state.time + dt * speed * 0.4
  state.decay = decay

  local t = state.time

  if bass then
    state.fieldStrength = 0.5 + bass * 2
  else
    state.fieldStrength = 1.0 + (sin(t * 0.3) + 1) * 0.5
  end

  if high then
    state.turbulence = 0.5 + high * 2
  else
    state.turbulence = 0.7 + (sin(t * 0.2 + 2) + 1) * 0.5
  end

  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)

  -- Spawn particles near center
  state.spawnAccum = state.spawnAccum + dt * (1 + amp * 4) * speed
  while state.spawnAccum >= 1 and #state.particles < MAX_PARTICLES do
    state.spawnAccum = state.spawnAccum - 1
    local angle = random() * pi * 2
    local dist = 5 + random() * math.min(w, h) * 0.15
    table.insert(state.particles, {
      x = w / 2 + cos(angle) * dist,
      y = h / 2 + sin(angle) * dist,
      vx = 0, vy = 0,
      trail = {},
      age = 0,
      hue = (state.hue + random() * 0.1) % 1,
      size = 1 + random() * 1.5,
    })
  end

  -- Beat burst
  local isBeat = beat
  if not beat then
    isBeat = sin(t * pi * 0.8) > 0.96
  end
  if isBeat then
    local burstCount = 8 + floor(random() * 6)
    for i = 1, burstCount do
      if #state.particles >= MAX_PARTICLES then break end
      local angle = random() * pi * 2
      table.insert(state.particles, {
        x = w / 2 + cos(angle) * 5,
        y = h / 2 + sin(angle) * 5,
        vx = cos(angle) * 20,
        vy = sin(angle) * 20,
        trail = {},
        age = 0,
        hue = (state.hue + random() * 0.08) % 1,
        size = 1.5 + random() * 2,
      })
    end
  end

  -- Update particles
  local alive = {}
  local maxDist = math.min(w, h) * 0.48
  local cx, cy = w / 2, h / 2

  for _, p in ipairs(state.particles) do
    local angle = sampleField(p.x, p.y, state.time, state.fieldScale, state.turbulence)
    p.vx = p.vx * 0.92 + cos(angle) * state.fieldStrength * 0.35
    p.vy = p.vy * 0.92 + sin(angle) * state.fieldStrength * 0.35
    p.x = p.x + p.vx * speed
    p.y = p.y + p.vy * speed
    p.age = p.age + dt

    table.insert(p.trail, 1, { p.x, p.y })
    if #p.trail > TRAIL_LENGTH then table.remove(p.trail) end

    local dist = Util.dist(p.x, p.y, cx, cy)
    if dist < maxDist and p.age < 25 then
      table.insert(alive, p)
    end
  end
  state.particles = alive

  state.hue = (state.hue + dt * 0.012 * speed) % 1
end

function Mirror.draw(state, w, h)
  -- Background decay
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.05)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  local cx, cy = w / 2, h / 2
  local segments = state.segments
  local segAngle = pi * 2 / segments

  for _, p in ipairs(state.particles) do
    local r, g, b = Util.hslToRgb(p.hue, 0.75, 0.5)

    -- Compute angle and distance from center for this particle
    local dx, dy = p.x - cx, p.y - cy
    local dist = sqrt(dx * dx + dy * dy)
    local angle = atan2(dy, dx)

    -- Draw for each mirror segment
    for seg = 0, segments - 1 do
      local segA = seg * segAngle
      local drawAngle
      if seg % 2 == 0 then
        drawAngle = segA + angle
      else
        drawAngle = segA - angle  -- mirror
      end

      local mx = cx + cos(drawAngle) * dist
      local my = cy + sin(drawAngle) * dist

      -- Particle dot
      love.graphics.setColor(r, g, b, 0.7)
      love.graphics.circle("fill", mx, my, p.size)

      -- Trail segment (just one line to previous for performance)
      if #p.trail >= 2 then
        local pdx, pdy = p.trail[2][1] - cx, p.trail[2][2] - cy
        local pDist = sqrt(pdx * pdx + pdy * pdy)
        local pAngle = atan2(pdy, pdx)
        local pDrawAngle
        if seg % 2 == 0 then
          pDrawAngle = segA + pAngle
        else
          pDrawAngle = segA - pAngle
        end
        local px2 = cx + cos(pDrawAngle) * pDist
        local py2 = cy + sin(pDrawAngle) * pDist

        love.graphics.setColor(r, g, b, 0.35)
        love.graphics.setLineWidth(p.size * 0.5)
        love.graphics.line(mx, my, px2, py2)
      end
    end
  end
end

Effects.register("Mirror", Mirror)

return Mirror
