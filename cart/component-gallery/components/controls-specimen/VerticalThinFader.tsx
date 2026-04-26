import { Box, Col, Pressable } from '../../../../runtime/primitives';
import { AtomFrame } from './controlsSpecimenParts';
import { FaderLabel } from './FaderLabel';
import { useControllableNumberState, useVerticalPercentDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type VerticalThinFaderProps = {
  value?: number;
  label?: string;
  onChange?: (next: number) => void;
};

export function VerticalThinFader({
  value = 72,
  label = 'A',
  onChange,
}: VerticalThinFaderProps) {
  const [current, setCurrent] = useControllableNumberState({ value, defaultValue: value, onChange });
  const drag = useVerticalPercentDrag(current, setCurrent);
  const laneWidth = 42;
  const trackWidth = 1;
  const trackHeight = 120;
  const trackTop = 6;
  const trackBottom = trackTop + trackHeight;
  const trackLeft = Math.round((laneWidth - trackWidth) / 2);
  const thumbWidth = 16;
  const thumbLeft = Math.round((laneWidth - thumbWidth) / 2);
  const fillHeight = Math.round(drag.ratio * trackHeight);
  const thumbTop = Math.round(trackBottom - fillHeight - 3);

  return (
    <AtomFrame width={62} padding={10} gap={8}>
      <Pressable onMouseDown={drag.begin} onLayout={drag.onLayout} style={{ width: '100%', height: 132, alignItems: 'center', justifyContent: 'center' }}>
        <Box style={{ width: 1, height: trackHeight, backgroundColor: CTRL.rule }} />
        <Box style={{ position: 'absolute', left: trackLeft, top: trackBottom - fillHeight, width: 1, height: fillHeight, backgroundColor: CTRL.accent }} />
        <Box
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: thumbTop,
            width: thumbWidth,
            height: 6,
            borderWidth: 1,
            borderColor: CTRL.accent,
            backgroundColor: drag.dragging ? CTRL.accent : CTRL.bg3,
          }}
        />
      </Pressable>
      <FaderLabel label={label} value={String(current)} accent={true} />
    </AtomFrame>
  );
}
