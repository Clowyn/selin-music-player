import { NextRequest, NextResponse } from 'next/server';

interface ImportedTrack {
  title: string;
  artist: string;
  youtube_id?: string;
  duration: number;
  cover_url?: string;
}

// ─── Spotify Import ───────────────────────────────────────────────────────────

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

function extractSpotifyPlaylistId(url: string): string | null {
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function importFromSpotify(playlistId: string): Promise<{ tracks: ImportedTrack[]; playlistName: string }> {
  const token = await getSpotifyToken();
  if (!token) {
    throw new Error('Spotify API anahtarları tanımlanmamış. SPOTIFY_CLIENT_ID ve SPOTIFY_CLIENT_SECRET gerekli.');
  }

  // Fetch playlist metadata
  const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error('Spotify listesi bulunamadı veya gizli.');
  const metaData = await metaRes.json();
  const playlistName = metaData.name || 'Spotify Listesi';

  // Fetch tracks (paginated)
  const tracks: ImportedTrack[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(name,artists,duration_ms,album(images))),next`;

  while (nextUrl) {
    const fetchRes: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fetchRes.ok) break;
    const data = await fetchRes.json();

    for (const item of data.items || []) {
      const track = item?.track;
      if (!track || !track.name) continue;

      const artistNames = (track.artists || [])
        .map((a: { name: string }) => a.name)
        .join(', ');

      tracks.push({
        title: track.name,
        artist: artistNames || 'Bilinmeyen Sanatçı',
        duration: Math.round((track.duration_ms || 0) / 1000),
        cover_url: track.album?.images?.[0]?.url || undefined,
      });
    }

    nextUrl = data.next || null;
  }

  return { tracks, playlistName };
}

// ─── YouTube / YouTube Music Import ───────────────────────────────────────────

function extractYouTubePlaylistId(url: string): string | null {
  // https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
  // https://music.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function importFromYouTube(playlistId: string): Promise<{ tracks: ImportedTrack[]; playlistName: string }> {
  // Try YouTube Data API v3 first
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    return importFromYouTubeAPI(playlistId, apiKey);
  }
  // Fallback: scrape
  return importFromYouTubeScrape(playlistId);
}

async function importFromYouTubeAPI(playlistId: string, apiKey: string): Promise<{ tracks: ImportedTrack[]; playlistName: string }> {
  // Fetch playlist title
  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`
  );
  const metaData = await metaRes.json();
  const playlistName = metaData.items?.[0]?.snippet?.title || 'YouTube Listesi';

  const tracks: ImportedTrack[] = [];
  let pageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      const videoId = item.contentDetails?.videoId;
      if (!snippet?.title || snippet.title === 'Private video' || snippet.title === 'Deleted video') continue;

      tracks.push({
        title: snippet.title,
        artist: snippet.videoOwnerChannelTitle?.replace(' - Topic', '') || 'YouTube',
        youtube_id: videoId,
        duration: 0, // Would need extra API call for durations
        cover_url: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      });
    }

    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return { tracks, playlistName };
}

async function importFromYouTubeScrape(playlistId: string): Promise<{ tracks: ImportedTrack[]; playlistName: string }> {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error('YouTube listesi yüklenemedi.');
  const html = await res.text();

  // Extract ytInitialData
  const match = html.match(/var\s+ytInitialData\s*=\s*({[\s\S]+?});\s*<\/script>/);
  if (!match) throw new Error('YouTube liste verisi okunamadı.');

  let ytData: Record<string, unknown>;
  try {
    ytData = JSON.parse(match[1]);
  } catch {
    throw new Error('YouTube liste verisi ayrıştırılamadı.');
  }

  // Extract playlist title
  let playlistName = 'YouTube Listesi';
  try {
    const header = findNestedKey(ytData, 'playlistHeaderRenderer');
    if (header) {
      const titleObj = (header as Record<string, unknown>).title as Record<string, unknown> | undefined;
      if (titleObj) {
        const simpleText = titleObj.simpleText as string | undefined;
        const runs = titleObj.runs as Array<{ text: string }> | undefined;
        playlistName = simpleText || runs?.[0]?.text || playlistName;
      }
    }
  } catch { /* use default name */ }

  // Extract video items
  const tracks: ImportedTrack[] = [];
  const contents = findNestedKey(ytData, 'playlistVideoListRenderer') as Record<string, unknown> | null;
  if (!contents) {
    throw new Error('YouTube listesinde şarkı bulunamadı.');
  }

  const videoItems = (contents.contents as Array<Record<string, unknown>>) || [];

  for (const item of videoItems) {
    const renderer = item.playlistVideoRenderer as Record<string, unknown> | undefined;
    if (!renderer) continue;

    const videoId = renderer.videoId as string;
    const titleRuns = (renderer.title as Record<string, unknown>)?.runs as Array<{ text: string }> | undefined;
    const title = titleRuns?.[0]?.text;
    if (!title || title === '[Private video]' || title === '[Deleted video]') continue;

    const channelRuns = (renderer.shortBylineText as Record<string, unknown>)?.runs as Array<{ text: string }> | undefined;
    const artist = channelRuns?.[0]?.text?.replace(' - Topic', '') || 'YouTube';

    const lengthText = (renderer.lengthText as Record<string, unknown>)?.simpleText as string | undefined;
    let duration = 0;
    if (lengthText) {
      const parts = lengthText.split(':').map(Number);
      if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
    }

    const thumbs = (renderer.thumbnail as Record<string, unknown>)?.thumbnails as Array<{ url: string }> | undefined;

    tracks.push({
      title,
      artist,
      youtube_id: videoId,
      duration,
      cover_url: thumbs?.[thumbs.length - 1]?.url,
    });
  }

  return { tracks, playlistName };
}

// Helper: recursively find a key in nested JSON
function findNestedKey(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  for (const k of Object.keys(record)) {
    const result = findNestedKey(record[k], key);
    if (result) return result;
  }
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'URL parametresi gerekli.' }, { status: 400 });
  }

  try {
    // Detect platform
    const spotifyId = extractSpotifyPlaylistId(url);
    const youtubeId = extractYouTubePlaylistId(url);

    if (spotifyId) {
      const result = await importFromSpotify(spotifyId);
      return NextResponse.json({ platform: 'spotify', ...result });
    }

    if (youtubeId) {
      const result = await importFromYouTube(youtubeId);
      return NextResponse.json({ platform: 'youtube', ...result });
    }

    return NextResponse.json(
      { error: 'Desteklenmeyen URL. Spotify veya YouTube Music çalma listesi linki yapıştırın.' },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata.';
    console.error('Import error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
