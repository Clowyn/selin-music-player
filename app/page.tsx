'use client';

import AudioEngine from '@/components/AudioEngine';
import { BackgroundSlideshow } from '@/components/BackgroundSlideshow';
import { FloatingSprites } from '@/components/FloatingSprites';
import { BirthdayGreeting } from '@/components/BirthdayGreeting';
import NowPlaying from '@/components/NowPlaying';
import CustomSeekbar from '@/components/CustomSeekbar';
import PlayerControls from '@/components/PlayerControls';
import PlaylistDrawer from '@/components/PlaylistDrawer';

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
        <div className="px-6 mb-6">
          <NowPlaying />
        </div>

        {/* Custom seekbar */}
        <div className="px-6 mb-4">
          <CustomSeekbar />
        </div>

        {/* Player controls */}
        <div className="px-6 mb-4">
          <PlayerControls />
        </div>

        {/* Playlist drawer trigger area */}
        <div className="px-6 mb-8">
          <PlaylistDrawer />
        </div>
      </div>
    </main>
  );
}
