/**
 * theme_presets — palettes and style palettes ported from tsz/carts/storybook/themes.
 *
 * Each ThemeColors map holds the 18 semantic color tokens; each StylePalette holds
 * the 11 numeric style tokens. Together with an optional layout variant they form a
 * complete ThemePreset — one atomic swap via applyPreset().
 *
 * Source of truth: tsz/framework/theme.zig + tsz/carts/storybook/themes/*.zig.
 */

export type ThemeColors = {
  bg: string;
  bgAlt: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderFocus: string;
  text: string;
  textSecondary: string;
  textDim: string;
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  // Arbitrary additional tokens are allowed — carts can register their own.
  [key: string]: string;
};

export type StylePalette = {
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  spacingSm: number;
  spacingMd: number;
  spacingLg: number;
  borderThin: number;
  borderMedium: number;
  fontSm: number;
  fontMd: number;
  fontLg: number;
  [key: string]: number;
};

export type ThemePreset = {
  colors: ThemeColors;
  styles: StylePalette;
  variant?: string | null;
};

const rgb = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

// ── Style presets ─────────────────────────────────────────────

export const rounded_airy: StylePalette = {
  radiusSm: 4, radiusMd: 8, radiusLg: 16,
  spacingSm: 8, spacingMd: 16, spacingLg: 24,
  borderThin: 1, borderMedium: 2,
  fontSm: 11, fontMd: 13, fontLg: 18,
};

export const sharp_dense: StylePalette = {
  radiusSm: 0, radiusMd: 2, radiusLg: 4,
  spacingSm: 4, spacingMd: 8, spacingLg: 12,
  borderThin: 2, borderMedium: 3,
  fontSm: 10, fontMd: 12, fontLg: 16,
};

const catppuccin_mocha_styles: StylePalette = {
  radiusSm: 6, radiusMd: 8, radiusLg: 12,
  spacingSm: 6, spacingMd: 10, spacingLg: 14,
  borderThin: 1, borderMedium: 1,
  fontSm: 12, fontMd: 14, fontLg: 17,
};

const dracula_styles: StylePalette = {
  radiusSm: 4, radiusMd: 6, radiusLg: 10,
  spacingSm: 6, spacingMd: 10, spacingLg: 16,
  borderThin: 1, borderMedium: 2,
  fontSm: 12, fontMd: 14, fontLg: 18,
};

const tokyo_night_styles: StylePalette = {
  radiusSm: 3, radiusMd: 5, radiusLg: 8,
  spacingSm: 4, spacingMd: 8, spacingLg: 12,
  borderThin: 1, borderMedium: 1,
  fontSm: 12, fontMd: 14, fontLg: 16,
};

const nord_styles: StylePalette = {
  radiusSm: 4, radiusMd: 6, radiusLg: 10,
  spacingSm: 6, spacingMd: 10, spacingLg: 14,
  borderThin: 1, borderMedium: 1,
  fontSm: 12, fontMd: 14, fontLg: 17,
};

const solarized_dark_styles: StylePalette = {
  radiusSm: 3, radiusMd: 5, radiusLg: 8,
  spacingSm: 6, spacingMd: 10, spacingLg: 16,
  borderThin: 1, borderMedium: 2,
  fontSm: 12, fontMd: 14, fontLg: 18,
};

const gruvbox_dark_styles: StylePalette = {
  radiusSm: 4, radiusMd: 6, radiusLg: 10,
  spacingSm: 6, spacingMd: 10, spacingLg: 16,
  borderThin: 1, borderMedium: 2,
  fontSm: 12, fontMd: 14, fontLg: 18,
};

const bios_styles: StylePalette = {
  radiusSm: 0, radiusMd: 0, radiusLg: 0,
  spacingSm: 4, spacingMd: 8, spacingLg: 12,
  borderThin: 1, borderMedium: 1,
  fontSm: 12, fontMd: 14, fontLg: 16,
};

