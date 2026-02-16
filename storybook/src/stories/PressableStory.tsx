import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/shared/src';

export function PressableStory() {
  const [pressCount, setPressCount] = useState(0);
  const [lastAction, setLastAction] = useState('none');

  return (
    <Box style={{ gap: 20, padding: 20 }}>

      {/* Primary buttons */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Primary</Text>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => {
              setPressCount(c => c + 1);
              setLastAction('press');
            }}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#1d4ed8' : hovered ? '#2563eb' : '#3b82f6',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            {({ pressed, hovered }) => (
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                {pressed ? 'Pressing...' : hovered ? 'Hovering!' : 'Press me'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setLastAction('success')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#16a34a' : hovered ? '#22c55e' : '#15803d',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Confirm</Text>
          </Pressable>

          <Pressable
            onPress={() => setLastAction('danger')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#b91c1c' : hovered ? '#dc2626' : '#ef4444',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Secondary / outlined buttons */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Secondary</Text>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => setLastAction('secondary')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#334155' : hovered ? '#1e293b' : 'transparent',
              borderWidth: 1,
              borderColor: hovered ? '#64748b' : '#334155',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#e2e8f0', fontSize: 14 }}>Outlined</Text>
          </Pressable>

          <Pressable
            onPress={() => setLastAction('ghost')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#1e293b' : hovered ? '#0f172a' : 'transparent',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            {({ hovered }) => (
              <Text style={{ color: hovered ? '#e2e8f0' : '#94a3b8', fontSize: 14 }}>Ghost</Text>
            )}
          </Pressable>
        </Box>
      </Box>

      {/* Long press */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Long Press</Text>
        <Box style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => setLastAction('short press')}
            onLongPress={() => setLastAction('LONG PRESS')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#7c3aed' : hovered ? '#8b5cf6' : '#6d28d9',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            {({ pressed }) => (
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                {pressed ? 'Hold...' : 'Long press me'}
              </Text>
            )}
          </Pressable>
        </Box>
      </Box>

      {/* Disabled */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Disabled</Text>
        <Box style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            disabled
            onPress={() => {}}
            style={{
              backgroundColor: '#1e293b',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#475569', fontSize: 14 }}>Disabled</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Status */}
      <Box style={{
        padding: 12,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        gap: 6,
      }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>State</Text>
        <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
          {`Press count: ${pressCount}`}
        </Text>
        <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
          {`Last action: ${lastAction}`}
        </Text>
      </Box>
    </Box>
  );
}
