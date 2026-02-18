--[[
  theme_menu.lua -- Theme browser overlay

  A Lua-side overlay (like settings/devtools) that lets users browse and
  switch themes visually. Shows a scrollable list of theme cards with
  neofetch-style color swatches and a live mini-preview of the current app
  frame captured via Love2D canvas.

  Usage:
    local themeMenu = require("lua.theme_menu")
    themeMenu.init({ key = "f9", onSwitch = function(name) ... end })
    -- In love.keypressed:   if themeMenu.keypressed(key) then return end
    -- In love.mousepressed: if themeMenu.mousepressed(x, y, btn) then return end
    -- In love.mousereleased: themeMenu.mousereleased(x, y, btn)
    -- In love.mousemoved:   themeMenu.mousemoved(x, y)
    -- In love.wheelmoved:   if themeMenu.wheelmoved(x, y) then return end
    -- In love.textinput:    if themeMenu.textinput(text) then return end
    -- In love.draw:         wrap paint with beginCapture/endCapture, then draw()

  Controls:
    F9 (configurable)   -- Toggle theme menu open/closed
    Up/Down arrows      -- Navigate theme list
    Enter               -- Apply highlighted theme
    Escape              -- Close
    Mouse click         -- Select theme / close on outside
    Scroll wheel        -- Scroll theme list
]]

local ThemeMenu = {}

local Color = require("lua.color")

-- ============================================================================
-- State
-- ============================================================================

local state = {
  open        = false,
  toggleKey   = "f9",

  -- Theme data
  themes      = nil,        -- reference to lua/themes registry
  themeNames  = {},          -- sorted list of theme IDs
  currentName = nil,         -- currently active theme name
  currentTheme = nil,        -- currently active theme table

  -- Navigation
  selectedIdx = 1,           -- keyboard highlight index (1-based)
  hoverIdx    = nil,         -- mouse hover index (1-based, nil = none)
  scrollY     = 0,           -- scroll offset for theme list
  maxScrollY  = 0,           -- computed max scroll

  -- Hover
  hoverClose  = false,       -- mouse over close button

  -- Layout cache
  panelRect   = nil,         -- { x, y, w, h }
  cardRects   = {},          -- { [idx] = { x, y, w, h } }
  closeRect   = nil,         -- { x, y, w, h }

  -- Canvas capture
  captureCanvas = nil,       -- Love2D canvas for live preview

  -- Callback
  onSwitch    = nil,         -- function(themeName) called when user switches
}

-- ============================================================================
-- Visual constants
-- ============================================================================

local PANEL_W_RATIO  = 0.55
local PANEL_H_RATIO  = 0.80
local MIN_PANEL_W    = 420
local MIN_PANEL_H    = 350
local TITLE_BAR_H    = 32
local CORNER_R       = 6
local SCROLL_SPEED   = 30
local STATUS_BAR_H   = 24
local CARD_H         = 52
local CARD_PAD       = 6
local CARD_INNER_PAD = 8
local SWATCH_SIZE    = 16
local SWATCH_GAP     = 3
local SWATCH_RADIUS  = 2
local PREVIEW_RATIO  = 0.32  -- fraction of panel height for preview area
local DIVIDER_H      = 1

-- Semantic color keys to display as swatches (in order)
local SWATCH_KEYS = {
  "bg", "bgAlt", "bgElevated", "primary", "accent",
  "text", "textSecondary", "surface", "border",
  "error", "warning", "success", "info",
}

