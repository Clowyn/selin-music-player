# Project: Selin Music Player UI & Recommendation Fixes

## Architecture
- Framework: Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand v5 store.
- Control Panel & Layout: `components/PlayerControls.tsx` (glassmorphic container framing, 2-row / responsive flex layout, button overflow fix).
- Lyrics Sheet Component & Store: `components/LyricsSheet.tsx`, `store/playerStore.ts`, `app/page.tsx` (`MicVocal` icon trigger, `isLyricsOpen` state sync, fallback plain lyrics and synced LRC).
- Recommendation Engine & UI: `app/api/recommendations/route.ts`, `components/UpNextRow.tsx`, `components/PlaylistDrawer.tsx`, `components/SearchDrawer.tsx` (Genre/Mood/Style based recommendation engine using Last.fm tag/artist similarity + YouTube search fallback, metadata cleaning).
- Build & Verification: `npm run lint` (0 errors) & `npm run build` (exit code 0).

## Feature Inventory
Every feature from ORIGINAL_REQUEST.md (Follow-up 2026-08-08) is assigned to a milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Control Panel Frame & Layout | Fix button overflow in `components/PlayerControls.tsx`, wrap in glass card container | M1 | R1 |
| 2 | Restore & Fix Lyrics Sheet | Fix `MicVocal` icon click trigger, `isLyricsOpen` store sync, z-index layout in `app/page.tsx`, plain & LRC lyrics fallback | M2 | R2 |
| 3 | Genre-Based Smart Recommendation Engine | Overhaul `app/api/recommendations/route.ts` & UI components to return same genre/mood/style tracks + metadata cleaning | M3 | R3 |
| 4 | Integration & Build Verification | Pass `npm run lint` (0 errors) and `npm run build` (exit code 0) | M4 | R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Control Panel Frame & Button Layout | `components/PlayerControls.tsx` | None | DONE |
| M2 | Restore & Fix Lyrics Sheet | `components/LyricsSheet.tsx`, `store/playerStore.ts`, `app/page.tsx` | None | DONE |
| M3 | Genre-Based Smart Recommendation Engine | `app/api/recommendations/route.ts`, `components/UpNextRow.tsx`, `components/PlaylistDrawer.tsx`, `components/SearchDrawer.tsx` | None | DONE |
| M4 | Integration & Build Verification | ESLint linting verification (0 errors), Next.js build compilation (exit code 0) | M1, M2, M3 | DONE |

## Code Layout
- `components/PlayerControls.tsx` — Player controls bar with glassmorphic container framing and responsive button layout.
- `components/LyricsSheet.tsx` — Glassmorphic slide-up drawer for synced karaoke lyrics and plain text fallback.
- `store/playerStore.ts` — Zustand store managing `isLyricsOpen`, `toggleLyricsOpen`, `setLyricsOpen`, current song, play state.
- `app/page.tsx` — Main page layout composing PlayerControls, LyricsSheet, UpNextRow, and drawers.
- `app/api/recommendations/route.ts` — Recommendation API using Last.fm artist/tag similarity + YouTube genre search fallback.
- `components/UpNextRow.tsx` — Up Next recommendations horizontal row.
- `components/PlaylistDrawer.tsx` — Playlist drawer with Keşfet (Discover) tab.
- `components/SearchDrawer.tsx` — Search drawer with empty-query recommendation section.
