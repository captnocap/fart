const React: any = require('react');
const { useCallback, useEffect, useRef, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Terminal, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Pill } from './shared';

const host: any = globalThis as any;
const CTRL_MOD = 192;
const TAB_KEY = 9;

type TerminalSession = {
  id: string;
  name: string;
  ptyHandle: number;
};

function toHandle(value: any, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const maybe = value.ptyHandle ?? value.handle ?? value.id;
    if (typeof maybe === 'number' && Number.isFinite(maybe)) return maybe;
  }
  return fallback;
}

function spawnPty(cols: number, rows: number, fallback: number): number {
  try {
    if (typeof host.__pty_open !== 'function') return fallback;
    return toHandle(host.__pty_open(cols, rows), fallback);
  } catch {
    return fallback;
  }
}

function closePty(handle: number): void {
  try {
    if (typeof host.__pty_close === 'function') host.__pty_close(handle);
  } catch {}
}

export function TerminalPanel(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const history = props.history || [];
  const playState = props.playState || null;
  const isRecording = !!props.recording;
  const recordFrames = props.recordFrames || 0;
  const activePane = props.pane || 'live';

  const sessionsRef = useRef<TerminalSession[]>([]);
  const activeSessionIdRef = useRef('');
  const nextSessionOrdinalRef = useRef(1);
  const bootstrappedRef = useRef(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState('');

  const sessions = sessionsRef.current;
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0] || null;

  const bumpSessions = useCallback(() => {
    setSessionRevision((value) => value + 1);
  }, []);

  const setActiveSession = useCallback((id: string) => {
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
  }, []);

  const ensureSession = useCallback((focus: boolean = false) => {
    const ordinal = nextSessionOrdinalRef.current++;
    const ptyHandle = spawnPty(120, compactBand ? 26 : 30, ordinal - 1);
    const session: TerminalSession = {
      id: 'term_' + ordinal + '_' + Date.now().toString(36),
      name: ordinal === 1 ? 'shell' : 'shell ' + ordinal,
      ptyHandle,
    };
    sessionsRef.current = [...sessionsRef.current, session];
    if (focus || !activeSessionIdRef.current) {
      setActiveSession(session.id);
    }
    bumpSessions();
    return session;
  }, [bumpSessions, compactBand, setActiveSession]);

  const replaceWithFallbackSession = useCallback((focus: boolean = true) => {
    sessionsRef.current = [];
    activeSessionIdRef.current = '';
    setActiveSessionId('');
    return ensureSession(focus);
  }, [ensureSession]);

  const closeSession = useCallback((sessionId: string) => {
    const current = sessionsRef.current;
    const closing = current.find((session) => session.id === sessionId) || null;
    const remaining = current.filter((session) => session.id !== sessionId);
    if (closing) closePty(closing.ptyHandle);

    sessionsRef.current = remaining;

    if (remaining.length === 0) {
      replaceWithFallbackSession(true);
      return;
    }

    const activeIdx = current.findIndex((session) => session.id === activeSessionIdRef.current);
    const nextActive = activeIdx >= 0
      ? remaining[Math.min(activeIdx, remaining.length - 1)]
      : remaining[remaining.length - 1];

    setActiveSession(nextActive.id);
    bumpSessions();
  }, [bumpSessions, replaceWithFallbackSession, setActiveSession]);

  const focusSession = useCallback((sessionId: string) => {
    if (activeSessionIdRef.current === sessionId) return;
    if (!sessionsRef.current.some((session) => session.id === sessionId)) return;
    setActiveSession(sessionId);
    if (props.onSetPane) props.onSetPane('live');
  }, [setActiveSession, props]);

  const cycleSession = useCallback(() => {
    const list = sessionsRef.current;
    if (list.length <= 1) return;
    const currentIndex = Math.max(0, list.findIndex((session) => session.id === activeSessionIdRef.current));
    const next = list[(currentIndex + 1) % list.length];
    setActiveSession(next.id);
    if (props.onSetPane) props.onSetPane('live');
  }, [setActiveSession, props]);

  const handleTerminalKeyDown = useCallback((payload: any) => {
    const keyCode = Number(payload?.keyCode ?? payload?.key ?? 0);
    const mods = Number(payload?.mods ?? 0);
    if ((mods & CTRL_MOD) && keyCode === TAB_KEY) {
      cycleSession();
    }
  }, [cycleSession]);

  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      if (sessionsRef.current.length === 0) {
        ensureSession(true);
      } else if (!activeSessionIdRef.current) {
        setActiveSession(sessionsRef.current[0].id);
      }
    }
  }, [ensureSession, setActiveSession, sessionRevision]);

  useEffect(() => {
    return () => {
      for (const session of sessionsRef.current) closePty(session.ptyHandle);
    };
  }, []);

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

  function SessionTab(session: TerminalSession) {
    const active = session.id === activeSessionId;
    return (
      <Row
        key={session.id}
        style={{
          alignItems: 'center',
          gap: 6,
          paddingLeft: 10,
          paddingRight: 8,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? COLORS.blue : COLORS.border,
          backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
        }}
      >
        <Pressable onPress={() => focusSession(session.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pill label={session.name} color={active ? COLORS.blue : COLORS.textBright} tiny={true} />
          <Text fontSize={9} color={COLORS.textDim}>{'pty ' + String(session.ptyHandle)}</Text>
        </Pressable>
        <Pressable onPress={() => closeSession(session.id)} style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1 }}>
          <Text fontSize={10} color={COLORS.textDim}>x</Text>
        </Pressable>
      </Row>
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
    <Col
      style={{
        backgroundColor: COLORS.panelBg,
        borderTopWidth: 1,
        borderColor: COLORS.borderSoft,
        height: props.height || '100%',
        minHeight: 0,
        flexGrow: props.expanded ? 1 : 0,
      }}
    >
      {!compactBand && !props.expanded && props.onBeginResize ? (
        <Pressable
          onMouseDown={props.onBeginResize}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderColor: COLORS.borderSoft,
            backgroundColor: COLORS.panelBg,
          }}
        >
          <Col style={{ gap: 4 }}>
            <Box style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: COLORS.border }} />
            <Text fontSize={9} color={COLORS.textDim}>drag to resize</Text>
          </Col>
        </Pressable>
      ) : null}

      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 8, flexWrap: 'wrap' }}>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Terminal</Text>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          {activeSession ? <Pill label={activeSession.name} color={COLORS.blue} tiny={true} /> : null}
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text> : null}
          {isRecording ? <Pill label={'rec ' + recordFrames + 'f'} color={COLORS.red} tiny={true} /> : null}
          <Pill label={String(sessions.length) + ' tabs'} color={COLORS.blue} tiny={true} />
        </Row>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!compactBand && props.onToggleExpanded ? (
            <Pressable onPress={props.onToggleExpanded}>
              <Text fontSize={10} color={COLORS.textDim}>{props.expanded ? 'Restore dock' : 'Take over'}</Text>
            </Pressable>
          ) : null}
          {props.onClose ? <Pressable onPress={props.onClose}><Text fontSize={10} color={COLORS.textDim}>X</Text></Pressable> : null}
        </Row>
      </Row>

      <Row style={{ padding: compactBand ? 8 : 10, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap', alignItems: 'center' }}>
        {sessions.map((session) => SessionTab(session))}
        <Pressable
          onPress={() => {
            ensureSession(true);
            if (props.onSetPane) props.onSetPane('live');
          }}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 7,
            paddingBottom: 7,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelAlt,
          }}
        >
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>+</Text>
        </Pressable>
      </Row>

      <Row style={{ padding: compactBand ? 8 : 10, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
        {TabButton('live', 'Live', 'pty')}
        {TabButton('history', 'History', String(history.length))}
        {TabButton('recorder', 'Recorder', isRecording ? 'on' : 'off')}
      </Row>

      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: '#0b0f15' }}>
        <Box style={{ display: activePane === 'live' ? 'flex' : 'none', width: '100%', height: '100%', minHeight: 0 }}>
          {sessions.length > 0 ? sessions.map((session) => (
            <Box
              key={session.id}
              style={{
                width: '100%',
                height: '100%',
                minHeight: 0,
                display: session.id === activeSessionId ? 'flex' : 'none',
              }}
            >
              <Terminal
                terminal_id={session.ptyHandle}
                style={{ width: '100%', height: '100%' }}
                fontSize={compactBand ? 12 : 13}
                onKeyDown={session.id === activeSessionId ? handleTerminalKeyDown : undefined}
              />
            </Box>
          )) : (
            <Col style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Text fontSize={11} color={COLORS.textDim}>No terminal sessions yet.</Text>
              <Pressable
                onPress={() => ensureSession(true)}
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 7,
                  paddingBottom: 7,
                  borderRadius: 10,
                  backgroundColor: COLORS.panelAlt,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text fontSize={10} color={COLORS.textBright}>Spawn shell</Text>
              </Pressable>
            </Col>
          )}
        </Box>

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
              {playState ? <Text fontSize={10} color={COLORS.textDim}>{'Playback ' + Math.round((playState.progress || 0) * 100) + '%'}</Text> : null}
            </Box>
          </Col>
        ) : null}
      </Box>

      {!compactBand ? (
        <Box style={{ padding: 10, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textDim}>Terminal history is stored in localstore and snapshots are saved to /tmp when recording is active. Drag the top bar to resize. Ctrl+Tab cycles terminal tabs.</Text>
        </Box>
      ) : null}
    </Col>
  );
}
