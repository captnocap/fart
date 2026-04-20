const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { iconLabel } from '../utils';

export function Glyph(props: { icon: string; tone?: string; backgroundColor?: string; tiny?: boolean }) {
  return (
    <Box
      style={{
        paddingLeft: props.tiny ? 4 : 5,
        paddingRight: props.tiny ? 4 : 5,
        paddingTop: props.tiny ? 2 : 3,
        paddingBottom: props.tiny ? 2 : 3,
        borderRadius: props.tiny ? 4 : 5,
        backgroundColor: props.backgroundColor || COLORS.grayChip,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: props.tiny ? 18 : 22,
      }}
    >
      <Text fontSize={props.tiny ? 8 : 9} color={props.tone || COLORS.textBright} style={{ fontWeight: 'bold' }}>
        {iconLabel(props.icon)}
      </Text>
    </Box>
  );
}

export function Pill(props: { label: string; color?: string; borderColor?: string; backgroundColor?: string; tiny?: boolean }) {
  return (
    <Box
      style={{
        paddingLeft: props.tiny ? 6 : 8,
        paddingRight: props.tiny ? 6 : 8,
        paddingTop: props.tiny ? 3 : 5,
        paddingBottom: props.tiny ? 3 : 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: props.borderColor || COLORS.border,
        backgroundColor: props.backgroundColor || COLORS.panelAlt,
      }}
    >
      <Text fontSize={props.tiny ? 9 : 10} color={props.color || COLORS.text}>
        {props.label}
      </Text>
    </Box>
  );
}

export function HeaderButton(props: any) {
  const active = props.active === 1;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: props.compact ? 0 : 6,
        paddingLeft: props.compact ? 8 : 10,
        paddingRight: props.compact ? 8 : 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? COLORS.blue : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Glyph icon={props.icon} tone={active ? COLORS.blue : COLORS.textMuted} backgroundColor="transparent" tiny={true} />
      {!props.compact && (
        <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>
          {props.label}
        </Text>
      )}
      {!props.compact && props.meta ? (
        <Text fontSize={9} color={COLORS.textDim}>
          {props.meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function CompactSurfaceButton(props: any) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: props.showLabel ? 6 : 0,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Glyph icon={props.icon} tone={props.active ? COLORS.blue : COLORS.textMuted} backgroundColor="transparent" tiny={true} />
      {props.showLabel ? (
        <Text fontSize={10} color={props.active ? COLORS.blue : COLORS.text}>
          {props.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

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
