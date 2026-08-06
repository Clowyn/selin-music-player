# Genius Scraping Mechanics & Provider Pipeline Error Handling Analysis

## Executive Summary
This analysis details the technical architecture, URL parameters, JSON parsing strategies, HTML scraping regex/selectors, text normalization pipeline, and timeout/fallback error handling semantics required for integrating Genius as the 3rd lyrics provider in `app/api/lyrics/route.ts`.

---

## 1. Genius Multi-Search & HTML Scraping Mechanics

### 1.1 Multi-Search URL Structure & HTTP Configuration
- **API Endpoint**: `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`
- **Search Query Construction**:
  The search query combines sanitized `artist` and `title` strings (e.g., `"Mor ve Ötesi Cambaz"` or `"Tarkan Yolla"`).
- **HTTP Request Headers**:
  Genius web endpoints block default server fetch User-Agents (such as `node-fetch` or Next.js server runtime defaults) with `403 Forbidden` status or Cloudflare anti-bot checks. The fetch request must supply standard web browser request headers:
  ```typescript
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  };
  ```

### 1.2 JSON Parsing & Song Hit Selection
- **Response Payload Schema**:
  The endpoint returns JSON structured as:
  ```json
  {
    "meta": { "status": 200 },
    "response": {
      "sections": [
        {
          "type": "song",
          "hits": [
            {
              "type": "song",
              "result": {
                "id": 12345,
                "title": "Cambaz",
                "artist_names": "Mor ve Ötesi",
                "url": "https://genius.com/Mor-ve-otesi-cambaz-lyrics",
                "primary_artist": {
                  "name": "Mor ve Ötesi"
                }
              }
            }
          ]
        }
      ]
    }
  }
  ```
- **Hit Selection Strategy**:
  1. Parse JSON response and locate section within `response.sections` where `section.type === 'song'` or `section.type === 'top_hit'`.
  2. Filter `section.hits` for hits where `hit.type === 'song'` and `hit.result?.url` exists.
  3. Extract `songUrl = hits[0].result.url`.

### 1.3 HTML Page Scraping Regex & Selectors
- **Target Container Element**:
  Genius embeds song lyrics across HTML `div` containers marked with `data-lyrics-container="true"`.
  Example HTML:
  ```html
  <div data-lyrics-container="true" class="Lyrics__Container-sc-1ynbvzw-1 kA-dTX">
    [Kıta 1]<br/>Bu bir dünya ki...<br/><br/>[Nakarat]<br/>Cambaz!
  </div>
  ```
- **Regex Container Extractor**:
  Since Next.js API routes operate without heavy DOM libraries (Cheerio/JSDOM), regex extraction is used:
  ```typescript
  const containerRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
  ```
- **Multi-Container Aggregation**:
  Songs with long lyrics or section breaks often span multiple `data-lyrics-container="true"` containers. All matching containers are extracted and concatenated in DOM appearance order.

---

## 2. Text Cleanup & HTML Normalization Pipeline

Raw scraped HTML from Genius contains tags, line breaks, HTML entities, and website metadata. A multi-stage cleanup pipeline transforms raw HTML into clean plain text:

### 2.1 HTML-to-Text Pipeline Stages

1. **Line Break Conversion**:
   Convert all `<br>`, `<br/>`, and `<br />` variants to newline `\n` characters before stripping HTML tags:
   ```typescript
   htmlContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');
   ```

2. **Block Tag & Container Transition Handling**:
   Ensure consecutive lyrics containers or block elements are separated by newlines (`\n\n`) to preserve stanza formatting.

3. **HTML Tag Stripping**:
   Strip remaining tags (such as `<a>`, `<span>`, `<b>`, `<i>`, `<div>`, `</div>`):
   ```typescript
   htmlContent = htmlContent.replace(/<[^>]+>/g, '');
   ```

4. **HTML Entity Decoding**:
   Decode standard and numeric HTML entities:
   ```typescript
   function decodeHtmlEntities(text: string): string {
     return text
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&apos;/g, "'")
       .replace(/&nbsp;/g, ' ')
       .replace(/&#x27;/g, "'")
       .replace(/&#8217;/g, "'")
       .replace(/&#8216;/g, "'")
       .replace(/&#8220;/g, '"')
       .replace(/&#8221;/g, '"')
       .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
   }
   ```

5. **Genius Metadata & Annotation Noise Removal**:
   Remove embedded annotation numbers (e.g., `[1]`, `[2]`), and Genius page artifacts such as `123 Contributors`, `Embed`, `You might also like`.

6. **Whitespace Normalization**:
   - Normalize line endings (`\r\n` -> `\n`).
   - Reduce 3+ consecutive newlines (`\n{3,}`) to double newlines (`\n\n`).
   - Trim leading and trailing whitespace (`.trim()`).

---

## 3. Timeout and Fallback Semantics

### 3.1 5s Timeout Enforcement Per Provider
Each provider attempt must enforce a strict **5000ms timeout** using `AbortSignal.timeout(5000)` or a dedicated `AbortController` timeout.
For Genius, which requires 2 sequential HTTP requests (search + scrape), a single shared `AbortController` ensures the cumulative execution time for Genius does not exceed 5000ms:

```typescript
const geniusController = new AbortController();
const timeoutId = setTimeout(() => geniusController.abort(), 5000);
try {
  // Step 1: Multi-search GET
  // Step 2: Song page HTML GET
} finally {
  clearTimeout(timeoutId);
}
```

### 3.2 Provider Pipeline Execution Order

```
1. LRCLIB Direct GET  (5s timeout) ──[Success]──► Return Synced/Plain (200)
       │ [Fail/Timeout]
       ▼
2. LRCLIB Search GET  (5s timeout) ──[Success]──► Return Synced/Plain (200)
       │ [Fail/Timeout]
       ▼
3. Genius Search & Scrape (5s timeout) ──[Success]──► Return Plain (200)
       │ [Fail/Timeout]
       ▼
4. lyrics.ovh GET     (5s timeout) ──[Success]──► Return Plain (200)
       │ [Fail/Timeout]
       ▼
5. 404 Empty Response (404 status)
```

### 3.3 Error Handling & Isolation
- Each provider is wrapped in an independent `try...catch` block.
- Network timeouts (`AbortError`), 4xx/5xx status codes, missing hits, or regex parsing failures are caught locally, logged via `console.warn(...)`, and fail over seamlessly to the next provider without crashing the API route.
