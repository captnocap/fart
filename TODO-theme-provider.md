# TODO: @ilovereact/theme — Full Theme System with Provider, Shaders, and Built-in Palettes

## Vision

A `<ThemeProvider>` that works like dark/light mode switching but for entire visual identities — colors, typography, spacing, border radii, shadows, and eventually shaders and sprite maps. Ship with curated palettes (Catppuccin, Dracula, Nord, etc.), let users define their own, and make it trivial to drop into any app.

## What's done

### Phase 1: Theme package + provider + context ✅

- `packages/theme/` — new `@ilovereact/theme` package
- `ThemeProvider` — React context, sends `theme:set` to Lua bridge on mount/switch
- `useTheme()` — returns `{ themeId, setTheme, colors }`
- `useThemeColors()` — shorthand, returns just the semantic color tokens
- `createTheme()` — factory with `extends` support for custom themes
- `registerTheme()` — register custom themes at runtime
- Registered in `tsconfig.base.json`, `package.json` workspaces, `Makefile` cli-setup

### Phase 2: Built-in palettes (17 themes) ✅

All themes defined in both TypeScript (IDE autocomplete) and Lua (runtime):

| Theme | Family | Style |
|-------|--------|-------|
| `catppuccin-latte` | Catppuccin | Light, pastel warm |
| `catppuccin-frappe` | Catppuccin | Mid-dark, muted |
| `catppuccin-macchiato` | Catppuccin | Dark, balanced |
| `catppuccin-mocha` | Catppuccin | Darkest, **default** |
| `dracula` | Dracula | Dark, saturated purples/greens |
| `dracula-soft` | Dracula | Softer contrast variant |
| `nord` | Nord | Cool blue-grey, arctic |
| `nord-light` | Nord | Light variant |
| `gruvbox-dark` | Gruvbox | Warm retro dark |
| `gruvbox-light` | Gruvbox | Warm retro light |
| `tokyo-night` | Tokyo Night | Dark, neon accents |
| `tokyo-night-storm` | Tokyo Night | Slightly lighter variant |
| `one-dark` | One Dark | Classic dark IDE |
| `solarized-dark` | Solarized | Precision-engineered dark |
| `solarized-light` | Solarized | Precision-engineered light |
| `rose-pine` | Rosé Pine | Dark, muted, elegant |
| `rose-pine-dawn` | Rosé Pine | Light variant |

TypeScript: `packages/theme/src/themes/` (one file per family + index)
Lua: `lua/themes/` (one file per family + init.lua loader)

### Phase 3: Lua bridge integration ✅

- `lua/init.lua` — `theme:set` command handler in the command routing loop
- Theme state: `currentThemeName`, `currentTheme` (table reference)
- Public API: `ReactLove.getTheme()`, `ReactLove.getThemeName()`, `ReactLove.getThemes()`
- `tree.markDirty()` on theme switch to force repaint
- `Makefile` syncs `lua/themes/` to `cli/runtime/` and dist staging

### Phase 4: Storybook integration ✅

- `native-main.tsx` wrapped in `<ThemeProvider>`
- Storybook chrome (sidebar, tab bar, content area) uses `useThemeColors()`
- Theme cycling button in tab bar (click to cycle through all 17 themes)
- `ThemeStory` — showcase story with color swatches, click-to-switch cards

### Phase 5: Story migration to theme tokens 🔄 (in progress)

Migrating all 71 story files from hardcoded hex colors to `useThemeColors()` tokens.
This ensures the storybook — which IS the framework reference — demonstrates proper theme usage.

Semantic token mapping:
- Container backgrounds → `c.bg`, `c.bgElevated`, `c.surface`
- Text colors → `c.text`, `c.textSecondary`, `c.textDim`
- Borders → `c.border`
- Actions → `c.primary`, `c.accent`, `c.error`, `c.success`, `c.warning`, `c.info`
- Decorative colors (chart data, rainbow arrays, brand-specific) stay hardcoded

---

## What's NOT done yet

### Theme shape: typography, spacing, radii, shadows

The current `Theme` interface only has `colors`. The original plan included:

