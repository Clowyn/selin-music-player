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
 * Parses LRC formatted string into a sorted array of time-stamped lines.
 * Handles timestamp formats like [mm:ss.xx] and [mm:ss.xxx], strips metadata headers like [ar:],
 * and supports multi-timestamp lines (e.g. [00:10.00][01:30.00]Line text).
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
 * Record labels and generic channels common in music streaming / YouTube titles.
 */
export const RECORD_LABELS_AND_GENERIC_CHANNELS = [
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
  'wediacorp music',
  'wediacorp',
  'sezen aksu',
];

const PURE_PUBLISHERS = new Set([
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
  'wediacorp music',
  'wediacorp',
]);

/**
 * Cleans YouTube video titles and extra metadata noise.
 */
export function cleanTitle(title: string): string {
  if (!title) return '';
  return (
    title
      // Remove trailing pipe metadata (e.g. "| netd müzik", "| Official Video")
      .replace(/\s*\|.*$/g, '')
      // Remove parentheses containing metadata keywords anywhere inside
      .replace(
        /\([^)]*?\b(official|video|lyric|lyrics|lirik|sözleri|hd|4k|8k|remastered|remix|clip|klip|klipsiz|audio|vizyon|mv|feat|ft|prod|orijinal|vevo|topic|live|music video)\b[^)]*?\)/gi,
        ''
      )
      // Remove brackets containing metadata keywords anywhere inside
      .replace(
        /\[[^\]]*?\b(official|video|lyric|lyrics|lirik|sözleri|hd|4k|8k|remastered|remix|clip|klip|klipsiz|audio|vizyon|mv|feat|ft|prod|orijinal|vevo|topic|live|music video)\b[^\]]*?\]/gi,
        ''
      )
      // Remove standalone metadata phrases
      .replace(
        /\b(official video|official music video|lyric video|official audio|video klip|resmi video|hd|4k|remastered|klipsiz|feat\.|ft\.)\b/gi,
        ''
      )
      // Remove outer quotes
      .replace(/^["'“‘«]+|["'”’»]+$/g, '')
      // Remove leading or trailing hyphens, colons, pipes
      .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Cleans artist name.
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

/**
 * Sanitizes title and artist inputs, extracting artist from title if title is formatted as "Artist - Title".
 */
export function sanitizeInputs(
  rawTitle: string,
  rawArtist: string
): { title: string; artist: string } {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  let cleanedArt = cleanArtist(artist);
  const lowerArtist = cleanedArt.toLowerCase();

  const isGenericOrChannel =
    !cleanedArt ||
    RECORD_LABELS_AND_GENERIC_CHANNELS.some(
      (label) => lowerArtist === label || lowerArtist.endsWith(` ${label}`) || lowerArtist.endsWith(`-${label}`)
    );

  if (isGenericOrChannel && (title.includes(' - ') || title.includes(' – ') || title.includes(' — '))) {
    const parts = title.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
      cleanedArt = cleanArtist(artist);
    }
  } else if (PURE_PUBLISHERS.has(lowerArtist)) {
    cleanedArt = '';
  }

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
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\r\n/g, '\n')
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
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const searchRes = await fetch(searchUrl, {
      headers,
      signal: controller.signal,
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    let songUrl: string | null = null;

    interface GeniusHit {
      type?: string;
      index?: string;
      result?: {
        url?: string;
      };
    }

    interface GeniusSection {
      type?: string;
      hits?: GeniusHit[];
    }

    const sections: GeniusSection[] = searchData?.response?.sections || [];
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
      signal: controller.signal,
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
  } catch (err) {
    console.warn('Genius fetch error:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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
        const res = await fetch(getUrl, { signal: AbortSignal.timeout(5000) });
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
        const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
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
        const res = await fetch(ovhUrl, { signal: AbortSignal.timeout(5000) });
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

