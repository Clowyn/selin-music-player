'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, X, Music, Heart, Play, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/store/playerStore';
import { Playlist, Song } from '@/lib/types';

type PlaylistWithCount = Playlist & { songs?: { count: number }[] };

export default function PlaylistDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlists' | 'favorites'>('playlists');
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  const {
    currentPlaylist,
    setCurrentPlaylist,
    setSongs,
    setCurrentSong,
    currentSong,
    favorites,
    fetchFavorites,
    play
  } = usePlayerStore();

  useEffect(() => {
    if (!isOpen) return;

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
    }
  }, [isOpen, activeTab, fetchFavorites]);

  const handleSelectPlaylist = async (playlist: PlaylistWithCount) => {
    setCurrentPlaylist(playlist as Playlist);
    setIsOpen(false);
    
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
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => {
          setIsOpen(true);
          fetchFavorites();
        }}
        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors shadow-lg"
        aria-label="Çalma Listesi ve Favoriler"
      >
        <List size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-gray-900/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl z-50 flex flex-col"
            >
              {/* Header with Tabs */}
              <div className="p-4 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2 bg-black/30 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('playlists')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
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
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                      activeTab === 'favorites'
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Heart size={16} className={activeTab === 'favorites' ? 'fill-white' : ''} />
                    💖 Favorilerim
                  </button>
                </div>

                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="p-4 overflow-y-auto flex-1">
                {activeTab === 'playlists' ? (
                  loadingPlaylists ? (
                    <div className="space-y-4 animate-pulse">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-white/5 rounded-xl"></div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {playlists.map(pl => {
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
                    </div>
                  )
                ) : (
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
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
