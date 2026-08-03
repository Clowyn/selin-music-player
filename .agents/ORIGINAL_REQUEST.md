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
