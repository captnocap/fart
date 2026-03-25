//! Dracula theme — dark purple-tinted surfaces, neon accents, gothic elegance.
//!
//! Full classifier variant: medium radii, comfortable spacing,
//! slightly larger fonts for readability on dark backgrounds.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(40, 42, 54), // #282a36 — background
    .bg_alt = rgb(33, 34, 44), // #21222c — darker bg
    .bg_elevated = rgb(68, 71, 90), // #44475a — current line
    .text = rgb(248, 248, 242), // #f8f8f2 — foreground
    .text_secondary = rgb(191, 191, 191), // #bfbfbf
    .text_dim = rgb(98, 114, 164), // #6272a4 — comment
    .primary = rgb(189, 147, 249), // #bd93f9 — purple
    .primary_hover = rgb(202, 164, 250), // #caa4fa
    .primary_pressed = rgb(212, 181, 251), // #d4b5fb
    .surface = rgb(68, 71, 90), // #44475a — current line
    .surface_hover = rgb(77, 80, 94), // #4d505e
    .border = rgb(68, 71, 90), // #44475a
    .border_focus = rgb(189, 147, 249), // #bd93f9
    .accent = rgb(255, 121, 198), // #ff79c6 — pink
    .@"error" = rgb(255, 85, 85), // #ff5555 — red
    .warning = rgb(255, 184, 108), // #ffb86c — orange
    .success = rgb(80, 250, 123), // #50fa7b — green
    .info = rgb(139, 233, 253), // #8be9fd — cyan
});

/// Comfortable, slightly rounded — elegant dark theme.
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
