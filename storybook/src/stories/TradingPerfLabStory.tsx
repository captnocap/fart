import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, Badge, Slider, Switch, Tabs, BarChart, useLoveRPC } from '../../../packages/shared/src';
import type { Tab } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';

type ViewMode = '2d' | '3d';

type BookLevel = {
  price: number;
  size: number;
};

type SymbolBook = {
  symbol: string;
  last: number;
  volume: number;
  bids: BookLevel[];
  asks: BookLevel[];
  history: number[];
};

type PerfStats = {
  fps?: number;
  layoutMs?: number;
  paintMs?: number;
  nodeCount?: number;
};

type EngineRefState = {
  symbols: SymbolBook[];
  carryEvents: number;
  processedTotal: number;
  processedWindow: number;
  windowStartMs: number;
  throughput: number;
  droppedFrames: number;
  frameProcSamples: number[];
  maxFrameMs: number;
};

type Snapshot = {
  throughput: number;
  processedTotal: number;
  droppedFrames: number;
  p50: number;
  p95: number;
  maxFrameMs: number;
  selected: SymbolBook | null;
};

const VIEW_TABS: Tab[] = [
  { id: '2d', label: '2D Feed' },
  { id: '3d', label: '3D Feed' },
];

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function seeded(i: number, salt: number) {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function percentile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function makeSymbolBook(index: number, depth: number): SymbolBook {
  const base = 80 + seeded(index, 1) * 120;
  const symbol = `SY${String(index + 1).padStart(3, '0')}`;
  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  for (let i = 0; i < depth; i += 1) {
    const bidDist = 0.04 + i * 0.02 + seeded(index * 10 + i, 2) * 0.02;
    const askDist = 0.04 + i * 0.02 + seeded(index * 10 + i, 3) * 0.02;
    bids.push({
      price: +(base - bidDist).toFixed(2),
      size: Math.floor(20 + seeded(index * 10 + i, 4) * 240),
    });
    asks.push({
      price: +(base + askDist).toFixed(2),
      size: Math.floor(20 + seeded(index * 10 + i, 5) * 240),
    });
  }
  const history: number[] = [];
  let p = base;
  for (let i = 0; i < 64; i += 1) {
    p = Math.max(1, p + (seeded(index * 64 + i, 6) - 0.5) * 0.6);
    history.push(+p.toFixed(2));
  }
  return {
    symbol,
    last: +base.toFixed(2),
    volume: 24000 + Math.floor(seeded(index, 7) * 12000),
    bids,
    asks,
    history,
  };
}

function makeEngine(symbolCount: number, depth: number): EngineRefState {
  const symbols: SymbolBook[] = [];
  for (let i = 0; i < symbolCount; i += 1) {
    symbols.push(makeSymbolBook(i, depth));
  }
  return {
    symbols,
    carryEvents: 0,
    processedTotal: 0,
    processedWindow: 0,
    windowStartMs: nowMs(),
    throughput: 0,
    droppedFrames: 0,
    frameProcSamples: [],
    maxFrameMs: 0,
  };
}

function mutateSymbol(sym: SymbolBook, depth: number) {
  const drift = (Math.random() - 0.5) * 0.42;
  sym.last = Math.max(1, +(sym.last + drift).toFixed(2));
  sym.volume += 4 + Math.random() * 110;

  const target = Math.random() > 0.5 ? sym.bids : sym.asks;
  const i = Math.floor(Math.random() * depth);
  const level = target[i];
  const distance = 0.03 + i * 0.018 + Math.random() * 0.03;
  if (target === sym.bids) {
    level.price = +(sym.last - distance).toFixed(2);
  } else {
    level.price = +(sym.last + distance).toFixed(2);
  }
  level.size = Math.max(1, Math.floor(level.size + (Math.random() - 0.47) * 80));

  if (Math.random() > 0.7) {
    sym.history.push(sym.last);
    if (sym.history.length > 64) sym.history.shift();
  }
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>{label}</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          {value.toFixed(step < 1 ? 1 : 0)}
        </Text>
      </Box>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        style={{ width: 290, height: 20 }}
        trackColor="#2d3348"
        activeTrackColor="#7dc4ff"
        thumbColor="#dceeff"
        thumbSize={14}
      />
    </Box>
  );
}

