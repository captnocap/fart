import React, { useState, useMemo } from 'react';
import { Box, Text } from './primitives';
import { ChartTooltip } from './ChartTooltip';
import type { Style, Color } from './types';

export interface RadarChartAxis {
  label: string;
  max?: number;
}

export interface RadarChartProps {
  axes: RadarChartAxis[];
  data: number[];
  size?: number;
  color?: Color;
  gridColor?: Color;
  interactive?: boolean;
  style?: Style;
}

export function RadarChart({
  axes,
  data,
  size = 120,
  color = '#3b82f6',
  gridColor = '#1e293b',
  interactive = false,
  style,
}: RadarChartProps) {
  const [hovered, setHovered] = useState(false);

  const cellSize = 2;
  const gridSize = Math.floor(size / cellSize);
  const cx = gridSize / 2;
  const cy = gridSize / 2;
  const radius = gridSize / 2;
  const numAxes = axes.length;

  const normalized = useMemo(() => {
    return data.map((val, i) => {
      const maxVal = axes[i]?.max ?? Math.max(...data);
      return Math.min(1, Math.max(0, val / (maxVal || 1)));
    });
  }, [data, axes]);

  const vertices = useMemo(() => {
    return normalized.map((val, i) => {
      const angle = (i / numAxes) * Math.PI * 2 - Math.PI / 2;
      const r = val * (radius - 1);
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
  }, [normalized, numAxes, radius, cx, cy]);

  function pointInPolygon(px: number, py: number): boolean {
    let inside = false;
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function isGridLine(px: number, py: number): boolean {
    const dx = px - cx + 0.5;
    const dy = py - cy + 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    for (const pct of [0.25, 0.5, 0.75, 1.0]) {
      const ringR = pct * (radius - 1);
      if (Math.abs(dist - ringR) < 0.8) return true;
    }
    for (let a = 0; a < numAxes; a++) {
      const angle = (a / numAxes) * Math.PI * 2 - Math.PI / 2;
      const axX = Math.cos(angle);
      const axY = Math.sin(angle);
      const cross = Math.abs(dx * axY - dy * axX);
      const dot = dx * axX + dy * axY;
      if (cross < 0.8 && dot >= 0 && dot <= radius) return true;
    }
    return false;
  }

  // Build row-based rendering with run-length encoding
  const rows = useMemo(() => {
    const result: { type: 'empty' | 'fill' | 'grid'; width: number }[][] = [];
    for (let row = 0; row < gridSize; row++) {
      const rowRuns: { type: 'empty' | 'fill' | 'grid'; width: number }[] = [];
      let currentType: 'empty' | 'fill' | 'grid' = 'empty';
      let runWidth = 0;
      for (let col = 0; col < gridSize; col++) {
        const px = col + 0.5;
        const py = row + 0.5;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let cellType: 'empty' | 'fill' | 'grid';
        if (dist > radius) {
          cellType = 'empty';
        } else if (pointInPolygon(px, py)) {
          cellType = 'fill';
        } else if (isGridLine(px, py)) {
          cellType = 'grid';
        } else {
          cellType = 'empty';
        }
        if (cellType === currentType) {
          runWidth += cellSize;
        } else {
          if (runWidth > 0) rowRuns.push({ type: currentType, width: runWidth });
          currentType = cellType;
          runWidth = cellSize;
        }
      }
      if (runWidth > 0) rowRuns.push({ type: currentType, width: runWidth });
      result.push(rowRuns);
    }
    return result;
  }, [gridSize, radius, cx, cy, vertices]);

  return (
    <Box
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={interactive ? () => setHovered(false) : undefined}
      style={{ position: 'relative', width: size, height: size, ...style }}
    >
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx} style={{ flexDirection: 'row', height: cellSize }}>
          {row.map((run, runIdx) => {
            if (run.type === 'empty') {
              return <Box key={runIdx} style={{ width: run.width, height: cellSize }} />;
            }
            return (
              <Box
                key={runIdx}
                style={{
                  width: run.width,
                  height: cellSize,
                  backgroundColor: run.type === 'fill' ? color : gridColor,
                  opacity: run.type === 'fill' ? 0.6 : 1,
                }}
              />
            );
          })}
        </Box>
      ))}

      {/* Tooltip */}
      {interactive && hovered && (
        <Box style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: 8,
          zIndex: 10,
        }}>
          <Box style={{
            backgroundColor: [0.03, 0.03, 0.05, 0.92],
            borderRadius: 4,
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: 10,
            paddingRight: 10,
            borderWidth: 1,
            borderColor: '#40405a',
            gap: 3,
          }}>
            {axes.map((axis, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Text style={{ color: '#61a6fa', fontSize: 10 }}>
                  {`${axis.label}:`}
                </Text>
                <Text style={{ color: '#e1e4f0', fontSize: 10, fontWeight: 'bold' }}>
                  {`${data[i]}`}
                </Text>
                <Text style={{ color: '#8892a6', fontSize: 9 }}>
                  {`(${Math.round(normalized[i] * 100)}%)`}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