const win95_styles: StylePalette = {
  radiusSm: 0, radiusMd: 0, radiusLg: 0,
  spacingSm: 4, spacingMd: 6, spacingLg: 10,
  borderThin: 2, borderMedium: 3,
  fontSm: 11, fontMd: 13, fontLg: 16,
};

const winamp_styles: StylePalette = {
  radiusSm: 1, radiusMd: 2, radiusLg: 3,
  spacingSm: 2, spacingMd: 4, spacingLg: 8,
  borderThin: 1, borderMedium: 1,
  fontSm: 10, fontMd: 12, fontLg: 14,
};

const glass_styles: StylePalette = {
  radiusSm: 8, radiusMd: 12, radiusLg: 16,
  spacingSm: 6, spacingMd: 10, spacingLg: 16,
  borderThin: 1, borderMedium: 1,
  fontSm: 12, fontMd: 14, fontLg: 18,
};

// ── Color palettes ─────────────────────────────────────────────

export const catppuccin_mocha: ThemeColors = {
  bg: rgb(30, 30, 46), bgAlt: rgb(24, 24, 37), bgElevated: rgb(49, 50, 68),
  surface: rgb(49, 50, 68), surfaceHover: rgb(69, 71, 90),
  border: rgb(69, 71, 90), borderFocus: rgb(137, 180, 250),
  text: rgb(205, 214, 244), textSecondary: rgb(186, 194, 222), textDim: rgb(166, 173, 200),
  primary: rgb(137, 180, 250), primaryHover: rgb(116, 199, 236), primaryPressed: rgb(137, 220, 235),
  accent: rgb(203, 166, 247),
  error: rgb(243, 139, 168), warning: rgb(250, 179, 135), success: rgb(166, 227, 161), info: rgb(137, 220, 235),
};

export const catppuccin_macchiato: ThemeColors = {
  bg: rgb(36, 39, 58), bgAlt: rgb(30, 32, 48), bgElevated: rgb(54, 58, 79),
  surface: rgb(54, 58, 79), surfaceHover: rgb(73, 77, 100),
  border: rgb(73, 77, 100), borderFocus: rgb(138, 173, 244),
  text: rgb(202, 211, 245), textSecondary: rgb(184, 192, 224), textDim: rgb(165, 173, 203),
  primary: rgb(138, 173, 244), primaryHover: rgb(125, 196, 228), primaryPressed: rgb(145, 215, 227),
  accent: rgb(198, 160, 246),
  error: rgb(237, 135, 150), warning: rgb(245, 169, 127), success: rgb(166, 218, 149), info: rgb(145, 215, 227),
};

export const catppuccin_frappe: ThemeColors = {
  bg: rgb(48, 52, 70), bgAlt: rgb(41, 44, 60), bgElevated: rgb(65, 69, 89),
  surface: rgb(65, 69, 89), surfaceHover: rgb(81, 87, 109),
  border: rgb(81, 87, 109), borderFocus: rgb(140, 170, 238),
  text: rgb(198, 208, 245), textSecondary: rgb(181, 191, 226), textDim: rgb(165, 173, 206),
  primary: rgb(140, 170, 238), primaryHover: rgb(133, 193, 220), primaryPressed: rgb(153, 209, 219),
  accent: rgb(202, 158, 230),
  error: rgb(231, 130, 132), warning: rgb(239, 159, 118), success: rgb(166, 209, 137), info: rgb(153, 209, 219),
};

export const catppuccin_latte: ThemeColors = {
  bg: rgb(239, 241, 245), bgAlt: rgb(230, 233, 239), bgElevated: rgb(204, 208, 218),
  surface: rgb(204, 208, 218), surfaceHover: rgb(188, 192, 204),
  border: rgb(188, 192, 204), borderFocus: rgb(30, 102, 245),
  text: rgb(76, 79, 105), textSecondary: rgb(92, 95, 119), textDim: rgb(108, 111, 133),
  primary: rgb(30, 102, 245), primaryHover: rgb(32, 159, 181), primaryPressed: rgb(4, 165, 229),
  accent: rgb(136, 57, 239),
  error: rgb(210, 15, 57), warning: rgb(254, 100, 11), success: rgb(64, 160, 43), info: rgb(4, 165, 229),
};

