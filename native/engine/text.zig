//! ReactJIT Text Renderer — Phase 2
//!
//! FreeType glyph rasterization → SDL2 texture cache → screen.
//! Measures text for the layout engine, renders it for the painter.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");

// ── Glyph cache ─────────────────────────────────────────────────────────────

const GlyphKey = struct {
    codepoint: u32,
    size_px: u16,
};

const GlyphInfo = struct {
    texture: ?*c.SDL_Texture,
    width: i32,
    height: i32,
    bearing_x: i32,
    bearing_y: i32,
    advance: i32, // in pixels (pre-divided from 26.6 fixed point)
};

const MAX_CACHED_GLYPHS = 512;

// ── UTF-8 decoding ──────────────────────────────────────────────────────────

const Utf8Char = struct {
    codepoint: u32,
    len: u3, // 1–4 bytes consumed
};

/// Decode one UTF-8 codepoint from the start of `bytes`.
/// Returns the codepoint and how many bytes it consumed.
/// Invalid sequences return U+FFFD (replacement character) and advance 1 byte.
fn decodeUtf8(bytes: []const u8) Utf8Char {
    if (bytes.len == 0) return .{ .codepoint = 0xFFFD, .len = 1 };
    const b0 = bytes[0];
    if (b0 < 0x80) {
        return .{ .codepoint = b0, .len = 1 };
    } else if (b0 < 0xC0) {
        return .{ .codepoint = 0xFFFD, .len = 1 }; // stray continuation byte
    } else if (b0 < 0xE0) {
        if (bytes.len < 2) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x1F) << 6) | @as(u32, bytes[1] & 0x3F), .len = 2 };
    } else if (b0 < 0xF0) {
        if (bytes.len < 3) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x0F) << 12) | (@as(u32, bytes[1] & 0x3F) << 6) | @as(u32, bytes[2] & 0x3F), .len = 3 };
    } else {
        if (bytes.len < 4) return .{ .codepoint = 0xFFFD, .len = 1 };
        return .{ .codepoint = (@as(u32, b0 & 0x07) << 18) | (@as(u32, bytes[1] & 0x3F) << 12) | (@as(u32, bytes[2] & 0x3F) << 6) | @as(u32, bytes[3] & 0x3F), .len = 4 };
    }
}

// ── Text Engine ─────────────────────────────────────────────────────────────

