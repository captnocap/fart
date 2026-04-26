/* global React, SIM */
const { useState, useEffect, useMemo, useRef } = React;

// ==== helpers reused across tiles ====
function useInterval2(fn, ms, active = true) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }, [fn, ms, active]);
}

function Corners2() {
  return (
    <>
      <span className="corner tl" /><span className="corner tr" />
      <span className="corner bl" /><span className="corner br" />
    </>
  );
}

function TileHead2({ id, title, right }) {
  return (
    <div className="tile-head">
      <span className="id">{id}</span>
      <span className="ttl">{title}</span>
      <span className="right">{right}</span>
    </div>
  );
}

// =========== KERNEL CUBE CLUSTER ===========
// Three stacked mini-tiles forming a "kernel cube" strip:
// 1) tetris budget fill (bottom-up)
// 2) token-rate sparkline over last 60s
// 3) source mix horizontal bar breakdown

function KernelCube({ pos }) {
  const COLS = 26, ROWS = 10;
  const [payload, setPayload] = useState([
    { type: 'sys', t: 10 },  { type: 'ctx', t: 32 }, { type: 'usr', t: 18 },
    { type: 'ast', t: 24 }, { type: 'tool', t: 18 }, { type: 'atch', t: 8 },
    { type: 'pin', t: 10 },  { type: 'wnd', t: 6 },  { type: 'ast', t: 20 },
    { type: 'tool', t: 14 }, { type: 'ctx', t: 18 }, { type: 'usr', t: 10 },
  ]);
  const [rate, setRate] = useState(() => Array.from({ length: 40 }, () => 40 + Math.random() * 80));
  const [burst, setBurst] = useState(false);

  useInterval2(() => {
    setPayload((p) => {
      const total = p.reduce((a, x) => a + x.t, 0);
      const cap = COLS * ROWS;
      if (total > cap * 0.95) return p.slice(2);
      const kind = SIM.pick(['sys','ctx','usr','ast','tool','atch','pin','wnd']);
      return [...p, { type: kind, t: 2 + Math.floor(Math.random() * 8) }];
    });
    setRate((r) => {
      const last = r[r.length - 1];
      const drift = (Math.random() - 0.5) * 30;
      const spike = Math.random() > 0.92 ? 120 : 0;
      const v = Math.max(10, Math.min(220, last + drift + spike));
      if (spike) setBurst(true), setTimeout(() => setBurst(false), 800);
      return [...r.slice(1), v];
    });
  }, 700);

  const cells = useMemo(() => {
    const arr = new Array(COLS * ROWS).fill(null);
    let i = 0;
    for (const item of payload) for (let k = 0; k < item.t && i < arr.length; k++, i++) arr[i] = item.type;
    return arr;
  }, [payload]);

  const total = payload.reduce((a, x) => a + x.t, 0);
  const cap = COLS * ROWS;
  const pct = Math.round((total / cap) * 100);

  // Source mix aggregation for the horizontal breakdown bar
  const mix = useMemo(() => {
    const m = {};
    for (const p of payload) m[p.type] = (m[p.type] || 0) + p.t;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [payload]);

  const curRate = rate[rate.length - 1];
  const avgRate = rate.reduce((a, b) => a + b, 0) / rate.length;

  return (
    <div className="tile kernel-cube" style={pos}>
      <Corners2 />
      <TileHead2
        id="KRN"
        title="context kernel · live"
        right={
          <>
            <span style={{ color: burst ? 'var(--flag)' : 'var(--accent)' }}>
              {pct}% · {total}/{cap} tok
            </span>
          </>
        }
      />
      <div className="tile-body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Tetris fill */}
        <div style={{ flex: 1, position: 'relative', borderBottom: '1px solid var(--rule)' }}>
          <div className="tetris-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)`, position: 'absolute', inset: 0 }}>
            {Array.from({ length: ROWS }).map((_, rowFromTop) => {
              const row = ROWS - 1 - rowFromTop;
              return Array.from({ length: COLS }).map((__, col) => {
                const idx = row * COLS + col;
                const v = cells[idx];
                return <span key={`${row}-${col}`} className={`tetris-cell ${v ? 'tc-' + v : ''}`} />;
              });
            })}
          </div>
        </div>

        {/* Rate sparkline */}
        <div style={{ height: 52, padding: '4px 8px', borderBottom: '1px solid var(--rule)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--ink-dimmer)', letterSpacing: '0.1em' }}>
            <span>TOK/S</span>
            <span style={{ color: 'var(--accent)' }}>{Math.round(curRate)}</span>
            <span>avg {Math.round(avgRate)}</span>
            <span>peak {Math.round(Math.max(...rate))}</span>
          </div>
          <svg viewBox="0 0 400 30" preserveAspectRatio="none" style={{ width: '100%', height: 30 }}>
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1"
              points={rate.map((v, i) => `${(i / (rate.length - 1)) * 400},${30 - (v / 220) * 28}`).join(' ')}
            />
            <polygon
              fill="var(--accent)"
              opacity="0.12"
              points={`0,30 ${rate.map((v, i) => `${(i / (rate.length - 1)) * 400},${30 - (v / 220) * 28}`).join(' ')} 400,30`}
            />
          </svg>
        </div>

        {/* Source mix horizontal bar */}
        <div style={{ padding: '4px 8px 6px', fontSize: 8, color: 'var(--ink-dimmer)', letterSpacing: '0.1em' }}>
          <div style={{ marginBottom: 3 }}>SOURCE MIX</div>
          <div style={{ display: 'flex', height: 8, border: '1px solid var(--rule)', background: 'var(--bg-2)' }}>
            {mix.map(([k, v]) => (
              <div key={k} className={`tc-${k}`} style={{ flex: v, height: '100%' }} title={`${k}: ${v}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {mix.slice(0, 5).map(([k, v]) => (
              <span key={k} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                <i className={`tc-${k}`} style={{ display: 'inline-block', width: 6, height: 6 }} />
                <span style={{ color: 'var(--ink-dim)' }}>{k}</span>
                <span style={{ color: 'var(--ink-dimmer)' }}>{Math.round(v / total * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========== MEMORY CUBE: bigger, more chart variety ===========
function MemoryCube({ pos }) {
  // Heatmap (bundle retrievals, 7 days x 24 hours)
  const [heat, setHeat] = useState(() =>
    Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.random() * 0.7))
  );
  // River (sliding L1 buffer)
  const [river, setRiver] = useState(() => Array.from({ length: 40 }, () => 0.2 + Math.random() * 0.8));
  // Wound intensity (L4) over time per worker
  const [woundHist, setWoundHist] = useState(() => ({
    w1: Array.from({ length: 30 }, () => Math.random() * 0.3),
    w2: Array.from({ length: 30 }, () => Math.random() * 0.5),
    w3: Array.from({ length: 30 }, () => Math.random() * 0.2),
    w4: Array.from({ length: 30 }, () => 0.4 + Math.random() * 0.6),
    w5: Array.from({ length: 30 }, () => Math.random() * 0.25),
  }));
  // Affect category distribution (donut)
  const [affect, setAffect] = useState({ confident: 42, uncertain: 18, stuck: 8, rationalizing: 6, curious: 26 });

  useInterval2(() => {
    setHeat((h) => h.map((row, r) => row.map((v, c) => {
      const nudge = (Math.random() - 0.45) * 0.15;
      return Math.max(0, Math.min(1, v + nudge));
    })));
    setRiver((r) => [...r.slice(1), 0.2 + Math.random() * 0.8]);
    setWoundHist((wh) => {
      const next = {};
      for (const k of Object.keys(wh)) {
        const last = wh[k][wh[k].length - 1];
        const nv = Math.max(0, Math.min(1, last + (Math.random() - 0.5) * 0.2));
        next[k] = [...wh[k].slice(1), nv];
      }
      return next;
    });
    setAffect((a) => {
      const keys = Object.keys(a);
      const k1 = SIM.pick(keys); const k2 = SIM.pick(keys);
      if (k1 === k2) return a;
      const d = Math.floor(Math.random() * 3);
      return { ...a, [k1]: Math.max(2, a[k1] - d), [k2]: a[k2] + d };
    });
  }, 900);

  const affTotal = Object.values(affect).reduce((a, b) => a + b, 0);
  const affColor = {
    confident: 'var(--ok)',
    uncertain: 'var(--warn)',
    stuck: 'var(--warn)',
    rationalizing: 'var(--flag)',
    curious: 'var(--blue)',
  };

  // donut arc helper
  const donutArcs = useMemo(() => {
    let start = -Math.PI / 2;
    const radius = 28, cx = 40, cy = 40;
    return Object.entries(affect).map(([k, v]) => {
      const frac = v / affTotal;
      const end = start + frac * Math.PI * 2;
      const largeArc = frac > 0.5 ? 1 : 0;
      const x1 = cx + radius * Math.cos(start);
      const y1 = cy + radius * Math.sin(start);
      const x2 = cx + radius * Math.cos(end);
      const y2 = cy + radius * Math.sin(end);
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const out = { k, v, path, color: affColor[k], frac };
      start = end;
      return out;
    });
  }, [affect]);

  const WORKER_COLORS = {
    w1: 'var(--blue)', w2: 'var(--lilac)', w3: 'var(--ok)',
    w4: 'var(--flag)', w5: 'var(--warn)',
  };

  return (
    <div className="tile memory-cube" style={pos}>
      <Corners2 />
      <TileHead2
        id="M3A"
        title="memory · 5-layer · live retrievals"
        right={<span style={{ color: 'var(--ok)' }}>ρ 2.3 · 47 nodes</span>}
      />
      <div className="tile-body" style={{ padding: 0, display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', gridTemplateRows: '1fr 1fr', gap: 1, background: 'var(--rule)' }}>
        {/* L3 Heatmap — bundle retrievals, week × hour */}
        <div style={{ background: 'var(--bg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, gridRow: 'span 2' }}>
          <div style={{ fontSize: 8, color: 'var(--ink-dimmer)', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: 'var(--accent)' }}>L3</span> ECHO · bundle retrieval heatmap · 7d × 24h</span>
            <span>hotspot M·15–17h</span>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: '14px repeat(24, 1fr)', gap: 1 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <React.Fragment key={i}>
                <div style={{ fontSize: 7, color: 'var(--ink-dimmer)', gridRow: i + 1, gridColumn: 1, alignSelf: 'center' }}>{d}</div>
                {heat[i].map((v, j) => (
                  <div key={j}
                    style={{
                      gridRow: i + 1, gridColumn: j + 2,
                      background: `oklch(${30 + v * 50}% ${0.08 * v} 40)`,
                      opacity: 0.25 + v * 0.75,
                      transition: 'opacity 0.5s',
                    }} />
                ))}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--ink-dimmer)', marginLeft: 14 }}>
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>

        {/* L2 Affect donut */}
        <div style={{ background: 'var(--bg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 8, color: 'var(--ink-dimmer)', letterSpacing: '0.1em' }}>
            <span style={{ color: 'var(--accent)' }}>L2</span> AFFECT · 24h dist.
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
            <svg viewBox="0 0 80 80" style={{ width: 66, height: 66 }}>
              {donutArcs.map((a) => (
                <path key={a.k} d={a.path} fill={a.color} opacity="0.85" />
              ))}
              <circle cx="40" cy="40" r="16" fill="var(--bg)" />
              <text x="40" y="38" textAnchor="middle" fill="var(--accent)" fontSize="8" fontFamily="var(--font-mono)" fontWeight="600">{affTotal}</text>
              <text x="40" y="47" textAnchor="middle" fill="var(--ink-dimmer)" fontSize="5" fontFamily="var(--font-mono)">events</text>
            </svg>
            <div style={{ fontSize: 8, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              {Object.entries(affect).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i style={{ width: 6, height: 6, background: affColor[k] }} />
                  <span style={{ color: 'var(--ink-dim)', flex: 1, textTransform: 'lowercase' }}>{k.slice(0, 7)}</span>
                  <span style={{ color: 'var(--ink-dimmer)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* L1 River stream */}
        <div style={{ background: 'var(--bg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 8, color: 'var(--ink-dimmer)', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: 'var(--accent)' }}>L1</span> RIVER · token flow</span>
            <span style={{ color: 'var(--blue)' }}>∎ 4.2k tok</span>
          </div>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{ flex: 1, width: '100%' }}>
            <polyline
              fill="none" stroke="var(--blue)" strokeWidth="0.8"
              points={river.map((v, i) => `${(i / (river.length - 1)) * 200},${40 - v * 36}`).join(' ')}
            />
            <polygon
              fill="var(--blue)" opacity="0.2"
              points={`0,40 ${river.map((v, i) => `${(i / (river.length - 1)) * 200},${40 - v * 36}`).join(' ')} 200,40`}
            />
          </svg>
        </div>

        {/* L4 Wound — multiline per worker */}
        <div style={{ background: 'var(--bg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 8, color: 'var(--ink-dimmer)', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: 'var(--accent)' }}>L4</span> WOUND · per-worker rationalization intensity</span>
            <span style={{ color: 'var(--flag)' }}>W4 ↑ 0.82</span>
          </div>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{ flex: 1, width: '100%' }}>
            {Object.entries(woundHist).map(([k, arr]) => (
              <polyline key={k}
                fill="none"
                stroke={WORKER_COLORS[k]}
                strokeWidth={k === 'w4' ? 1 : 0.5}
                opacity={k === 'w4' ? 1 : 0.6}
                points={arr.map((v, i) => `${(i / (arr.length - 1)) * 200},${40 - v * 36}`).join(' ')}
              />
            ))}
            {/* danger line */}
            <line x1="0" y1="12" x2="200" y2="12" stroke="var(--flag)" strokeDasharray="2,2" strokeWidth="0.3" opacity="0.4" />
          </svg>
          <div style={{ display: 'flex', gap: 10, fontSize: 8, color: 'var(--ink-dimmer)' }}>
            {Object.keys(woundHist).map((k) => (
              <span key={k} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                <i style={{ width: 8, height: 2, background: WORKER_COLORS[k] }} />
                <span>{k.toUpperCase()}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========== PLANNING BOARD (kanban) ===========
const BOARD_COLS = [
  { id: 'bs', label: 'BRAINSTORM', color: 'var(--blue)' },
  { id: 'sp', label: 'SPEC', color: 'var(--lilac)' },
  { id: 'ac', label: 'ACTIVE', color: 'var(--accent)' },
  { id: 're', label: 'REVIEW', color: 'var(--warn)' },
  { id: 'bd', label: 'BUNDLED', color: 'var(--ok)' },
];

const BOARD_CARDS = [
  { id: 'c1', col: 'bs', title: 'cross-worker collision awareness', tag: 'infra', who: '—', affect: null },
  { id: 'c2', col: 'bs', title: 'brainstorm mode voice recording', tag: 'ux', who: '—', affect: null },
  { id: 'c3', col: 'sp', title: 'M3A echo · resonance score 0–3', tag: 'memory', who: 'W2', affect: 'uncertain' },
  { id: 'c4', col: 'sp', title: 'supervisor T3 escalation modal', tag: 'ux', who: '—', affect: null },
  { id: 'c5', col: 'ac', title: 'classifier · canonical-pivot', tag: 'cls', who: 'W1', affect: 'confident' },
  { id: 'c6', col: 'ac', title: 'WorkerTile · focus outline', tag: 'cockpit', who: 'W3', affect: 'confident' },
  { id: 'c7', col: 'ac', title: 'collision rule · first pass', tag: 'rules', who: 'W4', affect: 'rationalizing' },
  { id: 'c8', col: 're', title: 'cockpit tetris · 8 sources', tag: 'cockpit', who: 'W3', affect: 'confident' },
  { id: 'c9', col: 're', title: 'hook · classifier PostToolUse wire', tag: 'hooks', who: 'W1', affect: 'confident' },
  { id: 'cA', col: 'bd', title: 'progress-style git audit reader', tag: 'git', who: 'W5', affect: null },
  { id: 'cB', col: 'bd', title: 'm3a · L1 river sliding buffer', tag: 'memory', who: 'W2', affect: null },
  { id: 'cC', col: 'bd', title: 'law ticker · hook-flag feed', tag: 'obs', who: '—', affect: null },
];

function PlanBoard({ pos, onDragCard }) {
  const [cards, setCards] = useState(BOARD_CARDS);
  const [drag, setDrag] = useState(null);

  const byCol = (c) => cards.filter((k) => k.col === c);
  const moveCard = (cardId, toCol) => {
    setCards((cs) => cs.map((c) => c.id === cardId ? { ...c, col: toCol } : c));
  };

  return (
    <div className="tile board-tile" style={pos}>
      <Corners2 />
      <TileHead2
        id="PLAN"
        title="planning board · spec lifecycle"
        right={
          <>
            <span style={{ color: 'var(--ink-dimmer)' }}>{cards.length} cards</span>
            <span style={{ color: 'var(--accent)' }}>+ card</span>
          </>
        }
      />
      <div className="tile-body" style={{ padding: 6, overflow: 'hidden' }}>
        <div className="board-cols">
          {BOARD_COLS.map((col) => (
            <div key={col.id} className="board-col"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => { if (drag) { moveCard(drag, col.id); setDrag(null); } }}
            >
              <div className="board-col-head">
                <span className="dot" style={{ background: col.color }} />
                <span className="lbl">{col.label}</span>
                <span className="n">{byCol(col.id).length}</span>
              </div>
              <div className="board-col-body">
                {byCol(col.id).map((card) => (
                  <div key={card.id}
                    className={`card ${drag === card.id ? 'drag' : ''}`}
                    draggable
                    onDragStart={() => setDrag(card.id)}
                    onDragEnd={() => setDrag(null)}
                  >
                    <div className="card-row">
                      <span className="tag">{card.tag}</span>
                      {card.who !== '—' && <span className="who">{card.who}</span>}
                    </div>
                    <div className="ttl">{card.title}</div>
                    {card.affect && (
                      <div className={`aff aff-${card.affect.slice(0,4)}`}>{card.affect}</div>
                    )}
                  </div>
                ))}
                {byCol(col.id).length === 0 && <div className="empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========== SUPERVISOR CHAT ===========
const SEED_CHAT = [
  { role: 'sup', t: '-4:20', text: 'W4 is spiraling on the collision rule. Want me to gate the PostToolUse hook for them and queue a T3 rebuke?' },
  { role: 'usr', t: '-4:12', text: "no, don't block yet. surface the diff to me." },
  { role: 'sup', t: '-4:11', text: 'Diff surfaced to queue as T2. Their wound-history for this file is 0.82 — I flagged two canonical-pivot tells in the last 3 minutes.' },
  { role: 'usr', t: '-3:58', text: 'promote the m3a echo bundle once w2 lands it' },
  { role: 'sup', t: '-3:57', text: 'Auto-promotion queued. Current tests: 14/14 on echo, 0/3 on the collision rule.' },
  { role: 'sup', t: '-0:32', text: 'W3 just shipped the tetris viz. Resonance match on the v1 supervisor-dashboard incident — want me to pin that bundle to the spec anchor?' },
];

function SupervisorChat({ pos }) {
  const [msgs, setMsgs] = useState(SEED_CHAT);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  // autonomous supervisor pings
  useInterval2(() => {
    const prompts = [
      'W2 is asking about the VectorIndex abstraction. I loaded the framework primitive doc into their context. 📎 1 bundle.',
      'Screenshot wall updated · W3 · cockpit-l3.png looks good. Approve?',
      'Heatmap shows bundle retrievals clustered 15-17h. Want to pre-warm ρ2+ matches at 14:50?',
      'Drift flag on W1: scope expanded to include fswatch wiring. 2 files outside spec map. Keep or rebuke?',
    ];
    setMsgs((m) => [...m, { role: 'sup', t: 'now', text: SIM.pick(prompts) }].slice(-16));
  }, 7500);

  const send = () => {
    if (!draft.trim()) return;
    const userMsg = { role: 'usr', t: 'now', text: draft };
    setMsgs((m) => [...m, userMsg].slice(-16));
    setDraft('');
    // scripted reply
    setTimeout(() => {
      const replies = [
        'On it. Queued as T2.',
        'Noted. I\'ll watch that thread and ping if it shifts.',
        'Done. Bundle pinned to the spec anchor.',
        'Tracking. Three candidate bundles surfaced in the chips panel.',
        'Agreed. Escalating to the local rationalization classifier.',
      ];
      setMsgs((m) => [...m, { role: 'sup', t: 'now', text: SIM.pick(replies) }].slice(-16));
    }, 900);
  };

  return (
    <div className="tile chat-tile" style={pos}>
      <Corners2 />
      <TileHead2
        id="SUP"
        title="supervisor · direct channel"
        right={
          <>
            <span style={{ color: 'var(--ok)' }}>● online · opus-4.5</span>
          </>
        }
      />
      <div className="tile-body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} className="chat-log">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="head">
                <span className="who">{m.role === 'sup' ? 'supervisor' : 'you'}</span>
                <span className="t">{m.t}</span>
              </div>
              <div className="body">{m.text}</div>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <span style={{ color: 'var(--accent)' }}>›</span>
          <input
            type="text"
            placeholder="ask the supervisor · ⌘↵ send"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          />
          <button onClick={send}>send</button>
        </div>
        <div className="chat-quick">
          {['status?', 'promote bundle', 'rebuke w4', 'pause all'].map((q) => (
            <span key={q} onClick={() => { setDraft(q); }}>{q}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========== STATS TILE ===========
const STATS = {
  lifetime: {
    tokensIn: 48_320_441,
    tokensOut: 12_840_112,
    sessions: 847,
    workers: 1_204,
    commits: 9_431,
    blocks: 312,
    rebukes: 84,
    hours: 712,
  },
  pathologies: [
    { name: 'canonical-pivot',    law: 'L-0114', n: 184, delta: +12 },
    { name: 'for-now bandaid',    law: 'L-0087', n: 142, delta: +4 },
    { name: 'fake green',         law: 'L-0032', n: 97,  delta: -2 },
    { name: 'unsupported-laundering', law: 'L-0071', n: 81, delta: +6 },
    { name: 'scope expand',       law: 'L-0042', n: 63,  delta: +1 },
    { name: 'quick-hack pivot',   law: 'L-0096', n: 52,  delta: 0 },
    { name: 'commit lag',         law: 'L-0203', n: 41,  delta: +3 },
    { name: 'destructive git',    law: 'L-0055', n: 18,  delta: -1 },
  ],
};

function StatsTile({ pos }) {
  const [tokIn, setTokIn] = useState(STATS.lifetime.tokensIn);
  const [tokOut, setTokOut] = useState(STATS.lifetime.tokensOut);

  useInterval2(() => {
    setTokIn((v) => v + Math.floor(Math.random() * 400));
    setTokOut((v) => v + Math.floor(Math.random() * 120));
  }, 600);

  const max = STATS.pathologies[0].n;
  const fmt = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  };

  return (
    <div className="tile stats-tile" style={pos}>
      <Corners2 />
      <TileHead2
        id="STAT"
        title="lifetime · session ledger"
        right={<span style={{ color: 'var(--ink-dimmer)' }}>since 2025-11-03</span>}
      />
      <div className="tile-body" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
        {/* big numbers */}
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="lbl">TOKENS IN</div>
            <div className="v">{fmt(tokIn)}</div>
            <div className="d">+{fmt(tokIn - STATS.lifetime.tokensIn)} live</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">TOKENS OUT</div>
            <div className="v">{fmt(tokOut)}</div>
            <div className="d ok">26.6% ratio</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">SESSIONS</div>
            <div className="v">{STATS.lifetime.sessions}</div>
            <div className="d">avg 1.4 workers</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">COMMITS</div>
            <div className="v">{fmt(STATS.lifetime.commits)}</div>
            <div className="d">edit-trail</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">BLOCKS</div>
            <div className="v flag">{STATS.lifetime.blocks}</div>
            <div className="d">guard-build</div>
          </div>
          <div className="stat-cell">
            <div className="lbl">REBUKES</div>
            <div className="v warn">{STATS.lifetime.rebukes}</div>
            <div className="d">T3 escalated</div>
          </div>
        </div>
        {/* pathology leaderboard */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="section-label" style={{ padding: '4px 0 3px' }}>
            PATHOLOGY LEADERBOARD · 30D
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
            {STATS.pathologies.map((p, i) => (
              <div key={i} className="patho-row">
                <span className="rank">{i + 1}</span>
                <span className="name">{p.name}</span>
                <span className="law">{p.law}</span>
                <div className="bar-wrap">
                  <div className="bar" style={{ width: `${(p.n / max) * 100}%` }} />
                </div>
                <span className="n">{p.n}</span>
                <span className={`d ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}`}>
                  {p.delta > 0 ? '▲' : p.delta < 0 ? '▼' : '·'}{Math.abs(p.delta)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Cockpit2 = { KernelCube, MemoryCube, PlanBoard, SupervisorChat, StatsTile };
