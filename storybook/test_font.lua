-- Quick font rendering test — run with: love . --test-font
-- Tests whether Cyrillic/Greek/Arabic glyphs render from NotoSans

function love.load()
  noto = love.graphics.newFont("fonts/base/NotoSans-Regular.ttf", 22)
  builtin = love.graphics.newFont(22)
end

function love.draw()
  local y = 20

  love.graphics.setColor(0.6, 0.6, 0.6)
  love.graphics.setFont(builtin)
  love.graphics.print("== NotoSans-Regular.ttf ==", 20, y); y = y + 40

  love.graphics.setColor(1, 1, 1)
  love.graphics.setFont(noto)
  love.graphics.print("Latin: The quick brown fox", 20, y); y = y + 30
  love.graphics.print("Cyrillic: \208\161\209\138\208\181\209\136\209\140", 20, y); y = y + 30
  love.graphics.print("Greek: \206\152\206\181\206\191\206\175", 20, y); y = y + 30

  -- Direct UTF-8 strings
  y = y + 20
  love.graphics.setColor(0.6, 0.6, 0.6)
  love.graphics.setFont(builtin)
  love.graphics.print("== Direct UTF-8 ==", 20, y); y = y + 40

  love.graphics.setColor(1, 1, 1)
  love.graphics.setFont(noto)
  love.graphics.print("Cyrillic direct: Привет мир", 20, y); y = y + 30
  love.graphics.print("Greek direct: Θεοί τα καλά", 20, y); y = y + 30

  -- hasGlyphs check
  y = y + 20
  love.graphics.setColor(0.4, 0.8, 0.4)
  love.graphics.setFont(builtin)
  love.graphics.print("hasGlyphs(Cyrillic С): " .. tostring(noto:hasGlyphs("С")), 20, y); y = y + 30
  love.graphics.print("hasGlyphs(Greek Θ): " .. tostring(noto:hasGlyphs("Θ")), 20, y); y = y + 30
  love.graphics.print("hasGlyphs(Arabic ب): " .. tostring(noto:hasGlyphs("ب")), 20, y); y = y + 30
end
