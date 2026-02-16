/**
 * React hooks for the @ilovereact/audio module system.
 *
 * These hooks communicate with the Lua audio engine via the bridge
 * (useLoveRPC for commands, useLoveEvent for state updates).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent } from '@ilovereact/core';
import type {
  RackState,
  ModuleState,
  Connection,
  MIDIDevice,
  MIDIMapping,
  MIDINoteEvent,
  MIDICCEvent,
  UseModuleResult,
  UseRackResult,
  UseMIDIResult,
} from './types';

// ============================================================================
// useRack — rack-level operations and state
// ============================================================================

/**
 * Access the full audio rack: modules, connections, and operations.
 *
 * @example
 * const rack = useRack();
 * rack.addModule('oscillator', 'osc1', { waveform: 'saw' });
 * rack.connect('osc1', 'audio_out', 'mixer1', 'input_1');
 */
export function useRack(): UseRackResult {
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  const addModuleRpc = useLoveRPC('audio:addModule');
  const removeModuleRpc = useLoveRPC('audio:removeModule');
  const connectRpc = useLoveRPC('audio:connect');
  const disconnectRpc = useLoveRPC('audio:disconnect');

  useLoveEvent('audio:state', (state: RackState) => {
    setModules(state.modules);
    setConnections(state.connections);
  });

  const addModule = useCallback(
    (type: string, id: string, params?: Record<string, any>) =>
      addModuleRpc({ type, id, params }),
    [addModuleRpc]
  );

  const removeModule = useCallback(
    (id: string) => removeModuleRpc({ id }),
    [removeModuleRpc]
  );

  const connect = useCallback(
    (fromId: string, fromPort: string, toId: string, toPort: string) =>
      connectRpc({ fromId, fromPort, toId, toPort }),
    [connectRpc]
  );

  const disconnect = useCallback(
    (fromId: string, fromPort: string, toId: string, toPort: string) =>
      disconnectRpc({ fromId, fromPort, toId, toPort }),
    [disconnectRpc]
  );

  return { modules, connections, addModule, removeModule, connect, disconnect };
}

// ============================================================================
// useModule — single module params and control
// ============================================================================

/**
 * Access a specific module's params and set them.
 *
 * @example
 * const osc = useModule('osc1');
 * osc.params.waveform  // "saw"
 * osc.setParam('waveform', 'sine');
 */
export function useModule(moduleId: string): UseModuleResult {
  const [state, setState] = useState<ModuleState>({
    id: moduleId,
    type: '',
    params: {},
    ports: {},
  });

  const setParamRpc = useLoveRPC('audio:setParam');

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = rackState.modules.find((m) => m.id === moduleId);
    if (mod) {
      setState(mod);
    }
  });

  const setParam = useCallback(
    (name: string, value: any) =>
      setParamRpc({ moduleId, param: name, value }),
    [setParamRpc, moduleId]
  );

  return {
    id: state.id,
    type: state.type,
    params: state.params,
    ports: state.ports,
    activeNotes: state.activeNotes,
    setParam,
  };
}

// ============================================================================
// useParam — single parameter read/write
// ============================================================================

/**
 * Read and write a single parameter on a module.
 *
 * @example
 * const [cutoff, setCutoff] = useParam('filt1', 'cutoff');
 * setCutoff(800);
 */
export function useParam(
  moduleId: string,
  paramName: string
): [any, (value: any) => Promise<any>] {
  const [value, setValue] = useState<any>(null);
  const setParamRpc = useLoveRPC('audio:setParam');

  useLoveEvent('audio:state', (rackState: RackState) => {
    const mod = rackState.modules.find((m) => m.id === moduleId);
    if (mod && mod.params[paramName] !== undefined) {
      setValue(mod.params[paramName]);
    }
  });

  const setParam = useCallback(
    (newValue: any) => {
      setValue(newValue); // optimistic update
      return setParamRpc({ moduleId, param: paramName, value: newValue });
    },
    [setParamRpc, moduleId, paramName]
  );

  return [value, setParam];
}

// ============================================================================
// useMIDI — MIDI devices, mappings, and learn mode
// ============================================================================

/**
 * Access MIDI state: devices, CC mappings, and learn mode.
 *
 * @example
 * const midi = useMIDI();
 * midi.learn('filt1', 'cutoff');  // next CC maps to this param
 * midi.devices  // [{ id: '20:0', name: 'Arturia MiniLab', connected: true }]
 */
export function useMIDI(): UseMIDIResult {
  const [available, setAvailable] = useState(false);
  const [devices, setDevices] = useState<MIDIDevice[]>([]);
  const [mappings, setMappings] = useState<MIDIMapping[]>([]);
  const [learning, setLearning] = useState<{ moduleId: string; param: string } | null>(null);

  const learnRpc = useLoveRPC('audio:midiLearn');
  const mapRpc = useLoveRPC('audio:midiMap');
  const unmapRpc = useLoveRPC('audio:midiUnmap');

  useLoveEvent('audio:state', (rackState: RackState) => {
    if (rackState.midi) {
      setAvailable(rackState.midi.available);
      setDevices(rackState.midi.devices);
      setMappings(rackState.midi.mappings);
      setLearning(rackState.midi.learning);
    }
  });

  const learn = useCallback(
    (moduleId: string, param: string) => learnRpc({ moduleId, param }),
    [learnRpc]
  );

  const map = useCallback(
    (moduleId: string, param: string, channel: number, cc: number) =>
      mapRpc({ moduleId, param, channel, cc }),
    [mapRpc]
  );

  const unmap = useCallback(
    (moduleId: string, param: string) => unmapRpc({ moduleId, param }),
    [unmapRpc]
  );

  return { available, devices, mappings, learning, learn, map, unmap };
}

// ============================================================================
// useMIDINote — subscribe to MIDI note events
// ============================================================================

/**
 * Subscribe to MIDI note on/off events.
 *
 * @example
 * useMIDINote((event) => {
 *   console.log(event.on ? 'Note ON' : 'Note OFF', event.note, event.velocity);
 * });
 */
export function useMIDINote(handler: (event: MIDINoteEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useLoveEvent('midi:note', (payload: MIDINoteEvent) => {
    handlerRef.current(payload);
  });
}

// ============================================================================
// useMIDICC — subscribe to MIDI CC events
// ============================================================================

/**
 * Subscribe to MIDI CC events.
 *
 * @example
 * useMIDICC((event) => {
 *   console.log('CC', event.cc, '=', event.value);
 * });
 */
export function useMIDICC(handler: (event: MIDICCEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useLoveEvent('midi:cc', (payload: MIDICCEvent) => {
    handlerRef.current(payload);
  });
}

// ============================================================================
// useAudioInit — initialize the audio engine
// ============================================================================

/**
 * Initialize the audio engine. Call once at app startup.
 * Returns a boolean indicating if the engine is ready.
 *
 * @example
 * const audioReady = useAudioInit();
 */
export function useAudioInit(): boolean {
  const [ready, setReady] = useState(false);
  const initRpc = useLoveRPC('audio:init');

  useEffect(() => {
    let cancelled = false;
    initRpc({}).then(() => {
      if (!cancelled) setReady(true);
    }).catch(() => {
      // Audio not available — still set ready so UI renders
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [initRpc]);

  return ready;
}
