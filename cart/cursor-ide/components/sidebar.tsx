const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, fileGlyph, fileTone, samePath } from '../theme';
import { Glyph, Pill } from './shared';

export function Sidebar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  const openEditorLimit = compactBand ? 8 : mediumBand ? 4 : 6;
  const changeLimit = compactBand ? 8 : mediumBand ? 4 : 6;

  return (
    <Col
      style={{
        width: props.style?.width || 280,
        height: '100%',
        backgroundColor: COLORS.panelBg,
        borderRightWidth: 1,
        borderColor: COLORS.border,
        ...props.style,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
        <Text fontSize={11} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          {compactBand ? 'FILES' : 'WORKSPACE'}
        </Text>
        <Row style={{ gap: 8 }}>
          <Pressable onPress={props.onRefreshWorkspace}><Text fontSize={10} color={COLORS.blue}>RF</Text></Pressable>
          <Pressable onPress={props.onCreateFile}><Text fontSize={10} color={COLORS.blue}>+</Text></Pressable>
        </Row>
      </Row>

      <Pressable
        onPress={props.onOpenHome}
        style={{
          marginLeft: 12,
          marginRight: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelRaised,
        }}
      >
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.workspaceName}</Text>
        <Row style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          <Pill label={String(props.changedCount) + ' dirty'} color={COLORS.yellow} tiny={true} />
          {!mediumBand ? <Pill label={String(props.stagedCount) + ' staged'} color={COLORS.blue} tiny={true} /> : null}
        </Row>
        {props.widthBand === 'desktop' ? <Text fontSize={10} color={COLORS.textDim} style={{ marginTop: 8 }}>{props.workDir}</Text> : null}
      </Pressable>

      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>OPEN EDITORS</Text>
      </Box>
      <Box style={{ paddingLeft: 12, paddingRight: 12, gap: 6 }}>
        {props.tabs.slice(0, openEditorLimit).map((tab: any) => {
          if (tab.path === '__landing__') return null;
          return (
            <Pressable
              key={tab.id}
              onPress={() => props.onSelectPath(tab.path)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 10,
                backgroundColor: samePath(tab.path, props.currentFilePath) ? COLORS.panelHover : COLORS.panelRaised,
              }}
            >
              <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
              <Text fontSize={11} color={COLORS.text}>{tab.name}</Text>
              {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
              <Box style={{ flexGrow: 1 }} />
              {tab.git ? <Pill label={tab.git} color={COLORS.textMuted} tiny={true} /> : null}
            </Pressable>
          );
        })}
      </Box>

      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          SOURCE CONTROL
        </Text>
      </Box>
      <Box style={{ paddingLeft: 12, paddingRight: 12, gap: 6 }}>
        {props.gitChanges.slice(0, changeLimit).map((item: any) => (
          <Pressable
            key={item.path}
            onPress={() => props.onSelectPath(item.path)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 10,
              backgroundColor: COLORS.panelRaised,
            }}
          >
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.tone }} />
            <Text fontSize={10} color={COLORS.textBright}>{item.status}</Text>
            <Text fontSize={10} color={COLORS.textDim}>{item.path}</Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          EXPLORER
        </Text>
      </Box>
      <ScrollView style={{ flexGrow: 1, height: '100%', paddingLeft: 8, paddingRight: 8, paddingBottom: 12 }}>
        <Col style={{ gap: 4 }}>
          {props.files.map((file: any) => {
            if (file.visible !== 1) return null;
            const gitGutter = gitGutterColor(file.git);
            return (
              <Pressable
                key={file.path + '_' + file.indent}
                onPress={() => props.onSelectPath(file.path)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingLeft: 10 + file.indent * 12,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 10,
                  backgroundColor: file.selected ? COLORS.panelHover : file.hot ? COLORS.panelRaised : 'transparent',
                  borderLeftWidth: gitGutter ? 3 : 0,
                  borderColor: gitGutter || 'transparent',
                }}
              >
                <Text fontSize={9} color={COLORS.textDim}>{file.type === 'dir' ? (file.expanded ? 'v' : '>') : ''}</Text>
                <Glyph
                  icon={file.type === 'dir' ? (file.expanded ? 'folder-open' : 'folder') : fileGlyph(file.type)}
                  tone={file.type === 'dir' ? COLORS.textMuted : fileTone(file.type)}
                  backgroundColor={file.type === 'dir' ? COLORS.grayDeep : COLORS.grayChip}
                  tiny={true}
                />
                <Text fontSize={11} color={file.selected ? COLORS.textBright : COLORS.text}>{file.name}</Text>
                {file.hot ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.blue }} /> : null}
                <Box style={{ flexGrow: 1 }} />
                {file.git ? <Pill label={file.git} color={gitGutter || COLORS.textMuted} tiny={true} /> : null}
              </Pressable>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}
