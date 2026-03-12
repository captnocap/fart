/**
 * React hooks for game server management.
 *
 * All state lives in Lua — these hooks poll via RPC and dispatch commands.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent } from '@reactjit/core';
import type {
  ServerState,
  ServerStatus,
  Player,
  ServerLog,
  UseGameServerResult,
  UsePlayerListResult,
  UseServerStatusResult,
  UseServerLogsResult,
} from './types';

// ============================================================================
// useGameServer — full server management
// ============================================================================

/**
 * Full game server lifecycle + status + RCON control.
 *
 * Polls server status every 2.3s and logs every 1.7s (staggered intervals).
 *
 * @example
 * const server = useGameServer();
 * server.rcon('sv_maxrate 128');
 * server.kick('griefer123', 'no griefing');
 * server.changeMap('de_inferno');
 */
export function useGameServer(): UseGameServerResult {
  const [state, setState] = useState<ServerState>('stopped');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [maps, setMaps] = useState<string[]>([]);

  const statusRpc = useLoveRPC('gameserver:status');
  const playersRpc = useLoveRPC('gameserver:players');
  const logsRpc = useLoveRPC('gameserver:logs');
  const rconRpc = useLoveRPC('gameserver:rcon');
  const controlRpc = useLoveRPC('gameserver:control');
  const mapsRpc = useLoveRPC('gameserver:maps');

  const statusRpcRef = useRef(statusRpc);
  const playersRpcRef = useRef(playersRpc);
  const logsRpcRef = useRef(logsRpc);
  const mapsRpcRef = useRef(mapsRpc);
  statusRpcRef.current = statusRpc;
  playersRpcRef.current = playersRpc;
  logsRpcRef.current = logsRpc;
  mapsRpcRef.current = mapsRpc;

  // Track state for adaptive polling — active states poll faster
  const stateRef = useRef(state);
  stateRef.current = state;

  // rjit-ignore-next-line
  // Poll status — adaptive: 500ms during active states, 2300ms when idle
  useEffect(() => { // rjit-ignore-next-line
    let id: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await statusRpcRef.current({});
        if (res) {
          setState(res.state || 'stopped');
          if (res.status) setStatus(res.status);
        }
      } catch (_) {}
      const active = stateRef.current === 'installing' || stateRef.current === 'starting' || stateRef.current === 'stopping';
      id = setTimeout(poll, active ? 500 : 2300);
    };
    id = setTimeout(poll, 500);
    return () => clearTimeout(id);
  }, []);

  // rjit-ignore-next-line
  // Poll players (3100ms — staggered)
  useEffect(() => { // rjit-ignore-next-line
    const id = setInterval(async () => {
      try {
        const res = await playersRpcRef.current({});
        if (res && res.players) setPlayers(res.players);
      } catch (_) {}
    }, 3100);
    return () => clearInterval(id);
  }, []);

  // rjit-ignore-next-line
  // Poll maps (10s — only needs to run once after install, then rarely)
  useEffect(() => { // rjit-ignore-next-line
    const id = setInterval(async () => {
      try {
        const res = await mapsRpcRef.current({});
        if (res && res.maps && res.maps.length > 0) setMaps(res.maps);
      } catch (_) {}
    }, 10000);
    // Also poll immediately on mount
    (async () => {
      try {
        const res = await mapsRpcRef.current({});
        if (res && res.maps) setMaps(res.maps);
      } catch (_) {}
    })();
    return () => clearInterval(id);
  }, []);

  // rjit-ignore-next-line
  // Poll logs — adaptive: 300ms during active states, 1700ms when idle
  useEffect(() => { // rjit-ignore-next-line
    let id: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await logsRpcRef.current({});
        if (res && res.logs) setLogs(res.logs);
      } catch (_) {}
      const active = stateRef.current === 'installing' || stateRef.current === 'starting' || stateRef.current === 'stopping';
      id = setTimeout(poll, active ? 300 : 1700);
    };
    id = setTimeout(poll, 300);
    return () => clearTimeout(id);
  }, []);

  // Apply immediate state from control responses (no waiting for next poll)
  const applySnapshot = useCallback((res: any) => {
    if (!res) return;
    if (res.state) setState(res.state);
    if (res.status) setStatus(res.status);
    if (res.logs) setLogs(res.logs);
  }, []);

  const rcon = useCallback((command: string) => {
    rconRpc({ command });
  }, [rconRpc]);

  const start = useCallback(async () => {
    setState('starting');
    try {
      const res = await controlRpc({ action: 'start' });
      applySnapshot(res);
    } catch (_) {}
  }, [controlRpc, applySnapshot]);

  const stop = useCallback(async () => {
    setState('stopping');
    try {
      const res = await controlRpc({ action: 'stop' });
      applySnapshot(res);
    } catch (_) {}
  }, [controlRpc, applySnapshot]);

  const install = useCallback(async () => {
    setState('installing');
    try {
      const res = await controlRpc({ action: 'install' });
      applySnapshot(res);
    } catch (_) {}
  }, [controlRpc, applySnapshot]);

  const kick = useCallback((playerName: string, reason?: string) => {
    rconRpc({ command: `kick "${playerName}" ${reason || ''}`.trim() });
  }, [rconRpc]);

  const ban = useCallback((playerName: string, reason?: string) => {
    rconRpc({ command: `ban "${playerName}" ${reason || ''}`.trim() });
  }, [rconRpc]);

  const changeMap = useCallback((map: string) => {
    rconRpc({ command: `changelevel ${map}` });
  }, [rconRpc]);

  const say = useCallback((message: string) => {
    rconRpc({ command: `say ${message}` });
  }, [rconRpc]);

  return { state, status, players, logs, maps, rcon, start, stop, install, kick, ban, changeMap, say };
}

