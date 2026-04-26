import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { DOCUMENT_THEME, type DocumentBlock as Block, type DocumentSize } from './documentViewerShared';

const HEADING_SIZE = {
  comfortable: { 1: 28, 2: 20, 3: 16 },
  compact: { 1: 22, 2: 17, 3: 14 },
} as const;

const BODY_SIZE = {
  comfortable: 14,
  compact: 12.5,
};

export type DocumentBlockProps = {
  block: Block;
  size: DocumentSize;
};

export function DocumentBlock({ block, size }: DocumentBlockProps) {
  const body = BODY_SIZE[size];

  if (block.type === 'heading') {
    const fontSize = HEADING_SIZE[size][block.level];
    const topGap = block.level === 1 ? 4 : block.level === 2 ? 14 : 8;
    return (
      <Col style={{ marginTop: topGap, marginBottom: 4, gap: 6 }}>
        <Text
          style={{
            fontSize,
            lineHeight: Math.round(fontSize * 1.25),
            fontWeight: block.level === 1 ? '700' : '600',
            color: DOCUMENT_THEME.ink,
          }}
        >
          {block.text}
        </Text>
        {block.level === 1 ? (
          <Box
            style={{
              height: 1,
              width: '100%',
              backgroundColor: DOCUMENT_THEME.rule,
            }}
          />
        ) : null}
      </Col>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <Text
        style={{
          fontSize: body,
          lineHeight: body * 1.55,
          color: DOCUMENT_THEME.ink,
        }}
      >
        {block.text}
      </Text>
    );
  }

  if (block.type === 'list') {
    return (
      <Col style={{ gap: 4, paddingLeft: 6 }}>
        {block.items.map((item, index) => (
          <Row key={index} style={{ gap: 8, alignItems: 'flex-start' }}>
            <Text
              style={{
                fontSize: body,
                lineHeight: body * 1.55,
                color: DOCUMENT_THEME.inkMuted,
                width: 18,
              }}
            >
              {block.ordered ? `${index + 1}.` : '•'}
            </Text>
            <Text
              style={{
                fontSize: body,
                lineHeight: body * 1.55,
                color: DOCUMENT_THEME.ink,
                flexGrow: 1,
                flexShrink: 1,
              }}
            >
              {item}
            </Text>
          </Row>
        ))}
      </Col>
    );
  }

  if (block.type === 'quote') {
    return (
      <Row style={{ gap: 12, paddingLeft: 4 }}>
        <Box
          style={{
            width: 3,
            backgroundColor: DOCUMENT_THEME.quoteBar,
            borderRadius: 2,
            alignSelf: 'stretch',
          }}
        />
        <Col style={{ gap: 6, flexGrow: 1, flexShrink: 1 }}>
          <Text
            style={{
              fontSize: body + 1,
              lineHeight: (body + 1) * 1.55,
              color: DOCUMENT_THEME.ink,
              fontStyle: 'italic',
            }}
          >
            {block.text}
          </Text>
          {block.attribution ? (
            <Text style={{ fontSize: body - 2, color: DOCUMENT_THEME.inkMuted }}>
              {`— ${block.attribution}`}
            </Text>
          ) : null}
        </Col>
      </Row>
    );
  }

  if (block.type === 'code') {
    return (
      <Box
        style={{
          backgroundColor: DOCUMENT_THEME.code,
          borderRadius: 4,
          padding: size === 'compact' ? 10 : 14,
        }}
      >
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: body - 1,
            lineHeight: (body - 1) * 1.5,
            color: DOCUMENT_THEME.codeInk,
          }}
        >
          {block.code}
        </Text>
      </Box>
    );
  }

  if (block.type === 'divider') {
    return (
      <Box
        style={{
          marginTop: 4,
          marginBottom: 4,
          height: 1,
          width: '40%',
          alignSelf: 'center',
          backgroundColor: DOCUMENT_THEME.rule,
        }}
      />
    );
  }

  return null;
}
