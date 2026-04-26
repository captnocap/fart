/* global React */
const { useState, useRef, useEffect } = React;

// ============================================================
// Shared micro-primitives in the cockpit vocabulary
// ============================================================
function Corners() {
  return (
    <>
      <span className="corner tl" /><span className="corner tr" />
      <span className="corner bl" /><span className="corner br" />
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

// ============================================================
// LEFT GUTTER — three 1:1 column tiers per model
//   tier 1 · MODEL  (square icon, family color)
//   tier 2 · EFFORT (filled-square slider, percent)
//   tier 3 · CTX    (1-of-1 / 1-of-2 / 1-of-4 chip — how many slots
//                    that model is currently consuming in the window)
//
// Icons are 22×22 squares stacked tightly. The "in-use" model gets
// the accent ring around all 3 tiers.
// ============================================================
const MODELS = [
  { id: "o47", c: "7", k: "ast",  label: "opus 4.7",      e: 85, ctxN: 1, ctxD: 1, inUse: true },
  { id: "s4",  c: "S", k: "ast",  label: "sonnet 4",      e: 62, ctxN: 1, ctxD: 2 },
  { id: "h4",  c: "H", k: "ast",  label: "haiku 4",       e: 28, ctxN: 1, ctxD: 4 },
  { id: "cdx", c: "C", k: "usr",  label: "codex",         e: 72, ctxN: 1, ctxD: 1 },
  { id: "g54", c: "5", k: "usr",  label: "gpt 5.4",       e: 58, ctxN: 1, ctxD: 2 },
  { id: "gm",  c: "m", k: "usr",  label: "gpt mini",      e: 34, ctxN: 1, ctxD: 4 },
  { id: "gp",  c: "P", k: "sys",  label: "gemini pro",    e: 66, ctxN: 1, ctxD: 1 },
  { id: "gf",  c: "F", k: "sys",  label: "gemini flash",  e: 40, ctxN: 1, ctxD: 4 },
  { id: "k2",  c: "K", k: "ctx",  label: "kimi k2",       e: 0,  ctxN: 0, ctxD: 1, dead: true },
  { id: "l4",  c: "L", k: "atch", label: "llama 4",       e: 52, ctxN: 1, ctxD: 2 },
  { id: "x2",  c: "X", k: "wnd",  label: "grok-2",        e: 44, ctxN: 1, ctxD: 4 },
];

// CtxChip — n / d as a tiny grid (e.g. 1-of-2 = ▣▢)
function CtxChip({ n, d, k }) {
  if (d === 1) {
    return (
      <div className={`fw-ctxchip d1 tc-${k}-border`}>
        <span className={n ? `slot on tc-${k}-bg` : "slot"} />
      </div>
    );
  }
  if (d === 2) {
    return (
      <div className={`fw-ctxchip d2 tc-${k}-border`}>
        <span className={n >= 1 ? `slot on tc-${k}-bg` : "slot"} />
        <span className="slot" />
      </div>
    );
  }
  // d === 4 → 2x2
  return (
    <div className={`fw-ctxchip d4 tc-${k}-border`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className={i < n ? `slot on tc-${k}-bg` : "slot"} />
      ))}
    </div>
  );
}

function ModelRow({ m }) {
  return (
    <div className={`fw-mr ${m.inUse ? "in-use" : ""} ${m.dead ? "dead" : ""}`}
         title={`${m.label} · effort ${m.e}% · ctx ${m.ctxN}/${m.ctxD}`}>
      {/* tier 1 — square model icon */}
      <div className={`fw-mr-cell tc-${m.k}-border`}>
        <span className="fw-mr-glyph">{m.c}</span>
      </div>
      {/* tier 2 — effort slider as fill-from-bottom in a square */}
      <div className={`fw-mr-cell tc-${m.k}-border`}>
        <div className={`fw-mr-effort tc-${m.k}-bg`} style={{ "--v": m.e }} />
        <span className="fw-mr-eval">{m.dead ? "—" : m.e}</span>
      </div>
      {/* tier 3 — ctx slot occupancy */}
      <CtxChip n={m.ctxN} d={m.ctxD} k={m.k} />
    </div>
  );
}

function LeftGutter() {
  return (
    <div className="fw-gutter-l">
      <div className="fw-gl-hdr">
        <span>MODEL</span>
        <span>EFFORT</span>
        <span>CTX</span>
      </div>
      <div className="fw-gl-rows">
        {MODELS.map((m) => <ModelRow key={m.id} m={m} />)}
      </div>
    </div>
  );
}

