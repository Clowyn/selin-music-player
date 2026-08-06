# Detailed Analysis Report: Lyrics API Route & Metadata Cleaning (R3)

**Author:** Explorer Survey 2 (Lyrics Focus)  
**Target File:** `app/api/lyrics/route.ts` & related helpers  
**Date:** 2026-08-06  

---

## 1. Executive Summary

This report presents a complete technical analysis of the lyrics fetching system in Selin Music Player (`app/api/lyrics/route.ts`), evaluating how lyrics are currently fetched from LRCLIB and lyrics.ovh, identifying key flaws in YouTube title/artist metadata sanitization, and designing a robust integration strategy for **Genius search + web scraping** as a 3rd fallback source.

### Key Discoveries:
1. **LRCLIB Fetching**: LRCLIB is used in two steps (Direct GET by title+artist, then Fuzzy Search GET by combined query). It is the only source currently supporting time-synced LRC lyrics parsed by `parseLrc()`.
2. **lyrics.ovh Fallback**: Serves as a tertiary plain-text fallback, but frequently fails for Turkish songs and tracks with dirty YouTube title metadata.
3. **Metadata Cleaning Deficiencies**:
   - YouTube channel names like `netd müzik`, `Poll Production`, `Pasaj Müzik`, etc., are NOT recognized as generic/record label channels, causing `sanitizeInputs` to use the label as the artist name instead of parsing `"Artist - Song"` from the title.
   - Parenthesis/bracket removal regex requires keywords (`official`, `video`, etc.) to appear at the very start of the parenthesis, causing titles like `(Klipsiz / Official Video)` or `(4K Live 2023)` to retain noise.
   - Pipe delimiters (`|`) and colon separators (`:`) common in YouTube titles are ignored.
4. **Genius Integration Feasibility**: Genius search and HTML scraping can be implemented cleanly with **zero additional npm dependencies** using `fetch` with browser User-Agent headers and regex extraction for `data-lyrics-container="true"` elements.

---

## 2. Analysis of Current Lyrics Fetching Pipeline

`app/api/lyrics/route.ts` currently executes a sequential fallback chain across 4 attempts:

```
[Incoming Request GET /api/lyrics?title=X&artist=Y]
                     │
                     ▼
             sanitizeInputs()
                     │
                     ▼
  ┌─────────────────────────────────────┐
  │ 1. LRCLIB Direct GET                │
  │    GET https://lrclib.net/api/get   │
  └──────────────────┬──────────────────┘
                     │ (Failed / Empty / No Synced)
                     ▼
  ┌─────────────────────────────────────┐
  │ 2. LRCLIB Search GET                │
  │    GET https://lrclib.net/api/search│
  └──────────────────┬──────────────────┘
                     │ (Failed / Empty)
                     ▼
  ┌─────────────────────────────────────┐
  │ 3. lyrics.ovh GET                   │
  │    GET https://api.lyrics.ovh/v1/...│
  └──────────────────┬──────────────────┘
                     │ (Failed / Empty)
                     ▼
  ┌─────────────────────────────────────┐
  │ 4. 404 Response ('Şarkı sözü...')  │
  └─────────────────────────────────────┘
```

### Detailed Endpoint Mechanics:

1. **LRCLIB Direct GET**:
   - Endpoint: `https://lrclib.net/api/get?track_name=${title}&artist_name=${artist}`
   - Timeout: `AbortSignal.timeout(4000)`
   - Returns synced LRC if `syncedLyrics` exists and passes `parseLrc()`. Returns plain text if `plainLyrics` exists.

2. **LRCLIB Search GET**:
   - Endpoint: `https://lrclib.net/api/search?q=${artist + ' ' + title}`
   - Timeout: `AbortSignal.timeout(4000)`
   - Scans search result array, prioritizing items with `syncedLyrics`, then fallback items with `plainLyrics`.

3. **lyrics.ovh GET**:
   - Endpoint: `https://api.lyrics.ovh/v1/${artist}/${title}`
   - Timeout: `AbortSignal.timeout(4000)`
   - Plain text lyrics fallback. Highly strict on exact title & artist matching; fails on Turkish characters or dirty metadata.

