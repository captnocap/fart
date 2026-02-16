import React from 'react';
import { DVDProvider, useDVD } from './dvd/context';
import { TitleScreen } from './screens/TitleScreen';
import { ChapterSelect } from './screens/ChapterSelect';
import { PlayerScreen } from './screens/PlayerScreen';
import { SpecialFeatures } from './screens/SpecialFeatures';

function Router() {
  const { state } = useDVD();

  switch (state.screen) {
    case 'title':
      return <TitleScreen />;
    case 'chapters':
      return <ChapterSelect />;
    case 'player':
      return <PlayerScreen />;
    case 'extras':
      return <SpecialFeatures />;
    default:
      return <TitleScreen />;
  }
}

export function App() {
  return (
    <DVDProvider>
      <Router />
    </DVDProvider>
  );
}
