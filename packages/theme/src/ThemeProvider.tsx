import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useBridgeOptional, ThemeColorsContext } from '@ilovereact/core';
import { themes, defaultThemeId } from './themes';
import type { ThemeContextValue } from './types';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  theme: initialTheme,
  children,
}: {
  theme?: string;
  children: React.ReactNode;
}) {
  const bridge = useBridgeOptional();
  const [themeId, setThemeIdState] = useState(initialTheme ?? defaultThemeId);

  const setTheme = useCallback(
    (id: string) => {
      if (!themes[id]) return;
      setThemeIdState(id);
      if (bridge) {
        bridge.send('theme:set', { name: id });
        bridge.flush();
      }
    },
    [bridge],
  );

  // Send initial theme to Lua on mount
  useEffect(() => {
    if (bridge) {
      bridge.send('theme:set', { name: themeId });
      bridge.flush();
    }
  }, [bridge]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolved = themes[themeId] ?? themes[defaultThemeId];

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      setTheme,
      colors: resolved.colors,
      typography: resolved.typography,
      spacing: resolved.spacing,
      radii: resolved.radii,
    }),
    [themeId, setTheme, resolved],
  );

  // Build a flat Record<string, string> of all color tokens for primitive resolution.
  // Includes top-level semantic tokens (bg, primary, etc.) and palette entries.
  const colorTokens = useMemo<Record<string, string>>(() => {
    const tokens: Record<string, string> = {};
    const { palette, ...semantic } = resolved.colors;
    for (const [k, v] of Object.entries(semantic)) {
      tokens[k] = v as string;
    }
    if (palette) {
      for (const [k, v] of Object.entries(palette)) {
        tokens[k] = v;
      }
    }
    return tokens;
  }, [resolved.colors]);

  return React.createElement(
    ThemeContext.Provider,
    { value },
    React.createElement(ThemeColorsContext.Provider, { value: colorTokens }, children),
  );
}
