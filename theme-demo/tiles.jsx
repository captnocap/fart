/* global React, ReactDOM, SIM */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// =========== small helpers ==========
function useInterval(fn, ms, active = true) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }, [fn, ms, active]);
}

function StatBadge({ status }) {
  const map = {
    idle: ['IDLE', 's-idle'],
    think: ['THINK', 's-think'],
    tool: ['TOOL', 's-tool'],
    stuck: ['STUCK', 's-stuck'],
    rat: ['RAT', 's-rat'],
  };
  const [lbl, cls] = map[status] || ['—', 's-idle'];
  return <span className={`stat ${cls}`}>{lbl}</span>;
}

function Corners() {
  return (
    <>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
    </>
  );
}

function TileHead({ id, title, right }) {
  return (
    <div className="tile-head">
      <span className="id">{id}</span>
      <span className="ttl">{title}</span>
      <span className="right">{right}</span>
    </div>
  );
}

// =========== Worker tile ==========
function WorkerTile({ worker, focused, onFocus, pos }) {
  const [lines, setLines] = useState(() => {
    // seed with first few lines
    const src = SIM.STREAMS[worker.id] || [];
    return src.slice(0, 3);
  });
  const [cursor, setCursor] = useState(3);

  useInterval(() => {
    const src = SIM.STREAMS[worker.id] || [];
    if (!src.length) return;
    if (worker.status === 'idle') return;
    const next = src[cursor % src.length];
    setLines((l) => {
      const arr = [...l, next];
      return arr.slice(-14);
    });
    setCursor((c) => c + 1);
  }, worker.status === 'think' ? 2400 : worker.status === 'rat' ? 1600 : 1200, true);

  const affectMap = {
    confident: ['aff-conf', 'CONFIDENT'],
    uncertain: ['aff-unc', 'UNCERTAIN'],
    stuck: ['aff-stk', 'STUCK'],
    rationalizing: ['aff-rat', 'RATIONALIZING'],
  };
  const [affCls, affLbl] = affectMap[worker.affect] || ['', worker.affect];

  return (
    <div
      className={`tile worker-tile ${focused ? 'focus' : 'dim'}`}
      style={pos}
      onClick={() => onFocus(worker.id)}
    >
      <Corners />
      <TileHead
        id={worker.name}
        title={worker.task}
        right={
          <>
            <span>{worker.cli}:{worker.model}</span>
            <StatBadge status={worker.status} />
          </>
        }
      />
      <div className="meta">
        <span className={`pill ${affCls}`}>L2·{affLbl}</span>
        <span className="pill">♥ 1.2s</span>
        <span className="pill">↻ {worker.file.split('/').pop()}</span>
      </div>
      <div className="tile-body">
        <div className="stream">
          {lines.map((ln, i) => (
            <span key={i} className={`ln ${ln.t}`}>{ln.s}{i === lines.length - 1 ? <i className="caret" /> : null}{'\n'}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========== Kernel tile (tetris) ==========
function KernelTile({ pos }) {
  const COLS = 22;
  const ROWS = 14;
  // stack of payload items (type, tokens)
  const [payload, setPayload] = useState([
    { type: 'sys', t: 8 },
    { type: 'ctx', t: 28 },
    { type: 'usr', t: 14 },
    { type: 'ast', t: 20 },
    { type: 'tool', t: 12 },
    { type: 'atch', t: 6 },
    { type: 'pin', t: 8 },
    { type: 'wnd', t: 4 },
    { type: 'ast', t: 18 },
    { type: 'tool', t: 10 },
    { type: 'ctx', t: 16 },
    { type: 'usr', t: 8 },
  ]);

  useInterval(() => {
    setPayload((p) => {
      const total = p.reduce((a, x) => a + x.t, 0);
      const cap = COLS * ROWS;
      if (total > cap * 0.92) {
        // evict oldest
        return p.slice(2);
      }
      const kind = SIM.pick(['sys', 'ctx', 'usr', 'ast', 'tool', 'atch', 'pin', 'wnd']);
      return [...p, { type: kind, t: 2 + Math.floor(Math.random() * 8) }];
    });
  }, 800);

  // flatten into cells, filling bottom-up, left-to-right
  const cells = useMemo(() => {
    const arr = new Array(COLS * ROWS).fill(null);
    let i = 0;
    for (const item of payload) {
      for (let k = 0; k < item.t && i < arr.length; k++, i++) {
        arr[i] = item.type;
      }
    }
    return arr;
  }, [payload]);

  const total = payload.reduce((a, x) => a + x.t, 0);
  const cap = COLS * ROWS;
  const pct = Math.round((total / cap) * 100);

  return (
    <div className="tile kernel-tile" style={pos}>
      <Corners />
      <TileHead
        id="KRN"
        title="context kernel"
        right={<span style={{ color: 'var(--accent)' }}>{pct}%</span>}
      />
      <div className="tile-body" style={{ padding: 0 }}>
        <div className="tetris">
          <div
            className="tetris-grid"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
          >
            {/* render from bottom-up: row 0 at bottom */}
            {Array.from({ length: ROWS }).map((_, rowFromTop) => {
              const row = ROWS - 1 - rowFromTop;
              return Array.from({ length: COLS }).map((__, col) => {
                const idx = row * COLS + col;
                const v = cells[idx];
                return (
                  <span
                    key={`${row}-${col}`}
                    className={`tetris-cell ${v ? 'tc-' + v : ''}`}
                  />
                );
              });
            })}
          </div>
          <div className="legend no-sel">
            <span><i className="tc-sys" />sys</span>
            <span><i className="tc-ctx" />ctx</span>
            <span><i className="tc-ast" />ast</span>
            <span><i className="tc-tool" />tool</span>
            <span><i className="tc-wnd" />wnd</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========== Memory tile (M3A 5-layer) ==========
function MemoryTile({ pos }) {
  const [river, setRiver] = useState(() => Array.from({ length: 18 }, () => 0.3 + Math.random() * 0.6));
  const [heat, setHeat] = useState(() => Array.from({ length: 32 }, () => Math.random()));
  const [echo, setEcho] = useState([true, true, false, true, false, true]);
  const [woundVals, setWoundVals] = useState([0.8, 0.5, 0.6, 0.3]);

  useInterval(() => {
    setRiver((r) => [...r.slice(1), 0.2 + Math.random() * 0.8]);
    setHeat((h) => h.map((v) => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.25))));
    setEcho((e) => e.map(() => Math.random() > 0.3));
    setWoundVals((w) => w.map((v) => Math.max(0.15, Math.min(1, v + (Math.random() - 0.4) * 0.1))));
  }, 1100);

  return (
    <div className="tile memory-tile" style={pos}>
      <Corners />
      <TileHead id="M3A" title="memory · 5 layers" right={<span style={{ color: 'var(--ink-dimmer)' }}>ρ 2.1</span>} />
      <div className="tile-body" style={{ padding: 0 }}>
        <div className="mem-grid">
          <div className="mem-cell">
            <div className="lbl"><span className="idx">L1</span>RIVER</div>
            <div className="viz">
              <div className="river">
                {river.map((v, i) => (
                  <div key={i} className="bar" style={{ height: `${v * 100}%`, opacity: 0.3 + v * 0.6 }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mem-cell">
            <div className="lbl"><span className="idx">L2</span>FEELING</div>
            <div className="viz">
              <div className="heat">
                {heat.map((v, i) => (
                  <i key={i} style={{ opacity: v }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mem-cell">
            <div className="lbl"><span className="idx">L3</span>ECHO</div>
            <div className="viz">
              <div className="echo">
                {echo.map((on, i) => <span key={i} className={`ring ${on ? 'on' : ''}`} />)}
              </div>
            </div>
          </div>
          <div className="mem-cell">
            <div className="lbl"><span className="idx">L4</span>WOUND</div>
            <div className="viz">
              <div className="wounds">
                {woundVals.map((v, i) => (
                  <div key={i} className="w">
                    <span>W{i + 1}</span>
                    <div className="bar"><i style={{ width: `${v * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mem-cell" style={{ gridColumn: '1 / span 2' }}>
            <div className="lbl"><span className="idx">L5</span>COOCCURRENCE · node density 47</div>
            <div className="viz">
              <div className="coo">
                <CooGraph />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CooGraph() {
  // static but jittered node graph
  const [nodes] = useState(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: 8 + Math.random() * 84,
    y: 10 + Math.random() * 80,
    r: 1.5 + Math.random() * 2.5,
  })));
  const edges = useMemo(() => {
    const e = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        if (Math.hypot(dx, dy) < 22) e.push([i, j]);
      }
    }
    return e;
  }, [nodes]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      {edges.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(210, 106, 42, 0.25)" strokeWidth="0.2" />
      ))}
      {nodes.map((n) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={n.r} fill="var(--accent)" opacity="0.8" />
      ))}
    </svg>
  );
}

// =========== Git audit tile ==========
function GitAuditTile({ pos }) {
  return (
    <div className="tile git-tile" style={pos}>
      <Corners />
      <TileHead id="GIT" title="edit-trail · audit" right={<span style={{ color: 'var(--ok)' }}>● live</span>} />
      <div className="tile-body">
        <div className="rows">
          <div className="section-label">velocity · 30d · commits/day</div>
          <div className="velocity">
            {SIM.VELOCITY.map((v, i) => (
              <div key={i} className={`v ${i === SIM.VELOCITY.length - 1 ? 'today' : ''}`}
                   style={{ height: `${(v / 31) * 100}%` }} />
            ))}
          </div>
          <div className="section-label">recent · edit-trail branch</div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            {SIM.COMMITS.slice().reverse().map((c, i) => (
              <div key={i} className="commit">
                <span className="sha">{c.sha}</span>
                <span className="msg">
                  <span style={{ color: 'var(--ink-dim)' }}>{c.who} </span>
                  {c.msg}
                </span>
                <span className="t">-{c.t}</span>
              </div>
            ))}
          </div>
          <div className="section-label">restore points</div>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', fontSize: 9, color: 'var(--ink-dimmer)' }}>
            <span>│</span>
            {SIM.COMMITS.map((c, i) => (
              <span key={i} title={c.msg} style={{
                width: 6, height: 6, background: 'var(--rule-bright)',
                border: '1px solid var(--accent)',
              }} />
            ))}
            <span style={{ marginLeft: 'auto' }}>● now</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========== Queue tile ==========
function QueueTile({ pos, onAct }) {
  return (
    <div className="tile queue-tile" style={pos}>
      <Corners />
      <TileHead id="Q" title="next-action queue" right={<span style={{ color: 'var(--accent)' }}>{SIM.QUEUE.length} queued</span>} />
      <div className="tile-body" style={{ overflowY: 'auto' }}>
        {SIM.QUEUE.map((q, i) => (
          <div key={i} className="item" onClick={() => onAct && onAct(q)}>
            <span className={`pri ${q.pri}`}>{q.pri.toUpperCase()}</span>
            <span className="who">{q.who}</span>
            <span className="what">{q.text}</span>
            <span className="t">{q.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========== Spec anchor tile ==========
function SpecTile({ pos }) {
  return (
    <div className="tile spec-tile" style={pos}>
      <Corners />
      <TileHead
        id="SPEC"
        title="anchor · cycle-3 blueprint"
        right={<span style={{ color: 'var(--accent)' }}>pinned</span>}
      />
      <div className="tile-body">
        <div className="spec-body">
          <div className="block" style={{ flex: 2 }}>
            <div className="label">GOAL</div>
            <div className="v" style={{ fontSize: 11, marginBottom: 6 }}>{SIM.SPEC.goal}</div>
            <div className="label">ACCEPTANCE</div>
            <ul>
              {SIM.SPEC.done.map((d, i) => (
                <li key={i} className={d.s}>{d.text}</li>
              ))}
            </ul>
          </div>
          <div className="block">
            <div className="label">CONSTRAINTS</div>
            <ul>
              {SIM.SPEC.constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <div className="label" style={{ marginTop: 6 }}>NON-GOALS</div>
            <ul>
              {SIM.SPEC.non_goals.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div className="block">
            <div className="label">FILE MAP</div>
            <ul>
              {SIM.SPEC.files.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========== Autotest tile ==========
function AutotestTile({ pos }) {
  const failCount = SIM.AUTOTEST.filter((r) => r.st === 'fail').length;
  return (
    <div className="tile autotest-tile" style={pos}>
      <Corners />
      <TileHead id="ATST" title="autotest · signal"
        right={<span style={{ color: failCount ? 'var(--flag)' : 'var(--ok)' }}>
          {failCount ? `${failCount} failing` : 'all green'}
        </span>} />
      <div className="tile-body">
        <div className="rows">
          {SIM.AUTOTEST.map((r, i) => (
            <div key={i} className={`row ${r.st}`}>
              <span className="st">{r.st === 'pass' ? '✓' : r.st === 'fail' ? '✗' : '·'}</span>
              <span>{r.name}</span>
              <span className="sig">{r.sig}</span>
              <span className="sig">{r.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========== Screenshot wall ==========
function ScreenshotShot({ idx, ok }) {
  // pseudo hi-fi placeholder: stripe fill + subtle shape, like a build screenshot thumbnail
  const hue = [22, 200, 40, 160, 18, 210][idx % 6];
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none">
      <defs>
        <pattern id={`p${idx}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill={`oklch(24% 0.02 ${hue})`} />
          <line x1="0" y1="0" x2="0" y2="4" stroke={`oklch(32% 0.03 ${hue})`} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100" height="60" fill={`url(#p${idx})`} />
      <rect x="4" y="4" width="40" height="6" fill={`oklch(48% 0.06 ${hue})`} />
      <rect x="4" y="14" width="92" height="1" fill={`oklch(42% 0.04 ${hue})`} />
      <rect x="4" y="20" width={20 + idx * 8} height="3" fill={`oklch(38% 0.03 ${hue})`} />
      <rect x="4" y="26" width={60 - idx * 4} height="3" fill={`oklch(38% 0.03 ${hue})`} />
      <rect x="4" y="32" width="88" height="22" fill={`oklch(20% 0.02 ${hue})`} stroke={`oklch(42% 0.08 ${hue})`} strokeWidth="0.5" />
      <circle cx="14" cy="43" r="2" fill={`oklch(55% 0.1 ${hue})`} />
      <rect x="22" y="41" width="50" height="1" fill={`oklch(50% 0.06 ${hue})`} />
      <rect x="22" y="45" width="30" height="1" fill={`oklch(40% 0.04 ${hue})`} />
      {!ok && (
        <>
          <line x1="0" y1="0" x2="100" y2="60" stroke="#e14a2a" strokeWidth="0.8" opacity="0.5" />
          <line x1="100" y1="0" x2="0" y2="60" stroke="#e14a2a" strokeWidth="0.8" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

function ScreenshotTile({ pos }) {
  const shots = [
    { worker: 'W1', ok: true, label: 'classifier · pass' },
    { worker: 'W2', ok: true, label: 'm3a echo · pass' },
    { worker: 'W3', ok: true, label: 'cockpit · l3' },
    { worker: 'W4', ok: false, label: 'collision · diff' },
    { worker: 'W3', ok: true, label: 'strip · focus' },
    { worker: 'W1', ok: true, label: 'hook wire' },
  ];
  return (
    <div className="tile shots-tile" style={pos}>
      <Corners />
      <TileHead id="SHOTS" title="screenshot wall · visual-verify"
        right={<span style={{ color: 'var(--ink-dimmer)' }}>{shots.length} fresh</span>} />
      <div className="tile-body">
        <div className="grid">
          {shots.map((s, i) => (
            <div key={i} className="shot">
              <div className="preview"><ScreenshotShot idx={i} ok={s.ok} /></div>
              <div className={`lbl ${s.ok ? 'ok' : 'fail'}`}>
                <span>{s.worker}</span>
                <span>{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========== Law ticker ==========
function LawTile({ pos, laws }) {
  return (
    <div className="tile law-tile" style={pos}>
      <Corners />
      <TileHead id="LAW" title="ticker · hook flags"
        right={<span style={{ color: 'var(--flag)' }}>● live</span>} />
      <div className="tile-body">
        <div className="ticker">
          {laws.map((l, i) => (
            <div key={i} className={`flag-row ${l.sev}`}>
              <span>{l.sev === 'block' ? '⬛' : l.sev === 'warn' ? '▲' : l.sev === 'ok' ? '✓' : '·'}</span>
              <span className="msg">{l.msg}</span>
              <span className="law">{l.law}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========== Brainstorm panel ==========
function BrainstormPanel({ onCrystallize, onClose }) {
  return (
    <div className="brainstorm-panel no-sel">
      <div className="bs-head">
        <span>⬤ brainstorm mode</span>
        <span style={{ color: 'var(--ink-dimmer)', letterSpacing: 0, textTransform: 'none', fontSize: 10 }}>
          workers paused · collaborator voice · bundles resonance-ranked
        </span>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 14 }} onClick={onClose}>×</span>
      </div>
      <div className="bs-body">
        <div className="convo">
          <div className="turn">
            <div className="role user">user · 00:01</div>
            <div className="body">Let's explore the collision-prediction layer. I want to catch two workers editing the same file region before either commit lands.</div>
          </div>
          <div className="turn">
            <div className="role sup">supervisor · 00:01</div>
            <div className="body">
              There's prior art in engaige's <span style={{ color: 'var(--accent)' }}>awarenessStore</span> — cross-entity shared-state pattern. Resonance match on two bundles (right). <br />
              Two shapes we could take: <em>(a)</em> per-worker region locks with an advisory flag, or <em>(b)</em> a passive awareness layer that just surfaces collision risk to the queue without blocking. (a) is cheaper but can deadlock; (b) keeps the supervisor in the loop.
            </div>
          </div>
          <div className="turn">
            <div className="role user">user · 00:02</div>
            <div className="body">Go with (b). No auto-blocking. I want it routed through the same queue that the law ticker writes to.</div>
          </div>
          <div className="turn">
            <div className="role sup">supervisor · 00:02</div>
            <div className="body">
              Good. Then the spec decomposes into three slices: <br />
              1 · <em>fswatch → region diff stream</em> (W1 territory — reuses the file-change watcher)<br />
              2 · <em>awareness store</em> (new — layer over classifier state)<br />
              3 · <em>queue writer</em> (touches existing queue schema; no new table)<br />
              Want to crystallize?
            </div>
          </div>
          <div className="turn">
            <div className="role user">user · 00:03</div>
            <div className="body"><span style={{ color: 'var(--accent)' }}>│</span></div>
          </div>
        </div>
        <div className="chips">
          <div className="label">resonant bundles · M3A L3</div>
          {SIM.BUNDLES.map((b, i) => (
            <div key={i} className="chip">
              <div className="ttl">{b.ttl}</div>
              <div className="sub">{b.sub}</div>
              <div className="res">resonance {b.res}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bs-foot">
        <span>⌘K brainstorm ↔ enforce</span>
        <span style={{ color: 'var(--ink-ghost)' }}>│</span>
        <span>⌘↵ crystallize</span>
        <span style={{ color: 'var(--ink-ghost)' }}>│</span>
        <span>esc close</span>
        <button className="crystal" onClick={onCrystallize}>crystallize → enforce</button>
      </div>
    </div>
  );
}

window.Cockpit = {
  useInterval, StatBadge, Corners, TileHead,
  WorkerTile, KernelTile, MemoryTile, GitAuditTile,
  QueueTile, SpecTile, AutotestTile, ScreenshotTile,
  LawTile, BrainstormPanel,
};
