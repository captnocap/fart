import React, { useState, useMemo } from 'react';
import { Box, Text } from './primitives';
import { ChartTooltip } from './ChartTooltip';
import type { Style, Color } from './types';

export interface PieChartSegment {
  label: string;
  value: number;
  color: Color;
}

export interface PieChartProps {
  data: PieChartSegment[];
  size?: number;
  innerRadius?: number;
  interactive?: boolean;
  style?: Style;
}

export function PieChart({
  data,
  size = 120,
  innerRadius = 0,
  interactive = false,
  style,
}: PieChartProps) {
  const [hovered, setHovered] = useState(false);

  const cellSize = 2;
  const gridSize = Math.floor(size / cellSize);
  const radius = gridSize / 2;
  const inner = (innerRadius / size) * gridSize;
  const cx = radius;
  const cy = radius;

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  const segments = useMemo(() => {
    const result: { startAngle: number; endAngle: number; segment: PieChartSegment; pct: number }[] = [];
    let cumAngle = -Math.PI / 2;
    for (const seg of data) {
      const sliceAngle = (seg.value / total) * Math.PI * 2;
      result.push({
        startAngle: cumAngle,
        endAngle: cumAngle + sliceAngle,
        segment: seg,
        pct: Math.round((seg.value / total) * 100),
      });
      cumAngle += sliceAngle;
    }
    return result;
  }, [data, total]);

  // Build row-based rendering: for each row, produce runs of same-segment cells
  const rows = useMemo(() => {
    const result: { segIdx: number; width: number }[][] = [];
    for (let row = 0; row < gridSize; row++) {
      const rowRuns: { segIdx: number; width: number }[] = [];
      let currentSeg = -1;
      let runWidth = 0;
      for (let col = 0; col < gridSize; col++) {
        const dx = col - cx + 0.5;
        const dy = row - cy + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let segIdx = -1;
        if (dist <= radius && dist >= inner) {
          let angle = Math.atan2(dy, dx);
          if (angle < -Math.PI / 2) angle += Math.PI * 2;
          for (let s = 0; s < segments.length; s++) {
            if (angle >= segments[s].startAngle && angle < segments[s].endAngle) {
              segIdx = s;
              break;
            }
          }
          if (segIdx === -1 && segments.length > 0) segIdx = segments.length - 1;
        }
        if (segIdx === currentSeg) {
          runWidth += cellSize;
        } else {
          if (runWidth > 0) rowRuns.push({ segIdx: currentSeg, width: runWidth });
          currentSeg = segIdx;
          runWidth = cellSize;
        }
      }
      if (runWidth > 0) rowRuns.push({ segIdx: currentSeg, width: runWidth });
      result.push(rowRuns);
    }
    return result;
  }, [gridSize, radius, inner, cx, cy, segments]);

  return (
    <Box
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={interactive ? () => setHovered(false) : undefined}
      style={{ position: 'relative', width: size, height: size, ...style }}
    >
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx} style={{ flexDirection: 'row', height: cellSize }}>
          {row.map((run, runIdx) => {
            if (run.segIdx === -1) {
              return <Box key={runIdx} style={{ width: run.width, height: cellSize }} />;
            }
            return (
              <Box
                key={runIdx}
                style={{
                  width: run.width,
                  height: cellSize,
                  backgroundColor: segments[run.segIdx].segment.color,
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
            {segments.map((seg, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Box style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: seg.segment.color }} />
                <Text style={{ color: '#e1e4f0', fontSize: 10 }}>
                  {`${seg.segment.label}: ${seg.segment.value} (${seg.pct}%)`}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
