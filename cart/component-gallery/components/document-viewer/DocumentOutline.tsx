import { Col, Pressable, ScrollView, Text } from '../../../../runtime/primitives';
import { DOCUMENT_THEME } from './documentViewerShared';

export type OutlineEntry = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export type DocumentOutlineProps = {
  entries: OutlineEntry[];
  activeId: string | null;
  onSelect?: (id: string) => void;
};

export function DocumentOutline({ entries, activeId, onSelect }: DocumentOutlineProps) {
  return (
    <Col
      style={{
        width: 200,
        flexShrink: 0,
        backgroundColor: DOCUMENT_THEME.outline,
        borderRightWidth: 1,
        borderRightColor: DOCUMENT_THEME.outlineBorder,
      }}
    >
      <Col
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: DOCUMENT_THEME.outlineBorder,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            lineHeight: 13,
            color: DOCUMENT_THEME.inkSubtle,
            fontWeight: '600',
          }}
        >
          {'OUTLINE'}
        </Text>
      </Col>
      <ScrollView style={{ flexGrow: 1, width: '100%' }} showScrollbar={false}>
        <Col style={{ paddingTop: 6, paddingBottom: 10 }}>
          {entries.map((entry) => {
            const active = entry.id === activeId;
            const indent = (entry.level - 1) * 10;
            return (
              <Pressable
                key={entry.id}
                onPress={onSelect ? () => onSelect(entry.id) : undefined}
                style={{
                  paddingLeft: 12 + indent,
                  paddingRight: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                  backgroundColor: active ? DOCUMENT_THEME.outlineActive : 'transparent',
                  borderLeftWidth: 2,
                  borderLeftColor: active ? DOCUMENT_THEME.accent : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: entry.level === 1 ? 12 : 11,
                    lineHeight: entry.level === 1 ? 16 : 15,
                    fontWeight: entry.level === 1 ? '600' : '400',
                    color: active ? DOCUMENT_THEME.outlineActiveInk : DOCUMENT_THEME.inkMuted,
                  }}
                >
                  {entry.text}
                </Text>
              </Pressable>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}
