import {
  cleanTitle,
  cleanArtist,
  sanitizeInputs,
  parseLrc,
  RECORD_LABELS_AND_GENERIC_CHANNELS,
  GET as getLyrics,
} from '../app/api/lyrics/route';

function createMockRequest(queryParams: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/lyrics');
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

async function runLyricsEmpiricalTests() {
  console.log('==================================================');
  console.log('STARTING EMPIRICAL TESTS FOR LYRICS API ROUTE (M2)');
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
  // TEST GROUP 1: Title Metadata Cleaning Edge Cases
  // ----------------------------------------------------
  console.log('--- TEST GROUP 1: Title Metadata Cleaning Edge Cases ---');

  assertEqual(
    cleanTitle('Tarkan - Yolla (Official Music Video)'),
    'Tarkan - Yolla',
    'cleanTitle 1.1: Tarkan - Yolla (Official Music Video)'
  );

  assertEqual(
    cleanTitle('Mor ve Ötesi - Cambaz [HD]'),
    'Mor ve Ötesi - Cambaz',
    'cleanTitle 1.2: Mor ve Ötesi - Cambaz [HD]'
  );

  assertEqual(
    cleanTitle('Bir Kadın Çizeceksin (Klipsiz / Official Video)'),
    'Bir Kadın Çizeceksin',
    'cleanTitle 1.3: Bir Kadın Çizeceksin (Klipsiz / Official Video)'
  );

  assertEqual(
    cleanTitle('Şebnem Ferah - Sil Baştan (Live 4K Audio)'),
    'Şebnem Ferah - Sil Baştan',
    'cleanTitle 1.4: Parentheses with multiple keywords (Live 4K Audio)'
  );

  assertEqual(
    cleanTitle('Duman - Seni Kendime Sakladım | netd müzik'),
    'Duman - Seni Kendime Sakladım',
    'cleanTitle 1.5: Trailing pipe publisher metadata'
  );

  assertEqual(
    cleanTitle('"Manga - Bir Kadın Çizeceksin"'),
    'Manga - Bir Kadın Çizeceksin',
    'cleanTitle 1.6: Strip surrounding double quotes'
  );

  assertEqual(
    cleanTitle('  Ezhel - Felaket ( Lyric Video )  '),
    'Ezhel - Felaket',
    'cleanTitle 1.7: Spaces inside parentheses ( Lyric Video )'
  );

  assertEqual(
    cleanTitle('Semicenk & Doğu Swag - Pişman Değilim [Video Klip]'),
    'Semicenk & Doğu Swag - Pişman Değilim',
    'cleanTitle 1.8: Brackets with [Video Klip]'
  );

  assertEqual(
    cleanTitle(''),
    '',
    'cleanTitle 1.9: Empty string handled gracefully'
  );

  // ----------------------------------------------------
  // TEST GROUP 2: Artist Sanitization & Channel Name Detection
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: Artist Cleaning & Generic Channel Sanitization ---');

  assertEqual(
    cleanArtist('TarkanVEVO'),
    'Tarkan',
    'cleanArtist 2.1: Strip VEVO suffix'
  );

  assertEqual(
    cleanArtist('Sezen Aksu - Topic'),
    'Sezen Aksu',
    'cleanArtist 2.2: Strip - Topic suffix'
  );

  assertEqual(
    cleanArtist('Duman Topic'),
    'Duman',
    'cleanArtist 2.3: Strip Topic suffix'
  );

  assertEqual(
    cleanArtist('- Topic'),
    '',
    'cleanArtist 2.4: Pure "- Topic" becomes empty string'
  );

  assertEqual(
    cleanArtist('Mor ve Ötesi Official YouTube Channel'),
    'Mor ve Ötesi',
    'cleanArtist 2.5: Strip Official YouTube Channel suffix'
  );

  // ----------------------------------------------------
  // TEST GROUP 3: Combined sanitizeInputs Testing
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: Combined sanitizeInputs Testing ---');

  // Test 3.1: Artist is netd müzik, title contains "Artist - Song"
  let res31 = sanitizeInputs('Tarkan - Yolla (Official Music Video)', 'netd müzik');
  assertEqual(res31.artist, 'Tarkan', 'sanitizeInputs 3.1 artist extracted from title when rawArtist is netd müzik');
  assertEqual(res31.title, 'Yolla', 'sanitizeInputs 3.1 title cleaned when rawArtist is netd müzik');

  // Test 3.2: Artist is Poll Production, title is "Mor ve Ötesi - Cambaz [HD]"
  let res32 = sanitizeInputs('Mor ve Ötesi - Cambaz [HD]', 'Poll Production');
  assertEqual(res32.artist, 'Mor ve Ötesi', 'sanitizeInputs 3.2 artist extracted when rawArtist is Poll Production');
  assertEqual(res32.title, 'Cambaz', 'sanitizeInputs 3.2 title cleaned when rawArtist is Poll Production');

  // Test 3.3: Artist is Pasaj Müzik, title is "maNga - Bir Kadın Çizeceksin (Klipsiz / Official Video)"
  let res33 = sanitizeInputs('maNga - Bir Kadın Çizeceksin (Klipsiz / Official Video)', 'Pasaj Müzik');
  assertEqual(res33.artist, 'maNga', 'sanitizeInputs 3.3 artist extracted when rawArtist is Pasaj Müzik');
  assertEqual(res33.title, 'Bir Kadın Çizeceksin', 'sanitizeInputs 3.3 title cleaned when rawArtist is Pasaj Müzik');

  // Test 3.4: Artist is DMC
  let res34 = sanitizeInputs('Gülşen - Bangır Bangır (Official Video)', 'DMC');
  assertEqual(res34.artist, 'Gülşen', 'sanitizeInputs 3.4 artist extracted when rawArtist is DMC');
  assertEqual(res34.title, 'Bangır Bangır', 'sanitizeInputs 3.4 title cleaned when rawArtist is DMC');

  // Test 3.5: Artist is youtube
  let res35 = sanitizeInputs('Mabel Matiz - Antidepresan', 'youtube');
  assertEqual(res35.artist, 'Mabel Matiz', 'sanitizeInputs 3.5 artist extracted when rawArtist is youtube');
  assertEqual(res35.title, 'Antidepresan', 'sanitizeInputs 3.5 title cleaned when rawArtist is youtube');

  // Test 3.6: Artist is - Topic
  let res36 = sanitizeInputs('Barış Manço - Dönence', '- Topic');
  assertEqual(res36.artist, 'Barış Manço', 'sanitizeInputs 3.6 artist extracted when rawArtist is - Topic');
  assertEqual(res36.title, 'Dönence', 'sanitizeInputs 3.6 title cleaned when rawArtist is - Topic');

  // Test 3.7: Artist is valid, title also repeats "Artist - Song"
  let res37 = sanitizeInputs('Tarkan - Yolla (Official Music Video)', 'Tarkan');
  assertEqual(res37.artist, 'Tarkan', 'sanitizeInputs 3.7 valid artist preserved');
  assertEqual(res37.title, 'Yolla', 'sanitizeInputs 3.7 redundant artist prefix stripped from title');

  // Test 3.8: Pure publisher artist with title having no dash
  let res38 = sanitizeInputs('Bir Kadın Çizeceksin (Official Video)', 'Pasaj Müzik');
  assertEqual(res38.artist, '', 'sanitizeInputs 3.8 pure publisher cleared when title has no dash');
  assertEqual(res38.title, 'Bir Kadın Çizeceksin', 'sanitizeInputs 3.8 title cleaned');

  // ----------------------------------------------------
  // TEST GROUP 4: parseLrc Function Validation
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4: parseLrc Function Edge Cases ---');

  const lrcSample = `
[ar: Tarkan]
[ti: Yolla]
[al: 10]
[00:12.34] Düştüm yine yollara
[00:15.50][01:20.00] Dertleri yolla
[00:20.100] Kor gibi yandım
  `;

  const parsed = parseLrc(lrcSample);
  assert(parsed.length === 4, 'parseLrc parses correct number of timestamps (including multi-timestamp lines)');
  assert(parsed[0].time === 12.34 && parsed[0].text === 'Düştüm yine yollara', 'parseLrc timestamp 1 parsed correctly');
  assert(parsed[1].time === 15.50 && parsed[1].text === 'Dertleri yolla', 'parseLrc multi-timestamp line 1 parsed');
  assert(parsed[2].time === 20.10 && parsed[2].text === 'Kor gibi yandım', 'parseLrc timestamp 3 parsed');
  assert(parsed[3].time === 80.00 && parsed[3].text === 'Dertleri yolla', 'parseLrc multi-timestamp line 2 parsed and sorted in time order');

  const emptyLrc = parseLrc('');
  assert(Array.isArray(emptyLrc) && emptyLrc.length === 0, 'parseLrc("") returns empty array');

  // ----------------------------------------------------
  // TEST GROUP 4B: Adversarial Edge Cases & Stress Scenarios
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4B: Adversarial Edge Cases & Stress Scenarios ---');

  // ADV-1: Hyphen in Artist Name vs Title Hyphens
  let resAdv1 = sanitizeInputs('Jay-Z - Empire State of Mind (Official Video)', 'Poll Production');
  assertEqual(resAdv1.artist, 'Jay-Z', 'ADV-1.1: Jay-Z preserved when split from generic channel');
  assertEqual(resAdv1.title, 'Empire State of Mind', 'ADV-1.1: Title cleaned properly');

  let resAdv2 = sanitizeInputs('AC/DC - Back in Black [HD]', 'youtube');
  assertEqual(resAdv2.artist, 'AC/DC', 'ADV-1.2: AC/DC preserved when split from youtube channel');
  assertEqual(resAdv2.title, 'Back in Black', 'ADV-1.2: Title cleaned properly');

  // ADV-2: Song titles containing metadata keywords (e.g. Video, Live)
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

  // ADV-3: Payload Injection & Extreme Inputs
  const xssTitle = '<script>alert("xss")</script> - Test Track (Official Video)';
  const resXss = sanitizeInputs(xssTitle, 'netd müzik');
  assert(resXss.artist === '<script>alert("xss")</script>', 'ADV-3.1: XSS payload handled without crashing');
  assert(resXss.title === 'Test Track', 'ADV-3.1: XSS title metadata cleaned');

  const longInput = 'A'.repeat(5000) + ' - ' + 'B'.repeat(5000) + ' (Official Video)';
  const resLong = sanitizeInputs(longInput, 'Pasaj Müzik');
  assert(resLong.artist.length === 5000, 'ADV-3.2: 5000-char artist handled cleanly');
  assert(resLong.title.length === 5000, 'ADV-3.2: 5000-char title handled cleanly');

  // ADV-4: Malformed LRC Parsing Stress
  const malformedLrc = `
[invalid header]
[00:05] Line 1 with 2-digit sec
[01:10.5] Line 2 with 1-digit frac
[02:15.123] Line 3 with 3-digit frac
[99:99.99] Extreme time tag
Plain text without timestamp
`;
  const parsedMal = parseLrc(malformedLrc);
  assert(parsedMal.length === 4, 'ADV-4.1: Malformed LRC correctly extracts valid timestamps and ignores non-timestamp lines');
  assert(parsedMal[0].time === 5, 'ADV-4.1: [00:05] parsed as 5 seconds');
  assert(parsedMal[1].time === 70.5, 'ADV-4.1: [01:10.5] parsed as 70.5 seconds');
  assert(parsedMal[2].time === 135.123, 'ADV-4.1: [02:15.123] parsed as 135.123 seconds');
  assert(parsedMal[3].time === 6039.99, 'ADV-4.1: [99:99.99] parsed as 6039.99 seconds');

  // ----------------------------------------------------
  // TEST GROUP 5: GET Route Live Integration & Fallback Handling
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 5: GET /api/lyrics Route Handler Integration ---');

  // Test 5.1: Missing both title and artist returns HTTP 400
  try {
    const req = createMockRequest({});
    const res = await getLyrics(req);
    const json = await res.json();
    assert(res.status === 400, 'GET /api/lyrics missing params returns HTTP 400');
    assert(json.error !== undefined, 'GET /api/lyrics returns error string on 400');
  } catch (err: any) {
    assert(false, 'GET missing params threw error', err.message);
  }

  // Test 5.2: Popular Turkish track (Tarkan - Yolla) live lookup
  try {
    console.log('Fetching live lyrics for "Tarkan - Yolla"...');
    const req = createMockRequest({ title: 'Tarkan - Yolla (Official Music Video)', artist: 'netd müzik' });
    const res = await getLyrics(req);
    const json = await res.json();
    assert(res.status === 200, 'GET /api/lyrics returns HTTP 200 for Tarkan - Yolla');
    assert(typeof json.lyrics === 'string' && json.lyrics.length > 0, 'Lyrics returned non-empty string');
    console.log(`Lyrics provider response status: ${res.status}, synced: ${json.synced}, length: ${json.lyrics?.length}`);
  } catch (err: any) {
    assert(false, 'GET live lyrics for Tarkan - Yolla failed', err.message);
  }

  // Test 5.3: Fallback handling for non-existent track (returns 404)
  try {
    const origFetch = global.fetch;
    global.fetch = async () => new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    const req = createMockRequest({ title: 'XyZ123NonExistentSongTitle999', artist: 'UnknownNonExistentArtist999' });
    const res = await getLyrics(req);
    const json = await res.json();
    global.fetch = origFetch;
    assert(res.status === 404, 'Non-existent track returns HTTP 404');
    assert(json.error === 'Şarkı sözü bulunamadı', 'Non-existent track returns expected Turkish error message');
  } catch (err: any) {
    assert(false, 'GET non-existent track failed', err.message);
  }

  console.log('\n==================================================');
  console.log(`EMPIRICAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLyricsEmpiricalTests();
