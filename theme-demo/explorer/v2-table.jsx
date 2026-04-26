// V2: Table — columnar view for array-of-records + SQLite tables.
// Editable cells, column stats, sparkline histograms in headers.

const DexTable = (() => {
  const { useState, useMemo, useRef, useEffect } = React;

  const typeOf = (v) => v === null ? "null" : typeof v;

  function columnStats(col, values) {
    const nums = values.filter((v) => typeof v === "number");
    if (nums.length) {
      const min = Math.min(...nums), max = Math.max(...nums);
      const bins = Array(10).fill(0);
      nums.forEach((n) => {
        const i = max === min ? 0 : Math.min(9, Math.floor(((n - min) / (max - min)) * 10));
        bins[i]++;
      });
      const mx = Math.max(...bins, 1);
      return { kind: "num", min, max, bins, mx };
    }
    const freq = new Map();
    values.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
    return { kind: "cat", unique: freq.size, top: [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) };
  }

  function Cell({ v, col, stats, edited, onEdit, row, q }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef(null);
    useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

    const t = typeOf(v);
    let display = String(v);
    let cls = t === "number" ? "num" : t === "boolean" ? "bool" : "str";

    // status pill column
    if (col === "status" || col === "tier") cls = "pill-c";

    const commit = () => {
      let parsed = draft;
      if (t === "number") parsed = Number(draft);
      setEditing(false);
      onEdit(row, col, parsed);
    };

    const hi = q && String(v).toLowerCase().includes(q.toLowerCase());

    return (
      <td
        className={`${cls} ${editing ? "editing" : ""}`}
        onClick={() => { setDraft(String(v)); setEditing(true); }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          />
        ) : col === "status" || col === "tier" || col === "kind" ? (
          <span style={{ color: colorFor(v) }}>{display}</span>
        ) : (
          <span style={{
            background: hi ? "rgba(214, 165, 74, 0.22)" : "transparent",
            color: edited ? "var(--accent)" : "inherit",
            textDecoration: edited ? "underline" : "none",
          }}>{display}</span>
        )}
        {typeof v === "number" && stats?.kind === "num" && (
          <span className="bar" style={{
            width: `${stats.max === stats.min ? 100 : ((v - stats.min) / (stats.max - stats.min)) * 100}%`,
          }} />
        )}
      </td>
    );
  }

  function colorFor(v) {
    const map = {
      ok: "var(--ok)", pro: "var(--accent)", team: "var(--lilac)", free: "var(--ink-dimmer)",
      flag: "var(--flag)", stuck: "var(--warn)", think: "var(--blue)", tool: "var(--lilac)",
      edit: "var(--blue)", warn: "var(--warn)",
    };
    return map[String(v).toLowerCase()] || "var(--ink)";
  }

  function DexTable({ db, id = "A.2", title = "EVENTS · RUNS · USERS" }) {
    const tables = Object.keys(db.tables);
    const [active, setActive] = useState(tables[0]);
    const tbl = db.tables[active];
    const [sort, setSort] = useState({ col: null, dir: 1 });
    const [q, setQ] = useState("");
    const [edits, setEdits] = useState(new Map()); // key: `${table}:${rowIdx}:${col}`
    const [selRow, setSelRow] = useState(0);

    const editKey = (r, c) => `${active}:${r}:${c}`;
    const onEdit = (rowIdx, col, val) => {
      setEdits((prev) => {
        const n = new Map(prev); n.set(editKey(rowIdx, col), val); return n;
      });
    };

    const rows = useMemo(() => {
      let rs = tbl.rows.map((row, i) => {
        const r = {};
        tbl.cols.forEach((c, ci) => {
          const k = editKey(i, c);
          r[c] = edits.has(k) ? edits.get(k) : row[ci];
        });
        r.__i = i;
        return r;
      });
      if (q) {
        const ql = q.toLowerCase();
        rs = rs.filter((r) => tbl.cols.some((c) => String(r[c]).toLowerCase().includes(ql)));
      }
      if (sort.col) {
        rs = [...rs].sort((a, b) => {
          const av = a[sort.col], bv = b[sort.col];
          return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
        });
      }
      return rs;
    }, [tbl, q, sort, edits, active]);

    const statsByCol = useMemo(() => {
      const out = {};
      tbl.cols.forEach((c) => {
        out[c] = columnStats(c, rows.map((r) => r[c]));
      });
      return out;
    }, [rows, tbl]);

    const selCrumb = rows[selRow];
    const crumbs = selCrumb ? [active, `row ${selCrumb.__i}`, String(selCrumb[tbl.cols[0]])] : [active];

    return (
      <div className="dex table" style={{ width: "100%", height: "100%" }}>
        <div className="dex-head">
          <span className="id">{id}</span>
          <span className="ttl">TABLE · {title}</span>
          <span className="right">
            <span className="tab" onClick={() => setEdits(new Map())}>
              {edits.size ? `REVERT ${edits.size}` : "CLEAN"}
            </span>
            <span className="mono-hint">{rows.length} ROWS</span>
          </span>
        </div>
        <div className="tbl-tabs">
          {tables.map((t) => (
            <span key={t} className={`t ${t === active ? "on" : ""}`}
              onClick={() => { setActive(t); setSelRow(0); setSort({ col: null, dir: 1 }); }}>
              {t}<span className="n">{db.tables[t].rows.length}</span>
            </span>
          ))}
        </div>
        <div className="dex-search">
          <span className="mag">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`filter in ${active} …`} />
          <span className="count">{q ? `${rows.length}/${tbl.rows.length}` : ""}</span>
          <span className="hk">/</span>
        </div>
        <div className="dex-body">
          <div className="dex-main">
            <table>
              <thead>
                <tr>
                  {tbl.cols.map((c) => {
                    const s = statsByCol[c];
                    return (
                      <th key={c}
                        onClick={() => setSort((p) => ({ col: c, dir: p.col === c ? -p.dir : 1 }))}
                        style={{ cursor: "pointer" }}>
                        {c}
                        {sort.col === c && <span style={{ color: "var(--accent)", marginLeft: 4 }}>{sort.dir > 0 ? "▲" : "▼"}</span>}
                        {s?.kind === "num" && (
                          <span className="sparkline">
                            {s.bins.map((b, i) => (
                              <i key={i} style={{ height: `${(b / s.mx) * 10}px` }} />
                            ))}
                          </span>
                        )}
                        <span className="stat">
                          {s?.kind === "num"
                            ? `${s.min}…${s.max}`
                            : `${s.unique} uniq`}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.__i} className={i === selRow ? "sel" : ""} onClick={() => setSelRow(i)}>
                    {tbl.cols.map((c) => (
                      <Cell
                        key={c}
                        v={r[c]}
                        col={c}
                        stats={statsByCol[c]}
                        edited={edits.has(editKey(r.__i, c))}
                        onEdit={onEdit}
                        row={r.__i}
                        q={q}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
            <span>CLICK CELL · EDIT</span>
            <span>CLICK HDR · SORT</span>
          </div>
        </div>
      </div>
    );
  }

  return DexTable;
})();

window.DexTable = DexTable;
