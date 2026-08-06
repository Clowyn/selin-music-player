import { usePlayerStore } from '../../store/playerStore';
import { Song, Playlist } from '../../lib/types';

// Global mocks for DOM elements if running in Node environment
if (typeof global.document === 'undefined') {
  const mockAudio = {
    pause: () => {},
    play: async () => {},
    currentTime: 0,
    src: '',
  };
  (global as any).document = {
    getElementById: (id: string) => {
      if (id === 'player-audio') return mockAudio;
      return null;
    },
  };
}

if (typeof global.window === 'undefined') {
  (global as any).window = {
    ytPlayer: {
      seekTo: () => {},
      playVideo: () => {},
      pauseVideo: () => {},
    },
  };
}

// Sample test data
const s1: Song = { id: 'song-1', title: 'Song 1', artist: 'Artist 1', audio_url: 'http://example.com/1.mp3', duration: 180, track_order: 1 };
const s2: Song = { id: 'song-2', title: 'Song 2', artist: 'Artist 2', audio_url: 'http://example.com/2.mp3', duration: 200, track_order: 2 };
const s3: Song = { id: 'song-3', title: 'Song 3', artist: 'Artist 3', audio_url: 'http://example.com/3.mp3', duration: 220, track_order: 3 };
const playlist: Playlist = { id: 'pl-1', name: 'Favori Şarkılar', mood_description: 'Pop', cover_url: null, created_at: '2026-01-01' };

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('  EMPIRICAL TEST SUITE: QUEUE & PLAYLIST EDITING');
  console.log('==================================================\n');

  // Test 1: Track Reordering while Playback Active
  console.log('--- TEST GROUP 1: Track Reordering during Playback ---');
  const store = usePlayerStore.getState();
  
  // Setup initial queue [s1, s2, s3] and start playing s2
  store.setSongs([s1, s2, s3]);
  store.setCurrentSong(s2);
  store.play();

  assert(usePlayerStore.getState().isPlaying === true, 'Playback is active on s2');
  assert(usePlayerStore.getState().currentSong?.id === 'song-2', 'Current song is s2');

  // Reorder queue to [s3, s2, s1]
  await usePlayerStore.getState().reorderQueue([s3, s2, s1]);

  const stateAfterReorder = usePlayerStore.getState();
  assert(stateAfterReorder.isPlaying === true, 'Playback continues uninterrupted after reorder');
  assert(stateAfterReorder.currentSong?.id === 'song-2', 'Active song pointer (s2) remains unchanged during reorder');
  assert(stateAfterReorder.songs[0].id === 'song-3' && stateAfterReorder.songs[0].track_order === 1, 'Track 1 in store is s3 with track_order 1');
  assert(stateAfterReorder.songs[1].id === 'song-2' && stateAfterReorder.songs[1].track_order === 2, 'Track 2 in store is s2 with track_order 2');
  assert(stateAfterReorder.songs[2].id === 'song-1' && stateAfterReorder.songs[2].track_order === 3, 'Track 3 in store is s1 with track_order 3');

  // Test nextSong navigation following reordered queue
  usePlayerStore.getState().nextSong();
  const stateAfterNext = usePlayerStore.getState();
  assert(stateAfterNext.currentSong?.id === 'song-1', 'nextSong() correctly advances to s1 following the new reordered sequence');
  assert(stateAfterNext.isPlaying === true, 'Playback remains active after advancing to next track in reordered queue');

  console.log('');

  // Test 2: Deleting Songs and Last Song Deletion Edge Cases
  console.log('--- TEST GROUP 2: Track Deletion & Last Song In Queue ---');

  // Scenario 2A: Deleting active song when it is the last song in queue
  store.setSongs([s1, s2, s3]);
  store.setCurrentSong(s3); // s3 is last song (index 2)
  store.play();

  assert(usePlayerStore.getState().currentSong?.id === 'song-3', 'Active song is s3 (last song in 3-song queue)');

  await usePlayerStore.getState().deleteSongFromPlaylist('song-3');
  const stateAfterDeleteActiveLast = usePlayerStore.getState();

  assert(stateAfterDeleteActiveLast.songs.length === 2, 'Queue length reduced to 2');
  assert(!stateAfterDeleteActiveLast.songs.some(s => s.id === 'song-3'), 's3 removed from queue');
  assert(stateAfterDeleteActiveLast.currentSong !== null, 'Player updated active song gracefully');
  assert(stateAfterDeleteActiveLast.isPlaying === true, 'Player continues playback with remaining songs');

  // Scenario 2B: Deleting non-active last song in queue
  store.setSongs([s1, s2, s3]);
  store.setCurrentSong(s1); // s1 is active
  store.play();

  await usePlayerStore.getState().deleteSongFromPlaylist('song-3'); // delete s3 (last song)
  const stateAfterDeleteNonActiveLast = usePlayerStore.getState();

  assert(stateAfterDeleteNonActiveLast.songs.length === 2, 'Queue length reduced to 2');
  assert(stateAfterDeleteNonActiveLast.currentSong?.id === 'song-1', 'Active song s1 unchanged');
  
  // Advance through remaining queue
  stateAfterDeleteNonActiveLast.nextSong(); // Advances s1 -> s2
  assert(usePlayerStore.getState().currentSong?.id === 'song-2', 'Advances to s2');
  
  usePlayerStore.getState().nextSong(); // At end of queue (s2 was last remaining song)
  assert(usePlayerStore.getState().isPlaying === false, 'Player stops gracefully at end of queue without errors');

  // Scenario 2C: Deleting the ONLY song in a 1-song queue
  store.setSongs([s1]);
  store.setCurrentSong(s1);
  store.play();

  await usePlayerStore.getState().deleteSongFromPlaylist('song-1');
  const stateAfterDeleteOnlySong = usePlayerStore.getState();

  assert(stateAfterDeleteOnlySong.songs.length === 0, 'Queue is empty (0 songs)');
  assert(stateAfterDeleteOnlySong.queue.length === 0, 'Queue array is empty');
  assert(stateAfterDeleteOnlySong.currentSong === null, 'currentSong reset to null');
  assert(stateAfterDeleteOnlySong.isPlaying === false, 'isPlaying reset to false');
  assert(stateAfterDeleteOnlySong.currentTime === 0, 'currentTime reset to 0');
  assert(stateAfterDeleteOnlySong.duration === 0, 'duration reset to 0');

  // Calling nextSong() or prevSong() on empty queue
  store.nextSong();
  assert(usePlayerStore.getState().currentSong === null && usePlayerStore.getState().isPlaying === false, 'nextSong() on empty queue executes safely');
  store.prevSong();
  assert(usePlayerStore.getState().currentSong === null && usePlayerStore.getState().isPlaying === false, 'prevSong() on empty queue executes safely');

  console.log('');

  // Test 3: Playlist Renaming & String Handling
  console.log('--- TEST GROUP 3: Playlist Renaming (Trim & Edge Cases) ---');
  
  store.setCurrentPlaylist(playlist);
  assert(usePlayerStore.getState().currentPlaylist?.name === 'Favori Şarkılar', 'Initial playlist name is set');

  // Test valid rename with whitespace
  const rawInput1 = '   Selin Favorites 2026   ';
  const trimmed1 = rawInput1.trim();
  if (trimmed1 && trimmed1 !== store.currentPlaylist?.name) {
    await store.renamePlaylist(playlist.id, trimmed1);
  }
  assert(usePlayerStore.getState().currentPlaylist?.name === 'Selin Favorites 2026', 'Whitespace trimmed and playlist renamed correctly');

  // Test empty string input handling (Simulated UI logic from QueueDrawer)
  const currentNameBeforeEmpty = usePlayerStore.getState().currentPlaylist?.name;
  const rawInputEmpty = '    ';
  const trimmedEmpty = rawInputEmpty.trim();
  if (trimmedEmpty && trimmedEmpty !== usePlayerStore.getState().currentPlaylist?.name) {
    await store.renamePlaylist(playlist.id, trimmedEmpty);
  }
  assert(usePlayerStore.getState().currentPlaylist?.name === currentNameBeforeEmpty, 'Empty / whitespace-only rename is ignored and original name preserved');

  // Test long string title
  const longName = 'A'.repeat(250);
  await store.renamePlaylist(playlist.id, longName.trim());
  assert(usePlayerStore.getState().currentPlaylist?.name.length === 250, 'Long playlist title stored successfully');

  console.log('\n==================================================');
  console.log(`  RESULTS: ${passedCount} / ${totalCount} TESTS PASSED`);
  console.log('==================================================\n');

  if (passedCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