// ============================================================================
// usePlayerList — just the player list
// ============================================================================

/**
 * Poll just the player list for a running game server.
 *
 * @example
 * const { players, count, maxPlayers } = usePlayerList();
 */
export function usePlayerList(): UsePlayerListResult {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const playersRpc = useLoveRPC('gameserver:players');
  const playersRpcRef = useRef(playersRpc);
  playersRpcRef.current = playersRpc;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await playersRpcRef.current({});
        if (res) {
          if (res.players) setPlayers(res.players);
          if (res.maxPlayers) setMaxPlayers(res.maxPlayers);
        }
      } catch (_) {}
    }, 2700);
    return () => clearInterval(id);
  }, []);

  return { players, count: players.length, maxPlayers };
}

// ============================================================================
// useServerStatus — just the server status
// ============================================================================

/**
 * Poll just the server status.
 *
 * @example
 * const { online, playerCount, map } = useServerStatus();
 */
export function useServerStatus(): UseServerStatusResult {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const statusRpc = useLoveRPC('gameserver:status');
  const statusRpcRef = useRef(statusRpc);
  statusRpcRef.current = statusRpc;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await statusRpcRef.current({});
        if (res && res.status) setStatus(res.status);
      } catch (_) {}
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return {
    status,
    online: status?.online ?? false,
    playerCount: status?.players ?? 0,
    map: status?.map ?? null,
  };
}

// ============================================================================
// useServerLogs — just the logs
// ============================================================================

/**
 * Poll server logs.
 *
 * @example
 * const { logs, clear } = useServerLogs();
 */
export function useServerLogs(): UseServerLogsResult {
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const logsRpc = useLoveRPC('gameserver:logs');
  const controlRpc = useLoveRPC('gameserver:control');
  const logsRpcRef = useRef(logsRpc);
  logsRpcRef.current = logsRpc;

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await logsRpcRef.current({});
        if (res && res.logs) setLogs(res.logs);
      } catch (_) {}
    }, 1900);
    return () => clearInterval(id);
  }, []);

  const clear = useCallback(() => {
    controlRpc({ action: 'clear_logs' });
    setLogs([]);
  }, [controlRpc]);

  return { logs, clear };
}
