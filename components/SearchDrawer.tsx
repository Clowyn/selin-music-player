'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Play, Plus, Heart, Loader2, Music, CheckCircle2, ListPlus, Sparkles } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { YouTubeSearchResult, Song } from '@/lib/types';
import AddToPlaylistModal from './AddToPlaylistModal';

export function SearchDrawer() {
  const {
    searchDrawerOpen,
    setSearchDrawerOpen,
    currentSong,
    setCurrentSong,
    play,
    addToQueue,
    favorites,
    toggleFavorite,
  } = usePlayerStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Recommendations state when query is empty
  const [recommendations, setRecommendations] = useState<YouTubeSearchResult[]>([]);
  const [isRecsLoading, setIsRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (searchDrawerOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [searchDrawerOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const songToYouTubeSearchResult = (song: Song): YouTubeSearchResult => {
    const ytId = song.youtube_id || song.id.replace(/^yt-/, '');
    const mins = Math.floor((song.duration || 0) / 60);
    const secs = Math.floor((song.duration || 0) % 60);
    const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return {
      id: ytId,
      title: song.title,
      channelTitle: song.artist,
      thumbnail: song.cover_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      duration: durationStr,
      durationSeconds: song.duration || 210,
    };
  };

  // Fetch recommendations for empty state
  useEffect(() => {
    if (!searchDrawerOpen) return;

    let isMounted = true;
    const fetchRecommendations = async () => {
      setIsRecsLoading(true);
      setRecsError(false);

      try {
        let url = '/api/recommendations?limit=8';
        if (currentSong?.title && currentSong?.artist) {
          url += `&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
        } else if (currentSong?.title) {
          url += `&title=${encodeURIComponent(currentSong.title)}`;
        } else {
          url += `&title=Yolla&artist=Tarkan`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Öneriler yüklenemedi');
        const data = await res.json();

        if (isMounted && data.recommendations && Array.isArray(data.recommendations)) {
          const mapped: YouTubeSearchResult[] = data.recommendations.map((s: Song) =>
            songToYouTubeSearchResult(s)
          );
          setRecommendations(mapped);
        }
      } catch (err) {
        console.error('Error fetching recommendations in SearchDrawer:', err);
        if (isMounted) setRecsError(true);
      } finally {
        if (isMounted) setIsRecsLoading(false);
      }
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
    };
  }, [searchDrawerOpen, currentSong?.title, currentSong?.artist]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error('Arama başarısız');
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      showToast('Arama sırasında bir hata oluştu');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search trigger (400ms)
  useEffect(() => {
    if (!query.trim()) {
      Promise.resolve().then(() => {
        setResults([]);
        setHasSearched(false);
      });
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const convertToSong = (yt: YouTubeSearchResult): Song => ({
    id: `yt-${yt.id}`,
    title: yt.title,
    artist: yt.channelTitle,
    audio_url: `https://www.youtube.com/watch?v=${yt.id}`,
    youtube_id: yt.id,
    duration: yt.durationSeconds || 210,
    cover_url: yt.thumbnail,
  });

  const handlePlayNow = (item: YouTubeSearchResult) => {
    const song = convertToSong(item);
    setCurrentSong(song);
    play();
    setSearchDrawerOpen(false);
    showToast(`"${item.title.slice(0, 24)}..." oynatılıyor ▶`);
  };

  const handleAddToQueue = (item: YouTubeSearchResult) => {
    const song = convertToSong(item);
    addToQueue(song);
    showToast(`"${item.title.slice(0, 24)}..." sıraya eklendi! ✨`);
  };

  const handleToggleFavorite = async (item: YouTubeSearchResult) => {
    const song = convertToSong(item);
    const currentlyFav = favorites.some(
      (f) => f.youtube_id === item.id || f.id === song.id
    );
    await toggleFavorite(song);
    showToast(currentlyFav ? 'Favorilerden çıkarıldı 💔' : 'Favorilere eklendi! 💖');
  };

  const isFavorited = (ytId: string) => {
    return favorites.some((f) => f.youtube_id === ytId || f.id === `yt-${ytId}`);
  };

  const [addToPlaylistSong, setAddToPlaylistSong] = useState<Song | null>(null);

  const handleAddToPlaylist = (item: YouTubeSearchResult) => {
    const song = convertToSong(item);
    setAddToPlaylistSong(song);
  };

  return (
    <>
      {/* Floating Search Trigger Button */}
      <button
        onClick={() => setSearchDrawerOpen(true)}
        className="p-3 bg-gradient-to-r from-pink-500/20 to-purple-600/20 backdrop-blur-md border border-pink-500/30 rounded-full text-pink-300 hover:text-white hover:bg-pink-500/30 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
        aria-label="YouTube'da Ara"
        title="YouTube'da Şarkı Ara"
      >
        <Search size={22} className="text-pink-400" />
      </button>

      <AnimatePresence>
        {searchDrawerOpen && (
          <>
            {/* Dark glass backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
            />

            {/* Slide-up drawer panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[85vh] max-w-3xl mx-auto bg-gray-950/90 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(236,72,153,0.15)] flex flex-col overflow-hidden"
            >
              {/* Top Handle / Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Search size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">
                      YouTube&apos;da Şarkı Ara
                    </h2>
                    <p className="text-xs text-purple-300/70">
                      Milyonlarca şarkıyı bul ve listene ekle
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSearchDrawerOpen(false)}
                  className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
                  aria-label="Kapat"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Toast Notification Banner */}
              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-semibold py-2.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle2 size={16} />
                    <span>{toastMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search Form */}
              <form onSubmit={handleSubmit} className="p-4">
                <div className="relative flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={"YouTube'da Şarkı Ara... (örn: Tarkan - Yolla)"}
                    className="w-full bg-white/10 border border-white/15 rounded-2xl py-3.5 pl-12 pr-28 text-white placeholder-gray-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 transition text-sm shadow-inner"
                  />
                  <Search
                    size={20}
                    className="absolute left-4 text-pink-400 pointer-events-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-24 text-gray-400 hover:text-white p-1"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="absolute right-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-medium text-xs disabled:opacity-50 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      'Ara'
                    )}
                  </button>
                </div>
              </form>

              {/* Results Container */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-20 bg-white/5 border border-white/5 rounded-2xl animate-pulse flex items-center p-3 gap-3"
                      >
                        <div className="w-14 h-14 bg-white/10 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-white/10 rounded w-3/4" />
                          <div className="h-3 bg-white/10 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  results.map((item) => {
                    const favorited = isFavorited(item.id);
                    return (
                      <div
                        key={item.id}
                        className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all duration-200 shadow-sm"
                      >
                        {/* Thumbnail & Video Info */}
                        <div
                          onClick={() => handlePlayNow(item)}
                          className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-pink-600/30 transition-colors flex items-center justify-center">
                              <Play
                                size={22}
                                className="text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform"
                              />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white truncate group-hover:text-pink-300 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-xs text-gray-400 truncate mt-0.5 font-medium">
                              {item.channelTitle}
                            </p>
                            {item.duration && (
                              <span className="inline-block mt-1 text-[11px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                                {item.duration}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Play Now Button */}
                          <button
                            onClick={() => handlePlayNow(item)}
                            className="px-3 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white border border-pink-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                            title="Hemen Oynat"
                          >
                            <Play size={14} className="fill-current" />
                            <span className="hidden sm:inline">▶ Oynat</span>
                          </button>

                          {/* Add to Queue Button */}
                          <button
                            onClick={() => handleAddToQueue(item)}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
                            title="Sıraya Ekle"
                          >
                            <Plus size={14} />
                            <span className="hidden sm:inline">+ Sıraya Ekle</span>
                          </button>

                          {/* Toggle Favorite Button */}
                          <button
                            onClick={() => handleToggleFavorite(item)}
                            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                              favorited
                                ? 'bg-pink-500/30 text-pink-400 border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-pink-400 border-white/10'
                            }`}
                            title={favorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                          >
                            <Heart
                              size={16}
                              className={favorited ? 'fill-pink-400 text-pink-400' : ''}
                            />
                          </button>

                          {/* Add to Playlist Button */}
                          <button
                            onClick={() => handleAddToPlaylist(item)}
                            className="p-2.5 rounded-xl border border-white/10 bg-white/10 hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 transition-all active:scale-95"
                            title="Listeye Ekle"
                          >
                            <ListPlus size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : hasSearched ? (
                  <div className="flex flex-col items-center justify-center h-56 gap-3 text-gray-400">
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <Music size={28} className="text-gray-500" />
                    </div>
                    <p className="text-base font-semibold text-white">Sonuç Bulunamadı</p>
                    <p className="text-xs text-gray-400 text-center max-w-xs">
                      Farklı anahtar kelimeler ile tekrar aramayı deneyin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Section Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-pink-400 animate-pulse" />
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          🎵 Sana Özel Öneriler
                        </h3>
                      </div>
                      <span className="text-[11px] text-purple-300/70 font-medium bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                        {currentSong?.artist ? `"${currentSong.artist}" tarzında` : 'Öne Çıkanlar'}
                      </span>
                    </div>

                    {/* List / Skeleton / Empty State */}
                    {isRecsLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div
                            key={i}
                            className="h-20 bg-white/5 border border-white/5 rounded-2xl animate-pulse flex items-center p-3 gap-3"
                          >
                            <div className="w-14 h-14 bg-white/10 rounded-xl flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-white/10 rounded w-3/4" />
                              <div className="h-3 bg-white/10 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {recommendations.map((item) => {
                          const favorited = isFavorited(item.id);
                          return (
                            <div
                              key={`rec-${item.id}`}
                              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all duration-200 shadow-sm"
                            >
                              {/* Thumbnail & Video Info */}
                              <div
                                onClick={() => handlePlayNow(item)}
                                className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-200">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.thumbnail}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 group-hover:bg-pink-600/30 transition-colors flex items-center justify-center">
                                    <Play
                                      size={22}
                                      className="text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform"
                                    />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-pink-300 transition-colors">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-gray-400 truncate mt-0.5 font-medium">
                                    {item.channelTitle}
                                  </p>
                                  {item.duration && (
                                    <span className="inline-block mt-1 text-[11px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                                      {item.duration}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handlePlayNow(item)}
                                  className="px-3 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white border border-pink-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                                  title="Hemen Oynat"
                                >
                                  <Play size={14} className="fill-current" />
                                  <span className="hidden sm:inline">▶ Oynat</span>
                                </button>

                                <button
                                  onClick={() => handleAddToQueue(item)}
                                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
                                  title="Sıraya Ekle"
                                >
                                  <Plus size={14} />
                                  <span className="hidden sm:inline">+ Sıraya Ekle</span>
                                </button>

                                <button
                                  onClick={() => handleToggleFavorite(item)}
                                  className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                                    favorited
                                      ? 'bg-pink-500/30 text-pink-400 border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                                      : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-pink-400 border-white/10'
                                  }`}
                                  title={favorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                                >
                                  <Heart
                                    size={16}
                                    className={favorited ? 'fill-pink-400 text-pink-400' : ''}
                                  />
                                </button>

                                <button
                                  onClick={() => handleAddToPlaylist(item)}
                                  className="p-2.5 rounded-xl border border-white/10 bg-white/10 hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 transition-all active:scale-95"
                                  title="Listeye Ekle"
                                >
                                  <ListPlus size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-600/10 border border-pink-500/20 flex items-center justify-center">
                          <Sparkles size={28} className="text-pink-400" />
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {recsError ? 'Öneriler Yüklenemedi' : 'Öneri Bulunamadı'}
                        </p>
                        <p className="text-xs text-purple-200/60 text-center max-w-xs">
                          Arama kutusuna şarkı veya sanatçı adı yazarak keşfetmeye başlayabilirsiniz.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add to Playlist Modal */}
      {addToPlaylistSong && (
        <AddToPlaylistModal
          isOpen={!!addToPlaylistSong}
          onClose={() => setAddToPlaylistSong(null)}
          song={addToPlaylistSong}
        />
      )}
    </>
  );
}

export default SearchDrawer;

