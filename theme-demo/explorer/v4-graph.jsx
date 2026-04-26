// V4: Graph — Obsidian-style force graph with similarity heatmap sidebar.
// Nodes = entities, edges = similarity. Side panel shows cosine-sim heatmap
// between selected node and all others. Sliders edit edge weights live.

const DexGraph = (() => {
  const { useState, useMemo, useRef, useEffect } = React;

  // Mini force-directed relaxation (runs a handful of frames then stops)
  function relax(nodes, edges, W, H, steps = 120) {
    const pts = nodes.map((n) => ({
      id: n.id,
      x: n.x * W,
      y: n.y * H,
      vx: 0, vy: 0,
      w: n.w || 1,
      group: n.group,
    }));
    const byId = new Map(pts.map((p) => [p.id, p]));
    const links = edges.map(([a, b, w]) => ({ a: byId.get(a), b: byId.get(b), w }));
    const cx = W / 2, cy = H / 2;

    for (let s = 0; s < steps; s++) {
      const t = 1 - s / steps;
      // repel
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = (1400 * t) / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // springs (weight-based ideal length)
      for (const l of links) {
        let dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const ideal = 80 - l.w * 40; // stronger sim -> shorter link
        const f = (d - ideal) * 0.04 * t;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        l.a.vx += fx; l.a.vy += fy;
        l.b.vx -= fx; l.b.vy -= fy;
      }
      // gravity + apply
      for (const p of pts) {
        p.vx += (cx - p.x) * 0.005;
        p.vy += (cy - p.y) * 0.005;
        p.x += p.vx * 0.5;
        p.y += p.vy * 0.5;
        p.vx *= 0.7; p.vy *= 0.7;
        // bounds
        const pad = 30;
        p.x = Math.max(pad, Math.min(W - pad, p.x));
        p.y = Math.max(pad, Math.min(H - pad, p.y));
      }
    }
    return pts;
  }

  function heatColor(v) {
    // v in [0,1] -> dark bg -> amber -> orange
    if (v <= 0) return "#14100d";
    const t = Math.max(0, Math.min(1, v));
    // interp between bg-1 and accent via warn
    if (t < 0.5) {
      // bg-1 -> warn
      const k = t / 0.5;
      const r = Math.round(20 + (214 - 20) * k);
      const g = Math.round(16 + (165 - 16) * k);
      const b = Math.round(13 + (74 - 13) * k);
      return `rgb(${r},${g},${b})`;
    }
    const k = (t - 0.5) / 0.5;
    const r = Math.round(214 + (225 - 214) * k);
    const g = Math.round(165 + (74 - 165) * k);
    const b = Math.round(74 + (42 - 74) * k);
    return `rgb(${r},${g},${b})`;
  }

  function DexGraph({ graph, id = "A.4", title = "EMBEDDINGS" }) {
    const wrapRef = useRef(null);
    const [dim, setDim] = useState({ w: 520, h: 380 });
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(graph.nodes[0].id);
    const [edits, setEdits] = useState(new Map()); // "a|b" -> w
    const [showLabels, setShowLabels] = useState(true);
    const [threshold, setThreshold] = useState(0.5);
    const [hover, setHover] = useState(null);

    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        setDim({ w: Math.max(260, el.clientWidth - 220), h: el.clientHeight });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const effectiveEdges = useMemo(() => {
      return graph.edges.map(([a, b, w]) => {
        const k = `${a}|${b}`;
        return [a, b, edits.has(k) ? edits.get(k) : w];
      });
    }, [graph, edits]);

    // layout
    const pts = useMemo(() => relax(graph.nodes, effectiveEdges, dim.w, dim.h, 140), [graph.nodes, dim, effectiveEdges]);
    const byId = useMemo(() => new Map(pts.map((p) => [p.id, p])), [pts]);

    // Neighbors of selected
    const neighbors = useMemo(() => {
      const map = new Map();
      effectiveEdges.forEach(([a, b, w]) => {
        if (a === sel) map.set(b, w);
        else if (b === sel) map.set(a, w);
      });
      return map;
    }, [effectiveEdges, sel]);

    // Heat grid: similarity between selected and all others (ordered by similarity desc)
    const heatEntries = useMemo(() => {
      const out = graph.nodes
        .filter((n) => n.id !== sel)
        .map((n) => [n.id, neighbors.get(n.id) ?? 0, n.group])
        .sort((a, b) => b[1] - a[1]);
      return out;
    }, [graph, sel, neighbors]);

    const searchHits = useMemo(() => {
      if (!q) return null;
      const ql = q.toLowerCase();
      return new Set(graph.nodes.filter((n) => n.id.toLowerCase().includes(ql)).map((n) => n.id));
    }, [q, graph]);

    const cellSize = Math.floor(190 / Math.ceil(Math.sqrt(graph.nodes.length)));

    const selNode = graph.nodes.find((n) => n.id === sel);
    const selPt = byId.get(sel);

    return (
      <div className="dex graph" style={{ width: "100%", height: "100%" }}>
        <div className="dex-head">
          <span className="id">{id}</span>
          <span className="ttl">GRAPH · {title}</span>
          <span className="right">
            <span className={`tab ${showLabels ? "on" : ""}`} onClick={() => setShowLabels((s) => !s)}>LABELS</span>
            <span className="tab" onClick={() => setEdits(new Map())}>
              {edits.size ? `REVERT ${edits.size}` : "CLEAN"}
            </span>
            <span className="mono-hint">{graph.nodes.length}N · {graph.edges.length}E</span>
          </span>
        </div>
        <div className="dex-search">
          <span className="mag">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="find node …" />
          <span className="count">{q && searchHits ? `${searchHits.size} hit` : ""}</span>
          <span className="hk">/</span>
        </div>
        <div className="dex-body">
          <div className="dex-main" style={{ overflow: "hidden" }}>
            <div className="graph-wrap" ref={wrapRef}>
              <div className="controls">
                <span>SIM ≥</span>
                <input type="range" min={0} max={1} step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ width: 60, accentColor: "var(--accent)" }}
                />
                <span className="hot" style={{ fontVariantNumeric: "tabular-nums" }}>{threshold.toFixed(2)}</span>
              </div>
              <svg className="graph-svg" viewBox={`0 0 ${dim.w} ${dim.h}`} preserveAspectRatio="none">
                {effectiveEdges.map(([a, b, w], i) => {
                  if (w < threshold) return null;
                  const pa = byId.get(a), pb = byId.get(b);
                  if (!pa || !pb) return null;
                  const isHot = a === sel || b === sel || a === hover || b === hover;
                  const dim2 = sel && !isHot;
                  return (
                    <line key={i}
                      x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                      className={`edge ${isHot ? "hot" : ""} ${dim2 ? "dim" : ""}`}
                      strokeWidth={0.5 + w * 2}
                      opacity={isHot ? 0.9 : dim2 ? 0.15 : 0.4 + w * 0.4}
                    />
                  );
                })}
                {pts.map((p) => {
                  const isSel = p.id === sel;
                  const isHover = p.id === hover;
                  const dim2 = (sel && !isSel && !neighbors.has(p.id)) || (searchHits && !searchHits.has(p.id));
                  const r = 5 + p.w * 4 + (isSel ? 2 : 0);
                  return (
                    <g key={p.id}>
                      <circle
                        cx={p.x} cy={p.y} r={r}
                        className={`node g-${p.group} ${isSel ? "sel" : ""}`}
                        opacity={dim2 ? 0.25 : 1}
                        onClick={() => setSel(p.id)}
                        onMouseEnter={() => setHover(p.id)}
                        onMouseLeave={() => setHover(null)}
                        style={{ cursor: "pointer" }}
                      />
                      {showLabels && (
                        <text
                          className={`label ${isSel || isHover ? "sel" : ""} ${dim2 ? "dim" : ""}`}
                          x={p.x + r + 3}
                          y={p.y + 3}
                        >
                          {p.id}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {selNode && selPt && (
                <div className="node-inspect">
                  <div className="k">NODE</div>
                  <div className="v">{selNode.id}</div>
                  <div className="row"><span className="dim">group</span><span style={{ color: "var(--ink)" }}>{selNode.group}</span></div>
                  <div className="row"><span className="dim">weight</span><span className="n">{selNode.w.toFixed(2)}</span></div>
                  <div className="row"><span className="dim">edges</span><span className="n">{neighbors.size}</span></div>
                  {hover && hover !== sel && neighbors.has(hover) && (
                    <>
                      <div className="row" style={{ marginTop: 4, borderTop: "1px dashed var(--rule)", paddingTop: 4 }}>
                        <span className="dim">{sel} ↔ {hover}</span>
                        <span className="n">{neighbors.get(hover).toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0} max={1} step={0.01}
                        value={neighbors.get(hover)}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setEdits((prev) => {
                            const n = new Map(prev);
                            // find the original edge direction
                            const orig = graph.edges.find(([a, b]) => (a === sel && b === hover) || (a === hover && b === sel));
                            if (orig) n.set(`${orig[0]}|${orig[1]}`, v);
                            return n;
                          });
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="heat-panel">
            <div className="ttl">HEAT · {sel}</div>
            <div className="heat-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cellSize}px, 1fr))` }}>
              {heatEntries.map(([id, sim, group]) => (
                <div
                  key={id}
                  className={`cell ${hover === id ? "self" : ""}`}
                  style={{ background: heatColor(sim) }}
                  title={`${id} · ${sim.toFixed(2)}`}
                  onMouseEnter={() => setHover(id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSel(id)}
                />
              ))}
            </div>
            <div className="heat-axis">
              {heatEntries.slice(0, 6).map(([id, sim]) => (
                <div key={id} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: hover === id ? "var(--accent)" : "var(--ink-dim)" }}>{id}</span>
                  <span style={{ color: "var(--blue)", fontVariantNumeric: "tabular-nums" }}>{sim.toFixed(2)}</span>
                </div>
              ))}
              {heatEntries.length > 6 && <div style={{ color: "var(--ink-ghost)" }}>+{heatEntries.length - 6} more …</div>}
            </div>
            <div className="legend-row">
              <span className="sw" style={{ color: "var(--blue)" }}><i />role</span>
              <span className="sw" style={{ color: "var(--flag)" }}><i />law</span>
              <span className="sw" style={{ color: "var(--warn)" }}><i />state</span>
              <span className="sw" style={{ color: "var(--ok)" }}><i />metric</span>
              <span className="sw" style={{ color: "var(--lilac)" }}><i />doc</span>
            </div>
          </div>
        </div>
        <div className="dex-foot">
          <div className="crumbs">
            <span className="crumb">graph</span>
            <span className="crumb sep">›</span>
            <span className="crumb last">{sel}</span>
            {hover && hover !== sel && <><span className="crumb sep">~</span><span className="crumb k">{hover}</span></>}
          </div>
          <div className="right">
            {edits.size > 0 && <span className="hot">● {edits.size} EDITS</span>}
            <span>HOVER · INSPECT</span>
            <span>CLICK · FOCUS</span>
          </div>
        </div>
      </div>
    );
  }

  return DexGraph;
})();

window.DexGraph = DexGraph;
