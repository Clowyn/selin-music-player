# Project: Selin Music Player Enhancements

## Architecture
- Framework: Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand v5 store.
- Shared YouTube search helper: `lib/youtube.ts` (refactored/reused YouTube Data API + fallback logic).
- Recommendations Engine: `app/api/recommendations/route.ts` (Last.fm `track.getSimilar` + YouTube resolution via `lib/youtube.ts`).
- Lyrics Engine: `app/api/lyrics/route.ts` (LRCLIB `/api/get` -> `/api/search` -> `lyrics.ovh` fallback + LRC timestamp parser).
- Recommendations UI Placements:
  1. "Keşfet" tab in `components/PlaylistDrawer.tsx` (10-15 recommended songs).
  2. Empty state recommendations in `components/SearchDrawer.tsx` (5-8 suggested songs).
  3. "Up Next" horizontal scroll row on `app/page.tsx` (3-5 recommended songs).
- Lyrics Sheet Component: `components/LyricsSheet.tsx` (Karaoke sync, auto-scroll, empty state, triggered by ♪ / `MicVocal` icon in `components/PlayerControls.tsx`).

## Feature Inventory
Every feature from ORIGINAL_REQUEST.md is assigned to a milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Last.fm & YT Recommendation Engine API | `app/api/recommendations/route.ts` returning playable `Song[]` based on title+artist | M1 | R1 |
| 2 | "Keşfet" Tab in PlaylistDrawer | 3rd tab in `PlaylistDrawer.tsx` showing 10-15 recommendations with Play/Queue/Favorite actions | M2 | R2 |
| 3 | Recommendations in SearchDrawer Empty State | Dynamic "🎵 Sana Özel Öneriler" in `SearchDrawer.tsx` when query is empty | M2 | R2 |
| 4 | "Up Next" Horizontal Scroll Row | Compact horizontal scrollable row on `app/page.tsx` below NowPlaying | M2 | R2 |
| 5 | Synced Lyrics API | `app/api/lyrics/route.ts` with LRCLIB + lyrics.ovh fallback and LRC parsing | M3 | R3 |
| 6 | LyricsSheet Component & Karaoke Sync | `LyricsSheet.tsx` slide-up sheet with karaoke sync, auto-scroll, and empty state | M3 | R3 |
| 7 | Lyrics Button in PlayerControls | `MicVocal` (♪) button in `PlayerControls.tsx` toggling `LyricsSheet.tsx` | M3 | R3 |
| 8 | Integration & Build Verification | `npm run lint` (0 errors) and `npm run build` (exit code 0) | M4 | R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Recommendations API & YouTube Helper | `lib/youtube.ts`, `app/api/recommendations/route.ts`, `.env.example` update | None | DONE |
| M2 | Recommendations UI Integration | `components/PlaylistDrawer.tsx`, `components/SearchDrawer.tsx`, `app/page.tsx` ("Up Next") | M1 | DONE |
| M3 | Synced Lyrics API & Viewer | `app/api/lyrics/route.ts`, `components/LyricsSheet.tsx`, `components/PlayerControls.tsx`, `app/page.tsx` | None | DONE |
| M4 | Integration & Build Verification | ESLint linting verification (0 errors), Next.js build compilation (exit code 0) | M1, M2, M3 | DONE |



## Interface Contracts
### Recommendations API Contract
- `GET /api/recommendations?title={title}&artist={artist}`
- Response format:
  ```json
  {
    "recommendations": [
      {
        "id": "yt-VIDEO_ID",
        "title": "Song Title",
        "artist": "Artist Name",
        "audio_url": "https://www.youtube.com/watch?v=VIDEO_ID",
        "youtube_id": "VIDEO_ID",
        "duration": 210,
        "cover_url": "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"
      }
    ]
  }
  ```

### Lyrics API Contract
- `GET /api/lyrics?title={title}&artist={artist}`
- Response format:
  ```json
  {
    "lyrics": "Raw or plain lyrics string...",
    "synced": true,
    "lines": [
      { "time": 12.5, "text": "First line of lyrics" },
      { "time": 16.8, "text": "Second line of lyrics" }
    ]
  }
  ```

## Code Layout
- `lib/youtube.ts` — Shared YouTube search helper (extracted/reused by search and recommendations APIs).
- `app/api/recommendations/route.ts` — Last.fm + YouTube recommendation API endpoint.
- `app/api/lyrics/route.ts` — LRCLIB + lyrics.ovh lyrics API endpoint with LRC timestamp parser.
- `components/LyricsSheet.tsx` — Glassmorphic slide-up drawer for synced karaoke lyrics.
- `components/PlaylistDrawer.tsx` — Added "Keşfet" tab with 10-15 recommendations.
- `components/SearchDrawer.tsx` — Added empty query recommendation section.
- `components/PlayerControls.tsx` — Added ♪ (`MicVocal`) lyrics sheet toggle button.
- `app/page.tsx` — Added "Up Next" horizontal row & `LyricsSheet` integration.
