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
      <div className="flex items-center justify-center gap-1.5 min-[380px]:gap-2.5 sm:gap-6 px-4 py-6 sm:px-6 sm:py-7 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
        <button 
          onClick={toggleLyricsOpen}
          className={`p-2 rounded-full transition-all ${
            isLyricsOpen
              ? 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Şarkı Sözleri"
          title="Şarkı Sözleri (Karaoke)"
        >
          <MicVocal size={20} />
        </button>

        <button 
          onClick={() => setQueueOpen(!isQueueOpen)}
          className={`p-2 rounded-full transition-all ${
            isQueueOpen
              ? 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Çalma Sırası"
          title="Çalma Sırası ve Listesi"
        >
          <ListMusic size={20} />
        </button>

        <button 
          onClick={() => setSearchDrawerOpen(true)}
          className="p-2 text-gray-300 hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="Şarkı Ara"
        >
          <Search size={20} />
        </button>

        <button 
          onClick={toggleShuffle}
          className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-pink-400 bg-white/10' : 'text-gray-300 hover:text-white'}`}
          aria-label="Karıştır"
        >
          <Shuffle size={20} />
        </button>
        
        <button 
          onClick={prevSong}
          className="p-2 text-gray-300 hover:text-white transition-colors"
          aria-label="Önceki"
        >
          <SkipBack size={28} />
        </button>
        
        <button 
          onClick={togglePlay}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all flex-shrink-0"
          aria-label={isPlaying ? 'Duraklat' : 'Çal'}
        >
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
        </button>
        
        <button 
          onClick={nextSong}
          className="p-2 text-gray-300 hover:text-white transition-colors"
          aria-label="Sonraki"
        >
          <SkipForward size={28} />
        </button>
        
        <button 
          onClick={cycleRepeat}
          className={`p-2 rounded-full transition-colors ${repeatMode !== 'off' ? 'text-pink-400 bg-white/10' : 'text-gray-300 hover:text-white'}`}
          aria-label="Tekrarla"
        >
          {repeatMode === 'single' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </button>

        <button 
          onClick={handleFavoriteClick}
          disabled={!currentSong}
          className={`p-2 rounded-full transition-colors ${
            !currentSong 
              ? 'opacity-40 cursor-not-allowed text-gray-400' 
              : isFavorite 
              ? 'text-[#ec4899] bg-white/10' 
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Favorilere Ekle"
        >
          <Heart size={20} fill={isFavorite ? '#ec4899' : 'none'} color={isFavorite ? '#ec4899' : 'currentColor'} />
        </button>

        {/* Add to Playlist button */}
        <button
          onClick={() => setShowAddToPlaylist(true)}
          disabled={!currentSong}
          className={`p-2 rounded-full transition-colors ${
            !currentSong
              ? 'opacity-40 cursor-not-allowed text-gray-400'
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Listeye Ekle"
        >
          <ListPlus size={20} />
        </button>
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
