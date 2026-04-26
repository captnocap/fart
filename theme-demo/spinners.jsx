// Nine distinct spinner components, all built on a nested 3x3 grid primitive.
// Each exports to window at the bottom so app.jsx can use them.

const { useState, useEffect, useMemo, useRef } = React;

// Shared tick hook — returns an incrementing integer every `ms` milliseconds.
function useTick(ms = 180, running = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT(x => x + 1), ms);
    return () => clearInterval(id);
  }, [ms, running]);
  return t;
}

// ============================================================
// TINY CELL — replaces what was a single colored square.
// Each tiny cell is a 3×3 of mini-dots running one of 9 effects.
// The `effect` prop (0..8) picks which effect plays inside.
// The `active` prop controls visibility: active = full ink, inactive = very faint.
// ============================================================
function TinyCell({ effect = 0, active = false, accent = false, speed = 1, tick }) {
  // 9 distinct tiny sub-effects.
  // We reuse the shared tick so all tinies in the whole page are in phase — visually tight.
  const t = tick;
  let pattern = Array(9).fill(0);

  if (effect === 0) {
    // Horizontal scan line
    const row = t % 3;
    for (let c = 0; c < 3; c++) pattern[row * 3 + c] = 1;
  } else if (effect === 1) {
    // Vertical scan line
    const col = t % 3;
    for (let r = 0; r < 3; r++) pattern[r * 3 + col] = 1;
  } else if (effect === 2) {
    // Orbit perimeter
    const perim = [0, 1, 2, 5, 8, 7, 6, 3];
    pattern[perim[t % perim.length]] = 1;
    pattern[perim[(t + 4) % perim.length]] = 1;
  } else if (effect === 3) {
    // Pulse rings
    const layers = [[4], [1, 3, 5, 7], [0, 2, 6, 8]];
    layers[t % 3].forEach(i => (pattern[i] = 1));
  } else if (effect === 4) {
    // Diagonal sweep
    const diag = t % 5;
    const diags = [[0], [1, 3], [2, 4, 6], [5, 7], [8]];
    diags[diag].forEach(i => (pattern[i] = 1));
  } else if (effect === 5) {
    // Checkerboard flip
    const p = t % 2 === 0
      ? [1, 0, 1, 0, 1, 0, 1, 0, 1]
      : [0, 1, 0, 1, 0, 1, 0, 1, 0];
    pattern = p;
  } else if (effect === 6) {
    // Snake (short)
    const path = [0, 1, 2, 5, 4, 3, 6, 7, 8];
    const head = t % path.length;
    for (let k = 0; k < 3; k++) pattern[path[(head - k + path.length) % path.length]] = 1;
  } else if (effect === 7) {
    // Binary counter (3-bit across bottom row)
    const n = t % 8;
    for (let b = 0; b < 3; b++) pattern[6 + b] = (n & (1 << (2 - b))) ? 1 : 0;
    pattern[4] = 1; // center dot always on
  } else if (effect === 8) {
    // Corners chasing
    const corners = [0, 2, 8, 6];
    pattern[corners[t % 4]] = 1;
    pattern[4] = (t % 2 === 0) ? 1 : 0;
  }

  const onColor = accent ? 'var(--accent)' : 'var(--ink)';
  const offColor = active ? 'oklch(from var(--ink) l c h / 0.12)' : 'oklch(from var(--ink) l c h / 0.05)';
  const activeOn = active ? onColor : 'oklch(from var(--ink) l c h / 0.22)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        gap: 1,
        width: '100%',
        height: '100%',
        padding: 1,
      }}
    >
      {pattern.map((v, i) => (
        <div
          key={i}
          style={{
            background: v ? activeOn : offColor,
            borderRadius: 0.5,
            transition: 'background 120ms linear',
          }}
        />
      ))}
    </div>
  );
}

