import type { AIConfig, Message, StreamDelta, ToolCall, ToolDefinition } from './types';
import { getProvider } from './providers';

// SSE streaming + incremental delta accumulation. Caller hands in a
// config + messages; gets back an async iterator of StreamDelta plus a
// final assembled assistant Message.
//
// Abort via the returned `stop()` — wired to an AbortController so the
// fetch body is cancelled at the socket level.

export type StreamHandle = {
  stop: () => void;
  done: Promise<Message>;
};

// Parse an SSE text chunk into (event, data) pairs. Events may span
// multiple lines (`event: X\ndata: Y\n\n`); we buffer whatever doesn't
// end with a blank line for the next chunk.
function parseSSE(buffer: string): { events: Array<{ event?: string; data: string }>; rest: string } {
  const events: Array<{ event?: string; data: string }> = [];
  const chunks = buffer.split('\n\n');
  const rest = chunks.pop() || '';
  for (const chunk of chunks) {
    let event: string | undefined;
    const dataLines: string[] = [];
    for (const raw of chunk.split('\n')) {
      const line = raw.trimEnd();
      if (!line) continue;
      if (line.startsWith(':')) continue; // comment
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: dataLines.join('\n') });
  }
  return { events, rest };
}

function mergeToolCallDelta(acc: ToolCall[], deltas: Partial<ToolCall>[]): ToolCall[] {
  const out = acc.slice();
  for (const d of deltas) {
    // Match by id when present, otherwise append to the most recent.
    let idx = d.id ? out.findIndex((t) => t.id === d.id) : -1;
    if (idx < 0 && !d.id && out.length > 0) idx = out.length - 1;
    if (idx < 0) {
      out.push({ id: d.id || ('tc_' + out.length), name: d.name || '', arguments: d.arguments || '' });
    } else {
      const cur = out[idx];
      if (d.name) cur.name = d.name;
      if (d.arguments) cur.arguments = (cur.arguments || '') + d.arguments;
      if (d.id) cur.id = d.id;
    }
  }
  return out;
}

export function streamChat(
  config: AIConfig,
  messages: Message[],
  opts: {
    tools?: ToolDefinition[];
    onDelta?: (delta: StreamDelta) => void;
  },
): StreamHandle {
  const controller = new AbortController();
  const provider = getProvider(config.provider);
  const req = provider.formatRequest(messages, config, opts.tools, true);

  let resolve!: (m: Message) => void;
  let reject!: (e: any) => void;
  const done = new Promise<Message>((res, rej) => { resolve = res; reject = rej; });

  (async () => {
    try {
      const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: controller.signal });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error('stream HTTP ' + res.status + ' ' + text.slice(0, 200));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let accumulatedCalls: ToolCall[] = [];

      while (true) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSSE(buffer);
        buffer = rest;
        for (const ev of events) {
          const delta = provider.parseStreamChunk(ev.data, ev.event);
          if (!delta) continue;
          if (delta.content) accumulatedText += delta.content;
          if (delta.toolCalls) accumulatedCalls = mergeToolCallDelta(accumulatedCalls, delta.toolCalls);
          if (opts.onDelta) opts.onDelta(delta);
          if (delta.done) break;
        }
      }

      const finalMsg: Message = { role: 'assistant', content: accumulatedText };
      if (accumulatedCalls.length) finalMsg.toolCalls = accumulatedCalls;
      resolve(finalMsg);
    } catch (err) {
      reject(err);
    }
  })();

  return {
    stop: () => controller.abort(),
    done,
  };
}
