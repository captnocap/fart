import { Box, Pressable, Row } from '../../../../runtime/primitives';
import { AtomFrame, MeterMarks, Mono } from './controlsSpecimenParts';
import { useControllableRangeState, useHorizontalRangeDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type RangeSliderProps = {
  low?: number;
  high?: number;
  width?: number;
  onChange?: (next: { low: number; high: number }) => void;
};

export function RangeSlider({
  low = 28,
  high = 74,
  width = 240,
  onChange,
}: RangeSliderProps) {
  const [range, setRange] = useControllableRangeState({
    low,
    high,
    defaultLow: low,
    defaultHigh: high,
    onChange,
  });
  const drag = useHorizontalRangeDrag(range, setRange);
  const trackWidth = Math.max(0, width - 20);
  const lowX = Math.round((range.low / 100) * trackWidth);
  const highX = Math.round((range.high / 100) * trackWidth);

  return (
    <AtomFrame width={width} padding={10} gap={8}>
      <Row style={{ width: '100%', justifyContent: 'space-between', gap: 10 }}>
        <Mono>LOW {String(range.low).padStart(2, '0')}</Mono>
        <Mono>HIGH {String(range.high).padStart(2, '0')}</Mono>
      </Row>
      <Pressable onMouseDown={drag.begin} onLayout={drag.onLayout} style={{ width: '100%', height: 26, justifyContent: 'center' }}>
        <Box style={{ width: trackWidth, height: 6, borderWidth: 1, borderColor: CTRL.ruleBright, backgroundColor: CTRL.bg1 }} />
        <Box
          style={{
            position: 'absolute',
            left: lowX,
            top: 9,
            width: Math.max(0, highX - lowX),
            height: 8,
            backgroundColor: CTRL.accent,
          }}
        />
        {[lowX, highX].map((valueX, index) => (
          <Box
            key={index}
            style={{
              position: 'absolute',
              left: valueX - 4,
              top: 4,
              width: 8,
              height: 18,
              borderWidth: 1,
              borderColor: CTRL.accent,
              backgroundColor: drag.dragging ? CTRL.accentHot : CTRL.bg3,
            }}
          />
        ))}
      </Pressable>
      <MeterMarks labels={['0', '25', '50', '75', '100']} />
    </AtomFrame>
  );
}
