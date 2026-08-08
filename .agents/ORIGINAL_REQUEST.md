# Original User Request

## Initial Request — 2026-08-03T18:10:52Z

Add smart song recommendations and a karaoke-style synced lyrics viewer to an existing Next.js PWA music player (Selin Music Player). The app is a birthday gift for the user's girlfriend — it streams music from YouTube via the iFrame Player API and has a dark glassmorphic pink/purple design with Tailwind CSS and Framer Motion.

Working directory: d:\Projeler\Selin\selin-player
Integrity mode: development

**Existing tech stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand (global store at `store/playerStore.ts`), Supabase (DB + storage), Lucide React icons. YouTube playback via hidden iFrame API in `components/AudioEngine.tsx`. The existing YouTube search API is at `app/api/search/route.ts`.

**Key existing files to integrate with (do NOT rewrite from scratch — extend them):**
- `store/playerStore.ts` — Zustand store with `currentSong`, `isPlaying`, `currentTime`, `duration`, etc.
- `components/PlayerControls.tsx` — Horizontal control bar with shuffle, prev, play/pause, next, repeat, search, heart, add-to-playlist buttons.
- `components/PlaylistDrawer.tsx` — Bottom slide-up drawer with "Çalma Listeleri" and "💖 Favorilerim" tabs.
- `components/SearchDrawer.tsx` — Slide-up search drawer for YouTube search.
- `components/AudioEngine.tsx` — Dual HTML5 + YouTube iFrame player engine. Exports `YTPlayer` interface.
- `lib/types.ts` — `Song`, `Playlist`, `YouTubeSearchResult` interfaces.
- `app/page.tsx` — Main page composing all components.

**Design language:** All new UI must use dark glassmorphism (bg-gray-900/90 backdrop-blur-xl, border-white/10, pink-500/purple-600 accents). Turkish UI labels. Framer Motion animations for all transitions.

## Requirements

### R1. Song Recommendations Engine
Build a recommendation system that suggests similar songs based on the currently playing song. Use Last.fm's `track.getSimilar` API (free, no auth required for public data — use the API key from env var `LASTFM_API_KEY`) to find similar tracks by title+artist, then search YouTube for playable versions of each recommendation using the existing `/api/search` endpoint pattern. Create a new API route `app/api/recommendations/route.ts` that accepts a song title and artist, returns a list of recommended songs with YouTube video IDs, thumbnails, titles, artists, and durations.

### R2. Recommendations UI (3 placements)
Display recommendations in three places:
1. **"Keşfet" (Discover) tab** in `PlaylistDrawer.tsx` — a new third tab alongside "Çalma Listeleri" and "Favorilerim" showing 10-15 recommended songs based on the currently playing song, with Play/Queue/Favorite action buttons.
2. **Search Drawer default state** — when `SearchDrawer.tsx` has no search query, show a "🎵 Sana Özel Öneriler" (Recommendations for You) section with 5-8 suggested songs instead of the empty placeholder.
3. **"Up Next" section** — below the Now Playing area on the main page, show 3-5 recommended songs in a horizontal scrollable row with compact cards.

Each recommended song must be playable (Play), queueable (+ Queue), and favoritable (💖) using existing store actions.

### R3. Synced Lyrics Viewer
Fetch lyrics for the currently playing song from a free lyrics API (lrclib.net for time-synced LRC format, with lyrics.ovh as a plain-text fallback). Create a new API route `app/api/lyrics/route.ts`. Build a `LyricsSheet.tsx` component — a slide-up sheet (similar to SearchDrawer) that:
- Displays lyrics with karaoke-style sync: highlights the current line in pink (`text-pink-400`) based on `currentTime` from the player store.
- Auto-scrolls to keep the active line centered.
- Falls back to static scrollable lyrics if no synced (LRC) data is available.
- Triggered by a music note icon (♪ / `MicVocal` from Lucide) added to `PlayerControls.tsx`.
- Shows "Şarkı sözü bulunamadı" (Lyrics not found) with a gentle empty state if no lyrics are available.

### R4. Integration & Build Verification
All new code must integrate cleanly with the existing codebase. The project must pass `npm run lint` (0 errors) and `npm run build` (exit code 0) after all changes.

## Acceptance Criteria

### Recommendations
- [ ] `GET /api/recommendations?title=X&artist=Y` returns JSON with at least 5 recommended songs, each having `title`, `artist`, `youtube_id`, `thumbnail`, and `duration` fields.
- [ ] The "Keşfet" tab appears in PlaylistDrawer and loads recommendations based on the current song.
- [ ] SearchDrawer shows recommendations when the search input is empty.
- [ ] A horizontal "Up Next" row appears on the main page below the now-playing area.
- [ ] Tapping Play on a recommendation starts streaming it via YouTube.

