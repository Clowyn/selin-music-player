# Analysis Report: Supabase Sync & Queue Editing Edge Cases (Requirement R4)

## 1. Supabase Database Schema & Table Structures

Based on `supabase-migration.sql` (and `supabase/migrations/01_schema.sql`), the relevant tables and RLS policies are defined as follows:

```sql
-- Playlists Table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mood_description TEXT,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Songs Table
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

-- RLS Policies
CREATE POLICY "Public access" ON playlists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON songs FOR ALL USING (true) WITH CHECK (true);
```

### Table Analysis
- **`songs` table**: Key field `track_order INT DEFAULT 0` stores zero-based positional ordering of songs within a playlist. Foreign key `playlist_id` references `playlists(id)` with `ON DELETE CASCADE`.
- **`playlists` table**: Key field `name TEXT NOT NULL` stores the playlist display title.
- **Row Level Security**: Permissive public policies (`FOR ALL`) allow direct client-side updates via `@supabase/supabase-js` without custom JWT auth tokens.

---

## 2. Supabase Query Patterns

### A. Batch Update `track_order` in `songs` Table
When songs are reordered in the queue drawer via drag-and-drop, each song's position in the new array corresponds to its updated `track_order` index.

#### Recommended Query Pattern: Parallel `Promise.all` Updates
```typescript
async function updateTrackOrders(songs: Song[]): Promise<void> {
  const updatePromises = songs.map((song, index) =>
    supabase
      .from('songs')
      .update({ track_order: index })
      .eq('id', song.id)
  );

  const results = await Promise.all(updatePromises);
  const errorResult = results.find((r) => r.error);
  if (errorResult?.error) {
    console.error('Supabase reorder track_order error:', errorResult.error);
  }
}
```
*Rationale*:
- Cleanly updates only the `track_order` column without needing to pass or validate full song row data.
- Handles custom/dynamically generated song objects (e.g. YouTube search items) gracefully without triggering `NOT NULL` column constraint violations on Postgres.
- Fast execution for typical playlist queue sizes (5 to 50 songs).

#### Alternative Query Pattern: Batch `upsert`
```typescript
async function batchUpsertTrackOrders(songs: Song[]): Promise<void> {
  const payload = songs.map((song, index) => ({
    id: song.id,
    playlist_id: song.playlist_id,
    title: song.title,
    artist: song.artist,
    audio_url: song.audio_url,
    youtube_id: song.youtube_id || null,
    cover_url: song.cover_url || null,
    duration: song.duration || 0,
    track_order: index,
  }));

  const { error } = await supabase
    .from('songs')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('Supabase upsert track_order error:', error);
  }
}
```
*Recommendation*: Primary pattern should be `Promise.all` `.update({ track_order: index })` to guarantee safety regardless of song source.

---

### B. Delete Song from `songs` Table by ID
```typescript
async function deleteSongFromSupabase(songId: string): Promise<void> {
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', songId);

  if (error) {
    console.error('Supabase delete song error:', error);
  }
}
```
*Rationale*: Target `id = songId` on `songs` table. On deletion, Postgres removes the record. If the song was also saved in local state/queue, local Zustand state is updated optimistically.

---

### C. Update Playlist Name in `playlists` Table by ID
```typescript
async function updatePlaylistName(playlistId: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .update({ name: newName })
    .eq('id', playlistId);

  if (error) {
    console.error('Supabase rename playlist error:', error);
  }
}
```
*Rationale*: Updates `name` column on `playlists` table matching `playlistId`.

---

## 3. Edge Case Handling

### Edge Case 1: Deleting the Currently Playing Song
**Problem Scenario**: User deletes a song from the queue drawer while that exact song (`currentSong.id === songId`) is currently playing or paused.

**Required Behavioral Workflow**:
1. **Optimistic Queue Filter**:
   Remove `songId` from local `songs` and `queue` arrays immediately.
