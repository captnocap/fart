// Easing library. All 30 standard easings from easings.net plus `linear`.
// Every function takes t in [0..1] (clamped) and returns an eased value.
// Usable as first-class values or by string id via `resolveEasing`.

export type EasingFn = (t: number) => number;
export type Easing = EasingFn | EasingName;

export function clamp01(t: number): number { return t < 0 ? 0 : t > 1 ? 1 : t; }

const PI = Math.PI;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;
const n1 = 7.5625;
const d1 = 2.75;

function bounceOut(t: number): number {
  if (t < 1 / d1)      return n1 * t * t;
  if (t < 2 / d1)      { t -= 1.5 / d1;   return n1 * t * t + 0.75; }
  if (t < 2.5 / d1)    { t -= 2.25 / d1;  return n1 * t * t + 0.9375; }
  /* else */           { t -= 2.625 / d1; return n1 * t * t + 0.984375; }
}

export const linear: EasingFn = (t) => clamp01(t);

export const easeInSine:     EasingFn = (t) => { t = clamp01(t); return 1 - Math.cos((t * PI) / 2); };
export const easeOutSine:    EasingFn = (t) => { t = clamp01(t); return Math.sin((t * PI) / 2); };
export const easeInOutSine:  EasingFn = (t) => { t = clamp01(t); return -(Math.cos(PI * t) - 1) / 2; };

export const easeInQuad:     EasingFn = (t) => { t = clamp01(t); return t * t; };
export const easeOutQuad:    EasingFn = (t) => { t = clamp01(t); return 1 - (1 - t) * (1 - t); };
export const easeInOutQuad:  EasingFn = (t) => { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

export const easeInCubic:    EasingFn = (t) => { t = clamp01(t); return t * t * t; };
export const easeOutCubic:   EasingFn = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); };
export const easeInOutCubic: EasingFn = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

export const easeInQuart:    EasingFn = (t) => { t = clamp01(t); return t * t * t * t; };
export const easeOutQuart:   EasingFn = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 4); };
export const easeInOutQuart: EasingFn = (t) => { t = clamp01(t); return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; };

export const easeInQuint:    EasingFn = (t) => { t = clamp01(t); return t * t * t * t * t; };
export const easeOutQuint:   EasingFn = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 5); };
export const easeInOutQuint: EasingFn = (t) => { t = clamp01(t); return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; };

export const easeInExpo:     EasingFn = (t) => { t = clamp01(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); };
export const easeOutExpo:    EasingFn = (t) => { t = clamp01(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
export const easeInOutExpo:  EasingFn = (t) => {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

export const easeInCirc:     EasingFn = (t) => { t = clamp01(t); return 1 - Math.sqrt(1 - t * t); };
export const easeOutCirc:    EasingFn = (t) => { t = clamp01(t); return Math.sqrt(1 - Math.pow(t - 1, 2)); };
export const easeInOutCirc:  EasingFn = (t) => {
  t = clamp01(t);
  return t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
};

export const easeInBack:     EasingFn = (t) => { t = clamp01(t); return c3 * t * t * t - c1 * t * t; };
export const easeOutBack:    EasingFn = (t) => { t = clamp01(t); return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeInOutBack:  EasingFn = (t) => {
  t = clamp01(t);
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};

export const easeInElastic:  EasingFn = (t) => {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
};
export const easeOutElastic: EasingFn = (t) => {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
export const easeInOutElastic: EasingFn = (t) => {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
    :  (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
};

export const easeInBounce:   EasingFn = (t) => { t = clamp01(t); return 1 - bounceOut(1 - t); };
export const easeOutBounce:  EasingFn = (t) => { t = clamp01(t); return bounceOut(t); };
export const easeInOutBounce:EasingFn = (t) => {
  t = clamp01(t);
  return t < 0.5
    ? (1 - bounceOut(1 - 2 * t)) / 2
    : (1 + bounceOut(2 * t - 1)) / 2;
};

export const EASINGS = {
  linear,
  easeInSine, easeOutSine, easeInOutSine,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInQuint, easeOutQuint, easeInOutQuint,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInCirc, easeOutCirc, easeInOutCirc,
  easeInBack, easeOutBack, easeInOutBack,
  easeInElastic, easeOutElastic, easeInOutElastic,
  easeInBounce, easeOutBounce, easeInOutBounce,
} as const;

export type EasingName = keyof typeof EASINGS;

export const EASING_NAMES: EasingName[] = Object.keys(EASINGS) as EasingName[];

export function easingById(id: string): EasingFn {
  return (EASINGS as Record<string, EasingFn>)[id] || linear;
}

export function resolveEasing(e: Easing | undefined | null, fallback: EasingFn = easeOutCubic): EasingFn {
  if (!e) return fallback;
  if (typeof e === 'function') return e;
  return (EASINGS as Record<string, EasingFn>)[e] || fallback;
}
