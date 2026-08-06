## 2026-08-06T20:57:34Z

# Survey Dispatch - Explorer 2 (Lyrics Focus)

## Identity & Scope
- Working directory: d:\Projeler\Selin\selin-player\.agents\explorer_survey_2
- Target: Lyrics API Route & Metadata Cleaning (R3)
- Read ORIGINAL_REQUEST.md at: d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md

## Objective
Investigate `app/api/lyrics/route.ts` and related helpers.
1. Analyze how LRCLIB and lyrics.ovh are currently fetched.
2. Determine how to implement Genius search + scraping fallback as a 3rd source between LRCLIB and lyrics.ovh (or as configured).
3. Analyze current title and artist metadata cleaning for YouTube titles (removing (Official Video), [MV], HD, ft./feat., etc.).
4. Output your analysis report to `d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\analysis.md` and write a handoff report `d:\Projeler\Selin\selin-player\.agents\explorer_survey_2\handoff.md`.
