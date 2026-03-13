/**
 * TerminalView — PTY terminal (Phase 8).
 * Placeholder for now — will integrate usePTY + SemanticTerminal.
 */

import React from 'react';
import { Box, Text } from '@reactjit/core';
import { V } from '../theme';

export function TerminalView() {
  return (
    <Box style={{
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    }}>
      <Text style={{ fontSize: 24, color: V.accent, fontWeight: '700' }}>
        {'\u25B7'}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: V.text }}>
        Terminal
      </Text>
      <Text style={{ fontSize: 13, color: V.textDim }}>
        PTY sessions coming soon
      </Text>
    </Box>
  );
}
