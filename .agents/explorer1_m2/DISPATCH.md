## 2026-08-07T00:16:45Z
You are explorer1_m2 for Milestone 2 (Lyrics API Overhaul with Genius Fallback & Metadata Cleaning).
Working directory: d:\Projeler\Selin\selin-player\.agents\explorer1_m2
Project root: d:\Projeler\Selin\selin-player
Original request: d:\Projeler\Selin\ORIGINAL_REQUEST.md
Project scope: d:\Projeler\Selin\selin-player\PROJECT.md
Target file: app/api/lyrics/route.ts

Task: Investigate app/api/lyrics/route.ts and formulate a comprehensive implementation specification for Requirement R3.
Analyze:
1. Genius Search + Web Scrape Fallback:
   - Genius API endpoint: https://genius.com/api/search/multi?q=... or https://api.genius.com/search?q=...
   - HTML Scraping: Extract lyric text from Genius HTML response (data-lyrics-container="true" divs).
   - Placement: Position as Attempt 3 (LRCLIB Direct -> LRCLIB Search -> Genius Search & Scrape -> lyrics.ovh).
2. YouTube Metadata & Title/Artist Cleaning:
   - Enhance cleanTitle regex to clean arbitrary parenthesis/bracket contents containing keywords like official, video, lyric, hd, vevo, audio, klipsiz, topic, 4k, remastered.
   - Enhance cleanArtist and sanitizeInputs with record labels list (netd müzik, poll production, pasaj müzik, dmc, kalan müzik, avrupa müzik, dokuz sekiz, etc.).
   - Handle title format Artist - Song (Official Video) when YouTube channel name is generic.
3. Verification Requirements:
   - Ensure GET /api/lyrics?title=Yolla&artist=Tarkan and GET /api/lyrics?title=Cambaz&artist=Mor+ve+%C3%96tesi return valid lyrics JSON.
Write your findings and step-by-step implementation plan to d:\Projeler\Selin\selin-player\.agents\explorer1_m2\analysis.md and handoff.md, and send a message back to parent.
