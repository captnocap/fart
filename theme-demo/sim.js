// Shared simulation constants + helpers for the sweatshop cockpit
const SIM = (() => {
  const WORKERS = [
    {
      id: 'w1', name: 'W1', task: 'classifier/rationalization.tsz',
      cli: 'claude', model: 'sonnet-4.5',
      status: 'tool', affect: 'confident',
      file: 'src/classifier/rationalization.tsz',
    },
    {
      id: 'w2', name: 'W2', task: 'm3a/echo-layer.tsz',
      cli: 'claude', model: 'sonnet-4.5',
      status: 'think', affect: 'uncertain',
      file: 'src/memory/m3a/echo.tsz',
    },
    {
      id: 'w3', name: 'W3', task: 'cockpit/worker-tile.c.tsz',
      cli: 'codex', model: 'o4-mini',
      status: 'tool', affect: 'confident',
      file: 'carts/sweatshop/WorkerTile.c.tsz',
    },
    {
      id: 'w4', name: 'W4', task: 'ifttt/collision-rule.tsz',
      cli: 'claude', model: 'haiku-4.5',
      status: 'rat', affect: 'rationalizing',
      file: 'src/rules/collision.tsz',
    },
    {
      id: 'w5', name: 'W5', task: 'git-audit/velocity.tsz',
      cli: 'kimi', model: 'k2',
      status: 'idle', affect: 'confident',
      file: 'carts/sweatshop/GitAudit.c.tsz',
    },
  ];

  // Scripted streams per worker — terminal-ish lines that play in order then loop
  const STREAMS = {
    w1: [
      { t: 'tool', s: '● Edit(src/classifier/rationalization.tsz)' },
      { t: 'sys',  s: '  ⎿  Updated with 14 additions and 3 removals' },
      { t: 'edit', s: '    +   fn detectCanonicalPivot(stream: []Row) bool {' },
      { t: 'edit', s: '    +       return scan(stream, PIVOT_PATTERNS);' },
      { t: 'edit', s: '    +   }' },
      { t: 'tool', s: '● Bash(zig build test-rationalization)' },
      { t: 'sys',  s: '  ⎿  Running 12 tests...' },
      { t: 'ok',   s: '  ⎿  12 passed, 0 failed (2.1s)' },
      { t: 'think', s: 'Now I\'ll wire the classifier into the PostToolUse hook…' },
      { t: 'tool', s: '● Read(hooks/supervisor-log.sh)' },
    ],
    w2: [
      { t: 'think', s: 'The echo layer needs redundant encoding across three axes…' },
      { t: 'tool', s: '● Read(src/bun/lib/memory/types.ts)' },
      { t: 'sys',  s: '  ⎿  642 lines · M3A architecture reference' },
      { t: 'think', s: 'Resonance score 0-3 = how many encodings matched.' },
      { t: 'tool', s: '● Write(src/memory/m3a/echo.tsz)' },
      { t: 'edit', s: '    +   vector: VectorIndex,' },
      { t: 'edit', s: '    +   lexical: FTS5Index,' },
      { t: 'edit', s: '    +   graph:  EntityGraph,' },
      { t: 'warn', s: '  ⎿  type mismatch: VectorIndex ≠ embedding.Store' },
      { t: 'think', s: 'Let me check the framework vector primitive…' },
    ],
    w3: [
      { t: 'tool', s: '● Edit(carts/sweatshop/WorkerTile.c.tsz)' },
      { t: 'edit', s: '    +   <tile kind="worker" focus={isFocus}>' },
      { t: 'edit', s: '    +     <WorkerHead name={w.name} status={w.status}/>' },
      { t: 'edit', s: '    +     <WorkerStream lines={stream}/>' },
      { t: 'edit', s: '    +   </tile>' },
      { t: 'tool', s: '● Bash(tsz build carts/sweatshop)' },
      { t: 'sys',  s: '  ⎿  compiling… 80 files · 49KB shell' },
      { t: 'ok',   s: '  ⎿  build ok · 1.4s · generated_app.zig 142kb' },
      { t: 'tool', s: '● Screenshot(carts/sweatshop)' },
      { t: 'ok',   s: '  ⎿  saved tests/screenshots/cockpit-l3.png' },
    ],
    w4: [
      { t: 'tool', s: '● Edit(src/rules/collision.tsz)' },
      { t: 'warn', s: '  ⎿  test case failing: same-file concurrent edit' },
      { t: 'think', s: 'The logic is correct, the test is just wrong.' },
      { t: 'flag', s: '‼ rationalization tell detected: "test is just wrong"' },
      { t: 'flag', s: '  └ law: L-0114 · canonical-pivot' },
      { t: 'flag', s: '  └ escalated → queue · T2' },
      { t: 'think', s: '…let me re-read the test to be sure.' },
      { t: 'tool', s: '● Read(tests/collision.test.tsz)' },
      { t: 'sys',  s: '  ⎿  240 lines · assertion at :187' },
    ],
    w5: [
      { t: 'sys',  s: '● idle · awaiting spec slice' },
      { t: 'sys',  s: '  ⎿  last active 00:14:22 ago' },
      { t: 'sys',  s: '  ⎿  last commit: a4f2e1 add velocity scraper' },
    ],
  };

  const SPEC = {
    goal: 'Sweatshop cockpit — observe + enforce across N worker CLIs',
    constraints: [
      'No cockpit-level tabs',
      'No editor / source browser',
      'Mixed-lane TSX on cursor-ide shell',
      'Local classifiers via llama_exports.zig',
    ],
    non_goals: ['Web UI', 'Replace Claude Code CLI', 'Auto-spawn without approval'],
    files: ['carts/sweatshop/**', 'src/memory/m3a/**', 'src/rules/**'],
    done: [
      { s: 'done', text: 'Shell from cursor-ide cart ported' },
      { s: 'done', text: 'Worker tile · terminal + tool stream' },
      { s: 'done', text: 'Classifier framework wired to PostToolUse' },
      { s: 'active', text: 'M3A echo layer · resonance 0–3' },
      { s: 'todo', text: 'Collision awareness store' },
      { s: 'todo', text: 'Restore-point timeline reader' },
      { s: 'todo', text: 'Crystallize modal · brainstorm → enforce' },
    ],
  };

  const COMMITS = [
    { sha: 'a4f2e1', who: 'W5', msg: 'add git-audit velocity scraper', t: '00:02' },
    { sha: 'b7c913', who: 'W3', msg: 'WorkerTile · focus outline + corner marks', t: '00:04' },
    { sha: 'f1d04a', who: 'W1', msg: 'classifier: canonical-pivot vocab +14 tokens', t: '00:06' },
    { sha: '3e5820', who: 'W3', msg: 'strip: pulseDot keyframe for thinking state', t: '00:09' },
    { sha: '9a77bd', who: 'W2', msg: 'm3a: sketch echo.tsz (compiles)', t: '00:11' },
    { sha: '2cd1f4', who: 'W1', msg: 'hook: wire classifier to PostToolUse', t: '00:14' },
    { sha: '5e0066', who: 'W4', msg: 'collision rule: first pass (WIP)', t: '00:18' },
    { sha: '81c2a3', who: 'W3', msg: 'cockpit: kernel tetris viz · 8 sources', t: '00:22' },
  ];

  // 30-day velocity
  const VELOCITY = [
    2, 4, 3, 6, 5, 7, 9, 4, 6, 8, 12, 10, 7, 9, 11, 14, 16, 12, 10, 13,
    15, 18, 20, 17, 14, 19, 22, 25, 28, 31,
  ];

  const QUEUE = [
    { pri: 't3', who: 'W4', text: 'canonical-pivot block · L-0114', t: '01s' },
    { pri: 't2', who: 'W2', text: 'type mismatch · echo.VectorIndex', t: '12s' },
    { pri: 't2', who: 'W1', text: 'review hook PostToolUse shape', t: '34s' },
    { pri: 't1', who: 'W3', text: 'screenshot ready · cockpit-l3.png', t: '52s' },
    { pri: 't1', who: '—',  text: 'bundle auto-promoted · m3a-echo-v2', t: '1:08' },
    { pri: 't2', who: 'W4', text: 'commit lag 14min · edit-trail', t: '1:42' },
    { pri: 't1', who: 'W5', text: 'idle · offer next task?', t: '2:11' },
  ];

  const AUTOTEST = [
    { st: 'pass', name: 'rationalization/canonical-pivot', sig: '14 tells', t: '2.1s' },
    { st: 'pass', name: 'rationalization/for-now',         sig: '7 tells',  t: '1.8s' },
    { st: 'pass', name: 'drift/scope-expand',              sig: '4 tells',  t: '0.9s' },
    { st: 'fail', name: 'collision/concurrent-edit',       sig: 'assert:187', t: '0.6s' },
    { st: 'pass', name: 'echo/resonance-score',            sig: 'range 0-3', t: '1.2s' },
    { st: 'skip', name: 'wound/pattern-history',           sig: 'pending w4', t: '—' },
    { st: 'pass', name: 'worker-tile/focus',               sig: 'outline ok', t: '0.3s' },
    { st: 'pass', name: 'kernel/tetris-fill',              sig: 'bottom-up', t: '0.4s' },
  ];

  const LAWS = [
    { sev: 'block', law: 'L-0114', msg: 'canonical-pivot blocked · W4 · "test is just wrong"' },
    { sev: 'warn',  law: 'L-0087', msg: 'for-now bandaid detected · W2 · echo layer' },
    { sev: 'info',  law: 'L-0042', msg: 'scope expand flagged · W1 · +hook wiring' },
    { sev: 'ok',    law: 'L-0019', msg: 'airlock commit · W3 · WorkerTile.c.tsz' },
    { sev: 'warn',  law: 'L-0203', msg: 'commit-lag 14min · W4' },
    { sev: 'block', law: 'L-0055', msg: 'destructive: git reset --hard blocked · W1' },
    { sev: 'ok',    law: 'L-0019', msg: 'airlock commit · W5 · velocity.tsz' },
  ];

  const BUNDLES = [
    { ttl: 'cycle-2 · luajit pivot incident', sub: 'd152_cascade_configurator · 27-day detour', res: '●●●' },
    { ttl: 'v1 supervisor-dashboard · god file', sub: 'why cockpit-level tabs fail', res: '●●●' },
    { ttl: 'M3A echo · resonance prior art', sub: 'creative/ai · memory-store.ts', res: '●●○' },
    { ttl: 'engaige · TaskbarNPCStrip', sub: 'peripheral awareness pattern', res: '●●○' },
    { ttl: 'progress_data.sh · read-only git', sub: 'the right use of shell in a cart', res: '●○○' },
  ];

  // helpers
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  return { WORKERS, STREAMS, SPEC, COMMITS, VELOCITY, QUEUE, AUTOTEST, LAWS, BUNDLES, rand, pick };
})();

window.SIM = SIM;
