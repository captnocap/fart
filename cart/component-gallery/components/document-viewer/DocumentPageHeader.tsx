import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { DOCUMENT_THEME, type DocumentModel, type DocumentSize } from './documentViewerShared';
import { classifiers as S } from '@reactjit/core';

export type DocumentPageHeaderProps = {
  document: DocumentModel;
  size: DocumentSize;
};

export function DocumentPageHeader({ document, size }: DocumentPageHeaderProps) {
  const titleSize = size === 'compact' ? 22 : 32;
  const subtitleSize = size === 'compact' ? 13 : 16;
  const metaSize = size === 'compact' ? 10 : 11;

  return (
    <Col style={{ gap: 6, marginBottom: size === 'compact' ? 4 : 12 }}>
      <Text
        style={{
          fontSize: titleSize,
          lineHeight: Math.round(titleSize * 1.2),
          fontWeight: '700',
          color: DOCUMENT_THEME.ink,
        }}
      >
        {document.title}
      </Text>
      {document.subtitle ? (
        <Text
          style={{
            fontSize: subtitleSize,
            lineHeight: Math.round(subtitleSize * 1.4),
            color: DOCUMENT_THEME.inkMuted,
            fontStyle: 'italic',
          }}
        >
          {document.subtitle}
        </Text>
      ) : null}
      {document.author || document.date ? (
        <S.InlineX5 style={{ marginTop: 2 }}>
          {document.author ? (
            <Text style={{ fontSize: metaSize, lineHeight: metaSize + 4, color: DOCUMENT_THEME.inkSubtle }}>
              {document.author.toUpperCase()}
            </Text>
          ) : null}
          {document.author && document.date ? (
            <Box style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: DOCUMENT_THEME.inkSubtle }} />
          ) : null}
          {document.date ? (
            <Text style={{ fontSize: metaSize, lineHeight: metaSize + 4, color: DOCUMENT_THEME.inkSubtle }}>
              {document.date}
            </Text>
          ) : null}
        </S.InlineX5>
      ) : null}
      <Box
        style={{
          marginTop: size === 'compact' ? 6 : 10,
          height: 1,
          width: '100%',
          backgroundColor: DOCUMENT_THEME.rule,
        }}
      />
    </Col>
  );
}
