--[[
  effects/mandala.lua — Radial sector slices building a tree-ring timeline

  Concentric rings of colored arc sectors spawn from center outward,
  creating mandala-like patterns that build up over time.

  React usage:
    <Mandala />
    <Mandala speed={0.8} decay={0.005} />
    <Mandala beat={onBeat} amplitude={amp} />
    <Mandala background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local cos, sin, pi = math.cos, math.sin, math.pi
local random, floor = math.random, math.floor

local Mandala = {}

local MAX_SLICES = 500

function Mandala.create(w, h, props)
  return {
    time = 0,
    slices = {},
    currentRadius = 10,
    rotationOffset = random() * pi * 2,
    hue = random(),
    cleared = false,
    spawnAccum = 0,
    cx = w / 2,
    cy = h / 2,
    maxRadius = math.min(w, h) * 0.48,
  }
end

function Mandala.update(state, dt, props, w, h)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.005)
  local amplitude = Util.prop(props, "amplitude", nil)
  local beat = Util.boolProp(props, "beat", false)

  state.time = state.time + dt * speed
  state.decay = decay
  state.cx = w / 2
  state.cy = h / 2
  state.maxRadius = math.min(w, h) * 0.48

  local t = state.time
  local amp = amplitude or ((sin(t * 0.6) + 1) * 0.3 + 0.2)

  -- Slow rotation
  state.rotationOffset = state.rotationOffset + 0.002 * speed

  -- Determine if we should spawn a slice group
  local isBeat = beat
  if not beat then
    -- Simulate periodic beats
    isBeat = sin(t * pi * 0.7) > 0.92
  end

  -- Ambient slow spawning
  state.spawnAccum = state.spawnAccum + dt * (0.3 + amp * 1.5) * speed
  local shouldSpawnAmbient = state.spawnAccum >= 1
  if shouldSpawnAmbient then
    state.spawnAccum = state.spawnAccum - 1
  end

  if (isBeat or shouldSpawnAmbient) and #state.slices < MAX_SLICES then
    local sliceCount = isBeat and (8 + floor(random() * 8)) or (4 + floor(random() * 4))
    local thickness = isBeat and (5 + amp * 15 + random() * 5) or (3 + amp * 8)
    local startRadius = state.currentRadius
    local endRadius = startRadius + thickness

    local segAngle = pi * 2 / sliceCount
    local fillRatio = 0.75 + random() * 0.2

    for i = 0, sliceCount - 1 do
      local sliceAngle = i * segAngle + state.rotationOffset
      local sliceWidth = segAngle * fillRatio
      local sliceHue = (state.hue + i / sliceCount * 0.3 + random() * 0.05) % 1
      local sliceSat = 0.55 + amp * 0.35
      local sliceLit = 0.35 + amp * 0.25

      table.insert(state.slices, {
        startAngle = sliceAngle,
        endAngle = sliceAngle + sliceWidth,
        innerRadius = startRadius,
        outerRadius = endRadius,
        hue = sliceHue,
        sat = sliceSat,
        lit = sliceLit,
        alpha = 0.8,
        age = 0,
        maxAge = 12 + random() * 8,
      })
    end

    state.currentRadius = endRadius + 1

    -- Wrap radius when it exceeds max
    if state.currentRadius > state.maxRadius then
      state.currentRadius = 10
    end
  end

  -- Age and cull slices
  local alive = {}
  for _, slice in ipairs(state.slices) do
    slice.age = slice.age + dt
    if slice.age < slice.maxAge then
      -- Fade out in last 2 seconds
      if slice.age > slice.maxAge - 2 then
        slice.alpha = slice.alpha * (1 - dt * 0.5)
      end
      table.insert(alive, slice)
    end
  end
  state.slices = alive

  state.hue = (state.hue + dt * 0.008 * speed) % 1
end

function Mandala.draw(state, w, h)
  -- Background decay (very slow for mandala accumulation)
  if not state.cleared then
    love.graphics.setColor(0.04, 0.04, 0.04, 1)
    love.graphics.rectangle("fill", 0, 0, w, h)
    state.cleared = true
  else
    love.graphics.setColor(0.04, 0.04, 0.04, state.decay or 0.005)
    love.graphics.rectangle("fill", 0, 0, w, h)
  end

  local cx, cy = state.cx, state.cy

  love.graphics.push()
  love.graphics.translate(cx, cy)

  for _, slice in ipairs(state.slices) do
    local r, g, b = Util.hslToRgb(slice.hue, slice.sat, slice.lit)
    love.graphics.setColor(r, g, b, slice.alpha)

    -- Draw arc sector as a filled polygon
    local segments = 12
    local angleStep = (slice.endAngle - slice.startAngle) / segments
    local verts = {}

    -- Outer arc
    for i = 0, segments do
      local a = slice.startAngle + i * angleStep
      table.insert(verts, cos(a) * slice.outerRadius)
      table.insert(verts, sin(a) * slice.outerRadius)
    end

    -- Inner arc (reverse)
    for i = segments, 0, -1 do
      local a = slice.startAngle + i * angleStep
      table.insert(verts, cos(a) * slice.innerRadius)
      table.insert(verts, sin(a) * slice.innerRadius)
    end

    if #verts >= 6 then
      love.graphics.polygon("fill", verts)
    end
  end

  love.graphics.pop()
end

Effects.register("Mandala", Mandala)

return Mandala