// Grid primitive — now each cell is a TinyCell. `cells` is length 9 of class names;
// "on", "head", "body", "accent", "r0".."r2", "o", "o2", "trail", "a", "b", "c" all read as "active".
// Each inner cell gets a different tiny effect (0..8) based on its position.
function MiniGrid({ cells = [], gap = 4, size = 108, render, extraClass = '', accentCells = new Set() }) {
  const tick = useTick(220); // global-ish tick for tiny grids
  return (
    <div className={`mini ${extraClass}`} style={{ '--gap': gap + 'px', '--size': size + 'px' }}>
      {Array.from({ length: 9 }, (_, i) => {
        const cls = cells[i] || '';
        const active = cls !== '';
        const accent = accentCells.has(i) || /accent|head|r2|o2|boom|fresh|b/.test(cls);
        return (
          <div key={i} className={`dot ${cls}`} style={{ position: 'relative', overflow: 'hidden' }}>
            <TinyCell effect={i} active={active} accent={accent} tick={tick} />
            {render ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>{render(i)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------- 1. SNAKE ----------
// A snake-body that travels a Hamiltonian path around the 3x3 and grows/shrinks.
// Path: 0,1,2,5,4,3,6,7,8 (back and forth scan). Length grows then eats tail.
function SnakeSpinner({ speed }) {
  // Snake-scan: boustrophedon traversal of the 3x3, returning to start via column 0.
  const path = [0, 1, 2, 5, 4, 3, 6, 7, 8, 7, 6, 3, 4, 5, 2, 1];
  const t = useTick(260 / speed);
  const len = 4;
  const headIdx = t % path.length;
  const cells = Array(9).fill('');
  for (let k = 0; k < len; k++) {
    const pos = path[(headIdx - k + path.length) % path.length];
    cells[pos] = k === 0 ? 'head' : 'body';
  }
  return <MiniGrid cells={cells} extraClass="snake" />;
}

// ---------- 2. MINESWEEPER ----------
// Sweeps cells one by one, occasionally "boom" on a mine, then reset.
function MinesSpinner({ speed }) {
  const t = useTick(220 / speed);
  // Pre-compute a deterministic cycle: 9 reveals + 1 boom + 2 blank frames.
  const cycle = 12;
  const frame = t % cycle;
  const mineIdx = 5; // fixed position so the "explosion" is consistent
  const neighbors = [0, 2, 1, 3, 0, 2, 1, 3, 0]; // faux neighbor counts per cell
  const order = [0, 1, 2, 3, 4, 6, 7, 8, 5]; // reveal order, mine last

  const cells = Array(9).fill('');
  if (frame < 9) {
    for (let i = 0; i <= frame; i++) {
      const idx = order[i];
      if (idx === mineIdx && i === 9) cells[idx] = 'revealed boom';
      else cells[idx] = `revealed n${neighbors[idx]}`;
    }
  } else if (frame === 9) {
    for (let i = 0; i < 9; i++) cells[order[i]] = `revealed n${neighbors[order[i]]}`;
    cells[mineIdx] = 'revealed boom';
  } else {
    // brief blank before next cycle
  }
  const labels = ['', '1', '2', '1', '', '1', '2', '1', ''];
  return (
    <MiniGrid
      cells={cells}
      extraClass="mines"
      gap={2}
      render={(i) => {
        if (cells[i].includes('boom')) return '✕';
        if (cells[i].includes('revealed') && labels[i]) return labels[i];
        return null;
      }}
    />
  );
}

// ---------- 3. TIC TAC TOE ----------
// Plays a 6-move game, draws a strike line on the win, pauses, resets.
function TicTacToeSpinner({ speed }) {
  const t = useTick(380 / speed);
  const moves = [0, 4, 1, 2, 6, 3]; // X,O,X,O,X — winning diag? No, this fills left col for X: 0,3,6. Let's do: X at 0,3,6; O at 4,2
  const sequence = [
    { idx: 0, mark: 'x' },
    { idx: 4, mark: 'o' },
    { idx: 3, mark: 'x' },
    { idx: 2, mark: 'o' },
    { idx: 6, mark: 'x' }, // X wins left column
  ];
  const cycle = sequence.length + 3; // +3 hold frames with strike
  const frame = t % cycle;
  const cells = Array(9).fill('');
  const marks = Array(9).fill(null);
  const steps = Math.min(frame, sequence.length);
  for (let i = 0; i < steps; i++) {
    marks[sequence[i].idx] = sequence[i].mark;
  }
  const winning = frame >= sequence.length;
  return (
    <div style={{ position: 'relative' }}>
      <MiniGrid
        cells={cells}
        extraClass="ttt"
        gap={2}
        render={(i) => {
          if (!marks[i]) return null;
          return <span className={marks[i] === 'x' ? 'mark-x' : 'mark-o'}>{marks[i] === 'x' ? '╳' : '◯'}</span>;
        }}
      />
      {winning && (
        <div
          style={{
            position: 'absolute',
            left: '14%',
            top: '50%',
            width: '72%',
            height: 2,
            background: 'var(--accent)',
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
          }}
        />
      )}
    </div>
  );
}

// ---------- 4. TETRIS ----------
// A tetromino-ish piece falls down the 3-wide, 3-tall stage and "locks" to the bottom row.
// We rotate through three piece shapes.
function TetrisSpinner({ speed }) {
  const t = useTick(260 / speed);
  // Each "piece drop": 4 frames of falling, then the piece becomes the bottom row "stacked".
  // 3 drops per cycle clears the board.
  const pieces = [
    { shape: [[1, 1, 0], [0, 1, 0]], color: 'a' }, // T-ish
    { shape: [[1, 0, 0], [1, 1, 0]], color: 'b' }, // L-ish
    { shape: [[1, 1, 0], [1, 1, 0]], color: 'c' }, // O (2x2)
  ];
  const framesPerDrop = 4;
  const cycle = pieces.length * framesPerDrop + 2;
  const f = t % cycle;
  const cells = Array(9).fill('');
  const dropIdx = Math.min(Math.floor(f / framesPerDrop), pieces.length - 1);
  const dropFrame = f % framesPerDrop;

  // Stack already-landed pieces as solid rows (visual simplification).
  // After drop 0, bottom row lights up; after drop 1, middle row lights up; after drop 2, top row.
  for (let d = 0; d < dropIdx; d++) {
    const row = 2 - d;
    for (let c = 0; c < 3; c++) cells[row * 3 + c] = pieces[d].color;
  }

  // Draw current falling piece.
  if (f < pieces.length * framesPerDrop) {
    const piece = pieces[dropIdx];
    const topRow = Math.min(dropFrame, 3 - piece.shape.length - (2 - dropIdx));
    const clampedTop = Math.max(0, Math.min(topRow, (2 - dropIdx) - (piece.shape.length - 1)));
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < 3; c++) {
        if (piece.shape[r][c]) {
          const gr = clampedTop + r;
          if (gr >= 0 && gr <= 2) cells[gr * 3 + c] = piece.color;
        }
      }
    }
  } else {
    // Flash: all three rows solid briefly = "line clear"
    for (let i = 0; i < 9; i++) cells[i] = 'a';
  }

  return <MiniGrid cells={cells} extraClass="tet" gap={3} />;
}

// ---------- 5. PULSE (concentric rings) ----------
function PulseSpinner({ speed }) {
  const t = useTick(300 / speed);
  const ring = t % 3; // 0 = center, 1 = edges-midpoints, 2 = corners
  const layers = [
    [4],
    [1, 3, 5, 7],
    [0, 2, 6, 8],
  ];
  const cells = Array(9).fill('');
  layers[ring].forEach(i => (cells[i] = `r${ring}`));
  return <MiniGrid cells={cells} extraClass="pulse" gap={6} />;
}

// ---------- 6. ORBIT ----------
// Two dots chase each other around the perimeter, center pulses.
function OrbitSpinner({ speed }) {
  const t = useTick(150 / speed);
  const perim = [0, 1, 2, 5, 8, 7, 6, 3];
  const cells = Array(9).fill('');
  const a = perim[t % perim.length];
  const b = perim[(t + 4) % perim.length];
  const trailA = perim[(t - 1 + perim.length) % perim.length];
  const trailB = perim[(t + 3) % perim.length];
  cells[trailA] = 'trail';
  cells[trailB] = 'trail';
  cells[a] = 'o';
  cells[b] = 'o2';
  if (t % 2 === 0) cells[4] = 'trail';
  return <MiniGrid cells={cells} extraClass="orbit" gap={5} />;
}

// ---------- 7. BINARY COUNTER ----------
// 9 cells = 9-bit counter ticking up.
function BinarySpinner({ speed }) {
  const t = useTick(140 / speed);
  const n = t % 512;
  const cells = Array(9).fill('').map((_, i) => (n & (1 << (8 - i)) ? 'on' : ''));
  return <MiniGrid cells={cells} extraClass="bin" gap={5} />;
}

// ---------- 8. LIFE (cellular automaton blinker/glider cycle) ----------
// Cycles through known 3x3 patterns: blinker horizontal → blinker vertical → block → empty.
function LifeSpinner({ speed }) {
  const t = useTick(420 / speed);
  const patterns = [
    [0, 0, 0, 1, 1, 1, 0, 0, 0], // blinker horizontal
    [0, 1, 0, 0, 1, 0, 0, 1, 0], // blinker vertical
    [1, 1, 0, 1, 1, 0, 0, 0, 0], // block
    [1, 0, 1, 0, 1, 0, 1, 0, 1], // checker
    [0, 1, 0, 1, 0, 1, 0, 1, 0], // anti-checker
  ];
  const prev = patterns[(t - 1 + patterns.length) % patterns.length];
  const curr = patterns[t % patterns.length];
  const cells = curr.map((v, i) => {
    if (!v) return '';
    if (!prev[i]) return 'fresh'; // newly born = accent
    return 'on';
  });
  return <MiniGrid cells={cells} extraClass="life" gap={5} />;
}

// ---------- 9. SORT ----------
// Bar-chart "bubble sort" in progress. Nine values, swap nearest out-of-order pair each tick.
function SortSpinner({ speed }) {
  const [bars, setBars] = useState(() => [3, 7, 1, 8, 4, 6, 2, 9, 5]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let mounted = true;
    let i = 0;
    const step = () => {
      if (!mounted) return;
      setBars(prev => {
        const next = [...prev];
        const sorted = [...next].every((v, k, a) => k === 0 || a[k - 1] <= v);
        if (sorted) {
          // shuffle reset
          for (let k = next.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [next[k], next[j]] = [next[j], next[k]];
          }
          i = 0;
          setActive(-1);
          return next;
        }
        // one pass of bubble sort, one swap per tick
        const idx = i % (next.length - 1);
        if (next[idx] > next[idx + 1]) {
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          setActive(idx);
        } else {
          setActive(-1);
        }
        i++;
        return next;
      });
    };
    const id = setInterval(step, 180 / speed);
    return () => { mounted = false; clearInterval(id); };
  }, [speed]);

  const max = 9;
  const tick = useTick(220);
  return (
    <div className="sort" style={{ width: 108, height: 108, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
      {bars.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            overflow: 'hidden',
            transition: 'height 160ms cubic-bezier(.4,0,.2,1)',
          }}
        >
          <TinyCell effect={i % 9} active={true} accent={i === active || i === active + 1} tick={tick} />
        </div>
      ))}
    </div>
  );
}

// Shared helper: render a positioned tile as a TinyCell (so inner 3×3 keeps running while the outer tile slides).
function PositionedTile({ tileId, pos, cell, gap, duration, tick }) {
  const r = Math.floor(pos / 3), c = pos % 3;
  return (
    <div
      style={{
        position: 'absolute',
        width: cell,
        height: cell,
        left: c * (cell + gap),
        top: r * (cell + gap),
        transition: `left ${duration}ms cubic-bezier(.5,0,.3,1), top ${duration}ms cubic-bezier(.5,0,.3,1)`,
        overflow: 'hidden',
      }}
    >
      <TinyCell effect={tileId % 9} active={true} tick={tick} />
    </div>
  );
}

// ---------- 10. SLIDE (15-puzzle) ----------
// Eight tiles + one empty cell; tiles slide into the gap continuously. Same color.
function SlideSpinner({ speed }) {
  // Positions: indices 0..8 in the 3x3. We track which tile (id 0..7) sits at each position,
  // with -1 marking the empty cell.
  const [layout, setLayout] = useState(() => [0, 1, 2, 3, 4, 5, 6, 7, -1]);
  const emptyRef = useRef(8);
  const lastMoveRef = useRef(-1);

  useEffect(() => {
    const id = setInterval(() => {
      setLayout(prev => {
        const empty = emptyRef.current;
        const r = Math.floor(empty / 3), c = empty % 3;
        const neighbors = [];
        if (r > 0) neighbors.push(empty - 3);
        if (r < 2) neighbors.push(empty + 3);
        if (c > 0) neighbors.push(empty - 1);
        if (c < 2) neighbors.push(empty + 1);
        // Avoid undoing the last move so it feels intentional.
        const choices = neighbors.filter(n => n !== lastMoveRef.current);
        const pick = (choices.length ? choices : neighbors)[Math.floor(Math.random() * (choices.length || neighbors.length))];
        const next = [...prev];
        next[empty] = prev[pick];
        next[pick] = -1;
        lastMoveRef.current = empty;
        emptyRef.current = pick;
        return next;
      });
    }, 360 / speed);
    return () => clearInterval(id);
  }, [speed]);

  // Build tileId -> position map so we can place each tile by transform (keeps element identity stable).
  const posOf = {};
  layout.forEach((tileId, pos) => {
    if (tileId >= 0) posOf[tileId] = pos;
  });

  const size = 108;
  const gap = 4;
  const cell = (size - gap * 2) / 3;
  const tick = useTick(220);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {Array.from({ length: 8 }, (_, tileId) => (
        <PositionedTile
          key={tileId}
          tileId={tileId}
          pos={posOf[tileId]}
          cell={cell}
          gap={gap}
          duration={260 / speed}
          tick={tick}
        />
      ))}
    </div>
  );
}

// ---------- 11. ROTATE (2x2 corner) ----------
// Four tiles in a 2x2 corner rotate around each other; the corner being rotated
// shifts around the grid every cycle.
function RotateSpinner({ speed }) {
  // Tile ids 0..8 start at their natural position. We transform each tile to its current position.
  const [positions, setPositions] = useState(() => Array.from({ length: 9 }, (_, i) => i));
  const cornerRef = useRef(0); // which 2x2 block is rotating: 0=TL, 1=TR, 2=BL, 3=BR
  const stepRef = useRef(0);

  // 2x2 block cell indices for each corner choice
  const blocks = [
    [0, 1, 3, 4], // TL
    [1, 2, 4, 5], // TR
    [3, 4, 6, 7], // BL
    [4, 5, 7, 8], // BR
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setPositions(prev => {
        const next = [...prev];
        const block = blocks[cornerRef.current];
        // Map block order to CW rotation: [a,b,c,d] (TL,TR,BL,BR) → rotate CW
        // Pattern after rotate: pos a gets what was at c, b gets a, c gets d, d gets b
        const [a, b, c, d] = block;
        const posToTile = {};
        next.forEach((pos, tileId) => { posToTile[pos] = tileId; });
        const ta = posToTile[a], tb = posToTile[b], tc = posToTile[c], td = posToTile[d];
        next[ta] = b;
        next[tb] = d;
        next[td] = c;
        next[tc] = a;
        stepRef.current++;
        if (stepRef.current % 4 === 0) {
          cornerRef.current = (cornerRef.current + 1) % 4;
        }
        return next;
      });
    }, 320 / speed);
    return () => clearInterval(id);
  }, [speed]);

  const size = 108;
  const gap = 4;
  const cell = (size - gap * 2) / 3;
  const tick = useTick(220);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {Array.from({ length: 9 }, (_, tileId) => (
        <PositionedTile
          key={tileId}
          tileId={tileId}
          pos={positions[tileId]}
          cell={cell}
          gap={gap}
          duration={300 / speed}
          tick={tick}
        />
      ))}
    </div>
  );
}

