import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { FEATURE_VIDEO, CHAPTERS, EXTRAS } from '../data';
import type { Chapter, Extra } from '../data';

// ── Types ────────────────────────────────────────────────

export type Screen = 'title' | 'chapters' | 'player' | 'extras';

interface DVDState {
  screen: Screen;
  currentVideo: string;
  startTime: number;
  returnTo: Screen;
}

type Action =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'PLAY_FEATURE'; startTime?: number }
  | { type: 'PLAY_CHAPTER'; chapter: Chapter }
  | { type: 'PLAY_EXTRA'; extra: Extra }
  | { type: 'BACK' };

interface DVDContextValue {
  state: DVDState;
  navigate: (screen: Screen) => void;
  playFeature: (startTime?: number) => void;
  playChapter: (chapter: Chapter) => void;
  playExtra: (extra: Extra) => void;
  back: () => void;
  chapters: Chapter[];
  extras: Extra[];
}

// ── Reducer ──────────────────────────────────────────────

const initialState: DVDState = {
  screen: 'title',
  currentVideo: FEATURE_VIDEO,
  startTime: 0,
  returnTo: 'title',
};

function reducer(state: DVDState, action: Action): DVDState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, screen: action.screen };
    case 'PLAY_FEATURE':
      return {
        ...state,
        screen: 'player',
        currentVideo: FEATURE_VIDEO,
        startTime: action.startTime ?? 0,
        returnTo: state.screen,
      };
    case 'PLAY_CHAPTER':
      return {
        ...state,
        screen: 'player',
        currentVideo: FEATURE_VIDEO,
        startTime: action.chapter.timestamp,
        returnTo: 'chapters',
      };
    case 'PLAY_EXTRA':
      return {
        ...state,
        screen: 'player',
        currentVideo: action.extra.src,
        startTime: 0,
        returnTo: 'extras',
      };
    case 'BACK':
      return { ...state, screen: state.returnTo };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────

const DVDContext = createContext<DVDContextValue | null>(null);

export function DVDProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigate = useCallback((screen: Screen) => {
    dispatch({ type: 'NAVIGATE', screen });
  }, []);

  const playFeature = useCallback((startTime?: number) => {
    dispatch({ type: 'PLAY_FEATURE', startTime });
  }, []);

  const playChapter = useCallback((chapter: Chapter) => {
    dispatch({ type: 'PLAY_CHAPTER', chapter });
  }, []);

  const playExtra = useCallback((extra: Extra) => {
    dispatch({ type: 'PLAY_EXTRA', extra });
  }, []);

  const back = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, []);

  return (
    <DVDContext.Provider value={{
      state,
      navigate,
      playFeature,
      playChapter,
      playExtra,
      back,
      chapters: CHAPTERS,
      extras: EXTRAS,
    }}>
      {children}
    </DVDContext.Provider>
  );
}

export function useDVD(): DVDContextValue {
  const ctx = useContext(DVDContext);
  if (!ctx) throw new Error('useDVD must be used within DVDProvider');
  return ctx;
}