export const dracula: ThemeColors = {
  bg: rgb(40, 42, 54), bgAlt: rgb(33, 34, 44), bgElevated: rgb(68, 71, 90),
  surface: rgb(68, 71, 90), surfaceHover: rgb(77, 80, 94),
  border: rgb(68, 71, 90), borderFocus: rgb(189, 147, 249),
  text: rgb(248, 248, 242), textSecondary: rgb(191, 191, 191), textDim: rgb(98, 114, 164),
  primary: rgb(189, 147, 249), primaryHover: rgb(202, 164, 250), primaryPressed: rgb(212, 181, 251),
  accent: rgb(255, 121, 198),
  error: rgb(255, 85, 85), warning: rgb(255, 184, 108), success: rgb(80, 250, 123), info: rgb(139, 233, 253),
};

export const dracula_soft: ThemeColors = {
  bg: rgb(45, 47, 63), bgAlt: rgb(37, 39, 55), bgElevated: rgb(68, 71, 90),
  surface: rgb(68, 71, 90), surfaceHover: rgb(77, 80, 94),
  border: rgb(68, 71, 90), borderFocus: rgb(189, 147, 249),
  text: rgb(242, 242, 232), textSecondary: rgb(184, 184, 176), textDim: rgb(98, 114, 164),
  primary: rgb(189, 147, 249), primaryHover: rgb(202, 164, 250), primaryPressed: rgb(212, 181, 251),
  accent: rgb(255, 121, 198),
  error: rgb(255, 85, 85), warning: rgb(255, 184, 108), success: rgb(80, 250, 123), info: rgb(139, 233, 253),
};

export const gruvbox_dark: ThemeColors = {
  bg: rgb(40, 40, 40), bgAlt: rgb(60, 56, 54), bgElevated: rgb(80, 73, 69),
  surface: rgb(60, 56, 54), surfaceHover: rgb(80, 73, 69),
  border: rgb(80, 73, 69), borderFocus: rgb(131, 165, 152),
  text: rgb(235, 219, 178), textSecondary: rgb(213, 196, 161), textDim: rgb(146, 131, 116),
  primary: rgb(131, 165, 152), primaryHover: rgb(142, 192, 124), primaryPressed: rgb(184, 187, 38),
  accent: rgb(211, 134, 155),
  error: rgb(251, 73, 52), warning: rgb(254, 128, 25), success: rgb(184, 187, 38), info: rgb(131, 165, 152),
};

export const gruvbox_light: ThemeColors = {
  bg: rgb(251, 241, 199), bgAlt: rgb(235, 219, 178), bgElevated: rgb(213, 196, 161),
  surface: rgb(235, 219, 178), surfaceHover: rgb(213, 196, 161),
  border: rgb(213, 196, 161), borderFocus: rgb(7, 102, 120),
  text: rgb(60, 56, 54), textSecondary: rgb(80, 73, 69), textDim: rgb(146, 131, 116),
  primary: rgb(7, 102, 120), primaryHover: rgb(66, 123, 88), primaryPressed: rgb(121, 116, 14),
  accent: rgb(143, 63, 113),
  error: rgb(157, 0, 6), warning: rgb(175, 58, 3), success: rgb(121, 116, 14), info: rgb(7, 102, 120),
};

export const nord: ThemeColors = {
  bg: rgb(46, 52, 64), bgAlt: rgb(59, 66, 82), bgElevated: rgb(67, 76, 94),
  surface: rgb(59, 66, 82), surfaceHover: rgb(67, 76, 94),
  border: rgb(67, 76, 94), borderFocus: rgb(136, 192, 208),
  text: rgb(236, 239, 244), textSecondary: rgb(216, 222, 233), textDim: rgb(76, 86, 106),
  primary: rgb(136, 192, 208), primaryHover: rgb(143, 188, 187), primaryPressed: rgb(129, 161, 193),
  accent: rgb(180, 142, 173),
  error: rgb(191, 97, 106), warning: rgb(208, 135, 112), success: rgb(163, 190, 140), info: rgb(94, 129, 172),
};

