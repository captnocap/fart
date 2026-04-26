/**
 * useHost — single hook primitive for "this app hosts a server / owns a process."
 *
 * Networking in reactjit is split by **direction**:
 *   - useHost      — I bind a port / I own a process. Server-side. (this file)
 *   - fetch()      — one-shot outbound request. (runtime/hooks/http.ts)
 *   - useConnection — persistent outbound channel. (runtime/hooks/useConnection.ts)
 *
 * Protocol is `kind`. Transport is `via:` (a handle from another useHost or
 * useConnection call) — e.g. expose an HTTP server *as a Tor hidden service*
 * by passing a tor handle as `via`.
 *
 * Today: 'http' | 'ws' | 'process'.
 * `kind: 'game'` (composite of process + tcp/RCON + udp/A2S) is intentionally
 * NOT a primitive — it lives as a thin userspace hook layered over useHost +
 * useConnection. Binary protocols (Valve RCON v2, A2S) require a base64 layer
 * over the current UTF-8 send/recv path; build that before useGameServer.
 *
 * Outbound TCP/UDP/WS clients moved to useConnection. Outbound calls (HTTP)
 * use plain `fetch()`.
 *
 * Usage:
 *   const srv = useHost({
 *     kind: 'http',
 *     port: 8080,
 *     routes: [{ path: '/api', kind: 'handler' }],
 *     onRequest: (req, res) => res.send(200, 'application/json', '{"ok":1}'),
 *   });
 *
 *   const ws = useHost({
 *     kind: 'ws',
 *     port: 8081,
 *     onMessage: (id, data) => ws.broadcast(data),
 *   });
 *
 *   // Expose as a Tor hidden service:
 *   const tor = useConnection({ kind: 'tor' });
 *   const hidden = useHost({ kind: 'http', port: 80, via: tor, routes: [...] });
 *
 * Callbacks are pulled through refs so changing them between renders does
 * NOT restart the server; only `port` / `routes` / `via` changes do.
 */

import { useEffect, useRef, useState } from 'react';
import { callHost, subscribe } from '../ffi';
import type { TransportHandle } from './useConnection';

// ── Spec types ─────────────────────────────────────────────────────

export interface HttpRequest {
  clientId: number;
  method: string;
  path: string;
  body: string;
}

export interface HttpResponder {
  send(status: number, contentType: string, body: string): void;
}

export interface HttpRouteSpec {
  path: string;
  kind?: 'handler' | 'static';
  root?: string; // required when kind: 'static'
}

interface SpecBase {
  /** Expose this server through another transport handle (e.g. tor hidden service). */
  via?: TransportHandle;
}

export interface HttpHostSpec extends SpecBase {
  kind: 'http';
  port: number;
  routes?: HttpRouteSpec[];
  onRequest?: (req: HttpRequest, res: HttpResponder) => void;
}

export interface WsHostSpec extends SpecBase {
  kind: 'ws';
  port: number;
  onOpen?: (clientId: number) => void;
  onMessage?: (clientId: number, data: string) => void;
  onClose?: (clientId: number) => void;
}

export interface ProcessHostSpec extends SpecBase {
  kind: 'process';
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: 'pipe' | 'inherit' | 'ignore';
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onExit?: (res: { code: number; signal: string | null }) => void;
}

export type HostSpec = HttpHostSpec | WsHostSpec | ProcessHostSpec;

// ── Handle types (discriminated by kind) ───────────────────────────

export type HostState = 'starting' | 'running' | 'stopped' | 'error';

interface HandleBase {
  id: number;
  kind: string;
  state: HostState;
  error?: string;
  stop(): void;
}

export interface HttpHostHandle extends HandleBase {
  kind: 'http';
  /** Manual respond — only needed if you ignored the `res` arg in onRequest. */
  respond(clientId: number, status: number, contentType: string, body: string): void;
}

export interface WsHostHandle extends HandleBase {
  kind: 'ws';
  send(clientId: number, data: string): void;
  broadcast(data: string): void;
}

