// ── Indexer Panel ────────────────────────────────────────────────────────────
// Workspace file indexing UI: index, search, stats, manage indexed files.

const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Pill } from './shared';
import { indexWorkspace, loadIndex, getIndexStats, searchIndex, clearIndex, type IndexStats, type IndexedFile } from '../indexer';

export function IndexerPanel(props: { workDir: string; onIndex?: () => void }) {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexedFile[]>([]);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    setStats(getIndexStats());
    setResults(loadIndex());
  }, []);

  function doIndex() {
    setIndexing(true);
    const s = indexWorkspace(props.workDir);
    setStats(s);
    setResults(loadIndex());
    setIndexing(false);
    props.onIndex?.();
  }

  function doSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults(loadIndex());
    } else {
      setResults(searchIndex(q));
    }
  }

  function doClear() {
    clearIndex();
    setStats(getIndexStats());
    setResults([]);
    props.onIndex?.();
  }

  const langEntries = stats ? Object.entries(stats.languages).sort((a, b) => b[1] - a[1]) : [];

  return (
    <Col style={{ gap: 14 }}>
      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Workspace Index</Text>
        <Text fontSize={10} color={COLORS.textDim}>Index files for semantic search, context injection, and code intelligence.</Text>

        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Pressable onPress={doIndex} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{indexing ? 'Indexing...' : 'Index Workspace'}</Text>
          </Pressable>
          <Pressable onPress={doClear} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={11} color={COLORS.textDim}>Clear</Text>
          </Pressable>
        </Row>

        {stats && stats.totalFiles > 0 && (
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label={`${stats.totalFiles} files`} color={COLORS.green} tiny={true} />
            <Pill label={`${stats.totalTokens.toLocaleString()} tokens`} color={COLORS.blue} tiny={true} />
            {langEntries.slice(0, 5).map(([lang, count]) => (
              <Pill key={lang} label={`${lang}: ${count}`} tiny={true} />
            ))}
          </Row>
        )}
      </Box>

      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <TextInput
          value={query}
          onChangeText={doSearch}
          placeholder="Search indexed files..."
          style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
        <Text fontSize={10} color={COLORS.textDim}>{results.length} file{results.length !== 1 ? 's' : ''}</Text>

        <Col style={{ gap: 4, maxHeight: 320 }}>
          <ScrollView style={{ flexGrow: 1 }}>
            {results.map(f => (
              <Row key={f.path} style={{ alignItems: 'center', gap: 8, padding: 6, borderRadius: 6 }}>
                <Pill label={f.metadata.language} color={COLORS.blue} tiny={true} />
                <Text fontSize={10} color={COLORS.textBright} style={{ flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>{f.path.replace(props.workDir + '/', '')}</Text>
                <Text fontSize={9} color={COLORS.textDim}>{f.tokenCount}t</Text>
              </Row>
            ))}
          </ScrollView>
        </Col>
      </Box>
    </Col>
  );
}