2. **Branching Condition A (Queue is NOT empty, `remainingSongs.length > 0`)**:
   - Determine deleted song's original index: `deletedIndex = songs.findIndex(s => s.id === songId)`.
   - Calculate next song index: `nextIndex = deletedIndex < remainingSongs.length ? deletedIndex : 0`.
   - Update Zustand store: `currentSong: remainingSongs[nextIndex]`, `currentTime: 0`, `isPlaying: true`.
   - Audio engines (HTML5 `<audio>` / YouTube iFrame) automatically switch to `remainingSongs[nextIndex]` without breaking playback.
3. **Branching Condition B (Queue becomes empty, `remainingSongs.length === 0`)**:
   - Update Zustand store: `currentSong: null`, `songs: []`, `queue: []`, `isPlaying: false`, `currentTime: 0`, `duration: 0`.
   - **Stop HTML5 Audio Engine**:
     ```typescript
     const audio = document.getElementById('player-audio') as HTMLAudioElement;
     if (audio) {
       audio.pause();
       audio.src = '';
     }
     ```
   - **Stop YouTube Player Engine**:
     ```typescript
     if (typeof window !== 'undefined' && window.ytPlayer) {
       try {
         window.ytPlayer.stopVideo();
       } catch {}
     }
     ```
4. **Asynchronous Supabase Sync**:
   Fire `supabase.from('songs').delete().eq('id', songId)` asynchronously in background.

---

### Edge Case 2: Reordering Songs While Playback Is Active
**Problem Scenario**: User drags and reorders songs in the Queue Drawer while audio/video is playing.

**Required Behavioral Workflow**:
1. **Uninterrupted Audio Playback**:
   - Reordering updates `songs` and `queue` array order in Zustand store (`set({ songs: newSongs, queue: newSongs })`).
   - The active `currentSong` object reference remains unchanged in Zustand state.
   - HTML5 `<audio>` stream or YouTube iFrame video continues playing seamlessly without interruption, audio reset, seek position jump, or frame stutter.
2. **Dynamic Next/Prev Array Navigation**:
   - In `store/playerStore.ts`, `nextSong()` and `prevSong()` evaluate the current song's position dynamically:
     ```typescript
     const currentIndex = songs.findIndex((s) => s.id === currentSong.id);
     ```
   - Because `songs` is updated to `newSongs`, pressing Next or Previous after reordering follows the new track sequence.
3. **Asynchronous Supabase Sync**:
   - Fire batch track order update in background.

---

### Edge Case 3: Supabase Connection Error Fallback
**Problem Scenario**: Device is offline, network drops, or Supabase API fails.

**Required Behavioral Workflow**:
1. **Optimistic Local State Update First**:
   Always mutate local Zustand store synchronously before executing remote Supabase network requests.
   This guarantees 0ms UI latency and smooth drag-and-drop animation for the user.
2. **Try-Catch & Error Log Strategy**:
   Wrap every Supabase SDK invocation in `try { ... } catch (err) { console.error(...) }` and inspect the returned `{ error }` object from Supabase.
   Log error details via `console.error` (e.g. `'Supabase connection error:'`, `err`).
3. **Non-Blocking Persistence**:
   Do not block the user interface or display disruptive crash screens. The user can continue editing and playing music offline, with errors silently logged for developer/admin diagnostics.

---

## 4. Zustand Store Integration Specification (`store/playerStore.ts`)

```typescript
export interface PlayerState {
  // Existing state...
  isQueueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  reorderQueue: (newSongs: Song[]) => Promise<void>;
  deleteSongFromPlaylist: (songId: string) => Promise<void>;
  renamePlaylist: (playlistId: string, newName: string) => Promise<void>;
}

// Concrete Implementations for store/playerStore.ts:

setQueueOpen: (open: boolean) => set({ isQueueOpen: open }),

reorderQueue: async (newSongs: Song[]) => {
  // Optimistic local update
  set({ songs: newSongs, queue: newSongs });

  // Supabase sync
  try {
    const updatePromises = newSongs.map((song, index) =>
      supabase
        .from('songs')
        .update({ track_order: index })
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
          window.ytPlayer.stopVideo();
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
    set({ currentPlaylist: { ...currentPlaylist, name: newName } });
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
```
