'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2, Music, CheckCircle2, AlertCircle, ListPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ImportedTrack {
  title: string;
  artist: string;
  youtube_id?: string;
  duration: number;
  cover_url?: string;
}

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportPlaylistModal({ isOpen, onClose }: ImportPlaylistModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<ImportedTrack[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [platform, setPlatform] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setTracks([]);
    setSuccess(false);

    try {
      const res = await fetch(`/api/import-playlist?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu.');
        setLoading(false);
        return;
      }

      setTracks(data.tracks || []);
      setPlaylistName(data.playlistName || 'İçe Aktarılan Liste');
      setPlatform(data.platform || '');
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (tracks.length === 0) return;
    setImporting(true);
    setError(null);
    setProgress(0);

    try {
      // Create playlist in Supabase
      const { data: newPlaylist, error: plError } = await supabase
        .from('playlists')
        .insert({
          name: playlistName,
          mood_description: `${platform === 'spotify' ? 'Spotify' : 'YouTube'} listesinden içe aktarıldı (${tracks.length} şarkı)`,
        })
        .select()
        .single();

      if (plError || !newPlaylist) {
        setError('Çalma listesi oluşturulamadı.');
        setImporting(false);
        return;
      }

      const playlistId = (newPlaylist as Record<string, unknown>).id as string;

      // Insert songs in batches of 20
      const batchSize = 20;
      for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize).map((track, idx) => ({
          playlist_id: playlistId,
          title: track.title,
          artist: track.artist,
          audio_url: track.youtube_id
            ? `https://www.youtube.com/watch?v=${track.youtube_id}`
            : '',
          youtube_id: track.youtube_id || null,
          cover_url: track.cover_url || null,
          duration: track.duration || 0,
          track_order: i + idx,
        }));

        const { error: insertError } = await supabase.from('songs').insert(batch);
        if (insertError) {
          console.error('Batch insert error:', insertError);
        }

        setProgress(Math.min(Math.round(((i + batchSize) / tracks.length) * 100), 100));
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset
        setUrl('');
        setTracks([]);
        setPlaylistName('');
        setPlatform('');
        setSuccess(false);
        setProgress(0);
      }, 2000);
    } catch (err) {
      console.error('Import error:', err);
      setError('İçe aktarma sırasında hata oluştu.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
      setUrl('');
      setTracks([]);
      setError(null);
      setPlaylistName('');
      setPlatform('');
      setSuccess(false);
      setProgress(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-gray-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-[0_20px_60px_rgba(236,72,153,0.2)] z-[61] overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Download size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Playlist İçe Aktar</h2>
                  <p className="text-xs text-gray-400">Spotify veya YouTube Music</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={importing}
                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* URL Input */}
            <div className="p-4 border-b border-white/10 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleFetch()}
                  placeholder="Spotify veya YouTube Music playlist linki yapıştırın..."
                  disabled={loading || importing}
                  className="flex-1 bg-white/10 border border-white/15 rounded-xl py-3 px-4 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 transition disabled:opacity-50"
                />
                <button
                  onClick={handleFetch}
                  disabled={!url.trim() || loading || importing}
                  className="px-5 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Getir
                </button>
              </div>

              {/* Platform hints */}
              <div className="flex gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-green-500/60" />
                  Spotify
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-red-500/60" />
                  YouTube / YouTube Music
                </div>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/20 border-b border-red-500/30 text-red-300 text-xs font-medium py-2.5 px-5 flex items-center gap-2"
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-green-500/20 border-b border-green-500/30 text-green-300 text-sm font-semibold py-3 px-5 flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {tracks.length} şarkı başarıyla içe aktarıldı! 🎉
                </motion.div>
              )}
            </AnimatePresence>

            {/* Track Preview List */}
            {tracks.length > 0 && !success && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Playlist info bar */}
                <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      platform === 'spotify' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      <Music size={16} className={platform === 'spotify' ? 'text-green-400' : 'text-red-400'} />
                    </div>
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        className="bg-transparent text-white text-sm font-semibold focus:outline-none border-b border-transparent focus:border-pink-500 w-full transition"
                      />
                      <p className="text-[11px] text-gray-500">{tracks.length} şarkı bulundu</p>
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                  >
                    {importing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {progress}%
                      </>
                    ) : (
                      <>
                        <ListPlus size={14} />
                        Tümünü İçe Aktar
                      </>
                    )}
                  </button>
                </div>

                {/* Progress bar */}
                {importing && (
                  <div className="h-1 bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                )}

                {/* Scrollable track list */}
                <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
                  {tracks.map((track, idx) => (
                    <div
                      key={`${track.title}-${idx}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
                    >
                      <span className="text-[11px] text-gray-500 w-6 text-right flex-shrink-0 font-mono">
                        {idx + 1}
                      </span>
                      {track.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.cover_url}
                          alt={track.title}
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                          <Music size={14} className="text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate font-medium">{track.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{track.artist}</p>
                      </div>
                      {track.youtube_id && (
                        <span className="text-[9px] text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          YT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state when no tracks fetched yet */}
            {tracks.length === 0 && !loading && !error && (
              <div className="p-8 text-center text-gray-400">
                <Download size={36} className="mx-auto mb-3 text-gray-500" />
                <p className="text-sm font-medium text-gray-300">Playlist linkini yapıştırın</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Spotify veya YouTube Music çalma listesi linkini yukarıya yapıştırıp
                  &quot;Getir&quot; butonuna basın.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/10 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                      <div className="h-2.5 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
