'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ListPlus, Check, Loader2, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/store/playerStore';
import { Playlist, Song } from '@/lib/types';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
}

export default function AddToPlaylistModal({ isOpen, onClose, song }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { currentPlaylist } = usePlayerStore();

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    const fetchPlaylists = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (mounted) {
        if (!fetchError && data) {
          setPlaylists(data as Playlist[]);
        }
        setLoading(false);
      }
    };

    fetchPlaylists();
    return () => { mounted = false; };
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setShowCreateInput(false);
        setNewPlaylistName('');
        setAddedTo(null);
        setError(null);
      });
    }
  }, [isOpen]);

  const handleAddToPlaylist = async (playlist: Playlist) => {
    setError(null);
    setAddedTo(null);

    try {
      // Check if song already exists in this playlist
      let alreadyExists = false;

      if (song.youtube_id) {
        const { data: existing } = await supabase
          .from('songs')
          .select('id')
          .eq('playlist_id', playlist.id)
          .eq('youtube_id', song.youtube_id)
          .limit(1);
        alreadyExists = !!(existing && existing.length > 0);
      } else {
        const { data: existing } = await supabase
          .from('songs')
          .select('id')
          .eq('playlist_id', playlist.id)
          .eq('title', song.title)
          .eq('artist', song.artist)
          .limit(1);
        alreadyExists = !!(existing && existing.length > 0);
      }

      if (alreadyExists) {
        setError('Bu şarkı zaten bu listede mevcut!');
        setTimeout(() => setError(null), 2500);
        return;
      }

      // Get max track_order for the playlist
      const { data: maxOrderData } = await supabase
        .from('songs')
        .select('track_order')
        .eq('playlist_id', playlist.id)
        .order('track_order', { ascending: false })
        .limit(1);

      const rawOrder = maxOrderData?.[0]
        ? (maxOrderData[0] as Record<string, unknown>).track_order
        : null;
      const nextOrder = typeof rawOrder === 'number' ? rawOrder + 1 : 0;

      // Build audio_url: use existing, or construct from youtube_id, or empty
      const audioUrl = song.audio_url
        || (song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : '');

      // Insert the song into the playlist
      const { error: insertError } = await supabase.from('songs').insert({
        playlist_id: playlist.id,
        title: song.title || 'Bilinmeyen Şarkı',
        artist: song.artist || 'Bilinmeyen Sanatçı',
        audio_url: audioUrl,
        youtube_id: song.youtube_id || null,
        cover_url: song.cover_url || null,
        duration: typeof song.duration === 'number' ? song.duration : 0,
        track_order: nextOrder,
      });

      if (insertError) {
        console.error('Insert error:', insertError);
        setError(`Hata: ${insertError.message || 'Bilinmeyen hata'}`);
        return;
      }

      setAddedTo(playlist.id);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Add to playlist error:', err);
      setError('Beklenmeyen bir hata oluştu.');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    setError(null);

    try {
      // Create the playlist
      const { data: newPlaylist, error: createError } = await supabase
        .from('playlists')
        .insert({ name: newPlaylistName.trim() })
        .select()
        .single();

      if (createError || !newPlaylist) {
        setError('Liste oluşturulurken hata oluştu.');
        setCreating(false);
        return;
      }

      const playlist = newPlaylist as Playlist;

      // Add the song to the new playlist
      const newAudioUrl = song.audio_url
        || (song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : '');
      await supabase.from('songs').insert({
        playlist_id: playlist.id,
        title: song.title || 'Bilinmeyen Şarkı',
        artist: song.artist || 'Bilinmeyen Sanatçı',
        audio_url: newAudioUrl,
        youtube_id: song.youtube_id || null,
        cover_url: song.cover_url || null,
        duration: typeof song.duration === 'number' ? song.duration : 0,
        track_order: 0,
      });

      setPlaylists(prev => [playlist, ...prev]);
      setAddedTo(playlist.id);
      setShowCreateInput(false);
      setNewPlaylistName('');
      setCreating(false);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Create playlist error:', err);
      setError('Beklenmeyen bir hata oluştu.');
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-gray-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(236,72,153,0.2)] z-[61] overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-md">
                  <ListPlus size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Listeye Ekle</h2>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">
                    {song.title} — {song.artist}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error/Success Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/20 border-b border-red-500/30 text-red-300 text-xs font-medium py-2.5 px-5 text-center"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Create New Playlist */}
            <div className="p-4 pb-2 border-b border-white/10">
              {showCreateInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                    placeholder="Yeni liste adı..."
                    autoFocus
                    className="flex-1 bg-white/10 border border-white/15 rounded-xl py-2.5 px-4 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 transition"
                  />
                  <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim() || creating}
                    className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Oluştur
                  </button>
                  <button
                    onClick={() => { setShowCreateInput(false); setNewPlaylistName(''); }}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateInput(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-pink-500/50 text-gray-300 hover:text-white transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center">
                    <Plus size={18} className="text-pink-400" />
                  </div>
                  <span className="text-sm font-semibold">Yeni Çalma Listesi Oluştur</span>
                </button>
              )}
            </div>

            {/* Playlist List */}
            <div className="p-4 pt-2 max-h-[40vh] overflow-y-auto space-y-2">
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-white/5 rounded-xl" />
                  ))}
                </div>
              ) : playlists.length > 0 ? (
                playlists.map(pl => {
                  const isCurrentPl = currentPlaylist?.id === pl.id;
                  const justAdded = addedTo === pl.id;

                  return (
                    <button
                      key={pl.id}
                      onClick={() => !justAdded && handleAddToPlaylist(pl)}
                      disabled={justAdded}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
                        justAdded
                          ? 'bg-green-500/20 border border-green-500/40'
                          : isCurrentPl
                          ? 'bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20'
                          : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/15'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        justAdded
                          ? 'bg-green-500/30'
                          : isCurrentPl
                          ? 'bg-pink-500/20 border border-pink-500/30'
                          : 'bg-white/10'
                      }`}>
                        {justAdded ? (
                          <Check size={20} className="text-green-400" />
                        ) : (
                          <Music size={18} className={isCurrentPl ? 'text-pink-400' : 'text-gray-400'} />
                        )}
                      </div>
                      <div className="flex-1 text-left overflow-hidden">
                        <h4 className={`text-sm font-semibold truncate ${
                          justAdded ? 'text-green-300' : isCurrentPl ? 'text-pink-300' : 'text-white'
                        }`}>
                          {pl.name}
                        </h4>
                        {pl.mood_description && (
                          <p className="text-xs text-gray-400 truncate">{pl.mood_description}</p>
                        )}
                      </div>
                      {justAdded && (
                        <span className="text-xs text-green-400 font-semibold flex-shrink-0">Eklendi! ✓</span>
                      )}
                      {isCurrentPl && !justAdded && (
                        <span className="text-[10px] text-pink-400 bg-pink-500/20 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          Şu an çalıyor
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Music size={32} className="mx-auto mb-3 text-gray-500" />
                  <p className="text-sm">Henüz çalma listesi yok.</p>
                  <p className="text-xs text-gray-500 mt-1">Yukarıdan yeni bir liste oluşturabilirsiniz.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
