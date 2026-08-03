# Handoff Report: Last.fm Recommendations Engine Design (M1)

## 1. Observation
Direct observations from analyzing the existing codebase and project requirements:

1. **Existing YouTube Search Implementation**:
   - `app/api/search/route.ts`: Lines 88-160 implement YouTube Data API v3 searching (using `process.env.YOUTUBE_API_KEY`). Lines 162-252 implement a server-side HTML scraper (`ytInitialData` parsing and regex fallback) when `YOUTUBE_API_KEY` is missing or fails.
   - `lib/types.ts`: Lines 9-20 define the `Song` interface; lines 38-45 define `YouTubeSearchResult`.

2. **API Contract & Requirements**:
   - `PROJECT.md` (lines 37-53): Establishes the Recommendations API contract for `GET /api/recommendations?title={title}&artist={artist}`:
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
   - `ORIGINAL_REQUEST.md` (lines 25-27): Requires Last.fm `track.getSimilar` integration with `LASTFM_API_KEY` env variable and YouTube song resolution.

3. **Last.fm API Endpoint Properties**:
   - URL: `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist={artist}&track={track}&api_key={api_key}&format=json`
   - Response edge cases: Last.fm wraps single result objects without array brackets, returns HTTP 200 with `{ "error": 6, "message": "Track not found" }` on unknown tracks, and yields empty tracks if metadata noise is present in track titles.

---

## 2. Logic Chain

1. **Input Noise Problem**: Raw YouTube video titles (e.g. `"Radiohead - Karma Police (Official Music Video)"`) contain metadata noise that causes Last.fm lookup failure (error code 6).
   *Reasoning*: Parameter sanitization (stripping parentheses, brackets, VEVO suffixes, and splitting artist-title strings) must execute before sending requests to Last.fm.

2. **Availability & Fallback Requirement**: `LASTFM_API_KEY` may be missing in dev/test environments, or Last.fm may fail to return similar tracks for niche songs.
   *Reasoning*: A 3-tier strategy (Tier 1: Last.fm `track.getSimilar` -> Tier 2: Last.fm `artist.getTopTracks` -> Tier 3: YouTube Mix Search) guarantees that valid recommendations are returned under all environment configurations.

3. **Code Reuse Strategy**: Both search and recommendation API routes require searching YouTube to retrieve video IDs, thumbnails, and durations.
   *Reasoning*: Refactoring YouTube search into `lib/youtube.ts` enables `app/api/recommendations/route.ts` and `app/api/search/route.ts` to share a robust, double-fallback search implementation without code duplication.

4. **Response Normalization**: Last.fm JSON responses can return non-array objects when only 1 result is present, or error objects instead of arrays.
   *Reasoning*: JSON parsing must check `Array.isArray()` and handle errors gracefully before mapping tracks to YouTube queries.

---

## 3. Caveats

- **Last.fm Image Availability**: Last.fm `image` arrays can be missing or point to generic placeholder images. Using YouTube thumbnails (`hqdefault.jpg` / snippet thumbnail) in resolved `Song` objects provides consistent visual quality.
- **YouTube Scraper Rate Limits**: Tier 3 fallback and resolution rely on YouTube HTML scraping if `YOUTUBE_API_KEY` is omitted. Heavy concurrent requests during resolution should be capped at 10-15 parallel queries.
- **Environment Key Requirement**: `LASTFM_API_KEY` must be added to `.env.local` / `.env.example` for Tier 1 & 2 to work, but the application will function seamlessly via Tier 3 fallback even without the key.

---

## 4. Conclusion

The design for Last.fm `track.getSimilar` integration in `app/api/recommendations/route.ts` is fully specified in `analysis.md`. It features:
1. Strict parameter sanitization and noise reduction for YouTube titles.
2. A 3-tier fallback pipeline (Track Similar -> Artist Top Tracks -> YouTube Mix Query).
3. Last.fm JSON response parsing resilient to error codes and single-item object collapsing.
4. Stream resolution using the shared `lib/youtube.ts` helper to produce `Song[]` objects matching the `PROJECT.md` contract.

---

## 5. Verification Method

To verify the design once implemented in M1:
1. **Lint Verification**:
   ```powershell
   npm run lint
   ```
   *Expected result*: Exits with code 0 (0 errors).

2. **Build Verification**:
   ```powershell
   npm run build
   ```
   *Expected result*: Next.js build succeeds with compiled `/api/recommendations` route.

3. **Functional API Endpoint Verification**:
   - **With valid `LASTFM_API_KEY`**:
     Query `GET /api/recommendations?title=Karma%20Police&artist=Radiohead` -> Returns 10+ recommended tracks (e.g., songs by Radiohead, Muse, The Smile) with YouTube video IDs and thumbnails.
   - **With missing/invalid key or track**:
     Query `GET /api/recommendations?title=NonExistentSong12345` -> Triggers Tier 3 YouTube fallback and returns playable mix search results without throwing 500 server error.
