'use client';

import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1 } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';

export default function PlayerControls() {
  const { isPlaying, togglePlay, nextSong, prevSong, isShuffle, toggleShuffle, repeatMode, cycleRepeat } = usePlayerStore();

  return (
    <div className="flex items-center justify-center gap-6 p-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
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
        className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
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
    </div>
  );
}