export const nord_light: ThemeColors = {
  bg: rgb(236, 239, 244), bgAlt: rgb(229, 233, 240), bgElevated: rgb(216, 222, 233),
  surface: rgb(216, 222, 233), surfaceHover: rgb(229, 233, 240),
  border: rgb(216, 222, 233), borderFocus: rgb(94, 129, 172),
  text: rgb(46, 52, 64), textSecondary: rgb(59, 66, 82), textDim: rgb(76, 86, 106),
  primary: rgb(94, 129, 172), primaryHover: rgb(129, 161, 193), primaryPressed: rgb(136, 192, 208),
  accent: rgb(180, 142, 173),
  error: rgb(191, 97, 106), warning: rgb(208, 135, 112), success: rgb(163, 190, 140), info: rgb(94, 129, 172),
};

export const one_dark: ThemeColors = {
  bg: rgb(40, 44, 52), bgAlt: rgb(33, 37, 43), bgElevated: rgb(44, 49, 58),
  surface: rgb(44, 49, 58), surfaceHover: rgb(51, 56, 66),
  border: rgb(62, 68, 82), borderFocus: rgb(97, 175, 239),
  text: rgb(171, 178, 191), textSecondary: rgb(157, 165, 180), textDim: rgb(92, 99, 112),
  primary: rgb(97, 175, 239), primaryHover: rgb(86, 182, 194), primaryPressed: rgb(152, 195, 121),
  accent: rgb(198, 120, 221),
  error: rgb(224, 108, 117), warning: rgb(209, 154, 102), success: rgb(152, 195, 121), info: rgb(86, 182, 194),
};

export const rose_pine: ThemeColors = {
  bg: rgb(25, 23, 36), bgAlt: rgb(31, 29, 46), bgElevated: rgb(38, 35, 58),
  surface: rgb(31, 29, 46), surfaceHover: rgb(38, 35, 58),
  border: rgb(38, 35, 58), borderFocus: rgb(49, 116, 143),
  text: rgb(224, 222, 244), textSecondary: rgb(144, 140, 170), textDim: rgb(110, 106, 134),
  primary: rgb(49, 116, 143), primaryHover: rgb(156, 207, 216), primaryPressed: rgb(235, 188, 186),
  accent: rgb(196, 167, 231),
  error: rgb(235, 111, 146), warning: rgb(246, 193, 119), success: rgb(49, 116, 143), info: rgb(156, 207, 216),
};

export const rose_pine_dawn: ThemeColors = {
  bg: rgb(250, 244, 237), bgAlt: rgb(255, 250, 243), bgElevated: rgb(242, 233, 225),
  surface: rgb(255, 250, 243), surfaceHover: rgb(242, 233, 225),
  border: rgb(223, 218, 217), borderFocus: rgb(40, 105, 131),
  text: rgb(87, 82, 121), textSecondary: rgb(121, 117, 147), textDim: rgb(152, 147, 165),
  primary: rgb(40, 105, 131), primaryHover: rgb(86, 148, 159), primaryPressed: rgb(215, 130, 126),
  accent: rgb(144, 122, 169),
  error: rgb(180, 99, 122), warning: rgb(234, 157, 52), success: rgb(40, 105, 131), info: rgb(86, 148, 159),
};

export const solarized_dark: ThemeColors = {
  bg: rgb(0, 43, 54), bgAlt: rgb(7, 54, 66), bgElevated: rgb(7, 54, 66),
  surface: rgb(7, 54, 66), surfaceHover: rgb(7, 54, 66),
  border: rgb(88, 110, 117), borderFocus: rgb(38, 139, 210),
  text: rgb(131, 148, 150), textSecondary: rgb(147, 161, 161), textDim: rgb(88, 110, 117),
  primary: rgb(38, 139, 210), primaryHover: rgb(42, 161, 152), primaryPressed: rgb(133, 153, 0),
  accent: rgb(108, 113, 196),
  error: rgb(220, 50, 47), warning: rgb(203, 75, 22), success: rgb(133, 153, 0), info: rgb(42, 161, 152),
};

