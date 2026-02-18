/**
 * MCPDemo — MCP server integration showcase.
 *
 * Demonstrates:
 * - Configuring an MCP server connection (stdio / SSE / streamable HTTP)
 * - Tool discovery with live server connection
 * - Permission management (enable/disable, confirm toggles)
 * - Token budget estimation per tool and total
 * - Integration with useChat for MCP-powered conversations
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, ScrollView, Pressable, TextInput } from '../../../packages/shared/src';
import { useChat, AIProvider, useMCPServer, estimateToolTokens } from '../../../packages/ai/src';
import type { AIConfig, AIProviderType, MCPServerConfig, MCPPermissionsConfig, MCPToolPermission } from '../../../packages/ai/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Demo-specific colors ────────────────────────────────
const TOOL_BG = '#1c2a1c';

// ── Transport config panel ──────────────────────────────

function TransportConfig({
  transport, setTransport,
  command, setCommand,
  args, setArgs,
  url, setUrl,
}: {
  transport: string; setTransport: (t: string) => void;
  command: string; setCommand: (c: string) => void;
  args: string; setArgs: (a: string) => void;
  url: string; setUrl: (u: string) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>Transport</Text>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {(['stdio', 'sse', 'streamable-http'] as const).map(t => (
          <Pressable key={t} onPress={() => setTransport(t)} style={{
            backgroundColor: transport === t ? c.primary : c.surface,
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
            borderRadius: 4,
          }}>
            <Text style={{ fontSize: 10, color: transport === t ? '#fff' : c.textSecondary }}>{t}</Text>
          </Pressable>
        ))}
      </Box>

      {transport === 'stdio' ? (
        <Box style={{ gap: 6 }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: c.textDim }}>Command</Text>
            <TextInput value={command} onChangeText={setCommand} placeholder="npx"
              style={{ fontSize: 11, color: c.text, backgroundColor: c.bg, padding: 6, borderRadius: 4, width: '100%', height: 28 }} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: c.textDim }}>Args (comma-separated)</Text>
            <TextInput value={args} onChangeText={setArgs} placeholder="-y, @modelcontextprotocol/server-filesystem, /tmp"
              style={{ fontSize: 11, color: c.text, backgroundColor: c.bg, padding: 6, borderRadius: 4, width: '100%', height: 28 }} />
          </Box>
        </Box>
      ) : (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: c.textDim }}>URL</Text>
          <TextInput value={url} onChangeText={setUrl} placeholder="http://localhost:3001/mcp"
            style={{ fontSize: 11, color: c.text, backgroundColor: c.bg, padding: 6, borderRadius: 4, width: '100%', height: 28 }} />
        </Box>
      )}
    </Box>
  );
}

// ── Tool permission row ─────────────────────────────────

function ToolRow({ name, permission, onToggle, onToggleConfirm }: {
  name: string;
  permission: MCPToolPermission;
  onToggle: () => void;
  onToggleConfirm: () => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 6, backgroundColor: permission.enabled ? TOOL_BG : 'transparent',
      borderRadius: 4,
    }}>
      {/* Enable toggle */}
      <Pressable onPress={onToggle} style={{
        width: 16, height: 16, borderRadius: 3,
        backgroundColor: permission.enabled ? c.success : c.surface,
        justifyContent: 'center', alignItems: 'center',
      }}>
        {permission.enabled && <Text style={{ fontSize: 10, color: '#fff' }}>x</Text>}
      </Pressable>

      {/* Tool info */}
      <Box style={{ flexGrow: 1 }}>
        <Text style={{ fontSize: 11, color: permission.enabled ? c.text : c.textSecondary }}>{name}</Text>
        {permission.description && (
          <Text style={{ fontSize: 9, color: c.textDim }}>{permission.description}</Text>
        )}
      </Box>

      {/* Token cost */}
      <Text style={{ fontSize: 9, color: c.textDim }}>
        {`~${permission.tokenEstimate || 0} tok`}
      </Text>

      {/* Confirm toggle */}
      <Pressable onPress={onToggleConfirm} style={{
        paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
        borderRadius: 3,
        backgroundColor: permission.confirm ? c.warning : c.surface,
      }}>
        <Text style={{ fontSize: 9, color: permission.confirm ? '#000' : c.textDim }}>
          {permission.confirm ? 'confirm' : 'auto'}
        </Text>
      </Pressable>
    </Box>
  );
}

