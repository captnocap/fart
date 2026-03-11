--[[
  gamepad_visual.lua — Visual controller diagrams with live input feedback.

  Draws controller outlines using love.graphics geometry. Each profile
  (N64, Xbox, PS, Switch) has its own draw function that knows the physical
  button layout. Buttons/axes light up from the live gamepad state tables.

  Usage:
    local visual = require("lua.gamepad_visual")
    visual.draw("n64", x, y, scale, buttons, axes)
]]

local Visual = {}

-- ============================================================================
-- Shared helpers
-- ============================================================================

local function setColor(r, g, b, a)
  love.graphics.setColor(r, g, b, a or 1)
end

local function filledCircle(cx, cy, r)
  love.graphics.circle("fill", cx, cy, r)
end

local function outlineCircle(cx, cy, r, lineW)
  love.graphics.setLineWidth(lineW or 1)
  love.graphics.circle("line", cx, cy, r)
end

local function roundRect(mode, x, y, w, h, r)
  love.graphics.rectangle(mode, x, y, w, h, r or 4, r or 4)
end

local function pill(mode, x, y, w, h)
  local r = math.min(w, h) / 2
  love.graphics.rectangle(mode, x, y, w, h, r, r)
end

-- Cached small fonts (avoid allocating every frame)
local smallFont6, smallFont7
local function getSmallFont(size)
  if size == 6 then
    if not smallFont6 then smallFont6 = love.graphics.newFont(6) end
    return smallFont6
  elseif size == 7 then
    if not smallFont7 then smallFont7 = love.graphics.newFont(7) end
    return smallFont7
  end
  return love.graphics.getFont()
end

-- Interpolate color: dim → lit
local function btnColor(pressed, offR, offG, offB, onR, onG, onB)
  if pressed then
    return onR, onG, onB, 1
  else
    return offR, offG, offB, 0.5
  end
end

-- ============================================================================
-- N64 Controller
-- ============================================================================
-- The iconic trident. Three prongs, analog stick on center, D-pad on left,
-- A/B and C-buttons on right. Z trigger underneath. Start in the belly.

