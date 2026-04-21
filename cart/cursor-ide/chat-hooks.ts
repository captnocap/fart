// =============================================================================
// CHAT HOOKS — composer history, message search, export state
// =============================================================================

const React: any = require('react');
const { useState, useRef, useCallback } = React;

// ── Composer History ─────────────────────────────────────────────────────────

export function useComposerHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const indexRef = useRef(-1);

  const push = useCallback((text: string) => {
    if (!text.trim()) return;
    setHistory(prev => {
      // Don't duplicate consecutive entries
      if (prev.length > 0 && prev[prev.length - 1] === text.trim()) return prev;
      return [...prev.slice(-49), text.trim()]; // Keep last 50
    });
    indexRef.current = -1;
  }, []);

  const navigate = useCallback((direction: 'up' | 'down', current: string): { text: string; moved: boolean } => {
    if (history.length === 0) return { text: current, moved: false };

    if (direction === 'up') {
      const nextIndex = indexRef.current === -1 ? history.length - 1 : Math.max(0, indexRef.current - 1);
      indexRef.current = nextIndex;
      return { text: history[nextIndex], moved: true };
    } else {
      if (indexRef.current === -1) return { text: current, moved: false };
      const nextIndex = indexRef.current + 1;
      if (nextIndex >= history.length) {
        indexRef.current = -1;
        return { text: '', moved: true };
      }
      indexRef.current = nextIndex;
      return { text: history[nextIndex], moved: true };
    }
  }, [history]);

  const reset = useCallback(() => {
    indexRef.current = -1;
  }, []);

  return { push, navigate, reset, history };
}

// ── Message Search ───────────────────────────────────────────────────────────

export interface SearchResult {
  messageIndex: number;
  message: any;
  matches: Array<{ start: number; end: number }>;
}

export function useMessageSearch(messages: any[]) {
  const [query, setQuery] = useState('');

  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    messages.forEach((msg, idx) => {
      const text = (msg.text || '').toLowerCase();
      const matches: Array<{ start: number; end: number }> = [];
      let pos = 0;
      while (true) {
        const found = text.indexOf(q, pos);
        if (found < 0) break;
        matches.push({ start: found, end: found + q.length });
        pos = found + q.length;
      }
      if (matches.length > 0) {
        out.push({ messageIndex: idx, message: msg, matches });
      }
    });

    return out;
  }, [messages, query]);

  return { query, setQuery, results, active: query.trim().length > 0 };
}

// ── Typing Indicator ─────────────────────────────────────────────────────────

export function useTypingDots(speedMs: number = 400): number {
  const [dot, setDot] = useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setDot(d => (d + 1) % 4);
    }, speedMs);
    return () => clearInterval(id);
  }, [speedMs]);

  return dot;
}
