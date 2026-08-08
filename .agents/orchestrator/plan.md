# Plan: Selin Music Player UI & Recommendation Fixes

## Objectives
1. M1: Fix Control Panel Frame & Button Layout in `components/PlayerControls.tsx` (glassmorphic container framing, clean layout, no button overflow).
2. M2: Restore & Fix Lyrics Sheet in `components/LyricsSheet.tsx`, `store/playerStore.ts`, and `app/page.tsx` (`MicVocal` icon trigger, `isLyricsOpen` state sync, fallback plain lyrics and LRC lyrics).
3. M3: Overhaul Recommendation Engine & UI in `app/api/recommendations/route.ts`, `components/UpNextRow.tsx`, `components/PlaylistDrawer.tsx`, `components/SearchDrawer.tsx` (same genre/mood/style recommendations e.g. Dolu Kadehi Ters Tut -> Turkish Indie/Pop/Rock, Last.fm tag/artist similarity, YouTube fallback, clean title/artist metadata).
4. M4: Integration & Build Verification (`npm run lint` with 0 errors, `npm run build` with exit code 0).

## Execution Strategy
- Step 0: Dispatch 3 parallel Explorers to analyze M1 (PlayerControls layout), M2 (LyricsSheet state/events), and M3 (Recommendations engine & metadata parsing).
- Step 1: Execute Milestone 1 (Control Panel Frame & Layout) -> Explorer -> Worker -> Reviewers + Challengers + Forensic Auditor -> Gate Verification.
- Step 2: Execute Milestone 2 (Restore & Fix Lyrics Sheet) -> Explorer -> Worker -> Reviewers + Challengers + Forensic Auditor -> Gate Verification.
- Step 3: Execute Milestone 3 (Genre-Based Smart Recommendation Engine) -> Explorer -> Worker -> Reviewers + Challengers + Forensic Auditor -> Gate Verification.
- Step 4: Execute Milestone 4 (Build Verification) -> Worker -> Reviewers + Challengers + Forensic Auditor -> Gate Verification.
- Step 5: Report victory/completion to the Sentinel/Parent.
