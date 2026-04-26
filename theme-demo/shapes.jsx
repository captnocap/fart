// Spinner Shapes — compose nested 3×3 units into larger shapes.
// Each "unit" is a 3×3 of TinyCells (each tiny cell runs one of 9 effects).
// Shapes = multiple units laid out in triangle, diamond, cross, etc.

const { useState, useEffect, useRef } = React;

function useTick(ms = 200) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

// Nine tiny sub-effects (same vocabulary as the main sheet).
function tinyPattern(effect, t) {
  const p = Array(9).fill(0);
  if (effect === 0) { const r = t % 3; for (let c=0;c<3;c++) p[r*3+c]=1; }
  else if (effect === 1) { const c = t % 3; for (let r=0;r<3;r++) p[r*3+c]=1; }
  else if (effect === 2) { const perim=[0,1,2,5,8,7,6,3]; p[perim[t%perim.length]]=1; p[perim[(t+4)%perim.length]]=1; }
  else if (effect === 3) { const layers=[[4],[1,3,5,7],[0,2,6,8]]; layers[t%3].forEach(i=>p[i]=1); }
  else if (effect === 4) { const diags=[[0],[1,3],[2,4,6],[5,7],[8]]; diags[t%5].forEach(i=>p[i]=1); }
  else if (effect === 5) { const base=(t%2===0)?[1,0,1,0,1,0,1,0,1]:[0,1,0,1,0,1,0,1,0]; for (let i=0;i<9;i++) p[i]=base[i]; }
  else if (effect === 6) { const path=[0,1,2,5,4,3,6,7,8]; const head=t%path.length; for (let k=0;k<3;k++) p[path[(head-k+path.length)%path.length]]=1; }
  else if (effect === 7) { const n=t%8; for (let b=0;b<3;b++) p[6+b]=(n&(1<<(2-b)))?1:0; p[4]=1; }
  else if (effect === 8) { const corners=[0,2,8,6]; p[corners[t%4]]=1; p[4]=(t%2===0)?1:0; }
  return p;
}

// One tiny 3×3 cell inside a unit. `effect` picks which animation plays.
// `accent` highlights via accent color; `dim` makes the whole unit subdued.
function TinyCell({ effect, active, accent, dim, tick }) {
  const pat = tinyPattern(effect, tick);
  const onColor = accent ? 'var(--accent)' : 'var(--ink)';
  const opacity = dim ? 0.35 : 1;
  const activeOn = active ? onColor : 'oklch(from var(--ink) l c h / 0.2)';
  const offColor = active ? 'oklch(from var(--ink) l c h / 0.08)' : 'oklch(from var(--ink) l c h / 0.04)';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
      gap: 1,
      width: '100%',
      height: '100%',
      padding: 1,
      opacity,
      transition: 'opacity 200ms ease',
    }}>
      {pat.map((v,i)=>(
        <div key={i} style={{ background: v ? activeOn : offColor, borderRadius: 0.5, transition: 'background 120ms linear' }} />
      ))}
    </div>
  );
}

// A UNIT = a 3×3 of TinyCells. Outer spinner logic passes `active` (which cells are bright) & accents.
function Unit({ unitId = 0, size = 56, gap = 2, activeCells, accentCells, tick }) {
  // unitId affects which 9 tiny effects this unit uses (we just rotate them for variety).
  const offset = unitId % 9;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
      gap,
      width: size,
      height: size,
    }}>
      {Array.from({length: 9}, (_, i) => {
        const active = activeCells ? activeCells(i, unitId, tick) : true;
        const accent = accentCells ? accentCells(i, unitId, tick) : false;
        return (
          <TinyCell
            key={i}
            effect={(i + offset) % 9}
            active={active}
            accent={accent}
            tick={tick + unitId * 2}
          />
        );
      })}
    </div>
  );
}

// ----- SHAPE LAYOUTS -----
// Each shape is an array of {row, col, unitId} placements in an NxN grid.

