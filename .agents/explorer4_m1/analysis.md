# UpNextRow Strategy & JSX Solution Analysis — Explorer 4 (M1-Iter3)

## 1. Overview & Problem Definition

In Iteration 2 of Milestone 1, `components/UpNextRow.tsx` was rejected due to two specific defects:
1. **Vertical Height Violation**: Total section height measured **52.5px**, exceeding the strict `<= 50px` constraint (Challenger 3).
2. **Accessibility & Touch Target Violation**: The inner Play button was `w-5 h-5` (20x20px) and the Queue button was `h-5` (20px high), violating WCAG 2.2 SC 2.5.8 (>= 24px minimum target size) by 4px (Challenger 4). Additionally, having a 20x20px Play button inside a 32px pill card whose entire body already triggered playback created tap target collisions.

---

## 2. Root Cause Analysis

### Height Breakdown in Iteration 2
- **Header Badge Padding**: Line 90 contained `py-0.5` (4px padding) + `border` (2px border) + `text-[8.5px]` line-height, expanding badge height to 14.5px. With `mb-0.5` (2px margin), header footprint reached 16.5px.
- **Scroll Strip Padding**: Line 96 contained `py-0.5` (4px top+bottom padding).
- **Pill Height**: `h-8` (32px).
- **Total Height**: `16.5px + 36px = 52.5px` (> 50px).

### Touch Target Breakdown in Iteration 2
- **Inner Play Button**: `w-5 h-5` (20px x 20px). WCAG 2.2 SC 2.5.8 requires >= 24px x 24px.
- **Queue Button**: `h-5` (20px height). Fails 24px minimum.
- **Redundancy**: The outer card container (`motion.div`) already had `onClick={() => handlePlay(song)}`. Tapping the card body plays the track, rendering the internal 20px Play icon redundant.

---

## 3. Mathematical Box Model Solution

To achieve total section height **<= 46px** (safely <= 50px):

1. **Header Row**:
   - `Sparkles` icon (`12px` height) + title font (`text-[10px] uppercase font-semibold text-gray-400 leading-none`). Header left height = `12px`.
   - Badge: `text-[8.5px] font-medium text-pink-300/80 bg-pink-500/10 px-1.5 rounded-full border border-pink-500/20 leading-none` (Removed `py-0.5`!). Badge height = `8.5px + 2px border = 10.5px`.
   - Flex container height (`items-center`): `12px`.
   - Margin bottom (`mb-1` = 4px or `mb-0.5` = 2px): `2px - 4px`.
   - Header vertical footprint: **14px** (with `mb-0.5`) or **16px** (with `mb-1`).

2. **Scroll Strip Container**:
   - Class: `flex overflow-x-auto gap-2 snap-x snap-mandatory py-0 scrollbar-none -mx-1 px-1`
   - Vertical padding: `py-0` = **0px**.
   - Card height: `h-8` = **32px**.
   - Scroll strip vertical footprint: **32px**.

3. **Total Section Height**:
   - Header (14px) + Scroll Strip (32px) = **46px** (or 44px with `mb-0.5`).
   - Guarantees strict compliance with <= 50px limit.

---

## 4. Accessibility & Touch Target Solution

1. **Eliminate Redundant Play Button**:
   - The entire 32px pill body acts as the Play button touch target (`onClick={() => handlePlay(song)}`).
   - Touch target dimension: `32px height x ~140px width` (Area: ~4480 px²), far exceeding WCAG 2.2 SC 2.5.8 minimums.

2. **Single Queue Action Button (24px x 24px)**:
   - Dimension: `w-6 h-6` (24px x 24px), `rounded-full flex-shrink-0 flex items-center justify-center`.
   - Icon: `<Plus size={12} />` or `<Check size={12} />`.
   - Event: `onClick={(e) => handleQueue(e, song)}` with `e.stopPropagation()`.
   - Meets WCAG 2.2 SC 2.5.8 (>= 24px) exactly.

3. **Scroll Snap Strictness**:
   - `snap-x snap-mandatory` enforces standard snap behavior across web browsers.
   - Removed `whileTap={{ scale: 0.98 }}` to prevent gesture distortion during horizontal touch drags.

---

## 5. Exact Formulated JSX Replacement for `components/UpNextRow.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, Sparkles, Music } from 'lucide-react';
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
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
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
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-pink-400 animate-pulse" />
          <span className="text-[10px] uppercase font-semibold text-gray-400 leading-none">
            Sıradaki Öneriler
          </span>
        </div>
        <span className="text-[8.5px] font-medium text-pink-300/80 bg-pink-500/10 px-1.5 rounded-full border border-pink-500/20 leading-none">
          Sana Özel
        </span>
      </div>

      {/* Horizontal Scroll Strip */}
      <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory py-0 scrollbar-none -mx-1 px-1">
        {isLoading
          ? [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 snap-start h-8 w-36 bg-white/5 border border-white/10 rounded-full px-1 animate-pulse flex items-center gap-1.5"
              >
                <div className="w-6 h-6 bg-white/10 rounded-full flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <div className="h-2 bg-white/10 rounded w-3/4" />
                  <div className="h-1.5 bg-white/10 rounded w-1/2" />
                </div>
                <div className="w-6 h-6 bg-white/10 rounded-full flex-shrink-0" />
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
                  whileHover={{ y: -1 }}
                  onClick={() => handlePlay(song)}
                  className={`flex-shrink-0 snap-start cursor-pointer h-8 bg-white/10 hover:bg-white/15 backdrop-blur-xl border ${
                    isCurrent
                      ? 'border-pink-500/60 bg-pink-500/15'
                      : 'border-white/15 hover:border-pink-500/40'
                  } rounded-full pl-1 pr-1 flex items-center gap-1.5 transition-all duration-200 shadow-md group`}
                >
                  {/* Cover Thumbnail */}
                  <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-900/50 border border-white/10 flex-shrink-0 flex items-center justify-center">
                    {song.cover_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={song.cover_url}
                        alt={song.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <Music size={12} className="text-purple-300" />
                    )}
                  </div>

                  {/* Song Metadata */}
                  <div className="min-w-0 flex-1 max-w-[100px] sm:max-w-[120px]">
                    <h4
                      className="text-[10px] font-bold text-white truncate group-hover:text-pink-300 transition-colors leading-tight"
                      title={song.title}
                    >
                      {song.title}
                    </h4>
                    <p
                      className="text-[8.5px] text-purple-200/70 truncate font-medium leading-none mt-0.5"
                      title={song.artist}
                    >
                      {song.artist}
                    </p>
                  </div>

                  {/* Single Queue Action Button (24px x 24px) */}
                  <button
                    type="button"
                    onClick={(e) => handleQueue(e, song)}
                    className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all border ${
                      isAdded
                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                        : 'bg-white/10 hover:bg-pink-500/20 text-gray-200 hover:text-pink-300 border-white/10 hover:border-pink-500/40'
                    }`}
                    title={isAdded ? 'Sıraya Eklendi' : 'Sıraya Ekle'}
                    aria-label={isAdded ? 'Sıraya Eklendi' : 'Sıraya Ekle'}
                  >
                    {isAdded ? (
                      <Check size={12} className="text-green-400" />
                    ) : (
                      <Plus size={12} />
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
