# Comprehensive Analysis & Design: `lib/youtube.ts` Shared Helper

## Executive Summary
This document presents the code analysis of `app/api/search/route.ts` and the complete technical design for extracting its search logic into a reusable shared helper module: `lib/youtube.ts`.

`lib/youtube.ts` will provide a unified, resilient interface `searchYouTube(query: string, limit?: number)` and helper function `youtubeSearchResultToSong(result: YouTubeSearchResult, overrideArtist?: string)`. This clean abstraction enables both `/api/search` and the upcoming `/api/recommendations` endpoints to search YouTube efficiently without code duplication.

---

## 1. Analysis of Existing YouTube Search (`app/api/search/route.ts`)

`app/api/search/route.ts` (258 lines) implements a multi-tiered YouTube video search mechanism with multi-level fallback strategies:

### Tier 1: YouTube Data API v3 (Official API)
- **Condition**: Triggers if process environment variable `YOUTUBE_API_KEY` is present.
- **Search Call**: Fetches `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(query)}&key=${apiKey}`.
- **Details Batching**: Extracts video IDs (`item.id.videoId`) and executes a secondary batch request to `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}` to fetch exact ISO 8601 video durations (parsed via `parseISO8601Duration`).
- **Entity Decoding**: Decodes HTML entities (`&quot;`, `&#39;`, `&amp;`, `&lt;`, `&gt;`) in video titles and channel names.
- **Thumbnail Resolution**: Selects highest available thumbnail (`high.url` -> `medium.url` -> `default.url` -> fallback URL `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`).

### Tier 2: Server-side YouTube HTML Scraper (`ytInitialData`)
- **Condition**: Triggers when `YOUTUBE_API_KEY` is absent, or API returns non-200 HTTP status (e.g. quota exceeded - HTTP 403), or returns 0 results.
- **Scraper Request**: Fetches `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` with desktop browser `User-Agent` and `Accept-Language` headers.
- **Data Extraction**: Extracts embedded JavaScript JSON object `ytInitialData` from page HTML using regex and string index matchers.
- **AST/JSON Traversal**: Uses recursive function `findVideoRenderers(obj, results)` to navigate nested JSON structure and collect all `videoRenderer` nodes.
- **Field Normalization**:
  - `videoId`: Extracted directly.
  - `title`: Extracted from `v.title.runs[0].text` or `v.title.simpleText`.
  - `channelTitle`: Extracted from `v.ownerText` or `v.shortBylineText`.
  - `thumbnail`: Highest resolution thumbnail from `v.thumbnail.thumbnails`.
  - `durationText`: `v.lengthText.simpleText` or `v.lengthText.runs[0].text`.
  - `durationSeconds`: Parsed via `durationToSeconds(durStr)` (`HH:MM:SS` or `MM:SS`).
- **Deduplication**: Tracks processed IDs in `seenIds: Set<string>` to avoid duplicate search entries.

### Tier 3: Secondary Regex HTML Extraction Fallback
- **Condition**: Triggers if `ytInitialData` parsing fails or yields 0 results.
- **Regex Scanning**: Scans HTML for raw regex patterns matching `"videoId":"..."`, `"title":{"runs":[{"text":"..."}]}`, `"ownerText":{"runs":[{"text":"..."}]}`.
- **Defaults**: Applies default duration `'3:30'` (210s) and fallback standard cover image.

---

## 2. Shared Helper Specification: `lib/youtube.ts`

### Requirements
1. **Module location**: `lib/youtube.ts`
2. **Exported function**: `export async function searchYouTube(query: string, limit: number = 15): Promise<YouTubeSearchResult[]>`
3. **Exported helper**: `export function youtubeSearchResultToSong(result: YouTubeSearchResult, overrideArtist?: string): Song`
4. **Resilience**: Never throws unhandled exceptions; returns `[]` on error or empty query.
5. **Configurable Limit**: Honors the `limit` parameter for both API calls and HTML scraper iterations.

### Complete Proposed Implementation

