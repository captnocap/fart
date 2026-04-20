const React: any = require('react');

import { Box, Col, Native, Pressable, Row, Text } from '../../../runtime/primitives';
import { closeWindow, maximizeWindow, minimizeWindow } from '../host';
import { COLORS, fileGlyph, fileTone } from '../theme';
import { Glyph, HeaderButton, Pill } from './shared';

export function TopBar(props: any) {
  const compact = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimum = props.widthBand === 'minimum';
  return (
    <Row
      windowDrag={true}
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: COLORS.panelBg,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        minHeight: 42,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8, flexGrow: 1, flexBasis: 0 }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Pressable onPress={closeWindow}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5f57' }} /></Pressable>
          <Pressable onPress={minimizeWindow}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#febc2e' }} /></Pressable>
          <Pressable onPress={maximizeWindow}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#28c840' }} /></Pressable>
        </Row>

        <Pressable
          onPress={props.onOpenHome}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: minimum ? 0 : 6,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 10,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Glyph icon="package" tone={COLORS.blue} backgroundColor="transparent" tiny={true} />
          {!minimum ? (
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {props.workspaceName}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={props.onOpenHome}
          style={{
            flexDirection: 'column',
            gap: 1,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 10,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
            flexGrow: 1,
            flexBasis: 0,
          }}
        >
          {!compact ? <Text fontSize={9} color={COLORS.blue}>Project landing</Text> : null}
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {props.displayTitle}
          </Text>
        </Pressable>
      </Row>

      <Row style={{ alignItems: 'center', gap: 8, marginLeft: 10 }}>
        <Row
          style={{
            alignItems: 'center',
            gap: 6,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelAlt,
          }}
        >
          <Glyph icon="git" tone={COLORS.green} backgroundColor="transparent" tiny={true} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compact ? <Text fontSize={9} color={COLORS.textDim}>{props.changedCount + ' dirty / ' + props.stagedCount + ' staged'}</Text> : null}
        </Row>
        <HeaderButton label="Refresh" meta="R" icon="refresh" compact={compact} onPress={props.onRefreshWorkspace} />
        <HeaderButton label="Settings" meta="S" icon="palette" compact={compact} active={props.settingsActive ? 1 : 0} onPress={props.onOpenSettings} />
        <HeaderButton label="Search" meta="F3" icon="search" compact={compact} active={props.searchActive ? 1 : 0} onPress={props.onToggleSearch} />
        <HeaderButton label="Terminal" meta="~" icon="terminal" compact={compact} active={props.terminalActive ? 1 : 0} onPress={props.onToggleTerminal} />
        <HeaderButton label="Agent" icon="message" compact={compact} active={props.chatActive ? 1 : 0} onPress={props.onToggleChat} />
      </Row>
    </Row>
  );
}

export function TabBar(props: any) {
  return (
    <Row style={{ backgroundColor: COLORS.panelBg, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      {props.tabs.map((tab: any) => {
        const active = tab.id === props.activeId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => props.onActivate(tab.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: props.compact ? 6 : 8,
              paddingLeft: props.compact ? 10 : 12,
              paddingRight: props.compact ? 8 : 10,
              paddingTop: props.compact ? 7 : 8,
              paddingBottom: props.compact ? 7 : 8,
              borderRightWidth: 1,
              borderColor: COLORS.borderSoft,
              borderTopWidth: 2,
              borderTopColor: active ? COLORS.blue : 'transparent',
              backgroundColor: active ? COLORS.panelAlt : COLORS.panelBg,
            }}
          >
            <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
            <Text fontSize={11} color={active ? COLORS.textBright : COLORS.text}>{tab.name}</Text>
            {!props.compact && tab.git ? <Pill label={tab.git} color={COLORS.blue} tiny={true} /> : null}
            {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
            {!props.compact && !tab.pinned ? (
              <Pressable onPress={() => props.onClose(tab.id)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}>
                <Text fontSize={10} color={COLORS.textDim}>X</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </Row>
  );
}

export function StatusBar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, backgroundColor: COLORS.panelAlt, borderTopWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green }} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.gitRemote}</Text> : null}
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>{'dirty ' + props.changedCount}</Text>
        {!mediumBand ? <Text fontSize={10} color={COLORS.textDim}>{'staged ' + props.stagedCount}</Text> : null}
        {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{'+' + props.branchAhead + ' / -' + props.branchBehind}</Text> : null}
        <Text fontSize={10} color={COLORS.textDim}>{'Ln ' + props.cursorLine}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{'Col ' + props.cursorColumn}</Text>
      </Row>
      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!mediumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.fileName === '__landing__' ? props.workDir : props.fileName === '__settings__' ? 'Settings' : props.fileName}</Text> : null}
        <Text fontSize={10} color={COLORS.textDim}>{props.languageMode}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.selectedModel}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.agentStatusText}</Text>
      </Row>
    </Row>
  );
}

export function TerminalPanel(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  return (
    <Col style={{ backgroundColor: COLORS.panelBg, borderTopWidth: 1, borderColor: COLORS.borderSoft, height: props.height || '100%' }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Terminal</Text>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text> : null}
        </Row>
        {props.onClose ? <Pressable onPress={props.onClose}><Text fontSize={10} color={COLORS.textDim}>X</Text></Pressable> : null}
      </Row>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: '#0b0f15' }}>
        <Native type="Terminal" style={{ width: '100%', height: '100%' }} fontSize={compactBand ? 12 : 13} />
      </Box>
      {!compactBand ? (
        <Box style={{ padding: 10, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textDim}>pty attached to workspace shell</Text>
        </Box>
      ) : null}
    </Col>
  );
}
