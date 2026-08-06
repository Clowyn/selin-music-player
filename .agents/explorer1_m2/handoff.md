# Handoff Report: Milestone 2 — Lyrics API Overhaul & Metadata Cleaning (Requirement R3)

## 1. Observation
- **Target File**: `app/api/lyrics/route.ts` (Lines 1–216).
- **Current Cascade**:
  1. LRCLIB Direct GET (`https://lrclib.net/api/get?...`)
  2. LRCLIB Search GET (`https://lrclib.net/api/search?...`)
  3. lyrics.ovh Fallback (`https://api.lyrics.ovh/v1/...`)
- **Metadata Sanitization Deficiencies**:
  - `cleanTitle` regexes (lines 71–79) fail when metadata keywords appear inside complex parentheses (e.g. `(Official Video 4K)` or `(Klipsiz HD)`).
  - `cleanArtist` & `sanitizeInputs` (lines 84–119) only recognize generic artist strings `"youtube"`, `"vevo"`, and `"- topic"`. Common Turkish music label channels (`netd müzik`, `Poll Production`, `Pasaj Müzik`, `DMC`, `Kalan Müzik`, `Avrupa Müzik`, `Dokuz Sekiz Müzik`, etc.) are left uncleaned, causing searches with wrong artist parameters.
- **Genius Integration Scope**:
  - Requires public endpoint `https://genius.com/api/search/multi?q=...` with standard `User-Agent`.
  - Genius song page HTML contains lyrics inside `<div data-lyrics-container="true"...>`.
  - Position must be Attempt 3 (LRCLIB Direct -> LRCLIB Search -> Genius Search & Scrape -> lyrics.ovh).

## 2. Logic Chain
1. **Metadata Cleaning Enhancements**:
   - `cleanTitle` regex upgraded to match any parentheses `(...)` or brackets `[...]` containing metadata keywords anywhere inside (`official`, `video`, `lyric`, `hd`, `4k`, `remastered`, `klip`, `klipsiz`, `audio`, `vizyon`, `mv`, `feat`, `ft`, `prod`, `orijinal`).
   - `RECORD_LABELS_AND_GENERIC_CHANNELS` registry created to identify channel names like `netd müzik` or `Poll Production`.
   - `sanitizeInputs` splits `rawTitle` ("Artist - Song") whenever `rawArtist` is in `RECORD_LABELS_AND_GENERIC_CHANNELS` or generic.
2. **Genius Fallback Integration**:
   - `fetchGeniusLyrics(title, artist)` performs API search at `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`.
   - Obtains `songUrl` from `sections[].hits[].result.url`.
   - Fetches HTML and uses `extractGeniusContainers` (tag-depth balancing parser) to extract inner contents of `<div data-lyrics-container="true"...>`.
   - `cleanGeniusHtml` strips tags, converts `<br>` to `\n`, decodes HTML entities, and formats clean plain text lyrics.
3. **Cascade Order Compliance**:
   - Primary: LRCLIB Direct (`synced` -> `plain`)
   - Secondary: LRCLIB Search (`synced` -> `plain`)
   - Tertiary: Genius Search & Scrape (`plain`)
   - Quaternary: lyrics.ovh (`plain`)
   - Fallback: 404 JSON error response

## 3. Caveats
- Genius.com HTML structure could change in the future; the implementation includes a fallback parser for legacy `<div class="lyrics">` containers and gracefully falls back to Attempt 4 (`lyrics.ovh`) if Genius scraping returns empty text.
- External API calls rely on timeouts (`AbortSignal.timeout(5000)`) to prevent blocking the Next.js API route response.

## 4. Conclusion
Replacing `app/api/lyrics/route.ts` with the proposed specification in `analysis.md` will satisfy all acceptance criteria for Requirement R3:
- Significantly improved lyrics coverage for Turkish and international tracks.
- Correct handling of YouTube video title formats (e.g., `Tarkan - Yolla (Official Video)` with artist `netd müzik`).
- Placement of Genius Search & Scrape as Attempt 3 between LRCLIB and lyrics.ovh.
- 0 extra npm package dependencies required.

## 5. Verification Method
1. **Implementation**:
   - Apply the code changes detailed in `analysis.md` to `app/api/lyrics/route.ts`.
2. **Automated Build & Lint Check**:
   - Run `npm run lint` — expect 0 errors.
   - Run `npm run build` — expect successful compilation (exit code 0).
3. **Endpoint Verification**:
   - Test GET `/api/lyrics?title=Yolla&artist=Tarkan` -> Verify returns `{ lyrics: "...", synced: ... }`.
   - Test GET `/api/lyrics?title=Cambaz&artist=Mor+ve+%C3%96tesi` -> Verify returns `{ lyrics: "...", synced: ... }`.
   - Test GET `/api/lyrics?title=Tarkan%20-%20Yolla%20(Official%20Video)&artist=netd%20m%C3%BCzik` -> Verify title & artist sanitization extracts `title="Yolla"` and `artist="Tarkan"`.