// ---------- 12. SHUFFLE (pair swaps) ----------
// Adjacent pairs of tiles swap positions in sequence. Identical color — all about motion.
function ShuffleSpinner({ speed }) {
  const [positions, setPositions] = useState(() => Array.from({ length: 9 }, (_, i) => i));
  const swapsRef = useRef(0);

  // A rotating list of adjacent pairs to swap, chosen to feel like continuous motion.
  const pairs = [
    [0, 1], [3, 4], [6, 7],
    [1, 2], [4, 5], [7, 8],
    [0, 3], [1, 4], [2, 5],
    [3, 6], [4, 7], [5, 8],
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setPositions(prev => {
        const next = [...prev];
        const [a, b] = pairs[swapsRef.current % pairs.length];
        const posToTile = {};
        next.forEach((pos, tileId) => { posToTile[pos] = tileId; });
        const ta = posToTile[a], tb = posToTile[b];
        next[ta] = b;
        next[tb] = a;
        swapsRef.current++;
        return next;
      });
    }, 280 / speed);
    return () => clearInterval(id);
  }, [speed]);

  const size = 108;
  const gap = 4;
  const cell = (size - gap * 2) / 3;
  const tick = useTick(220);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {Array.from({ length: 9 }, (_, tileId) => (
        <PositionedTile
          key={tileId}
          tileId={tileId}
          pos={positions[tileId]}
          cell={cell}
          gap={gap}
          duration={260 / speed}
          tick={tick}
        />
      ))}
    </div>
  );
}

Object.assign(window, {
  SnakeSpinner, MinesSpinner, TicTacToeSpinner, TetrisSpinner,
  PulseSpinner, OrbitSpinner, BinarySpinner, LifeSpinner, SortSpinner,
  SlideSpinner, RotateSpinner, ShuffleSpinner,
  useTick, MiniGrid,
});
