'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, X, Music, Heart, Play, Video, Download, Sparkles, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/store/playerStore';
import { Playlist, Song } from '@/lib/types';
import ImportPlaylistModal from './ImportPlaylistModal';

type PlaylistWithCount = Playlist & { songs?: { count: number }[] };

export default function PlaylistDrawer() {
  const [activeTab, setActiveTab] = useState<'playlists' | 'favorites' | 'discover'>('playlists');
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const {
    isPlaylistOpen,
    setPlaylistOpen,
    currentPlaylist,
    setCurrentPlaylist,
    setSongs,
    setCurrentSong,
    currentSong,
    favorites,
    fetchFavorites,
    play,
    addToQueue,
    toggleFavorite,
  } = usePlayerStore();

  const currentSongTitle = currentSong?.title;
  const currentSongArtist = currentSong?.artist;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (!isPlaylistOpen) return;

    if (activeTab === 'playlists') {
      let isMounted = true;
      Promise.resolve().then(() => {
        if (isMounted) setLoadingPlaylists(true);
      });

      supabase
        .from('playlists')
        .select('*, songs(count)')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (isMounted) {
            if (!error && data) {
              setPlaylists(data as PlaylistWithCount[]);
            }
            setLoadingPlaylists(false);
          }
        });

      return () => {
        isMounted = false;
      };
    } else if (activeTab === 'favorites') {
      fetchFavorites();
    } else if (activeTab === 'discover') {
      let isMounted = true;

      if (!currentSongTitle) {
        Promise.resolve().then(() => {
          if (isMounted) {
            setRecommendations([]);
            setLoadingRecommendations(false);
            setRecommendationsError(null);
          }
        });
        return () => {
          isMounted = false;
        };
      }

      Promise.resolve().then(() => {
        if (isMounted) {
          setLoadingRecommendations(true);
          setRecommendationsError(null);
        }
      });

      const titleParam = encodeURIComponent(currentSongTitle);
      const artistParam = encodeURIComponent(currentSongArtist || '');
      const url = `/api/recommendations?title=${titleParam}&artist=${artistParam}&limit=15`;

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('Öneriler alınamadı');
          return res.json();
        })
        .then((data) => {
          if (isMounted) {
            setRecommendations(data.recommendations || []);
            setLoadingRecommendations(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Fetch recommendations error:', err);
            setRecommendationsError('Öneriler yüklenirken bir hata oluştu.');
            setLoadingRecommendations(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isPlaylistOpen, activeTab, fetchFavorites, currentSongTitle, currentSongArtist]);

  const handleSelectPlaylist = async (playlist: PlaylistWithCount) => {
    setCurrentPlaylist(playlist as Playlist);
    setPlaylistOpen(false);
    
    // Fetch songs
    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .eq('playlist_id', playlist.id)
      .order('track_order', { ascending: true });
      
    if (songsData && songsData.length > 0) {
      const typedSongs = songsData as Song[];
      setSongs(typedSongs);
      setCurrentSong(typedSongs[0]);
    } else {
      setSongs([]);
    }
  };

  const handleSelectFavoriteSong = (song: Song) => {
    setSongs(favorites);
    setCurrentSong(song);
    play();
    setPlaylistOpen(false);
  };

  const handlePlayRecommendation = (song: Song) => {
    setCurrentSong(song);
    play();
    setPlaylistOpen(false);
    showToast(`"${song.title.slice(0, 20)}..." oynatılıyor ▶`);
  };

  const handleAddToQueueRecommendation = (song: Song) => {
    addToQueue(song);
    showToast(`"${song.title.slice(0, 20)}..." sıraya eklendi! ✨`);
  };

  const handleToggleFavoriteRecommendation = async (song: Song) => {
    const isFav = favorites.some(
      (f) => f.id === song.id || (song.youtube_id && f.youtube_id === song.youtube_id)
    );
    await toggleFavorite(song);
    showToast(isFav ? 'Favorilerden çıkarıldı 💔' : 'Favorilere eklendi! 💖');
  };

  const isSongFavorited = (song: Song) => {
    return favorites.some(
      (f) => f.id === song.id || (song.youtube_id && f.youtube_id === song.youtube_id)
    );
  };

  return (
    <>
      <button 
        onClick={() => {
          setPlaylistOpen(true);
          fetchFavorites();
        }}
        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors shadow-lg"
        aria-label="Çalma Listesi, Favoriler ve Keşfet"
      >
        <List size={24} />
      </button>

      <AnimatePresence>
        {isPlaylistOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlaylistOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-gray-900/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header with Tabs */}
              <div className="p-4 flex items-center justify-between border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 bg-black/30 p-1 rounded-xl overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setActiveTab('playlists')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
                      activeTab === 'playlists'
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <List size={16} />
                    Çalma Listeleri
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('favorites');
                      fetchFavorites();
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
                      activeTab === 'favorites'
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Heart size={16} className={activeTab === 'favorites' ? 'fill-white' : ''} />
                    💖 Favorilerim
                  </button>

                  <button
                    onClick={() => setActiveTab('discover')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
                      activeTab === 'discover'
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sparkles size={16} className={activeTab === 'discover' ? 'text-white' : ''} />
                    Keşfet
                  </button>
                </div>

                <button 
                  onClick={() => setPlaylistOpen(false)} 
                  className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors ml-2"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Toast Notification Banner */}
              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md flex-shrink-0"
                  >
                    <CheckCircle2 size={15} />
                    <span>{toastMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Tab Content */}
              <div className="p-4 overflow-y-auto flex-1">
                {activeTab === 'playlists' ? (
                  loadingPlaylists ? (
                    <div className="space-y-4 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 bg-white/5 rounded-xl"></div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {playlists.map((pl) => {
                        const isCurrent = currentPlaylist?.id === pl.id;
                        return (
                          <button
                            key={pl.id}
                            onClick={() => handleSelectPlaylist(pl)}
                            className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition-all ${
                              isCurrent ? 'bg-pink-500/20 border border-pink-500/50' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            <div>
                              <h3 className={`font-semibold ${isCurrent ? 'text-pink-300' : 'text-white'}`}>{pl.name}</h3>
                              {pl.mood_description && (
                                <p className="text-sm text-gray-400 mt-1">{pl.mood_description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full">
                              <Music size={14} className="text-purple-400" />
                              <span className="text-sm text-gray-300">{pl.songs?.[0]?.count || 0}</span>
                            </div>
                          </button>
                        );
                      })}
                      
                      {playlists.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                          Henüz çalma listesi bulunmuyor.
                        </div>
                      )}

                      {/* Import Playlist Button */}
                      <button
                        onClick={() => setShowImport(true)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-green-500/50 text-gray-300 hover:text-white transition-all active:scale-[0.98] mt-2"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-purple-600/20 border border-green-500/30 flex items-center justify-center">
                          <Download size={18} className="text-green-400" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-semibold block">Playlist İçe Aktar</span>
                          <span className="text-[11px] text-gray-500">Spotify · YouTube Music</span>
                        </div>
                      </button>
                    </div>
                  )
                ) : activeTab === 'favorites' ? (
                  /* Favorilerim tab content */
                  <div className="space-y-3">
                    {favorites.map((song) => {
                      const isCurrent = currentSong?.id === song.id;
                      return (
                        <button
                          key={song.id}
                          onClick={() => handleSelectFavoriteSong(song)}
                          className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all ${
                            isCurrent
                              ? 'bg-pink-500/20 border border-pink-500/50 text-pink-300'
                              : 'bg-white/5 hover:bg-white/10 border border-transparent text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {song.cover_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                            ) : song.youtube_id ? (
                              <div className="w-12 h-12 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                                <Video size={20} className="text-red-400" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                <Music size={20} className="text-purple-400" />
                              </div>
                            )}

                            <div className="overflow-hidden">
                              <h3 className={`font-semibold truncate ${isCurrent ? 'text-pink-300' : 'text-white'}`}>
                                {song.title}
                              </h3>
                              <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isCurrent && <Play size={16} className="text-pink-400 fill-pink-400 animate-pulse" />}
                            <Heart size={18} className="text-pink-500 fill-pink-500" />
                          </div>
                        </button>
                      );
                    })}

                    {favorites.length === 0 && (
                      <div className="text-center py-10 text-gray-400">
                        Henüz favori şarkı eklenmedi. 💖
                      </div>
                    )}
                  </div>
                ) : (
                  /* Keşfet (Discover) tab content */
                  <div className="space-y-3">
                    {!currentSongTitle ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center mb-4">
                          <Sparkles size={32} className="text-pink-400" />
                        </div>
                        <h3 className="text-base font-semibold text-white mb-1">
                          Şu Anda Çalan Şarkı Yok
                        </h3>
                        <p className="text-xs text-gray-400 max-w-xs">
                          Sana özel benzer şarkı önerileri almak için önce bir şarkı çalın! 🎵
                        </p>
                      </div>
                    ) : loadingRecommendations ? (
                      <div className="space-y-3 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="h-20 bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                            <div className="w-14 h-14 bg-white/10 rounded-xl flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-white/10 rounded w-3/4" />
                              <div className="h-3 bg-white/10 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recommendationsError ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                          <AlertCircle size={32} className="text-red-400" />
                        </div>
                        <h3 className="text-base font-semibold text-white mb-1">
                          Öneriler Yüklenemedi
                        </h3>
                        <p className="text-xs text-gray-400 max-w-xs mb-3">
                          {recommendationsError}
                        </p>
                        <button
                          onClick={() => {
                            setRecommendationsError(null);
                            setLoadingRecommendations(true);
                            const titleParam = encodeURIComponent(currentSongTitle);
                            const artistParam = encodeURIComponent(currentSongArtist || '');
                            fetch(`/api/recommendations?title=${titleParam}&artist=${artistParam}&limit=15`)
                              .then((res) => {
                                if (!res.ok) throw new Error('Öneriler alınamadı');
                                return res.json();
                              })
                              .then((data) => {
                                setRecommendations(data.recommendations || []);
                                setLoadingRecommendations(false);
                              })
                              .catch(() => {
                                setRecommendationsError('Öneriler yüklenirken bir hata oluştu.');
                                setLoadingRecommendations(false);
                              });
                          }}
                          className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-xl text-xs font-semibold border border-pink-500/30 transition-colors"
                        >
                          Tekrar Dene
                        </button>
                      </div>
                    ) : recommendations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-600/10 border border-white/10 flex items-center justify-center mb-4">
                          <Music size={32} className="text-purple-400" />
                        </div>
                        <h3 className="text-base font-semibold text-white mb-1">
                          Öneri Bulunamadı
                        </h3>
                        <p className="text-xs text-gray-400 max-w-xs">
                          &quot;{currentSongTitle}&quot; için benzer şarkı bulunamadı.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="px-1 py-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-pink-300 flex items-center gap-1.5 truncate">
                            <Sparkles size={14} className="text-pink-400 flex-shrink-0" />
                            <span className="truncate">&quot;{currentSongTitle}&quot; baz alınarak önerilenler:</span>
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono flex-shrink-0 ml-2">
                            {recommendations.length} şarkı
                          </span>
                        </div>

                        {recommendations.map((song) => {
                          const isCurrent = currentSong?.id === song.id || (song.youtube_id && currentSong?.youtube_id === song.youtube_id);
                          const favorited = isSongFavorited(song);

                          return (
                            <div
                              key={song.id}
                              className={`group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all duration-200 ${
                                isCurrent ? 'bg-pink-500/20 border-pink-500/50' : ''
                              }`}
                            >
                              <div
                                onClick={() => handlePlayRecommendation(song)}
                                className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 cursor-pointer"
                              >
                                {song.cover_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={song.cover_url}
                                    alt={song.title}
                                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform"
                                  />
                                ) : song.youtube_id ? (
                                  <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                                    <Video size={20} className="text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                    <Music size={20} className="text-purple-400" />
                                  </div>
                                )}

                                <div className="overflow-hidden min-w-0">
                                  <h3 className={`font-semibold text-sm truncate ${isCurrent ? 'text-pink-300' : 'text-white group-hover:text-pink-300'}`}>
                                    {song.title}
                                  </h3>
                                  <p className="text-xs text-gray-400 truncate mt-0.5">{song.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => handlePlayRecommendation(song)}
                                  className="px-2.5 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white border border-pink-500/40 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                                  title="Oynat"
                                >
                                  <Play size={13} className="fill-current" />
                                  <span className="hidden sm:inline">Oynat</span>
                                </button>

                                <button
                                  onClick={() => handleAddToQueueRecommendation(song)}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
                                  title="Sıraya Ekle"
                                >
                                  <Plus size={13} />
                                  <span className="hidden sm:inline">+Sıra</span>
                                </button>

                                <button
                                  onClick={() => handleToggleFavoriteRecommendation(song)}
                                  className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                                    favorited
                                      ? 'bg-pink-500/30 text-pink-400 border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                                      : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-pink-400 border-white/10'
                                  }`}
                                  title={favorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                                >
                                  <Heart
                                    size={15}
                                    className={favorited ? 'fill-pink-400 text-pink-400' : ''}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Import Playlist Modal */}
      <ImportPlaylistModal
        isOpen={showImport}
        onClose={() => {
          setShowImport(false);
          // Refresh playlists after import
          if (isPlaylistOpen && activeTab === 'playlists') {
            supabase
              .from('playlists')
              .select('*, songs(count)')
              .order('created_at', { ascending: false })
              .then(({ data }) => {
                if (data) setPlaylists(data as PlaylistWithCount[]);
              });
          }
        }}
      />
    </>
  );
}

