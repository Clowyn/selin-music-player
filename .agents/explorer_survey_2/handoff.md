# Handoff Report: Lyrics API Route & Metadata Cleaning (Explorer 2)

**Agent:** Explorer Survey 2 (Lyrics Focus)  
**Target:** `app/api/lyrics/route.ts` & Metadata Cleaning (R3)  
**Date:** 2026-08-06  

---

## 1. Observation

1. **`app/api/lyrics/route.ts` Structure**:
   - Currently implements 3 fetching stages:
     - Lines 137–156: LRCLIB Direct GET (`https://lrclib.net/api/get?track_name=...&artist_name=...`).
     - Lines 159–185: LRCLIB Search GET (`https://lrclib.net/api/search?q=...`).
     - Lines 188–201: lyrics.ovh Fallback GET (`https://api.lyrics.ovh/v1/...`).
     - Lines 203–207: 404 Empty state.
   - Lines 30–66: `parseLrc(lrcText: string)` parses `[mm:ss.xx]` timestamps into `{ time: number, text: string }[]`.
   - Lines 71–92: `cleanTitle` and `cleanArtist` handle regex string cleanups.
   - Lines 97–119: `sanitizeInputs` handles basic splitting on ` - ` if `artist` ends with `vevo`, `- topic`, or is `youtube`.

2. **Metadata Cleaning Deficiencies**:
   - `cleanTitle` (lines 71–79): `replace(/\((official|lyric|live|...).*?\)/gi, '')` fails when keywords do not appear at the start of the parenthesis (e.g. `(Klipsiz / Official Video)`).
   - `sanitizeInputs` (lines 97–119): Does not recognize Turkish record label channel names (`netd müzik`, `Poll Production`, `Pasaj Müzik`, `DMC`, `Kalan Müzik`, etc.) as generic channels. When YouTube search returns channel title `"netd müzik"` for video `"Mor ve Ötesi - Cambaz"`, `sanitizeInputs` leaves `artist` as `"netd müzik"`, causing all lyrics providers to fail.

3. **Genius Integration Constraints & Possibilities**:
   - Genius official API (`api.genius.com/songs/:id`) does not return lyric text due to copyright licensing.
   - `https://genius.com/api/search/multi?q=...` provides search results without API key requirements.
   - Genius HTML pages embed lyrics inside `<div data-lyrics-container="true">...</div>` elements, which can be extracted via HTML fetching and regex tag removal without extra npm packages.

---

## 2. Logic Chain

1. **Observations → Cause of Lyrics Failures**:
   - Turkish YouTube songs uploaded by record labels (`netd müzik`, etc.) pass the label name as `artist` parameter to `/api/lyrics`.
   - Because `sanitizeInputs` only checks for `vevo` / `- topic`, it fails to extract the real artist name embedded in the YouTube title (`Artist - Song Title`).
   - Consequently, LRCLIB and lyrics.ovh receive queries like `artist="netd müzik"`, which return 404 or empty results.

2. **Cause → Solution for Metadata Cleaning**:
   - Adding `GENERIC_RECORD_LABELS` array (`netd müzik`, `poll production`, `pasaj müzik`, `dmc`, etc.) to `sanitizeInputs` will allow automatic extraction of the real artist from the video title whenever a channel name matches a known record label or does not match the title artist prefix.
   - Broadening parenthesis regex to `[\\(\\[][^\\)\\]]*?\\b(official|video|lyric|...)\\b[^\\)\\]]*?[\\)\\]]` will clean complex parentheses like `(Klipsiz / Official Video)` or `(4K Live)`.

3. **Genius Integration Position**:
   - LRCLIB provides time-synced LRC lyrics. Genius provides plain-text lyrics.
   - Placing Genius search + web scraping as **Attempt 3** (after LRCLIB Search and before lyrics.ovh) ensures synced lyrics from LRCLIB are preserved if available, while Genius provides comprehensive plain-text coverage for Turkish and global tracks before falling back to lyrics.ovh.

---

## 3. Caveats

- **Genius Rate Limiting / Scrape Protection**: Scraping Genius HTML relies on standard HTTP GET requests with custom User-Agent headers. Genius rarely blocks normal request rates from server-side Next.js routes, but setting a 5-second timeout ensures requests fail fast if blocked or slow.
- **Synced vs Plain Lyrics**: Genius provides plain-text lyrics (`synced: false`). It does not provide LRC timestamp tags. Karaoke-style auto-scrolling is only active when LRCLIB provides LRC timestamps.

---

## 4. Conclusion

- Upgrading `app/api/lyrics/route.ts` with:
  1. Enhanced metadata cleaning (`GENERIC_RECORD_LABELS` list, flexible parenthesis regex, pipe delimiter stripping).
  2. Genius search + web scraping as the 3rd source between LRCLIB search and lyrics.ovh.
- Will satisfy Requirement R3 and Acceptance Criteria for lyrics coverage (including `Yolla` by Tarkan and `Cambaz` by Mor ve Ötesi).

---

## 5. Verification Method

1. **Metadata Cleaning Verification**:
   - Verify `sanitizeInputs("Mor ve Ötesi - Cambaz [Official Audio]", "netd müzik")` returns `{ artist: "Mor ve Ötesi", title: "Cambaz" }`.
   - Verify `cleanTitle("Bir Kadın Çizeceksin (Klipsiz / Official Video)")` returns `"Bir Kadın Çizeceksin"`.

2. **API Verification**:
   - Query `GET /api/lyrics?title=Yolla&artist=Tarkan` -> Status 200, valid lyrics JSON.
   - Query `GET /api/lyrics?title=Cambaz&artist=Mor+ve+%C3%96tesi` -> Status 200, valid lyrics JSON.

3. **Build & Lint Verification**:
   - `npm run lint` -> 0 errors.
   - `npm run build` -> Exit code 0.
