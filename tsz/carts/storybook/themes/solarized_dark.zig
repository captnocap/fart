//! Solarized Dark theme — precise color theory, low-contrast dark background.
//!
//! Ethan Schoonover's Solarized: 16-color palette designed for terminal and
//! GUI use. Emphasizes readability with carefully tuned contrast ratios.
//! Full classifier variant: minimal radii, clean spacing, medium fonts.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(0, 43, 54), // #002b36 — base03
    .bg_alt = rgb(7, 54, 66), // #073642 — base02
    .bg_elevated = rgb(7, 54, 66), // #073642 — base02
    .text = rgb(131, 148, 150), // #839496 — base0
    .text_secondary = rgb(147, 161, 161), // #93a1a1 — base1
    .text_dim = rgb(88, 110, 117), // #586e75 — base01
    .primary = rgb(38, 139, 210), // #268bd2 — blue
    .primary_hover = rgb(42, 161, 152), // #2aa198 — cyan
    .primary_pressed = rgb(133, 153, 0), // #859900 — green
    .surface = rgb(7, 54, 66), // #073642 — base02
    .surface_hover = rgb(7, 54, 66), // #073642
    .border = rgb(88, 110, 117), // #586e75 — base01
    .border_focus = rgb(38, 139, 210), // #268bd2 — blue
    .accent = rgb(108, 113, 196), // #6c71c4 — violet
    .@"error" = rgb(220, 50, 47), // #dc322f — red
    .warning = rgb(203, 75, 22), // #cb4b16 — orange
    .success = rgb(133, 153, 0), // #859900 — green
    .info = rgb(42, 161, 152), // #2aa198 — cyan
});

/// Clean, minimal — Solarized's design philosophy is precision.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 3,
    .radius_md = 5,
    .radius_lg = 8,
    .spacing_sm = 6,
    .spacing_md = 10,
    .spacing_lg = 16,
    .border_thin = 1,
    .border_medium = 2,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 18,
});
