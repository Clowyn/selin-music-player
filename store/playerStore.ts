import { create } from 'zustand';
import { Song, Playlist, RepeatMode } from '@/lib/types';

interface PlayerState {
  currentSong: Song | null;
  currentPlaylist: Playlist | null;
  songs: Song[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  queue: Song[];
  
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setCurrentSong: (song: Song) => void;
  setSongs: (songs: Song[]) => void;
  setCurrentPlaylist: (playlist: Playlist) => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
  seekTo: (time: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  currentPlaylist: null,
  songs: [],
  isPlaying: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  isShuffle: false,
  repeatMode: 'off',
  queue: [],

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setCurrentSong: (song) => set({ currentSong: song, isPlaying: true, currentTime: 0 }),
  
  setSongs: (songs) => set({ songs, queue: songs }),
  
  setCurrentPlaylist: (playlist) => set({ currentPlaylist: playlist }),
  
  nextSong: () => {
    const { currentSong, songs, isShuffle, repeatMode } = get();
    if (!currentSong || songs.length === 0) return;
    
    if (repeatMode === 'single') {
      const audio = document.getElementById('player-audio') as HTMLAudioElement;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      set({ currentTime: 0, isPlaying: true });
      return;
    }
    
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      set({ currentSong: songs[randomIndex], currentTime: 0, isPlaying: true });
      return;
    }
    
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
    const isLast = currentIndex === songs.length - 1;
    
    if (isLast) {
      if (repeatMode === 'all') {
        set({ currentSong: songs[0], currentTime: 0, isPlaying: true });
      } else {
        set({ isPlaying: false, currentTime: 0 }); // Stop at end
      }
    } else {
      set({ currentSong: songs[currentIndex + 1], currentTime: 0, isPlaying: true });
    }
  },
  
  prevSong: () => {
    const { currentSong, songs, currentTime } = get();
    if (!currentSong || songs.length === 0) return;
    
    // If playing for more than 3 seconds, restart current song
    if (currentTime > 3) {
      const audio = document.getElementById('player-audio') as HTMLAudioElement;
      if (audio) audio.currentTime = 0;
      set({ currentTime: 0 });
      return;
    }
    
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
    if (currentIndex > 0) {
      set({ currentSong: songs[currentIndex - 1], currentTime: 0, isPlaying: true });
    } else {
      const audio = document.getElementById('player-audio') as HTMLAudioElement;
      if (audio) audio.currentTime = 0;
      set({ currentTime: 0 });
    }
  },
  
  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
  
  cycleRepeat: () => set((state) => {
    const modes: RepeatMode[] = ['off', 'all', 'single'];
    const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
    return { repeatMode: modes[nextIndex] };
  }),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setVolume: (vol) => set({ volume: vol }),
  
  seekTo: (time) => {
    const audio = document.getElementById('player-audio') as HTMLAudioElement;
    if (audio) {
      audio.currentTime = time;
    }
    set({ currentTime: time });
  }
}));