pub const TextEngine = struct {
    library: c.FT_Library,
    face: c.FT_Face,
    renderer: *c.SDL_Renderer,
    current_size: u16,

    // Simple flat cache — good enough for Phase 2
    cache_keys: [MAX_CACHED_GLYPHS]GlyphKey,
    cache_vals: [MAX_CACHED_GLYPHS]GlyphInfo,
    cache_count: usize,

    pub fn init(renderer: *c.SDL_Renderer, font_path: [*:0]const u8) !TextEngine {
        var library: c.FT_Library = undefined;
        if (c.FT_Init_FreeType(&library) != 0) {
            return error.FreeTypeInitFailed;
        }

        var face: c.FT_Face = undefined;
        if (c.FT_New_Face(library, font_path, 0, &face) != 0) {
            return error.FontLoadFailed;
        }

        // Default size
        _ = c.FT_Set_Pixel_Sizes(face, 0, 16);

        return TextEngine{
            .library = library,
            .face = face,
            .renderer = renderer,
            .current_size = 16,
            .cache_keys = undefined,
            .cache_vals = undefined,
            .cache_count = 0,
        };
    }

    pub fn deinit(self: *TextEngine) void {
        // Free cached textures
        for (0..self.cache_count) |i| {
            if (self.cache_vals[i].texture) |tex| {
                c.SDL_DestroyTexture(tex);
            }
        }
        _ = c.FT_Done_Face(self.face);
        _ = c.FT_Done_FreeType(self.library);
    }

    fn setSize(self: *TextEngine, size_px: u16) void {
        if (self.current_size != size_px) {
            _ = c.FT_Set_Pixel_Sizes(self.face, 0, size_px);
            self.current_size = size_px;
        }
    }

    fn lookupGlyph(self: *TextEngine, codepoint: u32, size_px: u16) ?*const GlyphInfo {
        for (0..self.cache_count) |i| {
            if (self.cache_keys[i].codepoint == codepoint and self.cache_keys[i].size_px == size_px) {
                return &self.cache_vals[i];
            }
        }
        return null;
    }

    fn rasterizeGlyph(self: *TextEngine, codepoint: u32, size_px: u16) ?*const GlyphInfo {
        // Check cache first
        if (self.lookupGlyph(codepoint, size_px)) |g| return g;

        // Cache full — evict oldest (simple FIFO)
        if (self.cache_count >= MAX_CACHED_GLYPHS) {
            if (self.cache_vals[0].texture) |tex| {
                c.SDL_DestroyTexture(tex);
            }
            // Shift everything down
            for (0..self.cache_count - 1) |i| {
                self.cache_keys[i] = self.cache_keys[i + 1];
                self.cache_vals[i] = self.cache_vals[i + 1];
            }
            self.cache_count -= 1;
        }

        self.setSize(size_px);

        if (c.FT_Load_Char(self.face, codepoint, c.FT_LOAD_RENDER) != 0) {
            return null;
        }

        const glyph = self.face.*.glyph;
        const bitmap = glyph.*.bitmap;
        const bw: i32 = @intCast(bitmap.width);
        const bh: i32 = @intCast(bitmap.rows);

        var texture: ?*c.SDL_Texture = null;

        if (bw > 0 and bh > 0) {
            // Create an ARGB surface from the grayscale bitmap.
            // SDL_PIXELFORMAT_ARGB8888 on little-endian = bytes B, G, R, A in memory.
            const surface = c.SDL_CreateRGBSurfaceWithFormat(
                0,
                bw,
                bh,
                32,
                c.SDL_PIXELFORMAT_ARGB8888,
            );
            if (surface == null) return null;
            defer c.SDL_FreeSurface(surface);

            // Copy FreeType bitmap (8-bit alpha) into ARGB surface
            const pixels: [*]u8 = @ptrCast(surface.*.pixels);
            const pitch: usize = @intCast(surface.*.pitch);
            const src_pitch: usize = @intCast(bitmap.pitch);

            for (0..@intCast(bh)) |row| {
                for (0..@intCast(bw)) |col| {
                    const alpha = bitmap.buffer[row * src_pitch + col];
                    const dst_offset = row * pitch + col * 4;
                    // ARGB8888 little-endian memory: B, G, R, A
                    pixels[dst_offset + 0] = 255; // B
                    pixels[dst_offset + 1] = 255; // G
                    pixels[dst_offset + 2] = 255; // R
                    pixels[dst_offset + 3] = alpha; // A
                }
            }

            texture = c.SDL_CreateTextureFromSurface(self.renderer, surface);
            if (texture) |tex| {
                _ = c.SDL_SetTextureBlendMode(tex, c.SDL_BLENDMODE_BLEND);
            }
        }

        const idx = self.cache_count;
        self.cache_keys[idx] = .{ .codepoint = codepoint, .size_px = size_px };
        self.cache_vals[idx] = .{
            .texture = texture,
            .width = bw,
            .height = bh,
            .bearing_x = glyph.*.bitmap_left,
            .bearing_y = glyph.*.bitmap_top,
            .advance = @intCast(glyph.*.advance.x >> 6), // 26.6 fixed → pixels
        };
        self.cache_count += 1;

        return &self.cache_vals[idx];
    }

    /// Get the advance width of a single Unicode codepoint.
    fn cpAdvance(self: *TextEngine, codepoint: u32, size_px: u16) f32 {
        if (self.rasterizeGlyph(codepoint, size_px)) |g| {
            return @floatFromInt(g.advance);
        }
        return 0;
    }

    /// Get font-level line metrics for the current size.
    fn lineMetrics(self: *TextEngine, size_px: u16) struct { ascent: f32, height: f32 } {
        self.setSize(size_px);
        const metrics = self.face.*.size.*.metrics;
        const ascent: f32 = @as(f32, @floatFromInt(metrics.ascender)) / 64.0;
        const descent: f32 = @as(f32, @floatFromInt(-metrics.descender)) / 64.0;
        return .{ .ascent = ascent, .height = ascent + descent };
    }

    // ── Word wrapping ───────────────────────────────────────────────────

    const MAX_WRAP_LINES = 256;

    const WrapResult = struct {
        line_starts: [MAX_WRAP_LINES]usize = undefined,
        line_ends: [MAX_WRAP_LINES]usize = undefined,
        count: usize = 0,

        fn addLine(self: *WrapResult, start: usize, end: usize) void {
            if (self.count < MAX_WRAP_LINES) {
                self.line_starts[self.count] = start;
                self.line_ends[self.count] = end;
                self.count += 1;
            }
        }
    };

    /// Compute word-wrap line breaks for text within max_width.
    /// Words are delimited by spaces. Newlines force a break.
    /// Words wider than max_width get their own line (no mid-word break).
    /// Iterates by UTF-8 codepoints so multi-byte characters stay intact.
    fn wordWrap(self: *TextEngine, text: []const u8, size_px: u16, max_width: f32) WrapResult {
        var result = WrapResult{};

        if (text.len == 0) {
            result.addLine(0, 0);
            return result;
        }

        self.setSize(size_px);
        const space_w = self.cpAdvance(' ', size_px);

        var line_start: usize = 0;
        var line_width: f32 = 0;
        var last_word_end: usize = 0;
        var i: usize = 0;

        while (i < text.len) {
            // Handle newline — explicit line break
            if (text[i] == '\n') {
                const end = if (last_word_end > line_start) last_word_end else i;
                result.addLine(line_start, end);
                i += 1;
                line_start = i;
                last_word_end = i;
                line_width = 0;
                continue;
            }

            // Skip spaces
            if (text[i] == ' ') {
                i += 1;
                continue;
            }

            // Found start of a word — measure the whole word (UTF-8 aware)
            const word_start = i;
            var word_width: f32 = 0;
            while (i < text.len and text[i] != ' ' and text[i] != '\n') {
                const ch = decodeUtf8(text[i..]);
                word_width += self.cpAdvance(ch.codepoint, size_px);
                i += ch.len;
            }
            const word_end = i;

            // Would adding this word overflow the line?
            const need_space = (line_width > 0);
            const with_word = line_width + (if (need_space) space_w else @as(f32, 0)) + word_width;

            if (need_space and with_word > max_width) {
                // Wrap: emit current line, start new line at this word
                result.addLine(line_start, last_word_end);
                line_start = word_start;
                line_width = word_width;
                last_word_end = word_end;
            } else {
                line_width = with_word;
                last_word_end = word_end;
            }
        }

        // Emit final line
        if (line_start <= text.len) {
            const end = if (last_word_end > line_start) last_word_end else text.len;
            result.addLine(line_start, end);
        }

        if (result.count == 0) {
            result.addLine(0, text.len);
        }

        return result;
    }

    // ── Measurement ─────────────────────────────────────────────────────

    /// Measure a string's width and height at the given font size.
    /// Height uses the font's line metrics (consistent per font size),
    /// not per-glyph ink bounds (which vary by character and cause overlap).
    pub fn measureText(self: *TextEngine, text: []const u8, size_px: u16) layout.TextMetrics {
        const lm = self.lineMetrics(size_px);

        var width: f32 = 0;
        var i: usize = 0;
        while (i < text.len) {
            const ch = decodeUtf8(text[i..]);
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                width += @floatFromInt(g.advance);
            }
            i += ch.len;
        }

        return .{
            .width = width,
            .height = lm.height,
            .ascent = lm.ascent,
        };
    }

    /// Measure text with word wrapping within max_width.
    /// Returns the widest wrapped line's width and total wrapped height.
    /// If max_width <= 0, falls back to unwrapped measureText.
    pub fn measureTextWrapped(self: *TextEngine, text: []const u8, size_px: u16, max_width: f32) layout.TextMetrics {
        if (max_width <= 0) {
            return self.measureText(text, size_px);
        }

        const lm = self.lineMetrics(size_px);
        const wrap = self.wordWrap(text, size_px, max_width);

        // Find the widest line (UTF-8 aware)
        var widest: f32 = 0;
        for (0..wrap.count) |li| {
            const line = text[wrap.line_starts[li]..wrap.line_ends[li]];
            var lw: f32 = 0;
            var j: usize = 0;
            while (j < line.len) {
                const ch = decodeUtf8(line[j..]);
                if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                    lw += @floatFromInt(g.advance);
                }
                j += ch.len;
            }
            if (lw > widest) widest = lw;
        }

        return .{
            .width = @min(widest, max_width),
            .height = lm.height * @as(f32, @floatFromInt(wrap.count)),
            .ascent = lm.ascent,
        };
    }

    // ── Drawing ──────────────────────────────────────────────────────────

    /// Draw a single line of text at (x, y) with the given color and size.
    /// y is the top of the text bounding box (not baseline).
    pub fn drawText(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, color: layout.Color) void {
        const lm = self.lineMetrics(size_px);

        var pen_x = x;
        const baseline_y = y + lm.ascent;

        var i: usize = 0;
        while (i < text.len) {
            const ch = decodeUtf8(text[i..]);
            if (self.rasterizeGlyph(ch.codepoint, size_px)) |g| {
                if (g.texture) |tex| {
                    _ = c.SDL_SetTextureColorMod(tex, color.r, color.g, color.b);
                    _ = c.SDL_SetTextureAlphaMod(tex, color.a);

                    var dst = c.SDL_Rect{
                        .x = @intFromFloat(pen_x + @as(f32, @floatFromInt(g.bearing_x))),
                        .y = @intFromFloat(baseline_y - @as(f32, @floatFromInt(g.bearing_y))),
                        .w = g.width,
                        .h = g.height,
                    };
                    _ = c.SDL_RenderCopy(self.renderer, tex, null, &dst);
                }
                pen_x += @floatFromInt(g.advance);
            }
            i += ch.len;
        }
    }

    /// Draw text with word wrapping within max_width.
    /// If max_width <= 0, falls back to single-line drawText.
    pub fn drawTextWrapped(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, max_width: f32, color: layout.Color) void {
        if (max_width <= 0) {
            self.drawText(text, x, y, size_px, color);
            return;
        }

        const lm = self.lineMetrics(size_px);
        const wrap = self.wordWrap(text, size_px, max_width);

        for (0..wrap.count) |li| {
            const line = text[wrap.line_starts[li]..wrap.line_ends[li]];
            const line_y = y + lm.height * @as(f32, @floatFromInt(li));
            self.drawText(line, x, line_y, size_px, color);
        }
    }
};
