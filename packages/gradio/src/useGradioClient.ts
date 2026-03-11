/**
 * useGradioClient — Hook that manages communication with a Gradio server.
 *
 * Fetches /config on mount, manages component state, and handles predict calls.
 * All HTTP goes through the bridge (Lua http.lua) for non-blocking IO.
 */

import { useState, useCallback, useRef } from 'react';
import { useMount, useLoveEvent } from '@reactjit/core';
import type {
  GradioConfig,
  GradioComponentState,
  GradioDependency,
} from './types';

interface GradioClientState {
  config: GradioConfig | null;
  components: Map<number, GradioComponentState>;
  loading: boolean;
  error: string | null;
  predicting: Set<number>;
}

interface GradioClient {
  config: GradioConfig | null;
  components: Map<number, GradioComponentState>;
  loading: boolean;
  error: string | null;
  /** Update a component's value locally (user input) */
  setValue: (id: number, value: any) => void;
  /** Trigger a dependency (e.g. button click → predict) */
  trigger: (componentId: number, eventName: string) => void;
  /** Check if a specific fn_index is currently predicting */
  isPredicting: (fnIndex: number) => boolean;
}

function generateSessionHash(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 12; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function useGradioClient(
  url: string,
  options?: {
    apiKey?: string;
    sessionHash?: string;
    onConfigLoaded?: (config: GradioConfig) => void;
    onPrediction?: (fnIndex: number, data: any[]) => void;
  },
): GradioClient {
  const [state, setState] = useState<GradioClientState>({
    config: null,
    components: new Map(),
    loading: true,
    error: null,
    predicting: new Set(),
  });

  const sessionHash = useRef(options?.sessionHash ?? generateSessionHash());
  const urlRef = useRef(url);
  urlRef.current = url;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Initialize component states from config ───────────

  const initComponentStates = useCallback((config: GradioConfig) => {
    const components = new Map<number, GradioComponentState>();
    for (const comp of config.components) {
      components.set(comp.id, {
        id: comp.id,
        type: comp.type,
        value: comp.props.value ?? null,
        props: comp.props,
        loading: false,
        error: null,
      });
    }
    return components;
  }, []);

  // ── Fetch config on mount ─────────────────────────────

  useMount(() => {
    const baseUrl = urlRef.current.replace(/\/$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (optionsRef.current?.apiKey) {
      headers['Authorization'] = `Bearer ${optionsRef.current.apiKey}`;
    }

    fetch(`${baseUrl}/config`, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`Gradio /config returned HTTP ${res.status}`);
        return res.json();
      })
      .then((config: GradioConfig) => {
        config.root = baseUrl;
        const components = initComponentStates(config);
        setState(prev => ({ ...prev, config, components, loading: false }));
        optionsRef.current?.onConfigLoaded?.(config);
      })
      .catch(err => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      });
  });

  // ── Set value (user input) ────────────────────────────

  const setValue = useCallback((id: number, value: any) => {
    setState(prev => {
      const components = new Map(prev.components);
      const comp = components.get(id);
      if (comp) {
        components.set(id, { ...comp, value });
      }
      return { ...prev, components };
    });
  }, []);

  // ── Find dependencies for a component + event ─────────

  const findDependencies = useCallback((
    componentId: number,
    eventName: string,
    config: GradioConfig,
  ): GradioDependency[] => {
    return config.dependencies.filter(dep =>
      dep.targets.includes(componentId) && dep.trigger === eventName
    );
  }, []);

  // ── Execute a predict call ────────────────────────────

  const executePrediction = useCallback(async (
    dep: GradioDependency,
    fnIndex: number,
    components: Map<number, GradioComponentState>,
    baseUrl: string,
  ) => {
    // Gather input values
    const inputData = dep.inputs.map(id => {
      const comp = components.get(id);
      return comp?.value ?? null;
    });

    // Mark as predicting
    setState(prev => {
      const predicting = new Set(prev.predicting);
      predicting.add(fnIndex);
      // Mark output components as loading
      const comps = new Map(prev.components);
      for (const outId of dep.outputs) {
        const comp = comps.get(outId);
        if (comp) comps.set(outId, { ...comp, loading: true, error: null });
      }
      return { ...prev, predicting, components: comps };
    });

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (optionsRef.current?.apiKey) {
        headers['Authorization'] = `Bearer ${optionsRef.current.apiKey}`;
      }

      const apiName = dep.api_name ?? `/predict`;
      const apiUrl = `${baseUrl}/api${apiName}`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: inputData,
          fn_index: fnIndex,
          session_hash: sessionHash.current,
        }),
      });

      if (!res.ok) throw new Error(`Predict returned HTTP ${res.status}`);
      const result = await res.json();

      // Update output components with results
      setState(prev => {
        const predicting = new Set(prev.predicting);
        predicting.delete(fnIndex);
        const comps = new Map(prev.components);
        const outputData: any[] = result.data ?? [];
        dep.outputs.forEach((outId, i) => {
          const comp = comps.get(outId);
          if (comp) {
            comps.set(outId, {
              ...comp,
              value: i < outputData.length ? outputData[i] : comp.value,
              loading: false,
              error: null,
            });
          }
        });
        return { ...prev, predicting, components: comps };
      });

      optionsRef.current?.onPrediction?.(fnIndex, result.data ?? []);
    } catch (err) {
      setState(prev => {
        const predicting = new Set(prev.predicting);
        predicting.delete(fnIndex);
        const comps = new Map(prev.components);
        for (const outId of dep.outputs) {
          const comp = comps.get(outId);
          if (comp) {
            comps.set(outId, {
              ...comp,
              loading: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return { ...prev, predicting, components: comps };
      });
    }
  }, []);

  // ── Trigger (button click, change event, etc.) ────────

  const trigger = useCallback((componentId: number, eventName: string) => {
    const { config, components } = state;
    if (!config) return;

    const deps = findDependencies(componentId, eventName, config);
    const baseUrl = config.root ?? urlRef.current.replace(/\/$/, '');

    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      if (!dep.backend_fn) continue;
      // fn_index is the dependency's position in the dependencies array
      const fnIndex = config.dependencies.indexOf(dep);
      executePrediction(dep, fnIndex, components, baseUrl);
    }
  }, [state, findDependencies, executePrediction]);

  // ── isPredicting ──────────────────────────────────────

  const isPredicting = useCallback((fnIndex: number) => {
    return state.predicting.has(fnIndex);
  }, [state.predicting]);

  return {
    config: state.config,
    components: state.components,
    loading: state.loading,
    error: state.error,
    setValue,
    trigger,
    isPredicting,
  };
}
