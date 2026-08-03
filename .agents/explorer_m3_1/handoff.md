# Handoff Report: Synced Lyrics API Specification (`app/api/lyrics/route.ts`)

**Agent**: `explorer_m3_1`  
**Milestone**: Milestone 3 (Synced Lyrics API & Viewer)  
**Working Directory**: `d:\Projeler\Selin\selin-player\.agents\explorer_m3_1`  
**Date**: 2026-08-03  

---

## 1. Observation

### Codebase Context & Existing Setup
- **Store & Types**: `lib/types.ts` defines `Song` and `YouTubeSearchResult`. No lyrics interfaces exist yet in `lib/types.ts`.
- **Existing Route Conventions**: `app/api/recommendations/route.ts` (lines 194-295) uses `NextResponse.json`, title/artist sanitization functions (`cleanTitle`, `cleanArtist`, `sanitizeInputs`), `AbortSignal.timeout(4000)`, and handles HTTP 400 for empty queries and 500 for runtime errors.
- **Project Specifications**:
  - `ORIGINAL_REQUEST.md` (lines 36-43): Requires `app/api/lyrics/route.ts` fetching lyrics from `lrclib.net` (time-synced LRC format) with `lyrics.ovh` as plain-text fallback.
  - `PROJECT.md` (lines 55-67): Defines Lyrics API response contract:
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

### Live API Verification & Responses
1. **LRCLIB Direct Lookup Endpoint**:
   - `GET https://lrclib.net/api/get?track_name=Bohemian%20Rhapsody&artist_name=Queen`
   - **Verbatim Response Schema**:
     ```json
     {
       "id": 19079,
       "name": "Bohemian Rhapsody",
       "trackName": "Bohemian Rhapsody",
       "artistName": "Queen",
       "albumName": "Stone Cold Classics",
       "duration": 355.0,
       "instrumental": false,
       "plainLyrics": "Is this the real life? Is this just fantasy?\n...",
       "syncedLyrics": "[00:00.15] Is this the real life? Is this just fantasy?\n[00:07.13] Caught in a landslide, no escape from reality\n..."
     }
     ```
   - Status 404 is returned if exact match is not found.

2. **LRCLIB Search Endpoint**:
   - `GET https://lrclib.net/api/search?q=Queen+Bohemian+Rhapsody`
   - **Verbatim Response Schema**: Array of track objects matching `LrclibRecord[]`. Top match contains `syncedLyrics` and `plainLyrics`.

3. **lyrics.ovh Fallback Endpoint**:
   - `GET https://api.lyrics.ovh/v1/Queen/Bohemian%20Rhapsody`
   - **Verbatim Response Schema**:
     ```json
     {
       "lyrics": "Is this the real life ?\nIs this just fantasy ?\n..."
     }
     ```
   - Returns status 404 `{ "error": "No lyrics found" }` if unavailable.

---

## 2. Logic Chain

### Step 1: Input Query Processing & Sanitization
- **Requirement**: `GET /api/lyrics?title={title}&artist={artist}`
- **Validation**: If both `title` and `artist` are missing or contain only whitespace, immediately respond with HTTP `400 Bad Request`.
- **Sanitization**:
  - Split `"Artist - Title"` format if title contains a dash and `artist` is missing or generic (e.g. `"YouTube"`, `"VEVO"`).
  - Strip YouTube clutter like `(Official Video)`, `[4K Remastered]`, `(Lyric Video)`, `(Live)`.
  - Clean artist names by removing `VEVO` or ` - Topic`.

### Step 2: External API Fetch Waterfall
1. **Primary Attempt (LRCLIB Direct `GET`)**:
   - Query: `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`
   - Timeout: `AbortSignal.timeout(4000)`
   - If HTTP 200 and `syncedLyrics` exists and is non-empty: parse LRC timestamps to `lines` and return `{ lyrics: syncedLyrics, synced: true, lines }`.
   - If HTTP 200 and `plainLyrics` exists (and no `syncedLyrics`): return `{ lyrics: plainLyrics, synced: false }`.

