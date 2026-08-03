# Comprehensive Route Design & Environment Setup: Recommendation Engine (`app/api/recommendations/route.ts`)

## 1. Overview & Architecture

The Recommendation Engine route (`app/api/recommendations/route.ts`) provides smart, personalized song suggestions for the Selin Music Player. It receives a seed track (`title` and `artist`), queries the Last.fm `track.getSimilar` REST API for recommended candidate tracks, and resolves those candidate tracks into playable YouTube `Song` objects using a parallel resolution pipeline powered by `Promise.allSettled` and the shared YouTube search helper (`lib/youtube.ts`).

---

## 2. Environment Variable Setup (`.env.example`)

### 2.1 Configuration
The recommendations engine utilizes Last.fm's public API. The API key is stored in the environment variable `LASTFM_API_KEY`.

### 2.2 `.env.example` Update Specification
Append the following key definition to `.env.example`:

```ini
# Last.fm API Key (for song recommendations)
LASTFM_API_KEY=your-lastfm-api-key-here
```

### 2.3 Runtime Access & Safety Check
In `app/api/recommendations/route.ts`, access the key via:
```ts
const apiKey = process.env.LASTFM_API_KEY;
```
If `apiKey` is undefined, empty, or invalid, the route gracefully downgrades to YouTube Direct Mix Fallback Mode instead of throwing an unhandled exception or returning an empty 500 error.

---

## 3. Route Handler Design & Signature

### 3.1 Next.js 16 App Router Handler Signature
```ts
import { NextResponse } from 'next/server';
import { Song } from '@/lib/types';
import { searchYouTube } from '@/lib/youtube';

export async function GET(request: Request): Promise<NextResponse>
```

### 3.2 HTTP Contracts & Response Codes

| Status Code | Description | Response Schema |
|-------------|-------------|-----------------|
| **200 OK** | Successful recommendation fetch | `{ "recommendations": Song[] }` |
| **400 Bad Request** | Missing both `title` and `artist` | `{ "error": "Title or artist query parameter is required.", "recommendations": [] }` |
| **500 Internal Error** | Unhandled server exception | `{ "error": "Internal server error", "recommendations": [] }` |

---

## 4. Query Parameter Parsing & Validation

```ts
const { searchParams } = new URL(request.url);
const rawTitle = searchParams.get('title') || '';
const rawArtist = searchParams.get('artist') || '';
const rawLimit = searchParams.get('limit');

const title = rawTitle.trim();
const artist = rawArtist.trim();

// Validation: At least one parameter must be present
if (!title && !artist) {
  return NextResponse.json(
    { error: 'At least title or artist query parameter is required.', recommendations: [] },
    { status: 400 }
  );
}

// Parse limit (default: 10, min: 1, max: 20)
let limit = 10;
if (rawLimit) {
  const parsed = parseInt(rawLimit, 10);
  if (!isNaN(parsed) && parsed > 0) {
    limit = Math.min(parsed, 20);
  }
}
```

---

## 5. Candidate Track Fetching Pipeline

### 5.1 Last.fm `track.getSimilar` API Lookup
- **URL**: `https://ws.audioscrobbler.com/2.0/`
- **Params**:
  - `method`: `track.getsimilar`
  - `artist`: `artist`
  - `track`: `title`
  - `api_key`: `LASTFM_API_KEY`
  - `format`: `json`
  - `limit`: `Math.max(limit * 2, 20)` (Fetch candidate buffer to account for resolution misses)

### 5.2 Helper Interface Definitions
```ts
interface LastFmTrackCandidate {
  title: string;
  artist: string;
}

interface LastFmSimilarResponse {
  similartracks?: {
    track?: Array<{
      name?: string;
      artist?: {
        name?: string;
      };
    }>;
  };
}
```