export interface ProcessHostHandle extends HandleBase {
  kind: 'process';
  pid: number;
  /** Write to the child's stdin. No-op if `stdin: 'pipe'` was not requested. */
  stdin(data: string): void;
  /** Close the child's stdin. */
  stdinClose(): void;
  /** Send a signal. Default SIGTERM. */
  kill(signal?: 'SIGTERM' | 'SIGKILL'): void;
}

export type HostHandle = HttpHostHandle | WsHostHandle | ProcessHostHandle;

// ── ID allocator ───────────────────────────────────────────────────

let _idSeq = 1;
const nextId = () => _idSeq++;

const viaJson = (v?: TransportHandle): string =>
  v ? JSON.stringify({ id: v.id, kind: v.kind }) : '';

// ── Hook ───────────────────────────────────────────────────────────

export function useHost(spec: HttpHostSpec): HttpHostHandle;
export function useHost(spec: WsHostSpec): WsHostHandle;
export function useHost(spec: ProcessHostSpec): ProcessHostHandle;
export function useHost(spec: HostSpec): HostHandle {
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = nextId();
  const id = idRef.current;

  const [state, setState] = useState<HostState>('starting');
  const [error, setError] = useState<string | undefined>(undefined);
  // For kind:'process' the "id" we expose is the actual pid (assigned by the
  // host on spawn) — stored in state so the handle re-renders once known.
  const [pid, setPid] = useState<number>(0);
  const pidRef = useRef<number>(0);
  pidRef.current = pid;

  // Callbacks via refs so identity changes don't restart the server.
  const specRef = useRef(spec);
  specRef.current = spec;

  // Routes serialized for dep comparison — restart if shape changes.
  const routesKey = spec.kind === 'http' ? JSON.stringify(spec.routes ?? []) : '';
  // Process spec key — restart if argv/cwd/env changed (callbacks excluded).
  const procKey = spec.kind === 'process'
    ? JSON.stringify({ cmd: spec.cmd, args: spec.args ?? [], cwd: spec.cwd ?? '', env: spec.env ?? {}, stdin: spec.stdin ?? 'pipe' })
    : '';
  const viaKey = spec.via ? `${spec.via.kind}:${spec.via.id}` : '';

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const via = viaJson(spec.via);

    if (spec.kind === 'http') {
      const routes = (specRef.current as HttpHostSpec).routes ?? [];
      callHost<number>('__httpsrv_listen', 0, id, spec.port, JSON.stringify(routes), via);

      unsubs.push(subscribe(`httpsrv:request:${id}`, (raw: any) => {
        if (cancelled) return;
        let req: HttpRequest;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          req = { clientId: obj.clientId, method: obj.method, path: obj.path, body: obj.body };
        } catch { return; }
        const res: HttpResponder = {
          send: (status, contentType, body) =>
            callHost<void>('__httpsrv_respond', undefined as any, id, req.clientId, status, contentType, body),
        };
        const cb = (specRef.current as HttpHostSpec).onRequest;
        if (cb) cb(req, res);
        else res.send(404, 'text/plain', 'no handler');
      }));

      unsubs.push(subscribe(`httpsrv:error:${id}`, (raw: any) => {
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          setError(obj.error ?? 'unknown error');
        } catch { setError('unknown error'); }
        setState('error');
      }));

      // No 'open' event for HTTP — listen() is sync, so flip state right away.
      setState('running');
    } else if (spec.kind === 'ws') {
      callHost<void>('__wssrv_listen', undefined as any, id, spec.port, via);

      unsubs.push(subscribe(`wssrv:open:${id}`, (raw: any) => {
        if (cancelled) return;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          (specRef.current as WsHostSpec).onOpen?.(obj.clientId);
        } catch {}
      }));
      unsubs.push(subscribe(`wssrv:message:${id}`, (raw: any) => {
        if (cancelled) return;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          (specRef.current as WsHostSpec).onMessage?.(obj.clientId, obj.data);
        } catch {}
      }));
      unsubs.push(subscribe(`wssrv:close:${id}`, (raw: any) => {
        if (cancelled) return;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          (specRef.current as WsHostSpec).onClose?.(obj.clientId);
        } catch {}
      }));
      unsubs.push(subscribe(`wssrv:error:${id}`, (raw: any) => {
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          setError(obj.error ?? 'unknown error');
        } catch { setError('unknown error'); }
        setState('error');
      }));

      setState('running');
    } else if (spec.kind === 'process') {
      const s = specRef.current as ProcessHostSpec;
      const specJson = JSON.stringify({
        cmd: s.cmd,
        args: s.args ?? [],
        cwd: s.cwd,
        env: s.env ?? {},
        stdin: s.stdin ?? 'pipe',
      });
      const spawnedPid = callHost<number>('__proc_spawn', 0, specJson);
      if (spawnedPid <= 0) {
        setError('spawn failed');
        setState('error');
      } else {
        setPid(spawnedPid);
        unsubs.push(subscribe(`proc:stdout:${spawnedPid}`, (line: any) => {
          if (cancelled) return;
          (specRef.current as ProcessHostSpec).onStdout?.(typeof line === 'string' ? line : String(line));
        }));
        unsubs.push(subscribe(`proc:stderr:${spawnedPid}`, (line: any) => {
          if (cancelled) return;
          (specRef.current as ProcessHostSpec).onStderr?.(typeof line === 'string' ? line : String(line));
        }));
        unsubs.push(subscribe(`proc:exit:${spawnedPid}`, (raw: any) => {
          if (cancelled) return;
          let res = { code: -1, signal: null as string | null };
          try {
            const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
            res = { code: obj.code ?? -1, signal: obj.signal ?? null };
          } catch {}
          (specRef.current as ProcessHostSpec).onExit?.(res);
          setState('stopped');
        }));
        setState('running');
      }
    }

    return () => {
      cancelled = true;
      for (const u of unsubs) u();
      if (spec.kind === 'http') callHost<void>('__httpsrv_close', undefined as any, id);
      else if (spec.kind === 'ws') callHost<void>('__wssrv_close', undefined as any, id);
      else if (spec.kind === 'process') {
        const livePid = pidRef.current;
        if (livePid > 0) callHost<boolean>('__proc_kill', false, livePid, 'SIGTERM');
      }
      setState('stopped');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.kind, (spec as any).port, routesKey, procKey, viaKey]);

  // Build the kind-specific handle
  if (spec.kind === 'http') {
    return {
      kind: 'http',
      id,
      state,
      error,
      stop: () => callHost<void>('__httpsrv_close', undefined as any, id),
      respond: (clientId, status, contentType, body) =>
        callHost<void>('__httpsrv_respond', undefined as any, id, clientId, status, contentType, body),
    };
  }
  if (spec.kind === 'ws') {
    return {
      kind: 'ws',
      id,
      state,
      error,
      stop: () => callHost<void>('__wssrv_close', undefined as any, id),
      send: (clientId, data) => callHost<void>('__wssrv_send', undefined as any, id, clientId, data),
      broadcast: (data) => callHost<void>('__wssrv_broadcast', undefined as any, id, data),
    };
  }
  // spec.kind === 'process'
  return {
    kind: 'process',
    id: pid,
    pid,
    state,
    error,
    stop: () => { if (pid > 0) callHost<boolean>('__proc_kill', false, pid, 'SIGTERM'); },
    stdin: (data) => { if (pid > 0) callHost<boolean>('__proc_stdin_write', false, pid, data); },
    stdinClose: () => { if (pid > 0) callHost<void>('__proc_stdin_close', undefined as any, pid); },
    kill: (signal = 'SIGTERM') => { if (pid > 0) callHost<boolean>('__proc_kill', false, pid, signal); },
  };
}
