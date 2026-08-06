# Detailed Investigation Report — Queue & Playlist Focus (Explorer Survey 3)

## 1. Overview
This report provides a comprehensive analysis of the state management, drawer/modal UI architecture, and Supabase integration in Selin Music Player. It evaluates how to seamlessly implement Requirement R4: **Now Playing Queue Drawer with Playlist Editing**.

---

## 2. Player State Management (`store/playerStore.ts`)

### Existing State & Logic
The store is built with **Zustand** (`create<PlayerState>`). The relevant state and actions are:

- **State Fields:**
  - `currentSong: Song | null` — Currently playing song.
  - `currentPlaylist: Playlist | null` — Currently selected playlist.
  - `songs: Song[]` — List of songs in the current playlist/context.
  - `queue: Song[]` — Active queue list (initially initialized equal to `songs` when `setSongs` is called).
  - `isPlaying: boolean` — Playback status.
  - `currentTime: number`, `duration: number`, `volume: number`.
  - `isShuffle: boolean`, `repeatMode: RepeatMode` (`'off' | 'single' | 'all'`).
  - `favorites: Song[]` — User favorite songs fetched from Supabase `favorites` table.
  - `searchDrawerOpen: boolean`, `isLyricsOpen: boolean` — Drawer visibility toggles.

- **Existing Queue & Navigation Actions:**
  - `setSongs(songs)`: Sets `songs = songs` and `queue = songs`.
  - `setCurrentSong(song)`: Sets `currentSong = song`, `isPlaying = true`, `currentTime = 0`.
  - `setCurrentPlaylist(playlist)`: Sets active playlist object.
  - `addToQueue(song)`: Appends song to `queue` (and to `songs` if not present).
  - `removeFromQueue(id)`: Removes song from `queue` by `id`.
  - `nextSong()`: Finds index of `currentSong` in `songs`, advances to index + 1 (handles shuffle, repeat mode, end-of-list).
  - `prevSong()`: Handles previous song navigation or restart track if > 3s.

### Gaps & Required Extensions for R4
1. **Queue Drawer Visibility State:**
   - Need `isQueueOpen: boolean`, `setQueueOpen: (open: boolean) => void`, `toggleQueueOpen: () => void`.
   - Should automatically close other drawers (`searchDrawerOpen`, `isLyricsOpen`) when opened.
2. **Reordering Songs / Queue:**
   - Need `reorderQueue: (newSongs: Song[]) => void` (updates both `queue` and `songs` state in Zustand).
3. **Deleting Song from Playlist / Queue:**
   - Need `deleteSongFromPlaylist: (songId: string) => Promise<void>` (removes from state, updates `queue`/`songs`, and deletes from Supabase `songs` table).
4. **Renaming Playlist:**
   - Need `renamePlaylist: (playlistId: string, newName: string) => Promise<void>` (updates `currentPlaylist.name` in store and updates `name` in Supabase `playlists` table).

---

## 3. Existing UI Architecture (Drawers & Modals)

### Design Patterns & Conventions
- **Framework:** Next.js App Router (Client Components with `'use client'`).
- **Animations:** `framer-motion` (`AnimatePresence`, `motion.div`).
- **Styling:** Dark glassmorphism (`bg-gray-900/90` or `bg-gray-950/90`, `backdrop-blur-xl`, `border-white/10`, pink/purple gradient accents).
- **Drawer Layout:** Bottom slide-up sheet (`fixed inset-x-0 bottom-0 z-50 h-[80vh]` or `max-h-[80vh]`) with backdrop overlay (`fixed inset-0 bg-black/70 backdrop-blur-md z-40`).

### Component Breakdown
1. **`components/NowPlaying.tsx`:**
   - Currently displays playlist name in a badge (`currentPlaylist.name`) and current song title (`h1`) and artist (`h2`).
   - *Extension point:* Make the playlist name badge or current song title clickable to open the Queue Drawer, or add a queue trigger icon.
2. **`components/PlayerControls.tsx`:**
   - Contains control bar: lyrics toggle, YouTube search, shuffle, prev, play/pause, next, repeat, favorite, and add-to-playlist buttons.
   - *Extension point:* Widening vertical padding (R1 requirement) and optionally adding a Queue button (`ListMusic` / `ListOrdered` icon from Lucide).
3. **`components/PlaylistDrawer.tsx`:**
   - Bottom drawer with tabs: "Çalma Listeleri", "💖 Favorilerim", "Keşfet".
   - Shows existing playlists from Supabase and allows selecting a playlist, which updates `currentPlaylist`, `songs`, `queue`, and `currentSong`.