```typescript
import { YouTubeSearchResult, Song } from '@/lib/types';

/**
 * Decodes standard HTML entities in strings retrieved from YouTube HTML / API.
 */
function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Parses ISO 8601 duration strings (e.g. PT3M45S) returned by YouTube Data API v3.
 */
function parseISO8601Duration(isoDuration: string): { duration: string; durationSeconds: number } {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { duration: '3:30', durationSeconds: 210 };
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return { duration: formatted, durationSeconds: totalSeconds };
}

/**
 * Converts formatted duration strings (MM:SS or HH:MM:SS) into total seconds.
 */
function durationToSeconds(durStr: string): number {
  if (!durStr) return 0;
  const parts = durStr.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

interface YTPlaylistItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YTVideoDetailsItem {
  id: string;
  contentDetails?: {
    duration?: string;
  };
}

interface YTVideoRenderer {
  videoId: string;
  title?: { runs?: { text: string }[]; simpleText?: string };
  ownerText?: { runs?: { text: string }[] };
  shortBylineText?: { runs?: { text: string }[] };
  thumbnail?: { thumbnails?: { url: string }[] };
  lengthText?: { simpleText?: string; runs?: { text: string }[] };
}

/**
 * Recursively inspects ytInitialData JSON object tree for videoRenderer items.
 */
function findVideoRenderers(
  obj: Record<string, unknown>,
  results: YTVideoRenderer[] = []
): YTVideoRenderer[] {
  if (!obj || typeof obj !== 'object') return results;
  if ('videoRenderer' in obj && obj.videoRenderer && typeof obj.videoRenderer === 'object') {
    const vr = obj.videoRenderer as YTVideoRenderer;
    if (vr.videoId) {
      results.push(vr);
      return results;
    }
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      findVideoRenderers(val as Record<string, unknown>, results);
    }
  }
  return results;
}

/**
 * Searches YouTube using YouTube Data API v3 if API key is present,
 * falling back to server-side HTML scraping and regex parsing.
 *
 * @param query - Search query string
 * @param limit - Max results to return (default: 15)
 * @returns Promise resolving to array of YouTubeSearchResult objects
 */
export async function searchYouTube(
  query: string,
  limit: number = 15
): Promise<YouTubeSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    // 1. Try YouTube Data API v3 if API key is provided
    if (apiKey) {
      const apiLimit = Math.min(limit, 50);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${apiLimit}&q=${encodeURIComponent(
          q
        )}&key=${apiKey}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const videoIds = data.items
            .map((item: YTPlaylistItem) => item.id?.videoId)
            .filter(Boolean)
            .join(',');

          const durationsMap: Record<string, { duration: string; durationSeconds: number }> = {};

          if (videoIds) {
            try {
              const detailsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`
              );
              if (detailsRes.ok) {
                const detailsData = await detailsRes.json();
                if (detailsData.items) {
                  detailsData.items.forEach((v: YTVideoDetailsItem) => {
                    if (v.id && v.contentDetails?.duration) {
                      durationsMap[v.id] = parseISO8601Duration(v.contentDetails.duration);
                    }
                  });
                }
              }
            } catch {
              // Ignore video details error and fallback to defaults
            }
          }

          const results: YouTubeSearchResult[] = data.items
            .slice(0, limit)
            .map((item: YTPlaylistItem) => {
              const videoId = item.id.videoId;
              const durInfo = durationsMap[videoId] || { duration: '3:30', durationSeconds: 210 };
              const thumbnail =
                item.snippet.thumbnails?.high?.url ||
                item.snippet.thumbnails?.medium?.url ||
                item.snippet.thumbnails?.default?.url ||
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

              return {
                id: videoId,
                title: decodeHTMLEntities(item.snippet.title),
                channelTitle: decodeHTMLEntities(item.snippet.channelTitle),
                thumbnail,
                duration: durInfo.duration,
                durationSeconds: durInfo.durationSeconds,
              };
            });

          if (results.length > 0) return results;
        }
      }
    }

    // 2. Fallback: Server-side YouTube HTML scraper
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
      },
    });

    if (!ytRes.ok) {
      throw new Error(`YouTube scraper HTTP error ${ytRes.status}`);
    }

    const html = await ytRes.text();
    const results: YouTubeSearchResult[] = [];

    // Extract ytInitialData object
    let jsonStr = '';
    const match =
      html.match(/var ytInitialData = ({[\s\S]*?});\s*<\/script>/) ||
      html.match(/window\["ytInitialData"\] = ({[\s\S]*?});/);
    if (match && match[1]) {
      jsonStr = match[1];
    } else {
      const startIndex = html.indexOf('ytInitialData = ');
      if (startIndex !== -1) {
        const startJson = html.indexOf('{', startIndex);
        const endIndex = html.indexOf(';</script>', startJson);
        if (startJson !== -1 && endIndex !== -1) {
          jsonStr = html.substring(startJson, endIndex);
        }
      }
    }

    if (jsonStr) {
      try {
        const initialData = JSON.parse(jsonStr);
        const videoRenderers = findVideoRenderers(initialData);
        const seenIds = new Set<string>();

        for (const v of videoRenderers) {
          const videoId = v.videoId;
          if (!videoId || seenIds.has(videoId)) continue;
          seenIds.add(videoId);

          const title = v.title?.runs?.[0]?.text || v.title?.simpleText || 'Şarkı';
          const channelTitle =
            v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube';
          const thumbnail =
            v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          const durationText = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || '3:30';
          const durationSeconds = durationToSeconds(durationText);

          results.push({
            id: videoId,
            title: decodeHTMLEntities(title),
            channelTitle: decodeHTMLEntities(channelTitle),
            thumbnail,
            duration: durationText,
            durationSeconds,
          });

          if (results.length >= limit) break;
        }
      } catch (jsonErr) {
        console.error('Failed to parse ytInitialData JSON:', jsonErr);
      }
    }

    // Secondary fallback: regex scan HTML if initialData yielded no items
    if (results.length === 0) {
      const videoRegex =
        /"videoId":"([a-zA-Z0-9_-]{11})".*?"title":{"runs":\[{"text":"(.*?)"}\].*?"ownerText":{"runs":\[{"text":"(.*?)"}\]/g;
      let regMatch;
      const seen = new Set<string>();
      while ((regMatch = videoRegex.exec(html)) !== null && results.length < limit) {
        const videoId = regMatch[1];
        if (seen.has(videoId)) continue;
        seen.add(videoId);
        results.push({
          id: videoId,
          title: decodeHTMLEntities(regMatch[2]),
          channelTitle: decodeHTMLEntities(regMatch[3]),
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: '3:30',
          durationSeconds: 210,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('YouTube search helper error:', error);
    return [];
  }
}

/**
 * Converts a YouTubeSearchResult into a standard application Song object.
 */
export function youtubeSearchResultToSong(
  result: YouTubeSearchResult,
  overrideArtist?: string
): Song {
  return {
    id: `yt-${result.id}`,
    title: result.title,
    artist: overrideArtist || result.channelTitle,
    audio_url: `https://www.youtube.com/watch?v=${result.id}`,
    youtube_id: result.id,
    duration: result.durationSeconds || 210,
    cover_url: result.thumbnail,
  };
}
```

---

## 3. Refactoring Impact

### A. `app/api/search/route.ts`
After creating `lib/youtube.ts`, `app/api/search/route.ts` shrinks from 258 lines down to ~20 lines:

```typescript
import { NextResponse } from 'next/server';
import { searchYouTube } from '@/lib/youtube';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim() === '') {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchYouTube(q.trim(), 15);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}
```

### B. `app/api/recommendations/route.ts`
Can directly import `searchYouTube` and `youtubeSearchResultToSong`:

```typescript
import { searchYouTube, youtubeSearchResultToSong } from '@/lib/youtube';
// Resolves Last.fm recommendations by searching YouTube for each track
const ytResults = await searchYouTube(`${rec.artist} - ${rec.title}`, 1);
if (ytResults.length > 0) {
  const song = youtubeSearchResultToSong(ytResults[0], rec.artist);
  recommendations.push(song);
}
```

---

## 4. Verification Plan
1. **Unit/Integration Test**:
   - Verify `searchYouTube` returns valid `YouTubeSearchResult[]` when given queries.
   - Verify `searchYouTube` gracefully handles empty strings, returns `[]`.
   - Verify `youtubeSearchResultToSong` transforms `YouTubeSearchResult` into valid `Song` object with `id: "yt-ID"`, `audio_url: "https://www.youtube.com/watch?v=ID"`, `youtube_id: "ID"`, `duration`, `cover_url`.
2. **Build Verification**:
   - Execute `npm run lint` and `npm run build` after implementer writes `lib/youtube.ts` and refactors `app/api/search/route.ts`.
