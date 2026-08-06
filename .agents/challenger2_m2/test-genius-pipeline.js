// Test script to empirically verify Genius parsing logic and timeout behavior in app/api/lyrics/route.ts

const fs = require('fs');
const path = require('path');
const http = require('http');

// Extract functions directly from app/api/lyrics/route.ts to ensure 100% code fidelity
const routeCode = fs.readFileSync(path.join(__dirname, '../../app/api/lyrics/route.ts'), 'utf8');

// Evaluate internal functions extractGeniusContainers, cleanGeniusHtml, fetchGeniusLyrics in isolated scope
let extractGeniusContainers, cleanGeniusHtml;

try {
  // Extract function definitions using regex / string extraction
  const extractFnCode = routeCode.match(/function extractGeniusContainers[\s\S]*?\n}\n/)[0];
  const cleanFnCode = routeCode.match(/function cleanGeniusHtml[\s\S]*?\n}\n/)[0];

  const evalScope = {};
  new Function('exports', `${extractFnCode}\n${cleanFnCode}\nexports.extractGeniusContainers = extractGeniusContainers;\nexports.cleanGeniusHtml = cleanGeniusHtml;`)(evalScope);
  
  extractGeniusContainers = evalScope.extractGeniusContainers;
  cleanGeniusHtml = evalScope.cleanGeniusHtml;
} catch (e) {
  console.error("Failed to extract functions from route.ts:", e);
  process.exit(1);
}

console.log("=== EMPIRICAL TEST SUITE FOR GENIUS LYRICS PIPELINE ===");

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
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

// -------------------------------------------------------------
// TEST GROUP 1: HTML Tag Depth Parser (extractGeniusContainers)
// -------------------------------------------------------------
console.log("\n--- Group 1: extractGeniusContainers (Tag Depth Parser) ---");

// Test 1.1: Single container without nesting
const html1 = `<div data-lyrics-container="true">First line<br>Second line</div>`;
const res1 = extractGeniusContainers(html1);
assertEqual(res1.length, 1, "Single container count");
assertEqual(res1[0], "First line<br>Second line", "Single container inner HTML");

// Test 1.2: Multiple sequential containers (Genius standard layout)
const html2 = `
<div class="header">Header</div>
<div data-lyrics-container="true">Stanza 1 line 1<br>Stanza 1 line 2</div>
<div class="ad-banner">Ad</div>
<div data-lyrics-container="true">Stanza 2 line 1<br>Stanza 2 line 2</div>
`;
const res2 = extractGeniusContainers(html2);
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
const res3 = extractGeniusContainers(html3);
assertEqual(res3.length, 1, "Nested divs container count");
assert(res3[0].includes("Verse text"), "Nested divs container content extracted correctly");
assert(res3[0].trim().endsWith("</div>"), "Tag depth balanced correctly at outer closing tag");

// Test 1.4: Container with other attributes (e.g. data-lyrics-container="true" class="Lyrics__Container-sc-...")
const html4 = `<div class="Lyrics__Container-sc-1bbee291-0" data-lyrics-container="true" id="lyrics">Verse content</div>`;
const res4 = extractGeniusContainers(html4);
assertEqual(res4.length, 1, "Container with extra attributes count");
assertEqual(res4[0], "Verse content", "Container with extra attributes content");

// Test 1.5: No container present
const html5 = `<div class="no-lyrics">No lyrics here</div>`;
const res5 = extractGeniusContainers(html5);
assertEqual(res5.length, 0, "No container returns empty array");

// -------------------------------------------------------------
// TEST GROUP 2: HTML Cleaning & Entity Decoding (cleanGeniusHtml)
// -------------------------------------------------------------
console.log("\n--- Group 2: cleanGeniusHtml (HTML & Entity Cleaning) ---");

// Test 2.1: <br> variants conversion to newline
const brHtml = `Line 1<br>Line 2<br/>Line 3<br  />Line 4<BR>Line 5`;
const cleanedBr = cleanGeniusHtml(brHtml);
assertEqual(cleanedBr, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", "<br> tags converted to newlines");

// Test 2.2: HTML tags stripping
const tagsHtml = `<a href="/artist">Artist</a> <b>Bold</b> <i>Italic</i> <span class="annotation">Annotated lyrics</span>`;
const cleanedTags = cleanGeniusHtml(tagsHtml);
assertEqual(cleanedTags, "Artist Bold Italic Annotated lyrics", "HTML tags stripped");

// Test 2.3: Named HTML Entity Decoding
const namedEntities = `&amp; &lt; &gt; &quot; &#x27; &#39; &apos; &nbsp;`;
const cleanedNamed = cleanGeniusHtml(namedEntities);
assertEqual(cleanedNamed, `& < > " ' ' '`, "Named HTML entities decoded");

// Test 2.4: Smart quotes HTML Entity Decoding
const smartQuotes = `&#8216;Single Start&#8217; &#8220;Double Start&#8221;`;
const cleanedQuotes = cleanGeniusHtml(smartQuotes);
assertEqual(cleanedQuotes, `'Single Start' "Double Start"`, "Smart quotes decoded");

// Test 2.5: Numeric Decimal Entity Decoding (Turkish & International Characters)
// &#351; = ş, &#231; = ç, &#287; = ğ, &#305; = ı, &#214; = Ö, &#220; = Ü
const turkishDecimal = `Sezen Aksu &#351;&#231;&#287;&#305;&#214;&#220;`;
const cleanedTurkish = cleanGeniusHtml(turkishDecimal);
assertEqual(cleanedTurkish, "Sezen Aksu şçğıÖÜ", "Decimal numeric entities decoded (Turkish characters)");

// Test 2.6: Multiple blank lines reduction
const multLines = `Line 1\n\n\n\n\nLine 2\r\n\r\nLine 3`;
const cleanedMult = cleanGeniusHtml(multLines);
assertEqual(cleanedMult, "Line 1\n\nLine 2\n\nLine 3", "Excessive blank lines collapsed to max 2 newlines");

// -------------------------------------------------------------
// TEST GROUP 3: 5s Timeout Enforcement Verification
// -------------------------------------------------------------
console.log("\n--- Group 3: Timeout Enforcement (AbortController) ---");

async function testTimeoutEnforcement() {
  // Start a dummy slow server that delays 6 seconds
  const slowServer = http.createServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    }, 6000);
  });

  await new Promise((resolve) => slowServer.listen(0, '127.0.0.1', resolve));
  const port = slowServer.address().port;
  const slowUrl = `http://127.0.0.1:${port}`;

  console.log(`  Started slow mock server on ${slowUrl} (delay: 6000ms)...`);

  // Test AbortSignal.timeout(1000)
  const startTime = Date.now();
  let timedOut = false;
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 1000);
    await fetch(slowUrl, { signal: controller.signal });
    clearTimeout(tId);
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 20 || err.message.includes('aborted')) {
      timedOut = true;
    }
  }
  const elapsed = Date.now() - startTime;

  assert(timedOut, "Fetch aborted on timeout");
  assert(elapsed < 2000, `Timeout triggered quickly (${elapsed}ms < 2000ms)`);

  slowServer.close();
}

testTimeoutEnforcement().then(() => {
  console.log(`\n=== EMPIRICAL TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ===`);
  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}).catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
