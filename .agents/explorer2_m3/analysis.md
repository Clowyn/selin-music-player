# QueueDrawer & Playlist Editing Specification (Milestone 3 / Requirement R4)

## Executive Summary
This document provides the exact component specification for `components/QueueDrawer.tsx`, along with the necessary extensions to `store/playerStore.ts`, `components/NowPlaying.tsx`, `lib/supabase.ts`, and `app/page.tsx`.

The Now Playing Queue Drawer allows users to:
1. View all songs in the active queue/playlist in a glassmorphic slide-up drawer.
2. See the currently playing track highlighted with a pink accent text and animated playing icon.
3. Tap any track to immediately jump to and play it.
4. Toggle "Edit Mode" ("Düzenle" / "Bitti") to:
   - Reorder tracks via Framer Motion drag handles (`GripVertical`).
   - Delete individual tracks from the queue/playlist (`Trash2`).
   - Edit the playlist title inline with real-time or blur-triggered Supabase synchronization.

---

## 1. Store Extensions (`store/playerStore.ts`)

To support the Queue Drawer, `store/playerStore.ts` needs the following state variables and action methods added to `PlayerState`:

### State Definitions
```typescript
interface PlayerState {
  // Existing state fields...
  isQueueOpen: boolean;
  
  // Existing actions...
  setQueueOpen: (open: boolean) => void;
  toggleQueueOpen: () => void;
  reorderSongs: (newSongs: Song[]) => void;
  removeSong: (songId: string) => void;
  updatePlaylistName: (name: string) => void;
}
```

### Initial Values & Implementation Logic
```typescript
isQueueOpen: false,

setQueueOpen: (open: boolean) => set({ isQueueOpen: open }),

toggleQueueOpen: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),

reorderSongs: (newSongs: Song[]) => set({ songs: newSongs, queue: newSongs }),

removeSong: (songId: string) => set((state) => {
  const updatedSongs = state.songs.filter((s) => s.id !== songId);
  const updatedQueue = state.queue.filter((s) => s.id !== songId);
  
  // If the deleted song was currently playing, jump to next song or clear if empty
  let nextCurrent = state.currentSong;
  if (state.currentSong?.id === songId) {
    if (updatedSongs.length > 0) {
      const deletedIndex = state.songs.findIndex((s) => s.id === songId);
      const nextIndex = deletedIndex < updatedSongs.length ? deletedIndex : updatedSongs.length - 1;
      nextCurrent = updatedSongs[nextIndex];
    } else {
      nextCurrent = null;
    }
  }
  
  return {
    songs: updatedSongs,
    queue: updatedQueue,
    currentSong: nextCurrent,
    isPlaying: nextCurrent ? state.isPlaying : false,
  };
}),

updatePlaylistName: (name: string) => set((state) => ({
  currentPlaylist: state.currentPlaylist ? { ...state.currentPlaylist, name } : null,
})),
```

---

## 2. Supabase Synchronization Strategy

When changes occur in Edit Mode, changes must sync to Supabase if `currentPlaylist?.id` exists.

### Operations & Queries
1. **Reorder Track Order**:
   - Local state is updated instantly on drag.
   - Sync function updates `track_order` in the `songs` table:
     ```typescript
     async function syncTrackOrderToSupabase(playlistId: string, updatedSongs: Song[]) {
       const updates = updatedSongs.map((song, index) =>
         supabase
           .from('songs')
           .update({ track_order: index })
           .eq('id', song.id)
           .eq('playlist_id', playlistId)
       );
       await Promise.all(updates);
     }
     ```
2. **Delete Track**:
   - Local state is updated instantly (`removeSong(songId)`).
   - Sync function deletes from the `songs` table:
     ```typescript
     async function syncDeleteTrackFromSupabase(playlistId: string | undefined, songId: string) {
       if (!songId) return;
       await supabase.from('songs').delete().eq('id', songId);
     }
     ```
3. **Rename Playlist**:
   - Local state is updated instantly (`updatePlaylistName(newName)`).
   - Sync function updates the `playlists` table:
     ```typescript
     async function syncRenamePlaylistToSupabase(playlistId: string, newName: string) {
       if (!playlistId || !newName.trim()) return;
       await supabase
         .from('playlists')
         .update({ name: newName.trim() })
         .eq('id', playlistId);
     }
     ```

---

## 3. QueueDrawer Component Specification (`components/QueueDrawer.tsx`)

### Complete Structure & Layout

#### Component Imports
```typescript
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  ListMusic,
  X,
  Play,
  GripVertical,
  Trash2,
  Edit3,
  Check,
  Music,
  Volume2,
  CheckCircle2,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { supabase } from '@/lib/supabase';
import { Song } from '@/lib/types';
```

#### Component Props & Local State
- Props: None (reads from Zustand store).
- Local State:
  - `isEditing: boolean` (default `false`) — toggles Edit mode.
  - `playlistTitle: string` — controlled input state for playlist name editing.
  - `toastMessage: string | null` — toast feedback message.

