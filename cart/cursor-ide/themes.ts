// Theme token system for cursor-ide.
// Three built-in themes: 'sharp' (terminal-feel, square, high contrast),
// 'soft' (the previous default, lightly tuned, crisp corners),
// 'studio' (pro-tool muted, tight density, square).
//
// A theme is a flat token map. Components read tokens from the live `TOKENS`
// object and palette via the live `COLORS` object (both re-exported from
// theme.ts). Switching theme rewrites those objects in place and notifies
// subscribers so the app re-renders against the new values.

export type Corner = 'square' | 'soft' | 'round';
export type Density = 'compact' | 'comfortable';

export type ThemePalette = {
  appBg: string;
  panelBg: string;
  panelRaised: string;
  panelAlt: string;
  panelHover: string;
  border: string;
  borderSoft: string;
  text: string;
  textBright: string;
  textDim: string;
  textMuted: string;
  blue: string;
  blueDeep: string;
  green: string;
  greenDeep: string;
  yellow: string;
  yellowDeep: string;
  orange: string;
  orangeDeep: string;
  red: string;
  redDeep: string;
  purple: string;
  purpleDeep: string;
  grayChip: string;
  grayDeep: string;
};

export type ThemeTokens = {
  name: string;
  label: string;
  corner: Corner;
  density: Density;
  // radius scale — keep `md` the common default (2–3 is crisp, not bubbly)
  radiusNone: number;
  radiusXs: number;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusPill: number;
  // spacing scale
  spaceXxs: number;
  spaceXs: number;
  spaceSm: number;
  spaceMd: number;
  spaceLg: number;
  spaceXl: number;
  spaceXxl: number;
  // padding defaults (per-density tuned)
  padTight: number;
  padNormal: number;
  padLoose: number;
  rowHeight: number;
  chromeHeight: number;
  // borders + shadow depth
  borderW: number;
  shadowDepth: number; // 0 = none, 1 = low, 2 = mid, 3 = high
  // type
  fontUI: string;
  fontMono: string;
  fontXs: number;
  fontSm: number;
  fontMd: number;
  fontLg: number;
  fontXl: number;
};

export type Theme = {
  tokens: ThemeTokens;
  palette: ThemePalette;
};

// 'soft' — tuned version of the previous default. Crisp 3px corners
// (previous default was 10px). Comfortable density.
export const THEME_SOFT: Theme = {
  tokens: {
    name: 'soft',
    label: 'Soft',
    corner: 'soft',
    density: 'comfortable',
    radiusNone: 0,
    radiusXs: 1,
    radiusSm: 2,
    radiusMd: 3,
    radiusLg: 5,
    radiusPill: 9999,
    spaceXxs: 2,
    spaceXs: 4,
    spaceSm: 6,
    spaceMd: 10,
    spaceLg: 14,
    spaceXl: 20,
    spaceXxl: 28,
    padTight: 4,
    padNormal: 8,
    padLoose: 12,
    rowHeight: 24,
    chromeHeight: 32,
    borderW: 1,
    shadowDepth: 1,
    fontUI: 'system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 13,
    fontLg: 15,
    fontXl: 18,
  },
  palette: {
    appBg: '#090d13',
    panelBg: '#0d1015',
    panelRaised: '#10151d',
    panelAlt: '#11161f',
    panelHover: '#121a24',
    border: '#1f2935',
    borderSoft: '#18202b',
    text: '#c9d2df',
    textBright: '#eef2f8',
    textDim: '#5d6a7c',
    textMuted: '#8ca0b8',
    blue: '#79c0ff',
    blueDeep: '#10213d',
    green: '#7ee787',
    greenDeep: '#102214',
    yellow: '#e6b450',
    yellowDeep: '#332200',
    orange: '#ffa657',
    orangeDeep: '#331608',
    red: '#ff7b72',
    redDeep: '#341316',
    purple: '#d2a8ff',
    purpleDeep: '#241233',
    grayChip: '#1d2330',
    grayDeep: '#1a1f2b',
  },
};

// 'sharp' — square corners, terminal aesthetic, higher contrast, thin
// hairline borders, no shadows. Mono everywhere.
export const THEME_SHARP: Theme = {
  tokens: {
    name: 'sharp',
    label: 'Sharp',
    corner: 'square',
    density: 'compact',
    radiusNone: 0,
    radiusXs: 0,
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    spaceXxs: 2,
    spaceXs: 3,
    spaceSm: 5,
    spaceMd: 8,
    spaceLg: 12,
    spaceXl: 16,
    spaceXxl: 24,
    padTight: 3,
    padNormal: 6,
    padLoose: 10,
    rowHeight: 22,
    chromeHeight: 28,
    borderW: 1,
    shadowDepth: 0,
    fontUI: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 14,
    fontXl: 17,
  },
  palette: {
    appBg: '#000000',
    panelBg: '#05080c',
    panelRaised: '#0a0f16',
    panelAlt: '#0a0f16',
    panelHover: '#101722',
    border: '#2a3644',
    borderSoft: '#1a2230',
    text: '#d6dde6',
    textBright: '#ffffff',
    textDim: '#5a6577',
    textMuted: '#8998ad',
    blue: '#6ed0ff',
    blueDeep: '#071a33',
    green: '#7ef0a0',
    greenDeep: '#0a1f10',
    yellow: '#f0c050',
    yellowDeep: '#2a1e00',
    orange: '#ffae5c',
    orangeDeep: '#2a1208',
    red: '#ff6d63',
    redDeep: '#2a0e12',
    purple: '#e1b4ff',
    purpleDeep: '#1e0e2a',
    grayChip: '#161d28',
    grayDeep: '#141a24',
  },
};

// 'studio' — pro-tool muted palette, tight density, square corners,
// neutral greys, desaturated accents.
export const THEME_STUDIO: Theme = {
  tokens: {
    name: 'studio',
    label: 'Studio',
    corner: 'square',
    density: 'compact',
    radiusNone: 0,
    radiusXs: 1,
    radiusSm: 2,
    radiusMd: 2,
    radiusLg: 3,
    radiusPill: 9999,
    spaceXxs: 2,
    spaceXs: 3,
    spaceSm: 5,
    spaceMd: 8,
    spaceLg: 12,
    spaceXl: 16,
    spaceXxl: 22,
    padTight: 3,
    padNormal: 6,
    padLoose: 9,
    rowHeight: 22,
    chromeHeight: 28,
    borderW: 1,
    shadowDepth: 1,
    fontUI: 'Inter, system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 14,
    fontXl: 16,
  },
  palette: {
    appBg: '#1a1c20',
    panelBg: '#1e2025',
    panelRaised: '#23262c',
    panelAlt: '#20232a',
    panelHover: '#282c33',
    border: '#32363f',
    borderSoft: '#282c33',
    text: '#b8bcc4',
    textBright: '#e4e6eb',
    textDim: '#6a6f78',
    textMuted: '#8a8f98',
    blue: '#82a8c8',
    blueDeep: '#1a2633',
    green: '#8aae8a',
    greenDeep: '#1a2820',
    yellow: '#c8a868',
    yellowDeep: '#2a2010',
    orange: '#c8936a',
    orangeDeep: '#2a1a10',
    red: '#c87878',
    redDeep: '#2a1418',
    purple: '#a898c8',
    purpleDeep: '#20182a',
    grayChip: '#2a2d34',
    grayDeep: '#24272d',
  },
};

export const THEMES: Record<string, Theme> = {
  soft: THEME_SOFT,
  sharp: THEME_SHARP,
  studio: THEME_STUDIO,
};

export const THEME_ORDER = ['soft', 'sharp', 'studio'];
