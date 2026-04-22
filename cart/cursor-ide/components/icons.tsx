const React: any = require('react');

import { Box, Col, Row, Text } from '../../../runtime/primitives';

export type IconName = string;

export const ICON_GLYPHS: Record<string, string> = {
  folder: '🗀',
  file: '🗋',
};

function resolveIconGlyph(name: string): string {
  return ICON_GLYPHS[name] || '?';
}

export function Icon(props: { name: IconName; size?: number; color?: string }) {
  const size = props.size ?? 16;
  const glyph = resolveIconGlyph(props.name);
  return (
    <Box
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text
        fontSize={Math.max(10, Math.floor(size * 0.9))}
        color={props.color || '#ccc'}
        style={{
          lineHeight: size,
          textAlign: 'center',
        }}
      >
        {glyph}
      </Text>
    </Box>
  );
}

export function IconGallery() {
  return <Box />;
}
