import { NextResponse } from 'next/server';
import { YouTubeSearchResult } from '@/lib/types';

function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

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

function durationToSeconds(durStr: string): number {
  if (!durStr) return 0;
  const parts = durStr.split(':').map(p => parseInt(p.trim(), 10));
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

function findVideoRenderers(obj: Record<string, unknown>, results: YTVideoRenderer[] = []): YTVideoRenderer[] {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim() === '') {
    return NextResponse.json({ results: [] });
  }

  const query = q.trim();
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    // 1. Try YouTube Data API v3 if API key is provided
    if (apiKey) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&q=${encodeURIComponent(
          query
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

          const results: YouTubeSearchResult[] = data.items.map((item: YTPlaylistItem) => {
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

          return NextResponse.json({ results });
        }
      }
    }

    // 2. Fallback: Server-side YouTube HTML scraper
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
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
    const match = html.match(/var ytInitialData = ({[\s\S]*?});\s*<\/script>/) ||
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
          const channelTitle = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube';
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

          if (results.length >= 15) break;
        }
      } catch (jsonErr) {
        console.error('Failed to parse ytInitialData JSON:', jsonErr);
      }
    }

    // Secondary fallback: regex scan HTML if initialData yielded no items
    if (results.length === 0) {
      const videoRegex = /"videoId":"([a-zA-Z0-9_-]{11})".*?"title":{"runs":\[{"text":"(.*?)"}\].*?"ownerText":{"runs":\[{"text":"(.*?)"}\]/g;
      let regMatch;
      const seen = new Set<string>();
      while ((regMatch = videoRegex.exec(html)) !== null && results.length < 15) {
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

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}
