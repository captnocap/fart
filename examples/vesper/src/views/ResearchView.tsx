/**
 * ResearchView — Multi-step research with 3D visualization (Phase 9).
 * Placeholder for now — will integrate @reactjit/3d Scene + OrbitCamera.
 */

import React from 'react';
import { Box, Text } from '@reactjit/core';
import { V } from '../theme';

export function ResearchView() {
  return (
    <Box style={{
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    }}>
      <Text style={{ fontSize: 24, color: V.accent, fontWeight: '700' }}>
        {'\u25CB'}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: V.text }}>
        Research
      </Text>
      <Text style={{ fontSize: 13, color: V.textDim }}>
        Deep research mode coming soon
      </Text>
    </Box>
  );
}