4. **`components/AddToPlaylistModal.tsx` & `components/ImportPlaylistModal.tsx`:**
   - Floating modal overlays for creating/adding songs to playlists or importing playlists from Spotify/YouTube.
5. **`components/UpNextRow.tsx`:**
   - Currently renders recommendation cards on main page. (Will be updated to compact strip under R2).

---

## 4. Supabase Integration & Database Schema

### Client & Configuration
- Client instance: `lib/supabase.ts` via `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`.

### Database Schema (Referenced in Code)
1. **`playlists` Table:**
   - `id`: uuid (Primary Key)
   - `name`: text (Playlist title)
   - `mood_description`: text (Nullable description)
   - `cover_url`: text (Nullable image URL)
   - `created_at`: timestamp
2. **`songs` Table:**
   - `id`: uuid / text (Primary Key)
   - `playlist_id`: uuid (Foreign Key -> `playlists.id`)
   - `title`: text
   - `artist`: text
   - `audio_url`: text
   - `youtube_id`: text (Nullable)
   - `duration`: numeric (in seconds)
   - `track_order`: integer (0-indexed position within playlist)
   - `cover_url`: text (Nullable)
   - `created_at`: timestamp

### Supabase API Calls Required for R4
1. **Track Reordering (`track_order` update):**
   ```ts
   // Update track_order in Supabase for each song in the reordered list
   const updatePromises = reorderedSongs.map((song, index) =>
     supabase
       .from('songs')
       .update({ track_order: index })
       .eq('id', song.id)
   );
   await Promise.all(updatePromises);
   ```
2. **Track Deletion:**
   ```ts
   await supabase.from('songs').delete().eq('id', songId);
   ```
3. **Playlist Renaming:**
   ```ts
   await supabase
     .from('playlists')
     .update({ name: newName.trim() })
     .eq('id', playlistId);
   ```

---

## 5. Proposed Implementation Plan for Queue Drawer & Playlist Editing

### Components to Create / Modify
1. **`store/playerStore.ts`**:
   - Add state: `isQueueOpen: boolean`.
   - Add actions: `setQueueOpen`, `toggleQueueOpen`, `reorderQueue`, `deleteSongFromPlaylist`, `updatePlaylistName`.
2. **`components/QueueDrawer.tsx` (New Component)**:
   - Slide-up bottom drawer using Framer Motion.
   - Header with queue title, track count, Edit Mode toggle button (`Edit3` / `Check` icon), and close button.
   - Inline playlist name editing when in Edit Mode.
   - Render list of songs with active song highlighted (`pink-500` accent, playing animation / icon).
   - In Normal Mode: Tapping a song sets `currentSong` and plays it.
   - In Edit Mode:
     - Drag-and-drop reordering powered by Framer Motion's `<Reorder.Group>` and `<Reorder.Item>` with drag handles (`GripVertical` icon).
     - Individual track delete button (`Trash2` icon) with Supabase deletion.
3. **`components/NowPlaying.tsx`**:
   - Wrap playlist badge and song title with click handlers that trigger `setQueueOpen(true)`. Add cursor-pointer styling and tooltip.
4. **`components/PlayerControls.tsx`**:
   - Increase vertical padding (`p-3` to `p-4` or `py-4` for R1).
   - Optionally add Queue button icon (`ListMusic`).
5. **`app/page.tsx`**:
   - Mount `<QueueDrawer />` alongside existing drawers (`<LyricsSheet />`, `<PlaylistDrawer />`, etc.).

---

## 6. Summary Matrix

| Requirement | Target File(s) | Proposed Solution | Key Tools / Dependencies |
| --- | --- | --- | --- |
| State Management | `store/playerStore.ts` | Extend Zustand store with `isQueueOpen`, `reorderQueue`, track delete & rename actions | `zustand` |
| Queue Drawer UI | `components/QueueDrawer.tsx` | Slide-up drawer with normal & edit mode; drag handle & delete buttons | `framer-motion` (`Reorder`), `lucide-react` |
| Queue Trigger | `components/NowPlaying.tsx`, `PlayerControls.tsx` | Clickable playlist badge / song title and dedicated icon button | Framer Motion, Lucide icons |
| Supabase Sync | `components/QueueDrawer.tsx` / `playerStore.ts` | Update `track_order`, delete from `songs`, update `playlists.name` | `@supabase/supabase-js` |

