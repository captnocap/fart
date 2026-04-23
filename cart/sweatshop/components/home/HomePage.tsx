const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { loadRecents } from '../../lib/workspace/recents';
import { checkIsDirectory, mkdirP } from '../../lib/workspace/validate';

type HomePageProps = {
  onOpenWorkspace: (path: string) => void;
};

function SectionHeader(props: { title: string; subtitle?: string }) {
  return (
    <Col style={{ gap: 2 }}>
      <Text fontSize={11} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>{props.title}</Text>
      {props.subtitle ? <Text fontSize={10} color={COLORS.textDim}>{props.subtitle}</Text> : null}
    </Col>
  );
}

function ErrorRow(props: { message: string }) {
  return (
    <Box style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.redDeep, borderWidth: 1, borderColor: COLORS.red }}>
      <Text fontSize={10} color={COLORS.red}>{props.message}</Text>
    </Box>
  );
}

export function HomePage(props: HomePageProps) {
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const [openPath, setOpenPath] = useState('');
  const [openError, setOpenError] = useState('');
  const [newDir, setNewDir] = useState('');
  const [newError, setNewError] = useState('');

  useEffect(() => { setRecents(loadRecents()); }, []);

  const tryOpen = (path: string) => {
    const trimmed = (path || '').trim();
    const check = checkIsDirectory(trimmed);
    if (!check.ok) { setOpenError(check.reason || 'Invalid path.'); return; }
    setOpenError('');
    props.onOpenWorkspace(trimmed);
  };

  const tryCreate = (path: string) => {
    const trimmed = (path || '').trim();
    const check = mkdirP(trimmed);
    if (!check.ok) { setNewError(check.reason || 'Failed to create directory.'); return; }
    setNewError('');
    props.onOpenWorkspace(trimmed);
  };

  return (
    <Box style={{ flexGrow: 1, width: '100%', height: '100%', backgroundColor: COLORS.appBg, padding: 24 }}>
      <Col style={{ gap: 24, width: '100%', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
        <Col style={{ gap: 4 }}>
          <Text fontSize={22} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Sweatshop</Text>
          <Text fontSize={11} color={COLORS.textDim}>Native agent workspace — pick a working directory to begin.</Text>
        </Col>

        <Col style={{ gap: 8 }}>
          <SectionHeader title="RECENT" subtitle="Most recently opened working directories." />
          <Col style={{ gap: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelRaised, padding: 6 }}>
            {recents.length === 0 ? (
              <Box style={{ padding: 8 }}>
                <Text fontSize={10} color={COLORS.textDim}>No recent workspaces yet.</Text>
              </Box>
            ) : (
              <ScrollView style={{ maxHeight: 200 }}>
                <Col style={{ gap: 2 }}>
                  {recents.map((p) => (
                    <Pressable key={p} onPress={() => props.onOpenWorkspace(p)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, borderWidth: 1, borderColor: COLORS.border }}>
                      <Text fontSize={11} color={COLORS.text}>{p}</Text>
                    </Pressable>
                  ))}
                </Col>
              </ScrollView>
            )}
          </Col>
        </Col>

        <Col style={{ gap: 8 }}>
          <SectionHeader title="OPEN PATH" subtitle="Absolute path to an existing directory." />
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelRaised, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
              <TextInput value={openPath} onChange={(v: string) => setOpenPath(v)} placeholder="/absolute/path/to/workspace" fontSize={11} color={COLORS.text} style={{ borderWidth: 0, backgroundColor: 'transparent' }} />
            </Box>
            <Pressable onPress={() => tryOpen(openPath)} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Open</Text>
            </Pressable>
          </Row>
          {openError ? <ErrorRow message={openError} /> : null}
        </Col>

        <Col style={{ gap: 8 }}>
          <SectionHeader title="NEW DIRECTORY" subtitle="Start a new directory — created with mkdir -p." />
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelRaised, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
              <TextInput value={newDir} onChange={(v: string) => setNewDir(v)} placeholder="/absolute/path/to/new/workspace" fontSize={11} color={COLORS.text} style={{ borderWidth: 0, backgroundColor: 'transparent' }} />
            </Box>
            <Pressable onPress={() => tryCreate(newDir)} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.greenDeep, borderWidth: 1, borderColor: COLORS.green }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Create</Text>
            </Pressable>
          </Row>
          {newError ? <ErrorRow message={newError} /> : null}
        </Col>
      </Col>
    </Box>
  );
}