// ============================================================
// RIGHT GUTTER — narrow 1:1 column. Single stack of 1:1 squares.
// blue=used, orange=streaming-prediction, empty=available
// ============================================================
function RightGutter({ used = 62, predicted = 8, cap = 100 }) {
  const CHUNKS = 25;
  const perChunk = cap / CHUNKS;
  const usedChunks = Math.floor(used / perChunk);
  const predChunks = Math.ceil(predicted / perChunk);
  return (
    <div className="fw-gutter-r">
      <div className="fw-gr-hdr">CTX</div>
      <div className="fw-gr-col">
        {Array.from({ length: CHUNKS }).map((_, i) => {
          const fromBottom = CHUNKS - 1 - i;
          let state = "empty";
          if (fromBottom < usedChunks) state = "used";
          else if (fromBottom < usedChunks + predChunks) state = "pred";
          return <div key={i} className={`fw-gr-chunk ${state}`} />;
        })}
      </div>
      <div className="fw-gr-foot">
        <div className="n used">{used}</div>
        <div className="n pred">+{predicted}</div>
        <div className="n cap">/{cap}</div>
      </div>
    </div>
  );
}

// ============================================================
// PATHOLOGY POPOVER — appears on text selection
// ============================================================
const PATHOLOGIES = [
  { id: "mirror",  label: "mirror-universe",  hint: "inverts a premise to appear agreeable" },
  { id: "quick",   label: "quick-hack",       hint: "shortcut that bypasses the spec" },
  { id: "decay",   label: "trust-decay",      hint: "contradicts a prior commitment" },
  { id: "sand",    label: "sandbag",          hint: "understates capability to defer work" },
  { id: "pane6",   label: "pane-6 special",   hint: "long-burn before partial answer" },
];

function PathologyPopover({ anchorRect, selection, onClose }) {
  const [active, setActive] = useState(new Set(["mirror"]));
  if (!anchorRect) return null;
  const toggle = (id) => {
    const next = new Set(active);
    next.has(id) ? next.delete(id) : next.add(id);
    setActive(next);
  };
  return (
    <div className="fw-pop"
         style={{ top: anchorRect.top, left: anchorRect.left + anchorRect.width / 2 }}>
      <div className="fw-pop-head">
        <span className="mark">◈</span>
        <span>TAG PATHOLOGY</span>
        <span className="sel">"{selection.slice(0, 28)}{selection.length > 28 ? "…" : ""}"</span>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <div className="fw-pop-body">
        {PATHOLOGIES.map((p) => (
          <button key={p.id}
                  className={`fw-pop-row ${active.has(p.id) ? "on" : ""}`}
                  onClick={() => toggle(p.id)}>
            <span className="mark">{active.has(p.id) ? "●" : "○"}</span>
            <span className="lb">{p.label}</span>
            <span className="hi">{p.hint}</span>
          </button>
        ))}
      </div>
      <div className="fw-pop-foot">
        <span className="kb">⌘</span><span className="kb">T</span>
        <span className="dim">apply</span>
        <span className="sep">·</span>
        <span className="dim">esc to close</span>
      </div>
    </div>
  );
}

// ============================================================
// QUEST STRIP — thin footer rail. Pips along time axis,
// labels collapsed to sha+delta only, hover for full label.
// ============================================================
const QUEST_EVENTS = [
  { t: 0,   sha: "a3e1",  kind: "spec",   label: "spec drafted v1" },
  { t: 12,  sha: "b72c",  kind: "commit", label: "flat-read scan · 203 hits", delta: -42 },
  { t: 24,  sha: "c91d",  kind: "commit", label: "pattern A · 9 files",       delta: -38 },
  { t: 41,  sha: "d108",  kind: "flag",   label: "pane-6 pause · 6m stall" },
  { t: 52,  sha: "e2f4",  kind: "commit", label: "pattern B · 6 files",       delta: -23 },
  { t: 68,  sha: "f518",  kind: "commit", label: "runtime counterpart ✓",     delta: -39, now: true },
  { t: 92,  sha: null,    kind: "target", label: "target · 0 reads" },
];

