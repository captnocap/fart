import { Col, Row } from '../../../../runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL, type ControlTone, toneColor } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type CountBadgeProps = {
  label: string;
  value: string;
  tone?: ControlTone;
};

export function CountBadge({
  label,
  value,
  tone = 'accent',
}: CountBadgeProps) {
  const color = toneColor(tone);
  return (
    <S.StackX2>
      <Mono color={CTRL.inkDimmer}>{label}</Mono>
      <Row style={{ gap: 8, alignItems: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderWidth: 1, borderColor: color }}>
        <Mono color={color} fontSize={9}>#</Mono>
        <Body fontSize={14} color={color}>{value}</Body>
      </Row>
    </S.StackX2>
  );
}
