/**
 * useTerminalRecorder — controls the global vterm recorder
 * (framework/vterm.zig). Records cell-state frames of the active
 * terminal pty session for later playback or saving.
 *
 * Usage:
 *   const rec = useTerminalRecorder();
 *
 *   // Start with terminal dimensions matching your <Terminal> primitive
 *   <Pressable onPress={() => rec.start(24, 80)}>Record</Pressable>
 *   <Pressable onPress={() => rec.stop()}>Stop</Pressable>
 *   <Pressable onPress={() => rec.save('session.cast')}>Save</Pressable>
 *   <Text>{rec.isRecording() ? 'REC' : 'IDLE'}</Text>
 *
 * The recorder is a process-wide singleton — only one terminal session can
 * be recorded at a time.
 */

const host = (): any => globalThis as any;

export interface TerminalRecorder {
  start(rows: number, cols: number): void;
  stop(): void;
  save(path: string): boolean;
  isRecording(): boolean;
}

export function useTerminalRecorder(): TerminalRecorder {
  return {
    start: (rows: number, cols: number): void => {
      host().__vtermStartRecording?.(rows, cols);
    },
    stop: (): void => {
      host().__vtermStopRecording?.();
    },
    save: (path: string): boolean => {
      return (host().__vtermSaveRecording?.(path) ?? 0) === 1;
    },
    isRecording: (): boolean => {
      return (host().__vtermIsRecording?.() ?? 0) === 1;
    },
  };
}