```typescript
typography: {
  fontFamily?: string;
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontWeight: { normal: string; medium: string; bold: string };
  lineHeight: { tight: number; normal: number; relaxed: number };
};
spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
radii: { none: number; sm: number; md: number; lg: number; full: number };
shadows: { sm: ShadowDef; md: ShadowDef; lg: ShadowDef };
```

These would let themes control sizing and shape, not just color. A "compact" theme could have tighter spacing. A "rounded" theme could have large radii everywhere.

### Component-level theme integration (primitives read from theme)

Box/Text shorthand props that resolve against theme context:

```tsx
// Token-based props that resolve against active theme
<Box bg="primary" borderColor="border" p="md" radius="lg">
  <Text color="text" size="md" weight="bold">Title</Text>
</Box>
```

This means `bg="primary"` resolves to `theme.colors.primary` automatically. Currently stories call `useThemeColors()` and pass `c.primary` explicitly — the shorthand would be a DX improvement.

### ThemeSwitcher component

A drop-in component for any app:

```tsx
import { ThemeSwitcher } from '@ilovereact/theme';
<ThemeSwitcher position="bottom-right" />  // floating pill
<ThemeSwitcher inline />                    // settings row
```

Shows preview swatches, current theme highlighted, click to switch.

### Shaders (Love2D GLSL post-processing)

Themes define post-processing shaders applied to the entire viewport:

- **CRT/retro** — scanlines, curvature, bloom
- **Frosted glass** — blur behind overlays/modals
- **Color grading** — per-theme LUT / curve adjustment
- **Glow/neon** — bloom on bright colors for cyberpunk themes
- **Pixel/mosaic** — downsample for retro aesthetics
- **Vignette** — edge darkening

Implementation: `lua/theme_shaders.lua` compiles GLSL from theme defs, painter applies as post-process canvas effect.

```lua
if currentTheme.shader then
  love.graphics.setShader(compiledShader)
  -- draw to canvas
  love.graphics.setShader()
end
```

### Sprite map theming

Themes override UI elements with sprite sheets:

- Pixel art buttons, checkboxes, scrollbars from a sprite atlas
- Handdrawn theme with sketchy borders
- Terminal theme rendering everything as character cells

Painter checks `currentTheme.sprites` and renders sprite quads instead of Box geometry.

### Animated theme transitions

Smooth interpolation between themes using the existing spring animation system:

```tsx
setTheme('dracula', { animated: true, duration: 300 });
```

All color tokens animate over 300ms. Requires interpolating hex colors in Lua.

### Reactive/auto themes

- **Time-based** — auto-switch light/dark based on time of day
- **System-based** — respect OS dark mode preference
- **State-based** — theme shifts with app state (error tints UI red, etc.)

```tsx
<ThemeProvider theme="auto" light="catppuccin-latte" dark="catppuccin-mocha">
```

### Refactor `packages/shared/src/colors.ts`

The static Catppuccin Mocha palette export still exists. Could be made dynamic (re-exports from active theme) or deprecated in favor of `useThemeColors()`.

---

## Priority for remaining work

1. **Finish story migration** — in progress, agents running
2. **Typography/spacing/radii in theme shape** — expands what themes can control
3. **Component-level shorthand props** — `bg="primary"` resolution
4. **ThemeSwitcher component** — user-facing convenience
5. **Animated transitions** — polish
6. **Shaders** — Love2D wow factor
7. **Sprite maps** — advanced theming
8. **Reactive/auto themes** — convenience

---

## Architecture notes (from the dev)

**Theme definitions live in Lua.** React only needs the theme ID string.

Flow:
1. React: `setTheme('dracula')`
2. Bridge sends: `{ type: 'theme:set', payload: { name: 'dracula' } }`
3. Lua: switches `currentTheme` table pointer
4. Lua painter reads from `currentTheme.colors.primary` on the next frame
5. Zero deserialization, zero object construction, just table lookups

TypeScript definitions exist purely for IDE autocomplete. The actual theme data is Lua tables.

Benefits:
- Zero serialization cost
- No bridge overhead on theme switch
- Shader compilation happens once per theme, not per frame
- Sprite map lookups are just table indexing
- IDE autocomplete in React via TypeScript
- All heavy lifting happens where it's cheap (Lua)
