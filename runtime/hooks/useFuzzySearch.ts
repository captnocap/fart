import { useMemo } from 'react';

export type FuzzyMode = 'strict' | 'loose';

export type FuzzySearchCandidate = {
  text: string;
  weight?: number;
  mode?: FuzzyMode;
};

export type FuzzySearchResult<T> = {
  item: T;
  score: number;
  index: number;
};

export type FuzzySearchOptions<T> = {
  mode?: FuzzyMode;
  maxResults?: number;
  getText?: (item: T) => string | string[];
  getCandidates?: (item: T) => FuzzySearchCandidate[];
  sort?: (left: FuzzySearchResult<T>, right: FuzzySearchResult<T>) => number;
};

const EMPTY_FUZZY_OPTIONS: FuzzySearchOptions<any> = {};

function normalizeQuery(query: any): string {
  if (typeof query === 'string') return query.trim();
  if (query == null) return '';
  if (typeof query === 'object') {
    if (typeof query.text === 'string') return query.text.trim();
    if (typeof query.value === 'string') return query.value.trim();
    if (typeof query.target?.value === 'string') return query.target.value.trim();
    return '';
  }
  return String(query).trim();
}

export function fuzzyScore(query: string, text: string, mode: FuzzyMode = 'loose'): number {
  const rawQuery = normalizeQuery(query).toLowerCase();
  const t = (text == null ? '' : String(text)).toLowerCase();
  if (!rawQuery) return 1;
  if (!t) return 0;

  const scoreQuery = (q: string): number => {
    if (t === q) return 10000;
    if (t.startsWith(q)) return 1000 + q.length * 10;

    const words = t.split(/[\s\/\-_\\.]+/);
    for (let i = 0; i < words.length; i++) {
      if (words[i].startsWith(q)) {
        return 800 + q.length * 10 - i * 20;
      }
    }

    const subIdx = t.indexOf(q);
    if (subIdx >= 0) {
      return 600 - subIdx * 2;
    }

    if (mode === 'strict') return 0;

    let qi = 0;
    let ti = 0;
    let gaps = 0;
    while (qi < q.length && ti < t.length) {
      if (t[ti] === q[qi]) {
        qi++;
      } else {
        gaps++;
      }
      ti++;
    }
    if (qi === q.length) {
      return Math.max(10, 400 - gaps * 10 - (ti - qi) * 2);
    }

    return 0;
  };

  let best = scoreQuery(rawQuery);
  if (rawQuery.endsWith('s') && rawQuery.length > 3) {
    best = Math.max(best, Math.floor(scoreQuery(rawQuery.slice(0, -1)) * 0.96));
  }

  return best;
}

function normalizeCandidates<T>(
  item: T,
  options: FuzzySearchOptions<T>
): FuzzySearchCandidate[] {
  if (options.getCandidates) return options.getCandidates(item);

  const raw = options.getText ? options.getText(item) : String(item ?? '');
  const texts = Array.isArray(raw) ? raw : [raw];
  return texts.map((text) => ({ text }));
}

export function scoreFuzzyItem<T>(
  item: T,
  query: string,
  options: FuzzySearchOptions<T> = EMPTY_FUZZY_OPTIONS
): number {
  const q = normalizeQuery(query);
  if (!q) return 1;

  const mode = options.mode || 'loose';
  const candidates = normalizeCandidates(item, options);
  let best = 0;

  for (const candidate of candidates) {
    const text = (candidate.text == null ? '' : String(candidate.text)).trim();
    if (!text) continue;
    const score = fuzzyScore(q, text, candidate.mode || mode);
    if (score <= 0) continue;
    const weighted = score * (candidate.weight ?? 1);
    if (weighted > best) best = weighted;
  }

  return best;
}

export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions<T> = EMPTY_FUZZY_OPTIONS
): FuzzySearchResult<T>[] {
  const q = normalizeQuery(query);
  const maxResults = options.maxResults ?? 0;
  let results: FuzzySearchResult<T>[];

  if (!q) {
    results = items.map((item, index) => ({ item, score: 1, index }));
  } else {
    results = items
      .map((item, index) => ({ item, score: scoreFuzzyItem(item, q, options), index }))
      .filter((result) => result.score > 0);

    results.sort((left, right) => {
      if (options.sort) return options.sort(left, right);
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    });
  }

  return maxResults > 0 ? results.slice(0, maxResults) : results;
}

export function useFuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions<T> = EMPTY_FUZZY_OPTIONS
): FuzzySearchResult<T>[] {
  return useMemo(
    () => fuzzySearch(items, query, options),
    [items, query, options],
  );
}
