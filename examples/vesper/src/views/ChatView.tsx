/**
 * ChatView — Main conversation screen.
 *
 * ScrollView of messages + InputHub at the bottom.
 * Empty state with Vesper branding when no messages.
 */

import React from 'react';
import { Box, Text, ScrollView } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { useClipboard } from '@reactjit/core';
import { V } from '../theme';
import { InputHub } from '../layout/InputHub';
import { MessageItem } from '../components/MessageItem';
import type { Message, ModelInfo } from '@reactjit/ai';
import type { ProviderConfig } from '../types';

// ── Empty State ──────────────────────────────────────────

function EmptyState() {
  return (
    <Box style={{
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    }}>
      <Text style={{
        fontSize: 32,
        fontWeight: '700',
        color: V.accent,
      }}>
        Vesper
      </Text>
      <Text style={{
        fontSize: 14,
        color: V.textDim,
      }}>
        What would you like to explore?
      </Text>
      <Box style={{ gap: 6, paddingTop: 16 }}>
        {[
          'Write a story about a forgotten library',
          'Explain quantum entanglement simply',
          'Debug this function for me',
          'Help me design an API',
        ].map((suggestion, i) => (
          <Box key={i} style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: V.borderSubtle,
            backgroundColor: V.bgAlt,
          }}>
            <Text style={{ fontSize: 13, color: V.textSecondary }}>
              {suggestion}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── ChatView ─────────────────────────────────────────────

export interface ChatViewProps {
  messages: Message[];
  send: (content: string) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  stop: () => void;
  provider: ProviderConfig;
  model: string;
  models: ModelInfo[];
  onSelectModel: (id: string) => void;
  tokenEstimate: number;
  onDeleteMessage?: (index: number) => void;
  onRegenerateMessage?: (index: number) => void;
  onEditMessage?: (index: number, content: string) => void;
}

export function ChatView({
  messages,
  send,
  isLoading,
  isStreaming,
  stop,
  provider,
  model,
  models,
  onSelectModel,
  tokenEstimate,
  onDeleteMessage,
  onRegenerateMessage,
  onEditMessage,
}: ChatViewProps) {
  const { copy } = useClipboard();
  const hasMessages = messages.filter(m => m.role !== 'system').length > 0;

  return (
    <Box style={{ flexGrow: 1, width: '100%', flexDirection: 'column' }}>
      {/* Message area */}
      {hasMessages ? (
        <ScrollView style={{
          flexGrow: 1,
          width: '100%',
        }}>
          <Box style={{
            width: '100%',
            gap: 4,
            paddingTop: 12,
            paddingBottom: 12,
          }}>
            {messages.map((msg, i) => (
              <MessageItem
                key={i}
                message={msg}
                index={i}
                onCopy={(text) => copy(text)}
                onDelete={onDeleteMessage}
                onRegenerate={onRegenerateMessage}
                onEdit={onEditMessage}
              />
            ))}

            {/* Streaming indicator */}
            {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
              <Box style={{
                paddingLeft: 32,
                paddingTop: 8,
                paddingBottom: 8,
              }}>
                <Text style={{ fontSize: 13, color: V.assistant }}>
                  Vesper is thinking...
                </Text>
              </Box>
            )}
          </Box>
        </ScrollView>
      ) : (
        <EmptyState />
      )}

      {/* Input hub */}
      <InputHub
        provider={provider}
        model={model}
        models={models}
        onSelectModel={onSelectModel}
        send={send}
        isLoading={isLoading}
        isStreaming={isStreaming}
        onStop={stop}
        tokenEstimate={tokenEstimate}
      />
    </Box>
  );
}