function Shape({ layout, cols, size = 56, activeCells, accentCells, tick, unitGap = 8 }) {
  // Compute bounding box
  const maxCol = Math.max(...layout.map(l => l.col)) + 1;
  const maxRow = Math.max(...layout.map(l => l.row)) + 1;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${maxCol}, ${size}px)`,
      gridTemplateRows: `repeat(${maxRow}, ${size}px)`,
      gap: unitGap,
    }}>
      {layout.map((l, idx) => (
        <div key={idx} style={{
          gridColumn: l.col + 1,
          gridRow: l.row + 1,
        }}>
          <Unit
            unitId={l.unitId ?? idx}
            size={size}
            activeCells={activeCells}
            accentCells={accentCells}
            tick={tick}
          />
        </div>
      ))}
    </div>
  );
}

// ----- COMPOSITIONS -----

// 1. TRIANGLE — rows of 1, 2, 3 stacked
function TriangleShape({ tick }) {
  const layout = [
    { row: 0, col: 1, unitId: 0 },                                   // row 0: 1 unit, centered
    { row: 1, col: 0, unitId: 1 }, { row: 1, col: 1, unitId: 2 },    // row 1: 2 units (offset)
    { row: 2, col: 0, unitId: 3 }, { row: 2, col: 1, unitId: 4 }, { row: 2, col: 2, unitId: 5 }, // row 2: 3 units
  ];
  // A "rain" travels down: which row is currently highlighted.
  const activeRow = tick % 6;
  return (
    <Shape
      tick={tick}
      layout={layout}
      activeCells={(_, unitId) => true}
      accentCells={(cellIdx, unitId, t) => {
        // The accent flows down by unit row.
        const unitRow = layout[unitId].row;
        return (t % 4) === unitRow;
      }}
    />
  );
}

// 2. DIAMOND — 1, 3, 1 (total 5 units, diamond)
function DiamondShape({ tick }) {
  const layout = [
    { row: 0, col: 1 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
    { row: 2, col: 1 },
  ];
  return (
    <Shape
      tick={tick}
      layout={layout}
      activeCells={() => true}
      accentCells={(_, unitId, t) => {
        // Accent pulses from center outward.
        const dist = [1, 1, 0, 1, 1][unitId]; // center unit = idx 2
        return (t % 3) === dist;
      }}
    />
  );
}

// 3. CROSS (plus sign) — 5 units in + shape
function CrossShape({ tick }) {
  const layout = [
    { row: 0, col: 1 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
    { row: 2, col: 1 },
  ];
  // Different from diamond: accent travels arm by arm (clockwise from top).
  const order = [0, 3, 4, 1]; // top, right, bottom, left (indices into layout)
  return (
    <Shape
      tick={tick}
      layout={layout}
      activeCells={() => true}
      accentCells={(_, unitId, t) => {
        if (unitId === 2) return false; // center never accent
        return order[t % 4] === unitId;
      }}
    />
  );
}

// 4. L SHAPE — 3 rows of 1 + bottom row of 3 = L (4 units)
function LShape({ tick }) {
  const layout = [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
  ];
  // Accent travels along the L path.
  const pathOrder = [0, 1, 2, 3, 4];
  return (
    <Shape
      tick={tick}
      layout={layout}
      activeCells={() => true}
      accentCells={(_, unitId, t) => pathOrder[t % pathOrder.length] === unitId}
    />
  );
}

// 5. HEX — 2·4·2 with offsets
function HexShape({ tick }) {
  const layout = [
    { row: 0, col: 1 }, { row: 0, col: 2 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
    { row: 2, col: 1 }, { row: 2, col: 2 },
  ];
  return (
    <Shape
      tick={tick}
      layout={layout}
      activeCells={() => true}
      accentCells={(_, unitId, t) => {
        const perim = [0, 1, 5, 7, 6, 4, 2];
        return perim[t % perim.length] === unitId;
      }}
    />
  );
}

// 6. STAIRS — each unit one step diagonal
function StairsShape({ tick }) {
  const layout = [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
    { row: 3, col: 3 },
  ];
  return (
    <Shape
      tick={tick}
      layout={layout}
      size={52}
      activeCells={() => true}
      accentCells={(_, unitId, t) => (t % 4) === unitId}
    />
  );
}

// 7. BIG-GRID — 3×3 of units (all 9) — a 9-unit spinner-of-spinners
function BigGridShape({ tick }) {
  const layout = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) layout.push({ row: r, col: c });
  return (
    <Shape
      tick={tick}
      layout={layout}
      size={48}
      unitGap={6}
      activeCells={() => true}
      accentCells={(cellIdx, unitId, t) => {
        // Accent snakes across the 3x3 of units.
        const path = [0, 1, 2, 5, 4, 3, 6, 7, 8];
        return path[t % path.length] === unitId;
      }}
    />
  );
}

// 8. ARROW — pointing right. Shaft + arrowhead.
function ArrowShape({ tick }) {
  const layout = [
    // shaft (rows 1, extending right)
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
    // arrowhead
    { row: 0, col: 2 }, { row: 2, col: 2 },
  ];
  const cols = [0, 1, 2, 2, 2];
  return (
    <Shape
      tick={tick}
      layout={layout}
      size={52}
      activeCells={() => true}
      accentCells={(_, unitId, t) => cols[unitId] === (t % 3)}
    />
  );
}

// 9. RING — 8 units on the perimeter of a 3x3, center empty.
function RingShape({ tick }) {
  const layout = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) continue;
      layout.push({ row: r, col: c });
    }
  }
  return (
    <Shape
      tick={tick}
      layout={layout}
      size={52}
      unitGap={6}
      activeCells={() => true}
      accentCells={(_, unitId, t) => {
        // unitId is layout index; order them around the ring.
        const perim = [0, 1, 2, 4, 7, 6, 5, 3]; // TL,T,TR,R,BR,B,BL,L
        return perim[t % perim.length] === unitId;
      }}
    />
  );
}

// ----- APP -----

const SHAPES = [
  { id: 'triangle', name: 'Triangle',  caption: '1·2·3 stack · 6 units',       Comp: TriangleShape },
  { id: 'diamond',  name: 'Diamond',   caption: '1·3·1 · pulse out',           Comp: DiamondShape },
  { id: 'cross',    name: 'Cross',     caption: 'plus · arm-by-arm',           Comp: CrossShape },
  { id: 'l',        name: 'L-Shape',   caption: 'column + row · trace path',   Comp: LShape },
  { id: 'hex',      name: 'Hex',       caption: '2·4·2 · ring cycle',          Comp: HexShape },
  { id: 'stairs',   name: 'Stairs',    caption: 'diagonal · step cascade',     Comp: StairsShape },
  { id: 'big',      name: 'Big Grid',  caption: '3×3 of units · snake accent', Comp: BigGridShape },
  { id: 'arrow',    name: 'Arrow',     caption: 'pointing right · col pulse',  Comp: ArrowShape },
  { id: 'ring',     name: 'Ring',      caption: 'perimeter · CW rotation',     Comp: RingShape },
];

function Clock() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <span style={{fontFamily:'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-2)'}}>{mm}:{ss}</span>;
}

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "speed": 1,
  "palette": "warm-neutral",
  "showCaptions": true
}/*EDITMODE-END*/;

const PALETTES = {
  'warm-neutral': {
    '--bg': 'oklch(0.97 0.005 80)', '--ink': 'oklch(0.2 0.01 80)',
    '--ink-2': 'oklch(0.4 0.01 80)', '--rule': 'oklch(0.88 0.005 80)',
    '--card': 'oklch(0.995 0.003 80)', '--accent': 'oklch(0.65 0.15 40)',
  },
  'cool-ink': {
    '--bg': 'oklch(0.96 0.008 250)', '--ink': 'oklch(0.22 0.02 250)',
    '--ink-2': 'oklch(0.45 0.02 250)', '--rule': 'oklch(0.86 0.01 250)',
    '--card': 'oklch(0.99 0.005 250)', '--accent': 'oklch(0.6 0.15 250)',
  },
  'mono': {
    '--bg': 'oklch(0.98 0 0)', '--ink': 'oklch(0.15 0 0)',
    '--ink-2': 'oklch(0.5 0 0)', '--rule': 'oklch(0.85 0 0)',
    '--card': 'oklch(1 0 0)', '--accent': 'oklch(0.5 0 0)',
  },
  'forest': {
    '--bg': 'oklch(0.96 0.01 140)', '--ink': 'oklch(0.22 0.03 160)',
    '--ink-2': 'oklch(0.45 0.02 160)', '--rule': 'oklch(0.86 0.01 140)',
    '--card': 'oklch(0.99 0.005 140)', '--accent': 'oklch(0.6 0.14 30)',
  },
};

function App() {
  const [tweaks, setTweaks] = useTweaks(DEFAULTS);
  const tick = useTick(240 / tweaks.speed);

  useEffect(() => {
    const pal = PALETTES[tweaks.palette] || PALETTES['warm-neutral'];
    const root = document.documentElement;
    Object.entries(pal).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [tweaks.palette]);

  return (
    <>
      {SHAPES.map((s, i) => (
        <div className="tile" key={s.id}>
          <header>
            <div className="name">{s.name}</div>
            <div className="num">{String(i + 1).padStart(2, '0')} / {String(SHAPES.length).padStart(2,'0')}</div>
          </header>
          <div className="stage">
            <s.Comp tick={tick} />
          </div>
          {tweaks.showCaptions && <div className="caption">{s.caption}</div>}
        </div>
      ))}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Motion">
          <TweakSlider
            label="Speed"
            value={tweaks.speed}
            min={0.3} max={3} step={0.1}
            onChange={v => setTweaks({ speed: v })}
            formatValue={v => `${v.toFixed(1)}×`}
          />
        </TweakSection>
        <TweakSection title="Appearance">
          <TweakRadio
            label="Palette"
            value={tweaks.palette}
            options={[
              { value: 'warm-neutral', label: 'Warm neutral' },
              { value: 'cool-ink', label: 'Cool ink' },
              { value: 'mono', label: 'Monochrome' },
              { value: 'forest', label: 'Forest' },
            ]}
            onChange={v => setTweaks({ palette: v })}
          />
          <TweakToggle
            label="Show captions"
            value={tweaks.showCaptions}
            onChange={v => setTweaks({ showCaptions: v })}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('grid')).render(<App />);
