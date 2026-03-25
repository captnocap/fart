//! Gruvbox Dark theme — retro, warm, earthy tones with high readability.
//!
//! Pavel Pertsev's Gruvbox: designed for comfortable long reading sessions.
//! Warm palette with desaturated rainbow accents. The brown-yellow base
//! reduces eye strain compared to cool-toned dark themes.
//! Full classifier variant: soft radii, warm spacing, readable fonts.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(40, 40, 40), // #282828 — bg0
    .bg_alt = rgb(60, 56, 54), // #3c3836 — bg1
    .bg_elevated = rgb(80, 73, 69), // #504945 — bg2
    .text = rgb(235, 219, 178), // #ebdbb2 — fg1
    .text_secondary = rgb(213, 196, 161), // #d5c4a1 — fg2
    .text_dim = rgb(146, 131, 116), // #928374 — gray
    .primary = rgb(131, 165, 152), // #83a598 — blue
    .primary_hover = rgb(142, 192, 124), // #8ec07c — aqua
    .primary_pressed = rgb(184, 187, 38), // #b8bb26 — green
    .surface = rgb(60, 56, 54), // #3c3836 — bg1
    .surface_hover = rgb(80, 73, 69), // #504945 — bg2
    .border = rgb(80, 73, 69), // #504945 — bg2
    .border_focus = rgb(131, 165, 152), // #83a598 — blue
    .accent = rgb(211, 134, 155), // #d3869b — purple
    .@"error" = rgb(251, 73, 52), // #fb4934 — red
    .warning = rgb(254, 128, 25), // #fe8019 — orange
    .success = rgb(184, 187, 38), // #b8bb26 — green
    .info = rgb(131, 165, 152), // #83a598 — blue
});

/// Warm, slightly rounded — Gruvbox's retro aesthetic.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 4,
    .radius_md = 6,
    .radius_lg = 10,
    .spacing_sm = 6,
    .spacing_md = 10,
    .spacing_lg = 16,
    .border_thin = 1,
    .border_medium = 2,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 18,
});