---

## 3. Genius Search + Web Scraping Integration Strategy

### 3.1 Why Genius?
Genius has the largest database of Turkish and international song lyrics. Neither LRCLIB nor lyrics.ovh has good coverage for niche, indie, or recent Turkish releases. However, official Genius REST API endpoints (`api.genius.com/songs/:id`) return song metadata only and do NOT return lyric text bodies due to legal licensing restrictions.

To overcome this, Genius lyrics must be retrieved via:
1. **Search**: Resolving song title + artist to a Genius song URL (`https://genius.com/Artist-title-lyrics`).
2. **HTML Scraping**: Fetching the Genius song web page and extracting lyric text from modern HTML container elements.

### 3.2 Genius Search Endpoint Selection
Genius provides two search endpoints:
- **Public Internal Search (No API Key Required)**:
  `GET https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`
  - Headers: Desktop `User-Agent`
  - Returns JSON containing `response.sections[].hits[].result.url`
- **Official API Search (Requires GENIUS_ACCESS_TOKEN if configured)**:
  `GET https://api.genius.com/search?q=${encodeURIComponent(query)}`
  - Headers: `Authorization: Bearer ${process.env.GENIUS_ACCESS_TOKEN}`
  - Returns JSON containing `response.hits[].result.url`

**Recommendation**: The route should check if `process.env.GENIUS_ACCESS_TOKEN` exists. If set, use `api.genius.com/search`. Otherwise, use `genius.com/api/search/multi`.

### 3.3 HTML Scraping & Extraction Algorithm
Modern Genius song pages store lyrics inside one or more `<div>` elements marked with `data-lyrics-container="true"`:

```html
<div data-lyrics-container="true" class="Lyrics__Container-sc-...">
  First line of lyrics<br/>
  Second line of lyrics<br/>
</div>
```

#### Zero-Dependency Regex Scraping Logic:
```ts
async function fetchGeniusLyrics(title: string, artist: string): Promise<string | null> {
  const query = `${artist} ${title}`.trim();
  if (!query) return null;

  try {
    // 1. Search Genius for song URL
    let songUrl = '';
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const token = process.env.GENIUS_ACCESS_TOKEN;
    if (token) {
      const apiRes = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
        headers: { ...headers, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const firstHit = data.response?.hits?.[0]?.result;
        if (firstHit?.url) songUrl = firstHit.url;
      }
    }

    if (!songUrl) {
      const publicRes = await fetch(`https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`, {
        headers,
        signal: AbortSignal.timeout(4000),
      });
      if (publicRes.ok) {
        const data = await publicRes.json();
        const sections = data.response?.sections || [];
        for (const sec of sections) {
          if ((sec.type === 'top_hit' || sec.type === 'song') && sec.hits?.length > 0) {
            const hit = sec.hits.find((h: any) => h.type === 'song' || h.result?.url);
            if (hit?.result?.url) {
              songUrl = hit.result.url;
              break;
            }
          }
        }
      }
    }

    if (!songUrl) return null;

    // 2. Scrape Genius Webpage HTML
    const pageRes = await fetch(songUrl, { headers, signal: AbortSignal.timeout(5000) });
    if (!pageRes.ok) return null;

    const html = await pageRes.text();

    // 3. Extract lyrics containers
    // Pre-process <br> and </div> tags into newlines
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n');

    const containerRegex = /data-lyrics-container="true"[^>]*>([\s\S]*?)(?=(?:<div[^>]*data-lyrics-container=|<div[^>]*class="Sidebar|<div[^>]*class="RightSidebar|</body>))/gi;
    const matches = [...text.matchAll(containerRegex)];

    let rawLyrics = '';
    if (matches.length > 0) {
      rawLyrics = matches.map((m) => m[1]).join('\n');
    } else {
      // Fallback for older Genius page structure
      const oldMatch = text.match(/<div[^>]*class="lyrics"[^>]*>([\s\S]*?)<\/div>/i);
      if (oldMatch) rawLyrics = oldMatch[1];
    }

    if (!rawLyrics.trim()) return null;

    // 4. Clean HTML tags and decode entities
    let cleanedLyrics = rawLyrics
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleanedLyrics.length > 20 ? cleanedLyrics : null;
  } catch (err) {
    console.warn('Genius lyrics fallback failed:', err);
    return null;
  }
}
```

