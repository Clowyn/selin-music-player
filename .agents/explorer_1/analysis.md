# Selin Music Player — Data Layer & API Architecture Technical Analysis

## Executive Summary
This document provides a comprehensive technical analysis of the data layer, state management, search API, and recommendation engine design for the **Selin Music Player** Next.js application.

The application leverages a **Zustand** global store (`store/playerStore.ts`), TypeScript interfaces (`lib/types.ts`), a dual-mode YouTube search endpoint (`app/api/search/route.ts`), and a dual audio playback engine (`components/AudioEngine.tsx`) supporting both direct MP3 streaming and YouTube iFrame playback.

---

## 1. Data Model Analysis (`lib/types.ts`)

The core domain model is defined in `lib/types.ts`. It establishes data contracts across client state, API endpoints, and Supabase database interactions.

### 1.1 Interface Definitions

#### `Song`
```typescript
export interface Song {
  id: string;
  playlist_id?: string;
  title: string;
  artist: string;
  audio_url: string;
  youtube_id?: string;
  duration: number; // Duration in seconds
  track_order?: number;
  created_at?: string;
  cover_url?: string;
}
```
- **`id`**: Unique string identifier. Standard Supabase songs use UUIDs; YouTube search results construct synthetic IDs in the format `yt-${youtube_id}`.
- **`playlist_id`**: Optional database reference linking a song to a playlist.
- **`title` & `artist`**: Track metadata.
- **`audio_url`**: Audio source URL. For direct MP3 tracks, this is the storage/CDN URL. For YouTube tracks, it is formatted as `https://www.youtube.com/watch?v=${youtube_id}`.
- **`youtube_id`**: Optional 11-character YouTube video ID. When present, `AudioEngine.tsx` delegates audio playback to the hidden YouTube iFrame API player (`window.ytPlayer`).
- **`duration`**: Playback duration in integer seconds.
- **`cover_url`**: Image URL for artwork. For YouTube tracks, this stores the video thumbnail URL.

#### `Playlist`
```typescript
export interface Playlist {
  id: string;
  name: string;
  mood_description: string | null;
  cover_url: string | null;
  created_at: string;
}
```
- Defines playlist metadata stored in Supabase table `playlists`.
- Relationships: Has many `Song` items via `playlist_id`.

#### `YouTubeSearchResult`
```typescript
export interface YouTubeSearchResult {
  id: string; // 11-char YouTube Video ID
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string; // Formatted duration e.g. "3:45"
  durationSeconds: number; // Numeric seconds e.g. 225
}
```
- Returned by `/api/search`.
- Converted into a full `Song` object in components via:
  ```typescript
  const convertToSong = (yt: YouTubeSearchResult): Song => ({
    id: `yt-${yt.id}`,
    title: yt.title,
    artist: yt.channelTitle,
    audio_url: `https://www.youtube.com/watch?v=${yt.id}`,
    youtube_id: yt.id,
    duration: yt.durationSeconds || 210,
    cover_url: yt.thumbnail,
  });
  ```

#### Auxiliary Types
- **`BackgroundMedia`**: Stores background imagery/video metadata for slideshows.
- **`CharacterSprite`**: Stores active floating sprite data.
- **`RepeatMode`**: Union type `'off' | 'single' | 'all'` controlling loop behavior.

---

## 2. State Management Analysis (`store/playerStore.ts`)

The application state is managed by a single Zustand store created in `store/playerStore.ts`.

### 2.1 State Structure
| Property | Type | Description |
| --- | --- | --- |
| `currentSong` | `Song \| null` | Currently active track playing or paused. |
| `currentPlaylist` | `Playlist \| null` | Currently selected playlist context. |
| `songs` | `Song[]` | Array of songs in active playback list context. |
| `isPlaying` | `boolean` | Playback status flag. |
| `volume` | `number` | Master audio volume (0.0 to 1.0). |
| `currentTime` | `number` | Current playback position in seconds (updated ~500ms). |
| `duration` | `number` | Total duration of current track in seconds. |
| `isShuffle` | `boolean` | Shuffle mode state. |
| `repeatMode` | `RepeatMode` | Repeat state (`'off'`, `'all'`, `'single'`). |
| `queue` | `Song[]` | Active playback queue. |
| `favorites` | `Song[]` | Array of user favorited tracks. |
| `searchDrawerOpen`| `boolean` | UI state flag for opening/closing the search drawer. |

### 2.2 Core Action Mechanics

#### Song Selection & Playback
- `setCurrentSong(song)`: Sets `currentSong`, resets `currentTime: 0`, and sets `isPlaying: true`.
- `play()` / `pause()` / `togglePlay()`: Updates `isPlaying` boolean state.
- `setSongs(songs)`: Sets active track list `songs` and synchronizes `queue`.

#### Queue & Favorites Management
- `addToQueue(song)`: Appends `song` to `queue`. If `song.id` is not present in `songs`, it also appends it to `songs` so navigation (`nextSong`) works seamlessly.
- `removeFromQueue(id)`: Filters out specified song ID from `queue`.
- `toggleFavorite(song)`: Performs an optimistic state update on `favorites` array, followed by asynchronous Supabase persistence (`upsert` or `delete` on `favorites` table).
- `fetchFavorites()`: Fetches saved favorites from Supabase and populates `favorites`.

#### Navigation & Loop Logic (`nextSong` & `prevSong`)
- **`nextSong()`**:
  1. Checks `repeatMode === 'single'`: If single repeat, resets audio/video seek position to 0 (`window.ytPlayer.seekTo(0)` or `HTMLAudioElement.currentTime = 0`) and resumes playback without changing `currentSong`.
  2. Checks `isShuffle`: If true, selects a random index from `songs` array (`Math.floor(Math.random() * songs.length)`).
  3. Sequential progression: Finds `currentIndex` of `currentSong` in `songs`.
     - If at last song (`currentIndex === songs.length - 1`):
       - If `repeatMode === 'all'`, loops back to `songs[0]`.
       - Otherwise (`repeatMode === 'off'`), stops playback (`isPlaying: false`, `currentTime: 0`).
     - Otherwise, advances to `songs[currentIndex + 1]`.

- **`prevSong()`**:
  1. If current playback `currentTime > 3` seconds, restarts current song (`seekTo(0)`).
  2. If `currentTime <= 3` seconds, moves to `songs[currentIndex - 1]` if `currentIndex > 0`. If at index 0, restarts current song.

---

## 3. Search API Route Analysis (`app/api/search/route.ts`)

The YouTube search API route at `app/api/search/route.ts` features a highly resilient, dual-strategy architecture.

```
                  ┌──────────────────────────────┐
                  │ GET /api/search?q={query}    │
                  └──────────────┬───────────────┘
                                 │
                   Is YOUTUBE_API_KEY set?
                     │                      │
                   (Yes)                  (No)
                     │                      │
                     ▼                      ▼
           YouTube Data API v3      YouTube Scraper
          (search + details)       (ytInitialData JSON)
                     │                      │
                  (Failed)               (Failed)
                     │                      │
                     └──────────┬───────────┘
                                ▼
                         HTML Regex Scan
