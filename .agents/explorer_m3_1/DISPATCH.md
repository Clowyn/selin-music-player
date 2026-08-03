## 2026-08-03T18:26:21Z
<USER_REQUEST>
You are explorer_m3_1 for Milestone 3 (Synced Lyrics API & Viewer).
Your working directory is d:\Projeler\Selin\selin-player\.agents\explorer_m3_1. Please create this directory if it doesn't exist yet, and put all your metadata/handoff files there.

Objective: Technical investigation and specification for `app/api/lyrics/route.ts`.
Read the following authoritative project files first:
- `d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md`
- `d:\Projeler\Selin\selin-player\.agents\PROJECT.md`

Investigate:
1. Requirements for `GET /api/lyrics?title={title}&artist={artist}`.
2. Direct API specifications for external sources:
   - Primary: LRCLIB (lrclib.net). Investigate `/api/get?track_name={title}&artist_name={artist}` and `/api/search?q={artist}+{title}`. Check response schemas (`syncedLyrics`, `plainLyrics`).
   - Fallback: lyrics.ovh (`https://api.lyrics.ovh/v1/{artist}/{title}`).
3. LRC Parser logic:
   - Parsing LRC timestamps `[mm:ss.xx]` or `[mm:ss.xxx]` (e.g. `[01:23.45]`) into total seconds (float, e.g. 83.45).
   - Extracting text for each line, handling multi-timestamp lines if any, filtering out metadata tags like `[ar:...]`, `[ti:...]`.
   - Sorting lines strictly ascending by `time`.
4. Response interface contract:
   `{ lyrics: string, synced: boolean, lines?: Array<{ time: number, text: string }> }`
5. Edge cases & error handling (network timeout, 404 not found, empty query, malformed LRC format, missing env/auth requirements if any).

Do NOT modify any code. Perform read-only exploration and code/API analysis.
Write your complete findings and architectural design report to `d:\Projeler\Selin\selin-player\.agents\explorer_m3_1\handoff.md` and report back via send_message.
</USER_REQUEST>
