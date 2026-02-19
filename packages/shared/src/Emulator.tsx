/**
 * <Emulator> — NES emulation surface primitive
 *
 * Renders a NES ROM via the Agnes emulator core into a Canvas at layout position.
 * Native only — returns null in web mode.
 *
 * Usage:
 *   <Emulator src="zelda.nes" playing />
 *   <Emulator src="mario.nes" style={{ width: 512, height: 480 }} />
 */

import React from 'react';
import { useRendererMode } from './context';
import { useScaledStyle } from './ScaleContext';
import type { EmulatorProps, Style } from './types';

/** Build a Style from Emulator shorthand props. style={} overrides. */
function resolveEmulatorStyle(props: EmulatorProps): Style | undefined {
  const { w, h, style } = props;

  if (w === undefined && h === undefined) {
    return style;
  }

  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;

  return style ? { ...base, ...style } : base;
}

export function Emulator(props: EmulatorProps) {
  const { src, playing = true } = props;
  const resolvedStyle = resolveEmulatorStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);
  const mode = useRendererMode();

  if (mode === 'web') return null;

  return React.createElement('Emulator', {
    src,
    playing,
    style: scaledStyle,
  });
}
