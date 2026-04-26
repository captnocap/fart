import { useMemo, useState } from 'react';
import { Box, Col, Row } from '../../../../runtime/primitives';
import { DocumentOutline } from './DocumentOutline';
import { DocumentPage } from './DocumentPage';
import { DocumentToolbar } from './DocumentToolbar';
import {
  collectOutline,
  DOCUMENT_THEME,
  SAMPLE_DOCUMENT,
  type DocumentModel,
  type DocumentSize,
} from './documentViewerShared';

export type DocumentViewerProps = {
  document?: DocumentModel;
  initialZoom?: number;
};

const SMALL_BREAKPOINT = 540;

export function DocumentViewer({ document = SAMPLE_DOCUMENT, initialZoom = 100 }: DocumentViewerProps) {
  const [width, setWidth] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(initialZoom);

  const outline = useMemo(() => collectOutline(document), [document]);
  const isSmall = width !== null && width < SMALL_BREAKPOINT;
  const size: DocumentSize = isSmall ? 'compact' : 'comfortable';
  const showOutline = !isSmall && outlineOpen && outline.length > 0;

  const activeSection = useMemo(() => {
    if (!activeId) return outline[0]?.text ?? null;
    return outline.find((entry) => entry.id === activeId)?.text ?? null;
  }, [activeId, outline]);

  return (
    <Col
      style={{
        flexGrow: 1,
        flexShrink: 1,
        width: '100%',
        height: '100%',
        backgroundColor: DOCUMENT_THEME.toolbar,
        borderRadius: 4,
        overflow: 'hidden',
      }}
      onLayout={(rect: any) => {
        if (!rect) return;
        const next = Number.isFinite(rect.width) ? rect.width : null;
        if (next !== null && next !== width) setWidth(next);
      }}
    >
      <DocumentToolbar
        title={document.title}
        activeSection={activeSection}
        size={size}
        outlineVisible={showOutline}
        canToggleOutline={!isSmall && outline.length > 0}
        onToggleOutline={() => setOutlineOpen((prev) => !prev)}
        zoomPct={zoom}
        onZoomIn={() => setZoom((z) => Math.min(200, z + 10))}
        onZoomOut={() => setZoom((z) => Math.max(60, z - 10))}
      />
      <Row style={{ flexGrow: 1, flexShrink: 1, width: '100%' }}>
        {showOutline ? (
          <DocumentOutline
            entries={outline}
            activeId={activeId ?? outline[0]?.id ?? null}
            onSelect={(id) => setActiveId(id)}
          />
        ) : null}
        <Box
          style={{
            flexGrow: 1,
            flexShrink: 1,
            padding: isSmall ? 0 : 16,
            backgroundColor: DOCUMENT_THEME.toolbar,
          }}
        >
          <DocumentPage document={document} size={size} />
        </Box>
      </Row>
    </Col>
  );
}
