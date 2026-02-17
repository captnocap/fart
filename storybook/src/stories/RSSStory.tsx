import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { useRSSFeed, useRSSAggregate, type FeedItem, type Feed } from '../../../packages/rss/src';

const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';
const ACCENT = '#60a5fa';
const GREEN = '#22c55e';
const ORANGE = '#f59e0b';
const RED = '#ef4444';
const DIM = '#64748b';
const BRIGHT = '#e2e8f0';
const MUTED = '#94a3b8';

// ── Feed URLs ──────────────────────────────────────────

const FEEDS = {
  'Hacker News': 'https://hnrss.org/frontpage',
  'Lobsters': 'https://lobste.rs/rss',
  'Reddit /r/programming': 'https://www.reddit.com/r/programming/.rss',
  'NASA Breaking': 'https://www.nasa.gov/news-release/feed/',
  'xkcd': 'https://xkcd.com/rss.xml',
};

type FeedName = keyof typeof FEEDS;

// ── Single Feed View ───────────────────────────────────

function SingleFeedView() {
  const [selected, setSelected] = useState<FeedName>('Hacker News');
  const { feed, items, loading, error, refetch } = useRSSFeed(FEEDS[selected], { limit: 15 });

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      {/* Feed selector */}
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {(Object.keys(FEEDS) as FeedName[]).map((name) => (
          <Pressable key={name} onPress={() => setSelected(name)}>
            <Box style={{
              backgroundColor: name === selected ? ACCENT : CARD,
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4, borderWidth: 1, borderColor: BORDER,
            }}>
              <Text style={{ fontSize: 10, color: name === selected ? '#000' : MUTED }}>{name}</Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      {/* Feed header */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>{feed?.title || selected}</Text>
          {feed?.description ? (
            <Text style={{ fontSize: 9, color: DIM }} numberOfLines={1}>{feed.description}</Text>
          ) : null}
        </Box>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {feed && (
            <Box style={{
              backgroundColor: feed.type === 'rss2' ? GREEN : feed.type === 'atom' ? ACCENT : ORANGE,
              paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2,
            }}>
              <Text style={{ fontSize: 8, color: '#000', fontWeight: '700' }}>{feed.type.toUpperCase()}</Text>
            </Box>
          )}
          <Pressable onPress={refetch}>
            <Box style={{ backgroundColor: CARD, paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 4, borderWidth: 1, borderColor: BORDER }}>
              <Text style={{ fontSize: 9, color: ACCENT }}>Refresh</Text>
            </Box>
          </Pressable>
        </Box>
      </Box>

      {loading && <Text style={{ fontSize: 11, color: MUTED }}>Fetching feed...</Text>}
      {error && <Text style={{ fontSize: 11, color: RED }}>{`Error: ${error.message}`}</Text>}

      {/* Items list */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 4, paddingRight: 4 }}>
          {items.map((item, i) => (
            <FeedItemRow key={item.id || i} item={item} />
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}

function FeedItemRow({ item }: { item: FeedItem }) {
  const timeAgo = item.pubDate ? formatTimeAgo(item.pubDate) : null;

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 4, padding: 8, gap: 3, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 11, color: BRIGHT }} numberOfLines={2}>{item.title}</Text>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {item.author && <Text style={{ fontSize: 9, color: ACCENT }}>{item.author}</Text>}
        {timeAgo && <Text style={{ fontSize: 9, color: DIM }}>{timeAgo}</Text>}
        {item.categories.length > 0 && (
          <Text style={{ fontSize: 8, color: MUTED }}>{item.categories.slice(0, 3).join(', ')}</Text>
        )}
        {item.enclosure && (
          <Box style={{ backgroundColor: ORANGE, paddingLeft: 3, paddingRight: 3, borderRadius: 2 }}>
            <Text style={{ fontSize: 7, color: '#000', fontWeight: '700' }}>
              {item.enclosure.type.split('/')[0].toUpperCase()}
            </Text>
          </Box>
        )}
      </Box>
      {item.description && (
        <Text style={{ fontSize: 9, color: MUTED }} numberOfLines={2}>
          {stripHTML(item.description).slice(0, 200)}
        </Text>
      )}
    </Box>
  );
}

// ── Aggregate View ─────────────────────────────────────

function AggregateView() {
  const urls = Object.values(FEEDS).slice(0, 3); // HN + Lobsters + Reddit
  const { items, feeds, loading, refetch } = useRSSAggregate(urls, { limit: 20 });

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>Aggregated Feed</Text>
          <Text style={{ fontSize: 9, color: DIM }}>useRSSAggregate([hn, lobsters, reddit], {'{'} limit: 20 {'}'})</Text>
        </Box>
        <Pressable onPress={refetch}>
          <Box style={{ backgroundColor: CARD, paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 4, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 9, color: ACCENT }}>Refresh</Text>
          </Box>
        </Pressable>
      </Box>

      {/* Feed status badges */}
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {feeds.map((f) => {
          const name = Object.entries(FEEDS).find(([, u]) => u === f.url)?.[0] ?? f.url;
          const color = f.error ? RED : f.feed ? GREEN : DIM;
          return (
            <Box key={f.url} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
              <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
              <Text style={{ fontSize: 9, color: MUTED }}>{name}</Text>
              {f.feed && <Text style={{ fontSize: 8, color: DIM }}>({f.feed.items.length})</Text>}
            </Box>
          );
        })}
      </Box>

      {loading && <Text style={{ fontSize: 11, color: MUTED }}>Fetching feeds...</Text>}

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 4, paddingRight: 4 }}>
          {items.map((item, i) => {
            const timeAgo = item.pubDate ? formatTimeAgo(item.pubDate) : null;
            return (
              <Box key={item.id || i} style={{ backgroundColor: CARD, borderRadius: 4, padding: 8, gap: 3, borderWidth: 1, borderColor: BORDER }}>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ backgroundColor: '#334155', paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
                    <Text style={{ fontSize: 8, color: ACCENT }}>{item.feedTitle}</Text>
                  </Box>
                  {timeAgo && <Text style={{ fontSize: 8, color: DIM }}>{timeAgo}</Text>}
                </Box>
                <Text style={{ fontSize: 11, color: BRIGHT }} numberOfLines={2}>{item.title}</Text>
                {item.author && <Text style={{ fontSize: 9, color: MUTED }}>{item.author}</Text>}
              </Box>
            );
          })}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── Code Examples ──────────────────────────────────────

function CodeExamples() {
  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: BRIGHT, fontWeight: '700' }}>Usage</Text>

      <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 10, gap: 2, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 10, color: DIM }}>// One-liner subscription</Text>
        <Text style={{ fontSize: 10, color: GREEN }}>{'const { items } = useRSSFeed(url);'}</Text>
      </Box>

      <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 10, gap: 2, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 10, color: DIM }}>// Polling every 60s</Text>
        <Text style={{ fontSize: 10, color: GREEN }}>{'const { items } = useRSSFeed(url, { interval: 60000 });'}</Text>
      </Box>

      <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 10, gap: 2, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 10, color: DIM }}>// Aggregate multiple feeds</Text>
        <Text style={{ fontSize: 10, color: GREEN }}>{'const { items } = useRSSAggregate(urls);'}</Text>
      </Box>

      <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 10, gap: 2, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 10, color: DIM }}>// Imperative (outside React)</Text>
        <Text style={{ fontSize: 10, color: GREEN }}>{'const feed = await fetchFeed(url);'}</Text>
      </Box>

      <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 10, gap: 2, borderWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 10, color: DIM }}>// OPML import</Text>
        <Text style={{ fontSize: 10, color: GREEN }}>{'const subs = parseOPML(opmlXml);'}</Text>
        <Text style={{ fontSize: 10, color: GREEN }}>{'const { items } = useRSSAggregate(subs.map(s => s.xmlUrl));'}</Text>
      </Box>
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────

export function RSSStory() {
  const [tab, setTab] = useState<'single' | 'aggregate' | 'code'>('single');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 16, gap: 10 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: BRIGHT, fontWeight: '700' }}>@ilovereact/rss</Text>
        <Text style={{ fontSize: 11, color: DIM }}>RSS/Atom feeds — one-liner sub/pub. Supports RSS 2.0, Atom, RSS 1.0, OPML.</Text>
      </Box>

      {/* Tabs */}
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {(['single', 'aggregate', 'code'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)}>
            <Box style={{
              backgroundColor: tab === t ? ACCENT : CARD,
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 11, color: tab === t ? '#000' : MUTED, fontWeight: '700' }}>
                {t === 'single' ? 'Single Feed' : t === 'aggregate' ? 'Aggregate' : 'Code'}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      {tab === 'single' && <SingleFeedView />}
      {tab === 'aggregate' && <AggregateView />}
      {tab === 'code' && <CodeExamples />}
    </Box>
  );
}

// ── Helpers ────────────────────────────────────────────

function stripHTML(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
