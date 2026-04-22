const React: any = require('react');
const { useState, useMemo, useCallback, useEffect } = React;
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { WorkerTile, type Worker, type WorkerStatus } from './WorkerTile';
import { WorkerStrip } from './WorkerStrip';
import { HoverPressable } from '../shared';

const ACCENTS = ['#2d62ff', '#ff7b72', '#7ee787', '#d2a8ff', '#ffb86b', '#79c0ff', '#ff6bcb', '#f2e05a'];
const STATUSES: WorkerStatus[] = ['thinking', 'tool', 'idle', 'stuck', 'rationalizing', 'thinking', 'tool', 'done'];
const TASKS = [
  'worker-cockpit', 'worker-gitpanel-refactor', 'worker-settings-polish', 'worker-chat-export',
  'worker-apikey-rewire', 'worker-terminal-playback', 'worker-diff-viewer', 'worker-indexer-tune',
];
const TOOLS = [
  'Read(cart/cursor-ide/index.tsx)',
  'Edit(components/gitpanel.tsx) — +142 −38',
  'Bash(./scripts/ship cursor-ide)',
  'Grep("activeView") → 14 matches',
  'Write(components/cockpit/WorkerTile.tsx)',
  'Read(FEATURES.md, offset=200)',
  'Bash(git add . && git commit)',
  'Edit(theme.ts) — tweak accent palette',
];
const MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'kimi-k2', 'gpt-5'];

export function seedFakeWorkers(n: number = 8): Worker[] {
  const out: Worker[] = [];
  const cols = 3;
  const pad = 32;
  const w = 260 + pad;
  const h = 168 + pad;
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({
      id: String(i + 1).padStart(2, '0'),
      name: 'worker-' + String(i + 1).padStart(2, '0'),
      model: MODELS[i % MODELS.length],
      status: STATUSES[i % STATUSES.length],
      accent: ACCENTS[i % ACCENTS.length],
      latestTool: TOOLS[i % TOOLS.length],
      taskSlug: TASKS[i % TASKS.length],
      heartbeat: 3 + ((i * 3) % 6),
      x: 40 + col * w,
      y: 40 + row * h,
    });
  }
  return out;
}

export interface WorkerCanvasProps {
  widthBand?: string;
  windowHeight?: number;
}

export type CockpitMode = 'brainstorm' | 'enforce';

export function WorkerCanvas(_props: WorkerCanvasProps) {
  const initial = useMemo(() => seedFakeWorkers(8), []);
  const [workers] = useState<Worker[]>(initial);
  const [focusedId, setFocusedId] = useState<string | null>(initial[0]?.id || null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<CockpitMode>('enforce');

  const pan = useCallback((dx: number, dy: number) => {
    setOffsetX((v: number) => v + dx);
    setOffsetY((v: number) => v + dy);
  }, []);

  const focusWorker = useCallback((id: string) => {
    setFocusedId(id);
    const w = initial.find((x) => x.id === id);
    if (w) { setOffsetX(-w.x + 240); setOffsetY(-w.y + 180); }
  }, [initial]);

  // Keyboard shortcuts: 1-9 jump to worker N, B/E toggle mode
  useEffect(() => {
    const handler = (e: any) => {
      const k = e && (e.key || '');
      if (k >= '1' && k <= '9') {
        const idx = parseInt(k, 10) - 1;
        if (idx < initial.length) focusWorker(initial[idx].id);
      } else if (k === 'b' || k === 'B') {
        setMode('brainstorm');
      } else if (k === 'e' || k === 'E') {
        setMode('enforce');
      }
    };
    try {
      const g: any = globalThis as any;
      const target = (typeof g.window !== 'undefined' ? g.window : g.document) || null;
      if (target && target.addEventListener) {
        target.addEventListener('keydown', handler);
        return () => { try { target.removeEventListener('keydown', handler); } catch (_) {} };
      }
    } catch (_) {}
    return undefined;
  }, [initial, focusWorker]);

  const reset = useCallback(() => { setOffsetX(0); setOffsetY(0); setZoom(1); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    workers.forEach((w) => { c[w.status] = (c[w.status] || 0) + 1; });
    return c;
  }, [workers]);

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, backgroundColor: '#02050a', minHeight: 0 }}>
      {/* Cockpit header strip — game HUD */}
      <Row style={{
        height: 48, paddingHorizontal: 14, alignItems: 'center', gap: 12,
        backgroundColor: '#05090f', borderBottomWidth: 1, borderColor: '#1a222c',
      }}>
        <Text style={{ color: '#2d62ff', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>◆ COCKPIT</Text>
        <Text style={{ color: '#5c6a78', fontSize: 11 }}>worker supervisor · {workers.length} tiles</Text>
        <ModeToggle mode={mode} onChange={setMode} />
        <Box style={{ flexGrow: 1 }} />
        <HudCount label="THINK"   n={counts.thinking      || 0} color="#79c0ff" />
        <HudCount label="TOOL"    n={counts.tool          || 0} color="#7ee787" />
        <HudCount label="STUCK"   n={counts.stuck         || 0} color="#ffb86b" />
        <HudCount label="FLAGGED" n={counts.rationalizing || 0} color="#ff6b6b" />
        <HudCount label="IDLE"    n={counts.idle          || 0} color="#5c6a78" />
        <Box style={{ width: 1, height: 22, backgroundColor: '#1a222c', marginHorizontal: 6 }} />
        <PanBtn label="◀" onPress={() => pan(120, 0)} />
        <PanBtn label="▲" onPress={() => pan(0, 120)} />
        <PanBtn label="▼" onPress={() => pan(0, -120)} />
        <PanBtn label="▶" onPress={() => pan(-120, 0)} />
        <PanBtn label="−" onPress={() => setZoom((z: number) => Math.max(0.5, z - 0.1))} />
        <PanBtn label="+" onPress={() => setZoom((z: number) => Math.min(1.6, z + 0.1))} />
        <PanBtn label="⟳" onPress={reset} />
      </Row>

      {/* Pannable canvas surface */}
      <Box style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* grid backdrop */}
        <Box style={{
          position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
          backgroundColor: '#02050a',
        }} />
        <GridBackdrop offsetX={offsetX} offsetY={offsetY} />
        {mode === 'enforce' ? (
          <Box style={{ position: 'absolute', left: offsetX, top: offsetY, width: 2400, height: 1600 }}>
            {workers.map((w) => (
              <WorkerTile key={w.id} worker={w} focused={w.id === focusedId} onFocus={focusWorker} />
            ))}
          </Box>
        ) : (
          <BrainstormPanel />
        )}
        {/* mini-legend overlay */}
        <Box style={{
          position: 'absolute', right: 14, bottom: 14,
          backgroundColor: '#0b1018', borderWidth: 1, borderColor: '#1f2630', borderRadius: 8,
          padding: 10, gap: 4,
        }}>
          <Text style={{ color: '#5c6a78', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>VIEW</Text>
          <Text style={{ color: '#e6edf3', fontSize: 11 }}>pan {offsetX},{offsetY}</Text>
          <Text style={{ color: '#e6edf3', fontSize: 11 }}>zoom {zoom.toFixed(2)}x</Text>
        </Box>
      </Box>

      {/* persistent bottom strip */}
      <WorkerStrip workers={workers} focusedId={focusedId} onFocus={focusWorker} />
    </Col>
  );
}

function HudCount({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: '#8b98a6', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: 700 }}>{n}</Text>
    </Row>
  );
}

function PanBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <HoverPressable onPress={onPress} style={{
      width: 26, height: 26, borderRadius: 6,
      backgroundColor: '#0b1018', borderWidth: 1, borderColor: '#1f2630',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#8b98a6', fontSize: 12, fontWeight: 700 }}>{label}</Text>
    </HoverPressable>
  );
}

function ModeToggle({ mode, onChange }: { mode: CockpitMode; onChange: (m: CockpitMode) => void }) {
  const btn = (m: CockpitMode, label: string, color: string) => {
    const active = mode === m;
    return (
      <Pressable onPress={() => onChange(m)} style={{
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
        backgroundColor: active ? color : '#0b1018',
        borderWidth: 1, borderColor: active ? color : '#1f2630',
      }}>
        <Text style={{ color: active ? '#05090f' : color, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <Row style={{ gap: 4, marginLeft: 8 }}>
      {btn('brainstorm', 'BRAINSTORM', '#d2a8ff')}
      {btn('enforce', 'ENFORCE', '#7ee787')}
    </Row>
  );
}

function BrainstormPanel() {
  return (
    <Box style={{
      position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Box style={{
        width: 520, maxWidth: '80%',
        backgroundColor: '#0b1018',
        borderWidth: 1, borderColor: '#2a1840',
        borderRadius: 12, padding: 20, gap: 12,
      }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#d2a8ff' }} />
          <Text style={{ color: '#d2a8ff', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>BRAINSTORM MODE</Text>
        </Row>
        <Text style={{ color: '#e6edf3', fontSize: 16, fontWeight: 700 }}>What are we exploring?</Text>
        <Text style={{ color: '#8b98a6', fontSize: 12 }}>Worker tiles hidden. Talk through the feature with the supervisor. Past bundles touching the same area will auto-surface as chips. When ready, crystallize → switch to ENFORCE to spawn workers against the spec.</Text>
        <Box style={{
          backgroundColor: '#05090f', borderRadius: 8, borderWidth: 1, borderColor: '#1f2630',
          padding: 12, minHeight: 120,
        }}>
          <Text style={{ color: '#5c6a78', fontSize: 11 }}>[ conversation surface placeholder ]</Text>
        </Box>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Chip label="prior: cursor-ide plan surface" />
          <Chip label="prior: worker lifecycle policy" />
          <Chip label="prior: fake-green pathology" />
        </Row>
      </Box>
    </Box>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <Box style={{
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
      backgroundColor: '#173048', borderWidth: 1, borderColor: '#2a4d6e',
    }}>
      <Text style={{ color: '#79c0ff', fontSize: 10 }}>{label}</Text>
    </Box>
  );
}

function GridBackdrop({ offsetX, offsetY }: { offsetX: number; offsetY: number }) {
  const lines = [];
  const step = 80;
  const modX = ((offsetX % step) + step) % step;
  const modY = ((offsetY % step) + step) % step;
  for (let i = 0; i < 40; i++) {
    lines.push(<Box key={'v' + i} style={{
      position: 'absolute', left: modX + i * step, top: 0, bottom: 0, width: 1,
      backgroundColor: i % 4 === 0 ? '#0f1620' : '#080c12',
    }} />);
  }
  for (let i = 0; i < 24; i++) {
    lines.push(<Box key={'h' + i} style={{
      position: 'absolute', top: modY + i * step, left: 0, right: 0, height: 1,
      backgroundColor: i % 4 === 0 ? '#0f1620' : '#080c12',
    }} />);
  }
  return <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>{lines}</Box>;
}
