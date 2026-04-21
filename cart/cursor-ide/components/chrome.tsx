const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Terminal, Text } from '../../../runtime/primitives';
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
        <HeaderButton label="Hot" meta="H" icon="flame" compact={compact} active={props.hotActive ? 1 : 0} onPress={props.onToggleHot} />
        <HeaderButton label="Palette" meta="P" icon="command" compact={compact} active={props.paletteActive ? 1 : 0} onPress={props.onOpenPalette} />
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
  const history = props.history || [];
  const playState = props.playState || null;
  const isRecording = !!props.recording;
  const recordFrames = props.recordFrames || 0;
  const activePane = props.pane || 'live';

  function TabButton(tab: string, label: string, meta?: string) {
    const active = activePane === tab;
    return (
      <Pressable
        key={tab}
        onPress={() => props.onSetPane?.(tab)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? COLORS.blue : COLORS.border,
          backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
        }}
      >
        <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>{label}</Text>
        {meta ? <Text fontSize={9} color={COLORS.textDim}>{meta}</Text> : null}
      </Pressable>
    );
  }

  function HistoryEntryRow(entry: any) {
    return (
      <Box
        key={entry.id}
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: COLORS.panelAlt,
          borderWidth: 1,
          borderColor: COLORS.borderSoft,
          gap: 4,
        }}
      >
        <Row style={{ gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
            <Pill label={entry.kind} color={COLORS.blue} tiny={true} />
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{entry.title}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>
            {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Row>
        <Text fontSize={10} color={COLORS.text}>{entry.detail}</Text>
        {entry.path ? <Text fontSize={9} color={COLORS.textDim}>{entry.path}</Text> : null}
      </Box>
    );
  }

  function PlaybackSummary() {
    if (!playState) {
      return <Text fontSize={10} color={COLORS.textDim}>No playback loaded.</Text>;
    }
    return (
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pill label={playState.playing ? 'playing' : 'paused'} color={playState.playing ? COLORS.green : COLORS.textDim} tiny={true} />
        <Text fontSize={10} color={COLORS.textDim}>{Math.round((playState.progress || 0) * 100) + '%'}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{'f' + playState.frame + '/' + playState.total_frames}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{String(playState.speed || 1) + 'x'}</Text>
      </Row>
    );
  }

  return (
    <Col style={{ backgroundColor: COLORS.panelBg, borderTopWidth: 1, borderColor: COLORS.borderSoft, height: props.height || '100%', minHeight: 0 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 8, flexWrap: 'wrap' }}>
        {!compactBand && !props.expanded && props.onBeginResize ? (
          <Pressable
            onMouseDown={props.onBeginResize}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flexGrow: 1,
              flexBasis: 0,
              minWidth: 0,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            <Box style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border }} />
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
              <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Terminal</Text>
              <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
              <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text>
              {isRecording ? <Pill label={'rec ' + recordFrames + 'f'} color={COLORS.red} tiny={true} /> : null}
              <Text fontSize={9} color={COLORS.textDim}>drag to resize</Text>
            </Row>
          </Pressable>
        ) : (
          <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Terminal</Text>
            <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
            {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text> : null}
            {isRecording ? <Pill label={'rec ' + recordFrames + 'f'} color={COLORS.red} tiny={true} /> : null}
          </Row>
        )}
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!compactBand && props.onToggleExpanded ? (
            <Pressable onPress={props.onToggleExpanded}>
              <Text fontSize={10} color={COLORS.textDim}>{props.expanded ? 'Collapse' : 'Expand'}</Text>
            </Pressable>
          ) : null}
          {props.onClose ? <Pressable onPress={props.onClose}><Text fontSize={10} color={COLORS.textDim}>X</Text></Pressable> : null}
        </Row>
      </Row>
      <Row style={{ padding: compactBand ? 8 : 10, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
        {TabButton('live', 'Live', 'pty')}
        {TabButton('history', 'History', String(history.length))}
        {TabButton('recorder', 'Recorder', isRecording ? 'on' : 'off')}
      </Row>

      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: '#0b0f15' }}>
        {activePane === 'live' ? (
          <Terminal style={{ width: '100%', height: '100%' }} fontSize={compactBand ? 12 : 13} />
        ) : null}

        {activePane === 'history' ? (
          <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, minHeight: 0 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Session history</Text>
              <Row style={{ gap: 8, alignItems: 'center' }}>
                <Pressable onPress={props.onJumpLive}><Text fontSize={10} color={COLORS.textDim}>Live</Text></Pressable>
                <Pressable onPress={props.onClearHistory}><Text fontSize={10} color={COLORS.textDim}>Clear</Text></Pressable>
              </Row>
            </Row>
            <Text fontSize={10} color={COLORS.textDim}>
              {history.length > 0 ? 'Recent terminal events and saved snapshots live in localstore.' : 'No saved terminal history yet.'}
            </Text>
            <ScrollView style={{ flexGrow: 1, minHeight: 0 }}>
              <Col style={{ gap: 8 }}>
                {history.length > 0 ? history.map((entry: any) => HistoryEntryRow(entry)) : null}
              </Col>
            </ScrollView>
          </Col>
        ) : null}

        {activePane === 'recorder' ? (
          <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, minHeight: 0 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Recorder</Text>
              <PlaybackSummary />
            </Row>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <Pressable onPress={props.onToggleRecording} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 10, backgroundColor: isRecording ? COLORS.redDeep : COLORS.panelAlt, borderWidth: 1, borderColor: isRecording ? COLORS.red : COLORS.border }}>
                <Text fontSize={10} color={isRecording ? COLORS.red : COLORS.textBright}>{isRecording ? 'Stop recording' : 'Start recording'}</Text>
              </Pressable>
              <Pressable onPress={props.onSaveSnapshot} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 10, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                <Text fontSize={10} color={COLORS.textBright}>Save snapshot</Text>
              </Pressable>
              <Pressable onPress={props.onLoadPlayback} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 10, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                <Text fontSize={10} color={COLORS.textBright}>Load playback</Text>
              </Pressable>
              <Pressable onPress={props.onTogglePlayback} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 10, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                <Text fontSize={10} color={COLORS.textBright}>Play / pause</Text>
              </Pressable>
              <Pressable onPress={props.onStepPlayback} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 10, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                <Text fontSize={10} color={COLORS.textBright}>Step</Text>
              </Pressable>
            </Row>
            <Box style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt, gap: 4 }}>
              <Text fontSize={10} color={COLORS.textDim}>Recording stays local to the current terminal session. Saving snapshots adds an entry to the history tab.</Text>
              {playState ? <Text fontSize={10} color={COLORS.textDim}>{'Playback ' + Math.round((playState.progress || 0) * 100) + '%'} </Text> : null}
            </Box>
          </Col>
        ) : null}
      </Box>

      {!compactBand ? (
        <Box style={{ padding: 10, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textDim}>Terminal history is stored in localstore and snapshots are saved to /tmp when recording is active. Drag the top bar to resize.</Text>
        </Box>
      ) : null}
    </Col>
  );
}
