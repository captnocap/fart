/* global React, ReactDOM, SIM, Cockpit, Cockpit2 */
const { useState, useEffect, useRef, useMemo } = React;
const {
  WorkerTile, QueueTile, SpecTile, AutotestTile, ScreenshotTile,
  LawTile, BrainstormPanel, useInterval, GitAuditTile,
} = Cockpit;
const { KernelCube, MemoryCube, PlanBoard, SupervisorChat, StatsTile } = Cockpit2;

// Larger canvas for v2 — more tiles
const CANVAS_W = 1880;
const CANVAS_H = 1040;

const LAYOUT = {
  // Top row — 5 worker tiles
  w1: { left: 16,   top: 16, width: 220, height: 140 },
  w2: { left: 252,  top: 16, width: 220, height: 140 },
  w3: { left: 488,  top: 16, width: 260, height: 140 },
  w4: { left: 764,  top: 16, width: 240, height: 140 },
  w5: { left: 1020, top: 16, width: 360, height: 140 },

  // Focused large worker tile
  focus: { left: 16, top: 172, width: 600, height: 460 },

  // KERNEL CUBE (big, stacked tetris+sparkline+mix)
  kernel: { left: 632, top: 172, width: 420, height: 460 },

  // MEMORY CUBE (big, 4-chart grid)
  memory: { left: 1068, top: 172, width: 520, height: 460 },

  // Supervisor chat — right rail top
  chat: { left: 1604, top: 16, width: 260, height: 616 },

  // Spec anchor — under focused
  spec: { left: 16, top: 648, width: 600, height: 180 },

  // Planning board — middle-center below kernel/memory
  board: { left: 632, top: 648, width: 956, height: 264 },

  // Stats — right rail lower
  stats: { left: 1604, top: 648, width: 260, height: 400 },

  // Queue — below spec
  queue: { left: 16, top: 844, width: 600, height: 168 },

  // Autotest + law + screenshots row at bottom
  autotest: { left: 632, top: 928, width: 310, height: 108 },
  law:      { left: 958, top: 928, width: 310, height: 108 },
  shots:    { left: 1284, top: 928, width: 304, height: 108 },
};

function Topbar({ mode, onBrainstorm, onTweaks }) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  return (
    <div className="topbar no-sel">
      <span className="brand">SWEATSHOP</span>
      <span className="sep">·</span>
      <span>cockpit · v2</span>
      <span className="sep">│</span>
      <div className={`mode-pill ${mode}`} onClick={onBrainstorm}>
        <span className="dot" />{mode === 'enforce' ? 'ENFORCE' : 'BRAINSTORM'}
      </div>
      <span className="hk">
        <kbd>⌘K</kbd> mode  <kbd>1-5</kbd> focus  <kbd>T</kbd> tweaks  <kbd>esc</kbd> close
      </span>
      <div className="right">
        <span className="metric"><span className="label">workers</span>5/5</span>
        <span className="metric"><span className="label">threat</span><span style={{ color: 'var(--flag)' }}>T2</span></span>
        <span className="metric"><span className="label">kernel</span>64%</span>
        <span className="metric"><span className="label">tok/s</span>128</span>
        <span className="metric"><span className="label">edit-trail</span><span style={{ color: 'var(--ok)' }}>●</span> live</span>
        <span className="metric">{time}</span>
        <span className="metric" style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={onTweaks}>◉ tweaks</span>
      </div>
    </div>
  );
}

function Statusbar({ mode }) {
  return (
    <div className="statusbar no-sel">
      <span>mode · <b style={{ color: 'var(--accent)' }}>{mode}</b></span>
      <span>│</span>
      <span>hooks · <span className="ok">supervisor-log · auto-commit · guard-build · session-ping · edit-log · preflight</span></span>
      <span>│</span>
      <span>classifiers · <span className="ok">5 local llama</span></span>
      <span className="spacer" />
      <span>supervisor.db · 2.4 GB · 847 sessions</span>
      <span>│</span>
      <span>v3.0.0-sweatshop</span>
    </div>
  );
}

function WorkerStrip({ workers, focusId, setFocusId }) {
  return (
    <div className="strip no-sel">
      <span className="label">workers</span>
      {workers.map((w) => (
        <div key={w.id} className={`slot ${focusId === w.id ? 'focus' : ''}`} onClick={() => setFocusId(w.id)}>
          <span className={`dot ${w.status}`} />
          <span>{w.name}</span>
          <span style={{ color: 'var(--ink-dimmer)', fontSize: 9 }}>{w.task.split('/').pop()}</span>
        </div>
      ))}
      <span className="sep">│</span>
      <div className="slot" style={{ borderStyle: 'dashed', color: 'var(--ink-dimmer)' }}>+ spawn</div>
      <span className="count">ply · <b>14</b> commits/h · <b>2</b> flags/h · <b>0</b> blocks · <b>712h</b> lifetime</span>
    </div>
  );
}

