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
 * Fetches the top tags (genre/mood) for a track from Last.fm.
 */
async function fetchLastFmTrackTags(
  title: string,
  artist: string,
  apiKey: string
): Promise<string[]> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.gettoptags&artist=${encodeURIComponent(
      artist
    )}&track=${encodeURIComponent(title)}&autocorrect=1&api_key=${apiKey}&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.error) return [];

    interface LastFmTag {
      name?: string;
      count?: number;
    }

    const rawTags: LastFmTag[] = data.toptags?.tag || [];
    // Filter out generic/useless tags and return top 3
    const ignoreTags = new Set([
      'seen live', 'favorites', 'favourite', 'favorite', 'my favorite',
      'love', 'loved', 'awesome', 'good', 'best', 'check out',
      'spotify', 'youtube', 'all', 'albums i own',
    ]);

    return rawTags
      .filter((t) => t.name && !ignoreTags.has(t.name.toLowerCase()) && (t.count === undefined || t.count > 10))
      .slice(0, 3)
      .map((t) => t.name as string);
  } catch (err) {
    console.warn('Last.fm track.getTopTags error:', err);
    return [];
  }
}

/**
 * Fetches top tracks for a genre/tag from Last.fm tag.getTopTracks API.
 * This returns songs from the SAME GENRE but DIFFERENT artists.
 */
async function fetchLastFmTagTopTracks(
  tag: string,
  seedTitle: string,
  seedArtist: string,
  limit: number,
  apiKey: string
): Promise<LastFmTrackCandidate[]> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(
      tag
    )}&limit=${limit * 3}&api_key=${apiKey}&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.error) return [];

    const rawTracks = data.tracks?.track;
    if (!rawTracks) return [];

    interface TagTrackRaw {
      name?: string;
      artist?: {
        name?: string;
      };
    }

    const tracksArray: TagTrackRaw[] = Array.isArray(rawTracks)
      ? rawTracks
      : [rawTracks];

    const lowerSeedTitle = seedTitle.toLowerCase();
    const lowerSeedArtist = seedArtist.toLowerCase();
    const candidates: LastFmTrackCandidate[] = [];

    for (const t of tracksArray) {
      const trackName = t.name;
      const artistName = t.artist?.name;
      if (trackName && artistName) {
        // Skip the seed song itself AND skip same-artist songs to ensure variety
        if (trackName.toLowerCase() === lowerSeedTitle && artistName.toLowerCase() === lowerSeedArtist) {
          continue;
        }
        // Prefer songs from DIFFERENT artists for genre diversity
        if (artistName.toLowerCase() === lowerSeedArtist) {
          continue;
        }
        candidates.push({ title: trackName, artist: artistName });
      }
    }

    return candidates;
  } catch (err) {
    console.warn('Last.fm tag.getTopTracks error:', err);
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
      // 1. Primary: track.getSimilar (music-DNA based similarity)
      if (title && artist) {
        candidates = await fetchLastFmSimilar(title, artist, limit, apiKey);
      }

      // 2. Fallback: genre/tag-based discovery (different artists, same genre)
      if (candidates.length < 3 && title && artist) {
        const tags = await fetchLastFmTrackTags(title, artist, apiKey);
        if (tags.length > 0) {
          // Fetch from multiple genre tags and merge for diversity
          const tagPromises = tags.map((tag) =>
            fetchLastFmTagTopTracks(tag, title, artist, limit, apiKey)
          );
          const tagResults = await Promise.all(tagPromises);
          
          // Interleave results from different tags for variety
          const seenKeys = new Set(candidates.map((c) => `${c.title.toLowerCase()}|${c.artist.toLowerCase()}`));
          for (const tagCandidates of tagResults) {
            for (const c of tagCandidates) {
              const key = `${c.title.toLowerCase()}|${c.artist.toLowerCase()}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                candidates.push(c);
              }
            }
          }
        }
      }
    }

    if (candidates.length === 0) {
      // YouTube fallback: search for genre-based content, not same artist
      const genreQuery = artist 
        ? `${artist} genre similar artists music`
        : `${title} similar songs`;
      const fallbackSongs = await fetchYouTubeFallback(title, artist, limit);
      // If YouTube fallback also gets same-artist results, try a genre search
      if (fallbackSongs.length === 0) {
        const ytResults = await searchYouTube(genreQuery, limit);
        const genreSongs = ytResults.map((yt) => youtubeSearchResultToSong(yt));
        return NextResponse.json({ recommendations: genreSongs });
      }
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
