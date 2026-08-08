import { NextResponse } from 'next/server';
import { Song } from '@/lib/types';
import {
  searchYouTube,
  youtubeSearchResultToSong,
  cleanTitle,
  cleanArtist,
  RECORD_LABELS,
  isSingleTrack,
} from '@/lib/youtube';

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
 * Parses and sanitizes input title & artist parameters.
 * If artist is missing or is a record label/publisher channel, parses "Artist - Title" from title.
 */
export function sanitizeInputs(
  rawTitle: string,
  rawArtist: string
): { title: string; artist: string } {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  let cleanedArt = cleanArtist(artist);
  const lowerArtist = cleanedArt.toLowerCase();

  const isPublisherOrGeneric =
    !cleanedArt ||
    RECORD_LABELS.has(lowerArtist) ||
    Array.from(RECORD_LABELS).some(
      (label) => lowerArtist.endsWith(` ${label}`) || lowerArtist.endsWith(`-${label}`)
    );

  if (
    isPublisherOrGeneric &&
    (title.includes(' - ') || title.includes(' – ') || title.includes(' — '))
  ) {
    const parts = title.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(' - ');
      cleanedArt = cleanArtist(artist);
    }
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
 * Fetches similar genre/style artists from Last.fm artist.getsimilar API.
 * E.g., Dolu Kadehi Ters Tut -> Yüzyüzeyken Konuşuruz, Adamlar, Madrigal, Pinhani, Mavi Gri
 */
export async function fetchLastFmSimilarArtists(
  artist: string,
  limit: number,
  apiKey: string
): Promise<string[]> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(
      artist
    )}&limit=${limit}&autocorrect=1&api_key=${apiKey}&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.error) return [];

    const rawArtists = data.similarartists?.artist;
    if (!rawArtists) return [];

    const artistsArray = Array.isArray(rawArtists) ? rawArtists : [rawArtists];
    return artistsArray
      .map((a: { name?: string }) => a.name)
      .filter((name): name is string => Boolean(name && name.trim()));
  } catch (err) {
    console.warn('Last.fm artist.getsimilar error:', err);
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
    const ignoreTags = new Set([
      'seen live',
      'favorites',
      'favourite',
      'favorite',
      'my favorite',
      'love',
      'loved',
      'awesome',
      'good',
      'best',
      'check out',
      'spotify',
      'youtube',
      'all',
      'albums i own',
    ]);

    return rawTags
      .filter(
        (t) =>
          t.name &&
          !ignoreTags.has(t.name.toLowerCase()) &&
          (t.count === undefined || t.count > 10)
      )
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
        if (
          trackName.toLowerCase() === lowerSeedTitle &&
          artistName.toLowerCase() === lowerSeedArtist
        ) {
          continue;
        }
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
 * Checks if a candidate song matches the seed song (seedTitle and seedArtist).
 * Used to filter out duplicate uploads/versions of the currently playing song.
 */
export function isSeedSong(song: Song, seedTitle: string, seedArtist: string): boolean {
  if (!seedTitle && !seedArtist) return false;

  const sTitle = cleanTitle(song.title || '').toLowerCase();
  const sArtist = cleanArtist(song.artist || '').toLowerCase();
  const cSeedTitle = cleanTitle(seedTitle || '').toLowerCase();
  const cSeedArtist = cleanArtist(seedArtist || '').toLowerCase();

  if (cSeedTitle && cSeedArtist) {
    const titleMatch =
      sTitle === cSeedTitle ||
      (cSeedTitle.length > 2 && sTitle.includes(cSeedTitle)) ||
      (sTitle.length > 2 && cSeedTitle.includes(sTitle));

    const artistMatch =
      sArtist === cSeedArtist ||
      (cSeedArtist.length > 2 && sArtist.includes(cSeedArtist)) ||
      (cSeedArtist.length > 2 && sArtist.includes(cSeedArtist)) ||
      (cSeedArtist.length > 2 && sTitle.includes(cSeedArtist));

    if (titleMatch && artistMatch) {
      return true;
    }

    // Inverted check (e.g. YouTube video titled "Title - Artist")
    const invertedTitleMatch =
      sTitle === cSeedArtist ||
      (cSeedArtist.length > 2 && sTitle.includes(cSeedArtist)) ||
      (sTitle.length > 2 && cSeedArtist.includes(sTitle));

    const invertedArtistMatch =
      sArtist === cSeedTitle ||
      (cSeedTitle.length > 2 && sArtist.includes(cSeedTitle)) ||
      (sArtist.length > 2 && cSeedTitle.includes(sArtist));

    if (invertedTitleMatch && invertedArtistMatch) {
      return true;
    }
  } else if (cSeedTitle) {
    if (sTitle === cSeedTitle || (cSeedTitle.length > 3 && sTitle.includes(cSeedTitle))) {
      return true;
    }
  }

  return false;
}

/**
 * Direct YouTube search fallback for single tracks when Last.fm returns no candidates or key is missing.
 * Searches for single tracks (e.g. "${artist} ${title} benzeri şarkılar" or "${artist} tarzı şarkılar")
 * instead of playlists or mix videos.
 */
async function fetchYouTubeFallback(
  title: string,
  artist: string,
  limit: number
): Promise<Song[]> {
  let searchQuery = '';
  if (artist && title) {
    searchQuery = `${artist} ${title} benzeri şarkılar`;
  } else if (artist) {
    searchQuery = `${artist} tarzı şarkılar`;
  } else if (title) {
    searchQuery = `${title} benzeri şarkılar`;
  } else {
    searchQuery = 'Dolu Kadehi Ters Tut Dilerim Ki benzeri şarkılar';
  }

  try {
    const ytResults = await searchYouTube(searchQuery, limit * 3);
    const valid = ytResults.filter(isSingleTrack);
    const songs = valid.map((yt) => youtubeSearchResultToSong(yt));

    const filtered: Song[] = [];
    const seenYoutubeIds = new Set<string>();

    for (const song of songs) {
      if (!song.youtube_id || seenYoutubeIds.has(song.youtube_id)) continue;
      if (isSeedSong(song, title, artist)) continue;
      seenYoutubeIds.add(song.youtube_id);
      filtered.push(song);
    }

    return filtered;
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

    const candidates: LastFmTrackCandidate[] = [];

    if (apiKey && (title || artist)) {
      // 1. Primary: track.getSimilar (music-DNA based similarity)
      if (title && artist) {
        const trackSimilar = await fetchLastFmSimilar(title, artist, limit, apiKey);
        candidates.push(...trackSimilar);
      }

      // 2. Artist-level genre/style similarity: artist.getsimilar
      if (artist) {
        const similarArtists = await fetchLastFmSimilarArtists(artist, limit, apiKey);
        for (const simArtist of similarArtists) {
          if (simArtist.toLowerCase() !== artist.toLowerCase()) {
            candidates.push({ title: '', artist: simArtist });
          }
        }
      }

      // 3. Supplement: tag-based discovery (different artists, same genre)
      if (candidates.length < 5 && title && artist) {
        const tags = await fetchLastFmTrackTags(title, artist, apiKey);
        if (tags.length > 0) {
          const tagPromises = tags.map((tag) =>
            fetchLastFmTagTopTracks(tag, title, artist, limit, apiKey)
          );
          const tagResults = await Promise.all(tagPromises);
          for (const tagCandidates of tagResults) {
            candidates.push(...tagCandidates);
          }
        }
      }
    }

    if (candidates.length === 0) {
      const fallbackSongs = await fetchYouTubeFallback(title, artist, limit);
      return NextResponse.json({ recommendations: fallbackSongs.slice(0, limit) });
    }

    // Filter out candidates matching seed title & artist
    const cleanSeedTitle = title.toLowerCase();
    const cleanSeedArtist = artist.toLowerCase();

    const seenCandidates = new Set<string>();
    const filteredCandidates: LastFmTrackCandidate[] = [];

    for (const c of candidates) {
      const cTitle = (c.title || '').toLowerCase();
      const cArtist = (c.artist || '').toLowerCase();

      if (cTitle && cArtist && cTitle === cleanSeedTitle && cArtist === cleanSeedArtist) {
        continue;
      }
      if (cArtist === cleanSeedArtist && !cTitle) {
        continue;
      }

      const key = `${cTitle}|${cArtist}`;
      if (!seenCandidates.has(key)) {
        seenCandidates.add(key);
        filteredCandidates.push(c);
      }
    }

    // Resolve candidates to YouTube single tracks
    const resolutionPromises = filteredCandidates
      .slice(0, limit * 2)
      .map(async (candidate): Promise<Song | null> => {
        const searchQuery = candidate.title
          ? `${candidate.artist} - ${candidate.title}`
          : candidate.artist;
        const ytResults = await searchYouTube(searchQuery, 3);
        if (!ytResults || ytResults.length === 0) return null;

        const validResult = ytResults.find(isSingleTrack);
        if (!validResult) return null;

        return youtubeSearchResultToSong(validResult, candidate.artist || undefined);
      });

    const settled = await Promise.allSettled(resolutionPromises);

    const seenYoutubeIds = new Set<string>();
    const recommendations: Song[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value !== null) {
        const song = result.value;
        if (song.youtube_id && !seenYoutubeIds.has(song.youtube_id)) {
          if (!isSeedSong(song, title, artist)) {
            seenYoutubeIds.add(song.youtube_id);
            recommendations.push(song);
          }
        }
      }
      if (recommendations.length >= limit) break;
    }

    // Top up with YouTube fallback if candidate resolution yields too few recommendations
    if (recommendations.length < Math.min(limit, 3)) {
      const fallbackSongs = await fetchYouTubeFallback(title, artist, limit);
      for (const song of fallbackSongs) {
        if (song.youtube_id && !seenYoutubeIds.has(song.youtube_id)) {
          if (!isSeedSong(song, title, artist)) {
            seenYoutubeIds.add(song.youtube_id);
            recommendations.push(song);
          }
        }
        if (recommendations.length >= limit) break;
      }
    }

    return NextResponse.json({ recommendations: recommendations.slice(0, limit) });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', recommendations: [] },
      { status: 500 }
    );
  }
}
