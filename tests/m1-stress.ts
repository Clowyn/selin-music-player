import { searchYouTube, youtubeSearchResultToSong } from '../lib/youtube';
import { GET as getRecommendations } from '../app/api/recommendations/route';

// Helper to simulate Next.js Request object
function createMockRequest(queryParams: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/recommendations');
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

async function runTests() {
  console.log('==================================================');
  console.log('STARTING EMPIRICAL STRESS TESTS FOR MILESTONE 1');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 1: lib/youtube.ts helper functions
  // ----------------------------------------------------
  console.log('--- TEST GROUP 1: lib/youtube.ts Helper Functions ---');

  try {
    const emptyResults = await searchYouTube('');
    assert(emptyResults.length === 0, 'searchYouTube("") returns empty array');
  } catch (err: any) {
    assert(false, 'searchYouTube("") threw error', err.message);
  }

  try {
    const whitespaceResults = await searchYouTube('   ');
    assert(whitespaceResults.length === 0, 'searchYouTube("   ") returns empty array');
  } catch (err: any) {
    assert(false, 'searchYouTube("   ") threw error', err.message);
  }

  try {
    const specialCharResults = await searchYouTube('Sezen Aksu & Tarkan - Gülümse (Live) #1!');
    assert(
      Array.isArray(specialCharResults) && specialCharResults.length > 0,
      'searchYouTube with special characters (&, #, Turkish chars, parens) returns results',
      `Got ${specialCharResults.length} results`
    );
    if (specialCharResults.length > 0) {
      const first = specialCharResults[0];
      assert(typeof first.id === 'string' && first.id.length > 0, 'Result has valid youtube_id');
      assert(typeof first.title === 'string' && first.title.length > 0, 'Result has valid title');
      assert(typeof first.thumbnail === 'string', 'Result has valid thumbnail URL');
    }
  } catch (err: any) {
    assert(false, 'searchYouTube with special characters threw error', err.message);
  }

  try {
    const dummyResult = {
      id: 'abc123xyz',
      title: 'Test &amp; Title',
      channelTitle: 'Test Channel VEVO',
      thumbnail: 'https://img.jpg',
      duration: '3:45',
      durationSeconds: 225,
    };
    const song = youtubeSearchResultToSong(dummyResult, 'Overridden Artist');
    assert(song.id === 'yt-abc123xyz', 'youtubeSearchResultToSong formats id as yt-{id}');
    assert(song.artist === 'Overridden Artist', 'youtubeSearchResultToSong applies overrideArtist');
    assert(song.duration === 225, 'youtubeSearchResultToSong maps durationSeconds correctly');
  } catch (err: any) {
    assert(false, 'youtubeSearchResultToSong failed', err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 2: GET /api/recommendations route edge cases
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: Recommendations Route Edge Cases ---');

  // Test 2.1: Missing parameters (400)
  try {
    const req = createMockRequest({});
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 400, 'Missing parameters returns HTTP 400', `Got status ${res.status}`);
    assert(
      json.error && Array.isArray(json.recommendations) && json.recommendations.length === 0,
      'Missing parameters returns error message and empty recommendations array'
    );
  } catch (err: any) {
    assert(false, 'Missing parameters test threw exception', err.message);
  }

  // Test 2.2: Blank whitespace parameters (400)
  try {
    const req = createMockRequest({ title: '   ', artist: '   ' });
    const res = await getRecommendations(req);
    assert(res.status === 400, 'Blank whitespace parameters return HTTP 400', `Got status ${res.status}`);
  } catch (err: any) {
    assert(false, 'Blank parameters test threw exception', err.message);
  }

  // Test 2.3: Only title parameter
  try {
    const req = createMockRequest({ title: 'Tarkan' });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 200, 'Title-only query returns HTTP 200', `Got status ${res.status}`);
    assert(
      Array.isArray(json.recommendations) && json.recommendations.length > 0,
      'Title-only query returns recommendations list',
      `Count: ${json.recommendations?.length}`
    );
  } catch (err: any) {
    assert(false, 'Title-only query test threw exception', err.message);
  }

  // Test 2.4: Combined "Artist - Title" in title parameter
  try {
    const req = createMockRequest({ title: 'Sezen Aksu - Sen Ağlama' });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 200, 'Combined "Artist - Title" query returns HTTP 200');
    assert(
      Array.isArray(json.recommendations) && json.recommendations.length > 0,
      'Combined query returns recommendations',
      `Count: ${json.recommendations?.length}`
    );
  } catch (err: any) {
    assert(false, 'Combined query test threw exception', err.message);
  }

  // Test 2.5: Special characters and metadata noise in title/artist
  try {
    const req = createMockRequest({
      title: 'Şımarık (Official Video) [4K Remastered] #1',
      artist: 'Tarkan VEVO',
    });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 200, 'Metadata noise query returns HTTP 200');
    assert(
      Array.isArray(json.recommendations) && json.recommendations.length > 0,
      'Metadata noise query yields valid recommendations',
      `Count: ${json.recommendations?.length}`
    );
  } catch (err: any) {
    assert(false, 'Metadata noise query test threw exception', err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 3: Fallback mechanics (Invalid / Missing Last.fm Key)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: Fallback Mechanics & Invalid Keys ---');

  const origKey = process.env.LASTFM_API_KEY;

  // Test 3.1: Invalid Last.fm API Key -> Fallback to YouTube
  try {
    process.env.LASTFM_API_KEY = 'invalid_dummy_key_123456789';
    const req = createMockRequest({ title: 'Şımartık', artist: 'Tarkan' });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(
      res.status === 200,
      'Invalid Last.fm API key gracefully handles error and returns HTTP 200'
    );
    assert(
      Array.isArray(json.recommendations) && json.recommendations.length > 0,
      'Invalid Last.fm API key falls back to YouTube search and returns recommendations',
      `Count: ${json.recommendations?.length}`
    );
  } catch (err: any) {
    assert(false, 'Invalid Last.fm API key test threw exception', err.message);
  }

  // Test 3.2: Missing Last.fm API Key -> Direct Fallback
  try {
    delete process.env.LASTFM_API_KEY;
    const req = createMockRequest({ title: 'Gülümse', artist: 'Sezen Aksu' });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 200, 'Missing LASTFM_API_KEY returns HTTP 200');
    assert(
      Array.isArray(json.recommendations) && json.recommendations.length > 0,
      'Missing LASTFM_API_KEY falls back to YouTube search and returns recommendations',
      `Count: ${json.recommendations?.length}`
    );
  } catch (err: any) {
    assert(false, 'Missing LASTFM_API_KEY test threw exception', err.message);
  } finally {
    // Restore original key
    if (origKey !== undefined) {
      process.env.LASTFM_API_KEY = origKey;
    }
  }

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
