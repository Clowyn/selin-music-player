# M2 Explorer 3 Analysis: "Up Next" Horizontal Scrollable Row Design

## Executive Summary
This document provides the layout inspection and detailed architecture for integrating the **"Up Next" horizontal scrollable recommendation row** on `app/page.tsx` for Selin Music Player. The design fulfills all requirements of M2 (R2): glassmorphic aesthetics, compact horizontal scroll cards (`w-36` to `w-40`), play overlay, queue action button, and full compatibility with the mobile-first non-scrollable viewport (`h-[100dvh] overflow-hidden`).

---

## 1. Existing Layout Analysis (`app/page.tsx`)

### Current DOM Hierarchy
`app/page.tsx` currently structures the main player UI in a full-height, non-scrollable flex container:
```tsx
<main className="relative flex flex-col h-[100dvh] w-full overflow-hidden">
  <AudioEngine />
  <BackgroundSlideshow />
  <FloatingSprites />
  <BirthdayGreeting />

  <div className="relative z-10 flex flex-col h-full justify-end pb-safe">
    <div className="pt-safe" />
    <div className="flex-1" />

    <div className="px-6 mb-6">
      <NowPlaying />
    </div>

    <div className="px-6 mb-4">
      <CustomSeekbar />
    </div>

    <div className="px-6 mb-4">
      <PlayerControls />
    </div>

    <div className="px-6 mb-8 flex items-center justify-center gap-4">
      <PlaylistDrawer />
      <SearchDrawer />
    </div>
  </div>
</main>
```

### Viewport Height & Space Budget Analysis
- Container `h-[100dvh] overflow-hidden` strictly restricts vertical scrolling on mobile viewports (e.g. 375px × 667px up to 430px × 932px).
- Adding `UpNextRow` directly below `NowPlaying` requires vertical spacing optimization so the main controls remain comfortable:
  - **NowPlaying wrapper**: reduce `mb-6` -> `mb-2`, and optimize `NowPlaying.tsx` `min-h-[160px]` -> `min-h-[110px]` & padding `p-6` -> `p-3 sm:p-4`.
  - **UpNextRow container**: height ~115px - 130px, margin `mb-3`.
  - **CustomSeekbar container**: margin `mb-3`.
  - **PlayerControls container**: margin `mb-3`.
  - **Drawer triggers container**: reduce `mb-8` -> `mb-6`.
- Total occupied height remains under 440px, ensuring `flex-1` absorbs extra vertical space on large phones/desktops while remaining fits completely within 667px SE viewports.

---

## 2. Component Design (`components/UpNextRow.tsx`)

### Features & Specs
1. **Glassmorphic Styling**:
   - Container header with `Sparkles` icon and "Sana Özel" pill badge.
   - Cards: `bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 hover:border-pink-500/40 transition-all duration-200 shadow-lg`.
2. **Horizontal Scrolling & Snap**:
   - Scroll row: `flex overflow-x-auto gap-3 snap-x pb-2 pt-0.5 scrollbar-none -mx-2 px-2`.
   - Card dimensions: `flex-shrink-0 w-36 sm:w-40 snap-start`.
3. **Card Contents**:
   - **Thumbnail Container**: `relative w-full h-20 rounded-xl overflow-hidden bg-gray-900/50 border border-white/10`.
   - **Play Overlay**: Centered translucent overlay with a pink play button (`Play` icon) visible on hover/tap.
   - **Title & Artist**: `text-xs font-bold text-white truncate` and `text-[10px] text-purple-200/70 truncate`.
   - **Queue Button (`+ Sıraya`)**: Compact button calling `addToQueue(song)` from Zustand store with temporary `Eklendi` checkmark state.
4. **Data Integration**:
   - Listens to `currentSong` from `usePlayerStore()`.
   - Calls `/api/recommendations?title=X&artist=Y&limit=5` via `fetch()`.
   - Shows a 4-card animated skeleton (`animate-pulse`) while loading.
   - Falls back to generic recommendations (e.g. `Türkçe Pop`) if `currentSong` is null.

---

## 3. Implementation Code Proposals

