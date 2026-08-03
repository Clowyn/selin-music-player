# Last.fm `track.getSimilar` Recommendation Engine Design & Analysis

## Executive Summary
This document specifies the complete technical design for the song recommendation API endpoint at `app/api/recommendations/route.ts` in Selin Music Player. The recommendation engine integrates Last.fm's `track.getSimilar` web service with a fallback pipeline (Last.fm `artist.getTopTracks` and YouTube direct query fallback) and resolves recommended metadata into playable YouTube audio streams via the shared YouTube helper (`lib/youtube.ts`).

---

## 1. Last.fm `track.getSimilar` API Endpoint Specification

### 1.1 Endpoint Overview
- **Base URL**: `https://ws.audioscrobbler.com/2.0/`
- **HTTP Method**: `GET`
- **Transport**: Standard HTTP/HTTPS via `fetch` API.
- **Rate Limits & Auth**: No OAuth required for read-only public endpoints. Requires a standard Last.fm API Key passed as `api_key` query parameter.

### 1.2 Query Parameters
| Parameter | Type | Required | Description | Example |
|---|---|---|---|---|
| `method` | string | Yes | Must be exact string `track.getsimilar` | `track.getsimilar` |
| `artist` | string | Yes* | Artist name (*required unless `mbid` is provided) | `Radiohead` |
| `track` | string | Yes* | Track title (*required unless `mbid` is provided) | `Karma Police` |
| `autocorrect` | number/string | No | `1` to enable automatic spelling correction & redirect | `1` |
| `limit` | number/string | No | Max items to return (default 100 on Last.fm, recommend 15) | `15` |
| `api_key` | string | Yes | Last.fm API Key from `process.env.LASTFM_API_KEY` | `0123456789abcdef...` |
| `format` | string | Yes | Response format, must be `json` | `json` |

### 1.3 Full Request Example
```http
GET /2.0/?method=track.getsimilar&artist=Sezen%20Aksu&track=Firuze&limit=15&autocorrect=1&api_key=YOUR_LASTFM_API_KEY&format=json HTTP/1.1
Host: ws.audioscrobbler.com
Accept: application/json
```

### 1.4 Response JSON Schemas

#### A. Standard Success Response Schema (`200 OK`)
```json
{
  "similartracks": {
    "track": [
      {
        "name": "Geri Dön",
        "playcount": 521400,
        "mbid": "a5d8b72e-...",
        "match": 1.0,
        "url": "https://www.last.fm/music/Sezen+Aksu/_/Geri+D%C3%B6n",
        "streamable": {
          "#text": "0",
          "fulltrack": "0"
        },
        "artist": {
          "name": "Sezen Aksu",
          "mbid": "b1024...",
          "url": "https://www.last.fm/music/Sezen+Aksu"
        },
        "image": [
          { "#text": "https://lastfm.freetls.fastly.net/i/u/34s/...", "size": "small" },
          { "#text": "https://lastfm.freetls.fastly.net/i/u/64s/...", "size": "medium" },
          { "#text": "https://lastfm.freetls.fastly.net/i/u/174s/...", "size": "large" },
          { "#text": "https://lastfm.freetls.fastly.net/i/u/300x300/...", "size": "extralarge" }
        ]
      }
    ],
    "@attr": {
      "artist": "Sezen Aksu",
      "track": "Firuze"
    }
  }
}
```

#### B. Last.fm API Error Response Schema (`200 OK` or `40x HTTP`)
*Note: Last.fm often returns HTTP status 200 with an `error` key in the JSON body for domain errors.*
```json
{
  "error": 6,
  "message": "The track you supplied could not be found",
  "links": []
}
```
**Common Last.fm Error Codes:**
- `error: 6`: Track / Artist not found.
- `error: 10`: Invalid API Key.
- `error: 26`: Suspended API Key.
- `error: 16`: Service temporarily unavailable.

#### C. JSON Structural Edge Cases to Handle
1. **Single Result Array Collapsing**: When only 1 track is returned, Last.fm JSON serialization may output `similartracks.track` as an Object `{ name: "...", artist: {...} }` rather than an Array `[...]`. The parser MUST wrap non-array objects in an array:
   ```typescript
   const rawTracks = data?.similartracks?.track;
   const tracksArray = Array.isArray(rawTracks) 
     ? rawTracks 
     : (rawTracks ? [rawTracks] : []);
   ```
2. **Missing `similartracks` or Empty `track`**: If `data.similartracks` is missing or `track` is undefined/null, treat as empty result set (`[]`).

