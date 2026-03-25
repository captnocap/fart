//! Tokyo Night theme — midnight blue with neon city accents.
//!
//! Full classifier variant: sharp-ish radii, tight spacing, code-focused.
//! Designed for long coding sessions — low contrast text, vivid syntax highlights.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(26, 27, 38), // #1a1b26 — bg
    .bg_alt = rgb(22, 22, 30), // #16161e — bg_dark
    .bg_elevated = rgb(36, 40, 59), // #24283b — bg_highlight
    .text = rgb(192, 202, 245), // #c0caf5 — fg
    .text_secondary = rgb(169, 177, 214), // #a9b1d6 — fg_dark
    .text_dim = rgb(86, 95, 137), // #565f89 — comment
    .primary = rgb(122, 162, 247), // #7aa2f7 — blue
    .primary_hover = rgb(125, 207, 255), // #7dcfff — cyan
    .primary_pressed = rgb(42, 195, 222), // #2ac3de — blue1
    .surface = rgb(36, 40, 59), // #24283b
    .surface_hover = rgb(41, 46, 66), // #292e42
    .border = rgb(41, 46, 66), // #292e42
    .border_focus = rgb(122, 162, 247), // #7aa2f7
    .accent = rgb(187, 154, 247), // #bb9af7 — magenta
    .@"error" = rgb(247, 118, 142), // #f7768e — red
    .warning = rgb(224, 175, 104), // #e0af68 — yellow
    .success = rgb(158, 206, 106), // #9ece6a — green
    .info = rgb(125, 207, 255), // #7dcfff — cyan
});

/// Sharp, compact, code-editor feel — neon on midnight.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 3,
    .radius_md = 5,
    .radius_lg = 8,
    .spacing_sm = 4,
    .spacing_md = 8,
    .spacing_lg = 12,
    .border_thin = 1,
    .border_medium = 1,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 16,
});