export const solarized_light: ThemeColors = {
  bg: rgb(253, 246, 227), bgAlt: rgb(238, 232, 213), bgElevated: rgb(238, 232, 213),
  surface: rgb(238, 232, 213), surfaceHover: rgb(238, 232, 213),
  border: rgb(147, 161, 161), borderFocus: rgb(38, 139, 210),
  text: rgb(101, 123, 131), textSecondary: rgb(88, 110, 117), textDim: rgb(147, 161, 161),
  primary: rgb(38, 139, 210), primaryHover: rgb(42, 161, 152), primaryPressed: rgb(133, 153, 0),
  accent: rgb(108, 113, 196),
  error: rgb(220, 50, 47), warning: rgb(203, 75, 22), success: rgb(133, 153, 0), info: rgb(42, 161, 152),
};

export const tokyo_night: ThemeColors = {
  bg: rgb(26, 27, 38), bgAlt: rgb(22, 22, 30), bgElevated: rgb(36, 40, 59),
  surface: rgb(36, 40, 59), surfaceHover: rgb(41, 46, 66),
  border: rgb(41, 46, 66), borderFocus: rgb(122, 162, 247),
  text: rgb(192, 202, 245), textSecondary: rgb(169, 177, 214), textDim: rgb(86, 95, 137),
  primary: rgb(122, 162, 247), primaryHover: rgb(125, 207, 255), primaryPressed: rgb(42, 195, 222),
  accent: rgb(187, 154, 247),
  error: rgb(247, 118, 142), warning: rgb(224, 175, 104), success: rgb(158, 206, 106), info: rgb(125, 207, 255),
};

export const tokyo_night_storm: ThemeColors = {
  bg: rgb(36, 40, 59), bgAlt: rgb(31, 35, 53), bgElevated: rgb(41, 46, 66),
  surface: rgb(41, 46, 66), surfaceHover: rgb(52, 59, 88),
  border: rgb(52, 59, 88), borderFocus: rgb(122, 162, 247),
  text: rgb(192, 202, 245), textSecondary: rgb(169, 177, 214), textDim: rgb(86, 95, 137),
  primary: rgb(122, 162, 247), primaryHover: rgb(125, 207, 255), primaryPressed: rgb(42, 195, 222),
  accent: rgb(187, 154, 247),
  error: rgb(247, 118, 142), warning: rgb(224, 175, 104), success: rgb(158, 206, 106), info: rgb(125, 207, 255),
};

export const bios: ThemeColors = {
  bg: rgb(0, 0, 170), bgAlt: rgb(0, 0, 136), bgElevated: rgb(17, 17, 187),
  surface: rgb(0, 0, 136), surfaceHover: rgb(0, 0, 170),
  border: rgb(85, 85, 85), borderFocus: rgb(0, 170, 170),
  text: rgb(170, 170, 170), textSecondary: rgb(136, 136, 136), textDim: rgb(85, 85, 85),
  primary: rgb(0, 170, 170), primaryHover: rgb(85, 255, 255), primaryPressed: rgb(255, 255, 255),
  accent: rgb(255, 255, 85),
  error: rgb(255, 85, 85), warning: rgb(255, 170, 0), success: rgb(85, 255, 85), info: rgb(85, 255, 255),
};

export const win95: ThemeColors = {
  bg: rgb(192, 192, 192), bgAlt: rgb(160, 160, 160), bgElevated: rgb(223, 223, 223),
  surface: rgb(255, 255, 255), surfaceHover: rgb(232, 232, 232),
  border: rgb(128, 128, 128), borderFocus: rgb(0, 0, 128),
  text: rgb(0, 0, 0), textSecondary: rgb(64, 64, 64), textDim: rgb(128, 128, 128),
  primary: rgb(0, 0, 128), primaryHover: rgb(128, 0, 176), primaryPressed: rgb(160, 32, 240),
  accent: rgb(153, 0, 204),
  error: rgb(255, 0, 0), warning: rgb(255, 136, 0), success: rgb(0, 128, 0), info: rgb(0, 0, 255),
};