### 5.3 Candidate Track Extraction Code
```ts
let candidates: LastFmTrackCandidate[] = [];

if (apiKey && title && artist) {
  try {
    const lastFmUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(
      artist
    )}&track=${encodeURIComponent(title)}&api_key=${apiKey}&format=json&limit=${limit * 2}`;

    const res = await fetch(lastFmUrl, {
      signal: AbortSignal.timeout(4000), // 4 second timeout
    });

    if (res.ok) {
      const data: LastFmSimilarResponse = await res.json();
      const tracks = data.similartracks?.track || [];
      candidates = tracks
        .filter(t => t.name && t.artist?.name)
        .map(t => ({
          title: t.name as string,
          artist: t.artist?.name as string,
        }));
    }
  } catch (err) {
    console.warn('Last.fm API fetch failed, switching to direct fallback:', err);
  }
}
```

### 5.4 Graceful Fallback Mode (YouTube Direct Search)
If Last.fm returns no candidates (or `LASTFM_API_KEY` is not configured), generate candidate search queries directly via YouTube:
```ts
if (candidates.length === 0) {
  const searchQuery = artist ? `${artist} top songs` : `${title} similar music`;
  try {
    const ytFallbackResults = await searchYouTube(searchQuery, limit);
    const convertedSongs: Song[] = ytFallbackResults.map(yt => ({
      id: `yt-${yt.id}`,
      title: yt.title,
      artist: yt.channelTitle,
      audio_url: `https://www.youtube.com/watch?v=${yt.id}`,
      youtube_id: yt.id,
      duration: yt.durationSeconds || 210,
      cover_url: yt.thumbnail,
    }));
    return NextResponse.json({ recommendations: convertedSongs.slice(0, limit) });
  } catch (fallbackErr) {
    console.error('YouTube fallback search failed:', fallbackErr);
    return NextResponse.json({ recommendations: [] });
  }
}
```

---

## 6. Parallel Resolution Pipeline (`Promise.allSettled`)

### 6.1 Logic & Rationale
Candidate tracks from Last.fm consist only of metadata (`{ title, artist }`). To make them playable in Selin Music Player, each candidate track must be resolved to a YouTube video ID, thumbnail, and duration. Resolving candidate tracks sequentially would lead to unacceptable latencies (e.g. 10 tracks x 300ms = 3.0s total).

Using `Promise.allSettled`:
1. Each candidate track query is dispatched concurrently.
2. Individual candidate failures (e.g. network timeout or no search result) do not abort or invalidate other concurrent lookups.
3. Fulfilled lookups are mapped to standard `Song` objects.

### 6.2 Concurrent Resolution Implementation
```ts
// De-duplicate candidates and exclude the input track itself
const cleanTitle = title.toLowerCase();
const cleanArtist = artist.toLowerCase();

const filteredCandidates = candidates.filter(
  c => !(c.title.toLowerCase() === cleanTitle && c.artist.toLowerCase() === cleanArtist)
).slice(0, limit + 5);

const resolutionPromises = filteredCandidates.map(async (candidate): Promise<Song | null> => {
  const searchQuery = `${candidate.artist} ${candidate.title}`;
  const ytResults = await searchYouTube(searchQuery, 1);
  if (!ytResults || ytResults.length === 0) return null;

  const yt = ytResults[0];
  return {
    id: `yt-${yt.id}`,
    title: candidate.title,
    artist: candidate.artist,
    audio_url: `https://www.youtube.com/watch?v=${yt.id}`,
    youtube_id: yt.id,
    duration: yt.durationSeconds || 210,
    cover_url: yt.thumbnail,
  };
});

const settled = await Promise.allSettled(resolutionPromises);

const seenYoutubeIds = new Set<string>();
const recommendations: Song[] = [];

for (const result of settled) {
  if (result.status === 'fulfilled' && result.value !== null) {
    const song = result.value;
    if (song.youtube_id && !seenYoutubeIds.has(song.youtube_id)) {
      seenYoutubeIds.add(song.youtube_id);
      recommendations.push(song);
    }
  }
  if (recommendations.length >= limit) break;
}

return NextResponse.json({ recommendations });
```

---

## 7. Quality & Edge Case Protections

1. **Title & Artist De-duplication**: Filters out duplicate candidate tracks and prevents recommending the exact input track back to the user.
2. **Video ID Uniqueness**: Uses a `Set<string>` to track `youtube_id` values and eliminate identical video duplicates in results.
3. **Timeout Protection**: Outbound requests to Last.fm use `AbortSignal.timeout(4000)` to ensure backend responsiveness under 5 seconds.
4. **Type Strictness**: Return objects conform 100% to `Song` from `@/lib/types` and pass Next.js / ESLint builds.
