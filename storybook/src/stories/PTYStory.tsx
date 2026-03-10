/**
 * PTY — Terminal primitives and hooks.
 *
 * Terminal, usePTY, SemanticTerminal, useSemanticTerminal.
 * The PTY subsystem: LuaJIT FFI → libvterm → damage callbacks → React.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, ScrollView, CodeBlock, Pressable, TextInput, Terminal, usePTY, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// -- Palette ----------------------------------------------------------

const C = {
  accent: '#22d3ee',
  accentDim: 'rgba(34, 211, 238, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  teal: '#94e2d5',
  peach: '#fab387',
  termBg: 'rgb(13, 13, 26)',
  termBorder: 'rgba(64, 64, 89, 0.8)',
  termPrompt: '#a6e3a1',
  termCmd: '#cdd6f4',
  termDim: 'rgba(140, 148, 166, 0.6)',
};

// -- Static code blocks (hoisted) -------------------------------------

const INSTALL_CODE = `import { Terminal, usePTY, SemanticTerminal, useSemanticTerminal } from '@reactjit/core'`;

const USEPTY_CODE = `const { output, send, sendLine, connected, terminalProps } = usePTY({
  type: 'user',        // 'user' | 'root' | 'template'
  shell: 'bash',       // any PATH-resolvable binary
  session: 'main',     // stable name for RPC targeting
});

return (
  <>
    <Terminal {...terminalProps} />
    <Text fontSize={12}>{output}</Text>
    <Pressable onPress={() => sendLine('ls -la')}>
      <Text>Run ls</Text>
    </Pressable>
  </>
)`;

const TERMINAL_CODE = `// Non-visual capability node — manages PTY lifecycle
// Drop it in the tree, wire events, done.
<Terminal
  type="user"
  shell="bash"
  session="main"
  rows={24}
  cols={80}
  onData={(e) => append(e.data)}
  onDirtyRows={(e) => setRows(e.rows)}
  onCursorMove={(e) => setCursor(e)}
  onConnect={() => setAlive(true)}
  onExit={(e) => setAlive(false)}
  onError={(e) => setErr(e.error)}
/>`;

const SEMANTIC_CODE = `// Visual classified terminal — renders itself
<SemanticTerminal
  mode="live"
  command="bash"
  classifier="basic"
  showTokens
  style={{ flexGrow: 1 }}
/>`;

const PLAYBACK_CODE = `const st = useSemanticTerminal({
  mode: 'playback',
  playbackSrc: '/tmp/session.rec.lua',
  showTimeline: true,
  playbackSpeed: 1.0,
});

// Transport controls
st.play();
st.pause();
st.seek(5.0);    // seconds
st.step();       // +1 frame
st.stepBack();   // -1 frame
st.setSpeed(2);  // 2x speed`;

const TEMPLATE_CODE = `// Template mode: fresh PTY per command
const { runCommand, terminalProps } = usePTY({
  type: 'template',
  env: { MY_API_KEY: 'abc123' },
  session: 'cmd',
});

<Terminal {...terminalProps} />

// Each call spawns: bash -c "<command>"
runCommand('curl -s https://api.example.com/status');
runCommand('git log --oneline -5');`;

const PIPELINE_CODE = `-- Lua-side pipeline (what happens under the hood):
--
-- 1. PTY.open(shell, rows, cols)        -- LuaJIT FFI: forkpty()
-- 2. vterm parses ANSI escape sequences  -- libvterm FFI
-- 3. Damage callback fires on cell change
-- 4. Settle timer (16ms) coalesces damage
-- 5. Dirty rows sent to React via bridge event
-- 6. React re-renders with structured row data
--
-- Total latency: PTY output → screen pixel = 1-2 frames`;

const RESIZE_CODE = `const { resize, terminalProps } = usePTY({ session: 'main' });

// On layout change, tell the PTY about the new dimensions
// This sends SIGWINCH to the child process
resize(40, 120);  // rows, cols`;

// -- Styles (hoisted) -------------------------------------------------

const S_TERM_BOX = {
  width: '100%' as const,
  backgroundColor: 'rgb(13, 13, 26)',
  borderRadius: 6,
  borderWidth: 1,
  borderColor: 'rgba(64, 64, 89, 0.8)',
  padding: 10,
};

const S_TERM_SCROLL = {
  width: '100%' as const,
  height: 350,
  backgroundColor: 'rgb(13, 13, 26)',
  borderRadius: 6,
  borderWidth: 1,
  borderColor: 'rgba(64, 64, 89, 0.8)',
};

const S_TERM_SCROLL_INNER = {
  padding: 10,
  gap: 1,
};

const S_ROW_TEXT = {
  fontSize: 11,
  fontFamily: 'monospace' as const,
  color: '#cdd6f4',
};

const S_CURSOR_TEXT = {
  fontSize: 11,
  fontFamily: 'monospace' as const,
  color: '#a6e3a1',
};

const S_BTN = {
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: 6,
  paddingBottom: 6,
  borderRadius: 4,
  backgroundColor: 'rgba(34, 211, 238, 0.15)',
};

const S_BTN_TEXT = {
  fontSize: 10,
  color: '#22d3ee',
  fontWeight: 'bold' as const,
};

const S_STATUS_DOT_ON = {
  width: 6, height: 6, borderRadius: 3,
  backgroundColor: '#a6e3a1',
};

const S_STATUS_DOT_OFF = {
  width: 6, height: 6, borderRadius: 3,
  backgroundColor: '#f38ba8',
};

// -- Quick Commands ---------------------------------------------------

const QUICK_CMDS = [
  { label: 'ls -la', cmd: 'ls -la' },
  { label: 'pwd', cmd: 'pwd' },
  { label: 'uname -a', cmd: 'uname -a' },
  { label: 'date', cmd: 'date' },
  { label: 'whoami', cmd: 'whoami' },
  { label: 'clear', cmd: 'clear' },
];

// -- Live PTY Demo ----------------------------------------------------

function LivePTYDemo() {
  const { output, dirtyRows, cursor, connected, send, sendLine, interrupt, terminalProps } = usePTY({
    type: 'user',
    shell: 'bash',
    session: 'story-demo',
    rows: 24,
    cols: 120,
  });

  const [inputText, setInputText] = useState('');

  return (
    <Box style={{ width: '100%', gap: 8 }}>
      {/* Hidden capability node */}
      <Terminal {...terminalProps} />

      {/* Status bar */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Box style={connected ? S_STATUS_DOT_ON : S_STATUS_DOT_OFF} />
        <Text style={{ fontSize: 10, color: connected ? C.green : C.red }}>
          {connected ? 'Connected' : 'Disconnected'}
        </Text>
        <Text style={{ fontSize: 9, color: C.termDim }}>
          {`cursor: ${cursor.row},${cursor.col}  rows: ${dirtyRows.length}`}
        </Text>
      </Box>

      {/* Terminal output */}
      <ScrollView style={S_TERM_SCROLL}>
        <Box style={S_TERM_SCROLL_INNER}>
          {dirtyRows.length > 0 ? (
            dirtyRows.map((row, i) => (
              <Text key={i} style={S_ROW_TEXT}>{row.text || ' '}</Text>
            ))
          ) : output ? (
            <Text style={S_ROW_TEXT}>{output.slice(-2000)}</Text>
          ) : (
            <Text style={{ fontSize: 10, color: C.termDim }}>{'Waiting for PTY output...'}</Text>
          )}
          {/* Cursor indicator */}
          {connected && (
            <Text style={S_CURSOR_TEXT}>
              {`${'_'.padStart(cursor.col + 1).slice(-1)}`}
            </Text>
          )}
        </Box>
      </ScrollView>

      {/* Input bar */}
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: C.green, fontFamily: 'monospace' }}>{'$'}</Text>
        <Box style={{ flexGrow: 1, backgroundColor: 'rgba(13, 13, 26, 0.8)', borderRadius: 4, borderWidth: 1, borderColor: C.termBorder, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            onSubmit={(text: string) => { if (text) sendLine(text); setInputText(''); }}
            live
            placeholder="Type a command and press Enter..."
            style={{ fontSize: 11, color: '#cdd6f4', fontFamily: 'monospace' }}
          />
        </Box>
        <Pressable onPress={() => { sendLine(inputText); setInputText(''); }}>
          <Box style={S_BTN}>
            <Text style={S_BTN_TEXT}>{'Send'}</Text>
          </Box>
        </Pressable>
      </Box>

      {/* Quick command buttons */}
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_CMDS.map(c => (
          <Pressable key={c.label} onPress={() => sendLine(c.cmd)}>
            <Box style={S_BTN}>
              <Text style={S_BTN_TEXT}>{c.label}</Text>
            </Box>
          </Pressable>
        ))}
        <Pressable onPress={interrupt}>
          <Box style={{ ...S_BTN, backgroundColor: 'rgba(243, 139, 168, 0.15)' }}>
            <Text style={{ ...S_BTN_TEXT, color: C.red }}>{'Ctrl+C'}</Text>
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
}

