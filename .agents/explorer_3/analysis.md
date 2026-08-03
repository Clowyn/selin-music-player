# Technical Analysis: Infrastructure, External APIs, Lyrics Route Specifications, and Build Verification

## Executive Summary
This document provides technical analysis and specifications for project infrastructure, external APIs (Last.fm, LRCLIB, lyrics.ovh), lyrics API route (`app/api/lyrics/route.ts`), and build/lint verification for the Selin Music Player PWA.

---

## 1. Project Infrastructure & Configuration Analysis

### 1.1 Core Stack & Dependencies (`package.json`)
- **Framework & Runtime**: Next.js `16.2.12` (App Router), React `19.2.4`, React-DOM `19.2.4`.
- **Language & Type Checking**: TypeScript `^5` (`tsconfig.json`), `@types/node` `^20`, `@types/react` `^19`.
- **Styling**: Tailwind CSS `^4` with `@tailwindcss/postcss` `^4`.
- **State Management**: Zustand `^5.0.14` (`store/playerStore.ts`).
- **Animation & Visual Effects**: Framer Motion `^12.43.0`, `canvas-confetti` `^1.9.4`.
- **Icons & Media**: `lucide-react` `^1.27.0`, `react-youtube` `^10.1.0`, `youtube-sr` `^4.3.12`.
- **Database & Backend**: `@supabase/supabase-js` `^2.111.0`.

