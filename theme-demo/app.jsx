const { useState, useEffect } = React;

const SPINNERS = [
  { id: 'slide',   name: 'Slide',        caption: '15-puzzle · tiles fill gap',  Comp: SlideSpinner },
  { id: 'rotate',  name: 'Rotate',       caption: '2×2 block · cycles corner',   Comp: RotateSpinner },
  { id: 'shuffle', name: 'Shuffle',      caption: 'adjacent pair swaps',         Comp: ShuffleSpinner },
  { id: 'snake',   name: 'Snake',        caption: 'Hamiltonian path · len 4',   Comp: SnakeSpinner },
  { id: 'mines',   name: 'Minesweep',    caption: 'reveal · neighbor counts',    Comp: MinesSpinner },
  { id: 'ttt',     name: 'Tic-Tac-Toe',  caption: 'scripted game · left column', Comp: TicTacToeSpinner },
  { id: 'tetris',  name: 'Stacker',      caption: '3 pieces · clear · repeat',   Comp: TetrisSpinner },
  { id: 'pulse',   name: 'Pulse',        caption: 'center → mids → corners',     Comp: PulseSpinner },
  { id: 'orbit',   name: 'Orbit',        caption: 'two bodies · opposite phase', Comp: OrbitSpinner },
  { id: 'binary',  name: 'Counter',      caption: '9-bit binary · base 2',       Comp: BinarySpinner },
  { id: 'life',    name: 'Life',         caption: 'blinker · block · checker',   Comp: LifeSpinner },
  { id: 'sort',    name: 'Sort',         caption: 'bubble · nine values',        Comp: SortSpinner },
];

function Clock() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <>{hh}:{mm}:{ss}</>;
}

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "speed": 1,
  "palette": "sweatshop",
  "gap": 4,
  "showCaptions": true,
  "cellSize": 120
}/*EDITMODE-END*/;

const PALETTES = {
  'sweatshop': {
    '--accent': '#d26a2a',
  },
  'ember': {
    '--accent': '#e8501c',
  },
  'verdigris': {
    '--accent': '#6aa390',
  },
  'signal': {
    '--accent': '#d6a54a',
  },
};

function App() {
  const [tweaks, setTweaks] = useTweaks(DEFAULTS);

  useEffect(() => {
    const pal = PALETTES[tweaks.palette] || PALETTES['warm-neutral'];
    const root = document.documentElement;
    Object.entries(pal).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [tweaks.palette]);

  return (
    <>
      {SPINNERS.map((s, i) => (
        <Tile key={s.id} spinner={s} i={i} tweaks={tweaks} />
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
            label="Accent"
            value={tweaks.palette}
            options={[
              { value: 'sweatshop', label: 'Sweatshop orange' },
              { value: 'ember', label: 'Ember' },
              { value: 'verdigris', label: 'Verdigris' },
              { value: 'signal', label: 'Signal' },
            ]}
            onChange={v => setTweaks({ palette: v })}
          />
          <TweakSlider
            label="Cell size"
            value={tweaks.cellSize}
            min={72} max={140} step={4}
            onChange={v => setTweaks({ cellSize: v })}
            formatValue={v => `${v}px`}
          />
          <TweakSlider
            label="Cell gap"
            value={tweaks.gap}
            min={1} max={10} step={1}
            onChange={v => setTweaks({ gap: v })}
            formatValue={v => `${v}px`}
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

function Tile({ spinner, i, tweaks }) {
  const { Comp } = spinner;
  return (
    <div className="tile">
      <header>
        <div className="name">{spinner.name}</div>
        <div className="num">{String(i + 1).padStart(2, '0')} / 12</div>
      </header>
      <div className="spinner-wrap" style={{ '--size': tweaks.cellSize + 'px', '--gap': tweaks.gap + 'px' }}>
        <Comp speed={tweaks.speed} />
      </div>
      {tweaks.showCaptions && <div className="caption">{spinner.caption}</div>}
    </div>
  );
}

// Boot
const grid = document.getElementById('grid');
ReactDOM.createRoot(grid).render(<App />);
ReactDOM.createRoot(document.getElementById('clock')).render(<Clock />);

// Foot tick counter
(function () {
  let n = 0;
  const foot = document.getElementById('tickFoot');
  setInterval(() => {
    n++;
    if (foot) foot.textContent = `t = ${n}`;
  }, 1000);
})();