### Lyrics
- [ ] `GET /api/lyrics?title=X&artist=Y` returns JSON with `{ lyrics: string, synced: boolean, lines?: Array<{time: number, text: string}> }`.
- [ ] A ♪ icon in PlayerControls opens the LyricsSheet.
- [ ] When synced lyrics are available, the current line is highlighted in pink and auto-scrolls.
- [ ] When only plain lyrics are available, they display as static scrollable text.
- [ ] When no lyrics are found, a friendly empty state is shown.

### Build
- [ ] `npm run lint` exits with 0 errors (warnings are acceptable).
- [ ] `npm run build` exits with code 0 and all routes compile.

## Follow-up — 2026-08-06T23:56:49Z

Fix UI spacing, redesign the recommendations section, improve lyrics coverage, and add a Now Playing Queue drawer with playlist editing to the Selin Music Player PWA. The app streams music from YouTube via iFrame API, uses a dark glassmorphic pink/purple design with Tailwind CSS and Framer Motion.

Working directory: d:\Projeler\Selin\selin-player
Integrity mode: development

**Existing tech stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand (store at `store/playerStore.ts`), Supabase (DB + storage), Lucide React icons.

**Key files to modify (extend, do NOT rewrite from scratch):**
- `components/PlayerControls.tsx` — Horizontal control bar (needs wider padding)
- `components/UpNextRow.tsx` — Currently shows large recommendation cards taking 40% of the screen
- `app/api/lyrics/route.ts` — Currently uses LRCLIB + lyrics.ovh (needs Genius fallback)
- `components/LyricsSheet.tsx` — Karaoke-style lyrics viewer
- `store/playerStore.ts` — Zustand store with `currentSong`, `songs`, `queue`, etc.
- `components/PlaylistDrawer.tsx` — Bottom drawer with Çalma Listeleri, Favorilerim, Keşfet tabs
- `app/page.tsx` — Main page composing all components
- `lib/types.ts` — Song, Playlist interfaces

**Design language:** Dark glassmorphism (bg-gray-900/90 backdrop-blur-xl, border-white/10, pink-500/purple-600 accents). Turkish UI labels. Framer Motion animations.

## Requirements

### R1. Wider Control Bar
Increase the vertical padding of the PlayerControls bar in `components/PlayerControls.tsx` by approximately 5 pixels (e.g., change `p-3` to `p-4` or add `py-4`). The control bar should feel slightly more spacious and easier to tap on mobile.

### R2. Compact Recommendations Strip
Redesign `components/UpNextRow.tsx` from large horizontal-scroll cards to a compact single-line strip/pill that takes minimal vertical space. It should show the recommended song title with basic action buttons (play, add to queue) in a thin horizontal bar. The entire Up Next section should take no more than ~50px of vertical space on mobile instead of the current ~200px.

### R3. Improved Lyrics Coverage with Genius Fallback
Add Genius lyrics as a 3rd fallback source in `app/api/lyrics/route.ts` between LRCLIB and lyrics.ovh. The Genius API should be used to search for lyrics by title+artist and scrape the lyrics page content. Also improve the title/artist cleaning logic to better handle YouTube video titles with extra metadata (e.g., "(Official Video)", "HD", "VEVO", etc.). The goal is significantly better lyrics coverage for Turkish and international songs.

### R4. Now Playing Queue Drawer with Playlist Editing
Create a new "Now Playing Queue" drawer that shows all songs in the current playlist/queue. The drawer should:
- Be triggered by tapping the playlist/song name in the Now Playing area or a dedicated queue icon
- Show all songs with the currently playing song highlighted
- Allow tapping any song to jump to it
- Include an "Edit Mode" toggle that enables:
  - Drag-and-drop reordering of songs
  - Delete individual songs from the playlist
  - Rename the playlist (inline edit)
- Changes in edit mode should sync back to Supabase (update `track_order` for reordered songs, delete songs, update playlist name)

### R5. Build Verification
All changes must pass `npm run lint` (0 errors) and `npm run build` (exit code 0).

## Acceptance Criteria

### Control Bar
- [ ] PlayerControls bar has visibly more vertical padding (~5px increase) compared to current state.
- [ ] The bar remains responsive and doesn't overflow on mobile screens.

### Recommendations Strip
- [ ] UpNextRow takes no more than ~50px vertical space on a mobile viewport.
- [ ] Recommended song title and action buttons (play, queue) are visible and functional.
- [ ] The strip auto-hides when there are no recommendations (same as current behavior).

