# Selin Music Player PWA - Orchestration Plan (Round 2)

## Overview
This plan governs the execution and verification of user requirements R1 to R5 for Selin Music Player PWA.

## Requirements Breakdown
- **R1: Wider Control Bar**: Adjust `components/PlayerControls.tsx` to increase vertical padding (~5px increase, e.g. `py-4` / `p-4`).
- **R2: Compact Recommendations Strip**: Redesign `components/UpNextRow.tsx` into a single-line horizontal strip (~50px height max) featuring song title, play button, and queue button instead of large ~200px cards.
- **R3: Improved Lyrics Coverage**: Update `app/api/lyrics/route.ts` to add Genius search + scrape fallback as 3rd provider between LRCLIB and lyrics.ovh, plus improve title/artist metadata cleaning for YouTube titles.
- **R4: Now Playing Queue Drawer & Playlist Editing**: Implement a slide-out/modal drawer showing current queue and playlist tracks, highlighting playing song, tap to play/jump, edit mode with drag reorder, track removal, playlist renaming, and syncing updates to Supabase.
- **R5: Build Verification**: Ensure `npm run lint` and `npm run build` execute cleanly with exit code 0.

## Milestones
1. **M1: Control Bar & UpNext Strip UI (R1, R2)**
   - Target files: `components/PlayerControls.tsx`, `components/UpNextRow.tsx`
2. **M2: Lyrics Search & Fallback API (R3)**
   - Target files: `app/api/lyrics/route.ts`, helpers/utils for lyrics
3. **M3: Now Playing Queue & Playlist Drawer (R4)**
   - Target files: `components/QueueDrawer.tsx` (or similar drawer component), state hooks/store, Supabase syncing methods.
4. **M4: Build, Lint & Final Integration Audit (R5)**
   - Verification across full codebase: linting, build outputs, edge cases.

## Execution Procedure per Milestone
1. **Explore**: Dispatch `teamwork_preview_explorer` to inspect target files, dependencies, and state management patterns.
2. **Implement**: Dispatch `teamwork_preview_worker` with explicit integrity warnings to implement feature and run tests.
3. **Review**: Dispatch 2 `teamwork_preview_reviewer` agents for code quality, adherence to specs, and edge case safety.
4. **Challenge**: Dispatch 2 `teamwork_preview_challenger` agents for runtime verification and stress testing.
5. **Audit**: Dispatch `teamwork_preview_auditor` for integrity checking.
6. **Gate Evaluation**: All reviews APPROVE + Auditor CLEAN + Build/Lint PASS.

## Success Criteria
- All 5 requirements fully satisfied.
- Zero lint errors (`npm run lint`).
- Production build succeeds (`npm run build`).
- Forensic audit CLEAN on all milestones.
