import { Box, Row, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';
import { classifiers as S } from '@reactjit/core';

export function StuckAlert({ label }: { label: string }) {
  return (
    <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, backgroundColor: '#3a2a1e', borderRadius: 3 }}>
      <S.InlineX2>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.orange }}>!</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.orange }}>{label}</Text>
      </S.InlineX2>
    </Box>
  );
}

