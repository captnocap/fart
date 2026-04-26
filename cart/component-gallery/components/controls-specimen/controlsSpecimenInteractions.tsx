import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp01 } from './controlsSpecimenTheme';

const host: any = globalThis as any;

type RangeValue = {
  low: number;
  high: number;
};

function cancelFrame(frameId: any): void {
  if (frameId == null) return;
  const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
  if (cancel) cancel(frameId);
  else clearTimeout(frameId);
}

function scheduleFrame(fn: () => void): any {
  const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
  return raf ? raf(fn) : setTimeout(fn, 16);
}

function readMouseX(): number {
  return typeof host.getMouseX === 'function' ? Number(host.getMouseX()) : 0;
}

function readMouseY(): number {
  return typeof host.getMouseY === 'function' ? Number(host.getMouseY()) : 0;
}

function isMouseDown(): boolean {
  return typeof host.getMouseDown === 'function' ? !!host.getMouseDown() : false;
}

function clampPercent(value: number): number {
  return Math.round(clamp01(value / 100) * 100);
}

function clampIndex(value: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(value)));
}

function normalizeRange(low: number, high: number): RangeValue {
  const nextLow = clampPercent(low);
  const nextHigh = clampPercent(high);
  return nextLow <= nextHigh ? { low: nextLow, high: nextHigh } : { low: nextHigh, high: nextLow };
}

export function useControllableNumberState({
  value,
  defaultValue,
  min = 0,
  max = 100,
  onChange,
}: {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (next: number) => void;
}) {
  const clamp = useCallback((next: number) => Math.max(min, Math.min(max, Math.round(next))), [max, min]);
  const controlled = typeof value === 'number' && typeof onChange === 'function';
  const [internal, setInternal] = useState(() => clamp(defaultValue ?? value ?? min));
  const resolved = controlled ? clamp(value as number) : internal;

  const setValue = useCallback(
    (next: number) => {
      const resolvedNext = clamp(next);
      if (!controlled) setInternal(resolvedNext);
      if (typeof onChange === 'function') onChange(resolvedNext);
    },
    [clamp, controlled, onChange]
  );

  return [resolved, setValue] as const;
}

export function useControllableIndexState({
  value,
  defaultValue,
  count,
  onChange,
}: {
  value?: number;
  defaultValue?: number;
  count: number;
  onChange?: (next: number) => void;
}) {
  const controlled = typeof value === 'number' && typeof onChange === 'function';
  const [internal, setInternal] = useState(() => clampIndex(defaultValue ?? value ?? 0, count));
  const resolved = controlled ? clampIndex(value as number, count) : clampIndex(internal, count);

  const setIndex = useCallback(
    (next: number) => {
      const resolvedNext = clampIndex(next, count);
      if (!controlled) setInternal(resolvedNext);
      if (typeof onChange === 'function') onChange(resolvedNext);
    },
    [controlled, count, onChange]
  );

  return [resolved, setIndex] as const;
}

export function useControllableRangeState({
  low,
  high,
  defaultLow,
  defaultHigh,
  onChange,
}: {
  low?: number;
  high?: number;
  defaultLow?: number;
  defaultHigh?: number;
  onChange?: (next: RangeValue) => void;
}) {
  const controlled = typeof low === 'number' && typeof high === 'number' && typeof onChange === 'function';
  const [internal, setInternal] = useState(() => normalizeRange(defaultLow ?? low ?? 25, defaultHigh ?? high ?? 75));
  const resolved = controlled ? normalizeRange(low as number, high as number) : internal;

  const setRange = useCallback(
    (next: RangeValue) => {
      const resolvedNext = normalizeRange(next.low, next.high);
      if (!controlled) setInternal(resolvedNext);
      if (typeof onChange === 'function') onChange(resolvedNext);
    },
    [controlled, onChange]
  );

  return [resolved, setRange] as const;
}

export function useHorizontalPercentDrag(value: number, onChange: (next: number) => void) {
  const [dragging, setDragging] = useState(false);
  const rectRef = useRef<{ left: number; width: number } | null>(null);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    const rect = rectRef.current;
    if (!rect || rect.width <= 0) return;
    const ratio = clamp01((readMouseX() - rect.left) / rect.width);
    onChange(ratio * 100);
  }, [onChange]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback(() => {
    if (!rectRef.current) return;
    activeRef.current = true;
    setDragging(true);
    setFromMouse();
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop, tick]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  const onLayout = useCallback((rect: any) => {
    const left = Number.isFinite(rect?.left) ? rect.left : rect?.x;
    const width = Number.isFinite(rect?.width) ? rect.width : rect?.w;
    if (Number.isFinite(left) && Number.isFinite(width)) {
      rectRef.current = { left, width };
    }
  }, []);

  return {
    dragging,
    ratio: clamp01(value / 100),
    begin,
    onLayout,
  };
}

export function useVerticalPercentDrag(value: number, onChange: (next: number) => void) {
  const [dragging, setDragging] = useState(false);
  const rectRef = useRef<{ top: number; height: number } | null>(null);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    const rect = rectRef.current;
    if (!rect || rect.height <= 0) return;
    const ratio = 1 - clamp01((readMouseY() - rect.top) / rect.height);
    onChange(ratio * 100);
  }, [onChange]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback(() => {
    if (!rectRef.current) return;
    activeRef.current = true;
    setDragging(true);
    setFromMouse();
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop, tick]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  const onLayout = useCallback((rect: any) => {
    const top = Number.isFinite(rect?.top) ? rect.top : rect?.y;
    const height = Number.isFinite(rect?.height) ? rect.height : rect?.h;
    if (Number.isFinite(top) && Number.isFinite(height)) {
      rectRef.current = { top, height };
    }
  }, []);

  return {
    dragging,
    ratio: clamp01(value / 100),
    begin,
    onLayout,
  };
}

export function useHorizontalRangeDrag(range: RangeValue, onChange: (next: RangeValue) => void) {
  const [dragging, setDragging] = useState(false);
  const rectRef = useRef<{ left: number; width: number } | null>(null);
  const activeRef = useRef(false);
  const thumbRef = useRef<'low' | 'high'>('low');
  const frameRef = useRef<any>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    const rect = rectRef.current;
    if (!rect || rect.width <= 0) return;
    const next = clampPercent(clamp01((readMouseX() - rect.left) / rect.width) * 100);
    if (thumbRef.current === 'low') {
      onChange({ low: Math.min(next, range.high), high: range.high });
    } else {
      onChange({ low: range.low, high: Math.max(next, range.low) });
    }
  }, [onChange, range.high, range.low]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback(() => {
    const rect = rectRef.current;
    if (!rect || rect.width <= 0) return;
    const next = clampPercent(clamp01((readMouseX() - rect.left) / rect.width) * 100);
    thumbRef.current = Math.abs(next - range.low) <= Math.abs(next - range.high) ? 'low' : 'high';
    activeRef.current = true;
    setDragging(true);
    setFromMouse();
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [range.high, range.low, setFromMouse, stopLoop, tick]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  const onLayout = useCallback((rect: any) => {
    const left = Number.isFinite(rect?.left) ? rect.left : rect?.x;
    const width = Number.isFinite(rect?.width) ? rect.width : rect?.w;
    if (Number.isFinite(left) && Number.isFinite(width)) {
      rectRef.current = { left, width };
    }
  }, []);

  return {
    dragging,
    begin,
    onLayout,
  };
}
