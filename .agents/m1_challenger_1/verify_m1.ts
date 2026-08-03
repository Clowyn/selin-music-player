import { searchYouTube, youtubeSearchResultToSong } from '@/lib/youtube';
import { GET as searchGET } from '@/app/api/search/route';
import { GET as recsGET } from '@/app/api/recommendations/route';

async function runTests() {
  console.log('=== STARTING EMPIRICAL VERIFICATION FOR MILESTONE 1 ===\n');
  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failCount++;
    }
  }

  // -------------------------------------------------------------
  // Test Suite 1: lib/youtube.ts
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: lib/youtube.ts ---');

  // 1.1 Empty Query
  try {
    const emptyRes = await searchYouTube('   ');
    assert(Array.isArray(emptyRes) && emptyRes.length === 0, '1.1 searchYouTube("") returns empty array');
  } catch (err: any) {
    assert(false, '1.1 searchYouTube("") thrown error', err.message);
  }

  // 1.2 Normal Search
  try {
    const searchRes = await searchYouTube('Tarkan Dudu', 5);
    assert(Array.isArray(searchRes) && searchRes.length > 0, '1.2 searchYouTube("Tarkan Dudu") returns non-empty array');
    if (searchRes.length > 0) {
      const item = searchRes[0];
      assert(typeof item.id === 'string' && item.id.length > 0, '1.2 item.id is valid string');
      assert(typeof item.title === 'string' && item.title.length > 0, '1.2 item.title is valid string');
      assert(typeof item.thumbnail === 'string' && item.thumbnail.startsWith('http'), '1.2 item.thumbnail is valid URL');
      assert(typeof item.durationSeconds === 'number' && item.durationSeconds > 0, '1.2 item.durationSeconds > 0');
    }
  } catch (err: any) {
    assert(false, '1.2 searchYouTube("Tarkan Dudu") failed', err.message);
  }

  // 1.3 youtubeSearchResultToSong conversion
  try {
    const mockItem = {
      id: 'abc12345678',
      title: 'Test Song &amp; Live',
      channelTitle: 'Test Artist',
      thumbnail: 'https://i.ytimg.com/vi/abc12345678/hqdefault.jpg',
      duration: '03:45',
      durationSeconds: 225,
    };
    const song = youtubeSearchResultToSong(mockItem, 'Custom Artist');
    assert(song.id === 'yt-abc12345678', '1.3 song.id has "yt-" prefix');
    assert(song.title === 'Test Song &amp; Live', '1.3 song.title matches result');
    assert(song.artist === 'Custom Artist', '1.3 overrideArtist applied correctly');
    assert(song.audio_url === 'https://www.youtube.com/watch?v=abc12345678', '1.3 audio_url YouTube watch link');
    assert(song.youtube_id === 'abc12345678', '1.3 youtube_id matches');
    assert(song.duration === 225, '1.3 duration matches durationSeconds');
  } catch (err: any) {
    assert(false, '1.3 youtubeSearchResultToSong failed', err.message);
  }

  // -------------------------------------------------------------
  // Test Suite 2: app/api/search/route.ts
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: app/api/search/route.ts ---');

  // 2.1 Missing / empty query parameter
  try {
    const req = new Request('http://localhost:3000/api/search?q=');
    const res = await searchGET(req);
    assert(res.status === 200, '2.1 GET /api/search?q= returns HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.results) && json.results.length === 0, '2.1 returns { results: [] }');
  } catch (err: any) {
    assert(false, '2.1 GET /api/search?q= failed', err.message);
  }

  // 2.2 Valid query parameter
  try {
    const req = new Request('http://localhost:3000/api/search?q=Mor+ve+%C3%96tesi');
    const res = await searchGET(req);
    assert(res.status === 200, '2.2 GET /api/search?q=Mor+ve+Otesi returns HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.results) && json.results.length > 0, '2.2 returns non-empty results array');
  } catch (err: any) {
    assert(false, '2.2 GET /api/search?q=Mor+ve+Otesi failed', err.message);
  }

  // -------------------------------------------------------------
  // Test Suite 3: app/api/recommendations/route.ts
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: app/api/recommendations/route.ts ---');

  // 3.1 Error boundary: Missing both title and artist
  try {
    const req = new Request('http://localhost:3000/api/recommendations');
    const res = await recsGET(req);
    assert(res.status === 400, '3.1 GET /api/recommendations (no params) returns HTTP 400');
    const json = await res.json();
    assert(typeof json.error === 'string' && Array.isArray(json.recommendations), '3.1 returns error message and empty recommendations');
  } catch (err: any) {
    assert(false, '3.1 GET /api/recommendations (no params) failed', err.message);
  }

  // 3.2 Error boundary: Whitespace-only parameters
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=%20%20&artist=%20');
    const res = await recsGET(req);
    assert(res.status === 400, '3.2 GET /api/recommendations (whitespace params) returns HTTP 400');
  } catch (err: any) {
    assert(false, '3.2 GET /api/recommendations (whitespace params) failed', err.message);
  }

  // 3.3 Recommendation by Title + Artist (Standard contract test)
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=Bir+Derdim+Var&artist=Mor+ve+%C3%96tesi&limit=5');
    const res = await recsGET(req);
    assert(res.status === 200, '3.3 GET /api/recommendations?title=Bir+Derdim+Var&artist=Mor+ve+Otesi returns HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.recommendations), '3.3 response contains recommendations array');
    assert(json.recommendations.length > 0, `3.3 returned ${json.recommendations?.length} recommendations`);

    if (json.recommendations.length > 0) {
      const rec = json.recommendations[0];
      assert(typeof rec.id === 'string' && rec.id.startsWith('yt-'), '3.3 recommendation id starts with yt-');
      assert(typeof rec.title === 'string' && rec.title.length > 0, '3.3 recommendation title is non-empty');
      assert(typeof rec.artist === 'string' && rec.artist.length > 0, '3.3 recommendation artist is non-empty');
      assert(typeof rec.audio_url === 'string' && rec.audio_url.includes('youtube.com/watch'), '3.3 recommendation audio_url is youtube link');
      assert(typeof rec.youtube_id === 'string' && rec.youtube_id.length > 0, '3.3 recommendation youtube_id is present');
      assert(typeof rec.duration === 'number' && rec.duration > 0, '3.3 recommendation duration is number > 0');
      assert(typeof rec.cover_url === 'string' && rec.cover_url.startsWith('http'), '3.3 recommendation cover_url is valid URL');
    }

    // Check uniqueness of youtube_id in recommendations
    const ytIds = json.recommendations.map((r: any) => r.youtube_id);
    const uniqueYtIds = new Set(ytIds);
    assert(ytIds.length === uniqueYtIds.size, '3.3 all youtube_ids in recommendations are unique (no duplicates)');
  } catch (err: any) {
    assert(false, '3.3 Recommendations by Title+Artist failed', err.message);
  }

  // 3.4 Recommendation by Artist only
  try {
    const req = new Request('http://localhost:3000/api/recommendations?artist=Sezen+Aksu&limit=5');
    const res = await recsGET(req);
    assert(res.status === 200, '3.4 GET /api/recommendations?artist=Sezen+Aksu returns HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.recommendations) && json.recommendations.length > 0, '3.4 artist-only returns non-empty recommendations');
  } catch (err: any) {
    assert(false, '3.4 Recommendations by Artist failed', err.message);
  }

  // 3.5 Recommendation by Title only
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=Firth+of+Fifth&limit=5');
    const res = await recsGET(req);
    assert(res.status === 200, '3.5 GET /api/recommendations?title=Firth+of+Fifth returns HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.recommendations) && json.recommendations.length > 0, '3.5 title-only returns non-empty recommendations');
  } catch (err: any) {
    assert(false, '3.5 Recommendations by Title failed', err.message);
  }

  // 3.6 Edge Case: Video title noise & composite titles ("Artist - Title (Official Video)")
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=Duman+-+Seni+Kendime+Saklad%C4%B1m+(Official+Music+Video)&artist=YouTube&limit=5');
    const res = await recsGET(req);
    assert(res.status === 200, '3.6 GET /api/recommendations with composite title & noise returns HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.recommendations) && json.recommendations.length > 0, '3.6 returns recommendations despite noise in title');
  } catch (err: any) {
    assert(false, '3.6 Composite title & noise failed', err.message);
  }

  // 3.7 Edge Case: Non-existent track / fallback test
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=XyZ999999NonExistentSong&artist=AbC888888NonExistentArtist&limit=5');
    const res = await recsGET(req);
    assert(res.status === 200, '3.7 Non-existent song query returns HTTP 200 (graceful fallback)');
    const json = await res.json();
    assert(Array.isArray(json.recommendations), '3.7 returns recommendations array without crashing');
  } catch (err: any) {
    assert(false, '3.7 Non-existent song query failed', err.message);
  }

  console.log(`\n=== VERIFICATION SUMMARY ===`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
