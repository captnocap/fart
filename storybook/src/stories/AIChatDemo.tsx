/**
 * AIChatDemo — Interactive AI chat with streaming, tool calling, and key management.
 *
 * Demonstrates:
 * - API key input with provider selection
 * - Model selection
 * - Streaming chat with real-time token display
 * - Tool calling (calculator example)
 * - Browse tools (stealth browser control for AI agents)
 * - Provider switching (OpenAI / Anthropic)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, ScrollView, Pressable, TextInput } from '../../../packages/shared/src';
import { useChat, useAPIKeys, AIProvider, createBrowserTools } from '../../../packages/ai/src';
import type { AIProviderType, AIConfig, ToolDefinition } from '../../../packages/ai/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Demo-specific colors (not theme-mapped) ─────────────
const USER_BG = '#1e3a5f';
const ASSISTANT_BG = '#1a2332';
const TOOL_BG = '#1c2a1c';

// ── Tool definitions ────────────────────────────────────

const calculatorTool: ToolDefinition = {
  name: 'calculate',
  description: 'Evaluate a mathematical expression and return the numeric result. Supports basic arithmetic (+, -, *, /), exponents (**), and parentheses.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The math expression to evaluate, e.g. "2 + 3 * 4"',
      },
    },
    required: ['expression'],
  },
  execute: async ({ expression }: { expression: string }) => {
    // Safe math evaluation (no eval)
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
    try {
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { result: Number(result) };
    } catch {
      return { error: 'Invalid expression' };
    }
  },
};

const timeTool: ToolDefinition = {
  name: 'get_time',
  description: 'Get the current date and time.',
  parameters: { type: 'object', properties: {} },
  execute: async () => ({ time: new Date().toISOString() }),
};

// ── Pill button ─────────────────────────────────────────

function Pill({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: active ? c.primary : c.bgElevated,
      paddingLeft: 10, paddingRight: 10,
      paddingTop: 4, paddingBottom: 4,
      borderRadius: 4,
    }}>
      <Text style={{ fontSize: 11, color: active ? '#fff' : c.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

// ── Message bubble ──────────────────────────────────────

function MessageBubble({ role, content, toolCalls }: {
  role: string;
  content: string;
  toolCalls?: { name: string; arguments: string }[];
}) {
  const c = useThemeColors();
  const isUser = role === 'user';
  const isTool = role === 'tool';

  return (
    <Box style={{
      backgroundColor: isTool ? TOOL_BG : isUser ? USER_BG : ASSISTANT_BG,
      padding: 10,
      borderRadius: 6,
      marginBottom: 6,
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
    }}>
      <Text style={{ fontSize: 9, color: c.textDim, marginBottom: 3 }}>
        {isUser ? 'You' : isTool ? 'Tool Result' : 'Assistant'}
      </Text>
      <Text style={{ fontSize: 13, color: c.text, lineHeight: 20 }}>
        {typeof content === 'string' ? content : JSON.stringify(content)}
      </Text>
      {toolCalls && toolCalls.length > 0 && (
        <Box style={{ marginTop: 6, padding: 6, backgroundColor: c.surface, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'Tool calls: ' + toolCalls.map(tc => tc.name).join(', ')}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── Config panel ────────────────────────────────────────

function ConfigPanel({
  provider, setProvider, model, setModel,
  apiKey, setApiKey, toolsEnabled, setToolsEnabled,
  browseEnabled, setBrowseEnabled,
}: {
  provider: AIProviderType; setProvider: (p: AIProviderType) => void;
  model: string; setModel: (m: string) => void;
  apiKey: string; setApiKey: (k: string) => void;
  toolsEnabled: boolean; setToolsEnabled: (v: boolean) => void;
  browseEnabled: boolean; setBrowseEnabled: (v: boolean) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ padding: 12, backgroundColor: c.bgElevated, borderRadius: 8, gap: 10 }}>
      <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>Configuration</Text>

      {/* Provider selector */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textDim }}>Provider</Text>
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Pill label="OpenAI" active={provider === 'openai'} onPress={() => {
            setProvider('openai');
            setModel('gpt-4');
          }} />
          <Pill label="Anthropic" active={provider === 'anthropic'} onPress={() => {
            setProvider('anthropic');
            setModel('claude-sonnet-4-5-20250929');
          }} />
          <Pill label="Local (Ollama)" active={provider === 'custom'} onPress={() => {
            setProvider('custom');
            setModel('llama3');
          }} />
        </Box>
      </Box>

      {/* API Key */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textDim }}>API Key</Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={provider === 'custom' ? 'Not required for local' : 'Enter API key...'}
          style={{
            fontSize: 12,
            color: c.text,
            backgroundColor: c.bg,
            padding: 8,
            borderRadius: 4,
            width: '100%',
            height: 32,
          }}
        />
      </Box>

      {/* Model */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.textDim }}>Model</Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder="Model name..."
          style={{
            fontSize: 12,
            color: c.text,
            backgroundColor: c.bg,
            padding: 8,
            borderRadius: 4,
            width: '100%',
            height: 32,
          }}
        />
      </Box>

      {/* Tool calling toggle */}
      <Pressable onPress={() => setToolsEnabled(!toolsEnabled)} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Box style={{
          width: 16, height: 16, borderRadius: 3,
          backgroundColor: toolsEnabled ? ACCENT : c.surface,
          justifyContent: 'center', alignItems: 'center',
        }}>
          {toolsEnabled && <Text style={{ fontSize: 10, color: '#fff' }}>x</Text>}
        </Box>
        <Text style={{ fontSize: 11, color: c.textSecondary }}>Enable tool calling (calculator, time)</Text>
      </Pressable>

      {/* Browse tools toggle */}
      <Pressable onPress={() => setBrowseEnabled(!browseEnabled)} style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Box style={{
          width: 16, height: 16, borderRadius: 3,
          backgroundColor: browseEnabled ? '#22c55e' : c.surface,
          justifyContent: 'center', alignItems: 'center',
        }}>
          {browseEnabled && <Text style={{ fontSize: 10, color: '#fff' }}>x</Text>}
        </Box>
        <Text style={{ fontSize: 11, color: c.textSecondary }}>Enable browse tools (stealth browser)</Text>
      </Pressable>
    </Box>
  );
}

