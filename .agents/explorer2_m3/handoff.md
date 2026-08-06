# Handoff Report: Now Playing Queue Drawer & Playlist Editing Specification (Milestone 3 / Requirement R4)

## 1. Observation
- Target Files Inspected:
  - `components/NowPlaying.tsx` (48 lines)
  - `components/PlaylistDrawer.tsx` (579 lines)
  - `components/SearchDrawer.tsx` (587 lines)
  - `components/LyricsSheet.tsx` (311 lines)
  - `components/PlayerControls.tsx` (141 lines)
  - `store/playerStore.ts` (237 lines)
  - `lib/types.ts` (48 lines)
  - `lib/supabase.ts` (7 lines)
  - `app/page.tsx` (71 lines)
  - `package.json` (35 lines)
- Existing Tech Stack: Next.js 16 App Router, TypeScript, Tailwind CSS v4, Framer Motion v12.43.0, Zustand v5.0.14, Supabase client (`@supabase/supabase-js`), Lucide React v1.27.0.
- Existing Drawer Pattern: All existing slide-up sheets (`PlaylistDrawer`, `SearchDrawer`, `LyricsSheet`) use `bg-gray-900/95` or `bg-gray-950/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(236,72,153,0.15)]` with spring animation `transition={{ type: 'spring', damping: 25, stiffness: 220 }}` and backdrop overlay `fixed inset-0 bg-black/70 backdrop-blur-md z-40`.
- Missing Components & Store State for R4:
  - `components/QueueDrawer.tsx` currently does not exist.
  - `store/playerStore.ts` lacks `isQueueOpen`, `setQueueOpen`, `toggleQueueOpen`, `reorderSongs`, `removeSong`, `updatePlaylistName`.
  - `components/NowPlaying.tsx` currently does not trigger opening the queue drawer on click.
  - `app/page.tsx` does not mount `<QueueDrawer />`.

---

## 2. Logic Chain
1. **Observation 1 & 3**: Existing drawers use dark glassmorphism styling (`bg-gray-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl`) and Framer Motion spring physics.
   - *Inference*: `QueueDrawer.tsx` must strictly follow this visual and structural pattern for design consistency.
2. **Observation 2 & 4**: `store/playerStore.ts` controls playback and song lists via `currentSong`, `songs`, and `queue`.
   - *Inference*: Adding `isQueueOpen`, `reorderSongs`, `removeSong`, and `updatePlaylistName` to `playerStore.ts` allows reactive rendering across `NowPlaying`, `PlayerControls`, and `QueueDrawer`.
3. **Requirement 3**: Edit Mode requires drag reordering, track deletion, and playlist renaming.
   - *Inference*: Framer Motion's `<Reorder.Group>` and `<Reorder.Item>` with Lucide `GripVertical` icon provide smooth drag-and-drop. `Trash2` icon enables deletion, and inline input with `Edit3`/`Check` toggle enables renaming.
4. **Requirement 4 & Supabase Integration**: When `currentPlaylist?.id` exists, user edits must be synced back to Supabase.
   - *Inference*: Async operations for updating `track_order` in `songs`, deleting from `songs`, and updating `name` in `playlists` ensure data persistence across sessions.

---

## 3. Caveats
- **Non-Playlist Queue Handling**: If songs are queued from YouTube search without being in a saved playlist (`currentPlaylist === null`), drag-reordering and song deletion will update local state (`songs`/`queue` in Zustand), but Supabase sync calls will be safely skipped.
- **Currently Playing Song Deletion**: If the user deletes the currently playing song in Edit Mode, the store will gracefully transition to the next available song in the list, or stop playback if the queue becomes empty.
- **Framer Motion Reorder Touch Devices**: Framer Motion `Reorder` drag handle (`GripVertical`) requires explicit touch-action styling (`touch-none`) on mobile devices to prevent page scroll interference.

---

## 4. Conclusion
The complete specification for `components/QueueDrawer.tsx` and its supporting modifications in `store/playerStore.ts`, `components/NowPlaying.tsx`, and `app/page.tsx` has been formulated and documented in `d:\Projeler\Selin\selin-player\.agents\explorer2_m3\analysis.md`.

Implementers can follow `analysis.md` directly to implement `components/QueueDrawer.tsx` and integrate Supabase sync cleanly.

---

## 5. Verification Method
- **Lint Verification**: Run `npm run lint` from project root (`d:\Projeler\Selin\selin-player`) — must exit with code 0.
- **Build Verification**: Run `npm run build` from project root — must exit with code 0.
- **UI & Functional Verification**:
  1. Inspect `components/QueueDrawer.tsx` for proper imports, Tailwind class names, and Framer Motion `<Reorder.Group>` / `<Reorder.Item>`.
  2. Verify tapping NowPlaying title or playlist name opens `QueueDrawer`.
  3. Verify tapping any song in normal mode sets `currentSong` and plays it.
  4. Verify clicking "Düzenle" enables drag handles (`GripVertical`), delete buttons (`Trash2`), and inline title editing.
  5. Verify reordering, deleting, and renaming correctly invoke Supabase queries when `currentPlaylist` is set.
