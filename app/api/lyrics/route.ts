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
 * Cleans YouTube video titles and extra metadata noise.
 */
function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\((official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|vizyon|mv|feat|ft).*?\)/gi, '')
    .replace(/\[(official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|mv|feat|ft).*?\]/gi, '')
    .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|remastered|feat\.|ft\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans artist name.
 */
function cleanArtist(artist: string): string {
  if (!artist) return '';
  return artist
    .replace(/VEVO$/i, '')
    .replace(/ - Topic$/i, '')
    .replace(/\bOfficial\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes title and artist inputs, extracting artist from title if title is formatted as "Artist - Title".
 */
function sanitizeInputs(rawTitle: string, rawArtist: string): { title: string; artist: string } {
  let title = rawTitle.trim();
  let artist = rawArtist.trim();

  const isGenericArtist =
    !artist ||
    artist.toLowerCase() === 'youtube' ||
    artist.toLowerCase().endsWith('vevo') ||
    artist.toLowerCase().endsWith('- topic');

  if (isGenericArtist && (title.includes(' - ') || title.includes(' – ') || title.includes(' — '))) {
    const parts = title.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
    }
  }

  return {
    title: cleanTitle(title),
    artist: cleanArtist(artist),
  };
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
            // Find first result with synced lyrics
            const syncedMatch = results.find((r) => r.syncedLyrics && r.syncedLyrics.trim());
            if (syncedMatch && syncedMatch.syncedLyrics) {
              const parsedLines = parseLrc(syncedMatch.syncedLyrics);
              if (parsedLines.length > 0) {
                return NextResponse.json({ lyrics: syncedMatch.syncedLyrics, synced: true, lines: parsedLines });
              }
            }
            // Fallback to first result with plain lyrics
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

    // 3. Tertiary Attempt: lyrics.ovh Fallback GET
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

    // 4. Empty State Fallback
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