```

### 3.1 Request Handling & Execution Pipeline
1. Extracts `q` search query parameter from URL (`request.url`). Returns `{ results: [] }` for empty queries.
2. **Strategy 1: Official YouTube Data API v3** (Active when `process.env.YOUTUBE_API_KEY` is present):
   - Endpoint: `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${query}&key=${apiKey}`
   - Batch Video Details: Collects video IDs and calls `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}` to retrieve exact ISO 8601 durations (`PT#M#S`).
   - ISO 8601 Duration Parser: `parseISO8601Duration` converts `PT3M45S` to `{ duration: "3:45", durationSeconds: 225 }`.
3. **Strategy 2: Server-side YouTube HTML Scraper** (Fallback when API key is missing or fails):
   - Endpoint: `https://www.youtube.com/results?search_query=${query}` with browser User-Agent header.
   - AST Extractor: Parses `var ytInitialData = {...}` embedded JSON object from raw HTML.
   - Recursive Renderer Finder: `findVideoRenderers()` traverses JSON structure to find all `videoRenderer` nodes.
   - Data Extraction: Extracts videoId, title, channel name (`ownerText`), thumbnail URL, and length string (`lengthText`).
   - Duration Converter: `durationToSeconds("3:45")` calculates numeric seconds (`225`).
4. **Strategy 3: HTML Regex Fallback**:
   - Executes regex scan `/"videoId":"([a-zA-Z0-9_-]{11})".*?"title":{"runs":\[{"text":"(.*?)"}\].*?"ownerText":{"runs":\[{"text":"(.*?)"}\]/g` on HTML text if JSON parsing fails to extract items.
5. **Output**: Returns JSON `{ results: YouTubeSearchResult[] }`. HTML entities (`&quot;`, `&#39;`, `&amp;`) are decoded via `decodeHTMLEntities`.

---

## 4. Requirements & Precise Design for Recommendations API (`app/api/recommendations/route.ts`)

### 4.1 Feature Requirements Summary
- Endpoint: `GET /api/recommendations?title={title}&artist={artist}`
- Must query Last.fm `track.getSimilar` API using `process.env.LASTFM_API_KEY`.
- Must resolve returned similar track titles/artists to playable YouTube videos (video ID, thumbnail, duration) using YouTube search logic.
- Must return an array of valid `Song` objects (`id`, `title`, `artist`, `audio_url`, `youtube_id`, `duration`, `cover_url`) compatible with `usePlayerStore`.
- Must feature robust fallbacks (e.g. Last.fm track not found, missing API key, network errors).

### 4.2 Last.fm API Specification (`track.getSimilar`)
- **Request URL**:
  `http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1&limit=15`
