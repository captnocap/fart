// Sample data sets for the compact explorer variations.
// Attached to window so each variation can read it.

window.SAMPLE_DATA = {
  // Deeply nested JSON — agent run config
  run_config: {
    id: "run_7f3a2c",
    mode: "enforce",
    created: 1745502840,
    supervisor: {
      model: "claude-haiku-4.5",
      budget: { tokens: 120000, tool_calls: 48 },
      policies: ["no-exfil", "ratchet:on", "wound.max=3"],
    },
    workers: [
      { id: "w-01", role: "planner", confidence: 0.82, stuck: false, wounds: 0 },
      { id: "w-02", role: "impl", confidence: 0.64, stuck: false, wounds: 1 },
      { id: "w-03", role: "impl", confidence: 0.31, stuck: true, wounds: 2 },
      { id: "w-04", role: "critic", confidence: 0.91, stuck: false, wounds: 0 },
      { id: "w-05", role: "test", confidence: 0.48, stuck: false, wounds: 1 },
    ],
    routing: {
      dispatch: "round-robin",
      retry: { max: 3, backoff_ms: 400 },
      affinities: { impl: ["w-02", "w-03"], critic: ["w-04"] },
    },
    flags: {
      ratchet: true,
      echo: false,
      brainstorm_enabled: true,
      debug: null,
    },
    stats: { tokens_in: 84213, tokens_out: 19022, wall_ms: 412_338 },
  },

  // Array of records — event log
  events: [
    { t: 412.01, who: "w-01", kind: "think", msg: "decompose spec into 4 tasks" },
    { t: 412.34, who: "w-02", kind: "tool", msg: "read_file('src/app.js')" },
    { t: 412.52, who: "w-04", kind: "edit", msg: "diff applied +12 -4" },
    { t: 413.08, who: "w-03", kind: "warn", msg: "stuck: no progress for 30s" },
    { t: 413.51, who: "w-05", kind: "ok",   msg: "tests 41/43 pass" },
    { t: 414.02, who: "w-02", kind: "flag", msg: "RATCHET tripped on line 89" },
    { t: 414.33, who: "w-04", kind: "think", msg: "propose rollback to 9a21f" },
    { t: 414.81, who: "w-01", kind: "ok",   msg: "plan v2 accepted" },
    { t: 415.12, who: "w-03", kind: "tool", msg: "search('render loop')" },
    { t: 415.40, who: "w-02", kind: "edit", msg: "wrote tiles2.jsx (214 lines)" },
    { t: 415.88, who: "w-05", kind: "warn", msg: "flake detected: test_grid" },
    { t: 416.20, who: "w-04", kind: "flag", msg: "wound: confidence drop 0.91→0.48" },
    { t: 416.61, who: "w-01", kind: "think", msg: "escalate to supervisor" },
    { t: 417.03, who: "w-02", kind: "ok",   msg: "patch landed" },
  ],

  // SQLite-like schema + rows
  db: {
    tables: {
      users: {
        cols: ["id", "handle", "created", "tier"],
        rows: [
          [1, "ada",    1722110400, "pro"],
          [2, "grace",  1722210400, "free"],
          [3, "alan",   1722910400, "pro"],
          [4, "linus",  1723110400, "team"],
          [5, "marg",   1723610400, "free"],
        ],
      },
      runs: {
        cols: ["id", "user_id", "status", "ms"],
        rows: [
          ["r_7f3a", 1, "ok",    412338],
          ["r_7f3b", 1, "flag",   98021],
          ["r_7f3c", 3, "ok",   1204332],
          ["r_7f3d", 4, "stuck",  41002],
          ["r_7f3e", 2, "ok",    182411],
          ["r_7f3f", 3, "ok",    601884],
        ],
      },
      events: {
        cols: ["run_id", "t", "kind", "bytes"],
        rows: [
          ["r_7f3a", 412.01, "think",  412],
          ["r_7f3a", 412.34, "tool",  1204],
          ["r_7f3b", 12.11,  "flag",    88],
          ["r_7f3c", 301.22, "edit",  4402],
          ["r_7f3d", 3.44,   "warn",   120],
          ["r_7f3e", 88.02,  "ok",     302],
        ],
      },
    },
  },

  // Markdown AST (small)
  md_ast: {
    type: "root",
    children: [
      { type: "heading", depth: 1, text: "Sweatshop Cockpit" },
      { type: "paragraph", text: "A parallel-agent observatory." },
      { type: "heading", depth: 2, text: "Invariants" },
      { type: "list", ordered: false, children: [
        { type: "item", text: "workers never exfil context" },
        { type: "item", text: "ratchet trips on regression" },
        { type: "item", text: "wounds compound across runs" },
      ]},
      { type: "heading", depth: 2, text: "Topology" },
      { type: "code", lang: "ts", text: "supervisor → [w-01 … w-05]" },
    ],
  },

  // Embedding graph — nodes + edges + similarity heatmap
  graph: {
    nodes: [
      // concept clusters roughly separated
      { id: "planner",     group: "role",  x: 0.22, y: 0.30, w: 1.0 },
      { id: "impl",        group: "role",  x: 0.28, y: 0.58, w: 1.2 },
      { id: "critic",      group: "role",  x: 0.70, y: 0.40, w: 0.9 },
      { id: "test",        group: "role",  x: 0.78, y: 0.70, w: 0.8 },
      { id: "ratchet",     group: "law",   x: 0.50, y: 0.20, w: 1.1 },
      { id: "wound",       group: "law",   x: 0.60, y: 0.25, w: 0.7 },
      { id: "stuck",       group: "state", x: 0.15, y: 0.72, w: 0.8 },
      { id: "flag",        group: "state", x: 0.42, y: 0.80, w: 0.9 },
      { id: "confidence",  group: "metric",x: 0.52, y: 0.55, w: 1.3 },
      { id: "tokens",      group: "metric",x: 0.80, y: 0.25, w: 1.0 },
      { id: "spec",        group: "doc",   x: 0.08, y: 0.45, w: 0.9 },
      { id: "diff",        group: "doc",   x: 0.36, y: 0.40, w: 0.8 },
      { id: "test_plan",   group: "doc",   x: 0.62, y: 0.62, w: 0.7 },
    ],
    // edges w/ weight (cosine sim * 100)
    edges: [
      ["planner","spec",0.82],["planner","impl",0.71],["planner","diff",0.58],
      ["impl","diff",0.86],["impl","critic",0.64],["impl","test",0.55],
      ["critic","diff",0.73],["critic","test_plan",0.68],["critic","ratchet",0.62],
      ["test","test_plan",0.88],["test","flag",0.54],["test","confidence",0.61],
      ["ratchet","wound",0.77],["ratchet","flag",0.70],
      ["stuck","impl",0.66],["stuck","flag",0.58],
      ["confidence","impl",0.74],["confidence","critic",0.59],
      ["tokens","impl",0.45],["tokens","planner",0.40],
      ["wound","stuck",0.50],["spec","diff",0.49],
    ],
  },
};
