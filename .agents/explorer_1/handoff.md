# Handoff Report — Data Layer & API Patterns Investigation

## 1. Observation

### Key Codebase Files Examined
- **`lib/types.ts`**: Lines 1–48. Contains definitions for `Playlist` (lines 1-7), `Song` (lines 9-20), `BackgroundMedia` (lines 22-29), `CharacterSprite` (lines 31-36), `YouTubeSearchResult` (lines 38-45), and `RepeatMode` (line 47).
- **`store/playerStore.ts`**: Lines 1–220. Defines `usePlayerStore` Zustand hook. Key actions include `setCurrentSong` (line 59), `nextSong` (lines 65-103), `prevSong` (lines 105-121), `addToQueue` (lines 150-155), `toggleFavorite` (lines 161-191), and `fetchFavorites` (lines 193-218).
- **`app/api/search/route.ts`**: Lines 1–258. `GET` endpoint for YouTube search. Implements YouTube Data API v3 when `YOUTUBE_API_KEY` exists (lines 101-160), HTML AST scraper `ytInitialData` fallback (lines 163-230), and raw HTML regex fallback (lines 233-250).
- **`components/SearchDrawer.tsx`**: Lines 93–101 (`convertToSong` mapping YouTube search results to `Song` object format) and lines 103–136 (handlers for play, queue, favorite, and playlist addition).
- **`components/AudioEngine.tsx`**: Lines 1–286. Coordinates dual audio playback via HTML5 `<audio id="player-audio">` and hidden `<div id="youtube-player">` using `window.ytPlayer`.
- **`components/PlaylistDrawer.tsx`**: Lines 1–291. Bottom slide-up drawer with "Çalma Listeleri" and "💖 Favorilerim" tabs.
- **`app/page.tsx`**: Lines 1–60. Main page composing `AudioEngine`, `BackgroundSlideshow`, `FloatingSprites`, `BirthdayGreeting`, `NowPlaying`, `CustomSeekbar`, `PlayerControls`, `PlaylistDrawer`, and `SearchDrawer`.

---

## 2. Logic Chain

1. **Observation**: In `lib/types.ts` (lines 9-20), `Song` contains `youtube_id?: string`, `audio_url: string`, `duration: number`, `cover_url?: string`, `title: string`, and `artist: string`. In `components/SearchDrawer.tsx` (lines 93-101), `YouTubeSearchResult` items are mapped to `Song` objects using `id: yt-${yt.id}`, `youtube_id: yt.id`, `audio_url: https://www.youtube.com/watch?v=${yt.id}`, and `cover_url: yt.thumbnail`.
   - **Deduction**: Any recommendation returned by `app/api/recommendations/route.ts` must produce or return objects matching this precise `Song` structure so that store actions (`setCurrentSong`, `addToQueue`, `toggleFavorite`) operate without UI adaptation or transformation bugs.

2. **Observation**: `store/playerStore.ts` manages player navigation via `nextSong()` (lines 65-103) and `prevSong()` (lines 105-121). `nextSong()` checks `repeatMode === 'single'`, `isShuffle`, and `songs` list boundaries. `addToQueue(song)` (lines 150-155) appends to both `queue` and `songs` if missing.
   - **Deduction**: Playing a recommended track via `setCurrentSong(recommendedSong)` will set it as active. To allow seamless next/previous track navigation, recommended tracks can also be queued via `addToQueue(recommendedSong)`, automatically updating the store's `songs` array.

3. **Observation**: `app/api/search/route.ts` uses YouTube Data API v3 when `process.env.YOUTUBE_API_KEY` is defined (lines 101-160), and falls back to server-side HTML scraping of `ytInitialData` (lines 163-230) or regex scanning (lines 233-250) when no key is present or API fails.
   - **Deduction**: `app/api/recommendations/route.ts` can reuse this exact dual-mode search mechanism. Extracting the YouTube search logic into a shared helper function (e.g. `lib/youtube.ts`) enables both `/api/search` and `/api/recommendations` to share search capabilities reliably.

4. **Observation**: Requirement R1 asks for `app/api/recommendations/route.ts` to query Last.fm `track.getSimilar` using `process.env.LASTFM_API_KEY`.
   - **Deduction**: The recommendation route should:
     a. Accept `title` and `artist` as query parameters.
     b. Request similar tracks from Last.fm API (`track.getsimilar`).
     c. Resolve top similar tracks to playable YouTube videos in parallel using `Promise.allSettled`.
     d. Include a fallback mode (searching YouTube directly for related track mixes or artist top tracks) if `LASTFM_API_KEY` is missing or if Last.fm returns no results.

---

## 3. Caveats

- **Last.fm Track Coverage**: Obscure local or indie tracks might return empty results from Last.fm `track.getSimilar`. The fallback strategy (falling back to `artist.getTopTracks` or YouTube mix search) handles this gracefully.
- **YouTube Scraper Rate Limits**: Excessive server-side scraping requests to YouTube without `YOUTUBE_API_KEY` might trigger YouTube rate limits or CAPTCHAs. Utilizing an in-memory TTL cache for recommendation responses is recommended to minimize outbound requests.
- **Concurrency**: Resolving 10 candidate tracks via YouTube search in parallel is fast (~1s), but should be capped to 8-10 tracks per recommendation request to keep latency minimal.

---

## 4. Conclusion

The data layer and API patterns of Selin Music Player are clean, decoupled, and well-structured.
- `store/playerStore.ts` natively supports playing, queuing, and favoriting `Song` objects with `youtube_id`.
- `app/api/search/route.ts` handles video search and duration extraction with multi-tier fallbacks.
- `app/api/recommendations/route.ts` can be cleanly implemented by combining Last.fm `track.getSimilar` with parallel YouTube resolution, producing `Song[]` output ready for direct consumption by the 3 recommended UI placements ("Keşfet" tab in `PlaylistDrawer.tsx`, `SearchDrawer.tsx` empty state, and "Up Next" row on `app/page.tsx`).

Full technical details and recommended code patterns are documented in `analysis.md`.

---

## 5. Verification Method

To verify these findings and future route implementation:
1. **Inspect TypeScript Types**: Check `lib/types.ts` to confirm `Song` and `YouTubeSearchResult` interfaces.
2. **Execute Build & Lint Checks**:
   ```powershell
   npm run lint
   npm run build
   ```
3. **Verify Recommendation API Contract**:
   When implemented, query the endpoint:
   `http://localhost:3000/api/recommendations?title=Yolla&artist=Tarkan`
   Verify that response JSON contains `{ recommendations: Song[] }` where each item has valid `id`, `title`, `artist`, `youtube_id`, `duration`, and `cover_url`.