function Tweaks({ on, state, set, onClose }) {
  return (
    <div className={`tweaks ${on ? 'on' : ''}`}>
      <div className="head">
        <span>tweaks</span>
        <span style={{ cursor: 'pointer', color: 'var(--ink-dimmer)' }} onClick={onClose}>×</span>
      </div>
      <div className="group">
        <div className="row"><label>canvas zoom</label><span className="val">{state.zoom.toFixed(2)}</span></div>
        <input type="range" min="0.4" max="1.4" step="0.02" value={state.zoom} onChange={(e) => set({ zoom: parseFloat(e.target.value) })} />
      </div>
      <div className="group">
        <div className="row"><label>accent</label></div>
        <div className="seg">
          <button className={state.accent === 'orange' ? 'on' : ''} onClick={() => set({ accent: 'orange' })}>orange</button>
          <button className={state.accent === 'amber' ? 'on' : ''} onClick={() => set({ accent: 'amber' })}>amber</button>
          <button className={state.accent === 'red' ? 'on' : ''} onClick={() => set({ accent: 'red' })}>red</button>
          <button className={state.accent === 'teal' ? 'on' : ''} onClick={() => set({ accent: 'teal' })}>teal</button>
        </div>
      </div>
      <div className="group">
        <div className="row"><label>focused worker</label></div>
        <div className="seg">
          {SIM.WORKERS.map((w) => (
            <button key={w.id} className={state.focus === w.id ? 'on' : ''} onClick={() => set({ focus: w.id })}>{w.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState('enforce');
  const [focusId, setFocusId] = useState(() => localStorage.getItem('sws.focus.v2') || 'w3');
  const [brainstorm, setBrainstorm] = useState(false);
  const [tweaks, setTweaks] = useState({ zoom: 1, accent: 'orange', focus: 'w3' });
  const [tweaksOn, setTweaksOn] = useState(false);
  const setTw = (p) => setTweaks((t) => ({ ...t, ...p }));

  useEffect(() => {
    const map = {
      orange: { a: '#d26a2a', h: '#e8501c', r: '#8a4a20' },
      amber:  { a: '#d6a54a', h: '#e8a51c', r: '#7a5a20' },
      red:    { a: '#e14a2a', h: '#ff3a1a', r: '#8a2a1a' },
      teal:   { a: '#4aaea0', h: '#2ac0a0', r: '#2a6a5a' },
    };
    const c = map[tweaks.accent];
    document.documentElement.style.setProperty('--accent', c.a);
    document.documentElement.style.setProperty('--accent-hot', c.h);
    document.documentElement.style.setProperty('--rule-bright', c.r);
  }, [tweaks.accent]);

  useEffect(() => { if (tweaks.focus !== focusId) setFocusId(tweaks.focus); }, [tweaks.focus]);
  useEffect(() => { setTw({ focus: focusId }); localStorage.setItem('sws.focus.v2', focusId); }, [focusId]);

  const [laws, setLaws] = useState(() => SIM.LAWS.slice(0, 4));
  useInterval(() => {
    setLaws((ls) => [SIM.pick(SIM.LAWS), ...ls].slice(0, 8));
  }, 3600);

  const workers = SIM.WORKERS;
  const focusedWorker = workers.find((w) => w.id === focusId) || workers[0];

  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const recompute = () => {
      if (!viewportRef.current) return;
      const r = viewportRef.current.getBoundingClientRect();
      const availH = r.height - 28;
      const s = Math.min(r.width / CANVAS_W, availH / CANVAS_H) * tweaks.zoom;
      setScale(Math.max(0.15, s));
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [tweaks.zoom]);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (brainstorm) { setBrainstorm(false); setMode('enforce'); return; }
        if (tweaksOn) { setTweaksOn(false); return; }
      }
      if (e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (mode === 'enforce') { setBrainstorm(true); setMode('brainstorm'); }
        else { setBrainstorm(false); setMode('enforce'); }
      }
      if (/^[1-5]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (workers[idx]) setFocusId(workers[idx].id);
      }
      if (e.key.toLowerCase() === 't') setTweaksOn((x) => !x);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [brainstorm, tweaksOn, mode, workers]);

  return (
    <div className="cockpit" data-screen-label="Sweatshop Cockpit v2">
      <Topbar
        mode={mode}
        onBrainstorm={() => {
          if (mode === 'enforce') { setBrainstorm(true); setMode('brainstorm'); }
          else { setBrainstorm(false); setMode('enforce'); }
        }}
        onTweaks={() => setTweaksOn((x) => !x)}
      />

      <div className="canvas-viewport" ref={viewportRef}>
        <div className="canvas-inner" style={{
          width: CANVAS_W, height: CANVAS_H,
          transform: `translate(${Math.max(0, ((viewportRef.current?.clientWidth || 0) - CANVAS_W * scale) / 2)}px, 4px) scale(${scale})`,
        }}>
          {workers.map((w) => (
            <WorkerTile key={w.id} worker={w} focused={focusId === w.id} onFocus={setFocusId} pos={LAYOUT[w.id]} />
          ))}

          <WorkerTile key={`focus-${focusedWorker.id}`} worker={focusedWorker} focused onFocus={() => {}} pos={LAYOUT.focus} />

          <KernelCube pos={LAYOUT.kernel} />
          <MemoryCube pos={LAYOUT.memory} />
          <SupervisorChat pos={LAYOUT.chat} />
          <SpecTile pos={LAYOUT.spec} />
          <PlanBoard pos={LAYOUT.board} />
          <StatsTile pos={LAYOUT.stats} />
          <QueueTile pos={LAYOUT.queue} onAct={() => {}} />
          <AutotestTile pos={LAYOUT.autotest} />
          <LawTile pos={LAYOUT.law} laws={laws} />
          <ScreenshotTile pos={LAYOUT.shots} />
        </div>

        <WorkerStrip workers={workers} focusId={focusId} setFocusId={setFocusId} />

        {brainstorm && (
          <BrainstormPanel
            onCrystallize={() => { setBrainstorm(false); setMode('enforce'); }}
            onClose={() => { setBrainstorm(false); setMode('enforce'); }}
          />
        )}

        <Tweaks on={tweaksOn} state={tweaks} set={setTw} onClose={() => setTweaksOn(false)} />
      </div>

      <Statusbar mode={mode} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