// -- Pipeline Diagram -------------------------------------------------

function PipelineDiagram() {
  const stages = [
    { label: 'PTY', desc: 'forkpty() via FFI', color: C.accent },
    { label: 'vterm', desc: 'ANSI parse + grid', color: C.blue },
    { label: 'Damage', desc: 'Cell change callback', color: C.yellow },
    { label: 'Settle', desc: '16ms coalesce', color: C.peach },
    { label: 'Bridge', desc: 'Dirty rows to JS', color: C.mauve },
    { label: 'React', desc: 'Re-render', color: C.green },
  ];

  return (
    <S.StackG3W100>
      {stages.map((s, i) => (
        <S.RowCenterG8 key={s.label}>
          <Box style={{
            width: 5, height: 5, borderRadius: 3,
            backgroundColor: s.color, flexShrink: 0,
          }} />
          <Text style={{ fontSize: 9, color: s.color, width: 55, flexShrink: 0, fontWeight: 'bold' }}>
            {s.label}
          </Text>
          <S.StoryCap>{s.desc}</S.StoryCap>
          {i < stages.length - 1 && (
            <Text style={{ fontSize: 7, color: C.termDim }}>{'>'}</Text>
          )}
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- PTY Type Catalog -------------------------------------------------

const PTY_TYPES = [
  { label: 'user', desc: 'Interactive login shell (bash/zsh). Default.', color: C.green },
  { label: 'root', desc: 'Root shell (sudo/su password prompt in PTY).', color: C.red },
  { label: 'template', desc: 'Fresh ephemeral PTY per command (bash -c "...").', color: C.blue },
];

// -- Event Catalog ----------------------------------------------------

const PTY_EVENTS = [
  { label: 'onData', desc: 'Raw bytes from PTY (ANSI-encoded, backward compat)', color: C.accent },
  { label: 'onDirtyRows', desc: 'Settled dirty rows from vterm (structured row data)', color: C.blue },
  { label: 'onCursorMove', desc: 'Cursor position + visibility change', color: C.yellow },
  { label: 'onConnect', desc: 'Shell process started successfully', color: C.green },
  { label: 'onExit', desc: 'Shell process exited (with exit code)', color: C.red },
  { label: 'onError', desc: 'Spawn error (shell not found, etc.)', color: C.peach },
];

function CatalogList({ items }: { items: typeof PTY_EVENTS }) {
  return (
    <S.StackG3W100>
      {items.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: f.color, width: 80, flexShrink: 0, fontWeight: 'bold' }}>
            {f.label}
          </Text>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- PTYStory ---------------------------------------------------------

export function PTYStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* Header */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="terminal" tintColor={C.accent} />
        <S.StoryTitle>{'PTY'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'LuaJIT FFI terminals in React'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>
        <PageColumn>

        {/* Hero */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'Real PTY sessions via LuaJIT FFI. Structured output via libvterm. Semantic classification.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'forkpty() allocates a pseudo-terminal and spawns a shell. libvterm parses ANSI escape sequences into a structured cell grid. Damage callbacks coalesce at 16ms, and dirty rows flush to React as typed events. No WebSocket. No HTTP polling. In-process FFI.'}
          </S.StoryMuted>
          <CodeBlock language="tsx" fontSize={8} code={INSTALL_CODE} style={{ width: '100%' }} />
        </HeroBand>

        <Divider />

        {/* Live PTY Demo */}
        <HeroBand accentColor={C.green}>
          <SectionLabel icon="terminal" accentColor={C.accent}>{'LIVE PTY'}</SectionLabel>
          <S.StoryCap>
            {'usePTY hook manages the PTY lifecycle. Click the buttons to send commands. Output displays vterm-parsed rows.'}
          </S.StoryCap>
          <LivePTYDemo />
        </HeroBand>

        <Divider />

        {/* Band 2: usePTY code | text */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={USEPTY_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="code" accentColor={C.blue}>{'usePTY HOOK'}</SectionLabel>
            <S.StoryBody>
              {'The primary API. Returns accumulated output, connection state, and a terminalProps object to spread onto a Terminal element. The hook manages all event wiring internally — onData accumulates into the output buffer, onDirtyRows provides structured vterm rows, onCursorMove tracks the cursor.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Session names are stable across re-renders (useRef). Auto-generated if omitted. Multiple terminals coexist by using different session names.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* Band 3: Terminal element code | text */}
        <Band>
          <Half>
            <SectionLabel icon="box" accentColor={C.green}>{'TERMINAL ELEMENT'}</SectionLabel>
            <S.StoryBody>
              {'The non-visual capability node. Drop it in the tree to own a PTY session. It renders nothing — it exists purely to register event handlers and lifecycle with the Lua-side terminal capability. Think of it as a side-effect node, like a React portal anchor.'}
            </S.StoryBody>
            <CatalogList items={PTY_EVENTS} />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={TERMINAL_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Callout: pipeline */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'The full pipeline: forkpty() via LuaJIT FFI allocates a kernel pseudo-terminal. libvterm parses ANSI sequences into a cell grid. Damage callbacks fire on cell changes. A 16ms settle timer coalesces rapid updates. Dirty rows are sent to React via the bridge as typed events. Total latency: 1-2 frames.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* Band 4: Pipeline | diagram */}
        <Band>
          <Half>
            <PipelineDiagram />
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={PIPELINE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Band 5: SemanticTerminal | text */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={SEMANTIC_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="eye" accentColor={C.mauve}>{'SEMANTIC TERMINAL'}</SectionLabel>
            <S.StoryBody>
              {'A visual terminal where each row is classified by a Lua-side classifier into semantic tokens (prompt, command, stdout, stderr, etc.). Supports live PTY sessions and playback of recorded .rec.lua files. Unlike the non-visual Terminal, SemanticTerminal renders — it accepts a style prop for layout sizing.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Classifiers live in lua/classifiers/. The "basic" classifier detects prompts vs output. The "claude" classifier detects thinking, tool use, diffs, permissions, and more. Custom classifiers are Lua modules that return a classify(row_text, context) function.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* Band 6: Playback | text */}
        <Band>
          <Half>
            <SectionLabel icon="play-circle" accentColor={C.yellow}>{'PLAYBACK MODE'}</SectionLabel>
            <S.StoryBody>
              {'Record a session to a .rec.lua file, then play it back with full transport controls. Seek, step frame-by-frame, adjust speed. The timeline scrubber shows classified token boundaries. Perfect for demos, debugging, and regression testing.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Recording captures raw PTY bytes with timestamps. Playback feeds them through the same vterm + classifier pipeline as live mode — classification results are identical.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={PLAYBACK_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Band 7: Template mode | PTY types */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={TEMPLATE_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="layers" accentColor={C.peach}>{'PTY TYPES'}</SectionLabel>
            <S.StoryBody>
              {'Three session archetypes. User is a persistent login shell. Root escalates to superuser. Template spawns a fresh bash -c for each command — isolated, clean environment, perfect for running one-off scripts.'}
            </S.StoryBody>
            <CatalogList items={PTY_TYPES} />
          </Half>
        </Band>

        <Divider />

        {/* Band 8: Resize */}
        <Band>
          <Half>
            <SectionLabel icon="maximize" accentColor={C.teal}>{'RESIZE'}</SectionLabel>
            <S.StoryBody>
              {'Call resize(rows, cols) to notify the PTY of a window size change. This sends SIGWINCH to the child process, which re-queries its terminal dimensions. Apps like vim, htop, and less respond by redrawing for the new size.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={RESIZE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Full-width: architecture note */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'The PTY subsystem is entirely Lua-owned. React never polls the OS, never reads file descriptors, never touches the vterm grid. React declares what it wants (a Terminal node with these props), and Lua does the work. Events flow up via bridge callbacks. This is the proxy pattern — React is a layout declaration layer, Lua is the runtime.'}
          </S.StoryBody>
        </CalloutBand>

        </PageColumn>
      </ScrollView>

      {/* Footer */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="terminal" />
        <S.StoryBreadcrumbActive>{'PTY'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
