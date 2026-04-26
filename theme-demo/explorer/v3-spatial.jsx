// V3: Spatial "shape of data" — hierarchical bubble/treemap-radial hybrid.
// Each container occupies a bounded circular region; children pack inside.
// Depth limit by default + click-to-drill so nothing overlaps.

const DexSpatial = (() => {
  const { useState, useMemo, useRef, useEffect } = React;

  const typeOf = (v) => v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
  const isContainer = (v) => v !== null && typeof v === "object";

  // Count visible descendants so big containers get more room.
  function countLeaves(node, maxDepth, depth = 0) {
    if (!isContainer(node) || depth >= maxDepth) return 1;
    const entries = Array.isArray(node) ? node : Object.values(node);
    let sum = 0;
    for (const v of entries) sum += countLeaves(v, maxDepth, depth + 1);
    return Math.max(1, sum);
  }

  // Lay each container as a circle; pack children as smaller circles around
  // the perimeter with a leaf column fanned outward.
  function layout(node, path, depth, maxDepth, cx, cy, R, out, parentXY) {
    const pathStr = path.join(".");
    const cont = isContainer(node);
    const opened = cont && depth < maxDepth;
    out.push({
      pathStr, path: [...path], depth,
      x: cx, y: cy, r: R, parent: parentXY,
      key: path.length ? path[path.length - 1] : "root",
      type: typeOf(node),
      node, opened, isContainer: cont,
    });
    if (!opened) return;

    const entries = Array.isArray(node)
      ? node.map((v, i) => [i, v])
      : Object.entries(node);
    const n = entries.length;
    if (n === 0) return;

    // weight entries by their leaf count
    const weights = entries.map(([, v]) => countLeaves(v, maxDepth - depth - 1));
    const totalW = weights.reduce((a, b) => a + b, 0);

    // Place children around parent on a ring. Bigger ones get bigger bubbles.
    const ringR = R * 0.92;
    let angle = -Math.PI / 2; // start top
    const gap = 0.04;
    for (let i = 0; i < n; i++) {
      const frac = weights[i] / totalW;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2 - gap;
      angle = a1 + gap;
      const am = (a0 + a1) / 2;
      // child radius based on allocated arc + depth falloff
      const arc = Math.max(0.2, a1 - a0);
      const childR = Math.max(
        isContainer(entries[i][1]) ? 24 : 14,
        Math.min(R * 0.55, arc * ringR * 0.45)
      );
      const px = cx + Math.cos(am) * (ringR - childR * 0.2);
      const py = cy + Math.sin(am) * (ringR - childR * 0.2);
      layout(entries[i][1], [...path, entries[i][0]], depth + 1, maxDepth,
             px, py, childR, out, { x: cx, y: cy });
    }
  }

  function DexSpatial({ data, id = "A.3", title = "SHAPE" }) {
    const wrapRef = useRef(null);
    const [dim, setDim] = useState({ w: 600, h: 460 });
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(null);
    const [edits, setEdits] = useState(new Map());
    const [maxDepth, setMaxDepth] = useState(3);
    const [root, setRoot] = useState(["root"]); // drilled-in root path

    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        setDim({ w: el.clientWidth, h: el.clientHeight });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const view = useMemo(() => {
      if (edits.size === 0) return data;
      const out = structuredClone(data);
      for (const [pStr, v] of edits) {
        const p = pStr.split(".").map((x) => /^\d+$/.test(x) ? Number(x) : x);
        if (p.length === 1) continue;
        let cur = out;
        for (let i = 1; i < p.length - 1; i++) cur = cur[p[i]];
        cur[p[p.length - 1]] = v;
      }
      return out;
    }, [data, edits]);

    // resolve drilled root
    const rootNode = useMemo(() => {
      let cur = view;
      for (let i = 1; i < root.length; i++) cur = cur[root[i]];
      return cur;
    }, [view, root]);

    const nodes = useMemo(() => {
      const out = [];
      const cx = dim.w / 2, cy = dim.h / 2;
      const R = Math.min(dim.w, dim.h) / 2 - 20;
      layout(rootNode, [...root], 0, maxDepth, cx, cy, R, out, null);
      return out;
    }, [rootNode, root, dim, maxDepth]);

    const visibleNodes = useMemo(() => {
      if (!q) return nodes;
      const ql = q.toLowerCase();
      const keep = new Set();
      nodes.forEach((n) => {
        const m = String(n.key).toLowerCase().includes(ql) ||
                  (!isContainer(n.node) && String(n.node).toLowerCase().includes(ql));
        if (m) {
          const parts = n.path;
          for (let i = 1; i <= parts.length; i++) keep.add(parts.slice(0, i).join("."));
        }
      });
      return nodes.filter((n) => keep.has(n.pathStr));
    }, [nodes, q]);

    const byPath = useMemo(() => new Map(nodes.map((n) => [n.pathStr, n])), [nodes]);
    const selNode = sel ? byPath.get(sel) : null;
    const edit = (pStr, v) => setEdits((p) => { const n = new Map(p); n.set(pStr, v); return n; });

    // Links: parent center -> child center
    const links = useMemo(() => {
      const ls = [];
      visibleNodes.forEach((n) => {
        if (!n.parent) return;
        const hot = sel && (sel === n.pathStr || sel.startsWith(n.pathStr + ".") || n.pathStr.startsWith(sel + "."));
        ls.push({ x1: n.parent.x, y1: n.parent.y, x2: n.x, y2: n.y, hot, depth: n.depth });
      });
      return ls;
    }, [visibleNodes, sel]);

    const drillInto = (n) => {
      if (n.isContainer && n.depth === maxDepth - 1 && !n.opened) {
        // At edge — drill down
        setRoot([...n.path]);
        setSel(null);
      } else {
        setSel(n.pathStr);
      }
    };

    const drillOut = () => {
      if (root.length > 1) setRoot(root.slice(0, -1));
    };

    const crumbs = selNode ? selNode.path : root;

    return (
      <div className="dex spatial" style={{ width: "100%", height: "100%" }}>
        <div className="dex-head">
          <span className="id">{id}</span>
          <span className="ttl">SHAPE · {title}</span>
          <span className="right">
            <span className="tab" onClick={drillOut} style={{ opacity: root.length > 1 ? 1 : 0.4, cursor: root.length > 1 ? "pointer" : "default" }}>↑ UP</span>
            <span className={`tab ${maxDepth === 2 ? "on" : ""}`} onClick={() => setMaxDepth(2)}>L2</span>
            <span className={`tab ${maxDepth === 3 ? "on" : ""}`} onClick={() => setMaxDepth(3)}>L3</span>
            <span className={`tab ${maxDepth === 4 ? "on" : ""}`} onClick={() => setMaxDepth(4)}>L4</span>
            <span className="mono-hint">{nodes.length}N</span>
          </span>
        </div>
        <div className="dex-search">
          <span className="mag">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter keys / values …" />
          <span className="count">{q ? `${visibleNodes.length}/${nodes.length}` : ""}</span>
          <span className="hk">/</span>
        </div>
        <div className="dex-body">
          <div className="dex-main" style={{ overflow: "hidden" }}>
            <div className="canvas-wrap" ref={wrapRef}>
              <svg className="links" viewBox={`0 0 ${dim.w} ${dim.h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
                {/* container rings */}
                {visibleNodes.filter((n) => n.isContainer).map((n) => (
                  <circle
                    key={"c" + n.pathStr}
                    cx={n.x} cy={n.y} r={n.r}
                    fill="none"
                    stroke={sel && (sel === n.pathStr || sel.startsWith(n.pathStr + ".")) ? "var(--accent)" : "var(--rule)"}
                    strokeWidth={n.depth === 0 ? 1.5 : 1}
                    strokeDasharray={n.depth === 0 ? "none" : "3 3"}
                    opacity={0.4 + 0.15 * (3 - Math.min(3, n.depth))}
                  />
                ))}
                {/* connection lines */}
                {links.map((l, i) => (
                  <line key={i}
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke={l.hot ? "var(--accent)" : "var(--rule-bright)"}
                    strokeWidth={l.hot ? 1.5 : 0.8}
                    opacity={l.hot ? 0.85 : 0.35}
                  />
                ))}
              </svg>
              {visibleNodes.filter((n) => n.depth > 0).map((n) => {
                const cont = n.isContainer;
                const isSel = sel === n.pathStr;
                const edited = edits.has(n.pathStr);
                // size: scale with allocated radius, clamped
                const fs = cont ? Math.max(8, Math.min(11, n.r / 5)) : 9;
                const maxChars = Math.max(6, Math.floor(n.r / 3.5));
                return (
                  <div
                    key={n.pathStr}
                    className={`node ${cont ? "container" : ""} ${isSel ? "sel" : ""}`}
                    style={{
                      left: n.x, top: n.y,
                      transform: "translate(-50%, -50%)",
                      fontSize: fs,
                      borderColor: edited ? "var(--accent)" : undefined,
                      color: edited ? "var(--accent)" : undefined,
                      maxWidth: Math.max(60, n.r * 1.8),
                      zIndex: isSel ? 20 : cont ? 2 : 4,
                      background: cont ? "rgba(14,11,9,0.88)" : "var(--bg-1)",
                    }}
                    onClick={(e) => { e.stopPropagation(); drillInto(n); }}
                  >
                    <span className="k">{String(n.key).slice(0, maxChars)}</span>
                    {cont ? (
                      <span className="n">
                        {Array.isArray(n.node) ? `[${n.node.length}]` : `{${Object.keys(n.node).length}}`}
                      </span>
                    ) : (
                      <span className={`v ${n.type === "string" ? "str" : n.type === "boolean" ? "bool" : ""}`}>
                        {n.type === "string" ? `"${String(n.node).slice(0, 10)}${String(n.node).length > 10 ? "…" : ""}"` : String(n.node).slice(0, 12)}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* root label */}
              {nodes[0] && (
                <div style={{
                  position: "absolute",
                  left: nodes[0].x, top: nodes[0].y - nodes[0].r - 4,
                  transform: "translate(-50%, -100%)",
                  fontSize: 8,
                  letterSpacing: "0.2em",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  pointerEvents: "none",
                }}>
                  {root.join(" › ")}
                </div>
              )}

              {/* Scrubber */}
              {selNode && !selNode.isContainer && (
                <div className="scrubber">
                  <div className="k">{selNode.path.slice(-3).join(" › ")}</div>
                  {typeof selNode.node === "number" ? (
                    <>
                      <div className="v-big">{edits.get(selNode.pathStr) ?? selNode.node}</div>
                      <input
                        type="range"
                        min={Math.min(0, Number(selNode.node) * 0.1)}
                        max={Math.max(1, Number(selNode.node) * 3)}
                        step={Math.abs(selNode.node) < 10 ? 0.01 : 1}
                        value={edits.get(selNode.pathStr) ?? selNode.node}
                        onChange={(e) => edit(selNode.pathStr, Number(e.target.value))}
                      />
                      <div className="hint">drag to scrub</div>
                    </>
                  ) : typeof selNode.node === "boolean" ? (
                    <>
                      <div className="v-big" style={{ color: "var(--lilac)" }}>
                        {String(edits.get(selNode.pathStr) ?? selNode.node)}
                      </div>
                      <div style={{ display: "inline-flex", border: "1px solid var(--rule)", cursor: "pointer", fontSize: 8, letterSpacing: "0.1em" }}
                        onClick={() => edit(selNode.pathStr, !(edits.get(selNode.pathStr) ?? selNode.node))}>
                        <span style={{ padding: "1px 6px", color: "var(--lilac)" }}>FLIP</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        defaultValue={String(selNode.node)}
                        style={{ width: "100%", background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 11, padding: "2px 4px" }}
                        onBlur={(e) => edit(selNode.pathStr, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                      />
                      <div className="hint">enter to commit</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="dex-foot">
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="crumb sep">›</span>}
                <span className={`crumb ${i === crumbs.length - 1 ? "last" : ""}`}>{String(c)}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="right">
            {edits.size > 0 && <span className="hot">● {edits.size} EDITS</span>}
            <span>CLICK · DRILL / EDIT</span>
          </div>
        </div>
      </div>
    );
  }

  return DexSpatial;
})();

window.DexSpatial = DexSpatial;
