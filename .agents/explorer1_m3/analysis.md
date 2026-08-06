# Requirement R4: Store Extensions & UI Trigger Architecture Analysis

## 1. Executive Summary

This report defines the exact Zustand store architecture and UI trigger integrations required for **Requirement R4: Now Playing Queue Drawer & Playlist Editing with Supabase Sync**. 

The solution introduces:
1. Four state & action extensions in `store/playerStore.ts` (`isQueueOpen`, `setQueueOpen`, `reorderQueue`, `deleteSongFromPlaylist`, `renamePlaylist`).
2. Instant UI feedback via optimistic local state updates coupled with background Supabase database persistence.
3. Interactive UI triggers in `components/NowPlaying.tsx` (clickable playlist tag and song metadata) and `components/PlayerControls.tsx` (using Lucide `ListMusic` icon button).
4. Structural specifications for `components/QueueDrawer.tsx` and its mounting in `app/page.tsx`.

---

## 2. Zustand Store Extensions (`store/playerStore.ts`)

### 2.1 Interface Extensions (`PlayerState`)

Add the following state property and methods to the `PlayerState` interface in `store/playerStore.ts`:

```typescript
interface PlayerState {
  // ... existing properties ...
  isQueueOpen: boolean;

  // ... existing actions ...
  setQueueOpen: (open: boolean) => void;
  reorderQueue: (newSongs: Song[]) => Promise<void>;
  deleteSongFromPlaylist: (songId: string) => Promise<void>;
  renamePlaylist: (playlistId: string, newName: string) => Promise<void>;
}
```

### 2.2 Initial State Value

Set initial state inside `create<PlayerState>`:

```typescript
isQueueOpen: false,
```

### 2.3 Store Action Implementations

#### A. `setQueueOpen`
Handles drawer visibility while maintaining mutual exclusivity with other overlays (Search Drawer and Karaoke Lyrics Sheet):

```typescript
setQueueOpen: (open: boolean) => set((state) => ({
  isQueueOpen: open,
  searchDrawerOpen: open ? false : state.searchDrawerOpen,
  isLyricsOpen: open ? false : state.isLyricsOpen,
})),
```

#### B. `reorderQueue`
Reorders the current queue/songs array locally with immediate UI reactivity, recalculates `track_order` values (1-indexed), and batch updates `track_order` in Supabase:

```typescript
reorderQueue: async (newSongs: Song[]) => {
  // 1. Optimistic local update with track_order calculation
  const updatedSongs = newSongs.map((song, index) => ({
    ...song,
    track_order: index + 1,
  }));
  
  set({ songs: updatedSongs, queue: updatedSongs });

  // 2. Supabase backend sync
  try {
    const updates = updatedSongs.map((song) =>
      supabase
        .from('songs')
        .update({ track_order: song.track_order })
        .eq('id', song.id)
    );
    await Promise.all(updates);
  } catch (err) {
    console.error('Supabase reorder sync error:', err);
  }
},
```

#### C. `deleteSongFromPlaylist`
Removes a song from local state (`songs` and `queue`), handles fallback playback if the deleted song is currently playing, and deletes the record from the Supabase `songs` table:

```typescript
deleteSongFromPlaylist: async (songId: string) => {
  const { songs, queue, currentSong, isPlaying } = get();

  // 1. Compute new songs and queue arrays
  const updatedSongs = songs.filter((s) => s.id !== songId);
  const updatedQueue = queue.filter((s) => s.id !== songId);

  // 2. Continuous playback logic if current song was deleted
  let newCurrentSong = currentSong;
  let nextIsPlaying = isPlaying;

  if (currentSong?.id === songId) {
    if (updatedSongs.length > 0) {
      // Pick next available song in playlist
      const deletedIndex = songs.findIndex((s) => s.id === songId);
      const nextIndex = deletedIndex < updatedSongs.length ? deletedIndex : updatedSongs.length - 1;
      newCurrentSong = updatedSongs[nextIndex];
    } else {
      newCurrentSong = null;
      nextIsPlaying = false;
    }
  }

  // 3. Optimistic local update
  set({
    songs: updatedSongs,
    queue: updatedQueue,
    currentSong: newCurrentSong,
    isPlaying: nextIsPlaying,
  });

  // 4. Supabase deletion
  try {
    await supabase.from('songs').delete().eq('id', songId);
  } catch (err) {
    console.error('Supabase delete song error:', err);
  }
},
```

#### D. `renamePlaylist`
Updates the name of the currently active playlist in local state if matching, and persists the new name to the Supabase `playlists` table:

```typescript
renamePlaylist: async (playlistId: string, newName: string) => {
  const { currentPlaylist } = get();

  // 1. Optimistic local update
  if (currentPlaylist && currentPlaylist.id === playlistId) {
    set({
      currentPlaylist: {
        ...currentPlaylist,
        name: newName,
      },
    });
  }

  // 2. Supabase update
  try {
    await supabase
      .from('playlists')
      .update({ name: newName })
      .eq('id', playlistId);
  } catch (err) {
    console.error('Supabase rename playlist error:', err);
  }
},
```

---

## 3. UI Trigger Architecture

### 3.1 `components/NowPlaying.tsx` Integration

In `NowPlaying.tsx`, clicking either the playlist badge or song title/artist triggers `setQueueOpen(true)`:

```tsx
'use client';

import { usePlayerStore } from '@/store/playerStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function NowPlaying() {
  const { currentSong, currentPlaylist, setQueueOpen } = usePlayerStore();

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 space-y-2 min-h-[120px]">
      <AnimatePresence mode="wait">
        {currentSong ? (
          <motion.div
            key={currentSong.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-2 w-full cursor-pointer group"
            onClick={() => setQueueOpen(true)}
            title="Sırayı ve Çalma Listesini Aç"
            role="button"
            tabIndex={0}
          >
            {currentPlaylist && (
              <span className="text-xs font-semibold px-3 py-1 bg-white/10 text-purple-300 rounded-full backdrop-blur-md mb-2 group-hover:bg-pink-500/20 group-hover:text-pink-200 transition-all duration-200">
                {currentPlaylist.name}
              </span>
            )}
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-300 truncate w-full px-4 group-hover:scale-105 transition-transform duration-200">
              {currentSong.title}
            </h1>
            <h2 className="text-lg text-purple-200/80 font-medium truncate w-full px-4 group-hover:text-purple-100 transition-colors">
              {currentSong.artist}
            </h2>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-gray-400 font-medium text-lg"
          >
            Bir şarkı seçin
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 3.2 `components/PlayerControls.tsx` Integration

In `PlayerControls.tsx`, add the `ListMusic` icon button from `lucide-react`:

1. Add `ListMusic` to imports from `'lucide-react'`.
2. Extract `isQueueOpen` and `setQueueOpen` from `usePlayerStore()`.
3. Add the `ListMusic` button to the control bar layout:

```tsx
import { MicVocal, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, Search, Heart, ListPlus, ListMusic } from 'lucide-react';

// Inside PlayerControls component:
const {
  // ... existing store values ...
  isQueueOpen,
  setQueueOpen,
} = usePlayerStore();

// Render queue list button inside the flex control container:
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
```

---

## 4. `components/QueueDrawer.tsx` Specification & Layout Integration

### 4.1 Component Capabilities
- Uses `AnimatePresence` and `motion.div` for a slide-up glassmorphic drawer (`bg-gray-900/95 backdrop-blur-xl`).
- Features a header with playlist title (or inline rename input in Edit Mode), Edit Mode toggle button (`Düzenle` / `Bitti`), and Close button (`X`).
- Uses Framer Motion `<Reorder.Group>` and `<Reorder.Item>` for drag-and-drop song reordering when Edit Mode is active.
- Provides delete button (`Trash2`) per song row in Edit Mode.
- Tapping a song item in standard mode calls `setCurrentSong(song)` and `play()`.
- Highlights current active song with pink accent styling (`text-pink-400` / pink glow).

### 4.2 Application Root Mount (`app/page.tsx`)
`QueueDrawer` must be imported and rendered alongside `LyricsSheet` in `app/page.tsx`:

```tsx
import QueueDrawer from '@/components/QueueDrawer';

// Inside Home component:
return (
  <main className="relative flex flex-col h-[100dvh] w-full overflow-hidden">
    {/* ... existing layers ... */}
    
    {/* Slide-up Queue Drawer */}
    <QueueDrawer />
    
    {/* Slide-up Lyrics Sheet */}
    <LyricsSheet />
  </main>
);
```

---

## 5. Evidence & Contract Verification

| Component / Function | Location | Status / Contract |
| -------------------- | -------- | ----------------- |
| `isQueueOpen` state | `store/playerStore.ts` | Required in `PlayerState` |
| `setQueueOpen` action | `store/playerStore.ts` | Closes `searchDrawerOpen` & `isLyricsOpen` |
| `reorderQueue` action | `store/playerStore.ts` | Updates `songs`/`queue` state & `track_order` in `songs` table |
| `deleteSongFromPlaylist` | `store/playerStore.ts` | Updates local state, handles playback fallback, deletes DB record |
| `renamePlaylist` | `store/playerStore.ts` | Updates `currentPlaylist.name` state & `name` in `playlists` table |
| NowPlaying trigger | `components/NowPlaying.tsx` | Click handler on playlist badge & title/artist calling `setQueueOpen(true)` |
| PlayerControls trigger | `components/PlayerControls.tsx` | `ListMusic` icon button toggling `isQueueOpen` |