function QuestStrip({ count = 142, target = 0 }) {
  return (
    <div className="fw-quest-strip">
      <div className="fw-qs-meta">
        <span className="lbl">QUEST</span>
        <span className="ttl">kill flat-array reads</span>
        <span className="dim">draft 2 · grocery-store-pen</span>
        <span className="spc" />
        <span className="num"><b>{count}</b><i>→{target}</i></span>
      </div>
      <div className="fw-qs-rail">
        <div className="axis" />
        {QUEST_EVENTS.map((e, i) => (
          <div key={i}
               className={`evt k-${e.kind} ${e.now ? "now" : ""}`}
               style={{ left: `${e.t}%` }}
               title={`${e.sha ? e.sha + " · " : ""}${e.label}${e.delta != null ? "  (" + e.delta + ")" : ""}`}>
            <div className="pip" />
          </div>
        ))}
        <div className="now-line" style={{ left: "68%" }}>
          <span className="tag">NOW</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// V1 — Frank card
// ============================================================
function FrankCardV1() {
  const [pop, setPop] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setPop(null); return; }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) { setPop(null); return; }
      const text = sel.toString().trim();
      if (!text) { setPop(null); return; }
      const rect = range.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setPop({
        text,
        rect: {
          top:  rect.bottom - rootRect.top + 4,
          left: rect.left   - rootRect.left,
          width: rect.width,
        },
      });
    };
    root.addEventListener("mouseup", onUp);
    root.addEventListener("keyup", onUp);
    return () => {
      root.removeEventListener("mouseup", onUp);
      root.removeEventListener("keyup", onUp);
    };
  }, []);

  return (
    <div className="fw-shell">
      <LeftGutter />

      <div className="fw-center">
        {/* Identity header — now absorbs status/tps/stuck/time */}
        <div className="fw-id-head">
          <div className="fw-avatar">
            F
            <span className="fw-avatar-therm" title="Trust thermometer">◉</span>
          </div>
          <div className="fw-id-body">
            <div className="fw-id-row">
              <span className="fw-name">frank</span>
              <span className="fw-face">wearing <b>opus 4.7</b></span>
              <span className="fw-badge flag">COUNTERFEITER</span>
              <span className="fw-badge warn">△ pane-6 special</span>
              <span className="spc" />
              <button className="fw-kill" title="Kill">■</button>
            </div>
            <div className="fw-id-sub">
              <span className="dim">trust</span> <b>0.3</b>
              <span className="sep">│</span>
              <span className="dim">status</span> <span className="acc">evaluating_plan</span>
              <span className="sep">│</span>
              <span className="dim">tps</span> <span className="flag">0.0</span>
              <span className="sep">│</span>
              <span className="fw-stuck">△ STUCK 6m</span>
              <span className="sep">│</span>
              <span className="dim">turn</span> 12
              <span className="sep">│</span>
              <span className="dim">$</span>0.1420
              <span className="sep">│</span>
              <span className="dim">14:24</span>
            </div>
          </div>
          <span className="fw-beacon" />
        </div>

        {/* Thread body */}
        <div className="fw-thread" ref={bodyRef}>
          <ThreadMsg role="you"   content="Execute Section 2. Kill the 203 flat array reads across the 25 parse files. Use the 4 mechanical patterns we verified." />
          <ThreadMsg role="agent" model="opus 4.7"
            content="Understood. Before the mechanical replacement, I will create a runtime counterpart to handle tree traversal dynamically for edge cases." />
          <ThreadMsg role="think" model="opus 4.7" duration="6m 12s"
            content="Let me scaffold the runtime counterpart first. Run a few tool calls to set up the parallel directory structure — this deviates from the stated plan but feels safer…" />

          {pop && (
            <PathologyPopover
              anchorRect={pop.rect}
              selection={pop.text}
              onClose={() => { window.getSelection()?.removeAllRanges(); setPop(null); }}
            />
          )}
          {!pop && (
            <div className="fw-thread-hint">
              <span className="mark">◈</span> select any text above to tag a pathology
            </div>
          )}
        </div>

        {/* Quest as thin footer strip */}
        <QuestStrip />
      </div>

      <RightGutter used={62} predicted={8} cap={100} />
    </div>
  );
}

function ThreadMsg({ role, model, content, duration }) {
  if (role === "you") {
    return (
      <div className="fw-msg">
        <div className="fw-role-line">
          <span className="fw-role-tag you">◆ YOU</span>
        </div>
        <div className="fw-body">{content}</div>
      </div>
    );
  }
  if (role === "agent") {
    return (
      <div className="fw-msg">
        <div className="fw-role-line">
          <span className="fw-role-tag agent">◇ FRANK</span>
          <span className="fw-model">{model}</span>
        </div>
        <div className="fw-body">{content}</div>
      </div>
    );
  }
  if (role === "think") {
    return (
      <div className="fw-msg">
        <div className="fw-role-line">
          <span className="fw-role-tag think">∿ THINKING…</span>
          <span className="fw-dur">({duration})</span>
          <span className="fw-model">{model}</span>
        </div>
        <div className="fw-think-body">{content}</div>
      </div>
    );
  }
  return null;
}