2. **Secondary Attempt (LRCLIB Search `GET`)**:
   - Triggered if primary `GET` returns 404 or fails.
   - Query: `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`.trim())}`
   - Timeout: `AbortSignal.timeout(4000)`
   - Iterate results: Pick first result with non-empty `syncedLyrics` (preferred) or `plainLyrics`.
   - If synced lyrics found, parse to `lines` and return `{ lyrics: syncedLyrics, synced: true, lines }`. If plain lyrics found, return `{ lyrics: plainLyrics, synced: false }`.

3. **Tertiary Attempt (lyrics.ovh Fallback `GET`)**:
   - Triggered if LRCLIB search yields no lyrics and `cleanArtist` & `cleanTitle` are non-empty.
   - Query: `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`
   - Timeout: `AbortSignal.timeout(4000)`
   - If HTTP 200 and `lyrics` property is valid non-empty string: return `{ lyrics: data.lyrics.trim(), synced: false }`.

4. **Empty State Fallback**:
   - If all attempts fail or return 404, return HTTP `404 Not Found` with `{ error: "Şarkı sözü bulunamadı", lyrics: "", synced: false }`.

### Step 3: LRC Timestamp Parser Logic
- **Timestamp Regex**: `/\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g`
  - Minutes ($1): integer $m$
  - Seconds ($2): integer $s$
  - Fractions ($3): 2-digit ($f / 100$) or 3-digit ($f / 1000$)
  - Total time (seconds float): $t = m \times 60 + s + \text{fraction}$ (rounded to 3 decimal places).
- **Metadata Filtering**:
  - Lines or bracket tags matching `/^\[(ar|ti|al|by|offset|length|re|ve):.*\]$/i` or tags without numeric timestamp formats are ignored.
- **Multi-Timestamp Line Handling**:
  - A single line `[00:12.34][01:45.67]Chorus line` has multiple timestamp matches.
  - Strip all time tags to get text `Chorus line`.
  - For each extracted timestamp match in that line, create a line entry `{ time, text }`.
- **Filtering & Sorting**:
  - Filter out entries where `text.trim()` is empty (optional/configurable; filtering whitespace-only lines ensures clean UI display).
  - Sort strictly ascending: `lines.sort((a, b) => a.time - b.time)`.

---

## 3. Caveats

1. **Instrumental Tracks**:
   - LRCLIB includes an `instrumental: true` flag in its schema.
   - For instrumental tracks with no lyrics, LRCLIB returns `syncedLyrics: null` and `plainLyrics: null`. The system will treat this as "no lyrics found" or fallback, which correctly triggers the empty state.
2. **Missing Artist Parameter**:
   - lyrics.ovh requires both `artist` and `title` in its REST path. If `artist` is completely blank and cannot be parsed from `title`, lyrics.ovh cannot be queried. However, LRCLIB search (`/api/search?q={title}`) works cleanly with title alone.
3. **No Auth Requirements**:
   - Neither LRCLIB nor lyrics.ovh require API keys or registration. No `.env` credentials are required for `app/api/lyrics/route.ts`.

---

## 4. Conclusion

### Proposed File Structure
- `app/api/lyrics/route.ts` — Main API route handler.
- Optional type addition to `lib/types.ts`:
  ```ts
  export interface LyricsLine {
    time: number;
    text: string;
  }

  export interface LyricsResponse {
    lyrics: string;
    synced: boolean;
    lines?: LyricsLine[];
    error?: string;
  }
  ```

### Code Implementation Specification (`app/api/lyrics/route.ts`)
```ts
import { NextResponse } from 'next/server';

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResponse {
  lyrics: string;
  synced: boolean;
  lines?: LyricsLine[];
  error?: string;
}

interface LrclibRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

interface LyricsOvhResponse {
  lyrics?: string;
  error?: string;
}

/**
 * Parses LRC formatted string into sorted array of time-stamped lines.
 */
export function parseLrc(lrcText: string): LyricsLine[] {
  if (!lrcText) return [];

  const rawLines = lrcText.split(/\r?\n/);
  const result: LyricsLine[] = [];
  const timeTagRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of rawLines) {
    // Check if line contains timestamp tag
    const matches = Array.from(line.matchAll(timeTagRegex));
    if (matches.length === 0) continue;

    // Extract line text by stripping all timestamp tags
    const text = line.replace(timeTagRegex, '').trim();

    // Skip completely empty lines if desired, or keep non-empty text lines
    if (!text) continue;

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let frac = 0;
      if (match[3]) {
        frac = match[3].length === 3 ? parseInt(match[3], 10) / 1000 : parseInt(match[3], 10) / 100;
      }
      const timeInSeconds = parseFloat((minutes * 60 + seconds + frac).toFixed(3));
      result.push({ time: timeInSeconds, text });
    }
  }

  // Sort strictly ascending by timestamp
  return result.sort((a, b) => a.time - b.time);
}

/**
 * Cleans YouTube video titles and metadata noise.
 */
function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\((official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|vizyon).*?\)/gi, '')
    .replace(/\[(official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video).*?\]/gi, '')
    .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|remastered)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans artist name.
 */
