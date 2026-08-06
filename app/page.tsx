'use client';

import AudioEngine from '@/components/AudioEngine';
import { BackgroundSlideshow } from '@/components/BackgroundSlideshow';
import { FloatingSprites } from '@/components/FloatingSprites';
import { BirthdayGreeting } from '@/components/BirthdayGreeting';
import NowPlaying from '@/components/NowPlaying';
import UpNextRow from '@/components/UpNextRow';
import CustomSeekbar from '@/components/CustomSeekbar';
import PlayerControls from '@/components/PlayerControls';
import PlaylistDrawer from '@/components/PlaylistDrawer';
import { SearchDrawer } from '@/components/SearchDrawer';
import LyricsSheet from '@/components/LyricsSheet';
import QueueDrawer from '@/components/QueueDrawer';

export default function Home() {
  return (
    <main className="relative flex flex-col h-[100dvh] w-full overflow-hidden">
      {/* Hidden audio element managed by AudioEngine */}
      <AudioEngine />

      {/* Background layer - z-0 */}
      <BackgroundSlideshow />

      {/* Floating character sprites - z-30 */}
      <FloatingSprites />

      {/* Birthday greeting overlay - z-50 (shows once) */}
      <BirthdayGreeting />

      {/* Main player interface - z-10 */}
      <div className="relative z-10 flex flex-col h-full justify-end pb-safe">
        {/* Top spacer for status bar on iOS */}
        <div className="pt-safe" />

        {/* Spacer to push content to bottom */}
        <div className="flex-1" />

        {/* Now Playing info */}
        <div className="px-6 mb-2">
          <NowPlaying />
        </div>

        {/* Up Next horizontal row */}
        <div className="px-6 mb-3">
          <UpNextRow />
        </div>

        {/* Custom seekbar */}
        <div className="px-6 mb-3">
          <CustomSeekbar />
        </div>

        {/* Player controls */}
        <div className="px-6 mb-3">
          <PlayerControls />
        </div>

        {/* Drawer triggers area */}
        <div className="px-6 mb-6 flex items-center justify-center gap-4">
          <PlaylistDrawer />
          <SearchDrawer />
        </div>
      </div>

      {/* Slide-up Queue Drawer */}
      <QueueDrawer />

      {/* Slide-up Lyrics Sheet */}
      <LyricsSheet />
    </main>
  );
}