local function drawN64(x, y, scale, buttons, axes)
  local s = scale or 1
  buttons = buttons or {}
  axes = axes or {}

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(s, s)

  -- Body dimensions (centered at 0,0 — total ~280 wide, ~200 tall)
  local bodyW = 280
  local bodyH = 60
  local prongW = 50
  local prongH = 90

  -- ── Body shell ──────────────────────────────────────
  -- Main horizontal bar
  setColor(0.55, 0.55, 0.58)
  roundRect("fill", -bodyW/2, -bodyH/2, bodyW, bodyH, 12)

  -- Left prong (D-pad side)
  setColor(0.52, 0.52, 0.55)
  roundRect("fill", -bodyW/2 + 10, bodyH/2 - 8, prongW, prongH, 10)
  -- Grip ridges on left prong
  setColor(0.48, 0.48, 0.51)
  for i = 0, 3 do
    love.graphics.rectangle("fill", -bodyW/2 + 18, bodyH/2 + 30 + i * 12, prongW - 16, 3, 1, 1)
  end

  -- Center prong (analog stick side) — the defining feature
  setColor(0.52, 0.52, 0.55)
  roundRect("fill", -prongW/2, bodyH/2 - 8, prongW, prongH + 20, 10)
  -- Grip ridges on center prong
  setColor(0.48, 0.48, 0.51)
  for i = 0, 4 do
    love.graphics.rectangle("fill", -prongW/2 + 8, bodyH/2 + 40 + i * 12, prongW - 16, 3, 1, 1)
  end

  -- Right prong (A/B/C side)
  setColor(0.52, 0.52, 0.55)
  roundRect("fill", bodyW/2 - prongW - 10, bodyH/2 - 8, prongW, prongH, 10)
  -- Grip ridges on right prong
  setColor(0.48, 0.48, 0.51)
  for i = 0, 3 do
    love.graphics.rectangle("fill", bodyW/2 - prongW - 2, bodyH/2 + 30 + i * 12, prongW - 16, 3, 1, 1)
  end

  -- ── L and R shoulder buttons ────────────────────────
  local shoulderW = 60
  local shoulderH = 14
  local shoulderY = -bodyH/2 - shoulderH + 2

  -- L button
  setColor(btnColor(buttons.leftshoulder, 0.40, 0.40, 0.44, 0.70, 0.80, 0.95))
  roundRect("fill", -bodyW/2 + 15, shoulderY, shoulderW, shoulderH, 5)
  setColor(0.30, 0.30, 0.34)
  roundRect("line", -bodyW/2 + 15, shoulderY, shoulderW, shoulderH, 5)
  -- Label
  setColor(0.15, 0.15, 0.18)
  local font = love.graphics.getFont()
  love.graphics.print("L", -bodyW/2 + 15 + shoulderW/2 - font:getWidth("L")/2, shoulderY + 1)

  -- R button
  setColor(btnColor(buttons.rightshoulder, 0.40, 0.40, 0.44, 0.70, 0.80, 0.95))
  roundRect("fill", bodyW/2 - shoulderW - 15, shoulderY, shoulderW, shoulderH, 5)
  setColor(0.30, 0.30, 0.34)
  roundRect("line", bodyW/2 - shoulderW - 15, shoulderY, shoulderW, shoulderH, 5)
  setColor(0.15, 0.15, 0.18)
  love.graphics.print("R", bodyW/2 - shoulderW - 15 + shoulderW/2 - font:getWidth("R")/2, shoulderY + 1)

  -- ── Z trigger (underneath center prong) ─────────────
  local zW = 36
  local zH = 10
  local zY = bodyH/2 + prongH + 14
  setColor(btnColor(buttons.leftstick, 0.35, 0.35, 0.40, 0.60, 0.70, 0.90))
  roundRect("fill", -zW/2, zY, zW, zH, 4)
  setColor(0.25, 0.25, 0.30)
  roundRect("line", -zW/2, zY, zW, zH, 4)
  setColor(0.15, 0.15, 0.18)
  love.graphics.print("Z", -font:getWidth("Z")/2, zY)

  -- ── D-pad ──────────────────────────────────────────
  local dpadCX = -bodyW/2 + 10 + prongW/2
  local dpadCY = 4
  local dpadArm = 12
  local dpadThick = 10

  -- Cross shape
  setColor(btnColor(buttons.dpup or buttons.dpdown or buttons.dpleft or buttons.dpright,
    0.18, 0.18, 0.22, 0.18, 0.18, 0.22))
  love.graphics.rectangle("fill", dpadCX - dpadThick/2, dpadCY - dpadArm - dpadThick/2, dpadThick, dpadArm * 2 + dpadThick, 2, 2)
  love.graphics.rectangle("fill", dpadCX - dpadArm - dpadThick/2, dpadCY - dpadThick/2, dpadArm * 2 + dpadThick, dpadThick, 2, 2)

  -- Individual direction highlights
  if buttons.dpup then
    setColor(0.95, 0.88, 0.30, 0.9)
    love.graphics.rectangle("fill", dpadCX - dpadThick/2 + 1, dpadCY - dpadArm - dpadThick/2 + 1, dpadThick - 2, dpadArm, 2, 2)
  end
  if buttons.dpdown then
    setColor(0.95, 0.88, 0.30, 0.9)
    love.graphics.rectangle("fill", dpadCX - dpadThick/2 + 1, dpadCY + dpadThick/2, dpadThick - 2, dpadArm, 2, 2)
  end
  if buttons.dpleft then
    setColor(0.95, 0.88, 0.30, 0.9)
    love.graphics.rectangle("fill", dpadCX - dpadArm - dpadThick/2 + 1, dpadCY - dpadThick/2 + 1, dpadArm, dpadThick - 2, 2, 2)
  end
  if buttons.dpright then
    setColor(0.95, 0.88, 0.30, 0.9)
    love.graphics.rectangle("fill", dpadCX + dpadThick/2, dpadCY - dpadThick/2 + 1, dpadArm, dpadThick - 2, 2, 2)
  end

  -- Center nub
  setColor(0.25, 0.25, 0.30)
  filledCircle(dpadCX, dpadCY, 3)

  -- ── Analog stick (center prong) ─────────────────────
  local stickCX = 0
  local stickCY = bodyH/2 + 20
  local stickR = 18
  local stickDeflect = 10

  -- Base ring
  setColor(0.40, 0.40, 0.44)
  love.graphics.setLineWidth(2)
  outlineCircle(stickCX, stickCY, stickR + 4, 2)

  -- Octagonal gate (subtle)
  setColor(0.35, 0.35, 0.39)
  for i = 0, 7 do
    local a1 = (i / 8) * math.pi * 2
    local a2 = ((i + 1) / 8) * math.pi * 2
    local gateR = stickR + 6
    love.graphics.line(
      stickCX + math.cos(a1) * gateR, stickCY + math.sin(a1) * gateR,
      stickCX + math.cos(a2) * gateR, stickCY + math.sin(a2) * gateR
    )
  end

  -- Stick cap (deflected by axis values)
  local sx = (axes.leftx or 0) * stickDeflect
  local sy = (axes.lefty or 0) * stickDeflect
  setColor(0.62, 0.62, 0.66)
  filledCircle(stickCX + sx, stickCY + sy, stickR)
  -- Stick cap texture (concentric rings)
  setColor(0.56, 0.56, 0.60)
  outlineCircle(stickCX + sx, stickCY + sy, stickR - 3, 1)
  outlineCircle(stickCX + sx, stickCY + sy, stickR - 7, 1)
  outlineCircle(stickCX + sx, stickCY + sy, stickR - 11, 1)
  -- Stick center dot
  setColor(0.48, 0.48, 0.52)
  filledCircle(stickCX + sx, stickCY + sy, 3)

  -- ── Start button ───────────────────────────────────
  local startCX = 0
  local startCY = -2
  local startW = 20
  local startH = 8
  setColor(btnColor(buttons.start, 0.55, 0.15, 0.15, 0.95, 0.30, 0.30))
  pill("fill", startCX - startW/2, startCY - startH/2, startW, startH)
  setColor(0.40, 0.10, 0.10)
  pill("line", startCX - startW/2, startCY - startH/2, startW, startH)

  -- "START" label (tiny)
  setColor(0.90, 0.85, 0.80)
  local sf6 = getSmallFont(6)
  love.graphics.setFont(sf6)
  love.graphics.print("START", startCX - sf6:getWidth("START")/2, startCY + startH/2 + 2)
  love.graphics.setFont(font)  -- restore

  -- ── A button (big blue) ────────────────────────────
  local aCX = bodyW/2 - prongW/2 - 6
  local aCY = -2
  local aR = 14
  setColor(btnColor(buttons.a, 0.10, 0.15, 0.55, 0.20, 0.35, 0.90))
  filledCircle(aCX, aCY, aR)
  setColor(0.08, 0.10, 0.40)
  outlineCircle(aCX, aCY, aR, 1.5)
  -- "A" label
  setColor(0.85, 0.88, 0.95)
  love.graphics.print("A", aCX - font:getWidth("A")/2, aCY - font:getHeight()/2)

  -- ── B button (smaller green, left of A) ────────────
  local bCX = aCX - 28
  local bCY = aCY + 10
  local bR = 10
  setColor(btnColor(buttons.b, 0.10, 0.40, 0.15, 0.20, 0.75, 0.30))
  filledCircle(bCX, bCY, bR)
  setColor(0.08, 0.30, 0.10)
  outlineCircle(bCX, bCY, bR, 1.5)
  setColor(0.85, 0.95, 0.88)
  love.graphics.print("B", bCX - font:getWidth("B")/2, bCY - font:getHeight()/2)

  -- ── C-buttons (4 yellow buttons in diamond) ─────────
  local cCX = aCX + 2
  local cCY = aCY - 34
  local cR = 7
  local cSpread = 12

  local cButtons = {
    { dx = 0,         dy = -cSpread,  name = "C\u{25B2}", btn = "x" },   -- C-up → SDL x
    { dx = 0,         dy =  cSpread,  name = "C\u{25BC}", btn = "y" },   -- C-down → SDL y
    { dx = -cSpread,  dy = 0,         name = "C\u{25C0}", btn = "x" },   -- C-left (approximate)
    { dx =  cSpread,  dy = 0,         name = "C\u{25B6}", btn = "y" },   -- C-right (approximate)
  }

  -- For C-buttons, the mapping depends on adapter. We'll show them all
  -- and light based on right stick + x/y buttons
  local cUp    = buttons.x or (axes.righty and axes.righty < -0.5)
  local cDown  = buttons.y or (axes.righty and axes.righty > 0.5)
  local cLeft  = (axes.rightx and axes.rightx < -0.5)
  local cRight = (axes.rightx and axes.rightx > 0.5)
  local cStates = { cUp, cDown, cLeft, cRight }

  for i, cb in ipairs(cButtons) do
    local pressed = cStates[i]
    setColor(btnColor(pressed, 0.55, 0.50, 0.15, 0.95, 0.88, 0.25))
    filledCircle(cCX + cb.dx, cCY + cb.dy, cR)
    setColor(0.45, 0.40, 0.10)
    outlineCircle(cCX + cb.dx, cCY + cb.dy, cR, 1)
  end

  -- C label in center
  setColor(0.70, 0.65, 0.20, 0.6)
  love.graphics.print("C", cCX - font:getWidth("C")/2, cCY - font:getHeight()/2)

  -- ── Nintendo logo area (center of body, between start and top) ──
  setColor(0.45, 0.45, 0.50, 0.4)
  local logoW = 30
  love.graphics.rectangle("fill", -logoW/2, -bodyH/2 + 4, logoW, 12, 3, 3)
  setColor(0.60, 0.60, 0.65, 0.5)
  local sf7 = getSmallFont(7)
  love.graphics.setFont(sf7)
  love.graphics.print("N64", -sf7:getWidth("N64")/2, -bodyH/2 + 5)
  love.graphics.setFont(font)

  love.graphics.pop()