function cleanArtist(artist: string): string {
  if (!artist) return '';
  return artist
    .replace(/VEVO$/i, '')
    .replace(/ - Topic$/i, '')
    .replace(/\bOfficial\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes input query.
 */
function sanitizeInputs(rawTitle: string, rawArtist: string): { title: string; artist: string } {
  let title = rawTitle.trim();
  let artist = rawArtist.trim();

  const isGenericArtist = !artist || artist.toLowerCase() === 'youtube' || artist.toLowerCase().endsWith('vevo') || artist.toLowerCase().endsWith('- topic');
  if (isGenericArtist && (title.includes(' - ') || title.includes(' – ') || title.includes(' — '))) {
    const parts = title.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
    }
  }

  return {
    title: cleanTitle(title),
    artist: cleanArtist(artist),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title') || '';
    const rawArtist = searchParams.get('artist') || '';

    if (!rawTitle.trim() && !rawArtist.trim()) {
      return NextResponse.json(
        { error: 'Başlık veya sanatçı parametresi gereklidir.', lyrics: '', synced: false },
        { status: 400 }
      );
    }

    const { title, artist } = sanitizeInputs(rawTitle, rawArtist);

    // 1. Primary: LRCLIB Direct GET
    if (title && artist) {
      try {
        const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const res = await fetch(getUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data: LrclibRecord = await res.json();
          if (data.syncedLyrics && data.syncedLyrics.trim()) {
            const parsedLines = parseLrc(data.syncedLyrics);
            if (parsedLines.length > 0) {
              return NextResponse.json({ lyrics: data.syncedLyrics, synced: true, lines: parsedLines });
            }
          }
          if (data.plainLyrics && data.plainLyrics.trim()) {
            return NextResponse.json({ lyrics: data.plainLyrics, synced: false });
          }
        }
      } catch (err) {
        console.warn('LRCLIB direct lookup failed:', err);
      }
    }

    // 2. Secondary: LRCLIB Search
    const searchQuery = `${artist} ${title}`.trim();
    if (searchQuery) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const results: LrclibRecord[] = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            // Find first result with synced lyrics
            const syncedMatch = results.find((r) => r.syncedLyrics && r.syncedLyrics.trim());
            if (syncedMatch && syncedMatch.syncedLyrics) {
              const parsedLines = parseLrc(syncedMatch.syncedLyrics);
              if (parsedLines.length > 0) {
                return NextResponse.json({ lyrics: syncedMatch.syncedLyrics, synced: true, lines: parsedLines });
              }
            }
            // Fallback to first result with plain lyrics
            const plainMatch = results.find((r) => r.plainLyrics && r.plainLyrics.trim());
            if (plainMatch && plainMatch.plainLyrics) {
              return NextResponse.json({ lyrics: plainMatch.plainLyrics, synced: false });
            }
          }
        }
      } catch (err) {
        console.warn('LRCLIB search failed:', err);
      }
    }

    // 3. Tertiary: lyrics.ovh Fallback
    if (artist && title) {
      try {
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const res = await fetch(ovhUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data: LyricsOvhResponse = await res.json();
          if (data.lyrics && data.lyrics.trim()) {
            return NextResponse.json({ lyrics: data.lyrics.trim(), synced: false });
          }
        }
      } catch (err) {
        console.warn('lyrics.ovh fallback failed:', err);
      }
    }

    // 4. Empty State
    return NextResponse.json(
      { error: 'Şarkı sözü bulunamadı', lyrics: '', synced: false },
      { status: 404 }
    );
  } catch (error) {
    console.error('Lyrics API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', lyrics: '', synced: false },
      { status: 500 }
    );
  }
}
```

---

## 5. Verification Method

To independently verify `app/api/lyrics/route.ts` implementation once created:

### 1. Test Command (Node / Curl / Fetch in Next.js Server)
Run Next.js dev server or test via curl:

- **Synced Lyrics Case (LRCLIB)**:
  `curl "http://localhost:3000/api/lyrics?title=Bohemian%20Rhapsody&artist=Queen"`
  - **Expected Outcome**: HTTP 200, `synced: true`, `lines` array containing objects with `time: number` (e.g., `0.15`) and `text: string`.

- **Plain Lyrics Case**:
  `curl "http://localhost:3000/api/lyrics?title=SomeObscureTrack&artist=SomeArtist"`
  - **Expected Outcome**: HTTP 200, `synced: false`, `lines: undefined`, non-empty `lyrics: string`.

- **Not Found Case**:
  `curl "http://localhost:3000/api/lyrics?title=NonExistentSong123456&artist=NonExistentArtist123456"`
  - **Expected Outcome**: HTTP 404, `synced: false`, `lyrics: ""`, `error: "Şarkı sözü bulunamadı"`.

- **Missing Query Params Case**:
  `curl "http://localhost:3000/api/lyrics"`
  - **Expected Outcome**: HTTP 400, `synced: false`, `error: "Başlık veya sanatçı parametresi gereklidir."`.

### 2. Unit Testing LRC Parsing Engine
Verify parsing edge cases using standard test inputs:
- Input: `"[01:23.45] First line\n[02:34.567] Second line\n[00:10.00][03:00.00] Repeated line"`
- Expected Output:
  ```json
  [
    { "time": 10, "text": "Repeated line" },
    { "time": 83.45, "text": "First line" },
    { "time": 154.567, "text": "Second line" },
    { "time": 180, "text": "Repeated line" }
  ]
  ```
- Check sorting: Strictly ascending by `time`.

### 3. Build & Lint Verification
- Command: `npm run lint` (Must yield 0 errors)
- Command: `npm run build` (Must yield exit code 0 and compile `/api/lyrics` route)
