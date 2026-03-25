//! Nord theme — arctic, calm, cool blues and muted frost.
//!
//! Full classifier variant: medium radii, relaxed spacing, natural feel.
//! Inspired by the Nordic color palette — polar night, snow storm, frost, aurora.

const Theme = @import("../../../framework/theme.zig");
const Color = @import("../../../framework/layout.zig").Color;
const build = Theme.buildPalette;
const buildStyle = Theme.buildStylePalette;
const rgb = Color.rgb;

pub const palette: Theme.Palette = build(.{
    .bg = rgb(46, 52, 64), // #2e3440 — nord0 (polar night)
    .bg_alt = rgb(59, 66, 82), // #3b4252 — nord1
    .bg_elevated = rgb(67, 76, 94), // #434c5e — nord2
    .text = rgb(236, 239, 244), // #eceff4 — nord6 (snow storm)
    .text_secondary = rgb(216, 222, 233), // #d8dee9 — nord4
    .text_dim = rgb(76, 86, 106), // #4c566a — nord3
    .primary = rgb(136, 192, 208), // #88c0d0 — nord8 (frost)
    .primary_hover = rgb(143, 188, 187), // #8fbcbb — nord7
    .primary_pressed = rgb(129, 161, 193), // #81a1c1 — nord9
    .surface = rgb(59, 66, 82), // #3b4252 — nord1
    .surface_hover = rgb(67, 76, 94), // #434c5e — nord2
    .border = rgb(67, 76, 94), // #434c5e — nord2
    .border_focus = rgb(136, 192, 208), // #88c0d0 — nord8
    .accent = rgb(180, 142, 173), // #b48ead — nord15 (aurora purple)
    .@"error" = rgb(191, 97, 106), // #bf616a — nord11 (aurora red)
    .warning = rgb(208, 135, 112), // #d08770 — nord12 (aurora orange)
    .success = rgb(163, 190, 140), // #a3be8c — nord14 (aurora green)
    .info = rgb(94, 129, 172), // #5e81ac — nord10
});

/// Calm, natural, unhurried — arctic serenity.
pub const styles: Theme.StylePalette = buildStyle(.{
    .radius_sm = 4,
    .radius_md = 6,
    .radius_lg = 10,
    .spacing_sm = 6,
    .spacing_md = 10,
    .spacing_lg = 14,
    .border_thin = 1,
    .border_medium = 1,
    .font_sm = 12,
    .font_md = 14,
    .font_lg = 17,
});