function BookPanel({
  title,
  levels,
  color,
  descending,
}: {
  title: string;
  levels: BookLevel[];
  color: string;
  descending: boolean;
}) {
  const sorted = levels.slice().sort((a, b) => descending ? b.price - a.price : a.price - b.price).slice(0, 10);
  const maxSize = Math.max(1, ...sorted.map((l) => l.size));
  return (
    <Box style={{ flexGrow: 1, gap: 4 }}>
      <Text style={{ color, fontSize: 11, fontWeight: 'bold' }}>{title}</Text>
      {sorted.map((level, i) => (
        <Box key={`${title}-${i}`} style={{ position: 'relative', height: 18, justifyContent: 'center' }}>
          <Box
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(level.size / maxSize) * 100}%`,
              backgroundColor: color,
              opacity: 0.22,
              borderRadius: 3,
            }}
          />
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 6, paddingRight: 6 }}>
            <Text style={{ color: '#c7d8ec', fontSize: 10 }}>{level.price.toFixed(2)}</Text>
            <Text style={{ color: '#96adc8', fontSize: 10 }}>{Math.round(level.size)}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function Feed2D({ history }: { history: number[] }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = Math.max(0.0001, max - min);
  const data = history.map((v, i) => ({
    label: i % 8 === 0 ? String(i) : '',
    value: ((v - min) / range) * 100 + 4,
    color: i > 0 && history[i] >= history[i - 1] ? '#22c55e' : '#ef4444',
  }));
  return <BarChart data={data} height={280} gap={2} showLabels={false} interactive />;
}

function Feed3D({ history, spin }: { history: number[]; spin: number }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = Math.max(0.0001, max - min);
  const spacing = 0.18;
  const width = history.length * spacing;
  return (
    <Scene style={{ width: '100%', height: '100%' }} backgroundColor="#040912" stars>
      <Camera position={[0, -6.7, 3.1]} lookAt={[0, 0, 1]} fov={0.9} />
      <AmbientLight color="#1b2438" intensity={0.38} />
      <DirectionalLight direction={[-0.7, 0.8, -0.25]} color="#ffe7d0" intensity={1.2} />

      <Mesh
        geometry="plane"
        color="#102038"
        edgeColor="#2d4c78"
        edgeWidth={0.01}
        position={[0, 0, -0.2]}
        scale={[width * 0.55, 1.8, 1]}
        rotation={[0, 0, spin * 0.04]}
      />

      {history.map((v, i) => {
        const prev = i > 0 ? history[i - 1] : v;
        const x = (i - (history.length - 1) / 2) * spacing;
        const h = ((v - min) / range) * 2.2 + 0.06;
        const up = v >= prev;
        return (
          <Mesh
            key={`hist-3d-${i}`}
            geometry="box"
            color={up ? '#34d399' : '#f87171'}
            edgeColor="#0f172a"
            edgeWidth={0.018}
            position={[x, 0, h / 2]}
            scale={[0.11, 0.1, h]}
            rotation={[0, 0, spin * 0.02 + i * 0.01]}
            specular={24}
          />
        );
      })}
    </Scene>
  );
}

export function TradingPerfLabStory() {
  const c = useThemeColors();
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [live, setLive] = useState(true);
  const [symbolCount, setSymbolCount] = useState(120);
  const [depth, setDepth] = useState(30);
  const [targetEvents, setTargetEvents] = useState(60000);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spin, setSpin] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    throughput: 0,
    processedTotal: 0,
    droppedFrames: 0,
    p50: 0,
    p95: 0,
    maxFrameMs: 0,
    selected: null,
  });
  const [runtimePerf, setRuntimePerf] = useState<PerfStats>({});
  const getPerf = useLoveRPC<PerfStats>('dev:perf');
  const engineRef = useRef<EngineRefState>(makeEngine(symbolCount, depth));

  useEffect(() => {
    engineRef.current = makeEngine(symbolCount, depth);
    setSelectedIndex((prev) => Math.min(prev, symbolCount - 1));
  }, [symbolCount, depth]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!live) return;

      const engine = engineRef.current;
      const frameStart = nowMs();
      engine.carryEvents += targetEvents / 60;
      const batch = Math.floor(engine.carryEvents);
      engine.carryEvents -= batch;

      for (let i = 0; i < batch; i += 1) {
        const idx = Math.floor(Math.random() * engine.symbols.length);
        mutateSymbol(engine.symbols[idx], depth);
      }

      const procMs = nowMs() - frameStart;
      engine.processedTotal += batch;
      engine.processedWindow += batch;
      engine.frameProcSamples.push(procMs);
      if (engine.frameProcSamples.length > 240) engine.frameProcSamples.shift();
      engine.maxFrameMs = Math.max(engine.maxFrameMs, procMs);
      if (procMs > 16.6) engine.droppedFrames += 1;

      const now = nowMs();
      const elapsed = now - engine.windowStartMs;
      if (elapsed >= 1000) {
        engine.throughput = Math.round((engine.processedWindow * 1000) / elapsed);
        engine.processedWindow = 0;
        engine.windowStartMs = now;
        engine.maxFrameMs = 0;
      }

      setSpin((s) => s + 0.02);
    }, 16);
    return () => clearInterval(id);
  }, [live, targetEvents, depth]);

  useEffect(() => {
    const id = setInterval(() => {
      const engine = engineRef.current;
      const selected = engine.symbols[Math.max(0, Math.min(selectedIndex, engine.symbols.length - 1))] || null;
      setSnapshot({
        throughput: engine.throughput,
        processedTotal: engine.processedTotal,
        droppedFrames: engine.droppedFrames,
        p50: percentile(engine.frameProcSamples, 0.5),
        p95: percentile(engine.frameProcSamples, 0.95),
        maxFrameMs: engine.maxFrameMs,
        selected,
      });
    }, 250);
    return () => clearInterval(id);
  }, [selectedIndex]);

  useEffect(() => {
    let disposed = false;
    const sample = async () => {
      try {
        const next = await getPerf();
        if (!disposed && next && typeof next === 'object') {
          setRuntimePerf(next);
        }
      } catch (_err) {
        // Optional in non-native paths
      }
    };
    sample();
    const id = setInterval(sample, 500);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [getPerf]);

  const selected = snapshot.selected;
  const fps = typeof runtimePerf.fps === 'number' ? runtimePerf.fps : 0;
  const layoutMs = typeof runtimePerf.layoutMs === 'number' ? runtimePerf.layoutMs : 0;
  const paintMs = typeof runtimePerf.paintMs === 'number' ? runtimePerf.paintMs : 0;
  const nodeCount = typeof runtimePerf.nodeCount === 'number' ? runtimePerf.nodeCount : 0;
  const totalFrameWork = layoutMs + paintMs;
  const fpsVariant = fps >= 55 ? 'success' : fps >= 40 ? 'warning' : 'error';

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
        Trading Performance Lab
      </Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        Synthetic market feed + order book workload to demonstrate commercial/enterprise-style runtime behavior
      </Text>

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Badge label={`Target ${targetEvents.toLocaleString()}/s`} variant="info" />
        <Badge label={`Actual ${snapshot.throughput.toLocaleString()}/s`} variant={snapshot.throughput >= targetEvents * 0.8 ? 'success' : 'warning'} />
        <Badge label={`p50 ${snapshot.p50.toFixed(2)}ms`} variant="default" />
        <Badge label={`p95 ${snapshot.p95.toFixed(2)}ms`} variant={snapshot.p95 < 8 ? 'success' : snapshot.p95 < 16 ? 'warning' : 'error'} />
        <Badge label={`FPS ${fps || '--'}`} variant={fpsVariant} />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 12, flexGrow: 1 }}>
        <Box
          style={{
            width: 320,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.bgElevated,
            gap: 10,
          }}
        >
          <Box style={{ width: 180 }}>
            <Tabs tabs={VIEW_TABS} activeId={viewMode} onSelect={(id) => setViewMode(id as ViewMode)} variant="pill" />
          </Box>

          <LabeledSlider label="Symbols" value={symbolCount} min={20} max={320} step={10} onChange={setSymbolCount} />
          <LabeledSlider label="Book Depth" value={depth} min={10} max={80} step={2} onChange={setDepth} />
          <LabeledSlider label="Target Events/sec" value={targetEvents} min={5000} max={200000} step={5000} onChange={setTargetEvents} />
          <LabeledSlider label="Focus Symbol" value={selectedIndex} min={0} max={Math.max(0, symbolCount - 1)} step={1} onChange={setSelectedIndex} />

          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Simulation</Text>
            <Switch value={live} onValueChange={setLive} />
          </Box>

          <Box
            style={{
              backgroundColor: c.bg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c.border,
              padding: 8,
              gap: 3,
            }}
          >
            <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>
              Runtime
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {`fps ${fps || '--'} | layout ${layoutMs.toFixed(1)}ms | paint ${paintMs.toFixed(1)}ms`}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 10 }}>
              {`total ${totalFrameWork.toFixed(1)}ms | nodes ${nodeCount || '--'}`}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 10 }}>
              {`processed ${snapshot.processedTotal.toLocaleString()} events | drops ${snapshot.droppedFrames}`}
            </Text>
          </Box>
        </Box>

        <Box
          style={{
            flexGrow: 1,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 10,
            backgroundColor: '#0a1020',
            padding: 12,
            gap: 10,
          }}
        >
          {selected && (
            <>
              <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={selected.symbol} variant="default" />
                <Badge label={`Last ${selected.last.toFixed(2)}`} variant="info" />
                <Badge label={`Vol ${Math.round(selected.volume).toLocaleString()}`} variant="default" />
                <Badge label={`Frame max ${snapshot.maxFrameMs.toFixed(2)}ms`} variant="warning" />
              </Box>

              <Box style={{ flexDirection: 'row', gap: 10, flexGrow: 1, minHeight: 320 }}>
                <Box style={{ flexGrow: 1, minHeight: 300 }}>
                  {viewMode === '2d' ? (
                    <Feed2D history={selected.history} />
                  ) : (
                    <Feed3D history={selected.history} spin={spin} />
                  )}
                </Box>

                <Box
                  style={{
                    width: 260,
                    backgroundColor: '#0f1629',
                    borderWidth: 1,
                    borderColor: '#233150',
                    borderRadius: 8,
                    padding: 8,
                    gap: 8,
                  }}
                >
                  <BookPanel title="Bids" levels={selected.bids} color="#22c55e" descending />
                  <BookPanel title="Asks" levels={selected.asks} color="#ef4444" descending={false} />
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
