import {
  cleanTitle,
  cleanArtist,
  sanitizeInputs,
  parseLrc,
  GET as getLyrics,
} from '../app/api/lyrics/route';

function createMockRequest(queryParams: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/lyrics');
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

async function runAdversarialLyricsTests() {
  console.log('==================================================');
  console.log('STARTING ADVERSARIAL & EDGE-CASE TESTS FOR LYRICS');
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

  function assertEqual(actual: any, expected: any, testName: string) {
    if (actual === expected) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - Expected: "${expected}", Got: "${actual}"`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // ADV-1: Hyphen in Artist Name vs Title Hyphens
  // ----------------------------------------------------
  console.log('--- ADV-1: Hyphen in Artist Name vs Title Hyphens ---');

  // Test Jay-Z (hyphen without spaces)
  let resAdv1 = sanitizeInputs('Jay-Z - Empire State of Mind (Official Video)', 'Poll Production');
  assertEqual(resAdv1.artist, 'Jay-Z', 'ADV-1.1: Jay-Z preserved when split from generic channel');
  assertEqual(resAdv1.title, 'Empire State of Mind', 'ADV-1.1: Title cleaned properly');

  // Test AC/DC or hyphenated artist
  let resAdv2 = sanitizeInputs('AC/DC - Back in Black [HD]', 'youtube');
  assertEqual(resAdv2.artist, 'AC/DC', 'ADV-1.2: AC/DC preserved when split from youtube channel');
  assertEqual(resAdv2.title, 'Back in Black', 'ADV-1.2: Title cleaned properly');

  // ----------------------------------------------------
  // ADV-2: Song titles containing metadata keywords (e.g. Video, Live)
  // ----------------------------------------------------
  console.log('\n--- ADV-2: Song Titles Containing Metadata Keywords ---');

  assertEqual(
    cleanTitle('Video Killed the Radio Star'),
    'Video Killed the Radio Star',
    'ADV-2.1: "Video" in song title preserved when not in parens/brackets'
  );

  assertEqual(
    cleanTitle('Live Is Life'),
    'Live Is Life',
    'ADV-2.2: "Live" in song title preserved when not in parens/brackets'
  );

  assertEqual(
    cleanTitle('Live at Wembley (Official Video)'),
    'Live at Wembley',
    'ADV-2.3: "Live" preserved in title, "(Official Video)" removed'
  );

  // ----------------------------------------------------
  // ADV-3: Payload Injection & Extreme Inputs
  // ----------------------------------------------------
  console.log('\n--- ADV-3: Payload Injections & Extreme Characters ---');

  const xssTitle = '<script>alert("xss")</script> - Test Track (Official Video)';
  const resXss = sanitizeInputs(xssTitle, 'netd müzik');
  assert(resXss.artist === '<script>alert("xss")</script>', 'ADV-3.1: XSS payload handled without crashing');
  assert(resXss.title === 'Test Track', 'ADV-3.1: XSS title metadata cleaned');

  const longInput = 'A'.repeat(5000) + ' - ' + 'B'.repeat(5000) + ' (Official Video)';
  const resLong = sanitizeInputs(longInput, 'Pasaj Müzik');
  assert(resLong.artist.length === 5000, 'ADV-3.2: 5000-char artist handled cleanly');
  assert(resLong.title.length === 5000, 'ADV-3.2: 5000-char title handled cleanly');

  // ----------------------------------------------------
  // ADV-4: API Route Security & Robustness
  // ----------------------------------------------------
  console.log('\n--- ADV-4: API Route Robustness under Unusual Requests ---');

  try {
    const req = createMockRequest({ title: '   ', artist: '   ' });
    const res = await getLyrics(req);
    assert(res.status === 400, 'ADV-4.1: Whitespace-only parameters return 400');
  } catch (err: any) {
    assert(false, 'ADV-4.1 threw exception', err.message);
  }

  try {
    const req = createMockRequest({ title: '🎵🎶 祝你生日快乐', artist: '🎉' });
    // Mock global fetch to respond instantly with 404 to avoid 20s external API timeouts
    const origFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    const res = await getLyrics(req);
    global.fetch = origFetch;
    assert(res.status === 404 || res.status === 200, 'ADV-4.2: Emoji & CJK input returns valid status code');
  } catch (err: any) {
    assert(false, 'ADV-4.2 threw exception', err.message);
  }

  // ----------------------------------------------------
  // ADV-5: LRC Parsing Stress & Malformed Header Inputs
  // ----------------------------------------------------
  console.log('\n--- ADV-5: Malformed LRC Parsing Stress ---');

  const malformedLrc = `
[invalid header]
[00:05] Line 1 with 2-digit sec
[01:10.5] Line 2 with 1-digit frac
[02:15.123] Line 3 with 3-digit frac
[99:99.99] Extreme time tag
Plain text without timestamp
`;

  const parsedMal = parseLrc(malformedLrc);
  assert(parsedMal.length === 4, 'ADV-5.1: Malformed LRC correctly extracts valid timestamps and ignores non-timestamp lines');
  assert(parsedMal[0].time === 5, 'ADV-5.1: [00:05] parsed as 5 seconds');
  assert(parsedMal[1].time === 70.5, 'ADV-5.1: [01:10.5] parsed as 70.5 seconds');
  assert(parsedMal[2].time === 135.123, 'ADV-5.1: [02:15.123] parsed as 135.123 seconds');
  assert(parsedMal[3].time === 6039.99, 'ADV-5.1: [99:99.99] parsed as 6039.99 seconds');

  console.log('\n==================================================');
  console.log(`ADVERSARIAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialLyricsTests();
