/**
 * Base props shared by all generative effect components.
 */
export interface EffectProps {
  /** Render as parent's background instead of a standalone surface. */
  background?: boolean;
  /** Animation speed multiplier. Default 1. */
  speed?: number;
  /** Trail decay rate — lower = longer trails. 0-1. Default varies per effect. */
  decay?: number;
  /** Style props (width, height, etc.) for standalone mode. */
  style?: Record<string, unknown>;

  // --- External driving signals (all optional, 0-1 range) ---
  /** Low-frequency energy. Drives size/weight parameters. */
  bass?: number;
  /** Mid-frequency energy. Drives shape/form parameters. */
  mid?: number;
  /** High-frequency energy. Drives detail/turbulence parameters. */
  high?: number;
  /** Amplitude / overall intensity. Drives brightness/spawn rate. */
  amplitude?: number;
  /** Beat pulse — true on beat frames. Triggers spawns/jumps. */
  beat?: boolean;
}
