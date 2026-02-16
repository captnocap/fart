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
    description: 'KPIs, charts, tables, progress bars',
    category: 'Data',
    code: `function MyComponent() {
  var MONTHLY_REVENUE = [
    { label: 'Jul', value: 32 },
    { label: 'Aug', value: 41 },
    { label: 'Sep', value: 38 },
    { label: 'Oct', value: 52 },
    { label: 'Nov', value: 48 },
    { label: 'Dec', value: 61 },
    { label: 'Jan', value: 57 },
  ];

  var SPARK_REVENUE = [28, 32, 30, 41, 38, 45, 52, 48, 55, 61, 57, 63];
  var SPARK_USERS   = [120, 135, 142, 128, 155, 168, 172, 180, 195, 210, 225, 247];
  var SPARK_ERRORS  = [12, 8, 15, 6, 4, 9, 3, 7, 2, 5, 3, 1];
  var SPARK_LATENCY = [180, 165, 172, 155, 148, 162, 145, 138, 142, 135, 128, 142];

  var PRODUCTS = [
    { name: 'Widget Pro', category: 'Hardware', sales: 1247, revenue: '$48.2k', status: 'active' },
    { name: 'DataSync', category: 'SaaS', sales: 892, revenue: '$35.6k', status: 'active' },
    { name: 'CloudStore', category: 'Storage', sales: 634, revenue: '$28.1k', status: 'active' },
    { name: 'NetGuard', category: 'Security', sales: 456, revenue: '$22.8k', status: 'beta' },
    { name: 'FormBuilder', category: 'SaaS', sales: 321, revenue: '$12.8k', status: 'active' },
    { name: 'OldTool', category: 'Legacy', sales: 89, revenue: '$3.5k', status: 'deprecated' },
  ];

  var statusVariant = function(s) {
    if (s === 'active') return 'success';
    if (s === 'beta') return 'info';
    return 'warning';
  };

  var PRODUCT_COLUMNS = [
    { key: 'name', title: 'Product', width: 100 },
    { key: 'category', title: 'Category', width: 80 },
    { key: 'sales', title: 'Sales', width: 60, align: 'right' },
    { key: 'revenue', title: 'Revenue', width: 70, align: 'right' },
    {
      key: 'status',
      title: 'Status',
      width: 80,
      render: function(value) { return <Badge label={value} variant={statusVariant(value)} />; },
    },
  ];

  var BG = '#0f172a';
  var CARD = '#1e293b';
  var BORDER = '#334155';
  var BRIGHT = '#e2e8f0';
  var DIM = '#64748b';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 16, gap: 12 }}>
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: BRIGHT, fontSize: 18, fontWeight: 'bold' }}>Dashboard</Text>
        <Text style={{ color: DIM, fontSize: 10 }}>Last updated: just now</Text>
      </Box>

      <Divider color={BORDER} />

      <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
        {[
          { label: 'Revenue', value: '$63.1k', data: SPARK_REVENUE, color: '#22c55e', change: '+8.2%' },
          { label: 'Users', value: '1,247', data: SPARK_USERS, color: '#3b82f6', change: '+12.1%' },
          { label: 'Errors', value: '1', data: SPARK_ERRORS, color: '#ef4444', change: '-72%' },
          { label: 'Latency', value: '142ms', data: SPARK_LATENCY, color: '#f59e0b', change: '-5.3%' },
        ].map(function(kpi) {
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
                <Box style={{ gap: 2, width: 70, height: 30 }}>
                  <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'bold' }}>{kpi.value}</Text>
                  <Text style={{ color: kpi.color, fontSize: 10, fontWeight: 'bold' }}>{kpi.change}</Text>
                </Box>
                <Sparkline data={kpi.data} width={60} height={20} color={kpi.color} />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box style={{ flexDirection: 'row', width: '100%', gap: 12, flexGrow: 1 }}>
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
          <BarChart data={MONTHLY_REVENUE} height={90} barWidth={24} gap={10} showValues color="#3b82f6" />
        </Box>

        <Box style={{
          width: 180,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 10,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Targets</Text>
          {[
            { label: 'Revenue Goal', value: 0.78, color: '#22c55e' },
            { label: 'User Growth', value: 0.62, color: '#3b82f6' },
            { label: 'Uptime SLA', value: 0.995, color: '#06b6d4' },
            { label: 'NPS Score', value: 0.84, color: '#8b5cf6' },
            { label: 'Bug Backlog', value: 0.35, color: '#f59e0b' },
          ].map(function(metric) {
            return (
              <Box key={metric.label} style={{ gap: 3 }}>
                <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                  <Text style={{ color: DIM, fontSize: 10 }}>{metric.label}</Text>
                  <Text style={{ color: BRIGHT, fontSize: 10, fontWeight: 'bold' }}>
                    {Math.round(metric.value * 100) + '%'}
                  </Text>
                </Box>
                <ProgressBar value={metric.value} color={metric.color} height={6} />
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box style={{
        backgroundColor: CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 8,
      }}>
        <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Top Products</Text>
        <Table columns={PRODUCT_COLUMNS} data={PRODUCTS} rowKey="name" striped />
      </Box>
    </Box>
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
    name: 'Weather',
    description: 'Weather dashboard with pixel art and forecast',
    category: 'Widget',
    code: `function MyComponent() {
  var SUN_LINES = [
    '  .  .  .  ',
    ' .       . ',
    '.  .   .  .',
    '   .XXX.   ',
    '.  XXXXX  .',
    '   XXXXX   ',
    '.  XXXXX  .',
    '   .XXX.   ',
    '.  .   .  .',
    ' .       . ',
    '  .  .  .  ',
  ];

  var SUN_PX = 8;
  var SUN_GRID = SUN_LINES.map(function(line) {
    return line.split('').map(function(ch) {
      if (ch === 'X') return 'core';
      if (ch === '.') return 'ray';
      return null;
    });
  });

  var BG_CARD = '#111827';
  var BORDER = '#1E293B';
  var ACCENT = '#60A5FA';
  var WARM = '#F59E0B';
  var HOT = '#EF4444';
  var COOL = '#06B6D4';
  var BRIGHT = '#E2E8F0';
  var DIM = '#64748B';

  var FORECAST = [
    { day: 'Mon', temp: 72 },
    { day: 'Tue', temp: 68 },
    { day: 'Wed', temp: 65 },
    { day: 'Thu', temp: 70 },
    { day: 'Fri', temp: 75 },
    { day: 'Sat', temp: 78 },
    { day: 'Sun', temp: 74 },
  ];

  function tempColor(temp) {
    if (temp >= 76) return HOT;
    if (temp >= 72) return WARM;
    if (temp >= 68) return ACCENT;
    return COOL;
  }

  function tempBarHeight(temp) {
    var clamped = Math.max(60, Math.min(80, temp));
    return 4 + Math.round(((clamped - 60) / 20) * 16);
  }

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 12 }}>
      <Box style={{
        flexDirection: 'row',
        gap: 20,
        flexGrow: 1,
        backgroundColor: BG_CARD,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER,
      }}>
        <Box style={{ width: 11 * SUN_PX, height: 11 * SUN_PX }}>
          {SUN_GRID.map(function(row, r) {
            return (
              <Box key={r} style={{ flexDirection: 'row' }}>
                {row.map(function(cell, c) {
                  return (
                    <Box key={c} style={{
                      width: SUN_PX,
                      height: SUN_PX,
                      borderRadius: cell === 'core' ? 2 : cell === 'ray' ? 4 : 0,
                      backgroundColor: cell === 'core' ? '#FFD93D' : cell === 'ray' ? '#FFA726' : 'transparent',
                    }} />
                  );
                })}
              </Box>
            );
          })}
        </Box>

        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text style={{ color: DIM, fontSize: 12 }}>San Francisco, CA</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 48, fontWeight: 'bold' }}>72</Text>
          <Text style={{ color: WARM, fontSize: 16, fontWeight: 'bold' }}>Sunny</Text>
          <Text style={{ color: DIM, fontSize: 12 }}>Feels like 70F</Text>
        </Box>

        <Box style={{ width: 160, gap: 6 }}>
          {[
            ['Humidity', '58%', COOL],
            ['Wind', '12 mph NW', ACCENT],
            ['Pressure', '30.12 inHg', DIM],
            ['UV Index', '6 (High)', WARM],
          ].map(function(item) {
            return (
              <Box key={item[0]} style={{ flexDirection: 'row', gap: 6 }}>
                <Text style={{ color: item[2], fontSize: 13, fontWeight: 'bold' }}>{item[0] + ':'}</Text>
                <Text style={{ color: BRIGHT, fontSize: 13 }}>{item[1]}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box style={{
        flexGrow: 1,
        backgroundColor: BG_CARD,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        gap: 10,
      }}>
        <Text style={{ color: BRIGHT, fontSize: 14, fontWeight: 'bold' }}>7-Day Forecast</Text>
        <Divider color={BORDER} />
        <Box style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexGrow: 1,
          width: '100%',
        }}>
          {FORECAST.map(function(f) {
            return (
              <Box key={f.day} style={{ gap: 4, alignItems: 'center' }}>
                <Text style={{ color: DIM, fontSize: 10, fontWeight: 'bold' }}>{f.day}</Text>
                <Text style={{ color: tempColor(f.temp), fontSize: 13, fontWeight: 'bold' }}>
                  {f.temp + 'F'}
                </Text>
                <Box style={{
                  width: 16,
                  height: tempBarHeight(f.temp),
                  borderRadius: 3,
                  backgroundColor: tempColor(f.temp),
                }} />
              </Box>
            );
          })}
        </Box>
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
