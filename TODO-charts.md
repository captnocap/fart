# TODO: Chart Component Expansion

## Current state

Three chart-adjacent components exist in `packages/shared/src/`:

| Component | File | Tooltip | Interactive |
|-----------|------|---------|-------------|
| `BarChart` | `BarChart.tsx` | Yes — hover tooltip with label, value, percentage | Yes — `onBarHover`, `onBarPress`, dim-on-hover |
| `Sparkline` | `Sparkline.tsx` | No | No |
| `ProgressBar` | `ProgressBar.tsx` | No | No |

The BarChart tooltip is the reference implementation: absolute-positioned bubble above the hovered element with dark semi-transparent background, accent label, bold value, dimmed percentage. Non-hovered bars dim to 0.35 opacity.

## 1. Add tooltips to existing components

### Sparkline
- Add `interactive` prop (default false, keeps current behavior)
- On hover: show tooltip with the data point value and index
- Dim non-hovered bars like BarChart does
- Add `onPointHover` / `onPointPress` callbacks

### ProgressBar
- On hover: show tooltip with current value, label, percentage
- Tooltip anchored above the fill bar

## 2. New chart types to build

All new charts should ship with the same interactive tooltip pattern from day one.

### PieChart / DonutChart
- Render as concentric `Box` arcs using the segment-from-boxes technique (no SVG/Canvas — this is iLoveReact)
- Each segment is a colored arc approximated by small Box wedges or a ring of pixel boxes
- Props: `data: { label, value, color }[]`, `size`, `innerRadius` (0 for pie, >0 for donut), `interactive`
- Tooltip on segment hover: label, value, percentage of total
- Dim non-hovered segments
- Consider: ring/gauge variant where a single value fills a circular track (like a radial ProgressBar)

### LineChart
- Render as connected point-to-point using thin horizontal/vertical Box segments or angled approximations
- Props: `data: { x?, value }[]`, `width`, `height`, `color`, `showDots`, `showArea` (filled below line), `interactive`
- Tooltip on hover: snap to nearest data point, show value
- Vertical crosshair line (thin Box) at hovered x position

### AreaChart
- LineChart variant with filled region below the line
- Stack of column Boxes with graduated opacity or solid fill
- Same tooltip behavior as LineChart

### HorizontalBarChart
- BarChart rotated — rows instead of columns
- Common for ranking/leaderboard views
- Same tooltip pattern, anchored to the right of the hovered bar

### StackedBarChart
- Multiple series per bar position, stacked vertically
- Tooltip shows breakdown of all segments in the hovered stack
- Props: `series: { label, color, data: number[] }[]`

### RadarChart (stretch)
- Polygon overlay on a radial grid
- Approximate with Box-based geometry
- Lower priority — complex to render without vector primitives

## 3. Shared tooltip infrastructure

Consider extracting the tooltip into a reusable internal component so all charts share identical styling and behavior:

```tsx
// Rough shape
<ChartTooltip visible={isHovered} anchor="top">
  <ChartTooltip.Label>{bar.label}</ChartTooltip.Label>
  <ChartTooltip.Value>{bar.value}</ChartTooltip.Value>
  <ChartTooltip.Detail>{pct}%</ChartTooltip.Detail>
</ChartTooltip>
```

This keeps the dark bubble style, border, padding, font sizes, and z-index consistent across all chart types without duplicating the 20-line tooltip Box tree in every component.

## 4. Storybook stories

Each new chart type gets a story in `storybook/src/stories/` demonstrating:
- Basic usage with sample data
- Interactive mode with tooltip
- Theming / color customization
- Edge cases (empty data, single point, very large datasets)

## Notes

- All rendering is Box-based geometry — no SVG, no Canvas, no Unicode symbols
- Pie/donut is the hardest since circular shapes must be approximated with rectangular boxes
- The WeatherDemo (`storybook/src/stories/WeatherDemo.tsx`) is a good reference for chart usage in context
- The BarChart tooltip style matches the devtools inspector aesthetic — keep this consistent
