// Self-contained React statusbar fixture used by the reference
// framework/autotest/tests/statusbar.autotest. Exercises:
//   - mode cycling (5 modes)
//   - counter +/-
//   - bool toggles (connection, mute, recording)
//   - overflow menu open/close
//   - pill reorder (drag-simulated via click-to-shift)
//   - keybindings (onKeyDown handlers for Ctrl+S, Ctrl+R, Escape)
// No external deps beyond React. Must stay deterministic — no timers,
// no Math.random, no Date, no network.

'use strict';

const React = require('react');
const { useState, useCallback } = React;

const MODES = ['idle', 'recording', 'replaying', 'paused', 'error'];

function Box(props) { return React.createElement('Box', props, props.children); }
function Row(props) { return React.createElement('Row', props, props.children); }
function Text(props) { return React.createElement('Text', props, props.children); }
function Pressable(props) { return React.createElement('Pressable', props, props.children); }

function MockStatusBar() {
  const [modeIdx, setModeIdx] = useState(0);
  const [counter, setCounter] = useState(0);
  const [connected, setConnected] = useState(true);
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pills, setPills] = useState(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
  const [lastKey, setLastKey] = useState('');

  const cycleMode = useCallback(() => setModeIdx((i) => (i + 1) % MODES.length), []);
  const prevMode = useCallback(() => setModeIdx((i) => (i - 1 + MODES.length) % MODES.length), []);
  const inc = useCallback(() => setCounter((n) => n + 1), []);
  const dec = useCallback(() => setCounter((n) => n - 1), []);
  const reset = useCallback(() => setCounter(0), []);
  const toggleConn = useCallback(() => setConnected((b) => !b), []);
  const toggleMute = useCallback(() => setMuted((b) => !b), []);
  const toggleRec = useCallback(() => setRecording((b) => !b), []);
  const toggleMenu = useCallback(() => setMenuOpen((b) => !b), []);
  const shiftPills = useCallback(() => setPills((p) => p.length <= 1 ? p : [...p.slice(1), p[0]]), []);
  const unshiftPills = useCallback(() => setPills((p) => p.length <= 1 ? p : [p[p.length - 1], ...p.slice(0, -1)]), []);

  const onKeyDown = useCallback((e) => {
    setLastKey(e.key || '');
    if (e.key === 'Ctrl+S' || e.key === 'Enter') cycleMode();
    if (e.key === 'Ctrl+R') toggleRec();
    if (e.key === 'Escape') setMenuOpen(false);
  }, [cycleMode, toggleRec]);

  return React.createElement(Box, { onKeyDown, 'data-id': 'statusbar-root' },
    React.createElement(Row, { 'data-id': 'mode-row' },
      React.createElement(Pressable, { onPress: prevMode }, React.createElement(Text, null, 'prev-mode')),
      React.createElement(Text, { 'data-id': 'mode-label' }, 'mode: ' + MODES[modeIdx]),
      React.createElement(Pressable, { onPress: cycleMode }, React.createElement(Text, null, 'next-mode')),
    ),
    React.createElement(Row, { 'data-id': 'counter-row' },
      React.createElement(Pressable, { onPress: dec }, React.createElement(Text, null, 'dec')),
      React.createElement(Text, { 'data-id': 'counter-label' }, 'count: ' + counter),
      React.createElement(Pressable, { onPress: inc }, React.createElement(Text, null, 'inc')),
      React.createElement(Pressable, { onPress: reset }, React.createElement(Text, null, 'reset-counter')),
    ),
    React.createElement(Row, { 'data-id': 'toggle-row' },
      React.createElement(Pressable, { onPress: toggleConn }, React.createElement(Text, null, 'conn: ' + (connected ? 'online' : 'offline'))),
      React.createElement(Pressable, { onPress: toggleMute }, React.createElement(Text, null, 'audio: ' + (muted ? 'muted' : 'live'))),
      React.createElement(Pressable, { onPress: toggleRec }, React.createElement(Text, null, 'rec: ' + (recording ? 'on' : 'off'))),
    ),
    React.createElement(Row, { 'data-id': 'menu-row' },
      React.createElement(Pressable, { onPress: toggleMenu }, React.createElement(Text, null, menuOpen ? 'close-menu' : 'open-menu')),
      menuOpen ? React.createElement(Row, { 'data-id': 'menu-items' },
        React.createElement(Text, null, 'menu-item-a'),
        React.createElement(Text, null, 'menu-item-b'),
        React.createElement(Text, null, 'menu-item-c'),
      ) : null,
    ),
    React.createElement(Row, { 'data-id': 'pill-row' },
      React.createElement(Pressable, { onPress: unshiftPills }, React.createElement(Text, null, 'shift-left')),
      ...pills.map((p, i) => React.createElement(Text, { key: p, 'data-id': 'pill-' + i }, 'pill:' + p)),
      React.createElement(Pressable, { onPress: shiftPills }, React.createElement(Text, null, 'shift-right')),
    ),
    React.createElement(Text, { 'data-id': 'lastkey' }, 'lastkey: ' + lastKey),
  );
}

module.exports = { default: MockStatusBar, component: MockStatusBar };