---

## 2. Parameter Sanitization & Noise Reduction

YouTube video titles often contain metadata noise (e.g. `"Radiohead - Karma Police (Official Music Video) [4K Remastered]"`). Passing raw YouTube video titles directly to Last.fm results in `error: 6` (Track not found).

### 2.1 Sanitization Pipeline Rules

1. **Splitting Combined Title String**:
   If `title` contains a separator (` - `, ` – `, ` — `) and `artist` parameter is empty or generic (e.g., `"YouTube"` or ending in `"VEVO"` / `"- Topic"`):
   - Extract `artist` from left side of separator.
   - Extract `title` from right side of separator.

2. **Regex Metadata Noise Cleaner (`cleanSearchTerm`)**:
   Remove common video tag patterns from both `title` and `artist`:
   ```typescript
   function cleanTitle(title: string): string {
     if (!title) return '';
     return title
       // Remove text inside parenthetical tags (Official Video, Live, Remix, etc.)
       .replace(/\((official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|vizyon).*?\)/gi, '')
       // Remove text inside bracketed tags [Official Video, etc.]
       .replace(/\[(official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video).*?\]/gi, '')
       // Remove un-bracketed tail keywords
       .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|remastered)\b/gi, '')
       // Clean double spaces and trim
       .replace(/\s+/g, ' ')
       .trim();
   }

   function cleanArtist(artist: string): string {
     if (!artist) return '';
     return artist
       .replace(/VEVO$/i, '')
       .replace(/ - Topic$/i, '')
       .replace(/\bOfficial\b/gi, '')
       .replace(/\s+/g, ' ')
       .trim();
   }
   ```

3. **Validation Thresholds**:
   - Query string length: Min 2 characters.
   - If both `title` and `artist` are empty after sanitization, trigger Tier 3 YouTube fallback.

---

## 3. Robust Multi-Tier Fallback Architecture

To ensure high availability and prevent empty recommendations in all scenarios, the recommendations route implements a 3-tier fallback pipeline.

```
+-------------------------------------------------------------------+
|                        Client Request                             |
|          GET /api/recommendations?title=...&artist=...            |
+-------------------------------------------------------------------+
                                  |
                                  v
                    +---------------------------+
                    | Parameter Sanitization    |
                    +---------------------------+
                                  |
                                  v
                +-----------------------------------+
                | Is LASTFM_API_KEY set in process? |
                +-----------------------------------+
                       /                     \
                   YES                        NO
                   /                            \
                  v                              v
    +---------------------------+    +-----------------------+
    | Tier 1: Last.fm           |    | Tier 3: YouTube       |
    | track.getSimilar          |    | Related Search        |
    +---------------------------+    +-----------------------+
        /                   \                    |
  Results Found          0 Results / Error       |
      /                       \                  |
     v                         v                 v
+------------------+    +------------------+     |
| YouTube Stream   |    | Tier 2: Last.fm  |     |
| Resolution       |    | artist.getTop    |     |
+------------------+    +------------------+     |
         |                  /          \         |
         |            Results        0 Results   |
         |              /                  \     |
         |             v                    v    |
         +---------------------------------------+
                                  |
                                  v
                    +---------------------------+
                    | Return Song[] JSON        |
                    +---------------------------+
```

### 3.1 Tier 1: Primary Last.fm `track.getSimilar`
- **Fetch Attempt**: Call `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${artist}&track=${title}&limit=15&autocorrect=1&api_key=${apiKey}&format=json` with a 5000ms `AbortSignal` timeout.
- **Success Criteria**: Returns HTTP 200, no `error` field in JSON, and non-empty `similartracks.track` array.
- **Proceed to**: YouTube Stream Resolution.

### 3.2 Tier 2: Secondary Last.fm `artist.getTopTracks`
- **Trigger**: Executed if Tier 1 yields 0 results, returns Last.fm error 6 (Track not found), OR if `title` is missing but `artist` is available.
- **Endpoint Call**: `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${artist}&limit=15&autocorrect=1&api_key=${apiKey}&format=json`
- **Filtering**: Exclude any track whose name matches the input `title` (case-insensitive).
- **Success Criteria**: Returns non-empty `toptracks.track` array.

