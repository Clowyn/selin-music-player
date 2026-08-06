# Milestone 2 — Lyrics API Overhaul & Metadata Cleaning Analysis

## Executive Summary
This document presents the detailed architectural investigation and implementation plan for **Milestone 2 (Requirement R3)** of the Selin Music Player project. The goal is to maximize lyrics coverage for both Turkish and international tracks by introducing Genius multi-search and web scraping as Attempt 3 in the lyrics retrieval fallback cascade, alongside enhanced YouTube title and artist metadata sanitization.

---

## 1. Existing State Analysis (`app/api/lyrics/route.ts`)

Currently, `app/api/lyrics/route.ts` executes a 3-stage fallback flow:
1. **LRCLIB Direct Lookup** (`GET https://lrclib.net/api/get?track_name=...&artist_name=...`): Returns synced or plain lyrics.
2. **LRCLIB Search Lookup** (`GET https://lrclib.net/api/search?q=...`): Searches LRCLIB and returns first synced or plain match.
3. **lyrics.ovh Fallback** (`GET https://api.lyrics.ovh/v1/{artist}/{title}`): Often fails for Turkish tracks or missing titles.

### Identified Limitations in Current Implementation:
1. **No Genius Fallback**: Turkish indie and pop music (e.g. Tarkan, Mor ve Ötesi, Ezhel, Duman, Yüzyüzeyken Konuşuruz) are often absent on LRCLIB and lyrics.ovh but available on Genius.
2. **Naive Parenthesis/Bracket Cleaning**:
   - Current regex `/\((official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|vizyon|mv|feat|ft).*?\)/gi` only matches parentheses that **start** with one of the listed keywords.
   - Parentheses like `(Official Video 4K)`, `(2021 HD Klipsiz)`, or `(Official Music Video)` are either partially matched or completely missed.
3. **Missing Record Label Identification**:
   - When songs are imported from YouTube, `rawArtist` is frequently the YouTube channel name (e.g., `netd müzik`, `Poll Production`, `Pasaj Müzik`, `DMC`, `Kalan Müzik`, `Avrupa Müzik`, `Dokuz Sekiz Müzik`, `Seyhan Müzik`, `Spinnin' Records`, `Sony Music Türkiye`, `Vevo`, `YouTube`).
   - Current `sanitizeInputs` only checks for `youtube`, `vevo`, and `- topic`. As a result, `rawArtist = "netd müzik"` is kept as artist, leading to failed API queries like `artist="netd müzik", title="Yolla"`.

---

## 2. Solution Architecture

### 2.1 YouTube Metadata & Title/Artist Sanitization (`cleanTitle`, `cleanArtist`, `sanitizeInputs`)

#### Record Label & Generic Channel Registry
Define a comprehensive registry `RECORD_LABELS_AND_GENERIC_CHANNELS`:
```typescript
const RECORD_LABELS_AND_GENERIC_CHANNELS = [
  'netd müzik', 'netd musik', 'netd',
  'poll production', 'pasaj müzik', 'pasaj müzik tv', 'pasaj',
  'dmc', 'doğan müzik', 'doğan müzik yapım',
  'kalan müzik', 'kalan', 'avrupa müzik', 'avrupa',
  'dokuz sekiz müzik', 'dokuz sekiz', 'seyhan müzik',
  'spinnin\' records', 'sony music', 'sony music türkiye', 'sony music turkiye',
  'universal music', 'universal music turkey', 'warner music',
  'gözde müzik', 'emre müzik', 'eflatun müzik', 'mü-yap', 'muyap',
  'vevo', 'youtube', 'topic', '- topic', 'official'
];
```

#### Enhanced Title & Parenthesis Cleaning
Update `cleanTitle` regex to remove parenthesis `(...)` or bracket `[...]` blocks if they contain **any** noise/metadata keywords (e.g. `official`, `video`, `lyric`, `hd`, `4k`, `remastered`, `klip`, `klipsiz`, `audio`, `vizyon`, `mv`, `feat`, `ft`, `prod`, `orijinal`):
```typescript
export function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\([^)]*?\b(official|video|lyric|lyrics|live|audio|hd|4k|remastered|remix|clip|klip|klipsiz|vizyon|mv|feat|ft|prod|music video|topic|version|versiyon|soundtrack|ost|orijinal)\b[^)]*?\)/gi, '')
    .replace(/\[[^\]]*?\b(official|video|lyric|lyrics|live|audio|hd|4k|remastered|remix|clip|klip|klipsiz|vizyon|mv|feat|ft|prod|music video|topic|version|versiyon|soundtrack|ost|orijinal)\b[^\]]*?\]/gi, '')
    .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|remastered|klipsiz|resmi video|feat\.|ft\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

#### Generic Artist & "Artist - Title" Splitting Logic
Enhance `sanitizeInputs(rawTitle, rawArtist)`:
1. Determine if `rawArtist` is generic or matches a record label.
2. If `rawArtist` is generic/label and `rawTitle` contains a dash (` - `, ` – `, ` — `), split into `artist = parts[0]` and `title = parts.slice(1).join(' - ')`.
3. If `cleanedArtist` is already known and `cleanedTitle` starts with `${cleanedArtist} - `, trim the duplicate artist prefix from `cleanedTitle`.

---

### 2.2 Genius Search & HTML Web Scraping (Attempt 3)

#### API Search Strategy
- Target Endpoint: `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`
- Query format: `${artist} ${title}` or `${title}`.
- Request Headers: Set browser `User-Agent` header to prevent request rejection.
- Extract top song result URL from `response.sections[].hits[].result.url`.

#### Zero-Dependency HTML Parser (`extractGeniusContainers` & `cleanGeniusHtml`)
Since modern Genius pages store lyrics inside `<div data-lyrics-container="true"...>`, we implement a tag-depth balancing parser:
1. Scan for `<div[^>]*data-lyrics-container="true"[^>]*>`.
2. Balance inner `<div` and `</div>` tags to extract the exact container inner HTML without premature truncation.
3. Replace `<br/>` and `<br>` with line breaks (`\n`).
4. Strip residual HTML tags (`/<[^>]+>/g`).
5. Decode HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#x27;`, `&#39;`, `&nbsp;`).
6. Fall back to `<div class="lyrics">` for legacy Genius page structures.

