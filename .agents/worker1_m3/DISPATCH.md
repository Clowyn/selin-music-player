## 2026-08-07T00:31:19Z

You are worker1_m3 for Milestone 3 (Requirement R4: Now Playing Queue Drawer & Playlist Editing with Supabase Sync).
Working directory: d:\Projeler\Selin\selin-player\.agents\worker1_m3
Project root: d:\Projeler\Selin\selin-player
Original request: d:\Projeler\Selin\ORIGINAL_REQUEST.md
Project scope: d:\Projeler\Selin\selin-player\PROJECT.md
Explorer specifications:
- d:\Projeler\Selin\selin-player\.agents\explorer1_m3\analysis.md
- d:\Projeler\Selin\selin-player\.agents\explorer2_m3\analysis.md
- d:\Projeler\Selin\selin-player\.agents\explorer3_m3\analysis.md

Target Files:
- `store/playerStore.ts`
- `components/QueueDrawer.tsx` (New Component)
- `components/NowPlaying.tsx`
- `components/PlayerControls.tsx`
- `app/page.tsx`

Task: Implement Requirement R4 per Explorer specifications:
1. Extend `store/playerStore.ts`:
   - `isQueueOpen: boolean`, `setQueueOpen: (open: boolean) => void`.
   - `reorderQueue: (newSongs: Song[]) => Promise<void>` (optimistic update of local `songs`/`queue` array + Supabase `songs` batch update of `track_order`).
   - `deleteSongFromPlaylist: (songId: string) => Promise<void>` (remove from `songs`/`queue`, handle active song deletion gracefully, delete from Supabase `songs` table).
   - `renamePlaylist: (playlistId: string, newName: string) => Promise<void>` (update local `currentPlaylist.name`, update Supabase `playlists` table `name`).
2. Build `components/QueueDrawer.tsx`:
   - Glassmorphic slide-up drawer (`bg-gray-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl`).
   - Header with title/playlist name, edit mode toggle button ("Düzenle"/"Bitti" with `Edit3`/`Check`), close button (`X`).
   - In normal mode: list songs, highlight currently playing track in pink accent (`text-pink-300 font-bold bg-pink-500/20`), show playing indicator (`Volume2`), tap any song to jump to it.
   - In edit mode: inline playlist title input, Framer Motion `<Reorder.Group>` and `<Reorder.Item>` drag reorder list with `GripVertical` handle, `Trash2` button per song for deletion.
3. Update `components/NowPlaying.tsx`:
   - Add `onClick={() => setQueueOpen(true)}` to current playlist badge and song title text with `cursor-pointer hover:opacity-80`.
4. Update `components/PlayerControls.tsx`:
   - Add `<button onClick={() => setQueueOpen(!isQueueOpen)}>` with `<ListMusic size={20} />` icon and active highlight state.
5. Mount `<QueueDrawer />` in `app/page.tsx`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute `npm run lint` and `npm run build` upon completion to verify zero errors (exit code 0).
Write your handoff report to `d:\Projeler\Selin\selin-player\.agents\worker1_m3\handoff.md` and send a message back to parent when complete.