---

## 4. Title and Artist Metadata Cleaning Analysis

### 4.1 Deficiencies in Current Implementation
The current `cleanTitle`, `cleanArtist`, and `sanitizeInputs` functions in `app/api/lyrics/route.ts` suffer from four major flaws:

| Problem Area | Current Code | Failure Case Example | Resulting Bug |
|---|---|---|---|
| **Turkish Record Labels** | Only checks `youtube`, `vevo`, `- topic` | `artist: "netd müzik"`, `title: "Mor ve Ötesi - Cambaz [Official Audio]"` | `artist` set to `"netd müzik"`, title set to `"Mor ve Ötesi - Cambaz"`. LRCLIB search fails. |
| **Parentheses Match Position** | `/\((official|lyric|video|...).*?\)/gi` (requires keyword at start of `(`) | `"Bir Kadın Çizeceksin (Klipsiz / Official Video)"` | `(Klipsiz / Official Video)` is NOT stripped because `Klipsiz` comes first. |
| **Pipe / Colon Delimiters** | Only checks `-`, `–`, `—` for splitting | `"Tarkan - Yolla | Official Video"` | `| Official Video` remains attached to song title. |
| **Missing Keywords** | Keywords list misses `visualizer`, `klipsiz`, `stüdyo`, `kamera arkası`, `prod`, `full hd` | `"Ezhel - Geceler (Prod. by Bugy) [Visualizer]"` | `(Prod. by Bugy)` and `[Visualizer]` remain in title. |

### 4.2 Enhanced Metadata Cleaning Architecture

To guarantee high match rates across LRCLIB, Genius, and lyrics.ovh, `sanitizeInputs` should be upgraded with:
1. **Comprehensive Generic Record Labels List**:
   Recognizing Turkish and global record labels (`netd müzik`, `poll production`, `dokuz sekiz müzik`, `pasaj müzik`, `dmc`, `kalan müzik`, `avrupa müzik`, `sony music turkey`, `warner music`, `universal music`, `müzik play`, `vevo`, etc.).
2. **Title-First Artist Extraction**:
   When a YouTube title contains `"<Artist> - <Song>"`, and the channel title is a known record label (or does not match `<Artist>`), automatically override `artist = <Artist>` and `title = <Song>`.
3. **Flexible Parentheses & Brackets Filter**:
   Match any parenthesis or bracket block containing noise keywords anywhere inside it.
4. **Pipe / Colon Delimiter Trimming**:
   Strip pipe extensions like `| Official Video` or `| netd müzik`.