### 3.3 Tier 3: YouTube Query Fallback (No Key / Last.fm Failure)
- **Trigger**: Executed if `LASTFM_API_KEY` is not defined in environment, network error/timeout occurs, or both Tier 1 and Tier 2 yield 0 recommendations.
- **Search Queries Attempted in Order**:
  1. `"${artist} ${title} mix"` or `"${artist} ${title} benzer şarkılar"` (if both artist & title present)
  2. `"${artist} en çok dinlenen şarkıları"` or `"${artist} top songs"` (if artist present)
  3. `"${title} mix"` (if only title present)
  4. `"Türkçe Pop En Çok Dinlenenler 2026"` / `"Popular Music Mix"` (if no valid parameters)
- **Execution**: Pass constructed query to `searchYouTube(query, 10)` in `lib/youtube.ts`.

---

## 4. YouTube Audio Stream Resolution Strategy

Last.fm returns metadata (`name`, `artist.name`), but does NOT provide playable media URLs or YouTube video IDs. Each recommended track must be resolved to a YouTube video ID.

### 4.1 Resolution Algorithm
1. Take top $N$ tracks (e.g. 10 to 15) from Last.fm results.
2. For each track `{ name: trackTitle, artist: { name: artistName } }`:
   - Construct YouTube search query: `"${artistName} - ${trackTitle}"`.
   - Call YouTube search helper `searchYouTube(query, 1)` (which uses YouTube Data API v3 if `YOUTUBE_API_KEY` is present, or the server-side HTML scraper fallback).
3. Concurrency Control: Limit concurrent search requests using `Promise.all` over the sliced array of candidates.
4. Filter out any failed lookups.
5. Format each valid result to match the required `Recommendations API Contract`.

---

## 5. API Route Contract Compliance

### 5.1 Route Definition
- **File Location**: `app/api/recommendations/route.ts`
- **HTTP Method**: `GET`
- **URL Parameters**:
  - `title` (string, optional/recommended)
  - `artist` (string, optional/recommended)
  - `limit` (number, optional, default: 10, max: 20)

### 5.2 JSON Response Schema (as contracted in `PROJECT.md`)

#### Success Response (`HTTP 200 OK`)
```json
{
  "recommendations": [
    {
      "id": "yt-dQw4w9WgXcQ",
      "title": "Karma Police",
      "artist": "Radiohead",
      "audio_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "youtube_id": "dQw4w9WgXcQ",
      "duration": 264,
      "cover_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    }
  ]
}
```

#### Error Response (`HTTP 500 / 400`)
```json
{
  "recommendations": [],
  "error": "Failed to fetch recommendations"
}
```

---

## 6. Implementation Reference Pseudocode

```typescript
import { NextResponse } from 'next/server';
import { searchYouTube } from '@/lib/youtube';
import { Song } from '@/lib/types';

interface LastFmTrack {
  name: string;
  artist: { name: string } | string;
  image?: { '#text': string; size: string }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get('title') || '';
  const rawArtist = searchParams.get('artist') || '';
  const limitParam = parseInt(searchParams.get('limit') || '10', 10);
  const limit = Math.min(Math.max(limitParam, 1), 20);

  const { title, artist } = sanitizeInputs(rawTitle, rawArtist);
  const apiKey = process.env.LASTFM_API_KEY;

  let candidates: Array<{ title: string; artist: string }> = [];

  if (apiKey && (title || artist)) {
    // Attempt Tier 1: Last.fm track.getSimilar
    if (title && artist) {
      candidates = await fetchLastFmSimilar(title, artist, limit, apiKey);
    }
    
    // Attempt Tier 2: Last.fm artist.getTopTracks if Tier 1 produced no results
    if (candidates.length === 0 && artist) {
      candidates = await fetchLastFmTopTracks(artist, title, limit, apiKey);
    }
  }

  // Attempt Tier 3: YouTube query fallback if no Last.fm candidates found
  if (candidates.length === 0) {
    const fallbackSongs = await fetchYouTubeFallback(title, artist, limit);
    return NextResponse.json({ recommendations: fallbackSongs });
  }

  // Resolve candidates to YouTube video streams
  const resolvedSongs = await resolveCandidatesToYouTube(candidates, limit);
  return NextResponse.json({ recommendations: resolvedSongs });
}
```

---

## 7. Next Steps for Implementer (M1)
1. Extract YouTube search logic from `app/api/search/route.ts` into a clean, reusable utility module `lib/youtube.ts`.
2. Implement `app/api/recommendations/route.ts` using the multi-tier fallback architecture detailed in this specification.
3. Update `.env.example` with `LASTFM_API_KEY=` documentation.
