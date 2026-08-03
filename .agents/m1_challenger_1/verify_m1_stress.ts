import { GET as recsGET } from '@/app/api/recommendations/route';

async function runStressTests() {
  console.log('=== STARTING ADVERSARIAL STRESS TESTS FOR M1 ===\n');
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

  // 1. Invalid LASTFM_API_KEY environment variable handling
  const originalKey = process.env.LASTFM_API_KEY;
  process.env.LASTFM_API_KEY = 'invalid_dummy_key_99999';
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=Simarik&artist=Tarkan');
    const res = await recsGET(req);
    assert(res.status === 200, 'S1. Invalid Last.fm API key degrades gracefully to YouTube fallback (HTTP 200)');
    const json = await res.json();
    assert(Array.isArray(json.recommendations) && json.recommendations.length > 0, 'S1. Returns fallback recommendations on Last.fm API key failure');
  } catch (err: any) {
    assert(false, 'S1. Invalid Last.fm API key failed', err.message);
  } finally {
    process.env.LASTFM_API_KEY = originalKey;
  }

  // 2. Extreme limit parameters
  try {
    const req = new Request('http://localhost:3000/api/recommendations?artist=Tarkan&limit=-100');
    const res = await recsGET(req);
    assert(res.status === 200, 'S2. Negative limit defaults to 10 (HTTP 200)');
    const json = await res.json();
    assert(json.recommendations.length <= 10, 'S2. Negative limit handled safely');
  } catch (err: any) {
    assert(false, 'S2. Negative limit failed', err.message);
  }

  try {
    const req = new Request('http://localhost:3000/api/recommendations?artist=Tarkan&limit=99999');
    const res = await recsGET(req);
    assert(res.status === 200, 'S2. Excessive limit clamped to 20 (HTTP 200)');
    const json = await res.json();
    assert(json.recommendations.length <= 20, `S2. Clamped limit returned ${json.recommendations.length} (max 20)`);
  } catch (err: any) {
    assert(false, 'S2. Excessive limit failed', err.message);
  }

  // 3. Turkish character encoding and symbols
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=%C5%9E%C3%BCphe&artist=MF%C3%96');
    const res = await recsGET(req);
    assert(res.status === 200, 'S3. Turkish characters (Şüphe / MFÖ) processed without errors');
    const json = await res.json();
    assert(Array.isArray(json.recommendations) && json.recommendations.length > 0, 'S3. Returns recommendations for Turkish query');
  } catch (err: any) {
    assert(false, 'S3. Turkish characters failed', err.message);
  }

  // 4. Special punctuation and symbols
  try {
    const req = new Request('http://localhost:3000/api/recommendations?title=AC%2FDC&artist=AC%2FDC');
    const res = await recsGET(req);
    assert(res.status === 200, 'S4. Slash symbols (AC/DC) processed without errors');
  } catch (err: any) {
    assert(false, 'S4. Slash symbols failed', err.message);
  }

  console.log(`\n=== STRESS TEST SUMMARY ===`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runStressTests().catch((err) => {
  console.error('Stress test script crashed:', err);
  process.exit(1);
});