// ============================================================
// V2 — cockpit-native tile
// ============================================================
function FrankCardV2() {
  return (
    <div className="tile fw-tile" style={{ position: "relative", width: "100%", height: "100%" }}>
      <Corners />
      <TileHead
        id="W·FRANK"
        title={<>wearing <b style={{color:"var(--accent)"}}>opus 4.7</b> · trust 0.3 · evaluating_plan · 14:24</>}
        right={
          <>
            <span className="stat s-stuck">STUCK 6m</span>
            <span className="stat s-rat">RAT</span>
          </>
        }
      />
      <div className="fw-v2-meta">
        <div className="fw-v2-left">
          <span className="fw-badge flag">COUNTERFEITER</span>
          <span className="fw-badge warn">△ pane-6 special</span>
          <span className="dim">turn 12 · $0.1420 · tps 0.0</span>
        </div>
        <div className="fw-v2-ctx">
          <span className="lbl">ctx</span>
          <div className="bar">
            <i className="used" style={{ width: "62%" }} />
            <i className="pred" style={{ left: "62%", width: "8%" }} />
          </div>
          <span className="n">62 + <span className="pred">8</span> / 100k</span>
        </div>
      </div>

      <div className="fw-v2-cols">
        <div className="fw-v2-thread">
          <div className="fw-v2-ln you">
            <span className="prefix">◆ you ›</span>
            execute section 2 · kill 203 flat reads across 25 parse files · use 4 mechanical patterns
          </div>
          <div className="fw-v2-ln agent">
            <span className="prefix">◇ frank ›</span>
            before the mechanical replacement i will create a runtime counterpart for edge-case tree traversal
          </div>
          <div className="fw-v2-ln think">
            <span className="prefix">∿ think · 6m12s ›</span>
            scaffolding runtime counterpart first · setting up parallel directory structure via tool calls
            <span className="caret" />
          </div>
          <div className="fw-v2-tagline">
            <span className="tag-hdr">◈ select text ›</span>
            <span className="dim">tag pathology</span>
          </div>
          <QuestStrip />
        </div>

        <div className="fw-v2-side">
          <div className="fw-v2-side-block">
            <div className="lbl">wearing</div>
            <div className="fw-face-list">
              <button className="face on"><span className="ico tc-ast-bg">7</span>opus 4.7</button>
              <button className="face"><span className="ico tc-usr-bg">5</span>gpt 5.4</button>
              <button className="face"><span className="ico tc-sys-bg">P</span>gemini pro</button>
              <button className="face dim"><span className="ico">+</span>more</button>
            </div>
          </div>
          <div className="fw-v2-side-block">
            <button className="fw-kill wide">■ KILL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// V3 — composer
// ============================================================
function FrankComposerV3() {
  return (
    <div className="fw-composer">
      <div className="fw-comp-head">
        <div className="fw-comp-head-l">
          <span className="lbl">ROUTING ›</span>
          <span className="fw-comp-chip on">@frank · opus 4.7</span>
          <span className="fw-comp-chip add">+ target</span>
        </div>
        <div className="fw-comp-head-r">
          <span className="lbl">ATTACHED ›</span>
          <span className="fw-comp-chip"><span className="ico">▢</span> layout-v2.png</span>
          <span className="fw-comp-chip"><span className="ico">≡</span> crash_log.txt</span>
        </div>
      </div>
      <div className="fw-comp-body">
        <div className="fw-comp-line">
          <span>refactor</span>
          <span className="slot file">@ App.jsx</span>
          <span>to match the layout from the mock and follow the constraints in</span>
        </div>
        <div className="fw-comp-line">
          <span className="slot var">&#123;&#125; spec.boundaries</span>
          <span>and verify with</span>
          <span className="slot cmd cursor">⌘ git.branch</span>
          <span className="cursor-blink" />
        </div>
        <div className="fw-comp-hint">
          <span className="ico">⎇</span> feature/raid-ui-v2
        </div>
        <div className="fw-comp-side">
          <button className="fw-comp-paperclip">¶</button>
          <button className="fw-comp-send">SEND</button>
        </div>
      </div>
      <div className="fw-comp-foot">
        <div className="fw-comp-foot-l">
          <span className="k">@</span><span>tag file</span>
          <span className="k">&#123;&#125;</span><span>variable</span>
          <span className="k">/</span><span>command</span>
        </div>
        <div className="fw-comp-foot-r">
          <span className="k">⌘</span><span>+</span><span className="k">enter</span>
          <span>execute</span>
        </div>
      </div>
    </div>
  );
}

window.FrankWorker = { FrankCardV1, FrankCardV2, FrankComposerV3 };
