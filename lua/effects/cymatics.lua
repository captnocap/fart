--[[
  effects/cymatics.lua — Chladni plate standing wave simulation

  Particles settle onto nodal lines of a vibrating plate, forming
  geometric patterns that shift as the wave mode changes.

  React usage:
    <Cymatics />
    <Cymatics n={3} m={5} />
    <Cymatics amplitude={amp} beat={onBeat} />
    <Cymatics background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local abs, sqrt, random = math.abs, math.sqrt, math.random
local floor = math.floor

local Cymatics = {}

local MAX_PARTICLES = 4000
local GRID_RES = 4  -- pixel resolution for accumulation

--- Chladni pattern value at normalized coordinates.
--- @param px number  -1 to 1
--- @param py number  -1 to 1
--- @param n number  mode coefficient
--- @param m number  mode coefficient
local function chladniPattern(px, py, n, m)
  return cos(n * pi * px) * cos(m * pi * py) - cos(m * pi * px) * cos(n * pi * py)
end

function Cymatics.create(w, h, props)
  local particles = {}
  for i = 1, 800 do
    table.insert(particles, {
      x = random() * w,
      y = random() * h,
      vx = (random() - 0.5) * 2,
      vy = (random() - 0.5) * 2,
      settled = false,
    })
  end

  -- Accumulation grid
  local gridW = floor(w / GRID_RES)
  local gridH = floor(h / GRID_RES)
  local accum = {}
  for i = 1, gridW * gridH do
    accum[i] = 0
  end

  return {
    time = 0,
    particles = particles,
    n = 3,
    m = 4,
    targetN = 3,
    targetM = 4,
    phase = 0,
    vibration = 0.5,
    attractionStrength = 1.2,
    accum = accum,
    gridW = gridW,
    gridH = gridH,
    hue = random() * 0.3 + 0.5,  -- start in cyan-blue range
    cleared = false,
    spawnAccum = 0,
  }
end

function Cymatics.update(state, dt, props, w, h)
  local speed = Util.prop(props, "speed", 1.0)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)
  local propN = Util.prop(props, "n", nil)
  local propM = Util.prop(props, "m", nil)

  state.time = state.time + dt * speed

  local t = state.time
  local amp = amplitude or ((sin(t * 0.5) + 1) * 0.3 + 0.2)

  -- Target mode shape from props or time
  if propN then
    state.targetN = propN
  else
    state.targetN = 2 + floor((sin(t * 0.08) + 1) * 3)
  end
  if propM then
    state.targetM = propM
  else
    state.targetM = 1 + floor((sin(t * 0.06 + 2) + 1) * 2.5)
  end

  -- Smoothly interpolate mode coefficients
  state.n = state.n + (state.targetN - state.n) * dt * 0.5
  state.m = state.m + (state.targetM - state.m) * dt * 0.5

  -- Phase rotation for vibration
  state.phase = state.phase + (0.1 + amp * 0.3) * speed * dt * 10
  state.vibration = amp * 2

  -- Beat: perturb all particles
  local isBeat = beat
  if not beat then
    isBeat = sin(t * pi * 0.6) > 0.97
  end
  if isBeat then
    for _, p in ipairs(state.particles) do
      p.vx = p.vx + (random() - 0.5) * 15
      p.vy = p.vy + (random() - 0.5) * 15
      p.settled = false
    end
    -- Spawn extra particles on strong beats
    local extra = 50 + floor(random() * 50)
    for i = 1, extra do
      if #state.particles >= MAX_PARTICLES then break end
      table.insert(state.particles, {
        x = random() * w,
        y = random() * h,
        vx = (random() - 0.5) * 8,
        vy = (random() - 0.5) * 8,
        settled = false,
      })
    end
  end

  -- Gradual spawning
  state.spawnAccum = state.spawnAccum + dt * 20 * speed
  while state.spawnAccum >= 1 and #state.particles < MAX_PARTICLES do
    state.spawnAccum = state.spawnAccum - 1
    table.insert(state.particles, {
      x = random() * w,
      y = random() * h,
      vx = (random() - 0.5) * 3,
      vy = (random() - 0.5) * 3,
      settled = false,
    })
  end

  -- Physics: attract particles to nodal lines
  local n, m = state.n, state.m
  local strength = 0.8 + amp * 1.2
  local halfW, halfH = w / 2, h / 2
  local epsilon = 0.01

  for _, p in ipairs(state.particles) do
    -- Normalize to [-1, 1]
    local px = (p.x - halfW) / halfW
    local py = (p.y - halfH) / halfH

    -- Gradient of |pattern| via finite difference
    local pattern = chladniPattern(px, py, n, m)
    local patternDx = chladniPattern(px + epsilon, py, n, m)
    local patternDy = chladniPattern(px, py + epsilon, n, m)

    local gradX = (abs(patternDx) - abs(pattern)) / epsilon
    local gradY = (abs(patternDy) - abs(pattern)) / epsilon

    -- Attract toward nodal lines (where pattern ≈ 0)
    p.vx = p.vx * 0.88 - gradX * strength * halfW * 0.01
    p.vy = p.vy * 0.88 - gradY * strength * halfH * 0.01

    -- Vibration jitter
    p.vx = p.vx + sin(state.phase) * state.vibration * (random() - 0.5)
    p.vy = p.vy + cos(state.phase) * state.vibration * (random() - 0.5)

    p.x = p.x + p.vx * speed * dt * 60
    p.y = p.y + p.vy * speed * dt * 60

    -- Boundary bounce
    if p.x < 0 then p.x = 0; p.vx = abs(p.vx) * 0.5 end
    if p.x > w then p.x = w; p.vx = -abs(p.vx) * 0.5 end
    if p.y < 0 then p.y = 0; p.vy = abs(p.vy) * 0.5 end
    if p.y > h then p.y = h; p.vy = -abs(p.vy) * 0.5 end

    -- Check if settled (near nodal line and low velocity)
    local vel = sqrt(p.vx * p.vx + p.vy * p.vy)
    if abs(pattern) < 0.08 and vel < 1.5 then
      p.settled = true
      -- Accumulate
      local gx = floor(p.x / GRID_RES) + 1
      local gy = floor(p.y / GRID_RES) + 1
      if gx >= 1 and gx <= state.gridW and gy >= 1 and gy <= state.gridH then
        local idx = (gy - 1) * state.gridW + gx
        state.accum[idx] = math.min(state.accum[idx] + 0.1 * dt * 60, 1.0)
      end
    else
      p.settled = false
    end
  end

  -- Decay accumulation
  for i = 1, #state.accum do
    state.accum[i] = state.accum[i] * (1 - 0.005 * dt * 60)
  end

  state.hue = (state.hue + dt * 0.005 * speed) % 1
end

function Cymatics.draw(state, w, h)
  -- Full clear each frame (cymatics draws everything fresh + accumulation)
  love.graphics.setColor(0.04, 0.04, 0.04, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Draw accumulation layer
  local r, g, b = Util.hslToRgb(state.hue, 0.6, 0.4)
  for gy = 1, state.gridH do
    for gx = 1, state.gridW do
      local idx = (gy - 1) * state.gridW + gx
      local val = state.accum[idx]
      if val > 0.02 then
        love.graphics.setColor(r, g, b, val * 0.7)
        love.graphics.rectangle("fill", (gx - 1) * GRID_RES, (gy - 1) * GRID_RES, GRID_RES, GRID_RES)
      end
    end
  end

  -- Draw nodal lines (faint)
  local n, m = state.n, state.m
  local halfW, halfH = w / 2, h / 2
  local lineR, lineG, lineB = Util.hslToRgb((state.hue + 0.3) % 1, 0.5, 0.3)
  love.graphics.setColor(lineR, lineG, lineB, 0.15)
  love.graphics.setLineWidth(1)

  local step = 6
  for ix = 0, w, step do
    for iy = 0, h - step, step do
      local px1 = (ix - halfW) / halfW
      local py1 = (iy - halfH) / halfH
      local py2 = (iy + step - halfH) / halfH
      local v1 = chladniPattern(px1, py1, n, m)
      local v2 = chladniPattern(px1, py2, n, m)
      if v1 * v2 < 0 then
        love.graphics.line(ix - 2, iy + step / 2, ix + 2, iy + step / 2)
      end
    end
  end

  -- Draw active particles
  local pR, pG, pB = Util.hslToRgb((state.hue + 0.1) % 1, 0.8, 0.6)
  for _, p in ipairs(state.particles) do
    if p.settled then
      love.graphics.setColor(pR, pG, pB, 0.5)
      love.graphics.circle("fill", p.x, p.y, 1.2)
    else
      love.graphics.setColor(pR, pG, pB, 0.3)
      love.graphics.circle("fill", p.x, p.y, 1.5)
    end
  end

  -- Plate boundary circle
  love.graphics.setColor(lineR, lineG, lineB, 0.2)
  love.graphics.setLineWidth(1)
  love.graphics.circle("line", halfW, halfH, math.min(halfW, halfH) * 0.95)
end

Effects.register("Cymatics", Cymatics)

return Cymatics
