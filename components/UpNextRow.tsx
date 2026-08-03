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
                      /* eslint-disable-next-line @next/next/no-img-element */
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