export const winamp: ThemeColors = {
  bg: rgb(18, 18, 18), bgAlt: rgb(28, 28, 28), bgElevated: rgb(40, 40, 40),
  surface: rgb(32, 32, 32), surfaceHover: rgb(48, 48, 48),
  border: rgb(64, 64, 64), borderFocus: rgb(0, 255, 0),
  text: rgb(0, 255, 0), textSecondary: rgb(0, 204, 0), textDim: rgb(0, 128, 0),
  primary: rgb(0, 255, 0), primaryHover: rgb(102, 255, 102), primaryPressed: rgb(204, 255, 0),
  accent: rgb(255, 153, 0),
  error: rgb(255, 51, 51), warning: rgb(255, 204, 0), success: rgb(0, 255, 0), info: rgb(51, 204, 255),
};

export const glass: ThemeColors = {
  bg: rgb(15, 20, 30), bgAlt: rgb(25, 32, 45), bgElevated: rgb(40, 50, 68),
  surface: rgb(35, 45, 60), surfaceHover: rgb(50, 62, 80),
  border: rgb(80, 110, 150), borderFocus: rgb(100, 180, 255),
  text: rgb(235, 240, 255), textSecondary: rgb(180, 195, 220), textDim: rgb(120, 140, 170),
  primary: rgb(100, 180, 255), primaryHover: rgb(140, 200, 255), primaryPressed: rgb(180, 220, 255),
  accent: rgb(160, 140, 255),
  error: rgb(255, 100, 120), warning: rgb(255, 200, 100), success: rgb(100, 230, 180), info: rgb(120, 200, 255),
};

// ── Registry ─────────────────────────────────────────────

export type ThemeEntry = {
  name: string;
  colors: ThemeColors;
  styles?: StylePalette;
};

/** All standard themes in display order. Matches tsz/carts/storybook/themes/registry.zig. */
export const themes: ThemeEntry[] = [
  { name: 'Catppuccin Mocha',     colors: catppuccin_mocha,     styles: catppuccin_mocha_styles },
  { name: 'Catppuccin Macchiato', colors: catppuccin_macchiato },
  { name: 'Catppuccin Frappe',    colors: catppuccin_frappe },
  { name: 'Catppuccin Latte',     colors: catppuccin_latte },
  { name: 'Dracula',              colors: dracula,              styles: dracula_styles },
  { name: 'Dracula Soft',         colors: dracula_soft },
  { name: 'Gruvbox Dark',         colors: gruvbox_dark,         styles: gruvbox_dark_styles },
  { name: 'Gruvbox Light',        colors: gruvbox_light },
  { name: 'Nord',                 colors: nord,                 styles: nord_styles },
  { name: 'Nord Light',           colors: nord_light },
  { name: 'One Dark',             colors: one_dark },
  { name: 'Rose Pine',            colors: rose_pine },
  { name: 'Rose Pine Dawn',       colors: rose_pine_dawn },
  { name: 'Solarized Dark',       colors: solarized_dark,       styles: solarized_dark_styles },
  { name: 'Solarized Light',      colors: solarized_light },
  { name: 'Tokyo Night',          colors: tokyo_night,          styles: tokyo_night_styles },
  { name: 'Tokyo Night Storm',    colors: tokyo_night_storm },
  { name: 'BIOS',                 colors: bios,                 styles: bios_styles },
  { name: 'Win95 Vaporwave',      colors: win95,                styles: win95_styles },
  { name: 'Winamp',               colors: winamp,               styles: winamp_styles },
  { name: 'Glass',                colors: glass,                styles: glass_styles },
];

/** Find a theme by case-insensitive name match. */
export function findTheme(name: string): ThemeEntry | null {
  const lower = name.toLowerCase();
  for (const t of themes) {
    if (t.name.toLowerCase() === lower) return t;
  }
  return null;
}
