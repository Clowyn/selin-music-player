'use client';

import { useState } from 'react';
import { MicVocal, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, Search, Heart, ListPlus, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import AddToPlaylistModal from './AddToPlaylistModal';

export default function PlayerControls() {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    nextSong,
    prevSong,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    setSearchDrawerOpen,
    isLyricsOpen,
    toggleLyricsOpen,
    isQueueOpen,
    setQueueOpen,
    favorites,
    toggleFavorite
  } = usePlayerStore();

  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  const isFavorite = currentSong ? favorites.some((f) => f.id === currentSong.id) : false;

  const handleFavoriteClick = () => {
    if (currentSong) {
      toggleFavorite(currentSong);
    }
  };

  return (
    <>
      {/* Unified glassmorphic card container framing all controls */}
      <div className="w-full max-w-md mx-auto bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-4 sm:p-5 flex flex-col gap-3">
        {/* Row 1: Primary transport controls */}
        <div className="flex items-center justify-between px-2">
          <button 
            onClick={toggleShuffle}
            className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-pink-400 bg-pink-500/20' : 'text-gray-300 hover:text-white'}`}
            aria-label="Karıştır"
            title="Karıştır"
          >
            <Shuffle size={20} />
          </button>
          
          <button 
            onClick={prevSong}
            className="p-2 text-gray-300 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Önceki"
            title="Önceki"
          >
            <SkipBack size={24} />
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all flex-shrink-0"
            aria-label={isPlaying ? 'Duraklat' : 'Çal'}
            title={isPlaying ? 'Duraklat' : 'Çal'}
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>
          
          <button 
            onClick={nextSong}
            className="p-2 text-gray-300 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Sonraki"
            title="Sonraki"
          >
            <SkipForward size={24} />
          </button>
          
          <button 
            onClick={cycleRepeat}
            className={`p-2 rounded-full transition-colors ${repeatMode !== 'off' ? 'text-pink-400 bg-pink-500/20' : 'text-gray-300 hover:text-white'}`}
            aria-label="Tekrarla"
            title="Tekrarla"
          >
            {repeatMode === 'single' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        {/* Horizontal Divider */}
        <div className="w-full h-px bg-white/10" />

        {/* Row 2: Secondary action tools */}
        <div className="flex items-center justify-between px-2">
          <button 
            onClick={toggleLyricsOpen}
            className={`p-2 rounded-full transition-all ${
              isLyricsOpen
                ? 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Şarkı Sözleri"
            title="Şarkı Sözleri (Karaoke)"
          >
            <MicVocal size={18} />
          </button>

          <button 
            onClick={() => setQueueOpen(!isQueueOpen)}
            className={`p-2 rounded-full transition-all ${
              isQueueOpen
                ? 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Çalma Sırası"
            title="Çalma Sırası ve Listesi"
          >
            <ListMusic size={18} />
          </button>

          <button 
            onClick={() => setSearchDrawerOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Şarkı Ara"
            title="Şarkı Ara"
          >
            <Search size={18} />
          </button>

          <button 
            onClick={handleFavoriteClick}
            disabled={!currentSong}
            className={`p-2 rounded-full transition-colors ${
              !currentSong 
                ? 'opacity-40 cursor-not-allowed text-gray-500' 
                : isFavorite 
                ? 'text-[#ec4899] bg-pink-500/10' 
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Favorilere Ekle"
            title="Favorilere Ekle"
          >
            <Heart size={18} fill={isFavorite ? '#ec4899' : 'none'} color={isFavorite ? '#ec4899' : 'currentColor'} />
          </button>

          <button
            onClick={() => setShowAddToPlaylist(true)}
            disabled={!currentSong}
            className={`p-2 rounded-full transition-colors ${
              !currentSong
                ? 'opacity-40 cursor-not-allowed text-gray-500'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Listeye Ekle"
            title="Listeye Ekle"
          >
            <ListPlus size={18} />
          </button>
        </div>
      </div>

      {/* Add to Playlist Modal */}
      {currentSong && (
        <AddToPlaylistModal
          isOpen={showAddToPlaylist}
          onClose={() => setShowAddToPlaylist(false)}
          song={currentSong}
        />
      )}
    </>
  );
}
