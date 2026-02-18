import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { hmacSHA256 } from '../../../packages/webhooks/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── HMAC Demo ──────────────────────────────────────────

function HMACDemo() {
  const c = useThemeColors();
  const [secret, setSecret] = useState('my-webhook-secret');
  const [message, setMessage] = useState('{"event":"push","ref":"refs/heads/main"}');

  const signature = hmacSHA256(secret, message);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>HMAC-SHA256 Signing</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>@noble/hashes — audited, works in QuickJS, Node, browser</Text>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>Secret:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.info }}>{secret}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>Payload:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.success }}>{message}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>x-hub-signature-256:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 6, borderRadius: 4 }}>
          <Text style={{ fontSize: 9, color: c.warning }}>{`sha256=${signature}`}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Code Examples ──────────────────────────────────────

function CodeBlock({ label, code, color }: { label: string; code: string[]; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 10, gap: 3, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{label}</Text>
      {code.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: color || c.success }}>{line}</Text>
      ))}
    </Box>
  );
}

function UsageExamples() {
  return (
    <Box style={{ gap: 8 }}>
      <CodeBlock
        label="// Receive webhooks — one-liner"
        code={[
          "const { events, latest } = useWebhook(9090, '/hooks/deploy');",
        ]}
      />

      <CodeBlock
        label="// GitHub-style with signature verification"
        code={[
          "const { events } = useWebhook(9090, '/webhook/github', {",
          "  secret: 'my-secret',",
          "  signatureHeader: 'x-hub-signature-256',",
          "});",
        ]}
      />

      <CodeBlock
        label="// Send a webhook"
        code={[
          "await sendWebhook('https://example.com/hook', {",
          "  event: 'deploy',",
          "  ref: 'main',",
          "});",
        ]}
      />

      <CodeBlock
        label="// Send with HMAC signing + retries"
        code={[
          "await sendWebhook(url, payload, {",
          "  secret: 'shared-secret',",
          "  retries: 3,",
          "  retryDelay: 1000,",
          "});",
        ]}
      />

      <CodeBlock
        label="// React sender hook"
        code={[
          "const { send, sending, error } = useWebhookSender({",
          "  retries: 3,",
          "  secret: 'shared-secret',",
          "});",
          "await send('https://example.com/hook', payload);",
        ]}
      />
    </Box>
  );
}

// ── Feature List ───────────────────────────────────────

function FeatureList() {
  const c = useThemeColors();
  const features = [
    { label: 'Receive', desc: 'useWebhook(port, path) — HTTP server that captures payloads', color: c.success },
    { label: 'Send', desc: 'sendWebhook(url, payload) — POST with auto JSON serialization', color: c.info },
    { label: 'HMAC-SHA256', desc: 'GitHub/Stripe-compatible signature verification', color: c.warning },
    { label: 'Retries', desc: 'Exponential backoff on 5xx errors', color: c.accent },
    { label: 'Event Queue', desc: 'Newest-first queue with configurable max size', color: '#ec4899' },
    { label: '@noble/hashes', desc: 'Audited SHA-256 + HMAC via noble — works in QuickJS', color: c.error },
  ];

  return (
    <Box style={{ gap: 4 }}>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: '700', width: 90 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────

export function WebhooksStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<'demo' | 'code' | 'features'>('demo');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: '700' }}>@ilovereact/webhooks</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>Send and receive webhooks with HMAC-SHA256 verification.</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {(['demo', 'code', 'features'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)}>
            <Box style={{
              backgroundColor: tab === t ? c.info : c.bgElevated,
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 11, color: tab === t ? '#000' : c.textSecondary, fontWeight: '700' }}>
                {t === 'demo' ? 'HMAC Demo' : t === 'code' ? 'Usage' : 'Features'}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 12, paddingRight: 4 }}>
          {tab === 'demo' && <HMACDemo />}
          {tab === 'code' && <UsageExamples />}
          {tab === 'features' && <FeatureList />}
        </Box>
      </ScrollView>
    </Box>
  );
}
