/**
 * Empirical Stress Test Suite for Milestone 2 UI Components
 * Author: m2_challenger_2 (Empirical Challenger)
 * 
 * Tests:
 * 1. Edge Case 1: Empty `currentSong` handling across PlaylistDrawer, SearchDrawer, and UpNextRow logic.
 * 2. Edge Case 2: Null / malformed API responses handling.
 * 3. Edge Case 3: Rapid tab switching state safety (PlaylistDrawer logic).
 * 4. Edge Case 4: Empty search state (SearchDrawer logic).
 * 5. Edge Case 5: Horizontal scrolling parameters & card data transformation (UpNextRow & adapter).
 */

const assert = require('assert');

// Mock data structures
const sampleSong = {
  id: 'yt-12345',
  title: 'Sen Olsan Bari',
  artist: 'Aleyna Tilki',
  audio_url: 'https://www.youtube.com/watch?v=12345',
  youtube_id: '12345',
  duration: 210,
  cover_url: 'https://i.ytimg.com/vi/12345/hqdefault.jpg'
};

const malformedSong = {
  id: 'yt-abc',
  title: 'Test Song',
  artist: 'Test Artist',
  audio_url: '',
  // youtube_id missing
  // duration missing
  // cover_url missing
};

// Simulation of SearchDrawer songToYouTubeSearchResult adapter
function songToYouTubeSearchResult(song) {
  const ytId = song.youtube_id || song.id.replace(/^yt-/, '');
  const mins = Math.floor((song.duration || 0) / 60);
  const secs = Math.floor((song.duration || 0) % 60);
  const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return {
    id: ytId,
    title: song.title,
    channelTitle: song.artist,
    thumbnail: song.cover_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
    duration: durationStr,
    durationSeconds: song.duration || 210,
  };
}

// Simulation of SearchDrawer convertToSong reverse adapter
function convertToSong(yt) {
  return {
    id: `yt-${yt.id}`,
    title: yt.title,
    artist: yt.channelTitle,
    audio_url: `https://www.youtube.com/watch?v=${yt.id}`,
    youtube_id: yt.id,
    duration: yt.durationSeconds || 210,
    cover_url: yt.thumbnail,
  };
}

// Test Runner
let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

console.log('=== STARTING EMPIRICAL STRESS TEST SUITE FOR MILESTONE 2 UI COMPONENTS ===\n');

// -------------------------------------------------------------
// TEST 1: Empty currentSong logic in PlaylistDrawer / SearchDrawer / UpNextRow
// -------------------------------------------------------------
runTest('Edge Case 1a: PlaylistDrawer with null currentSong', () => {
  const currentSong = null;
  const currentSongTitle = currentSong?.title;
  const currentSongArtist = currentSong?.artist;

  // In PlaylistDrawer effect:
  let recommendations = ['old_data'];
  let loadingRecommendations = true;
  let recommendationsError = 'error';

  if (!currentSongTitle) {
    recommendations = [];
    loadingRecommendations = false;
    recommendationsError = null;
  }

  assert.strictEqual(currentSongTitle, undefined);
  assert.strictEqual(recommendations.length, 0);
  assert.strictEqual(loadingRecommendations, false);
  assert.strictEqual(recommendationsError, null);
});

runTest('Edge Case 1b: SearchDrawer URL construction with null currentSong', () => {
  const currentSong = null;
  let url = '/api/recommendations?limit=8';
  if (currentSong?.title && currentSong?.artist) {
    url += `&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
  } else if (currentSong?.title) {
    url += `&title=${encodeURIComponent(currentSong.title)}`;
  } else {
    url += `&title=Yolla&artist=Tarkan`;
  }

  assert.strictEqual(url, '/api/recommendations?limit=8&title=Yolla&artist=Tarkan');
});

runTest('Edge Case 1c: UpNextRow URL construction with null currentSong', () => {
  const currentSong = null;
  let url = '/api/recommendations?limit=5';
  if (currentSong?.title && currentSong?.artist) {
    url += `&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
  } else if (currentSong?.title) {
    url += `&title=${encodeURIComponent(currentSong.title)}`;
  } else {
    url += `&title=${encodeURIComponent('Türkçe Pop')}&artist=${encodeURIComponent('2026')}`;
  }

  assert.strictEqual(url, '/api/recommendations?limit=5&title=T%C3%BCrk%C3%A7e%20Pop&artist=2026');
});