// ── Chat view ───────────────────────────────────────────

function ChatView({ config, toolsEnabled, browseEnabled }: { config: AIConfig; toolsEnabled: boolean; browseEnabled: boolean }) {
  const c = useThemeColors();
  const builtinTools = toolsEnabled ? [calculatorTool, timeTool] : [];
  const browseTools = browseEnabled ? createBrowserTools() : [];
  const allTools = [...builtinTools, ...browseTools];
  const tools = allTools.length > 0 ? allTools : undefined;

  const { messages, send, isLoading, isStreaming, error, stop } = useChat({
    ...config,
    tools,
    maxToolRounds: browseEnabled ? 20 : 5,
  });

  const [input, setInput] = useState('');
  const scrollRef = useRef<any>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    send(text);
  }, [input, isLoading, send]);

  return (
    <Box style={{ flexGrow: 1, gap: 8 }}>
      {/* Messages */}
      <ScrollView style={{ flexGrow: 1, backgroundColor: c.bg, borderRadius: 8, padding: 10 }}>
        {messages.length === 0 && (
          <Box style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: c.textDim }}>
              {config.apiKey || config.provider === 'custom'
                ? 'Send a message to start chatting'
                : 'Enter an API key to get started'}
            </Text>
            {toolsEnabled && (
              <Text style={{ fontSize: 11, color: c.textDim, marginTop: 8 }}>
                {'Tools enabled: try "what is 234 * 567?" or "what time is it?"'}
              </Text>
            )}
            {browseEnabled && (
              <Text style={{ fontSize: 11, color: c.success, marginTop: 4 }}>
                {'Browse enabled: try "go to duckduckgo.com and search for React"'}
              </Text>
            )}
          </Box>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
            toolCalls={msg.toolCalls}
          />
        ))}
        {isStreaming && (
          <Box style={{ padding: 4 }}>
            <Text style={{ fontSize: 10, color: c.primary }}>Streaming...</Text>
          </Box>
        )}
      </ScrollView>

      {/* Error display */}
      {error && (
        <Box style={{ padding: 8, backgroundColor: '#2d1b1b', borderRadius: 4 }}>
          <Text style={{ fontSize: 11, color: c.error }}>{error.message}</Text>
        </Box>
      )}

      {/* Input bar */}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder="Type a message..."
          style={{
            flexGrow: 1,
            fontSize: 13,
            color: c.text,
            backgroundColor: c.bgElevated,
            padding: 10,
            borderRadius: 6,
            height: 40,
          }}
        />
        {isLoading ? (
          <Pressable onPress={stop} style={{
            backgroundColor: c.error, paddingLeft: 16, paddingRight: 16,
            borderRadius: 6, justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 12, color: '#fff' }}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSend} style={{
            backgroundColor: c.primary, paddingLeft: 16, paddingRight: 16,
            borderRadius: 6, justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 12, color: '#fff' }}>Send</Text>
          </Pressable>
        )}
      </Box>
    </Box>
  );
}

