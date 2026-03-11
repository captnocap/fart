/**
 * Gradio config types — mirrors the JSON returned by GET /config on a Gradio server.
 *
 * The config is the *entire* UI description: component types, props, layout tree,
 * and dependency wiring (which button triggers which function with which inputs/outputs).
 */

// ── Component config ────────────────────────────────────

export interface GradioComponentConfig {
  id: number;
  type: string;
  props: Record<string, any>;
  api_info?: {
    info: { type: string };
    serializer: string;
  };
  example_inputs?: any;
}

// ── Layout tree ─────────────────────────────────────────

export interface GradioLayoutNode {
  id: number;
  children?: GradioLayoutNode[];
}

// ── Dependency (event wiring) ───────────────────────────

export interface GradioDependency {
  targets: number[];
  trigger: string;
  inputs: number[];
  outputs: number[];
  api_name: string | null;
  backend_fn: boolean;
  queue: boolean | null;
  js?: string;
  scroll_to_output?: boolean;
  show_progress?: 'full' | 'minimal' | 'hidden';
  cancels?: number[];
  every?: number;
  batch?: boolean;
  max_batch_size?: number;
}

// ── Full config response ────────────────────────────────

export interface GradioConfig {
  mode: 'blocks' | 'interface';
  dev_mode: boolean;
  analytics_enabled: boolean;
  components: GradioComponentConfig[];
  css?: string;
  title?: string;
  description?: string;
  theme?: string;
  layout: GradioLayoutNode;
  dependencies: GradioDependency[];
  root?: string;
  version?: string;
}

// ── Runtime state ───────────────────────────────────────

export interface GradioComponentState {
  id: number;
  type: string;
  value: any;
  props: Record<string, any>;
  loading: boolean;
  error: string | null;
}

// ── Predict request/response ────────────────────────────

export interface GradioPredictRequest {
  data: any[];
  fn_index: number;
  session_hash?: string;
}

export interface GradioPredictResponse {
  data: any[];
  duration?: number;
  average_duration?: number;
  is_generating?: boolean;
}

// ── Queue protocol ──────────────────────────────────────

export type GradioQueueMessage =
  | { msg: 'send_hash'; session_hash: string; fn_index: number }
  | { msg: 'send_data'; data: any[]; fn_index: number; session_hash: string }
  | { msg: 'estimation'; rank: number; queue_size: number; avg_event_process_time: number }
  | { msg: 'process_starts' }
  | { msg: 'process_generating'; output: { data: any[] }; success: boolean }
  | { msg: 'process_completed'; output: { data: any[] }; success: boolean }
  | { msg: 'close_stream' };

// ── GradioApp props ─────────────────────────────────────

export interface GradioAppProps {
  /** URL of the running Gradio server (e.g. "http://localhost:7860") */
  url: string;
  /** Optional API key for authenticated endpoints */
  apiKey?: string;
  /** Optional session hash — auto-generated if omitted */
  sessionHash?: string;
  /** Called when the config is loaded */
  onConfigLoaded?: (config: GradioConfig) => void;
  /** Called when a prediction completes */
  onPrediction?: (fnIndex: number, data: any[]) => void;
  /** Custom component overrides — map Gradio type to a React component */
  overrides?: Record<string, React.ComponentType<any>>;
}
