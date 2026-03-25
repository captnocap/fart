//! Catppuccin Mocha theme — warm pastel colors on deep blue-gray base.
//!
//! Full classifier variant: soft radii, cozy spacing, gentle borders.
//! The warmest Catppuccin flavor — rosewater and flamingo tints everywhere.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(30, 30, 46), // #1e1e2e — base
    .bg_alt = rgb(24, 24, 37), // #181825 — mantle
    .bg_elevated = rgb(49, 50, 68), // #313244 — surface0
    .text = rgb(205, 214, 244), // #cdd6f4 — text
    .text_secondary = rgb(186, 194, 222), // #bac2de — subtext1
    .text_dim = rgb(166, 173, 200), // #a6adc8 — subtext0
    .primary = rgb(137, 180, 250), // #89b4fa — blue
    .primary_hover = rgb(116, 199, 236), // #74c7ec — sapphire
    .primary_pressed = rgb(137, 220, 235), // #89dceb — sky
    .surface = rgb(49, 50, 68), // #313244 — surface0
    .surface_hover = rgb(69, 71, 90), // #45475a — surface1
    .border = rgb(69, 71, 90), // #45475a — surface1
    .border_focus = rgb(137, 180, 250), // #89b4fa — blue
    .accent = rgb(203, 166, 247), // #cba6f7 — mauve
    .@"error" = rgb(243, 139, 168), // #f38ba8 — red
    .warning = rgb(250, 179, 135), // #fab387 — peach
    .success = rgb(166, 227, 161), // #a6e3a1 — green
    .info = rgb(137, 220, 235), // #89dceb — sky
});

/// Soft, cozy, welcoming — the Catppuccin way.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 6,
    .radius_md = 8,
    .radius_lg = 12,
    .spacing_sm = 6,
    .spacing_md = 10,
    .spacing_lg = 14,
    .border_thin = 1,
    .border_medium = 1,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 17,
});
