// V1: Tree — canonical hierarchical rows with inline value editing.
// Works on any nested object (JSON / AST / config). Keyboard j/k, /, Enter.

const DexTree = (() => {
  const { useState, useMemo, useRef, useEffect, useCallback } = React;

  // --- helpers ---------------------------------------------------------------
  const typeOf = (v) => {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  };
  const isContainer = (v) => v !== null && typeof v === "object";
  const summarize = (v) => {
    const t = typeOf(v);
    if (t === "array") return `array · ${v.length}`;
    if (t === "object") return `object · ${Object.keys(v).length}`;
    return t;
  };

  // Flatten the tree into a flat list of visible rows (respecting collapsed set).
  function flatten(node, path, depth, collapsed, parentKey, parentIsArr, out) {
    const t = typeOf(node);
    const key = path.length ? path[path.length - 1] : "root";
    const pathStr = path.join(".");
    const hasKids = isContainer(node);
    const open = hasKids && !collapsed.has(pathStr);
    out.push({
      pathStr, path: [...path], key, depth,
      type: t, node, hasKids, open, parentIsArr,
    });
    if (open) {
      if (t === "array") {
        for (let i = 0; i < node.length; i++) {
          flatten(node[i], [...path, i], depth + 1, collapsed, i, true, out);
        }
      } else {
        for (const k of Object.keys(node)) {
          flatten(node[k], [...path, k], depth + 1, collapsed, k, false, out);
        }
      }
    }
    return out;
  }

  function Highlight({ text, q }) {
    if (!q) return <>{text}</>;
    const s = String(text);
    const ix = s.toLowerCase().indexOf(q.toLowerCase());
    if (ix < 0) return <>{s}</>;
    return (
      <>
        {s.slice(0, ix)}
        <span className="hit">{s.slice(ix, ix + q.length)}</span>
        {s.slice(ix + q.length)}
      </>
    );
  }

  // --- inline value editor --------------------------------------------------
  function ValueCell({ row, value, q, onEdit, isEdited }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef(null);
    const t = typeOf(value);

    useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [editing]);

    const commit = () => {
      let parsed = draft;
      if (t === "number") parsed = Number(draft);
      setEditing(false);
      onEdit(row.path, parsed);
    };

    if (editing && t !== "boolean") {
      return (
        <input
          ref={inputRef}
          className="inline-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      );
    }

    const cls = `v ${t === "string" ? "str" : t === "number" ? "num" :
      t === "boolean" ? "bool" : t === "null" ? "null" : "meta"} ${isEdited ? "edited" : ""}`;

    if (t === "boolean") {
      return (
        <span className={cls}>
          <span
            className="bool-toggle"
            onClick={(e) => { e.stopPropagation(); onEdit(row.path, !value); }}
          >
            <span className={value ? "on" : ""}>TRUE</span>
            <span className={!value ? "on" : ""}>FALSE</span>
          </span>
        </span>
      );
    }

    const display = t === "string" ? <><span className="q">"</span><Highlight text={value} q={q} /><span className="q">"</span></>
                  : t === "null" ? "null"
                  : <Highlight text={String(value)} q={q} />;

    return (
      <span
        className={cls}
        onClick={(e) => {
          if (t === "string" || t === "number") {
            e.stopPropagation();
            setDraft(String(value));
            setEditing(true);
          }
        }}
        title={t === "string" || t === "number" ? "click to edit" : ""}
      >
        {display}
      </span>
    );
  }

  // --- main -----------------------------------------------------------------
  function DexTree({ data, title = "RUN_CONFIG", id = "A.1" }) {
    const [collapsed, setCollapsed] = useState(() => {
      // start with a pleasant mid-depth
      const s = new Set();
      // collapse nothing by default; user will collapse/expand
      return s;
    });
    const [sel, setSel] = useState(0);
    const [q, setQ] = useState("");
    const [edits, setEdits] = useState(new Map()); // pathStr -> new value
    const [showTypes, setShowTypes] = useState(true);
    const scrollerRef = useRef(null);

    // apply edits virtually for display
    const applyEdits = (base) => {
      if (edits.size === 0) return base;
      const out = structuredClone(base);
      for (const [pStr, v] of edits) {
        const path = pStr.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
        if (path.length === 1 && path[0] === "root") continue;
        let cur = out;
        for (let i = 1; i < path.length - 1; i++) cur = cur[path[i]];
        cur[path[path.length - 1]] = v;
      }
      return out;
    };

    const view = useMemo(() => applyEdits(data), [data, edits]);
    const flat = useMemo(() => {
      const out = [];
      flatten(view, ["root"], 0, collapsed, "root", false, out);
      return out;
    }, [view, collapsed]);

    const visible = useMemo(() => {
      if (!q) return flat;
      const ql = q.toLowerCase();
      const keep = new Set();
      // include matches, and all their ancestors
      flat.forEach((r, i) => {
        const key = String(r.key).toLowerCase();
        const val = isContainer(r.node) ? "" : String(r.node).toLowerCase();
        if (key.includes(ql) || val.includes(ql)) {
          keep.add(i);
          // include ancestors
          for (let j = i - 1; j >= 0; j--) {
            if (flat[j].depth < flat[i].depth) { keep.add(j); if (flat[j].depth === 0) break; }
          }
        }
      });
      return flat.filter((_, i) => keep.has(i));
    }, [flat, q]);

    const toggle = useCallback((pStr) => {
      setCollapsed((prev) => {
        const n = new Set(prev);
        if (n.has(pStr)) n.delete(pStr); else n.add(pStr);
        return n;
      });
    }, []);

    const handleEdit = useCallback((path, v) => {
      const pStr = path.join(".");
      setEdits((prev) => {
        const n = new Map(prev);
        n.set(pStr, v);
        return n;
      });
    }, []);

    // crumbs for footer
    const selRow = visible[sel] || visible[0];
    const crumbs = selRow ? selRow.path : ["root"];

    // minimap
    const miniRef = useRef(null);
    useEffect(() => {
      const c = miniRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      const W = c.clientWidth, H = c.clientHeight;
      c.width = W; c.height = H;
      ctx.clearRect(0, 0, W, H);
      const n = flat.length;
      flat.forEach((r, i) => {
        const y = Math.floor((i / n) * H);
        const pathStr = r.pathStr;
        const isEdit = edits.has(pathStr);
        const isHit = q && (String(r.key).toLowerCase().includes(q.toLowerCase()) ||
          (!isContainer(r.node) && String(r.node).toLowerCase().includes(q.toLowerCase())));
        ctx.fillStyle = isEdit ? "#d26a2a" : isHit ? "#d6a54a" : r.depth === 0 ? "#8a4a20" : "#3a2a1e";
        const x = Math.min(W - 2, r.depth * 2);
        ctx.fillRect(x, y, W - x - 1, 1);
      });
    }, [flat, q, edits]);

    // viewport indicator
    const [vp, setVp] = useState({ top: 0, h: 20 });
    useEffect(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const onScroll = () => {
        const ratio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
        const h = Math.max(6, (el.clientHeight / el.scrollHeight) * 100);
        setVp({ top: ratio * (100 - h), h });
      };
      onScroll();
      el.addEventListener("scroll", onScroll);
      return () => el.removeEventListener("scroll", onScroll);
    }, [flat]);

    return (
      <div className="dex tree" style={{ width: "100%", height: "100%" }}>
        <div className="dex-head">
          <span className="id">{id}</span>
          <span className="ttl">TREE · {title}</span>
          <span className="right">
            <span className={`tab ${showTypes ? "on" : ""}`} onClick={() => setShowTypes((s) => !s)}>TYPES</span>
            <span className="tab" onClick={() => setEdits(new Map())}>{edits.size ? `REVERT ${edits.size}` : "CLEAN"}</span>
            <span className="mono-hint">{flat.length} NODES</span>
          </span>
        </div>
        <div className="dex-search">
          <span className="mag">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter keys / values …"
          />
          <span className="count">{q ? `${visible.length}/${flat.length}` : ""}</span>
          <span className="hk">/</span>
        </div>
        <div className="dex-body">
          <div className="dex-main" ref={scrollerRef}>
            {visible.map((r, i) => (
              <div
                key={r.pathStr}
                className={`row ${i === sel ? "sel" : ""}`}
                onClick={() => setSel(i)}
              >
                <span
                  className={`chevron ${r.hasKids ? (r.open ? "open" : "") : "none"}`}
                  onClick={(e) => { e.stopPropagation(); if (r.hasKids) toggle(r.pathStr); }}
                >
                  {r.hasKids ? (r.open ? "▾" : "▸") : "·"}
                </span>
                <span className="line">
                  <span className="guides">
                    {Array.from({ length: r.depth }).map((_, d) => <span key={d} />)}
                  </span>
                  <span className={`k ${r.parentIsArr ? "arr" : ""}`}>
                    {r.parentIsArr ? `[${r.key}]` : <Highlight text={r.key} q={q} />}
                  </span>
                  <span className="colon">:</span>
                  {r.hasKids
                    ? <span className="v meta">{summarize(r.node)}</span>
                    : <ValueCell row={r} value={r.node} q={q} onEdit={handleEdit} isEdited={edits.has(r.pathStr)} />
                  }
                  {showTypes && !r.hasKids && <span className="type-badge">{typeOf(r.node)}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="dex-mini">
            <canvas ref={miniRef} />
            <div className="viewport" style={{ top: `${vp.top}%`, height: `${vp.h}%` }} />
          </div>
        </div>
        <div className="dex-foot">
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="crumb sep">›</span>}
                <span className={`crumb ${i === crumbs.length - 1 ? "last" : ""}`}>{c}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="right">
            {edits.size > 0 && <span className="hot">● {edits.size} EDITS</span>}
            <span>J / K · NAV</span>
            <span>⏎ EDIT</span>
          </div>
        </div>
      </div>
    );
  }

  return DexTree;
})();

window.DexTree = DexTree;
