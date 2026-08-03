import { searchYouTube } from '../lib/youtube';
import { GET as getRecommendations } from '../app/api/recommendations/route';

function createMockRequest(queryParams: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/recommendations');
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

async function runAdversarialTests() {
  console.log('==================================================');
  console.log('STARTING ADVERSARIAL STRESS TESTS FOR MILESTONE 1');
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
  // TEST GROUP 4: Extreme Inputs & Injection Attacks
  // ----------------------------------------------------
  console.log('--- TEST GROUP 4: Extreme Inputs & Payload Injections ---');

  // Test 4.1: XSS / HTML Injection payload
  try {
    const req = createMockRequest({
      title: '<script>alert("xss")</script><img src=x onerror=alert(1)>',
      artist: '<b>Test Artist</b>',
    });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 200, 'XSS payload in query handled safely without throwing');
    assert(
      Array.isArray(json.recommendations),
      'XSS query returns valid recommendations array'
    );
  } catch (err: any) {
    assert(false, 'XSS query test threw exception', err.message);
  }

  // Test 4.2: Extremely Long Query (5000 chars)
  try {
    const longTitle = 'A'.repeat(5000);
    const req = createMockRequest({ title: longTitle, artist: 'Test' });
    const res = await getRecommendations(req);
    assert(
      res.status === 200 || res.status === 400,
      '5000-char query handled gracefully without process crash',
      `Status: ${res.status}`
    );
  } catch (err: any) {
    assert(false, 'Long query test threw exception', err.message);
  }

  // Test 4.3: Unicode & Emojis
  try {
    const req = createMockRequest({
      title: '🎵🎧 🔥 祝你生日快乐 祝你生日快樂 祝你生日快樂!',
      artist: '😀🎉',
    });
    const res = await getRecommendations(req);
    const json = await res.json();
    assert(res.status === 200, 'Emoji & CJK query returns HTTP 200');
    assert(Array.isArray(json.recommendations), 'Emoji & CJK query returns array');
  } catch (err: any) {
    assert(false, 'Emoji/CJK query test threw exception', err.message);
  }

  // Test 4.4: Limit parameter boundary testing
  try {
    const reqNegative = createMockRequest({ title: 'Tarkan', limit: '-10' });
    const resNegative = await getRecommendations(reqNegative);
    const jsonNegative = await resNegative.json();
    assert(
      resNegative.status === 200 && Array.isArray(jsonNegative.recommendations),
      'Negative limit defaults to fallback limit (10)'
    );

    const reqHuge = createMockRequest({ title: 'Tarkan', limit: '99999' });
    const resHuge = await getRecommendations(reqHuge);
    const jsonHuge = await resHuge.json();
    assert(
      resHuge.status === 200 && jsonHuge.recommendations.length <= 20,
      'Huge limit is capped at max 20 recommendations'
    );

    const reqInvalid = createMockRequest({ title: 'Tarkan', limit: 'invalid_number' });
    const resInvalid = await getRecommendations(reqInvalid);
    const jsonInvalid = await resInvalid.json();
    assert(
      resInvalid.status === 200 && Array.isArray(jsonInvalid.recommendations),
      'NaN limit defaults gracefully to fallback limit'
    );
  } catch (err: any) {
    assert(false, 'Limit boundary test threw exception', err.message);
  }

  // ----------------------------------------------------
  // TEST GROUP 5: Invalid YouTube API Key Fallback
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 5: Invalid YOUTUBE_API_KEY Fallback ---');

  const origYtKey = process.env.YOUTUBE_API_KEY;
  try {
    process.env.YOUTUBE_API_KEY = 'AIzaSyINVALID_KEY_123456789';
    const results = await searchYouTube('Tarkan Dudu', 5);
    assert(
      Array.isArray(results) && results.length > 0,
      'Invalid YOUTUBE_API_KEY falls back to HTML scraper seamlessly'
    );
  } catch (err: any) {
    assert(false, 'Invalid YOUTUBE_API_KEY test threw exception', err.message);
  } finally {
    if (origYtKey !== undefined) {
      process.env.YOUTUBE_API_KEY = origYtKey;
    } else {
      delete process.env.YOUTUBE_API_KEY;
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 6: Concurrency & Performance Stress
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 6: Concurrency & Parallel Requests Stress ---');

  try {
    const concurrentCount = 5;
    console.log(`Sending ${concurrentCount} simultaneous recommendation requests...`);
    const startTime = Date.now();

    const requests = Array.from({ length: concurrentCount }).map((_, i) => {
      const req = createMockRequest({
        title: `Song ${i}`,
        artist: 'Sezen Aksu',
      });
      return getRecommendations(req);
    });

    const responses = await Promise.all(requests);
    const elapsed = Date.now() - startTime;
    console.log(`${concurrentCount} concurrent requests finished in ${elapsed}ms`);

    const allOk = responses.every((r) => r.status === 200);
    assert(allOk, 'All concurrent requests returned HTTP 200');

    const jsonResults = await Promise.all(responses.map((r) => r.json()));
    const allHaveRecs = jsonResults.every(
      (j) => Array.isArray(j.recommendations) && j.recommendations.length > 0
    );
    assert(allHaveRecs, 'All concurrent requests returned non-empty recommendations');
  } catch (err: any) {
    assert(false, 'Concurrency test threw exception', err.message);
  }

  console.log('\n==================================================');
  console.log(`ADVERSARIAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialTests();
