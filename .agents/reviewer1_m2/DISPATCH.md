## 2026-08-06T21:20:58Z
Task: Code review and requirement verification for Milestone 2 (R3: Lyrics API Genius Fallback & YouTube Metadata Cleaning).
Verify:
1. Enhanced Metadata Cleaning: `cleanTitle` regex removes arbitrary parentheses/brackets with metadata keywords (`official`, `video`, `lyric`, `hd`, `4k`, `klipsiz`, `audio`, etc.). `sanitizeInputs` extracts artist/title from YouTube titles when channel is generic or in `RECORD_LABELS_AND_GENERIC_CHANNELS`.
2. Genius Search & HTML Scrape Fallback: Positioned as Attempt 3 (LRCLIB Direct -> LRCLIB Search -> Genius Search & Scrape -> lyrics.ovh). Correct multi-search API call, HTML container extraction (`data-lyrics-container="true"`), line break formatting, HTML entity decoding, and 5s request timeout.
3. Build Verification: Run `npm run lint` (0 errors) and `npm run build` (exit code 0).
Write your handoff report to `d:\Projeler\Selin\selin-player\.agents\reviewer1_m2\handoff.md` with explicit APPROVE or REQUEST_CHANGES verdict, and send a message back to parent.