// ── Main story ──────────────────────────────────────────

export function AIChatDemoStory() {
  const c = useThemeColors();
  const [provider, setProvider] = useState<AIProviderType>('openai');
  const [model, setModel] = useState('gpt-4');
  const [apiKey, setApiKey] = useState('');
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [browseEnabled, setBrowseEnabled] = useState(false);

  const config: AIConfig = {
    provider,
    model,
    apiKey: apiKey || undefined,
    baseURL: provider === 'custom' ? 'http://localhost:11434' : undefined,
  };

  return (
    <AIProvider config={config}>
      <Box style={{
        width: '100%', height: '100%',
        backgroundColor: c.bg, padding: 16, gap: 12,
      }}>
        {/* Header */}
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
            AI Chat
          </Text>
          <Text style={{ fontSize: 11, color: c.textDim }}>@ilovereact/ai</Text>
        </Box>

        {/* Two-column layout */}
        <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 12 }}>
          {/* Left: Config */}
          <Box style={{ width: 280 }}>
            <ConfigPanel
              provider={provider} setProvider={setProvider}
              model={model} setModel={setModel}
              apiKey={apiKey} setApiKey={setApiKey}
              toolsEnabled={toolsEnabled} setToolsEnabled={setToolsEnabled}
              browseEnabled={browseEnabled} setBrowseEnabled={setBrowseEnabled}
            />

            {/* Usage examples */}
            <Box style={{ marginTop: 12, padding: 10, backgroundColor: c.bgElevated, borderRadius: 8, gap: 6 }}>
              <Text style={{ fontSize: 11, color: c.textDim }}>Quick start:</Text>
              <Text style={{ fontSize: 10, color: c.textSecondary, lineHeight: 16 }}>
                {"const { messages, send } =\n  useChat({ model: 'gpt-4' });"}
              </Text>
              <Text style={{ fontSize: 11, color: c.textDim, marginTop: 6 }}>With tools:</Text>
              <Text style={{ fontSize: 10, color: c.textSecondary, lineHeight: 16 }}>
                {"const { messages, send } =\n  useChat({\n    model: 'gpt-4',\n    tools: [myTool],\n  });"}
              </Text>
              <Text style={{ fontSize: 11, color: c.textDim, marginTop: 6 }}>With browse:</Text>
              <Text style={{ fontSize: 10, color: c.textSecondary, lineHeight: 16 }}>
                {"import { createBrowserTools }\n  from '@ilovereact/ai';\nuseChat({\n  tools: createBrowserTools(),\n});"}
              </Text>
            </Box>
          </Box>

          {/* Right: Chat */}
          <ChatView config={config} toolsEnabled={toolsEnabled} browseEnabled={browseEnabled} />
        </Box>
      </Box>
    </AIProvider>
  );
}