### 1.2 Scripts & Tooling
- `npm run dev`: Executes `next dev`.
- `npm run build`: Executes `next build`. Compiles App Router pages and API routes.
- `npm run start`: Executes `next start`.
- `npm run lint`: Executes `eslint` with Next.js flat configuration (`eslint.config.mjs` using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`).

### 1.3 TypeScript Configuration (`tsconfig.json`)
- Target: `ES2017`, `moduleResolution: "bundler"`, `strict: true`.
- Path aliases: `@/*` mapped to `./*`.
- Strict mode is enforced; all new routes, helper functions, and components must provide explicit TypeScript interface definitions.

### 1.4 Environment Variables (`.env.example` & `.env.local`)
- Existing env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `ADMIN_PASSWORD`
  - `YOUTUBE_API_KEY` (Optional YouTube Data API v3 fallback in `app/api/search/route.ts`)
- **Required additions for new features**:
  - `LASTFM_API_KEY`: Required for Last.fm `track.getSimilar` API requests. Must be documented in `.env.example`.
  - Server-side access only (`process.env.LASTFM_API_KEY`) within `app/api/recommendations/route.ts`.

---

## 2. External APIs Investigation

### 2.1 Last.fm API (`track.getSimilar`)
- **Endpoint**: `https://ws.audioscrobbler.com/2.0/`
- **Method**: `GET`
- **Query Parameters**:
  - `method`: `track.getsimilar`
  - `artist`: Artist name (URL-encoded)
  - `track`: Track title (URL-encoded)
  - `api_key`: `process.env.LASTFM_API_KEY`
  - `format`: `json` (*Mandatory*; defaults to XML if omitted)
  - `limit`: `15`
  - `autocorrect`: `1` (Recommended to handle misspellings)
- **JSON Response Format**:
  ```json
  {
    "similartracks": {
      "track": [
        {
          "name": "Yellow",
          "match": "1.0",
          "url": "https://www.last.fm/music/Coldplay/_/Yellow",
          "artist": {
            "name": "Coldplay",
            "mbid": "cc1970b8-2e50-4d21-9f13-16f3706ea737"
          },
          "image": [
            { "#text": "https://...", "size": "small" },
            { "#text": "https://...", "size": "medium" },
            { "#text": "https://...", "size": "large" }
          ]
        }
      ]
    }
  }
  ```
- **Error Handling & Fallbacks**:
  - Invalid/Missing API key: Returns `{ "error": 10, "message": "Invalid API Key" }` or HTTP 403.
  - Track not found: Returns `{ "error": 6, "message": "Track not found" }` or empty array `similartracks.track: []`.
  - Fallback logic: If Last.fm call fails or key is missing, `app/api/recommendations/route.ts` must return an empty list or fallback popular track query gracefully without crashing (HTTP 200 `{ recommendations: [] }`).

### 2.2 LRCLIB API (`lrclib.net`)
- **Endpoints**:
  - Primary (Exact lookup): `GET https://lrclib.net/api/get?track_name={title}&artist_name={artist}`
  - Secondary (Fuzzy search): `GET https://lrclib.net/api/search?q={artist}+{title}`
- **Headers Requirement**:
  - Must include custom `User-Agent` header (e.g. `User-Agent: SelinMusicPlayer/1.0 (https://github.com/selin-player)`). Requests without proper User-Agent are subject to rate limiting or HTTP 403 blocks.
- **JSON Response Format**:
  ```json
  {
    "id": 2392,
    "trackName": "Yellow",
    "artistName": "Coldplay",
    "albumName": "Parachutes",
    "duration": 266,
    "instrumental": false,
    "plainLyrics": "Look at the stars\nLook how they shine for you\n...",
    "syncedLyrics": "[00:27.42] Look at the stars\n[00:30.85] Look how they shine for you\n[00:34.90] And everything you do\n[00:38.25] Yeah, they were all yellow\n..."
  }
  ```

### 2.3 Lyrics.ovh API (Fallback)
- **Endpoint**: `GET https://api.lyrics.ovh/v1/{artist}/{title}`
- **Response Format**:
  - Success (HTTP 200): `{ "lyrics": "Look at the stars\nLook how they shine for you..." }`
  - Error (HTTP 404): `{ "error": "No lyrics found" }`
- **Characteristics**: Provides plain text unsynced lyrics only. Service can experience latency spikes; fetch calls must specify a 3-second timeout (`AbortSignal.timeout(3000)`).

---

## 3. Specifications for Lyrics API (`app/api/lyrics/route.ts`)

### 3.1 Endpoint & Data Contracts

#### Route Signature
- `GET /api/lyrics?title={title}&artist={artist}`

#### TypeScript Response Types
```typescript
export interface LyricsLine {
  time: number; // Timestamp in seconds (float), e.g. 27.42
  text: string; // Transcribed lyric text line
}

export interface LyricsApiResponse {
  lyrics: string | null;
  synced: boolean;
  lines?: LyricsLine[];
  error?: string;
}
```

### 3.2 Metadata Sanitization Rules
YouTube titles often include clutter (e.g. `"Coldplay - Yellow (Official Video) [HD]"`). Before calling lyrics APIs, query strings must be cleaned:
```typescript
function cleanQueryParam(param: string): string {
  if (!param) return '';
  return param
    .replace(/\(official\s*(music)?\s*video\)/gi, '')
    .replace(/\[official\s*(music)?\s*video\]/gi, '')
    .replace(/\(lyric\s*video\)/gi, '')
    .replace(/\[lyric\s*video\]/gi, '')
    .replace(/\(audio\)/gi, '')
    .replace(/\[hd\]/gi, '')
    .replace(/\[4k\]/gi, '')
    .replace(/- topic$/gi, '')
    .trim();
}
```

### 3.3 LRC Parser Algorithm & Specifications
- **LRC Line Format**: `[mm:ss.xx]` or `[mm:ss.xxx]` followed by text. Multi-timestamp tags on one line (`[00:10.00][01:20.00] Chorus`) must produce separate entries for each timestamp.
- **Regex Pattern**: `/(?:\[(\d{2,3}):(\d{2})(?:\.(\d{2,3}))?\])+([^\r\n]*)/g`
- **Time Conversion Logic**:
  $$\text{timeInSeconds} = (\text{minutes} \times 60) + \text{seconds} + \frac{\text{milliseconds}}{10^{\text{length}}}$$
  - Example: `[01:27.42]` -> $1 \times 60 + 27 + 0.42 = 87.42$ seconds.
- **Sorting & Cleaning**: Filter out header metadata (`[ar:...]`, `[ti:...]`, etc.) and sort the output array by `time` ascending.

### 3.4 Fallback Execution Flow in `app/api/lyrics/route.ts`

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Extract & sanitize `title` and `artist` from URL params  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Fetch LRCLIB: GET https://lrclib.net/api/get?...         │
│    (User-Agent: SelinMusicPlayer/1.0)                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
       [syncedLyrics present?]       [Not found / 404]
                │                             │
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ Parse LRC lines -> return   │ │ 3. Fetch LRCLIB search:     │
│ { lyrics, synced: true,     │ │    GET /api/search?q=...     │
│   lines: parsedLines }      │ └──────────────┬──────────────┘
└─────────────────────────────┘                │
                                ┌──────────────┴──────────────┐
                                │                             │
                       [Result with lyrics?]         [No hit]
                                │                             │
                                ▼                             ▼
                ┌─────────────────────────────┐ ┌─────────────────────────────┐
                │ Return LRCLIB search result │ │ 4. Fetch lyrics.ovh:        │
                │ (Synced or plain text)      │ │    GET /v1/{artist}/{title} │
                └─────────────────────────────┘ └──────────────┬──────────────┘
                                                               │
                                                ┌──────────────┴──────────────┐
                                                │                             │
                                         [lyrics present?]                [Error/404]
                                                │                             │
                                                ▼                             ▼
                                ┌─────────────────────────────┐ ┌─────────────────────────────┐
                                │ Return plain text result    │ │ Return empty result:        │
                                │ { lyrics, synced: false }   │ │ { lyrics: null,             │
                                └─────────────────────────────┘ │   synced: false,            │
                                                                │   error: "Lyrics not found" │
                                                                │ }                           │
                                                                └─────────────────────────────┘
```

---

## 4. Build and Lint Verification (R4 Requirements)

### 4.1 Requirement Rules
- **Rule R4.1**: `npm run lint` must finish with 0 errors.
- **Rule R4.2**: `npm run build` must complete with exit code 0.

### 4.2 Integration Verification Checklist
1. All client components utilizing Zustand store (`currentTime`, `isPlaying`, `currentSong`) must specify `'use client';` directive.
2. New API route files (`app/api/lyrics/route.ts` and `app/api/recommendations/route.ts`) must export `export async function GET(request: Request)` and return `NextResponse.json(...)`.
3. All interfaces (`Song`, `YouTubeSearchResult`, `LyricsLine`, `LyricsApiResponse`) must align across `lib/types.ts`, store, API routes, and components.