-- Colors (dark theme, matching devtools/settings palette)
local C = {
  backdrop    = { 0.00, 0.00, 0.00, 0.45 },
  panelBg     = { 0.06, 0.06, 0.11, 0.96 },
  titleBg     = { 0.08, 0.08, 0.14, 1 },
  titleText   = { 0.88, 0.90, 0.94, 1 },
  border      = { 0.20, 0.20, 0.30, 0.8 },
  cardBg      = { 0.08, 0.08, 0.13, 1 },
  cardHover   = { 0.10, 0.10, 0.17, 1 },
  cardActive  = { 0.12, 0.14, 0.22, 1 },
  cardBorder  = { 0.20, 0.20, 0.30, 0.5 },
  activeBorder = { 0.38, 0.65, 0.98, 0.9 },
  themeName   = { 0.78, 0.80, 0.86, 1 },
  themeNameActive = { 0.38, 0.65, 0.98, 1 },
  closeNormal = { 0.55, 0.58, 0.65, 1 },
  closeHover  = { 0.95, 0.45, 0.45, 1 },
  statusBg    = { 0.06, 0.06, 0.11, 1 },
  statusText  = { 0.45, 0.48, 0.55, 1 },
  scrollbar   = { 0.25, 0.25, 0.35, 0.6 },
  scrollthumb = { 0.40, 0.42, 0.50, 0.8 },
  previewLabel = { 0.55, 0.58, 0.65, 1 },
  previewBorder = { 0.20, 0.20, 0.30, 0.6 },
  swatchBorder = { 1, 1, 1, 0.12 },
}

-- ============================================================================
-- Font cache
-- ============================================================================

local fonts = {}
local function getFont(size)
  if not fonts[size] then fonts[size] = love.graphics.newFont(size) end
  return fonts[size]
end

-- ============================================================================
-- Drawing helpers
-- ============================================================================

local function setColor(c)
  love.graphics.setColor(c[1], c[2], c[3], c[4] or 1)
end

local function drawRoundedRect(mode, x, y, w, h, r)
  r = math.min(r, math.min(w, h) / 2)
  love.graphics.rectangle(mode, x, y, w, h, r, r)
end

local function drawText(text, x, y, font, color)
  love.graphics.setFont(font)
  setColor(color)
  love.graphics.print(text, x, y)
end

local function inRect(mx, my, r)
  return r and mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h
end

--- Parse a hex color string to Love2D RGBA (0-1 range).
local function hexToRGBA(hex)
  if not hex or type(hex) ~= "string" then return nil end
  local r, g, b, a = Color.parse(hex)
  if r then return { r, g, b, a } end
  return nil
end

-- ============================================================================
-- Panel geometry
-- ============================================================================

local function getPanelRect()
  local sw, sh = love.graphics.getDimensions()
  local pw = math.max(MIN_PANEL_W, math.floor(sw * PANEL_W_RATIO))
  local ph = math.max(MIN_PANEL_H, math.floor(sh * PANEL_H_RATIO))
  pw = math.min(pw, sw - 40)
  ph = math.min(ph, sh - 40)
  return {
    x = math.floor((sw - pw) / 2),
    y = math.floor((sh - ph) / 2),
    w = pw,
    h = ph,
  }
end

-- ============================================================================
-- Theme name sorting (group by family, then alphabetical within family)
-- ============================================================================

