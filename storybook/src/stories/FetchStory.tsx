import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, useFetch } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

// Simple display for a fetch result
function ResultBox({ label, loading, error, data }: {
  label: string;
  loading: boolean;
  error: Error | null;
  data: any;
}) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 6,
      padding: 12,
      gap: 6,
    }}>
      <Text style={{ fontSize: 13, color: c.textSecondary }}>{label}</Text>
      {loading && <Text style={{ fontSize: 12, color: c.warning }}>Loading...</Text>}
      {error && <Text style={{ fontSize: 12, color: c.error }}>{`Error: ${error.message}`}</Text>}
      {data && (
        <Text style={{ fontSize: 11, color: c.text }}>
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 300)}
        </Text>
      )}
      {!loading && !error && !data && (
        <Text style={{ fontSize: 12, color: c.textDim }}>No data yet</Text>
      )}
    </Box>
  );
}

// Manual fetch demo with a button
function ManualFetchDemo() {
  const c = useThemeColors();
  const [result, setResult] = useState<{ data?: any; error?: string; loading: boolean }>({ loading: false });

  const doFetch = useCallback(() => {
    setResult({ loading: true });
    fetch('https://httpbin.org/get?demo=ilovereact')
      .then((res: any) => res.json())
      .then((json: any) => setResult({ data: json, loading: false }))
      .catch((err: any) => setResult({ error: String(err), loading: false }));
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Pressable onPress={doFetch} style={{
        backgroundColor: c.primary,
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, color: '#ffffff' }}>
          {result.loading ? 'Fetching...' : 'fetch() GET'}
        </Text>
      </Pressable>
      <ResultBox
        label="Manual fetch('https://httpbin.org/get')"
        loading={result.loading}
        error={result.error ? new Error(result.error) : null}
        data={result.data}
      />
    </Box>
  );
}

// useFetch hook demo
function UseFetchDemo() {
  const c = useThemeColors();
  const [url, setUrl] = useState<string | null>(null);
  const { data, error, loading } = useFetch<any>(url);

  const startFetch = useCallback(() => {
    setUrl('https://httpbin.org/ip');
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Pressable onPress={startFetch} style={{
        backgroundColor: c.accent,
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, color: '#ffffff' }}>
          {loading ? 'Loading...' : 'useFetch() hook'}
        </Text>
      </Pressable>
      <ResultBox
        label="useFetch('https://httpbin.org/ip')"
        loading={loading}
        error={error}
        data={data}
      />
    </Box>
  );
}

// POST request demo
function PostFetchDemo() {
  const c = useThemeColors();
  const [result, setResult] = useState<{ data?: any; error?: string; loading: boolean }>({ loading: false });

  const doPost = useCallback(() => {
    setResult({ loading: true });
    fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: 'iLoveReact', target: 'love2d' }),
    })
      .then((res: any) => res.json())
      .then((json: any) => setResult({ data: json, loading: false }))
      .catch((err: any) => setResult({ error: String(err), loading: false }));
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Pressable onPress={doPost} style={{
        backgroundColor: c.success,
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, color: '#ffffff' }}>
          {result.loading ? 'Posting...' : 'fetch() POST'}
        </Text>
      </Pressable>
      <ResultBox
        label="POST to httpbin.org/post"
        loading={result.loading}
        error={result.error ? new Error(result.error) : null}
        data={result.data}
      />
    </Box>
  );
}

export function FetchStory() {
  const c = useThemeColors();
  return (
    <Box style={{
      width: '100%', height: '100%',
      padding: 20,
      gap: 16,
      backgroundColor: c.bg,
    }}>
      <Text style={{ fontSize: 18, color: c.text }}>fetch() — HTTP & Local Files</Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        Standard fetch() API backed by LuaSocket (HTTP) and love.filesystem (local paths)
      </Text>

      <ManualFetchDemo />
      <UseFetchDemo />
      <PostFetchDemo />
    </Box>
  );
}
