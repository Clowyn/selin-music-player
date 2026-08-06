## 2026-08-07T00:18:31Z
<USER_REQUEST>
You are worker1_m2 for Milestone 2 (Lyrics API Overhaul with Genius Fallback & Metadata Cleaning - Requirement R3).
Working directory: d:\Projeler\Selin\selin-player\.agents\worker1_m2
Project root: d:\Projeler\Selin\selin-player
Original request: d:\Projeler\Selin\ORIGINAL_REQUEST.md
Project scope: d:\Projeler\Selin\selin-player\PROJECT.md
Explorer analyses:
- d:\Projeler\Selin\selin-player\.agents\explorer1_m2\analysis.md
- d:\Projeler\Selin\selin-player\.agents\explorer2_m2\analysis.md
- d:\Projeler\Selin\selin-player\.agents\explorer3_m2\analysis.md

Target File: `app/api/lyrics/route.ts` (Exclusive Write Ownership)

Task: Implement Requirement R3 in `app/api/lyrics/route.ts`:
1. Enhanced Metadata Cleaning:
   - Update `cleanTitle` regexes to clean parentheses `(...)` or brackets `[...]` containing metadata keywords anywhere inside (`official`, `video`, `lyric`, `hd`, `4k`, `remastered`, `klip`, `klipsiz`, `audio`, `vizyon`, `mv`, `feat`, `ft`, `prod`, `orijinal`, `vevo`, `topic`, `live`).
   - Create `RECORD_LABELS_AND_GENERIC_CHANNELS` array (`netd müzik`, `poll production`, `pasaj müzik`, `dmc`, `kalan müzik`, `avrupa müzik`, `dokuz sekiz müzik`, `sezen aksu`, etc.).
   - Update `sanitizeInputs` to split `Artist - Title` when `rawArtist` is generic or in `RECORD_LABELS_AND_GENERIC_CHANNELS`.
2. Genius Search & HTML Scrape Fallback:
   - Position as Attempt 3 (LRCLIB Direct -> LRCLIB Search -> Genius Search & Scrape -> lyrics.ovh).
   - Search Genius API (`https://genius.com/api/search/multi?q=...`), extract song URL from hit result.
   - Fetch Genius song HTML, parse lyrics container (`data-lyrics-container="true"`), strip HTML tags, convert `<br>` to newlines, decode HTML entities.
   - Set 5s timeout on requests.
3. Verification:
   - Execute `npm run lint` and verify 0 errors.
   - Execute `npm run build` and verify exit code 0.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to `d:\Projeler\Selin\selin-player\.agents\worker1_m2\handoff.md` and send a message back to parent when complete.
</USER_REQUEST>
