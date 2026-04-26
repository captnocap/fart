import { Col, ScrollView } from '../../../../runtime/primitives';
import { DocumentBlock } from './DocumentBlock';
import { DOCUMENT_THEME, type DocumentModel, type DocumentSize } from './documentViewerShared';
import { DocumentPageHeader } from './DocumentPageHeader';

export type DocumentPageProps = {
  document: DocumentModel;
  size: DocumentSize;
  scroll?: boolean;
};

export function DocumentPage({ document, size, scroll = true }: DocumentPageProps) {
  const padX = size === 'compact' ? 18 : 44;
  const padY = size === 'compact' ? 16 : 36;
  const gap = size === 'compact' ? 10 : 14;

  const content = (
    <Col
      style={{
        paddingLeft: padX,
        paddingRight: padX,
        paddingTop: padY,
        paddingBottom: padY,
        gap,
      }}
    >
      <DocumentPageHeader document={document} size={size} />
      {document.blocks.map((block, index) => (
        <DocumentBlock key={index} block={block} size={size} />
      ))}
    </Col>
  );

  return (
    <Col
      style={{
        flexGrow: 1,
        flexShrink: 1,
        backgroundColor: DOCUMENT_THEME.page,
        borderWidth: 1,
        borderColor: DOCUMENT_THEME.pageBorder,
        borderRadius: size === 'compact' ? 2 : 4,
        overflow: 'hidden',
      }}
    >
      {scroll ? (
        <ScrollView style={{ flexGrow: 1, width: '100%' }} showScrollbar={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </Col>
  );
}
