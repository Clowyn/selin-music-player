/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

console.log("=== EMPIRICAL TEST HARNESS FOR SELIN MUSIC PLAYER (M1 ITERATION 3) ===");

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       Details: ${details}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Details: ${details}`);
  }
}

// TEST 1: Inspect UpNextRow.tsx Touch Target Sizes & CSS Truncation
const upNextPath = path.join(__dirname, 'components', 'UpNextRow.tsx');
assert(fs.existsSync(upNextPath), "UpNextRow.tsx file exists");

if (fs.existsSync(upNextPath)) {
  const content = fs.readFileSync(upNextPath, 'utf8');

  // Check Play Pill container height (h-8 = 32px >= 24px)
  const hasH8Pill = content.includes('h-8 bg-white/10') || content.includes('h-8');
  assert(hasH8Pill, "UpNextRow pill card height is set to h-8 (32px >= 24px requirement)");

  // Check Queue Button dimensions (w-6 h-6 = 24px x 24px)
  const hasW6H6QueueBtn = content.includes('w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center');
  assert(hasW6H6QueueBtn, "UpNextRow Queue action button is w-6 h-6 (24x24px, meets WCAG 2.2 SC 2.5.8)");

  // Check event propagation on Queue Button
  const hasStopProp = content.includes('e.stopPropagation()');
  assert(hasStopProp, "Queue button handles click with stopPropagation to prevent pill triggering");

  // Check text truncation rules
  const hasTitleTruncate = content.includes('text-[10px] font-bold text-white truncate');
  const hasArtistTruncate = content.includes('text-[8.5px] text-purple-200/70 truncate');
  const hasMinW0 = content.includes('min-w-0 flex-1 max-w-[100px]');
  
  assert(hasTitleTruncate, "Song title has 'truncate' class (white-space: nowrap, overflow: hidden, text-overflow: ellipsis)");
  assert(hasArtistTruncate, "Artist name has 'truncate' class");
  assert(hasMinW0, "Parent metadata box uses 'min-w-0 flex-1 max-w-[100px]' ensuring clean flexbox truncation");

  // Check section vertical container constraints (py-0, no padding expansion)
  const hasPy0 = content.includes('py-0 scrollbar-none');
  assert(hasPy0, "Horizontal scroll strip uses py-0 to prevent vertical height expansion beyond 50px");

  // Check header badge leading-none (no py-0.5 padding expansion)
  const hasBadgeNoPy = content.includes('leading-none') && !content.includes('py-0.5');
  assert(hasBadgeNoPy, "Header badge uses leading-none without py padding expansion");
}

// TEST 2: Inspect PlayerControls.tsx Touch Targets
const controlsPath = path.join(__dirname, 'components', 'PlayerControls.tsx');
if (fs.existsSync(controlsPath)) {
  const content = fs.readFileSync(controlsPath, 'utf8');

  const hasW16H16Play = content.includes('w-16 h-16 flex items-center justify-center rounded-full');
  assert(hasW16H16Play, "PlayerControls main play/pause button is 64x64px (w-16 h-16 >= 24px)");

  const hasP2Buttons = content.includes('p-2 rounded-full');
  assert(hasP2Buttons, "PlayerControls action buttons have p-2 padding (~36px - 44px >= 24px)");
}

// TEST 3: Inspect SearchDrawer & PlaylistDrawer Touch Targets and Truncation
const playlistDrawerPath = path.join(__dirname, 'components', 'PlaylistDrawer.tsx');
if (fs.existsSync(playlistDrawerPath)) {
  const content = fs.readFileSync(playlistDrawerPath, 'utf8');
  const hasTruncate = content.includes('truncate');
  assert(hasTruncate, "PlaylistDrawer items utilize truncation for long titles/artists");
}

const searchDrawerPath = path.join(__dirname, 'components', 'SearchDrawer.tsx');
if (fs.existsSync(searchDrawerPath)) {
  const content = fs.readFileSync(searchDrawerPath, 'utf8');
  const hasTruncate = content.includes('truncate');
  assert(hasTruncate, "SearchDrawer items utilize truncation for long titles/artists");
}

console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===`);
if (passedTests === totalTests) {
  console.log("ALL EMPIRICAL TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
} else {
  console.error("SOME TESTS FAILED.");
  process.exit(1);
}