#### Header Specification
- **Glassmorphic Header Bar**:
  - `p-4 border-b border-white/10 flex items-center justify-between bg-white/5`
  - **Left Section**:
    - `ListMusic` icon inside `w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600` container.
    - If `isEditing` is **false**:
      - Show `currentPlaylist?.name || "Çalma Sırası"` in `h2 className="text-base font-bold text-white truncate"`.
      - Show subtext: `${songs.length} Şarkı` in `p className="text-xs text-purple-300/70"`.
    - If `isEditing` is **true**:
      - Inline edit text input:
        `<input type="text" value={playlistTitle} onChange={(e) => setPlaylistTitle(e.target.value)} onBlur={handleRenameSubmit} placeholder="Çalma Listesi Adı" className="bg-white/10 border border-pink-500/40 rounded-lg px-3 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-pink-500" />`
  - **Right Section**:
    - **Edit / Done Toggle Button**:
      ```tsx
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
      ```
    - **Close Button**:
      ```tsx
      <button
        onClick={() => setQueueOpen(false)}
        className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors ml-2"
        aria-label="Kapat"
      >
        <X size={20} />
      </button>
      ```

#### Song List View Specifications

##### A. Normal View Mode (`!isEditing`)
Rendered as standard scrollable list:
```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-2">
  {songs.map((song, index) => {
    const isCurrent = currentSong?.id === song.id;
    return (
      <div
        key={song.id}
        onClick={() => handleSongJump(song)}
        className={`group p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
          isCurrent
            ? 'bg-pink-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
            : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10'
        }`}
      >
        {/* Thumbnail & Title */}
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <span className="text-xs font-mono text-gray-400 w-5 text-center flex-shrink-0">
            {index + 1}
          </span>
          {song.cover_url ? (
            <img src={song.cover_url} alt={song.title} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
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

        {/* Status Badge */}
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
```

##### B. Edit View Mode (`isEditing`)
Rendered inside Framer Motion `<Reorder.Group>` and `<Reorder.Item>`:
```tsx
<Reorder.Group
  axis="y"
  values={songs}
  onReorder={handleReorder}
  className="flex-1 overflow-y-auto p-4 space-y-2"
>
  {songs.map((song) => (
    <Reorder.Item
      key={song.id}
      value={song}
      className="bg-white/10 border border-white/15 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md select-none"
    >
      {/* Drag Handle */}
      <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-white p-1">
        <GripVertical size={20} />
      </div>

      {/* Song Details */}
      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
        {song.cover_url ? (
          <img src={song.cover_url} alt={song.title} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
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

      {/* Delete Action Button */}
      <button
        onClick={() => handleDeleteSong(song.id)}
        className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
        title="Şarkıyı Sil"
      >
        <Trash2 size={18} />
      </button>
    </Reorder.Item>
  ))}
</Reorder.Group>
```

---

## 4. NowPlaying Integration (`components/NowPlaying.tsx`)

To trigger `QueueDrawer.tsx`, `components/NowPlaying.tsx` should be enhanced so that tapping the current song title or playlist badge triggers `setQueueOpen(true)`:

```tsx
'use client';

import { usePlayerStore } from '@/store/playerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic } from 'lucide-react';

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
          >
            {currentPlaylist && (
              <span className="text-xs font-semibold px-3 py-1 bg-white/10 hover:bg-white/20 text-purple-300 rounded-full backdrop-blur-md mb-2 flex items-center gap-1.5 transition-all">
                <ListMusic size={13} className="text-pink-400" />
                {currentPlaylist.name}
              </span>
            )}
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-300 truncate w-full px-4 group-hover:scale-105 transition-transform">
              {currentSong.title}
            </h1>
            <h2 className="text-lg text-purple-200/80 font-medium truncate w-full px-4">
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

---

## 5. Main Page Mounting (`app/page.tsx`)

`QueueDrawer` must be imported and mounted inside `app/page.tsx`:

```tsx
import QueueDrawer from '@/components/QueueDrawer';

// Inside Home component return:
<main className="relative flex flex-col h-[100dvh] w-full overflow-hidden">
  ...
  {/* Slide-up Queue Drawer */}
  <QueueDrawer />

  {/* Slide-up Lyrics Sheet */}
  <LyricsSheet />
</main>
```

---

## 6. Detailed Requirements Checklist & Architectural Compliance

| Requirement | Implementation Detail | Status |
|---|---|---|
| Glassmorphic Slide-up Drawer | `bg-gray-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl` | Formulated |
| Currently Playing Highlight | Pink accent text (`text-pink-300 font-bold`), animated `Volume2` playing badge | Formulated |
| Tap to Jump | On song click: `setCurrentSong(song)`, `play()` / `setIsPlaying(true)` | Formulated |
| Edit Mode Toggle | "Düzenle" / "Bitti" toggle button in top right of header | Formulated |
| Inline Playlist Rename | `<input>` in header active when `isEditing`, syncs to Supabase on blur/submit | Formulated |
| Drag & Drop Reorder | `<Reorder.Group>` and `<Reorder.Item>` with `GripVertical` handle per item | Formulated |
| Song Delete Button | `Trash2` icon per item in Edit mode, updates store and Supabase | Formulated |
| Supabase Sync | Real-time / async updates for `track_order`, track deletion, and playlist `name` | Formulated |
| Page Mounting | Mounted as top-level drawer in `app/page.tsx` | Formulated |