end

-- ============================================================================
-- Xbox Controller
-- ============================================================================

local function drawXbox(x, y, scale, buttons, axes)
  local s = scale or 1
  buttons = buttons or {}
  axes = axes or {}

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(s, s)

  local font = love.graphics.getFont()

  -- Body — rounded wide pill
  local bodyW = 300
  local bodyH = 180
  setColor(0.15, 0.15, 0.18)
  roundRect("fill", -bodyW/2, -bodyH/2, bodyW, bodyH, 30)
  setColor(0.20, 0.20, 0.24)
  roundRect("line", -bodyW/2, -bodyH/2, bodyW, bodyH, 30)

  -- Grips (two rounded extensions at bottom)
  setColor(0.13, 0.13, 0.16)
  roundRect("fill", -bodyW/2 + 20, bodyH/2 - 20, 70, 50, 15)
  roundRect("fill", bodyW/2 - 90, bodyH/2 - 20, 70, 50, 15)

  -- ── Bumpers ────────────────────────────────────────
  setColor(btnColor(buttons.leftshoulder, 0.22, 0.22, 0.26, 0.45, 0.60, 0.85))
  roundRect("fill", -bodyW/2 + 10, -bodyH/2 - 8, 80, 14, 5)
  setColor(btnColor(buttons.rightshoulder, 0.22, 0.22, 0.26, 0.45, 0.60, 0.85))
  roundRect("fill", bodyW/2 - 90, -bodyH/2 - 8, 80, 14, 5)

  -- Bumper labels
  setColor(0.50, 0.50, 0.55)
  love.graphics.print("LB", -bodyW/2 + 40 - font:getWidth("LB")/2, -bodyH/2 - 6)
  love.graphics.print("RB", bodyW/2 - 50 - font:getWidth("RB")/2, -bodyH/2 - 6)

  -- ── Triggers (arcs at top corners) ──────────────────
  local trigL = axes.triggerleft or 0
  local trigR = axes.triggerright or 0
  setColor(0.20 + trigL * 0.30, 0.20 + trigL * 0.15, 0.24)
  roundRect("fill", -bodyW/2 + 15, -bodyH/2 - 22, 60, 16, 6)
  setColor(0.20 + trigR * 0.30, 0.20 + trigR * 0.15, 0.24)
  roundRect("fill", bodyW/2 - 75, -bodyH/2 - 22, 60, 16, 6)
  setColor(0.40, 0.40, 0.45)
  love.graphics.print("LT", -bodyW/2 + 35 - font:getWidth("LT")/2, -bodyH/2 - 20)
  love.graphics.print("RT", bodyW/2 - 45 - font:getWidth("RT")/2, -bodyH/2 - 20)

  -- ── Left stick ─────────────────────────────────────
  local lsCX = -70
  local lsCY = -20
  local lsR = 20
  local lsx = (axes.leftx or 0) * 8
  local lsy = (axes.lefty or 0) * 8

  setColor(0.25, 0.25, 0.30)
  filledCircle(lsCX, lsCY, lsR + 4)
  setColor(0.35, 0.35, 0.40)
  filledCircle(lsCX + lsx, lsCY + lsy, lsR)
  setColor(0.30, 0.30, 0.35)
  outlineCircle(lsCX + lsx, lsCY + lsy, lsR - 4, 1)

  -- Left stick press
  if buttons.leftstick then
    setColor(0.50, 0.60, 0.90, 0.5)
    filledCircle(lsCX + lsx, lsCY + lsy, lsR - 2)
  end

  -- ── Right stick ────────────────────────────────────
  local rsCX = 40
  local rsCY = 30
  local rsR = 20
  local rsx = (axes.rightx or 0) * 8
  local rsy = (axes.righty or 0) * 8

  setColor(0.25, 0.25, 0.30)
  filledCircle(rsCX, rsCY, rsR + 4)
  setColor(0.35, 0.35, 0.40)
  filledCircle(rsCX + rsx, rsCY + rsy, rsR)
  setColor(0.30, 0.30, 0.35)
  outlineCircle(rsCX + rsx, rsCY + rsy, rsR - 4, 1)

  if buttons.rightstick then
    setColor(0.50, 0.60, 0.90, 0.5)
    filledCircle(rsCX + rsx, rsCY + rsy, rsR - 2)
  end

  -- ── D-pad ──────────────────────────────────────────
  local dpadCX = -70
  local dpadCY = 35
  local dpadArm = 10
  local dpadThick = 9

  setColor(0.22, 0.22, 0.26)
  love.graphics.rectangle("fill", dpadCX - dpadThick/2, dpadCY - dpadArm - dpadThick/2, dpadThick, dpadArm * 2 + dpadThick, 2, 2)
  love.graphics.rectangle("fill", dpadCX - dpadArm - dpadThick/2, dpadCY - dpadThick/2, dpadArm * 2 + dpadThick, dpadThick, 2, 2)

  if buttons.dpup then
    setColor(0.90, 0.90, 0.95, 0.7)
    love.graphics.rectangle("fill", dpadCX - dpadThick/2 + 1, dpadCY - dpadArm - dpadThick/2 + 1, dpadThick - 2, dpadArm, 2, 2)
  end
  if buttons.dpdown then
    setColor(0.90, 0.90, 0.95, 0.7)
    love.graphics.rectangle("fill", dpadCX - dpadThick/2 + 1, dpadCY + dpadThick/2, dpadThick - 2, dpadArm, 2, 2)
  end
  if buttons.dpleft then
    setColor(0.90, 0.90, 0.95, 0.7)
    love.graphics.rectangle("fill", dpadCX - dpadArm - dpadThick/2 + 1, dpadCY - dpadThick/2 + 1, dpadArm, dpadThick - 2, 2, 2)
  end
  if buttons.dpright then
    setColor(0.90, 0.90, 0.95, 0.7)
    love.graphics.rectangle("fill", dpadCX + dpadThick/2, dpadCY - dpadThick/2 + 1, dpadArm, dpadThick - 2, 2, 2)
  end

  -- ── Face buttons (ABXY diamond) ────────────────────
  local faceCX = 100
  local faceCY = -15
  local faceSpread = 18
  local faceR = 12

  -- Y (top, yellow)
  setColor(btnColor(buttons.y, 0.50, 0.45, 0.12, 0.95, 0.85, 0.20))
  filledCircle(faceCX, faceCY - faceSpread, faceR)
  setColor(0.85, 0.80, 0.15)
  love.graphics.print("Y", faceCX - font:getWidth("Y")/2, faceCY - faceSpread - font:getHeight()/2)

  -- A (bottom, green)
  setColor(btnColor(buttons.a, 0.12, 0.40, 0.12, 0.25, 0.80, 0.30))
  filledCircle(faceCX, faceCY + faceSpread, faceR)
  setColor(0.20, 0.75, 0.25)
  love.graphics.print("A", faceCX - font:getWidth("A")/2, faceCY + faceSpread - font:getHeight()/2)

  -- X (left, blue)
  setColor(btnColor(buttons.x, 0.12, 0.18, 0.50, 0.25, 0.40, 0.90))
  filledCircle(faceCX - faceSpread, faceCY, faceR)
  setColor(0.20, 0.35, 0.85)
  love.graphics.print("X", faceCX - faceSpread - font:getWidth("X")/2, faceCY - font:getHeight()/2)

  -- B (right, red)
  setColor(btnColor(buttons.b, 0.50, 0.12, 0.12, 0.90, 0.25, 0.25))
  filledCircle(faceCX + faceSpread, faceCY, faceR)
  setColor(0.85, 0.20, 0.20)
  love.graphics.print("B", faceCX + faceSpread - font:getWidth("B")/2, faceCY - font:getHeight()/2)

  -- ── Menu buttons (back, start/guide) ───────────────
  setColor(btnColor(buttons.back, 0.28, 0.28, 0.32, 0.55, 0.55, 0.60))
  roundRect("fill", -20, -20, 16, 8, 3)

  setColor(btnColor(buttons.start, 0.28, 0.28, 0.32, 0.55, 0.55, 0.60))
  roundRect("fill", 4, -20, 16, 8, 3)

  -- Guide button (big center)
  setColor(btnColor(buttons.guide, 0.20, 0.20, 0.24, 0.40, 0.65, 0.40))
  filledCircle(0, -42, 10)
  setColor(0.30, 0.30, 0.35)
  outlineCircle(0, -42, 10, 1)

  love.graphics.pop()
