# Handoff Report: Supabase Sync & Queue Editing Edge Cases Analysis (Milestone 3 / Requirement R4)

## 1. Observation
Directly observed codebase files and database schemas:
- **`supabase-migration.sql` (lines 17–28, 67, 74)**:
  ```sql
  CREATE TABLE IF NOT EXISTS songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT DEFAULT 'Sana Özel',
    audio_url TEXT NOT NULL,
    youtube_id TEXT,
    cover_url TEXT,
    duration INT DEFAULT 0,
    track_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );
  ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public access" ON songs FOR ALL USING (true) WITH CHECK (true);
  ```
- **`supabase-migration.sql` (lines 8–14, 66, 73)**:
  ```sql
  CREATE TABLE IF NOT EXISTS playlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    mood_description TEXT,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );
  ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public access" ON playlists FOR ALL USING (true) WITH CHECK (true);
  ```
- **`store/playerStore.ts` (lines 5–42, 69–107)**:
  Existing Zustand store handles state `currentSong`, `currentPlaylist`, `songs`, `queue`, `isPlaying`, `currentTime`, `duration`. `nextSong()` and `prevSong()` evaluate current index via `songs.findIndex(s => s.id === currentSong.id)`.

---

## 2. Logic Chain

1. **Observation**: `songs` table has column `track_order INT DEFAULT 0` and primary key `id UUID`.
   **Reasoning**: Reordering items in the Queue Drawer changes the relative position index of songs. Passing an array of `update({ track_order: index })` requests per song to Supabase via `Promise.all` ensures only `track_order` is updated without risking constraint errors on optional/missing fields.

2. **Observation**: `songs` table allows row deletion by `id UUID`, and `playlists` table allows title updates on `name TEXT`.
   **Reasoning**: `deleteSongFromPlaylist` calls `supabase.from('songs').delete().eq('id', songId)`. `renamePlaylist` calls `supabase.from('playlists').update({ name: newName }).eq('id', playlistId)`.

3. **Observation**: `store/playerStore.ts` manages audio playback via `currentSong` state and DOM audio/YouTube player elements.
   **Reasoning**:
   - Deleting the playing song when `songs.length > 1` requires auto-advancing to `songs[nextIndex]` and keeping `isPlaying: true`.
   - Deleting the playing song when `songs.length === 1` empties the queue (`currentSong: null`, `isPlaying: false`, `currentTime: 0`) and requires explicit call to `audio.pause(); audio.src = '';` and `ytPlayer.stopVideo()`.
   - Reordering songs during playback only changes array order in Zustand store (`songs`, `queue`). Since `currentSong` object reference is untouched, active playback continues without audio interruption.

4. **Observation**: Client network interruptions can cause Supabase SDK calls to throw exceptions or return error objects.
   **Reasoning**: Optimistically updating Zustand local state synchronously before executing Supabase calls ensures responsive user interactions (0ms drag-and-drop / delete latency). Wrapping Supabase calls in `try / catch` with `console.error` satisfies the fallback requirement without breaking UI state.

---

## 3. Caveats
- If a song in the queue was added temporarily (e.g. from YouTube search without being inserted into the `songs` table in database yet), deleting or reordering it will invoke Supabase query on its `id`. Supabase returns zero affected rows without throwing a Postgres constraint error, which is handled gracefully by the optimistic store implementation and error logger.
- No other caveats identified.

---

## 4. Conclusion
The exact Supabase query patterns and edge case algorithms are fully analyzed and specified for Milestone 3 (Requirement R4). Implementing `reorderQueue`, `deleteSongFromPlaylist`, and `renamePlaylist` in `store/playerStore.ts` with optimistic Zustand state updates, non-blocking Supabase sync, and complete empty-queue/active-playback edge case handling satisfies all specification requirements.

---

## 5. Verification Method
1. **Source Inspection**:
   - Inspect `store/playerStore.ts` for addition of `reorderQueue`, `deleteSongFromPlaylist`, `renamePlaylist`, `isQueueOpen`, and `setQueueOpen`.
   - Confirm `Promise.all` `track_order` update pattern, `songs.delete().eq('id', songId)`, and `playlists.update({ name }).eq('id', playlistId)`.
2. **Build Verification**:
   - Run `npm run lint` from `d:\Projeler\Selin\selin-player` (must return exit code 0).
   - Run `npm run build` from `d:\Projeler\Selin\selin-player` (must build successfully).
