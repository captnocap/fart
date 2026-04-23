const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { listDir, stat } from '../../../../runtime/hooks/fs';

type DirectoryPickerProps = {
  visible: boolean;
  startPath: string;
  confirmLabel: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
};

function DirRow(props: { name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: TOKENS.radiusSm,
      }}
    >
      <Text fontSize={12} color={COLORS.textBright}>{props.name}</Text>
    </Pressable>
  );
}

export function DirectoryPicker(props: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState(props.startPath);
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    if (props.visible) {
      setCurrentPath(props.startPath);
      refreshEntries(props.startPath);
    }
  }, [props.visible, props.startPath]);

  const refreshEntries = (path: string) => {
    const names = listDir(path);
    const dirs: string[] = [];
    for (const name of names) {
      if (name === '.' || name === '..') continue;
      if (name.startsWith('.')) continue;
      const s = stat(path + '/' + name);
      if (s && s.isDir) {
        dirs.push(name);
      }
    }
    dirs.sort((a, b) => a.localeCompare(b));
    setEntries(dirs);
  };

  const goUp = () => {
    const normalized = currentPath.replace(/\/+$/, '');
    if (normalized === '' || normalized === '/') return;
    const parent = normalized.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
    refreshEntries(parent);
  };

  const goDown = (name: string) => {
    const next = currentPath.replace(/\/+$/, '') + '/' + name;
    setCurrentPath(next);
    refreshEntries(next);
  };

  const goToSegment = (idx: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const next = '/' + parts.slice(0, idx + 1).join('/');
    setCurrentPath(next);
    refreshEntries(next);
  };

  const confirm = () => {
    props.onSelect(currentPath);
  };

  if (!props.visible) return null;

  const parts = currentPath.split('/').filter(Boolean);

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: TOKENS.zModal }}>
      {/* Backdrop */}
      <Pressable onPress={props.onCancel} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      {/* Panel */}
      <Col style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Col style={{ width: 560, maxHeight: 480, backgroundColor: COLORS.panelBg, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border }}>
          {/* Header */}
          <Col style={{ gap: 8, padding: 16, borderBottomWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.confirmLabel}</Text>
            <Row style={{ gap: 4, flexWrap: 'wrap' }}>
              <Pressable onPress={() => { setCurrentPath('/'); refreshEntries('/'); }}>
                <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>/</Text>
              </Pressable>
              {parts.map((part, idx) => (
                <Row key={idx} style={{ gap: 4 }}>
                  <Text fontSize={10} color={COLORS.textDim}>/</Text>
                  <Pressable onPress={() => goToSegment(idx)}>
                    <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{part}</Text>
                  </Pressable>
                </Row>
              ))}
            </Row>
          </Col>
          {/* List */}
          <ScrollView style={{ flex: 1, minHeight: 0 }}>
            <Col style={{ gap: 2, padding: 8 }}>
              {currentPath !== '/' && (
                <DirRow name=".." onPress={goUp} />
              )}
              {entries.map((name) => (
                <DirRow key={name} name={name} onPress={() => goDown(name)} />
              ))}
            </Col>
          </ScrollView>
          {/* Footer */}
          <Row style={{ gap: 12, padding: 16, borderTopWidth: 1, borderColor: COLORS.border, justifyContent: 'flex-end' }}>
            <Pressable onPress={props.onCancel} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm }}>
              <Text fontSize={11} color={COLORS.textDim}>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirm} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.confirmLabel}</Text>
            </Pressable>
          </Row>
        </Col>
      </Col>
    </Box>
  );
}