end

-- ============================================================================
-- PlayStation Controller
-- ============================================================================

local function drawPS(x, y, scale, buttons, axes)
  local s = scale or 1
  buttons = buttons or {}
  axes = axes or {}

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(s, s)

  local font = love.graphics.getFont()

  -- Body
  local bodyW = 300
  local bodyH = 170
  setColor(0.12, 0.12, 0.15)
  roundRect("fill", -bodyW/2, -bodyH/2, bodyW, bodyH, 25)

  -- Grips
  setColor(0.10, 0.10, 0.13)
  roundRect("fill", -bodyW/2 + 15, bodyH/2 - 15, 65, 55, 15)
  roundRect("fill", bodyW/2 - 80, bodyH/2 - 15, 65, 55, 15)

  -- ── Bumpers & Triggers ─────────────────────────────
  setColor(btnColor(buttons.leftshoulder, 0.18, 0.18, 0.22, 0.40, 0.50, 0.80))
  roundRect("fill", -bodyW/2 + 10, -bodyH/2 - 8, 75, 13, 5)
  setColor(btnColor(buttons.rightshoulder, 0.18, 0.18, 0.22, 0.40, 0.50, 0.80))
  roundRect("fill", bodyW/2 - 85, -bodyH/2 - 8, 75, 13, 5)

  setColor(0.45, 0.45, 0.50)
  love.graphics.print("L1", -bodyW/2 + 38 - font:getWidth("L1")/2, -bodyH/2 - 6)
  love.graphics.print("R1", bodyW/2 - 48 - font:getWidth("R1")/2, -bodyH/2 - 6)

  local trigL = axes.triggerleft or 0
  local trigR = axes.triggerright or 0
  setColor(0.16 + trigL * 0.30, 0.16 + trigL * 0.10, 0.20)
  roundRect("fill", -bodyW/2 + 15, -bodyH/2 - 20, 55, 14, 5)
  setColor(0.16 + trigR * 0.30, 0.16 + trigR * 0.10, 0.20)
  roundRect("fill", bodyW/2 - 70, -bodyH/2 - 20, 55, 14, 5)
  setColor(0.40, 0.40, 0.45)
  love.graphics.print("L2", -bodyW/2 + 32 - font:getWidth("L2")/2, -bodyH/2 - 18)
  love.graphics.print("R2", bodyW/2 - 42 - font:getWidth("R2")/2, -bodyH/2 - 18)

  -- ── D-pad ──────────────────────────────────────────
  local dpadCX = -70
  local dpadCY = -5
  local dpadArm = 10
  local dpadThick = 9

  setColor(0.20, 0.20, 0.24)
  love.graphics.rectangle("fill", dpadCX - dpadThick/2, dpadCY - dpadArm - dpadThick/2, dpadThick, dpadArm * 2 + dpadThick, 2, 2)
  love.graphics.rectangle("fill", dpadCX - dpadArm - dpadThick/2, dpadCY - dpadThick/2, dpadArm * 2 + dpadThick, dpadThick, 2, 2)

  if buttons.dpup then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX - dpadThick/2+1, dpadCY - dpadArm - dpadThick/2+1, dpadThick-2, dpadArm, 2, 2) end
  if buttons.dpdown then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX - dpadThick/2+1, dpadCY + dpadThick/2, dpadThick-2, dpadArm, 2, 2) end
  if buttons.dpleft then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX - dpadArm - dpadThick/2+1, dpadCY - dpadThick/2+1, dpadArm, dpadThick-2, 2, 2) end
  if buttons.dpright then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX + dpadThick/2, dpadCY - dpadThick/2+1, dpadArm, dpadThick-2, 2, 2) end

  -- ── Sticks ─────────────────────────────────────────
  local function drawStick(cx, cy, ax_x, ax_y, pressed)
    local deflect = 8
    local r = 16
    local dx = (axes[ax_x] or 0) * deflect
    local dy = (axes[ax_y] or 0) * deflect
    setColor(0.22, 0.22, 0.26)
    filledCircle(cx, cy, r + 3)
    setColor(0.32, 0.32, 0.36)
    filledCircle(cx + dx, cy + dy, r)
    if pressed then
      setColor(0.45, 0.55, 0.85, 0.5)
      filledCircle(cx + dx, cy + dy, r - 2)
    end
    -- Concentric grip lines
    setColor(0.28, 0.28, 0.32)
    outlineCircle(cx + dx, cy + dy, r - 4, 1)
  end

  drawStick(-35, 35, "leftx", "lefty", buttons.leftstick)
  drawStick(35, 35, "rightx", "righty", buttons.rightstick)

  -- ── Face buttons (PlayStation symbols) ─────────────
  local faceCX = 95
  local faceCY = -10
  local faceSpread = 17
  local faceR = 11

  -- Triangle (top, green/teal)
  setColor(btnColor(buttons.y, 0.15, 0.35, 0.30, 0.30, 0.80, 0.65))
  filledCircle(faceCX, faceCY - faceSpread, faceR)
  setColor(0.25, 0.70, 0.55)
  -- Draw triangle symbol
  love.graphics.polygon("line", faceCX, faceCY - faceSpread - 5, faceCX - 5, faceCY - faceSpread + 4, faceCX + 5, faceCY - faceSpread + 4)

  -- Cross (bottom, blue)
  setColor(btnColor(buttons.a, 0.15, 0.20, 0.45, 0.30, 0.45, 0.90))
  filledCircle(faceCX, faceCY + faceSpread, faceR)
  setColor(0.30, 0.45, 0.90)
  love.graphics.setLineWidth(2)
  love.graphics.line(faceCX - 4, faceCY + faceSpread - 4, faceCX + 4, faceCY + faceSpread + 4)
  love.graphics.line(faceCX + 4, faceCY + faceSpread - 4, faceCX - 4, faceCY + faceSpread + 4)
  love.graphics.setLineWidth(1)

  -- Square (left, pink)
  setColor(btnColor(buttons.x, 0.40, 0.15, 0.35, 0.85, 0.30, 0.70))
  filledCircle(faceCX - faceSpread, faceCY, faceR)
  setColor(0.80, 0.30, 0.65)
  love.graphics.rectangle("line", faceCX - faceSpread - 4, faceCY - 4, 8, 8)

  -- Circle (right, red)
  setColor(btnColor(buttons.b, 0.45, 0.12, 0.15, 0.90, 0.25, 0.30))
  filledCircle(faceCX + faceSpread, faceCY, faceR)
  setColor(0.85, 0.25, 0.30)
  outlineCircle(faceCX + faceSpread, faceCY, 5, 2)

  -- ── Menu buttons ───────────────────────────────────
  setColor(btnColor(buttons.back, 0.25, 0.25, 0.28, 0.50, 0.50, 0.55))
  roundRect("fill", -18, -25, 14, 7, 3)
  setColor(btnColor(buttons.start, 0.25, 0.25, 0.28, 0.50, 0.50, 0.55))
  roundRect("fill", 4, -25, 14, 7, 3)

  -- PS button
  setColor(btnColor(buttons.guide, 0.18, 0.18, 0.22, 0.35, 0.55, 0.85))
  filledCircle(0, 10, 8)

  -- Touchpad area (subtle)
  setColor(0.16, 0.16, 0.20)
  roundRect("fill", -30, -45, 60, 20, 5)

  love.graphics.pop()
