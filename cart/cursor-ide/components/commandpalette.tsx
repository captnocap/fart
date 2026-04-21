// ── Command Palette ──────────────────────────────────────────────────

const React: any = require('react');
const { useEffect, useRef, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../runtime/primitives';
import { COLORS } from '../theme';

export type PaletteCommand = {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  action: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<any>(null);

  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q) || (cmd.category ?? '').toLowerCase().includes(q);
      })
    : commands;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const exec = (cmd: PaletteCommand) => {
    onClose();
    cmd.action();
  };

  return (
    <Box style={{
      position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Col style={{
        width: 560, maxHeight: 480,
        backgroundColor: COLORS.panelRaised,
        borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
        overflow: 'hidden',
      }}>
        {/* Input */}
        <Box style={{ padding: 12, borderBottomWidth: 1, borderColor: COLORS.border }}>
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="Type a command..."
            style={{
              fontSize: 14, color: COLORS.textBright,
              backgroundColor: COLORS.panelBg,
              borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
              paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            }}
          />
        </Box>

        {/* Results */}
        <ScrollView style={{ flexGrow: 1, maxHeight: 360 }}>
          {filtered.length === 0 ? (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>No commands found</Text>
            </Box>
          ) : (
            filtered.map((cmd, idx) => (
              <Pressable
                key={cmd.id}
                onPress={() => exec(cmd)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                  backgroundColor: idx === selectedIndex ? 'rgba(45,98,255,0.15)' : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: idx === selectedIndex ? COLORS.blue : 'transparent',
                }}
              >
                <Col style={{ gap: 2 }}>
                  <Text style={{ fontSize: 12, color: COLORS.textBright }}>{cmd.label}</Text>
                  {cmd.category ? <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{cmd.category}</Text> : null}
                </Col>
                {cmd.shortcut ? (
                  <Box style={{
                    backgroundColor: COLORS.panelAlt, borderRadius: 4,
                    paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                  }}>
                    <Text style={{ fontSize: 9, color: COLORS.textDim }}>{cmd.shortcut}</Text>
                  </Box>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <Row style={{
          justifyContent: 'space-between', alignItems: 'center',
          paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
          borderTopWidth: 1, borderColor: COLORS.border,
          backgroundColor: COLORS.panelBg,
        }}>
          <Text style={{ fontSize: 9, color: COLORS.textMuted }}>{filtered.length} commands</Text>
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>ESC to close</Text>
          </Pressable>
        </Row>
      </Col>
    </Box>
  );
}
