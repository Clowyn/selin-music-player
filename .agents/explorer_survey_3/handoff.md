# Handoff Report — Explorer Survey 3 (Queue & Playlist Focus)

## 1. Observation
- **State Store (`store/playerStore.ts`)**:
  - `PlayerState` interface defines `currentSong: Song | null`, `currentPlaylist: Playlist | null`, `songs: Song[]`, `queue: Song[]`, `isPlaying: boolean`, `searchDrawerOpen: boolean`, `isLyricsOpen: boolean` (lines 5-18).
  - Existing actions include `setCurrentSong`, `setSongs` (which syncs `songs` and `queue`), `setCurrentPlaylist`, `addToQueue`, `removeFromQueue`, `nextSong`, `prevSong`, `toggleFavorite`, `fetchFavorites` (lines 20-42).
  - Missing queue drawer visibility state (`isQueueOpen`) and editing actions (`reorderQueue`, `deleteSongFromPlaylist`, `renamePlaylist`).
- **Now Playing Area (`components/NowPlaying.tsx`)**:
  - Displays playlist name (`{currentPlaylist.name}`) at line 23 and current song title (`{currentSong.title}`) at line 27 in static, non-interactive `<span>` and `<h1>` elements.
- **Controls & Navigation (`components/PlayerControls.tsx`)**:
  - Contains playback controls and action buttons (lyrics, search, shuffle, prev, play/pause, next, repeat, favorite, add-to-playlist). Does not yet trigger a queue drawer.
- **Drawer Patterns (`components/PlaylistDrawer.tsx`, `SearchDrawer.tsx`, `LyricsSheet.tsx`)**:
  - All drawers use `framer-motion` (`AnimatePresence`, `motion.div`), fixed backdrop (`bg-black/60` or `bg-black/70 backdrop-blur-md z-40`), and slide-up panels (`fixed bottom-0 inset-x-0 z-50 rounded-t-3xl bg-gray-900/90 backdrop-blur-xl`).
- **Dependencies (`package.json`)**:
  - `framer-motion`: `^12.43.0` (includes `<Reorder.Group>` and `<Reorder.Item>` for drag-and-drop out-of-the-box).
  - `lucide-react`: `^1.27.0` (includes `GripVertical`, `Trash2`, `Edit3`, `ListMusic`, `Check`, `X`).
  - `@supabase/supabase-js`: `^2.111.0`.
- **Supabase Tables & Fields (`lib/types.ts`, `components/AddToPlaylistModal.tsx`, `components/ImportPlaylistModal.tsx`)**:
  - Table `playlists`: `id`, `name`, `mood_description`, `cover_url`, `created_at`.
  - Table `songs`: `id`, `playlist_id`, `title`, `artist`, `audio_url`, `youtube_id`, `duration`, `track_order`, `cover_url`, `created_at`.

---

## 2. Logic Chain
1. *From Store Observation:* `store/playerStore.ts` manages player state with Zustand. Since `songs` and `queue` are currently managed as arrays, adding `isQueueOpen`, `reorderQueue`, `deleteSongFromPlaylist`, and `renamePlaylist` directly to `playerStore.ts` will allow clean state manipulation without introducing extra context providers.
2. *From UI Observation:* `components/NowPlaying.tsx` currently renders `currentPlaylist.name` and `currentSong.title` as static text. Making these elements clickable (`cursor-pointer hover:underline` or styled badge) and connecting them to `usePlayerStore.getState().setQueueOpen(true)` fulfills the R4 trigger requirement cleanly.
3. *From Drag-and-Drop Observation:* `package.json` includes `framer-motion` `^12.43.0`. Framer Motion provides `<Reorder.Group>` and `<Reorder.Item>`, allowing drag-and-drop reordering without introducing external DnD dependencies.
4. *From Supabase Observation:* Reordering songs requires updating `track_order` in the `songs` table; deleting a track requires `supabase.from('songs').delete().eq('id', songId)`; renaming a playlist requires `supabase.from('playlists').update({ name }).eq('id', playlistId)`. Performing these updates in edit mode guarantees real-time synchronization with Supabase.

---

## 3. Caveats
- If the user reorders or deletes songs in the queue while playing in shuffle mode (`isShuffle = true`), `nextSong()` picks a random track from `songs`. The reordered `songs` array will dictate order when shuffle is turned off.
- Deleting the currently playing song in edit mode should trigger `nextSong()` or pause playback if the playlist becomes empty.

---

## 4. Conclusion
The codebase is fully equipped and structured to implement Requirement R4 (Now Playing Queue Drawer with Playlist Editing). Framer Motion `Reorder` components can handle drag-and-drop reordering, Zustand store can manage queue state and drawer visibility, and Supabase client can persist `track_order` updates, track deletions, and playlist name changes.

Detailed breakdown and recommendations have been written to `d:\Projeler\Selin\selin-player\.agents\explorer_survey_3\analysis.md`.

---

## 5. Verification Method
- **Store Verification:** Check `store/playerStore.ts` to verify state definitions for `isQueueOpen`, `reorderQueue`, and Supabase sync actions.
- **UI Inspection:** Inspect `components/NowPlaying.tsx` to verify click trigger on song/playlist name.
- **Drawer Inspection:** Verify `<QueueDrawer />` in `components/QueueDrawer.tsx` uses Framer Motion slide-up animations and standard dark glassmorphism styling.
- **Build Verification Command:**
  ```bash
  npm run lint
  npm run build
  ```
