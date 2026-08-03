# Handoff Report: M1 YouTube Search Helper Design

## 1. Observation
- `app/api/search/route.ts` (lines 88-257): Implements YouTube video search using a three-tier fallback mechanism:
  1. YouTube Data API v3 (`process.env.YOUTUBE_API_KEY`, lines 101-160)
  2. Server-side HTML scraper (`ytInitialData`, lines 162-230)
  3. HTML regex scanner fallback (lines 233-250)
- `lib/types.ts` (lines 9-20, 38-45): Defines `Song` and `YouTubeSearchResult` interfaces.
- `components/SearchDrawer.tsx` (lines 93-101): Converts `YouTubeSearchResult` to `Song` using helper:
  `id: "yt-" + yt.id`, `audio_url: "https://www.youtube.com/watch?v=" + yt.id`, `youtube_id: yt.id`, `duration`, `cover_url: yt.thumbnail`.
- `components/AudioEngine.tsx` (lines 108-131): Handles playback when `currentSong.youtube_id` is present by invoking `ytPlayerRef.current.loadVideoById(currentSong.youtube_id)`.

## 2. Logic Chain
1. **Observation**: `app/api/search/route.ts` contains the full search logic (API key fetch, ISO 8601 duration parsing, HTML scraper, JSON AST renderer traversal, regex fallback).
2. **Requirement**: `app/api/recommendations/route.ts` needs to search YouTube for each track recommended by Last.fm (`ORIGINAL_REQUEST.md` R1 & `PROJECT.md` M1).
3. **Reasoning**: Duplicating 250+ lines of scraper and API code in `app/api/recommendations/route.ts` would create maintenance debt and inconsistency.
4. **Conclusion**: Extracting all search and HTML parsing utilities into `lib/youtube.ts` as `searchYouTube(query: string, limit: number = 15): Promise<YouTubeSearchResult[]>` and `youtubeSearchResultToSong(result: YouTubeSearchResult, overrideArtist?: string): Song` allows both `/api/search` and `/api/recommendations` to import a clean, tested, reusable helper.

## 3. Caveats
- YouTube HTML scraping (`ytInitialData`) depends on YouTube's public web response format. If YouTube changes its client JSON structure, the `findVideoRenderers` recursive search and regex patterns may need updates. However, preserving the three-tier fallback (API v3 -> `ytInitialData` -> regex) ensures maximum resilience.
- The `YOUTUBE_API_KEY` is optional. When absent or when quota is exceeded (HTTP 403), `searchYouTube` seamlessly degrades to HTML scraping.

## 4. Conclusion
The design of `lib/youtube.ts` is complete and fully specified in `d:\Projeler\Selin\selin-player\.agents\m1_explorer_1\analysis.md`.
The implementer agent can safely create `lib/youtube.ts` and refactor `app/api/search/route.ts` to import `searchYouTube`.

## 5. Verification Method
1. **File Inspection**:
   - Inspect `d:\Projeler\Selin\selin-player\.agents\m1_explorer_1\analysis.md` for full module implementation specifications.
2. **Implementation Verification**:
   - Verify `lib/youtube.ts` exports `searchYouTube` and `youtubeSearchResultToSong`.
   - Verify `app/api/search/route.ts` delegates to `searchYouTube`.
3. **Build Command**:
   - Run `npm run lint` to check for TypeScript / ESLint errors.
   - Run `npm run build` to confirm Next.js build compilation.
