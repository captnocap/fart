import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { DOCUMENT_THEME, type DocumentSize } from './documentViewerShared';
import { classifiers as S } from '@reactjit/core';

export type DocumentToolbarProps = {
  title: string;
  activeSection?: string | null;
  size: DocumentSize;
  outlineVisible: boolean;
  canToggleOutline: boolean;
  onToggleOutline?: () => void;
  zoomPct: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
};

function ToolbarButton({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        width: 24,
        height: 22,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: DOCUMENT_THEME.toolbarBorder,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 12, color: DOCUMENT_THEME.toolbarInk, fontWeight: '600' }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

export function DocumentToolbar({
  title,
  activeSection,
  size,
  outlineVisible,
  canToggleOutline,
  onToggleOutline,
  zoomPct,
  onZoomIn,
  onZoomOut,
}: DocumentToolbarProps) {
  const compact = size === 'compact';

  return (
    <Row
      style={{
        width: '100%',
        height: compact ? 28 : 34,
        backgroundColor: DOCUMENT_THEME.toolbar,
        borderBottomWidth: 1,
        borderBottomColor: DOCUMENT_THEME.toolbarBorder,
        paddingLeft: compact ? 8 : 12,
        paddingRight: compact ? 8 : 12,
        alignItems: 'center',
        gap: 10,
      }}
    >
      {canToggleOutline ? (
        <Pressable
          onPress={onToggleOutline}
          style={{
            width: 22,
            height: 18,
            borderRadius: 3,
            backgroundColor: outlineVisible ? DOCUMENT_THEME.accent : 'transparent',
            borderWidth: 1,
            borderColor: outlineVisible ? DOCUMENT_THEME.accent : DOCUMENT_THEME.toolbarBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: DOCUMENT_THEME.toolbarInk }}>{'≡'}</Text>
        </Pressable>
      ) : null}

      <Col style={{ flexGrow: 1, flexShrink: 1, gap: 1 }}>
        <Text
          style={{
            fontSize: compact ? 11 : 12,
            lineHeight: compact ? 14 : 15,
            color: DOCUMENT_THEME.toolbarInk,
            fontWeight: '600',
          }}
        >
          {title}
        </Text>
        {!compact && activeSection ? (
          <Text style={{ fontSize: 10, lineHeight: 13, color: DOCUMENT_THEME.toolbarMuted }}>
            {activeSection.toUpperCase()}
          </Text>
        ) : null}
      </Col>

      {!compact ? (
        <S.SectionLabel>
          <ToolbarButton glyph="−" label="zoom out" onPress={onZoomOut} />
          <Box
            style={{
              minWidth: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 11, color: DOCUMENT_THEME.toolbarInk, fontVariant: 'tabular-nums' as any }}>
              {`${Math.round(zoomPct)}%`}
            </Text>
          </Box>
          <ToolbarButton glyph="+" label="zoom in" onPress={onZoomIn} />
        </S.SectionLabel>
      ) : null}
    </Row>
  );
}