- **Response Payload**:
  ```json
  {
    "similartracks": {
      "track": [
        {
          "name": "Similar Song Title",
          "match": 0.95,
          "artist": { "name": "Artist Name" },
          "image": [
            { "#text": "https://...", "size": "medium" }
          ]
        }
      ]
    }
  }
  ```

### 4.3 Resolution & Fallback Engine Design

```
             ┌──────────────────────────────────────────┐
             │ GET /api/recommendations?title=X&artist=Y│
             └────────────────────┬─────────────────────┘
                                  │
                    Is LASTFM_API_KEY available?
                      │                     │
                    (Yes)                 (No)
                      │                     │
                      ▼                     ▼
          Last.fm track.getSimilar    YouTube Related Mix Search
                      │                     │
                (Tracks Found?)             │
                  │        │                │
                (Yes)     (No)              │
                  │        │                │
                  │        ▼                │
                  │    Last.fm Top Tracks   │
                  │   (artist.getTopTracks) │
                  │        │                │
                  └────┬───┴────────────────┘
                       ▼
          Parallel YouTube Resolution
          (Promise.allSettled for top N)
                       ▼
          Construct Song[] & Deduplicate
                       ▼
          Return { recommendations: Song[] }
```

### 4.4 Detailed Step-by-Step Logic

1. **Parameter Parsing & Validation**:
   - Extract `title` and `artist` from query params.
   - If both are missing, return 400 Bad Request `{ error: 'Missing title or artist', recommendations: [] }`.

2. **Last.fm Similar Tracks Fetching**:
   - Call `track.getSimilar` with `title` and `artist`.
   - If Last.fm returns empty or track not found error (Error code 6), fall back to `artist.getTopTracks` (`method=artist.gettoptracks&artist=${artist}`).

3. **Fallback to YouTube Search Mix (No Key / Last.fm Error)**:
   - If `process.env.LASTFM_API_KEY` is not set or Last.fm fails, search YouTube directly for:
     `"${title} ${artist} mix"` or `"${artist} benzeri şarkılar"`.
   - Extract search results and convert them to `Song` objects.

4. **Parallel YouTube Video Resolution**:
   - Take the top 8-10 candidate tracks from Last.fm.
   - For each candidate `{ name, artist: { name: artistName } }`, construct a search query string: `${name} ${artistName}`.
   - Resolve candidate tracks using a shared YouTube search helper function (`searchYouTube(query: string)`).
   - Execute searches in parallel via `Promise.allSettled()` to ensure latency stays under 1.5 seconds.

5. **Song Object Construction & Filtering**:
   - Convert each resolved YouTube item to a `Song` object:
     ```typescript
     const song: Song = {
       id: `yt-${ytResult.id}`,
       title: candidateTrackName || ytResult.title,
       artist: candidateArtistName || ytResult.channelTitle,
       audio_url: `https://www.youtube.com/watch?v=${ytResult.id}`,
       youtube_id: ytResult.id,
       duration: ytResult.durationSeconds || 210,
       cover_url: ytResult.thumbnail,
     };
     ```
   - Deduplicate results by `youtube_id` and filter out any song matching the current playing song `youtube_id` or exact title.

6. **Response Format**:
   ```json
   {
     "recommendations": [
       {
         "id": "yt-dQw4w9WgXcQ",
         "title": "Song Title",
         "artist": "Artist Name",
         "audio_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
         "youtube_id": "dQw4w9WgXcQ",
         "duration": 215,
         "cover_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
       }
     ]
   }
   ```

---

## 5. UI Integration Strategy (3 Placements)

As specified in `ORIGINAL_REQUEST.md`, recommended songs will be surfaced in three UI areas:

1. **"Keşfet" (Discover) Tab in `PlaylistDrawer.tsx`**:
   - Add a third tab button alongside "Çalma Listeleri" and "💖 Favorilerim".
   - When active, triggers `fetch('/api/recommendations?title=' + currentSong.title + '&artist=' + currentSong.artist)`.
   - Renders 10-15 recommended songs with Play (`setCurrentSong`), Queue (`addToQueue`), and Favorite (`toggleFavorite`) action buttons.

2. **Search Drawer Default State in `SearchDrawer.tsx`**:
   - When search input `query` is empty, replace the static empty state with "🎵 Sana Özel Öneriler" section displaying 5-8 recommendations based on `currentSong`.

3. **"Up Next" Row in `app/page.tsx`**:
   - Insert a horizontal scrollable row of compact card items between `NowPlaying` and `CustomSeekbar` / `PlayerControls`.
   - Shows 3-5 quick recommendations with one-tap play and queue controls.

---

## 6. Recommended Architecture Refactoring

To avoid code duplication between `app/api/search/route.ts` and `app/api/recommendations/route.ts`, extract the YouTube search logic into a shared module:
- Create `lib/youtube.ts` exporting `searchYouTube(query: string): Promise<YouTubeSearchResult[]>`.
- Refactor `app/api/search/route.ts` to use `searchYouTube(q)`.
- Use `searchYouTube` directly inside `app/api/recommendations/route.ts`.
