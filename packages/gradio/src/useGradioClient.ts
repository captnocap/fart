/**
 * useGradioClient — Hook that manages communication with a Gradio server.
 *
 * Updated for Gradio v6 protocol:
 * - POST /gradio_api/call/<api_name> → { event_id }
 * - GET  /gradio_api/call/<api_name>/<event_id> → SSE stream
 * - targets are [componentId, eventName] tuples
 * - file results come as { url, path } objects
 */

import { useState, useCallback, useRef } from 'react';
import { useMount } from '@reactjit/core';
import type {
  GradioConfig,
  GradioComponentState,
  GradioDependency,
  GradioFileData,
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
  setValue: (id: number, value: any) => void;
  trigger: (componentId: number, eventName: string) => void;
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

/** Extract a usable value from Gradio's result data, resolving file objects */
function resolveValue(val: any, baseUrl: string): any {
  if (val && typeof val === 'object' && val.url) {
    // GradioFileData — return the full URL for Image/Audio/Video
    const fileUrl: string = val.url;
    if (fileUrl.startsWith('http')) return fileUrl;
    return `${baseUrl}${fileUrl}`;
  }
  return val;
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

  // ── Find dependencies for a component + event (v6) ────

  const findDependencies = useCallback((
    componentId: number,
    eventName: string,
    config: GradioConfig,
  ): GradioDependency[] => {
    return config.dependencies.filter(dep => {
      // v6: targets is [[componentId, eventName], ...]
      if (Array.isArray(dep.targets)) {
        return dep.targets.some(t => {
          if (Array.isArray(t)) {
            return t[0] === componentId && t[1] === eventName;
          }
          // v5 fallback: targets is number[], trigger is separate
          return t === componentId && dep.trigger === eventName;
        });
      }
      return false;
    });
  }, []);

  // ── Execute prediction (v6 event-based protocol) ──────

  const executePrediction = useCallback(async (
    dep: GradioDependency,
    fnIndex: number,
    components: Map<number, GradioComponentState>,
    baseUrl: string,
    apiPrefix: string,
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

      const apiName = dep.api_name ?? 'predict';
      const callUrl = `${baseUrl}${apiPrefix}/call/${apiName}`;

      // Step 1: POST to get event_id
      const callRes = await fetch(callUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: inputData,
          session_hash: sessionHash.current,
        }),
      });

      if (!callRes.ok) throw new Error(`Call returned HTTP ${callRes.status}`);
      const { event_id } = await callRes.json();

      // Step 2: GET SSE stream for result
      const streamUrl = `${callUrl}/${event_id}`;
      const streamRes = await fetch(streamUrl);
      if (!streamRes.ok) throw new Error(`Stream returned HTTP ${streamRes.status}`);

      const text = await streamRes.text();

      // Parse SSE events — look for "event: complete" followed by "data: [...]"
      let resultData: any[] = [];
      const lines = text.split('\n');
      let foundComplete = false;
      for (const line of lines) {
        if (line.startsWith('event: complete')) {
          foundComplete = true;
        } else if (foundComplete && line.startsWith('data: ')) {
          try {
            resultData = JSON.parse(line.slice(6));
          } catch {}
          break;
        } else if (line.startsWith('event: error')) {
          // Next data line is the error message
          foundComplete = false;
          const nextIdx = lines.indexOf(line) + 1;
          if (nextIdx < lines.length && lines[nextIdx].startsWith('data: ')) {
            throw new Error(lines[nextIdx].slice(6));
          }
        }
      }

      // Resolve file URLs in results
      const resolvedData = resultData.map(v => resolveValue(v, baseUrl));

      // Update output components
      setState(prev => {
        const predicting = new Set(prev.predicting);
        predicting.delete(fnIndex);
        const comps = new Map(prev.components);
        dep.outputs.forEach((outId, i) => {
          const comp = comps.get(outId);
          if (comp) {
            comps.set(outId, {
              ...comp,
              value: i < resolvedData.length ? resolvedData[i] : comp.value,
              loading: false,
              error: null,
            });
          }
        });
        return { ...prev, predicting, components: comps };
      });

      optionsRef.current?.onPrediction?.(fnIndex, resolvedData);
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
    const apiPrefix = config.api_prefix ?? '/gradio_api';

    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      if (dep.backend_fn === false) continue;
      const fnIndex = config.dependencies.indexOf(dep);
      executePrediction(dep, fnIndex, components, baseUrl, apiPrefix);
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
