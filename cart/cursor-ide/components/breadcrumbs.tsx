const React: any = require('react');

import { Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph } from './shared';

export function BreadcrumbBar(props: any) {
  if (!props.items || props.items.length === 0) return null;
  return (
    <Row
      style={{
        paddingLeft: props.compact ? 10 : 12,
        paddingRight: props.compact ? 10 : 12,
        paddingTop: props.compact ? 7 : 9,
        paddingBottom: props.compact ? 7 : 9,
        gap: props.compact ? 4 : 6,
        alignItems: 'center',
        backgroundColor: COLORS.panelRaised,
        borderBottomWidth: 1,
        borderColor: COLORS.borderSoft,
        flexWrap: 'wrap',
      }}
    >
      {props.items.map((crumb: any, idx: number) => (
        <Pressable
          key={crumb.label + '_' + idx}
          onPress={crumb.kind === 'home' || crumb.kind === 'workspace' ? props.onOpenHome : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          {idx > 0 ? <Text fontSize={9} color={COLORS.textDim}>{'>'}</Text> : null}
          <Glyph icon={crumb.icon} tone={crumb.tone} backgroundColor={COLORS.panelAlt} tiny={true} />
          <Text fontSize={11} color={crumb.active ? COLORS.textBright : COLORS.text}>
            {crumb.label}
          </Text>
          {crumb.meta ? <Text fontSize={10} color={COLORS.textDim}>{crumb.meta}</Text> : null}
        </Pressable>
      ))}
    </Row>
  );
}
