const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, fileGlyph, fileTone } from '../theme';
import { Glyph, Pill } from './shared';

export function TabBar(props: any) {
  return (
    <Row style={{ backgroundColor: COLORS.panelBg, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      {props.tabs.map((tab: any) => {
        const active = tab.id === props.activeId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => props.onActivate(tab.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: props.compact ? 6 : 8,
              paddingLeft: props.compact ? 10 : 12,
              paddingRight: props.compact ? 8 : 10,
              paddingTop: props.compact ? 7 : 8,
              paddingBottom: props.compact ? 7 : 8,
              borderRightWidth: 1,
              borderColor: COLORS.borderSoft,
              borderTopWidth: 2,
              borderTopColor: active ? COLORS.blue : 'transparent',
              backgroundColor: active ? COLORS.panelAlt : COLORS.panelBg,
            }}
          >
            <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
            <Text fontSize={11} color={active ? COLORS.textBright : COLORS.text}>{tab.name}</Text>
            {!props.compact && tab.git ? <Pill label={tab.git} color={COLORS.blue} tiny={true} /> : null}
            {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
            {!props.compact && !tab.pinned ? (
              <Pressable onPress={() => props.onClose(tab.id)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}>
                <Text fontSize={10} color={COLORS.textDim}>X</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </Row>
  );
}
