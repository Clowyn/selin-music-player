'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MicVocal, Music, FileText, RefreshCw, Target, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  lyrics: string | null;
  synced: boolean;
  lines?: LyricLine[];
  error?: string;
}

/**
 * Binary search to find active line index based on current playback timestamp.
 */
function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
  if (!lines || lines.length === 0) return -1;
  if (currentTime < lines[0].time) return -1;

  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

export default function LyricsSheet() {
  const {
    currentSong,
    currentTime,
    seekTo,
    isLyricsOpen,
    setLyricsOpen,
  } = usePlayerStore();

  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [fetchingSongId, setFetchingSongId] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const songId = currentSong?.id || currentSong?.title || '';

  // Fetch lyrics when sheet opens or when currentSong changes while sheet is open
  useEffect(() => {
    if (!isLyricsOpen || !currentSong?.title) {
      return;
    }

    let isMounted = true;

    const title = encodeURIComponent(currentSong.title);
    const artist = encodeURIComponent(currentSong.artist || '');

    fetch(`/api/lyrics?title=${title}&artist=${artist}`)
      .then((res) => res.json())
      .then((data: LyricsData) => {
        if (isMounted) {
          setLyricsData(data);
          setFetchingSongId(null);
          setIsUserScrolling(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Fetch lyrics error:', err);
          setLyricsData({ lyrics: null, synced: false, error: 'Şarkı sözleri yüklenirken bir hata oluştu' });
          setFetchingSongId(null);
          setIsUserScrolling(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isLyricsOpen, currentSong]);

  const handleClose = () => {
    setLyricsOpen(false);
    setIsUserScrolling(false);
  };

  const handleRetry = () => {
    if (!currentSong?.title) return;
    setFetchingSongId(songId);
    setLyricsData(null);

    const title = encodeURIComponent(currentSong.title);
    const artist = encodeURIComponent(currentSong.artist || '');

    fetch(`/api/lyrics?title=${title}&artist=${artist}`)
      .then((res) => res.json())
      .then((data: LyricsData) => {
        setLyricsData(data);
        setFetchingSongId(null);
      })
      .catch((err) => {
        console.error('Fetch lyrics error:', err);
        setLyricsData({ lyrics: null, synced: false, error: 'Şarkı sözleri yüklenirken bir hata oluştu' });
        setFetchingSongId(null);
      });
  };

  const isLoading = fetchingSongId === songId || (!lyricsData && isLyricsOpen && !!currentSong?.title);

  const activeIndex = lyricsData?.synced && lyricsData.lines
    ? findActiveLineIndex(lyricsData.lines, currentTime)
    : -1;

  // Smooth auto-scroll to active line
  useEffect(() => {
    if (isUserScrolling || activeIndex === -1 || !isLyricsOpen) return;
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isUserScrolling, isLyricsOpen]);

  // Handle manual scroll detection
  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4000);
  };

  const handleLineClick = (time: number) => {
    seekTo(time);
    setIsUserScrolling(false);
  };

  const handleReturnToActiveLine = () => {
    setIsUserScrolling(false);
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  return (
    <AnimatePresence>
      {isLyricsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />

          {/* Slide-Up Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 z-50 h-[85vh] max-w-3xl mx-auto bg-gray-900/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(236,72,153,0.15)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-md">
                  <MicVocal size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight line-clamp-1">
                    {currentSong?.title || 'Şarkı Sözleri'}
                  </h2>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {currentSong?.artist || 'Bilinmeyen Sanatçı'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Kapat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
              {isLoading ? (
                /* Loading State */
                <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
                  <Loader2 size={36} className="text-pink-400 animate-spin mb-3" />
                  <p className="text-sm font-medium text-gray-300">
                    Şarkı sözleri yükleniyor...
                  </p>
                </div>
              ) : lyricsData?.synced && lyricsData.lines && lyricsData.lines.length > 0 ? (
                /* Synced Karaoke View */
                <div
                  ref={containerRef}
                  onWheel={handleScroll}
                  onTouchMove={handleScroll}
                  className="flex-1 overflow-y-auto px-6 py-12 space-y-2 scroll-smooth"
                >
                  {lyricsData.lines.map((line, index) => {
                    const isActive = index === activeIndex;
                    const isPast = index < activeIndex;

                    return (
                      <div
                        key={`${line.time}-${index}`}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => handleLineClick(line.time)}
                        className={`transition-all duration-300 cursor-pointer select-none text-center ${
                          isActive
                            ? 'py-3 px-6 my-2 rounded-2xl bg-pink-500/15 border border-pink-500/40 text-pink-400 font-bold text-lg sm:text-xl scale-105 shadow-[0_0_20px_rgba(236,72,153,0.25)] flex items-center justify-center gap-2'
                            : isPast
                            ? 'py-2 px-4 text-gray-400 font-medium text-base scale-95 opacity-70 hover:opacity-100 hover:text-white'
                            : 'py-2 px-4 text-gray-500 font-normal text-base scale-95 opacity-50 hover:opacity-100 hover:text-gray-300'
                        }`}
                      >
                        {isActive && (
                          <MicVocal size={18} className="text-pink-400 animate-pulse flex-shrink-0" />
                        )}
                        <span>{line.text || '♪'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : lyricsData?.lyrics ? (
                /* Static Plain Lyrics View */
                <div className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
                  <div className="flex items-center justify-center gap-2 mb-6 text-xs text-purple-300/80 bg-purple-500/10 py-1.5 px-4 rounded-full border border-purple-500/20 max-w-fit mx-auto">
                    <FileText size={14} />
                    <span>Statik Şarkı Sözleri (Zaman Senkronizasyonu Yok)</span>
                  </div>
                  <div className="text-gray-200 text-base sm:text-lg leading-relaxed text-center font-medium whitespace-pre-wrap select-text max-w-xl mx-auto space-y-2">
                    {lyricsData.lyrics}
                  </div>
                </div>
              ) : (
                /* Empty / Not Found State */
                <div className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(236,72,153,0.15)]">
                    <Music size={40} className="text-pink-400 opacity-80 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    Şarkı Sözü Bulunamadı
                  </h3>
                  <p className="text-xs text-gray-400 max-w-xs mb-6">
                    {currentSong?.title
                      ? `"${currentSong.title}" için zaman senkronizasyonlu veya statik şarkı sözü bulunamadı.`
                      : 'Şu anda çalan bir şarkı bulunmuyor.'}
                  </p>
                  {currentSong?.title && (
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2.5 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-xl text-xs font-semibold border border-pink-500/30 transition-all flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      <span>Tekrar Deneyin</span>
                    </button>
                  )}
                </div>
              )}

              {/* Floating Return Button when manually scrolling synced lyrics */}
              {isUserScrolling && lyricsData?.synced && activeIndex !== -1 && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={handleReturnToActiveLine}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-xs font-semibold shadow-lg backdrop-blur-md border border-white/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all z-10"
                >
                  <Target size={14} />
                  <span>Canlı Sözlere Dön</span>
                </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
