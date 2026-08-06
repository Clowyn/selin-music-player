'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  ListMusic,
  X,
  GripVertical,
  Trash2,
  Edit3,
  Check,
  Music,
  Volume2,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { Song } from '@/lib/types';

function formatDuration(seconds: number | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function QueueDrawer() {
  const {
    isQueueOpen,
    setQueueOpen,
    songs,
    currentSong,
    setCurrentSong,
    play,
    currentPlaylist,
    reorderQueue,
    deleteSongFromPlaylist,
    renamePlaylist,
  } = usePlayerStore();

  const [isEditing, setIsEditing] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');

  const handleRenameSubmit = () => {
    if (currentPlaylist?.id && playlistTitle.trim() && playlistTitle.trim() !== currentPlaylist.name) {
      renamePlaylist(currentPlaylist.id, playlistTitle.trim());
    }
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      handleRenameSubmit();
      setIsEditing(false);
    } else {
      setPlaylistTitle(currentPlaylist?.name || 'Çalma Sırası');
      setIsEditing(true);
    }
  };

  const handleSongClick = (song: Song) => {
    if (!isEditing) {
      setCurrentSong(song);
      play();
    }
  };

  return (
    <AnimatePresence>
      {isQueueOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (isEditing) handleRenameSubmit();
              setQueueOpen(false);
            }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />

          {/* Slide-Up Drawer Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 z-50 h-[85vh] max-w-3xl mx-auto bg-gray-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(236,72,153,0.15)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
                  <ListMusic size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  {isEditing && currentPlaylist ? (
                    <input
                      type="text"
                      value={playlistTitle}
                      onChange={(e) => setPlaylistTitle(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit();
                      }}
                      placeholder="Çalma Listesi Adı"
                      className="w-full bg-white/10 border border-pink-500/40 rounded-lg px-3 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                      autoFocus
                    />
                  ) : (
                    <>
                      <h2 className="text-base font-bold text-white leading-tight truncate">
                        {currentPlaylist?.name || 'Çalma Sırası'}
                      </h2>
                      <p className="text-xs text-purple-300/70">
                        {songs.length} Şarkı
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleToggleEdit}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                    isEditing
                      ? 'bg-pink-500 text-white shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-pink-300 hover:text-white border border-white/10'
                  }`}
                >
                  {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
                  <span>{isEditing ? 'Bitti' : 'Düzenle'}</span>
                </button>
                <button
                  onClick={() => {
                    if (isEditing) handleRenameSubmit();
                    setQueueOpen(false);
                  }}
                  className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Kapat"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {songs.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-3">
                    <Music size={32} className="text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-300">Sırada henüz şarkı yok</p>
                </div>
              ) : isEditing ? (
                <Reorder.Group
                  axis="y"
                  values={songs}
                  onReorder={(newOrder) => {
                    reorderQueue(newOrder);
                  }}
                  className="flex-1 overflow-y-auto p-4 space-y-2"
                >
                  {songs.map((song) => (
                    <Reorder.Item
                      key={song.id}
                      value={song}
                      className="bg-white/10 border border-white/15 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md select-none touch-none"
                    >
                      <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-white p-1 flex-shrink-0">
                        <GripVertical size={20} />
                      </div>
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        {song.cover_url ? (
                          <img
                            src={song.cover_url}
                            alt={song.title}
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                            <Music size={16} className="text-purple-400" />
                          </div>
                        )}
                        <div className="overflow-hidden min-w-0">
                          <h3 className="font-semibold text-sm text-white truncate">{song.title}</h3>
                          <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSongFromPlaylist(song.id)}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                        title="Şarkıyı Sil"
                        aria-label="Şarkıyı Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {songs.map((song, index) => {
                    const isCurrent = currentSong?.id === song.id;
                    return (
                      <div
                        key={song.id}
                        onClick={() => handleSongClick(song)}
                        className={`group p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                          isCurrent
                            ? 'bg-pink-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.2)] text-pink-300 font-bold'
                            : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                          <span className="text-xs font-mono text-gray-400 w-5 text-center flex-shrink-0">
                            {index + 1}
                          </span>
                          {song.cover_url ? (
                            <img
                              src={song.cover_url}
                              alt={song.title}
                              className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                              <Music size={18} className="text-purple-400" />
                            </div>
                          )}
                          <div className="overflow-hidden min-w-0">
                            <h3 className={`font-semibold text-sm truncate ${isCurrent ? 'text-pink-300 font-bold' : 'text-white'}`}>
                              {song.title}
                            </h3>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{song.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isCurrent ? (
                            <div className="flex items-center gap-1.5 bg-pink-500/30 px-2.5 py-1 rounded-full border border-pink-500/40">
                              <Volume2 size={14} className="text-pink-400 animate-pulse" />
                              <span className="text-[11px] font-bold text-pink-300">Çalıyor</span>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-gray-400">
                              {formatDuration(song.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