local function buildThemeNames(registry)
  local names = {}
  for name in pairs(registry) do
    names[#names + 1] = name
  end
  table.sort(names, function(a, b)
    -- Extract family prefix (everything before the last dash)
    local fa = a:match("^(.+)-") or a
    local fb = b:match("^(.+)-") or b
    if fa ~= fb then return fa < fb end
    return a < b
  end)
  return names
end

-- ============================================================================
-- Public API
-- ============================================================================

function ThemeMenu.init(opts)
  opts = opts or {}
  state.toggleKey = opts.key or "f9"
  state.onSwitch = opts.onSwitch
end

function ThemeMenu.setThemes(registry)
  state.themes = registry
  state.themeNames = buildThemeNames(registry)
  -- Set selectedIdx to current theme if possible
  if state.currentName then
    for i, name in ipairs(state.themeNames) do
      if name == state.currentName then
        state.selectedIdx = i
        break
      end
    end
  end
end

function ThemeMenu.setCurrentTheme(name, theme)
  state.currentName = name
  state.currentTheme = theme
  -- Update selectedIdx
  for i, n in ipairs(state.themeNames) do
    if n == name then
      state.selectedIdx = i
      break
    end
  end
end

function ThemeMenu.isOpen()
  return state.open
end

local function open()
  state.open = true
  state.scrollY = 0
  state.hoverIdx = nil
  state.cardRects = {}
  -- Ensure selectedIdx tracks current theme
  if state.currentName then
    for i, n in ipairs(state.themeNames) do
      if n == state.currentName then
        state.selectedIdx = i
        break
      end
    end
  end
end

local function close()
  state.open = false
end

local function switchTheme(idx)
  local name = state.themeNames[idx]
  if not name then return end
  if name == state.currentName then return end
  state.selectedIdx = idx
  if state.onSwitch then
    state.onSwitch(name)
  end
end

-- ============================================================================
-- Canvas capture (live preview)
-- ============================================================================

function ThemeMenu.beginCapture()
  local sw, sh = love.graphics.getDimensions()
  -- Create or resize canvas
  if not state.captureCanvas
    or state.captureCanvas:getWidth() ~= sw
    or state.captureCanvas:getHeight() ~= sh then
    state.captureCanvas = love.graphics.newCanvas(sw, sh)
  end
  love.graphics.setCanvas(state.captureCanvas)
  love.graphics.clear(0, 0, 0, 1)
end

function ThemeMenu.endCapture()
  love.graphics.setCanvas()
  -- Draw the captured frame to screen at full size (so app looks normal)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(state.captureCanvas, 0, 0)
end

-- ============================================================================
-- Drawing
-- ============================================================================

function ThemeMenu.draw()
  if not state.open then return end
  if not state.themes or #state.themeNames == 0 then return end

  local sw, sh = love.graphics.getDimensions()
  local p = getPanelRect()
  state.panelRect = p

  local fontTitle  = getFont(14)
  local fontName   = getFont(11)
  local fontStatus = getFont(10)

  -- ── Backdrop ──
  setColor(C.backdrop)
  love.graphics.rectangle("fill", 0, 0, sw, sh)

  -- ── Panel background ──
  setColor(C.panelBg)
  drawRoundedRect("fill", p.x, p.y, p.w, p.h, CORNER_R)
  setColor(C.border)
  love.graphics.setLineWidth(1)
  drawRoundedRect("line", p.x, p.y, p.w, p.h, CORNER_R)

  -- ── Title bar ──
  setColor(C.titleBg)
  drawRoundedRect("fill", p.x, p.y, p.w, TITLE_BAR_H, CORNER_R)
  love.graphics.rectangle("fill", p.x, p.y + TITLE_BAR_H - CORNER_R, p.w, CORNER_R)

  drawText("Theme Browser", p.x + 12, p.y + 8, fontTitle, C.titleText)

  -- Close button
  local closeX = p.x + p.w - 28
  local closeY = p.y + 6
  state.closeRect = { x = closeX, y = closeY, w = 20, h = 20 }
  local closeColor = state.hoverClose and C.closeHover or C.closeNormal
  love.graphics.setFont(getFont(14))
  setColor(closeColor)
  love.graphics.print("x", closeX + 5, closeY + 2)

  -- Title border
  setColor(C.border)
  love.graphics.line(p.x, p.y + TITLE_BAR_H, p.x + p.w, p.y + TITLE_BAR_H)

  -- ── Layout zones ──
  local previewH = math.floor(p.h * PREVIEW_RATIO)
  local listY = p.y + TITLE_BAR_H
  local listH = p.h - TITLE_BAR_H - previewH - STATUS_BAR_H - DIVIDER_H
  local previewY = listY + listH + DIVIDER_H
  local statusY = p.y + p.h - STATUS_BAR_H

  -- ── Theme card list (scrollable) ──
  love.graphics.setScissor(p.x, listY, p.w, listH)

  state.cardRects = {}
  local curY = listY - state.scrollY + CARD_PAD
  local totalContentH = 0

  for i, name in ipairs(state.themeNames) do
    local theme = state.themes[name]
    local colors = theme and theme.colors
    local cardX = p.x + CARD_PAD
    local cardW = p.w - CARD_PAD * 2
    local isActive = (name == state.currentName)
    local isHover = (state.hoverIdx == i)
    local isSelected = (state.selectedIdx == i)

    state.cardRects[i] = { x = cardX, y = curY, w = cardW, h = CARD_H }

    -- Card background
    local bg = C.cardBg
    if isActive then bg = C.cardActive
    elseif isHover then bg = C.cardHover end
    setColor(bg)
    drawRoundedRect("fill", cardX, curY, cardW, CARD_H, 4)

    -- Card border
    if isActive then
      setColor(C.activeBorder)
      love.graphics.setLineWidth(2)
    elseif isSelected then
      setColor(C.activeBorder)
      love.graphics.setLineWidth(1)
    else
      setColor(C.cardBorder)
      love.graphics.setLineWidth(1)
    end
    drawRoundedRect("line", cardX, curY, cardW, CARD_H, 4)
    love.graphics.setLineWidth(1)

    -- Theme name
    local nameColor = isActive and C.themeNameActive or C.themeName
    local displayName = name
    if isActive then displayName = name .. "  (active)" end
    drawText(displayName, cardX + CARD_INNER_PAD, curY + 4, fontName, nameColor)

    -- Color swatches
    local swatchY = curY + 22
    local swatchX = cardX + CARD_INNER_PAD
    if colors then
      for _, key in ipairs(SWATCH_KEYS) do
        local hex = colors[key]
        local rgba = hexToRGBA(hex)
        if rgba then
          setColor(rgba)
          drawRoundedRect("fill", swatchX, swatchY, SWATCH_SIZE, SWATCH_SIZE, SWATCH_RADIUS)
          -- Subtle border for visibility
          setColor(C.swatchBorder)
          drawRoundedRect("line", swatchX, swatchY, SWATCH_SIZE, SWATCH_SIZE, SWATCH_RADIUS)
        end
        swatchX = swatchX + SWATCH_SIZE + SWATCH_GAP
      end
    end

    curY = curY + CARD_H + CARD_PAD
    totalContentH = totalContentH + CARD_H + CARD_PAD
  end

  -- Compute max scroll
  state.maxScrollY = math.max(0, totalContentH + CARD_PAD - listH)

  -- Scrollbar
  if state.maxScrollY > 0 then
    local scrollbarW = 4
    local scrollbarX = p.x + p.w - scrollbarW - 2
    local thumbRatio = listH / (totalContentH + CARD_PAD)
    local thumbH = math.max(20, math.floor(listH * thumbRatio))
    local scrollRatio = state.scrollY / state.maxScrollY
    local thumbY = listY + math.floor((listH - thumbH) * scrollRatio)

    setColor(C.scrollbar)
    love.graphics.rectangle("fill", scrollbarX, listY, scrollbarW, listH, 2, 2)
    setColor(C.scrollthumb)
    love.graphics.rectangle("fill", scrollbarX, thumbY, scrollbarW, thumbH, 2, 2)
  end

  love.graphics.setScissor()

  -- ── Divider ──
  setColor(C.border)
  love.graphics.line(p.x, previewY - 1, p.x + p.w, previewY - 1)

  -- ── Live preview ──
  local previewPad = 10
  local previewLabelH = 16
  drawText("Live Preview", p.x + previewPad, previewY + 4, fontStatus, C.previewLabel)

  if state.captureCanvas then
    local canvasW = state.captureCanvas:getWidth()
    local canvasH = state.captureCanvas:getHeight()

    -- Available space for the preview image
    local availW = p.w - previewPad * 2
    local availH = previewH - previewLabelH - previewPad * 2

    -- Scale to fit
    local scale = math.min(availW / canvasW, availH / canvasH)
    local drawW = math.floor(canvasW * scale)
    local drawH = math.floor(canvasH * scale)
    local drawX = p.x + previewPad + math.floor((availW - drawW) / 2)
    local drawY = previewY + previewLabelH + 4

    -- Preview border
    setColor(C.previewBorder)
    love.graphics.rectangle("line", drawX - 1, drawY - 1, drawW + 2, drawH + 2, 2, 2)

    -- Draw scaled preview
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(state.captureCanvas, drawX, drawY, 0, scale, scale)
  end

  -- ── Status bar ──
  setColor(C.statusBg)
  love.graphics.rectangle("fill", p.x, statusY, p.w, STATUS_BAR_H)
  -- Bottom rounded corners
  drawRoundedRect("fill", p.x, statusY, p.w, STATUS_BAR_H, CORNER_R)
  love.graphics.rectangle("fill", p.x, statusY, p.w, CORNER_R)

  setColor(C.border)
  love.graphics.line(p.x, statusY, p.x + p.w, statusY)

  local statusMsg = string.format("Current: %s  |  %d themes  |  F9 close",
    state.currentName or "none", #state.themeNames)
  drawText(statusMsg, p.x + 10, statusY + 5, fontStatus, C.statusText)
end

-- ============================================================================
-- Input handlers
-- ============================================================================

function ThemeMenu.keypressed(key)
  if key == state.toggleKey then
    if state.open then close() else open() end
    return true
  end
  if not state.open then return false end

  if key == "escape" then
    close()
    return true
  elseif key == "up" then
    state.selectedIdx = math.max(1, state.selectedIdx - 1)
    ensureVisible(state.selectedIdx)
    return true
  elseif key == "down" then
    state.selectedIdx = math.min(#state.themeNames, state.selectedIdx + 1)
    ensureVisible(state.selectedIdx)
    return true
  elseif key == "return" or key == "kpenter" then
    switchTheme(state.selectedIdx)
    return true
  end

  -- Consume all keys when open
  return true
end

function ThemeMenu.mousepressed(x, y, button)
  if not state.open then return false end

  -- Click outside panel = close
  if not inRect(x, y, state.panelRect) then
    close()
    return true
  end

  -- Close button
  if inRect(x, y, state.closeRect) then
    close()
    return true
  end

  -- Theme card clicks
  if button == 1 then
    for i, rect in pairs(state.cardRects) do
      -- Adjust rect for scroll
      if inRect(x, y, rect) then
        state.selectedIdx = i
        switchTheme(i)
        return true
      end
    end
  end

  return true
end

function ThemeMenu.mousereleased(x, y, button)
  if not state.open then return false end
  return true
end

function ThemeMenu.mousemoved(x, y)
  if not state.open then return end

  -- Close button hover
  state.hoverClose = inRect(x, y, state.closeRect)

  -- Theme card hover
  state.hoverIdx = nil
  for i, rect in pairs(state.cardRects) do
    if inRect(x, y, rect) then
      state.hoverIdx = i
      break
    end
  end
end

function ThemeMenu.wheelmoved(x, y)
  if not state.open then return false end

  state.scrollY = state.scrollY - y * SCROLL_SPEED
  state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))
  return true
end

function ThemeMenu.textinput(text)
  if not state.open then return false end
  return true  -- consume
end

-- ============================================================================
-- Scroll helpers
-- ============================================================================

--- Ensure the card at idx is visible in the scroll viewport.
function ensureVisible(idx)
  local p = getPanelRect()
  local previewH = math.floor(p.h * PREVIEW_RATIO)
  local listH = p.h - TITLE_BAR_H - previewH - STATUS_BAR_H - DIVIDER_H

  local cardTop = (idx - 1) * (CARD_H + CARD_PAD) + CARD_PAD
  local cardBottom = cardTop + CARD_H

  if cardTop < state.scrollY then
    state.scrollY = cardTop
  elseif cardBottom > state.scrollY + listH then
    state.scrollY = cardBottom - listH
  end
  state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))
end

return ThemeMenu