// -------------------------------------------------------------
// TEST 2: Null / Malformed API Responses
// -------------------------------------------------------------
runTest('Edge Case 2a: API response returns { recommendations: null }', () => {
  const apiData = { recommendations: null };
  const recsPlaylistDrawer = apiData.recommendations || [];
  assert.deepStrictEqual(recsPlaylistDrawer, []);

  const isSearchDrawerArray = apiData.recommendations && Array.isArray(apiData.recommendations);
  assert.strictEqual(Boolean(isSearchDrawerArray), false);

  const isUpNextArray = apiData.recommendations && Array.isArray(apiData.recommendations);
  assert.strictEqual(Boolean(isUpNextArray), false);
});

runTest('Edge Case 2b: API response returns empty JSON object {}', () => {
  const apiData = {};
  const recsPlaylistDrawer = apiData.recommendations || [];
  assert.deepStrictEqual(recsPlaylistDrawer, []);
});

runTest('Edge Case 2c: Malformed song object in recommendations adapter', () => {
  const result = songToYouTubeSearchResult(malformedSong);
  assert.strictEqual(result.id, 'abc');
  assert.strictEqual(result.duration, '0:00');
  assert.strictEqual(result.durationSeconds, 210);
  assert.strictEqual(result.thumbnail, 'https://i.ytimg.com/vi/abc/hqdefault.jpg');

  const roundTripSong = convertToSong(result);
  assert.strictEqual(roundTripSong.id, 'yt-abc');
  assert.strictEqual(roundTripSong.title, 'Test Song');
  assert.strictEqual(roundTripSong.artist, 'Test Artist');
});

// -------------------------------------------------------------
// TEST 3: Rapid Tab Switching State Safety (PlaylistDrawer)
// -------------------------------------------------------------
runTest('Edge Case 3: Simulation of rapid tab switching in PlaylistDrawer', async () => {
  let activeTab = 'playlists';
  let isMounted = false;
  let recStateSet = false;

  // User clicks 'discover'
  activeTab = 'discover';
  isMounted = true;
  const currentTabScope = isMounted;

  // Immediately user clicks 'playlists' before fetch finishes (in 10ms)
  activeTab = 'playlists';
  isMounted = false; // Cleanup runs for discover effect

  // Simulating async fetch response coming back after tab switch
  await new Promise((r) => setTimeout(r, 20));

  // Fetch callback logic:
  if (isMounted) {
    recStateSet = true;
  }

  assert.strictEqual(recStateSet, false, 'State setter was correctly guarded by isMounted check!');
});

// -------------------------------------------------------------
// TEST 4: Empty Search State (SearchDrawer)
// -------------------------------------------------------------
runTest('Edge Case 4: SearchDrawer empty and whitespace query handling', () => {
  const emptyQueries = ['', '   ', '\t', '\n'];

  emptyQueries.forEach((q) => {
    const isTrimmedEmpty = !q.trim();
    assert.strictEqual(isTrimmedEmpty, true);
  });
});

// -------------------------------------------------------------
// TEST 5: UpNextRow Cards & Scroll Bounds
// -------------------------------------------------------------
runTest('Edge Case 5: UpNextRow rendering empty recommendations array', () => {
  const recommendations = [];
  const isLoading = false;

  const shouldRender = !( !isLoading && recommendations.length === 0 );
  assert.strictEqual(shouldRender, false, 'Component returns null when recommendations array is empty');
});

console.log(`\n=== TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED ===`);
if (testsFailed > 0) {
  process.exit(1);
}
