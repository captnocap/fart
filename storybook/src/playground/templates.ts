/**
 * templates.ts — Starter templates for the playground.
 *
 * Each template is a self-contained JSX function (no imports, no TypeScript
 * types) that can be eval'd with the playground's injected scope.
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
}

export const templates: Template[] = [

  // ── Hello World ──────────────────────────────────────────

  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Interactive counter with a button',
    category: 'Starter',
    code: `function MyComponent() {
  var [count, setCount] = useState(0);

  return (
    <Box style={{
      width: '100%', height: '100%',
      backgroundColor: '#0f0f1a',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Box style={{
        width: 260,
        backgroundColor: '#1e1e2e',
        borderRadius: 16,
        padding: 24,
        gap: 16,
        alignItems: 'center',
      }}>
        <Text style={{
          color: '#cdd6f4',
          fontSize: 20,
          fontWeight: 'bold',
        }}>
          iLoveReact Playground
        </Text>
        <Text style={{
          color: '#6c7086',
          fontSize: 13,
        }}>
          Edit code on the left
        </Text>
        <Pressable
          onPress={function() { setCount(function(c) { return c + 1; }); }}
          style={{
            backgroundColor: '#89b4fa',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{
            color: '#1e1e2e',
            fontSize: 14,
            fontWeight: 'bold',
          }}>
            {count === 0 ? 'Press me' : 'Pressed ' + count + 'x'}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
}`,
  },

  // ── Dashboard ────────────────────────────────────────────

  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Live KPIs, animated charts, tables, progress bars',
    category: 'Data',
    code: `function MyComponent() {
  var BG = '#0f172a';
  var CARD = '#1e293b';
  var BORDER = '#334155';
  var BRIGHT = '#e2e8f0';
  var DIM = '#64748b';

  function rand(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }
  function drift(base, range) {
    return Math.max(0, base + (Math.random() - 0.4) * range);
  }

  function generateRevenue() {
    return [
      { label: 'Jul', value: rand(28, 40) },
      { label: 'Aug', value: rand(35, 48) },
      { label: 'Sep', value: rand(32, 50) },
      { label: 'Oct', value: rand(45, 60) },
      { label: 'Nov', value: rand(40, 55) },
      { label: 'Dec', value: rand(50, 68) },
      { label: 'Jan', value: rand(48, 65) },
    ];
  }
  function generateSpark(base, variance) {
    return base.map(function(v) { return Math.max(1, Math.round(v + (Math.random() - 0.5) * variance)); });
  }

  var SPARK_BASE_REVENUE = [28, 32, 30, 41, 38, 45, 52, 48, 55, 61, 57, 63];
  var SPARK_BASE_USERS   = [120, 135, 142, 128, 155, 168, 172, 180, 195, 210, 225, 247];
  var SPARK_BASE_ERRORS  = [12, 8, 15, 6, 4, 9, 3, 7, 2, 5, 3, 1];
  var SPARK_BASE_LATENCY = [180, 165, 172, 155, 148, 162, 145, 138, 142, 135, 128, 142];

  function generateProducts() {
    var baseSales = [1247, 892, 634, 456, 321, 89];
    return [
      { name: 'Widget Pro', category: 'Hardware', sales: baseSales[0] + rand(-50, 80), revenue: '$' + (48.2 + (Math.random() - 0.3) * 4).toFixed(1) + 'k', status: 'active' },
      { name: 'DataSync', category: 'SaaS', sales: baseSales[1] + rand(-30, 60), revenue: '$' + (35.6 + (Math.random() - 0.3) * 3).toFixed(1) + 'k', status: 'active' },
      { name: 'CloudStore', category: 'Storage', sales: baseSales[2] + rand(-20, 50), revenue: '$' + (28.1 + (Math.random() - 0.3) * 2.5).toFixed(1) + 'k', status: 'active' },
      { name: 'NetGuard', category: 'Security', sales: baseSales[3] + rand(-15, 40), revenue: '$' + (22.8 + (Math.random() - 0.3) * 2).toFixed(1) + 'k', status: 'beta' },
      { name: 'FormBuilder', category: 'SaaS', sales: baseSales[4] + rand(-10, 30), revenue: '$' + (12.8 + (Math.random() - 0.3) * 1.5).toFixed(1) + 'k', status: 'active' },
      { name: 'OldTool', category: 'Legacy', sales: baseSales[5] + rand(-5, 15), revenue: '$' + (3.5 + (Math.random() - 0.3) * 0.8).toFixed(1) + 'k', status: 'deprecated' },
    ];
  }

  var statusVariant = function(s) {
    if (s === 'active') return 'success';
    if (s === 'beta') return 'info';
    return 'warning';
  };

  var PRODUCT_COLUMNS = [
    { key: 'name', title: 'Product' },
    { key: 'category', title: 'Category' },
    { key: 'sales', title: 'Sales', width: 60, align: 'right' },
    { key: 'revenue', title: 'Revenue', width: 70, align: 'right' },
    {
      key: 'status',
      title: 'Status',
      width: 80,
      render: function(value) { return <Badge label={value} variant={statusVariant(value)} />; },
    },
  ];

  var [tick, setTick] = useState(0);
  var [revenue, setRevenue] = useState(generateRevenue);
  var [products, setProducts] = useState(generateProducts);
  var [kpis, setKpis] = useState({
    revenue: 63100, users: 1247, errors: 1, latency: 142,
    revChange: 8.2, userChange: 12.1, errChange: -72, latChange: -5.3,
  });
  var [sparks, setSparks] = useState({
    revenue: SPARK_BASE_REVENUE, users: SPARK_BASE_USERS,
    errors: SPARK_BASE_ERRORS, latency: SPARK_BASE_LATENCY,
  });
  var [targets, setTargets] = useState([
    { label: 'Revenue Goal', value: 0.78, color: '#22c55e' },
    { label: 'User Growth', value: 0.62, color: '#3b82f6' },
    { label: 'Uptime SLA', value: 0.995, color: '#06b6d4' },
    { label: 'NPS Score', value: 0.84, color: '#8b5cf6' },
    { label: 'Bug Backlog', value: 0.35, color: '#f59e0b' },
  ]);

  useEffect(function() {
    var interval = setInterval(function() {
      setTick(function(t) { return t + 1; });
      setRevenue(generateRevenue());
      setProducts(generateProducts());
      setKpis(function(prev) {
        return {
          revenue: Math.round(drift(prev.revenue, 3000)),
          users: Math.round(drift(prev.users, 80)),
          errors: Math.max(0, Math.round(drift(prev.errors, 2))),
          latency: Math.max(50, Math.round(drift(prev.latency, 20))),
          revChange: +(drift(prev.revChange, 3)).toFixed(1),
          userChange: +(drift(prev.userChange, 2)).toFixed(1),
          errChange: Math.min(0, +(drift(prev.errChange, 15)).toFixed(1)),
          latChange: Math.min(0, +(drift(prev.latChange, 3)).toFixed(1)),
        };
      });
      setSparks({
        revenue: generateSpark(SPARK_BASE_REVENUE, 10),
        users: generateSpark(SPARK_BASE_USERS, 30),
        errors: generateSpark(SPARK_BASE_ERRORS, 5),
        latency: generateSpark(SPARK_BASE_LATENCY, 25),
      });
      setTargets(function(prev) {
        return prev.map(function(t) {
          return { label: t.label, color: t.color, value: Math.max(0.05, Math.min(1, t.value + (Math.random() - 0.45) * 0.08)) };
        });
      });
    }, 3000);
    return function() { clearInterval(interval); };
  }, []);

  function KpiValue(props) {
    var animated = useSpring(props.value, { stiffness: 80, damping: 18 });
    var display = animated >= 1000
      ? (animated / 1000).toFixed(1) + 'k'
      : String(Math.round(animated));
    return ( // ilr-ignore-next-line
      <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'bold' }}>
        {props.prefix + display + props.suffix}
      </Text>
    );
  }

  var kpiCards = [
    { label: 'Revenue', raw: kpis.revenue, prefix: '$', suffix: '', data: sparks.revenue, color: '#22c55e', change: kpis.revChange },
    { label: 'Users', raw: kpis.users, prefix: '', suffix: '', data: sparks.users, color: '#3b82f6', change: kpis.userChange },
    { label: 'Errors', raw: kpis.errors, prefix: '', suffix: '', data: sparks.errors, color: '#ef4444', change: kpis.errChange },
    { label: 'Latency', raw: kpis.latency, prefix: '', suffix: 'ms', data: sparks.latency, color: '#f59e0b', change: kpis.latChange },
  ];

  var secondsAgo = tick * 3;
  var timeLabel = secondsAgo === 0 ? 'just now' : secondsAgo + 's ago';

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: BG }}>
    <Box style={{ padding: 16, gap: 12 }}>
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: BRIGHT, fontSize: 18, fontWeight: 'bold' }}>Dashboard</Text>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
          <Text style={{ color: DIM, fontSize: 10 }}>Live</Text>
          <Text style={{ color: '#475569', fontSize: 10 }}>{'(' + timeLabel + ')'}</Text>
        </Box>
      </Box>

      <Divider color={BORDER} />

      <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
        {kpiCards.map(function(kpi) {
          return (
            <Box key={kpi.label} style={{
              flexGrow: 1,
              backgroundColor: CARD,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 10,
              gap: 6,
            }}>
              <Text style={{ color: DIM, fontSize: 10 }}>{kpi.label}</Text>
              <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box style={{ gap: 2, width: 80, height: 30 }}>
                  <KpiValue value={kpi.raw} prefix={kpi.prefix} suffix={kpi.suffix} />
                  <Text style={{ color: kpi.color, fontSize: 10, fontWeight: 'bold' }}>
                    {(kpi.change >= 0 ? '+' : '') + kpi.change + '%'}
                  </Text>
                </Box>
                <Sparkline data={kpi.data} width={60} height={20} color={kpi.color} />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
        <Box style={{
          flexGrow: 1,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 8,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Monthly Revenue ($k)</Text>
          <BarChart data={revenue} height={120} showValues color="#3b82f6" />
        </Box>

        <Box style={{
          width: 200,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 10,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Targets</Text>
          {targets.map(function(metric) {
            return (
              <Box key={metric.label} style={{ gap: 3 }}>
                <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                  <Text style={{ color: DIM, fontSize: 10 }}>{metric.label}</Text>
                  <Text style={{ color: BRIGHT, fontSize: 10, fontWeight: 'bold' }}>
                    {Math.round(metric.value * 100) + '%'}
                  </Text>
                </Box>
                <ProgressBar value={metric.value} color={metric.color} height={6} animated />
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box style={{
        width: '100%',
        backgroundColor: CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 8,
      }}>
        <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Top Products</Text>
        <Table columns={PRODUCT_COLUMNS} data={products} rowKey="name" striped />
      </Box>
    </Box>
    </ScrollView>
  );
}`,
  },

  // ── Settings Panel ───────────────────────────────────────

  {
    id: 'settings',
    name: 'Settings Panel',
    description: 'Sliders, switches, checkboxes, radio, select',
    category: 'Forms',
    code: `function MyComponent() {
  var [masterVol, setMasterVol] = useState(0.8);
  var [musicVol, setMusicVol] = useState(0.6);
  var [sfxVol, setSfxVol] = useState(0.9);
  var [resolution, setResolution] = useState('1920x1080');
  var [quality, setQuality] = useState('high');
  var [fullscreen, setFullscreen] = useState(true);
  var [vsync, setVsync] = useState(true);
  var [showFps, setShowFps] = useState(false);
  var [difficulty, setDifficulty] = useState('normal');
  var [autoSave, setAutoSave] = useState(true);
  var [tutorials, setTutorials] = useState(true);

  function SettingRow(props) {
    return (
      <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{props.label}</Text>
        {props.children}
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', padding: 16, gap: 20, overflow: 'scroll' }}>
      <Text style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 'bold' }}>
        Game Settings
      </Text>

      <Box style={{ gap: 12, backgroundColor: '#1e293b', borderRadius: 10, padding: 14 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>Audio</Text>
        <Box style={{ gap: 4 }}>
          <SettingRow label={'Master: ' + Math.round(masterVol * 100) + '%'}><Box /></SettingRow>
          <Slider value={masterVol} onValueChange={setMasterVol} activeTrackColor="#3b82f6" style={{ width: 200 }} />
        </Box>
        <Box style={{ gap: 4 }}>
          <SettingRow label={'Music: ' + Math.round(musicVol * 100) + '%'}><Box /></SettingRow>
          <Slider value={musicVol} onValueChange={setMusicVol} activeTrackColor="#8b5cf6" thumbColor="#8b5cf6" style={{ width: 200 }} />
        </Box>
        <Box style={{ gap: 4 }}>
          <SettingRow label={'SFX: ' + Math.round(sfxVol * 100) + '%'}><Box /></SettingRow>
          <Slider value={sfxVol} onValueChange={setSfxVol} activeTrackColor="#f59e0b" thumbColor="#f59e0b" style={{ width: 200 }} />
        </Box>
      </Box>

      <Box style={{ gap: 12, backgroundColor: '#1e293b', borderRadius: 10, padding: 14 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>Display</Text>
        <Box style={{ gap: 8 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Resolution</Text>
          <Select value={resolution} onValueChange={setResolution} options={[
            { label: '1280 x 720', value: '1280x720' },
            { label: '1920 x 1080', value: '1920x1080' },
            { label: '2560 x 1440', value: '2560x1440' },
          ]} />
        </Box>
        <Box style={{ gap: 6, marginTop: 4 }}>
          <Checkbox value={fullscreen} onValueChange={setFullscreen} label="Fullscreen" />
          <Checkbox value={vsync} onValueChange={setVsync} label="V-Sync" />
          <Checkbox value={showFps} onValueChange={setShowFps} label="Show FPS Counter" color="#22c55e" />
        </Box>
      </Box>

      <Box style={{ gap: 12, backgroundColor: '#1e293b', borderRadius: 10, padding: 14 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>Difficulty</Text>
        <RadioGroup value={difficulty} onValueChange={setDifficulty}>
          <Radio value="easy" label="Easy" color="#22c55e" />
          <Radio value="normal" label="Normal" color="#3b82f6" />
          <Radio value="hard" label="Hard" color="#f59e0b" />
          <Radio value="nightmare" label="Nightmare" color="#ef4444" />
        </RadioGroup>
      </Box>

      <Box style={{ gap: 10, backgroundColor: '#1e293b', borderRadius: 10, padding: 14 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>Gameplay</Text>
        <SettingRow label="Auto-save"><Switch value={autoSave} onValueChange={setAutoSave} /></SettingRow>
        <SettingRow label="Tutorials"><Switch value={tutorials} onValueChange={setTutorials} /></SettingRow>
      </Box>
    </Box>
  );
}`,
  },

  // ── System Info ──────────────────────────────────────────

  {
    id: 'system-info',
    name: 'System Info',
    description: 'Neofetch-style display with pixel art',
    category: 'Widget',
    code: `function MyComponent() {
  var HEART_LINES = [
    '  xxx   xxx  ',
    ' xxxxx xxxxx ',
    'xxxxxxxxxxxxx',
    'xxxxxxxxxxxxx',
    ' xxxxxxxxxxx ',
    '  xxxxxxxxx  ',
    '   xxxxxxx   ',
    '    xxxxx    ',
    '     xxx     ',
    '      x      ',
  ];

  var HEART_GRID = HEART_LINES.map(function(line) {
    return line.split('').map(function(ch) { return ch !== ' '; });
  });

  var HEART_COLORS = [
    '#ff6b9d', '#ff5277', '#e94560', '#e94560',
    '#d63447', '#c62828', '#b71c1c', '#9a0007',
    '#7f0000', '#5d0000',
  ];

  var PX = 12;
  var ACCENT = '#e94560';
  var BRIGHT = '#e0e0f0';
  var DIM = '#444466';

  var PALETTE = [
    '#e94560', '#ff6b6b', '#533483', '#845ec2',
    '#0f3460', '#4b8bbe', '#16213e', '#1a1a2e',
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0a14', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{
        gap: 12,
        backgroundColor: '#0e0e18',
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1a1a2e',
      }}>
        <Text style={{ color: ACCENT, fontSize: 18, fontWeight: 'bold' }}>siah@archlinux</Text>
        <Divider color={DIM} />

        <Box style={{ flexDirection: 'row', gap: 24 }}>
          <Box style={{ width: 13 * PX, height: 10 * PX, paddingTop: 4 }}>
            {HEART_GRID.map(function(row, r) {
              return (
                <Box key={r} style={{ flexDirection: 'row' }}>
                  {row.map(function(filled, c) {
                    return (
                      <Box key={c} style={{
                        width: PX,
                        height: PX,
                        backgroundColor: filled ? HEART_COLORS[r] : 'transparent',
                      }} />
                    );
                  })}
                </Box>
              );
            })}
          </Box>

          <Box style={{ gap: 4 }}>
            {[
              ['OS', 'Arch Linux x86_64'],
              ['Kernel', '6.14.0-37-generic'],
              ['Uptime', '3 hours, 42 mins'],
              ['Shell', '/bin/zsh'],
              ['CPU', 'AMD Ryzen 9 7950X (32)'],
              ['Memory', '8192 MiB / 32768 MiB'],
            ].map(function(pair) {
              return (
                <Box key={pair[0]} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: ACCENT, fontSize: 14, fontWeight: 'bold' }}>{pair[0] + ':'}</Text>
                  <Text style={{ color: BRIGHT, fontSize: 14 }}>{pair[1]}</Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Spacer size={4} />

        <Box style={{ flexDirection: 'row', gap: 2 }}>
          {PALETTE.map(function(color, i) {
            return <Box key={i} style={{ width: 28, height: 14, backgroundColor: color, borderRadius: 2 }} />;
          })}
        </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── Weather ──────────────────────────────────────────────

  {
    id: 'weather',
    name: 'Weather Station',
    description: 'Live weather station with bars, sparklines, animated data',
    category: 'Widget',
    code: `function MyComponent() {
  var state = useState({
    temp: 72, feelsLike: 70, high: 78, low: 62,
    humidity: 58, windSpeed: 12, windDir: 'NW',
    pressure: 30.12, dewPoint: 52, uvIndex: 6,
    cloudCover: 32, visibility: 10,
  });
  var w = state[0];
  var setW = state[1];

  var hourlyState = useState([64,63,62,62,63,65,67,70,72,74,75,76,78,77,76,75,73,71,70,68,67,66,65,64]);
  var hourly = hourlyState[0];
  var setHourly = hourlyState[1];

  var forecastState = useState([
    { label: 'Mon', value: 72 }, { label: 'Tue', value: 68 },
    { label: 'Wed', value: 65 }, { label: 'Thu', value: 70 },
    { label: 'Fri', value: 75 }, { label: 'Sat', value: 78 },
    { label: 'Sun', value: 74 },
  ]);
  var forecast = forecastState[0];
  var setForecast = forecastState[1];

  var tickState = useState(0);
  var tick = tickState[0];
  var setTick = tickState[1];

  function drift(base, range) {
    return base + (Math.random() - 0.5) * range;
  }

  useEffect(function() {
    var interval = setInterval(function() {
      setTick(function(t) { return t + 1; });
      setW(function(prev) { return {
        temp: Math.round(drift(prev.temp, 2)),
        feelsLike: Math.round(drift(prev.feelsLike, 2)),
        high: prev.high, low: prev.low, windDir: prev.windDir,
        dewPoint: prev.dewPoint, visibility: prev.visibility,
        humidity: Math.round(Math.max(20, Math.min(95, drift(prev.humidity, 4)))),
        windSpeed: Math.round(Math.max(2, Math.min(30, drift(prev.windSpeed, 3)))),
        pressure: +(Math.max(29.5, Math.min(30.5, drift(prev.pressure, 0.04)))).toFixed(2),
        cloudCover: Math.round(Math.max(5, Math.min(95, drift(prev.cloudCover, 5)))),
        uvIndex: Math.round(Math.max(1, Math.min(11, drift(prev.uvIndex, 1)))),
      }; });
      setHourly(function(prev) { return prev.map(function(t) { return Math.round(drift(t, 1.5)); }); });
      setForecast(function(prev) { return prev.map(function(f) {
        return { label: f.label, value: Math.round(drift(f.value, 2)) };
      }); });
    }, 3000);
    return function() { clearInterval(interval); };
  }, []);

  var animTemp = useSpring(w.temp, { stiffness: 80, damping: 18 });
  var secondsAgo = tick * 3;
  var timeLabel = secondsAgo === 0 ? 'just now' : secondsAgo + 's ago';

  /* ── pixel art sun ── */
  var SUN_LINES = [
    '  .  .  .  ',
    ' .       . ',
    '.  .   .  .',
    '   .###.   ',
    '.  #####  .',
    '   #####   ',
    '.  #####  .',
    '   .###.   ',
    '.  .   .  .',
    ' .       . ',
    '  .  .  .  ',
  ];
  var SUN_PX = 8;
  var SUN_GRID = SUN_LINES.map(function(line) {
    return line.split('').map(function(ch) {
      if (ch === '#') return 'core';
      if (ch === '.') return 'ray';
      return null;
    });
  });

  /* ── theme ── */
  var BG     = '#0e0e18';
  var CARD   = '#12121f';
  var ACCENT_C = '#FFD93D';
  var WARM   = '#F59E0B';
  var HOT    = '#EF4444';
  var COOL   = '#06B6D4';
  var GREEN  = '#4ade80';
  var BLUE   = '#60a5fa';
  var BRIGHT = '#e0e0f0';
  var MID    = '#8888aa';
  var DIM    = '#444466';
  var BORDER = '#1a1a2e';
  var PALETTE = ['#FFD93D', '#FFA726', '#EF4444', '#F59E0B', '#06B6D4', '#60a5fa', '#12121f', '#1a1a2e'];

  function tempColor(t) {
    if (t >= 85) return HOT;
    if (t >= 72) return WARM;
    if (t >= 60) return BLUE;
    if (t >= 45) return COOL;
    return '#a78bfa';
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 12, gap: 10 }}>

      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <Box style={{ width: 11 * SUN_PX, height: 11 * SUN_PX }}>
          {SUN_GRID.map(function(row, r) {
            return (
              <Box key={r} style={{ flexDirection: 'row' }}>
                {row.map(function(cell, c) {
                  return (
                    <Box key={c} style={{
                      width: SUN_PX, height: SUN_PX,
                      borderRadius: cell === 'core' ? 2 : cell === 'ray' ? 4 : 0,
                      backgroundColor: cell === 'core' ? '#FFD93D' : cell === 'ray' ? '#FFA726' : 'transparent',
                    }} />
                  );
                })}
              </Box>
            );
          })}
        </Box>
        <Box style={{ gap: 3 }}>
          <Text style={{ color: ACCENT_C, fontSize: 16, fontWeight: 'bold' }}>
            {Math.round(animTemp) + 'F@sanfrancisco'}
          </Text>
          <Divider color={DIM} />
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: BRIGHT }}>Sunny</Text>
            <Text style={{ fontSize: 10, color: MID }}>{'Feels like ' + w.feelsLike + 'F'}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: MID }}>{'Wind ' + w.windSpeed + 'mph ' + w.windDir}</Text>
            <Text style={{ fontSize: 10, color: MID }}>{'Humidity ' + w.humidity + '%'}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: GREEN }}>{'H:' + w.high + 'F  L:' + w.low + 'F'}</Text>
            <Text style={{ fontSize: 10, color: w.uvIndex > 5 ? WARM : GREEN }}>{'UV ' + w.uvIndex}</Text>
          </Box>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 2, width: '100%', alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 1 }}>
          {PALETTE.map(function(color, i) {
            return <Box key={i} style={{ width: 14, height: 10, backgroundColor: color, borderRadius: 1 }} />;
          })}
        </Box>
        <Spacer size={8} />
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN }} />
          <Text style={{ fontSize: 10, color: GREEN }}>live</Text>
          <Text style={{ fontSize: 10, color: MID }}>{'(' + timeLabel + ')'}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <Box style={{ width: 280, backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'bold' }}>CONDITIONS</Text>
          <Spacer size={4} />
          {[
            { label: 'temp', val: w.temp + 'F', raw: w.temp, max: 110, color: tempColor(w.temp) },
            { label: 'high', val: w.high + 'F', raw: w.high, max: 110, color: tempColor(w.high) },
            { label: 'low', val: w.low + 'F', raw: w.low, max: 110, color: tempColor(w.low) },
            { label: 'feels', val: w.feelsLike + 'F', raw: w.feelsLike, max: 110, color: tempColor(w.feelsLike) },
            { label: 'wind', val: w.windSpeed + 'mph', raw: w.windSpeed, max: 40, color: BLUE },
            { label: 'humid', val: w.humidity + '%', raw: w.humidity, max: 100, color: COOL },
          ].map(function(row) {
            var pct = row.max > 0 ? Math.min(row.raw / row.max, 1) : 0;
            return (
              <Box key={row.label} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Box style={{ width: 36 }}><Text style={{ fontSize: 10, color: MID }}>{row.label}</Text></Box>
                <Box style={{ width: 48 }}><Text style={{ fontSize: 10, color: BRIGHT }}>{row.val}</Text></Box>
                <Box style={{ width: 130, height: 6, backgroundColor: '#1e1e30', borderRadius: 2 }}>
                  <Box style={{ width: Math.round(130 * pct), height: 6, backgroundColor: row.color, borderRadius: 2 }} />
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box style={{ flexGrow: 1, gap: 12 }}>
          <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'bold' }}>ATMOSPHERE</Text>
            <Spacer size={4} />
            {[
              { label: 'pressure', val: w.pressure + ' inHg' },
              { label: 'dewpoint', val: w.dewPoint + 'F' },
              { label: 'visibility', val: w.visibility + ' mi' },
              { label: 'uv index', val: w.uvIndex + '/11', color: w.uvIndex > 5 ? WARM : GREEN },
              { label: 'cloud', val: w.cloudCover + '%' },
              { label: 'sunrise', val: '6:42 AM', color: WARM },
              { label: 'sunset', val: '5:48 PM', color: '#F97316' },
            ].map(function(row) {
              return (
                <Box key={row.label} style={{ flexDirection: 'row', gap: 8 }}>
                  <Box style={{ width: 60 }}><Text style={{ fontSize: 10, color: MID }}>{row.label}</Text></Box>
                  <Text style={{ fontSize: 10, color: row.color || BRIGHT }}>{row.val}</Text>
                </Box>
              );
            })}
          </Box>
          <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER, gap: 4 }}>
            <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'bold' }}>24H TREND</Text>
            <Sparkline data={hourly} width={250} height={28} color={WARM} />
          </Box>
        </Box>
      </Box>

      <Box style={{ flexGrow: 1, backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER, gap: 6 }}>
        <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'bold' }}>7-DAY FORECAST</Text>
        <BarChart
          data={forecast.map(function(f) {
            return { label: f.label, value: f.value, color: tempColor(f.value) };
          })}
          height={80}
          showLabels
          showValues
          interactive
        />
      </Box>
    </Box>
  );
}`,
  },

  // ── App Shell ────────────────────────────────────────────

  {
    id: 'app-shell',
    name: 'App Shell',
    description: 'Sidebar, toolbar, breadcrumbs, tabs',
    category: 'Navigation',
    code: `function MyComponent() {
  var [activePage, setActivePage] = useState('dashboard');
  var [activeTab, setActiveTab] = useState('overview');
  var [lastAction, setLastAction] = useState('(none)');

  var NAV_SECTIONS = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'projects', label: 'Projects' },
        { id: 'team', label: 'Team' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { id: 'profile', label: 'Profile' },
        { id: 'billing', label: 'Billing' },
      ],
    },
  ];

  var TOOLBAR_ITEMS = [
    { type: 'item', id: 'new', label: 'New' },
    { type: 'item', id: 'import', label: 'Import' },
    { type: 'divider' },
    { type: 'item', id: 'refresh', label: 'Refresh' },
  ];

  var CONTENT_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ];

  var BREADCRUMB_MAP = {
    dashboard: [{ id: 'home', label: 'Home' }, { id: 'dashboard', label: 'Dashboard' }],
    projects: [{ id: 'home', label: 'Home' }, { id: 'projects', label: 'Projects' }],
    team: [{ id: 'home', label: 'Home' }, { id: 'team', label: 'Team' }],
    profile: [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'profile', label: 'Profile' }],
    billing: [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'billing', label: 'Billing' }],
  };

  var BG = '#08080f';
  var CARD = '#1e293b';
  var BORDER = '#334155';
  var BRIGHT = '#e2e8f0';
  var DIM = '#64748b';

  var breadcrumbs = BREADCRUMB_MAP[activePage] || [{ id: 'home', label: 'Home' }];

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'row', backgroundColor: BG }}>
      <NavPanel
        sections={NAV_SECTIONS}
        activeId={activePage}
        onSelect={function(id) { setActivePage(id); setActiveTab('overview'); }}
        header={<Text style={{ color: '#475569', fontSize: 10, fontWeight: 'bold' }}>ACME APP</Text>}
      />

      <Box style={{ flexGrow: 1, gap: 0 }}>
        <Box style={{ padding: 8 }}>
          <Toolbar items={TOOLBAR_ITEMS} onSelect={setLastAction} />
        </Box>
        <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
          <Breadcrumbs items={breadcrumbs} separator=">" />
        </Box>
        <Divider color={BORDER} />
        <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4 }}>
          <Tabs tabs={CONTENT_TABS} activeId={activeTab} onSelect={setActiveTab} />
        </Box>
        <Box style={{ flexGrow: 1, padding: 16, gap: 12 }}>
          <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'bold' }}>
            {breadcrumbs[breadcrumbs.length - 1].label}
          </Text>
          <Text style={{ color: DIM, fontSize: 11 }}>
            {'Viewing: ' + activeTab + ' tab'}
          </Text>
          <Box style={{
            backgroundColor: CARD,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 16,
            flexGrow: 1,
          }}>
            <Text style={{ color: BRIGHT, fontSize: 12 }}>
              Content area for this page and tab.
            </Text>
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ color: '#334155', fontSize: 10 }}>
              {'Last toolbar action: ' + lastAction}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── Animation ────────────────────────────────────────────

  {
    id: 'animation',
    name: 'Animation',
    description: 'Spring physics with transform',
    category: 'Motion',
    code: `function MyComponent() {
  var [toggled, setToggled] = useState(false);
  var x = useSpring(toggled ? 160 : 0, { stiffness: 180, damping: 12 });
  var scale = useSpring(toggled ? 1.2 : 1.0, { stiffness: 200, damping: 10 });

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ gap: 16, padding: 24 }}>
      <Pressable
        onPress={function() { setToggled(function(t) { return !t; }); }}
        style={{
          backgroundColor: '#22c55e',
          padding: 10,
          borderRadius: 6,
          alignItems: 'center',
          width: 120,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12 }}>Toggle</Text>
      </Pressable>

      <Box style={{
        width: 60, height: 60,
        backgroundColor: '#ef4444',
        borderRadius: 30,
        transform: { translateX: x, scaleX: scale, scaleY: scale },
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 10 }}>
          {Math.round(x)}
        </Text>
      </Box>

      <Box style={{
        padding: 8, backgroundColor: '#1e293b', borderRadius: 4, gap: 2,
      }}>
        <Text style={{ color: '#888', fontSize: 10 }}>
          {'translateX: ' + Math.round(x) + 'px'}
        </Text>
        <Text style={{ color: '#888', fontSize: 10 }}>
          {'scale: ' + scale.toFixed(2)}
        </Text>
      </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── Data Table ───────────────────────────────────────────

  {
    id: 'data-table',
    name: 'Data Table',
    description: 'Sortable table with badges and custom cells',
    category: 'Data',
    code: `function MyComponent() {
  var EMPLOYEES = [
    { name: 'Alice Chen', role: 'Engineer', status: 'active', score: 94, team: 'Platform' },
    { name: 'Bob Park', role: 'Designer', status: 'active', score: 87, team: 'Product' },
    { name: 'Carol Wu', role: 'PM', status: 'away', score: 76, team: 'Growth' },
    { name: 'Dan Kim', role: 'Engineer', status: 'active', score: 91, team: 'Platform' },
    { name: 'Eva Lopez', role: 'Data Sci', status: 'offline', score: 82, team: 'ML' },
    { name: 'Frank Lee', role: 'Engineer', status: 'active', score: 88, team: 'Infra' },
  ];

  function statusVariant(s) {
    if (s === 'active') return 'success';
    if (s === 'away') return 'warning';
    return 'error';
  }

  function scoreColor(s) {
    if (s >= 90) return '#22c55e';
    if (s >= 80) return '#3b82f6';
    if (s >= 70) return '#f59e0b';
    return '#ef4444';
  }

  var COLUMNS = [
    { key: 'name', title: 'Name', width: 100 },
    { key: 'role', title: 'Role', width: 80 },
    {
      key: 'status',
      title: 'Status',
      width: 80,
      render: function(value) { return <Badge label={value} variant={statusVariant(value)} />; },
    },
    {
      key: 'score',
      title: 'Score',
      width: 50,
      align: 'right',
      render: function(value) {
        return <Text style={{ color: scoreColor(value), fontSize: 11, fontWeight: 'bold' }}>{value}</Text>;
      },
    },
    { key: 'team', title: 'Team', width: 80 },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ gap: 20, padding: 16 }}>
        <Box style={{ gap: 6 }}>
          <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>Team Directory</Text>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Employee performance overview</Text>
        </Box>

        <Table columns={COLUMNS} data={EMPLOYEES} rowKey="name" striped />
      </Box>
    </Box>
  );
}`,
  },
];