end

-- ============================================================================
-- Switch Pro Controller (simplified)
-- ============================================================================

local function drawSwitch(x, y, scale, buttons, axes)
  -- Reuse Xbox layout with different colors and labels
  local s = scale or 1
  buttons = buttons or {}
  axes = axes or {}

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(s, s)

  local font = love.graphics.getFont()

  -- Body — darker, more squared
  local bodyW = 290
  local bodyH = 175
  setColor(0.08, 0.08, 0.10)
  roundRect("fill", -bodyW/2, -bodyH/2, bodyW, bodyH, 20)

  -- Grips
  setColor(0.06, 0.06, 0.08)
  roundRect("fill", -bodyW/2 + 15, bodyH/2 - 15, 65, 50, 12)
  roundRect("fill", bodyW/2 - 80, bodyH/2 - 15, 65, 50, 12)

  -- Bumpers
  setColor(btnColor(buttons.leftshoulder, 0.16, 0.16, 0.20, 0.40, 0.50, 0.80))
  roundRect("fill", -bodyW/2 + 10, -bodyH/2 - 8, 75, 12, 5)
  setColor(btnColor(buttons.rightshoulder, 0.16, 0.16, 0.20, 0.40, 0.50, 0.80))
  roundRect("fill", bodyW/2 - 85, -bodyH/2 - 8, 75, 12, 5)
  setColor(0.40, 0.40, 0.45)
  love.graphics.print("L", -bodyW/2 + 40 - font:getWidth("L")/2, -bodyH/2 - 6)
  love.graphics.print("R", bodyW/2 - 48 - font:getWidth("R")/2, -bodyH/2 - 6)

  -- Triggers
  local trigL = axes.triggerleft or 0
  local trigR = axes.triggerright or 0
  setColor(0.14 + trigL * 0.30, 0.14, 0.18)
  roundRect("fill", -bodyW/2 + 15, -bodyH/2 - 19, 55, 13, 5)
  setColor(0.14 + trigR * 0.30, 0.14, 0.18)
  roundRect("fill", bodyW/2 - 70, -bodyH/2 - 19, 55, 13, 5)
  setColor(0.40, 0.40, 0.45)
  love.graphics.print("ZL", -bodyW/2 + 32 - font:getWidth("ZL")/2, -bodyH/2 - 17)
  love.graphics.print("ZR", bodyW/2 - 42 - font:getWidth("ZR")/2, -bodyH/2 - 17)

  -- D-pad
  local dpadCX = -75
  local dpadCY = 25

  setColor(0.18, 0.18, 0.22)
  love.graphics.rectangle("fill", dpadCX - 4, dpadCY - 14, 9, 28, 2, 2)
  love.graphics.rectangle("fill", dpadCX - 14, dpadCY - 4, 28, 9, 2, 2)

  if buttons.dpup then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX-3, dpadCY-13, 7, 10, 2, 2) end
  if buttons.dpdown then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX-3, dpadCY+4, 7, 10, 2, 2) end
  if buttons.dpleft then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX-13, dpadCY-3, 10, 7, 2, 2) end
  if buttons.dpright then setColor(0.85, 0.85, 0.90, 0.7) love.graphics.rectangle("fill", dpadCX+4, dpadCY-3, 10, 7, 2, 2) end

  -- Sticks
  local function drawStick(cx, cy, ax_x, ax_y, pressed)
    local r = 16
    local dx = (axes[ax_x] or 0) * 8
    local dy = (axes[ax_y] or 0) * 8
    setColor(0.20, 0.20, 0.24)
    filledCircle(cx, cy, r + 3)
    setColor(0.30, 0.30, 0.34)
    filledCircle(cx + dx, cy + dy, r)
    if pressed then setColor(0.45, 0.55, 0.85, 0.5) filledCircle(cx + dx, cy + dy, r - 2) end
  end

  drawStick(-75, -15, "leftx", "lefty", buttons.leftstick)
  drawStick(40, 30, "rightx", "righty", buttons.rightstick)

  -- Face buttons — Switch uses B(right) A(bottom) but SDL maps to xbox names
  local faceCX = 95
  local faceCY = -15
  local fs = 16
  local fr = 11

  -- X (top)
  setColor(btnColor(buttons.y, 0.15, 0.15, 0.20, 0.45, 0.55, 0.85))
  filledCircle(faceCX, faceCY - fs, fr)
  setColor(0.65, 0.70, 0.85)
  love.graphics.print("X", faceCX - font:getWidth("X")/2, faceCY - fs - font:getHeight()/2)

  -- B (bottom)
  setColor(btnColor(buttons.a, 0.15, 0.15, 0.20, 0.45, 0.55, 0.85))
  filledCircle(faceCX, faceCY + fs, fr)
  setColor(0.65, 0.70, 0.85)
  love.graphics.print("B", faceCX - font:getWidth("B")/2, faceCY + fs - font:getHeight()/2)

  -- Y (left)
  setColor(btnColor(buttons.x, 0.15, 0.15, 0.20, 0.45, 0.55, 0.85))
  filledCircle(faceCX - fs, faceCY, fr)
  setColor(0.65, 0.70, 0.85)
  love.graphics.print("Y", faceCX - fs - font:getWidth("Y")/2, faceCY - font:getHeight()/2)

  -- A (right)
  setColor(btnColor(buttons.b, 0.15, 0.15, 0.20, 0.45, 0.55, 0.85))
  filledCircle(faceCX + fs, faceCY, fr)
  setColor(0.65, 0.70, 0.85)
  love.graphics.print("A", faceCX + fs - font:getWidth("A")/2, faceCY - font:getHeight()/2)

  -- Menu buttons
  setColor(btnColor(buttons.back, 0.20, 0.20, 0.24, 0.45, 0.45, 0.50))
  filledCircle(-12, -18, 5)
  setColor(btnColor(buttons.start, 0.20, 0.20, 0.24, 0.45, 0.45, 0.50))
  filledCircle(12, -18, 5)
  setColor(0.35, 0.35, 0.40)
  love.graphics.print("-", -14, -22)
  love.graphics.print("+", 9, -22)

  -- Home
  setColor(btnColor(buttons.guide, 0.15, 0.15, 0.20, 0.35, 0.55, 0.35))
  filledCircle(40, 2, 7)

  -- Capture
  setColor(0.20, 0.20, 0.25)
  love.graphics.rectangle("fill", -46, -2, 12, 12, 2, 2)

  love.graphics.pop()
end

-- ============================================================================
-- Dispatch
-- ============================================================================

local drawFuncs = {
  n64    = drawN64,
  xbox   = drawXbox,
  ps     = drawPS,
  switch = drawSwitch,
}

--- Draw a controller visual at (x, y) with optional scale.
--- @param profileId string  "n64", "xbox", "ps", "switch"
--- @param x number  center X
--- @param y number  center Y
--- @param scale number  scale factor (default 1)
--- @param buttons table  { a=true, dpup=true, ... }
--- @param axes table  { leftx=0.5, righty=-0.3, ... }
function Visual.draw(profileId, x, y, scale, buttons, axes)
  local fn = drawFuncs[profileId] or drawFuncs.xbox
  fn(x, y, scale, buttons, axes)
end

--- Get the approximate bounding size for a controller visual at scale.
--- @param profileId string
--- @param scale number
--- @return number, number  width, height
function Visual.getSize(profileId, scale)
  scale = scale or 1
  if profileId == "n64" then
    return 280 * scale, 200 * scale
  end
  return 300 * scale, 200 * scale
end

return Visual
