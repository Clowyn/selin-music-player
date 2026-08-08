import { create } from 'zustand';
import { Song, Playlist, RepeatMode } from '@/lib/types';
import { supabase } from '@/lib/supabase';

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
  favorites: Song[];
  searchDrawerOpen: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isPlaylistOpen: boolean;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setCurrentSong: (song: Song) => void;
  setSongs: (songs: Song[]) => void;
  setCurrentPlaylist: (playlist: Playlist | null) => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
  seekTo: (time: number) => void;
  
  addToQueue: (song: Song) => void;
  removeFromQueue: (id: string) => void;
  setSearchDrawerOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  toggleLyricsOpen: () => void;
  setQueueOpen: (open: boolean) => void;
  setPlaylistOpen: (open: boolean) => void;
  togglePlaylistOpen: () => void;
  reorderQueue: (newSongs: Song[]) => Promise<void>;
  deleteSongFromPlaylist: (songId: string) => Promise<void>;
  renamePlaylist: (playlistId: string, newName: string) => Promise<void>;
  toggleFavorite: (song: Song) => Promise<void>;
  fetchFavorites: () => Promise<void>;
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
  favorites: [],
  searchDrawerOpen: false,
  isLyricsOpen: false,
  isQueueOpen: false,
  isPlaylistOpen: false,

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
      if (audio && !currentSong.youtube_id) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      if (typeof window !== 'undefined' && window.ytPlayer && currentSong.youtube_id) {
        try {
          window.ytPlayer.seekTo(0, true);
          window.ytPlayer.playVideo();
        } catch {}
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
      get().seekTo(0);
      return;
    }
    
    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
    if (currentIndex > 0) {
      set({ currentSong: songs[currentIndex - 1], currentTime: 0, isPlaying: true });
    } else {
      get().seekTo(0);
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
    if (audio && audio.src) {
      try {
        audio.currentTime = time;
      } catch {}
    }
    if (typeof window !== 'undefined' && window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
      try {
        window.ytPlayer.seekTo(time, true);
      } catch {}
    }
    set({ currentTime: time });
  },

  addToQueue: (song: Song) => set((state) => {
    const newQueue = [...state.queue, song];
    const existsInSongs = state.songs.some(s => s.id === song.id);
    const newSongs = existsInSongs ? state.songs : [...state.songs, song];
    return { queue: newQueue, songs: newSongs };
  }),
  
  removeFromQueue: (id: string) => set((state) => ({ queue: state.queue.filter((s) => s.id !== id) })),
  
  setSearchDrawerOpen: (open: boolean) => set((state) => ({
    searchDrawerOpen: open,
    isLyricsOpen: open ? false : state.isLyricsOpen,
    isQueueOpen: open ? false : state.isQueueOpen,
    isPlaylistOpen: open ? false : state.isPlaylistOpen,
  })),

  setLyricsOpen: (open: boolean) => set((state) => ({
    isLyricsOpen: open,
    searchDrawerOpen: open ? false : state.searchDrawerOpen,
    isQueueOpen: open ? false : state.isQueueOpen,
    isPlaylistOpen: open ? false : state.isPlaylistOpen,
  })),

  toggleLyricsOpen: () => set((state) => {
    const nextOpen = !state.isLyricsOpen;
    return {
      isLyricsOpen: nextOpen,
      searchDrawerOpen: nextOpen ? false : state.searchDrawerOpen,
      isQueueOpen: nextOpen ? false : state.isQueueOpen,
      isPlaylistOpen: nextOpen ? false : state.isPlaylistOpen,
    };
  }),

  setQueueOpen: (open: boolean) => set((state) => ({
    isQueueOpen: open,
    searchDrawerOpen: open ? false : state.searchDrawerOpen,
    isLyricsOpen: open ? false : state.isLyricsOpen,
    isPlaylistOpen: open ? false : state.isPlaylistOpen,
  })),

  setPlaylistOpen: (open: boolean) => set((state) => ({
    isPlaylistOpen: open,
    searchDrawerOpen: open ? false : state.searchDrawerOpen,
    isLyricsOpen: open ? false : state.isLyricsOpen,
    isQueueOpen: open ? false : state.isQueueOpen,
  })),

  togglePlaylistOpen: () => set((state) => {
    const nextOpen = !state.isPlaylistOpen;
    return {
      isPlaylistOpen: nextOpen,
      searchDrawerOpen: nextOpen ? false : state.searchDrawerOpen,
      isLyricsOpen: nextOpen ? false : state.isLyricsOpen,
      isQueueOpen: nextOpen ? false : state.isQueueOpen,
    };
  }),

  reorderQueue: async (newSongs: Song[]) => {
    const updatedSongs = newSongs.map((song, index) => ({
      ...song,
      track_order: index + 1,
    }));

    set({ songs: updatedSongs, queue: updatedSongs });

    try {
      const updatePromises = updatedSongs.map((song) =>
        supabase
          .from('songs')
          .update({ track_order: song.track_order })
          .eq('id', song.id)
      );
      const results = await Promise.all(updatePromises);
      const errorResult = results.find((r) => r.error);
      if (errorResult?.error) {
        console.error('Supabase reorder track_order error:', errorResult.error);
      }
    } catch (err) {
      console.error('Supabase reorder connection error:', err);
    }
  },

  deleteSongFromPlaylist: async (songId: string) => {
    const { currentSong, songs, queue } = get();
    const updatedSongs = songs.filter((s) => s.id !== songId);
    const updatedQueue = queue.filter((s) => s.id !== songId);

    if (currentSong?.id === songId) {
      if (updatedSongs.length > 0) {
        const deletedIndex = songs.findIndex((s) => s.id === songId);
        const nextIndex = deletedIndex < updatedSongs.length ? deletedIndex : 0;
        set({
          songs: updatedSongs,
          queue: updatedQueue,
          currentSong: updatedSongs[nextIndex],
          currentTime: 0,
          isPlaying: true,
        });
      } else {
        set({
          songs: [],
          queue: [],
          currentSong: null,
          currentTime: 0,
          duration: 0,
          isPlaying: false,
        });
        const audio = document.getElementById('player-audio') as HTMLAudioElement;
        if (audio) {
          audio.pause();
          audio.src = '';
        }
        if (typeof window !== 'undefined' && window.ytPlayer) {
          try {
            if (typeof window.ytPlayer.pauseVideo === 'function') {
              window.ytPlayer.pauseVideo();
            }
          } catch {}
        }
      }
    } else {
      set({ songs: updatedSongs, queue: updatedQueue });
    }

    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);
      if (error) {
        console.error('Supabase delete song error:', error);
      }
    } catch (err) {
      console.error('Supabase delete connection error:', err);
    }
  },

  renamePlaylist: async (playlistId: string, newName: string) => {
    const { currentPlaylist } = get();
    if (currentPlaylist && currentPlaylist.id === playlistId) {
      set({
        currentPlaylist: {
          ...currentPlaylist,
          name: newName,
        },
      });
    }

    try {
      const { error } = await supabase
        .from('playlists')
        .update({ name: newName })
        .eq('id', playlistId);
      if (error) {
        console.error('Supabase rename playlist error:', error);
      }
    } catch (err) {
      console.error('Supabase rename connection error:', err);
    }
  },

  toggleFavorite: async (song: Song) => {
    const { favorites } = get();
    const exists = favorites.some((f) => f.id === song.id);

    if (exists) {
      const updated = favorites.filter((f) => f.id !== song.id);
      set({ favorites: updated });
      try {
        await supabase.from('favorites').delete().eq('song_id', song.id);
        await supabase.from('favorites').delete().eq('id', song.id);
      } catch (err) {
        console.error('Supabase delete favorite error:', err);
      }
    } else {
      const updated = [...favorites, song];
      set({ favorites: updated });
      try {
        await supabase.from('favorites').upsert({
          song_id: song.id,
          title: song.title,
          artist: song.artist,
          audio_url: song.audio_url || (song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : ''),
          youtube_id: song.youtube_id || null,
          duration: song.duration || 0,
          cover_url: song.cover_url || null,
        }, { onConflict: 'song_id' });
      } catch (err) {
        console.error('Supabase upsert favorite error:', err);
      }
    }
  },

  fetchFavorites: async () => {
    try {
      const { data, error } = await supabase.from('favorites').select('*');
      if (!error && data) {
        const fetchedFavs: Song[] = data.map((item: Record<string, unknown>) => {
          const songsObj = item.songs as Song | undefined;
          const songObj = item.song as Song | undefined;
          if (songsObj) return songsObj;
          if (songObj) return songObj;
          return {
            id: (item.song_id || item.id) as string,
            playlist_id: item.playlist_id as string | undefined,
            title: (item.title || 'Bilinmeyen Şarkı') as string,
            artist: (item.artist || 'Bilinmeyen Sanatçı') as string,
            audio_url: (item.audio_url || '') as string,
            youtube_id: item.youtube_id as string | undefined,
            duration: (item.duration || 0) as number,
            cover_url: item.cover_url as string | undefined,
          };
        });
        set({ favorites: fetchedFavs });
      }
    } catch (err) {
      console.error('Fetch favorites error:', err);
    }
  },
}));
