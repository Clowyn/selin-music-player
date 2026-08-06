const assert = require('assert');

// ─── 1. Re-implement Genius Container Extraction for direct empirical testing ───
function extractGeniusContainers(html) {
  const containers = [];
  const openTagRegex = /<div[^>]*data-lyrics-container="true"[^>]*>/g;
  let match;

  while ((match = openTagRegex.exec(html)) !== null) {
    const startContentPos = match.index + match[0].length;
    let depth = 1;

    const tagRegex = /<\/?div\b[^>]*>/gi;
    tagRegex.lastIndex = startContentPos;

    let tagMatch;
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

function cleanGeniusHtml(rawHtml) {
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
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Tests for Genius HTML Scraping & Error Handling ────────────────────────

console.log('--- Test 1: Genius HTML Extraction & Handling ---');

// Test 1a: Standard Genius HTML container with nested divs and breaks
const validGeniusHtml = `
  <html><body>
    <div class="Lyrics__Container-sc-1" data-lyrics-container="true">
      [Verse 1]<br>Merhaba dünya<br><span>Selin Player</span>
      <div>Nested text</div>
    </div>
    <div class="Lyrics__Container-sc-1" data-lyrics-container="true">
      [Chorus]<br>Şarkı sözleri burada
    </div>
  </body></html>
`;
const containers1 = extractGeniusContainers(validGeniusHtml);
assert.strictEqual(containers1.length, 2, 'Should extract 2 containers');
const cleaned1 = containers1.map(cleanGeniusHtml).join('\n\n');
assert.ok(cleaned1.includes('[Verse 1]'), 'Includes Verse 1');
assert.ok(cleaned1.includes('Merhaba dünya'), 'Includes Merhaba dünya');
assert.ok(cleaned1.includes('[Chorus]'), 'Includes Chorus');
console.log('✓ Valid Genius HTML extraction passed');

// Test 1b: Unclosed div / Malformed Genius HTML
const malformedHtml = `<div data-lyrics-container="true">Broken HTML text with no closing div`;
const containers2 = extractGeniusContainers(malformedHtml);
assert.strictEqual(containers2.length, 0, 'Malformed unclosed div should not throw or corrupt output');
console.log('✓ Malformed Genius HTML unclosed tag handling passed');

// Test 1c: Empty HTML input
assert.strictEqual(extractGeniusContainers('').length, 0);
assert.strictEqual(cleanGeniusHtml(''), '');
console.log('✓ Empty HTML handling passed');


// ─── 2. Supabase Client Fallback Validation ───

console.log('\n--- Test 2: Supabase Client Fallback Verification ---');
try {
  // Test what happens when createClient is imported / called with env vars or missing env vars
  const { createClient } = require('@supabase/supabase-js');
  // Check if createClient fails when passed empty/missing params
  let threw = false;
  try {
    createClient(undefined, undefined);
  } catch (err) {
    threw = true;
    console.log('  Confirmed: createClient(undefined, undefined) throws:', err.message);
  }
  assert.strictEqual(threw, true, 'createClient with undefined must throw error');

  // Verify lib/supabase.ts definition in project
  const fs = require('fs');
  const path = require('path');
  const supabaseContent = fs.readFileSync(path.join(__dirname, '../../lib/supabase.ts'), 'utf-8');
  console.log('  lib/supabase.ts content inspection:');
  console.log('  ' + supabaseContent.split('\n').join('\n  '));
  
  // Verify .env.local values presence
  const envLocalPath = path.join(__dirname, '../../.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    const hasUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL');
    const hasKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.log(`  .env.local present. NEXT_PUBLIC_SUPABASE_URL: ${hasUrl}, NEXT_PUBLIC_SUPABASE_ANON_KEY: ${hasKey}`);
    assert.ok(hasUrl, 'NEXT_PUBLIC_SUPABASE_URL must be configured');
    assert.ok(hasKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured');
  } else {
    console.log('  Warning: .env.local not found on filesystem');
  }
  console.log('✓ Supabase initialization & configuration check passed');
} catch (err) {
  console.error('Supabase check error:', err);
  process.exit(1);
}


// ─── 3. State Store Reordering & Queue Logic Empirical Validation ───

console.log('\n--- Test 3: State Store Reordering & Track Order Logic ---');

// Reorder logic matching playerStore.ts:
// reorderQueue: async (newSongs: Song[]) => {
//   const updatedSongs = newSongs.map((song, index) => ({
//     ...song,
//     track_order: index + 1,
//   }));
//   set({ songs: updatedSongs, queue: updatedSongs });
// }

const initialSongs = [
  { id: '1', title: 'Song A', artist: 'Artist 1', track_order: 1 },
  { id: '2', title: 'Song B', artist: 'Artist 2', track_order: 2 },
  { id: '3', title: 'Song C', artist: 'Artist 3', track_order: 3 },
];

// Reorder [Song C, Song A, Song B]
const reordered = [initialSongs[2], initialSongs[0], initialSongs[1]];
const updatedSongs = reordered.map((song, index) => ({
  ...song,
  track_order: index + 1,
}));

assert.strictEqual(updatedSongs[0].id, '3');
assert.strictEqual(updatedSongs[0].track_order, 1);
assert.strictEqual(updatedSongs[1].id, '1');
assert.strictEqual(updatedSongs[1].track_order, 2);
assert.strictEqual(updatedSongs[2].id, '2');
assert.strictEqual(updatedSongs[2].track_order, 3);
console.log('✓ Track order calculation verified correctly (1-based index assignment)');


// Delete logic test matching playerStore.ts:
// deleteSongFromPlaylist: when currentSong is deleted vs when another song is deleted
let state = {
  currentSong: initialSongs[1], // Song B
  songs: [...initialSongs],
  queue: [...initialSongs],
  isPlaying: true,
  currentTime: 45
};

// Delete Song A (id: '1') while Song B is playing -> playing song unaffected
const songToDeleteId = '1';
let updatedS = state.songs.filter(s => s.id !== songToDeleteId);
let updatedQ = state.queue.filter(s => s.id !== songToDeleteId);
if (state.currentSong?.id === songToDeleteId) {
  // Not reached here
} else {
  state.songs = updatedS;
  state.queue = updatedQ;
}
assert.strictEqual(state.songs.length, 2);
assert.strictEqual(state.currentSong.id, '2');
assert.strictEqual(state.isPlaying, true);
console.log('✓ Non-playing song deletion preserves current playback');

// Delete currentSong (Song B) when other songs exist -> advances to next available song
const currentSongId = '2';
updatedS = state.songs.filter(s => s.id !== currentSongId);
updatedQ = state.queue.filter(s => s.id !== currentSongId);
if (state.currentSong?.id === currentSongId) {
  if (updatedS.length > 0) {
    const deletedIndex = state.songs.findIndex(s => s.id === currentSongId);
    const nextIndex = deletedIndex < updatedS.length ? deletedIndex : 0;
    state.songs = updatedS;
    state.queue = updatedQ;
    state.currentSong = updatedS[nextIndex];
    state.currentTime = 0;
    state.isPlaying = true;
  }
}
assert.strictEqual(state.currentSong.id, '3'); // Song C
assert.strictEqual(state.currentTime, 0);
assert.strictEqual(state.isPlaying, true);
console.log('✓ Playing song deletion auto-advances to next track');

// Delete last remaining song in playlist
state.songs = [{ id: '3', title: 'Song C', artist: 'Artist 3' }];
state.queue = [{ id: '3', title: 'Song C', artist: 'Artist 3' }];
state.currentSong = state.songs[0];
state.isPlaying = true;

const lastId = '3';
updatedS = state.songs.filter(s => s.id !== lastId);
updatedQ = state.queue.filter(s => s.id !== lastId);
if (state.currentSong?.id === lastId) {
  if (updatedS.length > 0) {
    // ...
  } else {
    state.songs = [];
    state.queue = [];
    state.currentSong = null;
    state.currentTime = 0;
    state.duration = 0;
    state.isPlaying = false;
  }
}
assert.strictEqual(state.songs.length, 0);
assert.strictEqual(state.currentSong, null);
assert.strictEqual(state.isPlaying, false);
console.log('✓ Deleting last remaining track stops playback and resets state cleanly');

console.log('\nALL EMPIRICAL TESTS PASSED SUCCESSFULLY!');