### A. New Component: `components/UpNextRow.tsx`
```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus, Check, Sparkles, Music } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { Song } from '@/lib/types';

export default function UpNextRow() {
  const { currentSong, setCurrentSong, play, addToQueue } = usePlayerStore();
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();

    async function fetchRecommendations() {
      setIsLoading(true);
      try {
        let url = '/api/recommendations?limit=5';
        if (currentSong?.title && currentSong?.artist) {
          url += `&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
        } else if (currentSong?.title) {
          url += `&title=${encodeURIComponent(currentSong.title)}`;
        } else {
          url += `&title=${encodeURIComponent('Türkçe Pop')}&artist=${encodeURIComponent('2026')}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Öneriler yüklenemedi');
        const data = await res.json();

        if (data.recommendations && Array.isArray(data.recommendations)) {
          setRecommendations(data.recommendations.slice(0, 5));
        } else {
          setRecommendations([]);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('UpNextRow recommendation fetch error:', err);
          setRecommendations([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchRecommendations();

    return () => {
      controller.abort();
    };
  }, [currentSong?.id, currentSong?.title, currentSong?.artist]);

  const handlePlay = (song: Song) => {
    setCurrentSong(song);
    play();
  };

  const handleQueue = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    addToQueue(song);
    setAddedIds((prev) => new Set(prev).add(song.id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }, 2000);
  };

  if (!isLoading && recommendations.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-pink-400 animate-pulse" />
          <span className="text-xs font-semibold text-purple-200/90 tracking-wide">
            Sıradaki Öneriler
          </span>
        </div>
        <span className="text-[10px] font-medium text-pink-300/80 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
          Sana Özel
        </span>
      </div>

      {/* Horizontal Scroll Area */}
      <div className="flex overflow-x-auto gap-3 snap-x pb-2 pt-0.5 scrollbar-none -mx-2 px-2">
        {isLoading
          ? [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-36 sm:w-40 snap-start bg-white/5 border border-white/10 rounded-2xl p-2.5 animate-pulse flex flex-col gap-2"
              >
                <div className="w-full h-20 bg-white/10 rounded-xl" />
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-2.5 bg-white/10 rounded w-1/2" />
                <div className="h-6 bg-white/10 rounded-lg mt-1" />
              </div>
            ))
          : recommendations.map((song) => {
              const isAdded = addedIds.has(song.id);
              const isCurrent =
                currentSong?.id === song.id ||
                (currentSong?.youtube_id && currentSong?.youtube_id === song.youtube_id);

              return (
                <motion.div
                  key={song.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePlay(song)}
                  className={`flex-shrink-0 w-36 sm:w-40 snap-start cursor-pointer bg-white/10 hover:bg-white/15 backdrop-blur-xl border ${
                    isCurrent
                      ? 'border-pink-500/60 bg-pink-500/10'
                      : 'border-white/15 hover:border-pink-500/40'
                  } rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-200 shadow-lg group`}
                >
                  {/* Cover Thumbnail & Play Overlay */}
                  <div className="relative w-full h-20 rounded-xl overflow-hidden bg-gray-900/50 border border-white/10 flex-shrink-0">
                    {song.cover_url ? (
                      <img
                        src={song.cover_url}
                        alt={song.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-purple-600/30 flex items-center justify-center">
                        <Music size={24} className="text-purple-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] group-hover:bg-pink-600/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-md transform group-hover:scale-105 transition-transform">
                        <Play size={18} className="fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Song Metadata */}
                  <div className="mt-2 min-w-0">
                    <h4
                      className="text-xs font-bold text-white truncate group-hover:text-pink-300 transition-colors"
                      title={song.title}
                    >
                      {song.title}
                    </h4>
                    <p
                      className="text-[10px] text-purple-200/70 truncate font-medium mt-0.5"
                      title={song.artist}
                    >
                      {song.artist}
                    </p>
                  </div>

                  {/* + Queue Button */}
                  <button
                    type="button"
                    onClick={(e) => handleQueue(e, song)}
                    className={`mt-2.5 w-full py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 border ${
                      isAdded
                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                        : 'bg-white/10 hover:bg-pink-500/20 text-gray-200 hover:text-pink-300 border-white/10 hover:border-pink-500/40'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check size={12} className="text-green-400" />
                        <span>Eklendi</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>+ Sıraya</span>
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}
```

### B. Integration Patch for `app/page.tsx`
```tsx
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

export default function Home() {
  return (
    <main className="relative flex flex-col h-[100dvh] w-full overflow-hidden">
      <AudioEngine />
      <BackgroundSlideshow />
      <FloatingSprites />
      <BirthdayGreeting />

      <div className="relative z-10 flex flex-col h-full justify-end pb-safe">
        <div className="pt-safe" />
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
    </main>
  );
}
```

### C. Minor Layout Optimization for `components/NowPlaying.tsx`
Adjust padding from `p-6` to `p-3 sm:p-4` and `min-h-[160px]` to `min-h-[110px]` to ensure optimal vertical space distribution.

---

## 4. Verification Method
1. **Visual & Layout Check**: Ensure `UpNextRow` renders between `NowPlaying` and `CustomSeekbar`.
2. **Interaction Verification**:
   - Tapping a recommendation starts playing it instantly via `setCurrentSong()` and `play()`.
   - Tapping `+ Sıraya` adds the track to the queue via `addToQueue()` with temporary visual feedback.
3. **Viewport Constraint Verification**: Check responsive viewports (375px width, 667px height up to desktop) to ensure no vertical scrollbars appear on `main` (`h-[100dvh] overflow-hidden`).
