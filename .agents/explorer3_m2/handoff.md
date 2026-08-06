# Handoff Report — Explorer 3 (Milestone 2: Genius Scraping & Provider Pipeline Error Handling)

## 1. Observation
- Target route file: `d:\Projeler\Selin\selin-player\app\api/lyrics/route.ts` (Lines 1-216).
- `app/api/lyrics/route.ts` currently implements 3 fallback providers:
  1. LRCLIB Direct GET (Lines 137-156) with `AbortSignal.timeout(4000)`.
  2. LRCLIB Search GET (Lines 158-185) with `AbortSignal.timeout(4000)`.
  3. `lyrics.ovh` Fallback GET (Lines 187-201) with `AbortSignal.timeout(4000)`.
- Genius search and page scraping is currently **missing** from `app/api/lyrics/route.ts`.
- Current timeouts per provider are set to 4000ms (4 seconds) instead of the required 5000ms (5 seconds).
- `components/LyricsSheet.tsx` (Lines 13-18, 74-90) fetches `/api/lyrics?title=...&artist=...` and accepts `{ lyrics: string | null, synced: boolean, lines?: LyricLine[], error?: string }`. It renders plain-text lyrics via `<div className="whitespace-pre-wrap">{lyricsData.lyrics}</div>` when `synced: false`.

## 2. Logic Chain
1. **Observation**: `app/api/lyrics/route.ts` does not contain Genius integration, and timeouts are 4000ms.
2. **Step 1**: According to `PROJECT.md` (Feature 3, Milestone 2) and `ORIGINAL_REQUEST.md` (R3), Genius must be inserted as the 3rd provider between LRCLIB Search GET and `lyrics.ovh` GET.
3. **Step 2**: Genius search requires querying `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}` with custom browser headers (`User-Agent`, `Accept`) to bypass 403 Forbidden bot blocks.
4. **Step 3**: Parsing Genius multi-search JSON output requires inspecting `response.sections` for `type === 'song'`, retrieving `hits[0].result.url`, and fetching the target song web page HTML.
5. **Step 4**: Scraping Genius HTML requires locating containers matching `data-lyrics-container="true"`, converting `<br/>` tags to `\n`, stripping HTML tags `<[^>]+>`, decoding HTML entities (`&amp;`, `&#39;`, etc.), stripping Genius annotation markers/junk, and normalizing whitespace (`\n{3,}` -> `\n\n`).
6. **Step 5**: To meet the 5-second timeout requirement per provider attempt, all provider `fetch` calls (including Genius's multi-step search and scrape) must be guarded with `AbortSignal.timeout(5000)` or a shared 5000ms `AbortController`.
7. **Step 6**: Local `try...catch` blocks per provider guarantee that network timeouts, missing song hits, or HTML parse errors log warnings via `console.warn` and fail over smoothly to the next provider, terminating in a 404 response if all 4 providers fail.

## 3. Caveats
- Genius periodically alters their web page DOM class names, but the `data-lyrics-container="true"` HTML attribute has remained consistent across Genius web layout updates.
- Scraped Genius lyrics are unsynced plain text (`synced: false`), so `LyricsSheet.tsx` will display them in static view rather than karaoke mode.

## 4. Conclusion
Genius scraping mechanics and provider pipeline error handling can be seamlessly integrated into `app/api/lyrics/route.ts` as Provider #3 (LRCLIB direct -> LRCLIB search -> Genius -> lyrics.ovh -> 404). Updating all provider timeouts from 4s to 5s and implementing multi-stage HTML entity decoding and tag stripping will significantly improve lyrics coverage for Turkish and international tracks while maintaining strict failure isolation.

## 5. Verification Method
1. **Inspect Code Layout**: Verify `app/api/lyrics/route.ts` includes Genius search and scraping between LRCLIB Search GET and `lyrics.ovh` GET.
2. **Test Route Execution**:
   - `curl "http://localhost:3000/api/lyrics?title=Cambaz&artist=Mor+ve+Ötesi"`
   - `curl "http://localhost:3000/api/lyrics?title=Yolla&artist=Tarkan"`
3. **Build & Lint Verification**:
   Run `npm run lint` and `npm run build` in `d:\Projeler\Selin\selin-player` to ensure zero compilation or lint errors.
