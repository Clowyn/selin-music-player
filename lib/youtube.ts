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

export const RECORD_LABELS = new Set([
  'netd müzik',
  'netd musik',
  'netd muzık',
  'netd',
  'poll production',
  'pasaj müzik',
  'pasaj muzik',
  'pasaj müzik tv',
  'pasaj',
  'dmc',
  'doğan müzik',
  'doğan müzik yapım',
  'doğan music company',
  'kalan müzik',
  'kalan muzik',
  'kalan',
  'avrupa müzik',
  'avrupa muzik',
  'avrupa',
  'dokuz sekiz müzik',
  'dokuz sekiz',
  'dokuzsekiz müzik',
  'seyhan müzik',
  'seyhan muzik',
  "spinnin' records",
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
  'wediacorp music',
  'wediacorp',
]);

/**
 * Cleans YouTube video titles and extra metadata noise (e.g. "(Official Video)", "[4K Remastered]").
 */
export function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\s*\|.*$/g, '')
    .replace(
      /\([^)]*?\b(official|video|lyric|lyrics|lirik|sözleri|hd|4k|8k|remastered|remix|clip|klip|klipsiz|audio|vizyon|mv|feat|ft|prod|orijinal|vevo|topic|live|music video)\b[^)]*?\)/gi,
      ''
    )
    .replace(
      /\[[^\]]*?\b(official|video|lyric|lyrics|lirik|sözleri|hd|4k|8k|remastered|remix|clip|klip|klipsiz|audio|vizyon|mv|feat|ft|prod|orijinal|vevo|topic|live|music video)\b[^\]]*?\]/gi,
      ''
    )
    .replace(
      /\b(official video|official music video|lyric video|official audio|video klip|resmi video|hd|4k|remastered|klipsiz|feat\.|ft\.)\b/gi,
      ''
    )
    .replace(/^["'“‘«]+|["'”’»]+$/g, '')
    .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans artist name by removing VEVO, - Topic, and generic channel suffixes.
 */
export function cleanArtist(artist: string): string {
  if (!artist) return '';
  return artist
    .replace(/VEVO$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s+Topic$/i, '')
    .replace(/\b(Official YouTube Channel|Official Channel|Official Page|Official)\b/gi, '')
    .replace(/^["'“‘«]+|["'”’»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface YouTubeSearchResultLike {
  title: string;
  durationSeconds?: number;
}

/**
 * Filter to reject YouTube videos with duration > 600s or < 45s, or titles containing playlist/mix keywords.
 */
export function isSingleTrack(yt: YouTubeSearchResultLike): boolean {
  if (yt.durationSeconds && (yt.durationSeconds > 600 || yt.durationSeconds < 45)) {
    return false;
  }
  const lowerTitle = (yt.title || '').toLowerCase();
  const playlistKeywords = [
    'playlist',
    'album',
    'albüm',
    '1 saat',
    '2 saat',
    'full album',
    'tüm şarkıları',
    'tum sarkilari',
    'kesintisiz',
    'en çok dinlenenler',
    'best of',
    'compilation',
  ];
  if (playlistKeywords.some((kw) => lowerTitle.includes(kw))) {
    return false;
  }

  // Reject 'mix' as a standalone keyword, but do not reject legitimate single-track remixes
  const titleWithoutRemix = lowerTitle
    .replace(/\bremix\b/gi, '')
    .replace(/\bremiks\b/gi, '');
  if (/\bmix\b/i.test(titleWithoutRemix)) {
    return false;
  }

  return true;
}

/**
 * Converts a YouTubeSearchResult into a standard application Song object,
 * automatically sanitizing titles and artists.
 */
export function youtubeSearchResultToSong(
  result: YouTubeSearchResult,
  overrideArtist?: string
): Song {
  let rawTitle = result.title || '';
  let rawArtist = overrideArtist || result.channelTitle || '';

  const cleanedArt = cleanArtist(rawArtist);
  const lowerArtist = cleanedArt.toLowerCase();
  const isPublisherOrGeneric =
    !cleanedArt ||
    RECORD_LABELS.has(lowerArtist) ||
    Array.from(RECORD_LABELS).some(
      (label) => lowerArtist.endsWith(` ${label}`) || lowerArtist.endsWith(`-${label}`)
    );

  if (
    (isPublisherOrGeneric || !overrideArtist) &&
    (rawTitle.includes(' - ') || rawTitle.includes(' – ') || rawTitle.includes(' — '))
  ) {
    const parts = rawTitle.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      if (isPublisherOrGeneric || !overrideArtist) {
        rawArtist = parts[0];
      }
      rawTitle = parts.slice(1).join(' - ');
    }
  }

  let finalTitle = cleanTitle(rawTitle);
  const finalArtist = cleanArtist(rawArtist);

  if (finalArtist && finalTitle.toLowerCase().startsWith(`${finalArtist.toLowerCase()} - `)) {
    finalTitle = finalTitle.substring(finalArtist.length + 3).trim();
  }

  return {
    id: `yt-${result.id}`,
    title: finalTitle,
    artist: finalArtist,
    audio_url: `https://www.youtube.com/watch?v=${result.id}`,
    youtube_id: result.id,
    duration: result.durationSeconds || 210,
    cover_url: result.thumbnail,
  };
}

