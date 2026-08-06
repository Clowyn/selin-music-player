# BRIEFING — 2026-08-06T23:59:00Z

## Mission
Investigate lyrics API route (`app/api/lyrics/route.ts`), metadata cleaning for YouTube titles, and implementation strategy for Genius search + scraping fallback.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Explorer Survey 2 (Lyrics Focus)
- Working directory: d:\Projeler\Selin\selin-player\.agents\explorer_survey_2
- Original parent: f7dfe299-0b35-4b6e-992b-9287be6ad9ce
- Milestone: Requirements Survey (Lyrics Focus)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code changes in app source
- Write outputs only to working directory: d:\Projeler\Selin\selin-player\.agents\explorer_survey_2
- Detailed analysis in analysis.md and handoff report in handoff.md

## Current Parent
- Conversation ID: f7dfe299-0b35-4b6e-992b-9287be6ad9ce
- Updated: 2026-08-06T23:59:00Z

## Investigation State
- **Explored paths**: `app/api/lyrics/route.ts`, `components/LyricsSheet.tsx`, `lib/youtube.ts`, `package.json`
- **Key findings**:
  1. LRCLIB fetching handles synced LRC and plain lyrics across direct & search endpoints.
  2. Current `sanitizeInputs` fails on Turkish record label channels (`netd müzik`, `Poll Production`, etc.) and complex parentheses like `(Klipsiz / Official Video)`.
  3. Genius search + web scraping can be integrated zero-dependency via `genius.com/api/search/multi` (or `api.genius.com/search`) and HTML scraping of `data-lyrics-container="true"`.
- **Unexplored areas**: None (investigation complete).

## Key Decisions Made
- Prepared complete technical analysis in `analysis.md` and structured 5-component handoff report in `handoff.md`.

## Artifact Index
- d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\DISPATCH.md — Survey dispatch instructions
- d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\BRIEFING.md — Persistent briefing state
- d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\progress.md — Liveness heartbeat log
- d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\analysis.md — Technical investigation & specification
- d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\handoff.md — 5-component handoff report