### Lyrics
- [ ] `GET /api/lyrics?title=Yolla&artist=Tarkan` returns lyrics (either synced or plain).
- [ ] `GET /api/lyrics?title=Cambaz&artist=Mor+ve+%C3%96tesi` returns lyrics.
- [ ] The lyrics API has at least 3 fallback sources (LRCLIB synced → LRCLIB search → Genius → lyrics.ovh).
- [ ] YouTube title cleaning properly strips "(Official Video)", "HD", "VEVO", "- Topic" etc.

### Now Playing Queue
- [ ] Tapping the song/playlist name or a queue icon opens a queue drawer showing all songs.
- [ ] The currently playing song is visually highlighted (pink accent).
- [ ] Tapping a song in the queue starts playing it immediately.
- [ ] Edit mode shows drag handles for reordering, delete buttons, and a rename field for the playlist.
- [ ] Reordering songs updates `track_order` in Supabase.
- [ ] Deleting a song removes it from the playlist in Supabase.
- [ ] Renaming a playlist updates the name in Supabase.

### Build
- [ ] `npm run lint` exits with 0 errors (warnings acceptable).
- [ ] `npm run build` exits with code 0 and all routes compile.

## Follow-up — 2026-08-08T21:39:07Z

# Teamwork Project Prompt — Selin Music Player UI & Recommendation Fixes

Fix 3 core issues in the Selin Music Player PWA (`d:\Projeler\Selin\selin-player`):

Working directory: d:\Projeler\Selin\selin-player
Integrity mode: development

## Requirements

### R1. Control Panel Frame & Button Layout
- Fix button overflow in `components/PlayerControls.tsx`. The glassmorphic background container must frame all controls cleanly without any buttons overflowing out of the box or getting cut off on mobile/desktop screens.
- Use a clean 2-row layout or a responsive flex arrangement where main playback controls (Shuffle, SkipBack, Play/Pause, SkipForward, Repeat) stay inside the main glass card and secondary action buttons (Lyrics, Queue, Search, Favorite, Add to Playlist) are neatly positioned.
- Revert any excessive padding on individual buttons so the container visually frames the buttons naturally.

### R2. Restore & Fix Lyrics Sheet
- Ensure the Lyrics Karaoke Sheet (`components/LyricsSheet.tsx`) opens cleanly when the Lyrics (`MicVocal`) icon is clicked in `PlayerControls.tsx`.
- Verify state synchronization (`isLyricsOpen`, `toggleLyricsOpen`, `setLyricsOpen`) in `store/playerStore.ts` and proper z-index / layout composition in `app/page.tsx`.
- Ensure fallback plain lyrics and synced LRC lyrics render reliably when requested.

### R3. Genre-Based Smart Recommendation Engine
- Overhaul `app/api/recommendations/route.ts` and `components/UpNextRow.tsx` / `components/PlaylistDrawer.tsx` / `components/SearchDrawer.tsx`.
- Recommendations MUST return songs of the **SAME GENRE / MOOD / STYLE** rather than unrelated playlists or random videos.
- Example: When playing "Dolu Kadehi Ters Tut - Dilerim Ki", recommendations should return Turkish Indie/Rock/Pop tracks like "Dolu Kadehi Ters Tut - Madem", "Mavi Gri - Dünyanın En Güzel Kızı", "Pinhani - Beni Al", etc.
- Enhance Last.fm API strategy (`track.getSimilar`, `track.getTopTags`, `tag.getTopTracks`) and YouTube search fallback to search specifically by genre/artist similarity queries (`artist + genre + mix / similar`).
- Clean up title & artist metadata parsing so recommendations display clean song titles and artist names instead of full YouTube channel names or playlist titles.

### R4. Build Verification
- Pass `npm run lint` with 0 errors.
- Pass `npm run build` with exit code 0.

## Acceptance Criteria

### Control Panel
- [ ] Control buttons do not overflow outside the glass background container on any screen width.
- [ ] Container cleanly wraps all buttons with visually balanced padding.

### Lyrics Sheet
- [ ] Clicking the `MicVocal` icon opens the slide-up lyrics sheet backdrop and modal.
- [ ] Lyrics API returns lyrics or a friendly empty state without breaking UI layout.

### Recommendations
- [ ] Querying recommendations for a Turkish Indie/Pop/Rock track returns songs of the exact same genre/style.
- [ ] Recommended items are playable individual songs with proper titles, artists, thumbnails, and durations.

### Build
- [ ] `npm run lint` exits with 0 errors.


## Follow-up — 2026-08-08T21:43:37Z

The user updated `PlayerControls.tsx` with a clean 2-row layout inside a unified `max-w-md` glassmorphic container. Verify R1 against this update and proceed with R2, R3, R4.


