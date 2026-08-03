import { NextResponse } from 'next/server';
import { Song } from '@/lib/types';
import { searchYouTube, youtubeSearchResultToSong } from '@/lib/youtube';

interface LastFmTrackCandidate {
  title: string;
  artist: string;
}

interface LastFmSimilarTrackRaw {
  name?: string;
  artist?: {
    name?: string;
  } | string;
}

interface LastFmTopTrackRaw {
  name?: string;
  artist?: {
    name?: string;
  } | string;
}

/**
 * Cleans YouTube video titles and metadata noise (e.g. "(Official Video)", "[4K Remastered]").
 */
function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\((official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|vizyon).*?\)/gi, '')
    .replace(/\[(official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video).*?\]/gi, '')
    .replace(/\b(official video|official music video|lyric video|official audio|hd|4k|remastered)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans artist name by removing common YouTube suffixes like VEVO or - Topic.
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
 * Parses and sanitizes input title & artist parameters.
 */
function sanitizeInputs(rawTitle: string, rawArtist: string): { title: string; artist: string } {
  let title = rawTitle.trim();
  let artist = rawArtist.trim();

  // Handle case where title contains "Artist - Song Title"
  const isGenericArtist = !artist || artist.toLowerCase() === 'youtube' || artist.toLowerCase().endsWith('vevo') || artist.toLowerCase().endsWith('- topic');
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

/**
 * Fetches similar tracks from Last.fm track.getSimilar API.
 */
async function fetchLastFmSimilar(
  title: string,
  artist: string,
  limit: number,
  apiKey: string
): Promise<LastFmTrackCandidate[]> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(
      artist
    )}&track=${encodeURIComponent(title)}&limit=${limit * 2}&autocorrect=1&api_key=${apiKey}&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.error) return [];

    const rawTracks = data.similartracks?.track;
    if (!rawTracks) return [];

    const tracksArray: LastFmSimilarTrackRaw[] = Array.isArray(rawTracks)
      ? rawTracks
      : [rawTracks];

    const candidates: LastFmTrackCandidate[] = [];
    for (const t of tracksArray) {
      const trackName = t.name;
      const artistName = typeof t.artist === 'object' ? t.artist?.name : t.artist;
      if (trackName && artistName) {
        candidates.push({ title: trackName, artist: artistName });
      }
    }

    return candidates;
  } catch (err) {
    console.warn('Last.fm track.getSimilar error:', err);
    return [];
  }
}

/**
 * Fetches top tracks from Last.fm artist.getTopTracks API as fallback.
 */
async function fetchLastFmTopTracks(
  artist: string,
  seedTitle: string,
  limit: number,
  apiKey: string
): Promise<LastFmTrackCandidate[]> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(
      artist
    )}&limit=${limit * 2}&autocorrect=1&api_key=${apiKey}&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.error) return [];

    const rawTracks = data.toptracks?.track;
    if (!rawTracks) return [];

    const tracksArray: LastFmTopTrackRaw[] = Array.isArray(rawTracks)
      ? rawTracks
      : [rawTracks];

    const lowerSeedTitle = seedTitle.toLowerCase();
    const candidates: LastFmTrackCandidate[] = [];

    for (const t of tracksArray) {
      const trackName = t.name;
      const artistName = typeof t.artist === 'object' ? t.artist?.name : (t.artist || artist);
      if (trackName && artistName) {
        if (seedTitle && trackName.toLowerCase() === lowerSeedTitle) {
          continue;
        }
        candidates.push({ title: trackName, artist: artistName });
      }
    }

    return candidates;
  } catch (err) {
    console.warn('Last.fm artist.getTopTracks error:', err);
    return [];
  }
}

/**
 * Direct YouTube search fallback when Last.fm returns no candidates or key is missing.
 */
async function fetchYouTubeFallback(title: string, artist: string, limit: number): Promise<Song[]> {
  let searchQuery = '';
  if (artist && title) {
    searchQuery = `${artist} ${title} mix`;
  } else if (artist) {
    searchQuery = `${artist} top songs`;
  } else if (title) {
    searchQuery = `${title} mix`;
  } else {
    searchQuery = 'Türkçe Pop En Çok Dinlenenler 2026';
  }

  try {
    const ytResults = await searchYouTube(searchQuery, limit);
    return ytResults.map((yt) => youtubeSearchResultToSong(yt));
  } catch (err) {
    console.error('YouTube fallback search failed:', err);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title') || '';
    const rawArtist = searchParams.get('artist') || '';
    const rawLimit = searchParams.get('limit');

    if (!rawTitle.trim() && !rawArtist.trim()) {
      return NextResponse.json(
        { error: 'At least title or artist query parameter is required.', recommendations: [] },
        { status: 400 }
      );
    }

    let limit = 10;
    if (rawLimit) {
      const parsed = parseInt(rawLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 20);
      }
    }

    const { title, artist } = sanitizeInputs(rawTitle, rawArtist);
    const apiKey = process.env.LASTFM_API_KEY;

    let candidates: LastFmTrackCandidate[] = [];

    if (apiKey && (title || artist)) {
      if (title && artist) {
        candidates = await fetchLastFmSimilar(title, artist, limit, apiKey);
      }

      if (candidates.length === 0 && artist) {
        candidates = await fetchLastFmTopTracks(artist, title, limit, apiKey);
      }
    }

    if (candidates.length === 0) {
      const fallbackSongs = await fetchYouTubeFallback(title, artist, limit);
      return NextResponse.json({ recommendations: fallbackSongs });
    }

    // Filter out candidates identical to input track
    const cleanSeedTitle = title.toLowerCase();
    const cleanSeedArtist = artist.toLowerCase();

    const filteredCandidates = candidates
      .filter(
        (c) =>
          !(
            c.title.toLowerCase() === cleanSeedTitle &&
            c.artist.toLowerCase() === cleanSeedArtist
          )
      )
      .slice(0, limit + 5);

    // Resolve candidates to YouTube video streams in parallel
    const resolutionPromises = filteredCandidates.map(async (candidate): Promise<Song | null> => {
      const searchQuery = `${candidate.artist} - ${candidate.title}`;
      const ytResults = await searchYouTube(searchQuery, 1);
      if (!ytResults || ytResults.length === 0) return null;

      return youtubeSearchResultToSong(ytResults[0], candidate.artist);
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

    // If candidate resolution yielded too few results, top up with fallback
    if (recommendations.length < Math.min(limit, 3)) {
      const fallbackSongs = await fetchYouTubeFallback(title, artist, limit);
      for (const song of fallbackSongs) {
        if (song.youtube_id && !seenYoutubeIds.has(song.youtube_id)) {
          seenYoutubeIds.add(song.youtube_id);
          recommendations.push(song);
        }
        if (recommendations.length >= limit) break;
      }
    }

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', recommendations: [] },
      { status: 500 }
    );
  }
}
