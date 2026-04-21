// =============================================================================
// FILE INDEXER — workspace file indexing with metadata + embedding stubs
// =============================================================================

const host: any = globalThis;

const STORE_INDEX_KEY = 'cursor-ide.fileIndex';

function storeGet(key: string): string | null {
  try { return host.__store_get(key); } catch { return null; }
}
function storeSet(key: string, value: string): void {
  try { host.__store_set(key, value); } catch {}
}
function fsRead(path: string): string {
  try { const out = host.__fs_read(path); return typeof out === 'string' ? out : ''; } catch { return ''; }
}
function fsStat(path: string): any {
  try { return JSON.parse(host.__fs_stat_json(path) || 'null'); } catch { return null; }
}
function execCmd(cmd: string): string {
  try { const out = host.__exec(cmd); return typeof out === 'string' ? out : ''; } catch { return ''; }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface IndexedFile {
  path: string;
  contentHash: string;
  indexedAt: number;
  tokenCount: number;
  embeddings?: number[];
  metadata: {
    language: string;
    lineCount: number;
    lastModified: number;
  };
}

export interface IndexStats {
  totalFiles: number;
  totalTokens: number;
  lastIndexedAt: number;
  languages: Record<string, number>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashContent(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h + content.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', zig: 'zig', lua: 'lua',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml',
  css: 'css', html: 'html', xml: 'xml', sh: 'bash',
};

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'unknown';
}

// ── Core API ─────────────────────────────────────────────────────────────────

export function loadIndex(): IndexedFile[] {
  const raw = storeGet(STORE_INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveIndex(index: IndexedFile[]): void {
  storeSet(STORE_INDEX_KEY, JSON.stringify(index));
}

export function getIndexStats(): IndexStats {
  const index = loadIndex();
  const languages: Record<string, number> = {};
  let totalTokens = 0;
  for (const f of index) {
    totalTokens += f.tokenCount;
    languages[f.metadata.language] = (languages[f.metadata.language] || 0) + 1;
  }
  return {
    totalFiles: index.length,
    totalTokens,
    lastIndexedAt: index.length > 0 ? Math.max(...index.map(f => f.indexedAt)) : 0,
    languages,
  };
}

export function indexFile(path: string): IndexedFile | null {
  const content = fsRead(path);
  if (!content) return null;
  const stat = fsStat(path);
  return {
    path,
    contentHash: hashContent(content),
    indexedAt: Date.now(),
    tokenCount: estimateTokens(content),
    metadata: {
      language: langFromPath(path),
      lineCount: content.split('\n').length,
      lastModified: stat?.mtimeMs || Date.now(),
    },
  };
}

export function indexWorkspace(workDir: string, options?: { exclude?: string[] }): IndexStats {
  const exclude = new Set([
    '.git', 'node_modules', '.zig-cache', 'zig-out', 'dist', '.cache',
    ...(options?.exclude || []),
  ]);
  const excludes = Array.from(exclude).map(e => `-not -path '*/${e}/*'`).join(' ');
  const findOut = execCmd(`find "${workDir}" -type f ${excludes} 2>/dev/null`);
  const paths = findOut.split('\n').filter(p => p.trim());

  const existing = new Map(loadIndex().map(f => [f.path, f]));
  const updated: IndexedFile[] = [];

  for (const path of paths) {
    const stat = fsStat(path);
    const prev = existing.get(path);
    if (prev && stat && prev.metadata.lastModified >= stat.mtimeMs) {
      updated.push(prev);
      continue;
    }
    const indexed = indexFile(path);
    if (indexed) updated.push(indexed);
  }

  saveIndex(updated);
  return getIndexStats();
}

export function searchIndex(query: string): IndexedFile[] {
  const index = loadIndex();
  const q = query.toLowerCase();
  return index.filter(f => f.path.toLowerCase().includes(q));
}

export function removeFromIndex(path: string): void {
  saveIndex(loadIndex().filter(f => f.path !== path));
}

export function clearIndex(): void {
  saveIndex([]);
}

export function getFileContent(path: string): string {
  return fsRead(path);
}