// ── Token budget display ────────────────────────────────

function TokenBudget({ permissions }: { permissions: MCPPermissionsConfig }) {
  const c = useThemeColors();
  const enabled = Object.entries(permissions.tools).filter(([, p]) => p.enabled);
  const totalTokens = enabled.reduce((sum, [, p]) => sum + (p.tokenEstimate || 0), 0);
  const pct = ((totalTokens / 128000) * 100).toFixed(1);
  const allTokens = permissions.tokenBudget?.totalIfAllEnabled || 0;

  return (
    <Box style={{ padding: 8, backgroundColor: c.surface, borderRadius: 4, gap: 4 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>
          {`${enabled.length} tool${enabled.length !== 1 ? 's' : ''} enabled`}
        </Text>
        <Text style={{ fontSize: 10, color: totalTokens > 0 ? c.primary : c.textDim }}>
          {`~${totalTokens} tokens (${pct}%)`}
        </Text>
      </Box>
      {/* Budget bar */}
      <Box style={{ width: '100%', height: 4, backgroundColor: c.bg, borderRadius: 2 }}>
        <Box style={{
          width: `${Math.min((totalTokens / Math.max(allTokens, 1)) * 100, 100)}%`,
          height: 4, backgroundColor: c.primary, borderRadius: 2,
        }} />
      </Box>
    </Box>
  );
}

// ── Main story ──────────────────────────────────────────

export function MCPDemoStory() {
  const c = useThemeColors();
  // Transport config
  const [transport, setTransport] = useState('stdio');
  const [command, setCommand] = useState('npx');
  const [args, setArgs] = useState('-y, @modelcontextprotocol/server-filesystem, /tmp');
  const [url, setUrl] = useState('http://localhost:3001/mcp');
  const [serverName, setServerName] = useState('filesystem');
  const [connected, setConnected] = useState(false);

  // AI config
  const [provider, setProvider] = useState<AIProviderType>('openai');
  const [model, setModel] = useState('gpt-4');
  const [apiKey, setApiKey] = useState('');

  // Permissions state (simulated — in real use this comes from mcp.tools.json)
  const [permissions, setPermissions] = useState<MCPPermissionsConfig>({
    tools: {},
    tokenBudget: { totalIfAllEnabled: 0, note: '' },
  });

  // Build MCP config
  const mcpConfig: MCPServerConfig | null = useMemo(() => {
    if (!connected) return null;
    const parsedArgs = args.split(',').map(s => s.trim()).filter(Boolean);
    return {
      name: serverName,
      transport: transport as any,
      command: transport === 'stdio' ? command : undefined,
      args: transport === 'stdio' ? parsedArgs : undefined,
      url: transport !== 'stdio' ? url : undefined,
      timeout: 30000,
      permissions: Object.keys(permissions.tools).length > 0 ? permissions : undefined,
    };
  }, [connected, transport, command, args, url, serverName, permissions]);

  // Connect to MCP server
  // ilr-ignore-next-line
  const mcp = useMCPServer(mcpConfig || {
    name: '_disconnected',
    transport: 'stdio',
    command: 'echo',
  });

  // When server is ready and we have no permissions yet, build initial permission set
  const prevAvailable = React.useRef<string[]>([]);
  React.useEffect(() => {
    if (mcp.status === 'ready' && mcp.availableTools.length > 0) {
      const toolNames = mcp.availableTools;
      if (JSON.stringify(toolNames) !== JSON.stringify(prevAvailable.current)) {
        prevAvailable.current = toolNames;
        // Auto-populate permissions (all disabled) if we don't have them
        if (Object.keys(permissions.tools).length === 0) {
          const tools: Record<string, MCPToolPermission> = {};
          let totalTokens = 0;
          for (const name of toolNames) {
            const estimate = 150; // rough default
            tools[name] = { enabled: false, confirm: false, description: '', tokenEstimate: estimate };
            totalTokens += estimate;
          }
          const pct = ((totalTokens / 128000) * 100).toFixed(1);
          setPermissions({
            tools,
            tokenBudget: { totalIfAllEnabled: totalTokens, note: `~${pct}% of 128K context` },
          });
        }
      }
    }
  }, [mcp.status, mcp.availableTools]);

  // Toggle tool enabled
  const toggleTool = useCallback((name: string) => {
    setPermissions(prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [name]: { ...prev.tools[name], enabled: !prev.tools[name].enabled },
      },
    }));
  }, []);

  // Toggle tool confirm
  const toggleConfirm = useCallback((name: string) => {
    setPermissions(prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [name]: { ...prev.tools[name], confirm: !prev.tools[name].confirm },
      },
    }));
  }, []);

  // Chat
  const aiConfig: AIConfig = { provider, model, apiKey: apiKey || undefined };
  const [chatInput, setChatInput] = useState('');
  const chat = useChat({
    ...aiConfig,
    tools: mcp.tools.length > 0 ? mcp.tools : undefined,
    maxToolRounds: 5,
  });

  const handleSend = useCallback(() => {
    const text = chatInput.trim();
    if (!text || chat.isLoading) return;
    setChatInput('');
    chat.send(text);
  }, [chatInput, chat]);

  return (
    <AIProvider config={aiConfig}>
      <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
        {/* Header */}
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>MCP Integration</Text>
          <Text style={{ fontSize: 11, color: c.textDim }}>@ilovereact/ai</Text>
          <Box style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3,
            backgroundColor: mcp.status === 'ready' ? c.success
              : mcp.status === 'error' ? c.error : c.warning,
          }}>
            <Text style={{ fontSize: 9, color: '#fff' }}>{connected ? mcp.status : 'disconnected'}</Text>
          </Box>
        </Box>

        {/* Two-column layout */}
        <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 12 }}>
          {/* Left: Config */}
          <Box style={{ width: 300, gap: 10 }}>
            {/* Server config */}
            <Box style={{ padding: 10, backgroundColor: c.bgElevated, borderRadius: 8, gap: 8 }}>
              <TransportConfig
                transport={transport} setTransport={setTransport}
                command={command} setCommand={setCommand}
                args={args} setArgs={setArgs}
                url={url} setUrl={setUrl}
              />

              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, color: c.textDim }}>Server Name</Text>
                <TextInput value={serverName} onChangeText={setServerName} placeholder="my-server"
                  style={{ fontSize: 11, color: c.text, backgroundColor: c.bg, padding: 6, borderRadius: 4, width: '100%', height: 28 }} />
              </Box>

              <Pressable onPress={() => setConnected(!connected)} style={{
                backgroundColor: connected ? c.error : c.success,
                padding: 8, borderRadius: 4, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 12, color: '#fff' }}>{connected ? 'Disconnect' : 'Connect'}</Text>
              </Pressable>
            </Box>

            {/* Tool permissions */}
            {Object.keys(permissions.tools).length > 0 && (
              <Box style={{ padding: 10, backgroundColor: c.bgElevated, borderRadius: 8, gap: 6 }}>
                <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>Tool Permissions</Text>
                <ScrollView style={{ maxHeight: 250 }}>
                  {Object.entries(permissions.tools).map(([name, perm]) => (
                    <ToolRow key={name} name={name} permission={perm}
                      onToggle={() => toggleTool(name)}
                      onToggleConfirm={() => toggleConfirm(name)} />
                  ))}
                </ScrollView>
                <TokenBudget permissions={permissions} />
              </Box>
            )}

            {/* AI config */}
            <Box style={{ padding: 10, backgroundColor: c.bgElevated, borderRadius: 8, gap: 6 }}>
              <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>AI Config</Text>
              <Box style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => { setProvider('openai'); setModel('gpt-4'); }} style={{
                  backgroundColor: provider === 'openai' ? c.primary : c.surface,
                  paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 10, color: provider === 'openai' ? '#fff' : c.textSecondary }}>OpenAI</Text>
                </Pressable>
                <Pressable onPress={() => { setProvider('anthropic'); setModel('claude-sonnet-4-5-20250929'); }} style={{
                  backgroundColor: provider === 'anthropic' ? c.primary : c.surface,
                  paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 10, color: provider === 'anthropic' ? '#fff' : c.textSecondary }}>Anthropic</Text>
                </Pressable>
              </Box>
              <TextInput value={apiKey} onChangeText={setApiKey} placeholder="API Key..."
                style={{ fontSize: 11, color: c.text, backgroundColor: c.bg, padding: 6, borderRadius: 4, width: '100%', height: 28 }} />
            </Box>

            {/* Code example */}
            <Box style={{ padding: 10, backgroundColor: c.bgElevated, borderRadius: 8, gap: 4 }}>
              <Text style={{ fontSize: 10, color: c.textDim }}>Usage:</Text>
              <Text style={{ fontSize: 9, color: c.textSecondary, lineHeight: 14 }}>
                {"import config from\n  '../mcp.tools.json';\n\nconst mcp = useMCPServer({\n  name: 'filesystem',\n  transport: 'stdio',\n  command: 'npx',\n  args: ['-y', '...'],\n  permissions:\n    config.filesystem,\n});\n\nuseChat({\n  tools: mcp.tools,\n});"}
              </Text>
            </Box>
          </Box>

          {/* Right: Chat */}
          <Box style={{ flexGrow: 1, gap: 8 }}>
            <ScrollView style={{ flexGrow: 1, backgroundColor: c.bgElevated, borderRadius: 8, padding: 10 }}>
              {chat.messages.length === 0 && (
                <Box style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: c.textDim }}>
                    {!connected ? 'Connect to an MCP server to get started'
                      : mcp.tools.length === 0 ? 'Enable some tools in the permissions panel'
                      : !apiKey ? 'Enter an API key to start chatting with MCP tools'
                      : 'Send a message to use MCP tools'}
                  </Text>
                  {mcp.tools.length > 0 && (
                    <Text style={{ fontSize: 11, color: c.success, marginTop: 8 }}>
                      {`${mcp.tools.length} MCP tool${mcp.tools.length !== 1 ? 's' : ''} active`}
                    </Text>
                  )}
                </Box>
              )}
              {chat.messages.map((msg, i) => (
                <Box key={i} style={{
                  backgroundColor: msg.role === 'user' ? '#1e3a5f'
                    : msg.role === 'tool' ? TOOL_BG : '#1a2332',
                  // Demo-specific chat bubble colors kept hardcoded
                  padding: 8, borderRadius: 6, marginBottom: 4,
                }}>
                  <Text style={{ fontSize: 9, color: c.textDim, marginBottom: 2 }}>
                    {msg.role === 'user' ? 'You' : msg.role === 'tool' ? 'Tool Result' : 'Assistant'}
                  </Text>
                  <Text style={{ fontSize: 12, color: c.text, lineHeight: 18 }}>
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                  </Text>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <Box style={{ marginTop: 4, padding: 4, backgroundColor: c.surface, borderRadius: 3 }}>
                      <Text style={{ fontSize: 9, color: c.textSecondary }}>
                        {`Tool calls: ${msg.toolCalls.map(tc => tc.name).join(', ')}`}
                      </Text>
                    </Box>
                  )}
                </Box>
              ))}
              {chat.isStreaming && (
                <Text style={{ fontSize: 10, color: c.primary, padding: 4 }}>Streaming...</Text>
              )}
            </ScrollView>

            {chat.error && (
              <Box style={{ padding: 6, backgroundColor: '#2d1b1b', borderRadius: 4 }}>
                <Text style={{ fontSize: 10, color: c.error }}>{chat.error.message}</Text>
              </Box>
            )}

            {mcp.error && (
              <Box style={{ padding: 6, backgroundColor: '#2d1b1b', borderRadius: 4 }}>
                <Text style={{ fontSize: 10, color: c.error }}>{`MCP: ${mcp.error.message}`}</Text>
              </Box>
            )}

            <Box style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={chatInput} onChangeText={setChatInput} onSubmitEditing={handleSend}
                placeholder="Type a message..."
                style={{ flexGrow: 1, fontSize: 12, color: c.text, backgroundColor: c.bgElevated, padding: 8, borderRadius: 6, height: 36 }} />
              <Pressable onPress={chat.isLoading ? chat.stop : handleSend} style={{
                backgroundColor: chat.isLoading ? c.error : c.primary,
                paddingLeft: 14, paddingRight: 14, borderRadius: 6, justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11, color: '#fff' }}>{chat.isLoading ? 'Stop' : 'Send'}</Text>
              </Pressable>
            </Box>
          </Box>
        </Box>
      </Box>
    </AIProvider>
  );
}