#### Enhanced Implementation Specification:
```ts
const GENERIC_RECORD_LABELS = [
  'netd müzik', 'netd musik', 'poll production', 'dokuz sekiz müzik',
  'dokuzsekizmüzik', 'pasaj müzik', 'pasajmüzik', 'dmc', 'doğan music company',
  'kalan müzik', 'avrupa müzik', 'sony music', 'sony music turkey',
  'warner music', 'universal music', 'müzik play', 'muzik play',
  'müzik', 'muzik', 'vevo', 'youtube', 'official', 'records', 'music'
];

export function cleanTitle(title: string): string {
  if (!title) return '';

  let cleaned = title;

  // 1. Strip pipe metadata segments e.g. "Song Title | Official Video"
  cleaned = cleaned.replace(/\|.*$/g, (match) => {
    if (/(official|video|audio|netd|music|hd|4k|lyric|live)/i.test(match)) {
      return '';
    }
    return match;
  });

  // 2. Remove parentheses/brackets containing noise keywords anywhere inside them
  const noiseKeywords = [
    'official', 'lyric', 'lyrics', 'live', 'audio', 'video', 'hd', '4k', '8k',
    'remastered', 'remix', 'clip', 'music video', 'vizyon', 'mv', 'feat', 'feat\\.',
    'ft', 'ft\\.', 'prod', 'prod\\.', 'klipsiz', 'kamera arkası', 'visualizer',
    'stüdyo', 'studio', 'version', 'versiyon', 'full', 'hq', 'soundtrack', 'ost',
    'performance', 'performans', 'kayıt', 'kayit'
  ];
  const noiseRegex = new RegExp(`[\\(\\[][^\\)\\]]*?\\b(${noiseKeywords.join('|')})\\b[^\\)\\]]*?[\\)\\]]`, 'gi');
  cleaned = cleaned.replace(noiseRegex, '');

  // 3. Remove standalone noise phrases & normalize spaces
  cleaned = cleaned
    .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|8k|remastered|feat\.|ft\.|prod\. by|prod\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

export function cleanArtist(artist: string): string {
  if (!artist) return '';
  return artist
    .replace(/VEVO$/i, '')
    .replace(/ - Topic$/i, '')
    .replace(/\bOfficial\b/gi, '')
    .replace(/\bTopic\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeInputs(rawTitle: string, rawArtist: string): { title: string; artist: string } {
  let title = rawTitle.trim();
  let artist = rawArtist.trim();

  const lowerArtist = artist.toLowerCase();
  const isGeneric =
    !artist ||
    lowerArtist === 'youtube' ||
    lowerArtist.endsWith('vevo') ||
    lowerArtist.endsWith('- topic') ||
    GENERIC_RECORD_LABELS.some((label) => lowerArtist.includes(label));

  // Extract artist from title if title is formatted as "Artist - Title"
  const separatorMatch = title.match(/\s*[-–—:]\s*/);
  if (separatorMatch) {
    const parts = title.split(/\s*[-–—:]\s*/);
    if (parts.length >= 2) {
      const possibleArtist = parts[0].trim();
      const possibleTitle = parts.slice(1).join(' - ').trim();

      if (isGeneric || !artist || possibleArtist.toLowerCase() !== lowerArtist) {
        artist = possibleArtist;
        title = possibleTitle;
      }
    }
  }

  return {
    title: cleanTitle(title),
    artist: cleanArtist(artist),
  };
}
```

---

## 5. Complete Proposed Fallback Chain in `app/api/lyrics/route.ts`

The updated route will feature a 4-tier fallback system:

1. **Attempt 1: LRCLIB Direct GET** (`lrclib.net/api/get`)
   - Returns synced LRC (with parsed timestamps) or plain lyrics.
2. **Attempt 2: LRCLIB Search GET** (`lrclib.net/api/search`)
   - Returns synced LRC or plain lyrics from fuzzy search results.
3. **Attempt 3: Genius Search + Web Scraping** (`genius.com`)
   - Resolves Genius song URL and scrapes HTML `data-lyrics-container="true"`.
   - Returns plain lyrics (`synced: false`).
4. **Attempt 4: lyrics.ovh Fallback GET** (`api.lyrics.ovh/v1`)
   - Plain lyrics fallback (`synced: false`).
5. **Attempt 5: 404 Empty State**

---

## 6. Verification Plan

| Test Case | Expected Input | Expected Output | Verification Method |
|---|---|---|---|
| **Yolla (Tarkan)** | `title=Yolla&artist=Tarkan` | Status 200, non-empty `lyrics`, `synced: true` or `synced: false` | `GET /api/lyrics?title=Yolla&artist=Tarkan` |
| **Cambaz (Mor ve Ötesi)** | `title=Cambaz&artist=Mor+ve+%C3%96tesi` | Status 200, non-empty lyrics | `GET /api/lyrics?title=Cambaz&artist=Mor+ve+%C3%96tesi` |
| **YouTube Channel Titles** | `title=Mor+ve+%C3%96tesi+-+Cambaz+[Official+Audio]&artist=netd+m%C3%BCzik` | Sanitizes artist to `Mor ve Ötesi` and title to `Cambaz` | Unit test / API invocation |
| **Complex Parentheses** | `title=Bir+Kad%C4%B1n+%C3%87izeceksin+(Klipsiz+/+Official+Video)&artist=maNga` | Sanitizes title to `Bir Kadın Çizeceksin` | Unit test / API invocation |
| **Build & Lint** | Project build | 0 lint errors, clean next build | `npm run lint` && `npm run build` |

