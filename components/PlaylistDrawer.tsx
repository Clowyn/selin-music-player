'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, X, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/store/playerStore';
import { Playlist, Song } from '@/lib/types';

type PlaylistWithCount = Playlist & { songs?: { count: number }[] };

export default function PlaylistDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { currentPlaylist, setCurrentPlaylist, setSongs, setCurrentSong } = usePlayerStore();

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    
    Promise.resolve().then(() => {
      if (isMounted) setLoading(true);
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
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors shadow-lg"
        aria-label="Çalma Listesi"
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
              <div className="p-4 flex items-center justify-between border-b border-white/10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <List size={20} className="text-pink-400" />
                  Çalma Listeleri
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1">
                {loading ? (
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
                          className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition-all ${isCurrent ? 'bg-pink-500/20 border border-pink-500/50' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
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
                        Henüz çalma listesi bulunmuyor. (No playlists found)
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
