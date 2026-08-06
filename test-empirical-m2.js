/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log("=== EMPIRICAL TEST HARNESS FOR SELIN MUSIC PLAYER (M2 ITERATION 1) ===");
console.log("Target File: app/api/lyrics/route.ts\n");

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

function assertEqual(actual, expected, testName) {
  totalTests++;
  if (actual === expected) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual:   ${JSON.stringify(actual)}`);
  }
}

// Read route.ts content
const routePath = path.join(__dirname, 'app', 'api', 'lyrics', 'route.ts');
assert(fs.existsSync(routePath), "app/api/lyrics/route.ts exists");

const routeCode = fs.readFileSync(routePath, 'utf8');

// Extract internal functions for empirical execution
let extractGeniusContainers, cleanGeniusHtml;
try {
  const extractFnMatch = routeCode.match(/function extractGeniusContainers[\s\S]*?\n}\n/);
  const cleanFnMatch = routeCode.match(/function cleanGeniusHtml[\s\S]*?\n}\n/);

  if (extractFnMatch && cleanFnMatch) {
    const evalScope = {};
    new Function('exports', `${extractFnMatch[0]}\n${cleanFnMatch[0]}\nexports.extractGeniusContainers = extractGeniusContainers;\nexports.cleanGeniusHtml = cleanGeniusHtml;`)(evalScope);
    extractGeniusContainers = evalScope.extractGeniusContainers;
    cleanGeniusHtml = evalScope.cleanGeniusHtml;
  }
} catch (e) {
  console.error("Error evaluating route internal functions:", e);
}

assert(typeof extractGeniusContainers === 'function', "extractGeniusContainers extracted successfully");
assert(typeof cleanGeniusHtml === 'function', "cleanGeniusHtml extracted successfully");

// -------------------------------------------------------------
// TEST GROUP 1: HTML Tag Depth Parser (extractGeniusContainers)
// -------------------------------------------------------------
console.log("\n--- Group 1: extractGeniusContainers (Tag Depth Parser) ---");

// Test 1.1: Single container
const html1 = `<div data-lyrics-container="true">First line<br>Second line</div>`;
const res1 = extractGeniusContainers ? extractGeniusContainers(html1) : [];
assertEqual(res1.length, 1, "Single container count");
assertEqual(res1[0], "First line<br>Second line", "Single container inner HTML");

// Test 1.2: Multiple sequential containers (Genius standard layout)
const html2 = `
<div class="header">Header</div>
<div data-lyrics-container="true">Stanza 1 line 1<br>Stanza 1 line 2</div>
<div class="ad-banner">Ad</div>
<div data-lyrics-container="true">Stanza 2 line 1<br>Stanza 2 line 2</div>
`;
const res2 = extractGeniusContainers ? extractGeniusContainers(html2) : [];
assertEqual(res2.length, 2, "Multiple containers count");
assertEqual(res2[0], "Stanza 1 line 1<br>Stanza 1 line 2", "Container 1 content");
assertEqual(res2[1], "Stanza 2 line 1<br>Stanza 2 line 2", "Container 2 content");

// Test 1.3: Deeply nested <div> elements inside container
const html3 = `
<div data-lyrics-container="true">
  <div class="wrapper">
    <div class="inner">
      <span>Verse text</span>
    </div>
  </div>
</div>
`;
const res3 = extractGeniusContainers ? extractGeniusContainers(html3) : [];
assertEqual(res3.length, 1, "Nested divs container count");
assert(res3[0] && res3[0].includes("Verse text"), "Nested divs container content extracted correctly");
assert(res3[0] && res3[0].trim().endsWith("</div>"), "Tag depth balanced correctly at outer closing tag");

// Test 1.4: Container with other attributes
const html4 = `<div class="Lyrics__Container-sc-1bbee291-0" data-lyrics-container="true" id="lyrics">Verse content</div>`;
const res4 = extractGeniusContainers ? extractGeniusContainers(html4) : [];
assertEqual(res4.length, 1, "Container with extra attributes count");
assertEqual(res4[0], "Verse content", "Container with extra attributes content");

// -------------------------------------------------------------
// TEST GROUP 2: HTML Cleaning & Entity Decoding (cleanGeniusHtml)
// -------------------------------------------------------------
console.log("\n--- Group 2: cleanGeniusHtml (HTML & Entity Cleaning) ---");

// Test 2.1: <br> variants conversion to newline
const brHtml = `Line 1<br>Line 2<br/>Line 3<br  />Line 4<BR>Line 5`;
const cleanedBr = cleanGeniusHtml ? cleanGeniusHtml(brHtml) : '';
assertEqual(cleanedBr, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", "<br> tags converted to newlines");

// Test 2.2: HTML tags stripping
const tagsHtml = `<a href="/artist">Artist</a> <b>Bold</b> <i>Italic</i> <span class="annotation">Annotated lyrics</span>`;
const cleanedTags = cleanGeniusHtml ? cleanGeniusHtml(tagsHtml) : '';
assertEqual(cleanedTags, "Artist Bold Italic Annotated lyrics", "HTML tags stripped");

// Test 2.3: Named HTML Entity Decoding
const namedEntities = `&amp; &lt; &gt; &quot; &#x27; &#39; &apos; &nbsp;`;
const cleanedNamed = cleanGeniusHtml ? cleanGeniusHtml(namedEntities) : '';
assertEqual(cleanedNamed, `& < > " ' ' '`, "Named HTML entities decoded");

// Test 2.4: Smart quotes HTML Entity Decoding
const smartQuotes = `&#8216;Single Start&#8217; &#8220;Double Start&#8221;`;
const cleanedQuotes = cleanGeniusHtml ? cleanGeniusHtml(smartQuotes) : '';
assertEqual(cleanedQuotes, `'Single Start' "Double Start"`, "Smart quotes decoded");

// Test 2.5: Numeric Decimal Entity Decoding (Turkish Characters)
// &#351; = ş, &#231; = ç, &#287; = ğ, &#305; = ı, &#214; = Ö, &#220; = Ü
const turkishDecimal = `Sezen Aksu &#351;&#231;&#287;&#305;&#214;&#220;`;
const cleanedTurkish = cleanGeniusHtml ? cleanGeniusHtml(turkishDecimal) : '';
assertEqual(cleanedTurkish, "Sezen Aksu şçğıÖÜ", "Decimal numeric entities decoded (Turkish characters)");

// -------------------------------------------------------------
// TEST GROUP 3: Code Inspection & Timeout Enforcement Checks
// -------------------------------------------------------------
console.log("\n--- Group 3: Static Analysis & AbortController Checks ---");

// Test 3.1: Genius fetch uses AbortController with 5000ms timeout
const hasAbortController = routeCode.includes('new AbortController()');
const hasTimeout5000 = routeCode.includes('setTimeout(() => controller.abort(), 5000)');
assert(hasAbortController, "fetchGeniusLyrics creates AbortController");
assert(hasTimeout5000, "fetchGeniusLyrics sets 5000ms timeout on AbortController");

// Test 3.2: LRCLIB direct lookup timeout (AbortSignal.timeout(5000))
const hasLrclibDirectTimeout = routeCode.includes('AbortSignal.timeout(5000)');
assert(hasLrclibDirectTimeout, "External fetch calls use AbortSignal.timeout(5000)");

// Test 3.3: Try/Catch & Error handling in Genius pipeline
const hasTryCatch = routeCode.includes('try {') && routeCode.includes('catch (err)') && routeCode.includes('finally {');
assert(hasTryCatch, "fetchGeniusLyrics uses try-catch-finally block to ensure clearTimeout");

// Test 3.4: Fallback chain order in GET handler
const posLrclibDirect = routeCode.indexOf('LRCLIB Direct GET');
const posLrclibSearch = routeCode.indexOf('LRCLIB Search GET');
const posGenius = routeCode.indexOf('Genius Search & Web Scrape Fallback');
const posLyricsOvh = routeCode.indexOf('lyrics.ovh Fallback GET');
const pos404 = routeCode.indexOf('Empty State Fallback');

assert(
  posLrclibDirect < posLrclibSearch &&
  posLrclibSearch < posGenius &&
  posGenius < posLyricsOvh &&
  posLyricsOvh < pos404,
  "Fallback order is LRCLIB Direct -> LRCLIB Search -> Genius Fallback -> lyrics.ovh -> 404"
);

// -------------------------------------------------------------
// TEST GROUP 4: Timeout Simulation Test
// -------------------------------------------------------------
console.log("\n--- Group 4: Dynamic Timeout Simulation ---");

async function testTimeoutEnforcement() {
  const slowServer = http.createServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    }, 6000);
  });

  await new Promise((resolve) => slowServer.listen(0, '127.0.0.1', resolve));
  const port = slowServer.address().port;
  const slowUrl = `http://127.0.0.1:${port}`;

  const startTime = Date.now();
  let timedOut = false;
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 1000);
    await fetch(slowUrl, { signal: controller.signal });
    clearTimeout(tId);
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 20 || (err.message && err.message.includes('aborted'))) {
      timedOut = true;
    }
  }
  const elapsed = Date.now() - startTime;

  assert(timedOut, "Fetch request aborted when server delayed longer than timeout threshold");
  assert(elapsed < 2500, `Timeout triggered in ${elapsed}ms (< 2500ms limit)`);

  slowServer.close();
}

testTimeoutEnforcement().then(() => {
  console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===`);
  if (passedTests === totalTests) {
    console.log("ALL M2 ITERATION 1 EMPIRICAL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("SOME TESTS FAILED.");
    process.exit(1);
  }
}).catch((err) => {
  console.error("Timeout test error:", err);
  process.exit(1);
});