---

### 2.3 Order of Fallback Cascade
The updated endpoint flow in `GET /api/lyrics/route.ts`:
1. **LRCLIB Direct Lookup** (`GET https://lrclib.net/api/get?...`) -> Return synced or plain lyrics.
2. **LRCLIB Search Lookup** (`GET https://lrclib.net/api/search?...`) -> Return synced or plain lyrics.
3. **Genius Search & Web Scrape Fallback** (`GET https://genius.com/api/search/multi?...` + fetch song page) -> Return plain lyrics.
4. **lyrics.ovh Fallback** (`GET https://api.lyrics.ovh/v1/...`) -> Return plain lyrics.
5. **404 Response**: `{ error: 'Şarkı sözü bulunamadı', lyrics: '', synced: false }`.

---

## 3. Detailed Proposed Code Changes

The complete updated file implementation for `app/api/lyrics/route.ts` is specified below:

```typescript
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
 * Record labels and generic channels common in music streaming / YouTube titles.
 */
const RECORD_LABELS_AND_GENERIC_CHANNELS = [
  'netd müzik',
  'netd musik',
  'netd',
  'poll production',
  'pasaj müzik',
  'pasaj müzik tv',
  'pasaj',
  'dmc',
  'doğan müzik',
  'doğan müzik yapım',
  'kalan müzik',
  'kalan',
  'avrupa müzik',
  'avrupa',
  'dokuz sekiz müzik',
  'dokuz sekiz',
  'seyhan müzik',
  'spinnin\' records',
  'sony music',
  'sony music türkiye',
  'sony music turkiye',
  'universal music',
  'universal music turkey',
  'warner music',
  'gözde müzik',
  'emre müzik',
  'eflatun müzik',
  'mü-yap',
  'muyap',
  'vevo',
  'youtube',
  'topic',
  '- topic',
  'official',
];

/**
 * Parses LRC formatted string into a sorted array of time-stamped lines.
 */
export function parseLrc(lrcText: string): LyricsLine[] {
  if (!lrcText) return [];

  const rawLines = lrcText.split(/\r?\n/);
  const result: LyricsLine[] = [];
  const timeTagRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignore metadata header lines like [ar:Artist], [ti:Title], [al:Album], etc.
    if (/^\[(ar|ti|al|by|offset|length|re|ve):.*\]$/i.test(trimmed)) {
      continue;
    }

    const matches = Array.from(trimmed.matchAll(timeTagRegex));
    if (matches.length === 0) continue;

    // Extract line text by stripping all timestamp tags
    const text = trimmed.replace(timeTagRegex, '').trim();
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

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Cleans YouTube video titles and extra metadata noise.
 */
export function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    // Remove parenthesis containing metadata keywords anywhere inside
    .replace(/\([^)]*?\b(official|video|lyric|lyrics|live|audio|hd|4k|remastered|remix|clip|klip|klipsiz|vizyon|mv|feat|ft|prod|music video|topic|version|versiyon|soundtrack|ost|orijinal)\b[^)]*?\)/gi, '')
    // Remove brackets containing metadata keywords anywhere inside
    .replace(/\[[^\]]*?\b(official|video|lyric|lyrics|live|audio|hd|4k|remastered|remix|clip|klip|klipsiz|vizyon|mv|feat|ft|prod|music video|topic|version|versiyon|soundtrack|ost|orijinal)\b[^\]]*?\]/gi, '')
    // Remove standalone metadata phrases
    .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|remastered|klipsiz|resmi video|feat\.|ft\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans artist name.
 */
export function cleanArtist(artist: string): string {
  if (!artist) return '';
  const cleaned = artist
    .replace(/VEVO$/i, '')
    .replace(/ - Topic$/i, '')
    .replace(/\bOfficial\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = cleaned.toLowerCase();
  if (RECORD_LABELS_AND_GENERIC_CHANNELS.some((label) => lower === label || lower.endsWith(` ${label}`))) {
    return '';
  }

  return cleaned;
}

/**
 * Sanitizes title and artist inputs, extracting artist from title if title is formatted as "Artist - Title".
 */
export function sanitizeInputs(rawTitle: string, rawArtist: string): { title: string; artist: string } {
  let title = rawTitle.trim();
  let artist = rawArtist.trim();

  const cleanedArtistCheck = cleanArtist(artist);
  const isGenericArtist =
    !cleanedArtistCheck ||
    RECORD_LABELS_AND_GENERIC_CHANNELS.some((label) => {
      const lower = artist.toLowerCase();
      return lower === label || lower.includes(label) || lower.endsWith(label);
    });

  if (isGenericArtist && (title.includes(' - ') || title.includes(' – ') || title.includes(' — '))) {
    const parts = title.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
    }
  }

  let cleanedArt = cleanArtist(artist);
  let cleanedTit = cleanTitle(title);

  if (cleanedArt && cleanedTit.toLowerCase().startsWith(`${cleanedArt.toLowerCase()} - `)) {
    cleanedTit = cleanedTit.substring(cleanedArt.length + 3).trim();
  }

  return {
    title: cleanedTit,
    artist: cleanedArt,
  };
}

/**
 * Extracts inner HTML content from Genius data-lyrics-container="true" elements using tag depth balancing.
 */
function extractGeniusContainers(html: string): string[] {
  const containers: string[] = [];
  const openTagRegex = /<div[^>]*data-lyrics-container="true"[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    const startContentPos = match.index + match[0].length;
    let depth = 1;

    const tagRegex = /<\/?div\b[^>]*>/gi;
    tagRegex.lastIndex = startContentPos;

    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
      if (tagMatch[0].toLowerCase().startsWith('</div')) {
        depth--;
      } else {
        depth++;
      }
      if (depth === 0) {
        const containerHtml = html.substring(startContentPos, tagMatch.index);
        containers.push(containerHtml);
        openTagRegex.lastIndex = tagMatch.index + tagMatch[0].length;
        break;
      }
    }
  }

  return containers;
}

/**
 * Cleans extracted Genius HTML into formatted plain lyrics text.
 */
function cleanGeniusHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Scrapes lyrics from Genius.com page.
 */
async function fetchGeniusLyrics(title: string, artist: string): Promise<string | null> {
  const geniusQuery = artist ? `${artist} ${title}` : title;
  const searchUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(geniusQuery)}`;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const searchRes = await fetch(searchUrl, {
    headers,
    signal: AbortSignal.timeout(5000),
  });

  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  let songUrl: string | null = null;

  const sections = searchData?.response?.sections || [];
  for (const section of sections) {
    if (Array.isArray(section.hits)) {
      for (const hit of section.hits) {
        if ((hit.type === 'song' || hit.index === 'song') && hit.result?.url) {
          songUrl = hit.result.url;
          break;
        }
      }
    }
    if (songUrl) break;
  }

  if (!songUrl) return null;

  const pageRes = await fetch(songUrl, {
    headers,
    signal: AbortSignal.timeout(5000),
  });

  if (!pageRes.ok) return null;

  const html = await pageRes.text();
  const containers = extractGeniusContainers(html);
  let scrapedLyrics = containers.map(cleanGeniusHtml).filter(Boolean).join('\n\n').trim();

  if (!scrapedLyrics) {
    const legacyMatch = html.match(/<div[^>]*class="lyrics"[^>]*>([\s\S]*?)<\/div>/i);
    if (legacyMatch && legacyMatch[1]) {
      scrapedLyrics = cleanGeniusHtml(legacyMatch[1]);
    }
  }

  return scrapedLyrics || null;
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

    // 1. Primary Attempt: LRCLIB Direct GET
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

    // 2. Secondary Attempt: LRCLIB Search GET
    const searchQuery = `${artist} ${title}`.trim();
    if (searchQuery) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const results: LrclibRecord[] = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            const syncedMatch = results.find((r) => r.syncedLyrics && r.syncedLyrics.trim());
            if (syncedMatch && syncedMatch.syncedLyrics) {
              const parsedLines = parseLrc(syncedMatch.syncedLyrics);
              if (parsedLines.length > 0) {
                return NextResponse.json({ lyrics: syncedMatch.syncedLyrics, synced: true, lines: parsedLines });
              }
            }
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

    // 3. Tertiary Attempt: Genius Search & Web Scrape Fallback
    if (title) {
      try {
        const geniusLyrics = await fetchGeniusLyrics(title, artist);
        if (geniusLyrics) {
          return NextResponse.json({ lyrics: geniusLyrics, synced: false });
        }
      } catch (err) {
        console.warn('Genius fallback failed:', err);
      }
    }

    // 4. Quaternary Attempt: lyrics.ovh Fallback GET
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

    // 5. Empty State Fallback
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
