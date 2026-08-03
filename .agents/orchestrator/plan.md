# Execution Plan: Selin Music Player Enhancements

## Phase 0: Survey & Specification (Completed)
- [x] Explorer 1: Data layer & API patterns survey (`store/playerStore.ts`, `lib/types.ts`, `app/api/search/route.ts`)
- [x] Explorer 2: UI component architecture & integration points (`PlaylistDrawer`, `SearchDrawer`, `PlayerControls`, `AudioEngine`, `page.tsx`)
- [x] Explorer 3: Project infrastructure, build setup, Last.fm, LRCLIB & lyrics.ovh APIs
- [x] Synthesize findings into `.agents/PROJECT.md`

## Milestone 1: Song Recommendations Engine (API)
- [ ] Refactor YouTube search helper into `lib/youtube.ts` (reused by search and recommendations)
- [ ] Create `app/api/recommendations/route.ts` using Last.fm `track.getSimilar` + YouTube search lookup
- [ ] Update `.env.example` with `LASTFM_API_KEY`
- [ ] Iteration loop: Explorer -> Worker -> Reviewers (2) + Challengers (2) + Forensic Auditor -> Gate Verification

## Milestone 2: Recommendations UI Placements
- [ ] Implement "Keşfet" (Discover) 3rd tab in `components/PlaylistDrawer.tsx` (10-15 songs)
- [ ] Implement dynamic empty state recommendations in `components/SearchDrawer.tsx` (5-8 songs)
- [ ] Implement "Up Next" horizontal scrollable card row on `app/page.tsx` (3-5 songs)
- [ ] Iteration loop: Explorer -> Worker -> Reviewers (2) + Challengers (2) + Forensic Auditor -> Gate Verification

## Milestone 3: Synced Lyrics Viewer & API
- [ ] Create `app/api/lyrics/route.ts` with LRCLIB (`syncedLyrics` / `plainLyrics`) + `lyrics.ovh` fallback & LRC parser
- [ ] Create `components/LyricsSheet.tsx` component with karaoke line highlight (`text-pink-400`), auto-scroll, static fallback, and empty state
- [ ] Add `MicVocal` (♪) lyrics trigger button to `components/PlayerControls.tsx`
- [ ] Integrate `LyricsSheet` into `app/page.tsx`
- [ ] Iteration loop: Explorer -> Worker -> Reviewers (2) + Challengers (2) + Forensic Auditor -> Gate Verification

## Milestone 4: Integration & Build Verification
- [ ] Run `npm run lint` and fix any ESLint issues (target: 0 errors)
- [ ] Run `npm run build` and ensure exit code 0
- [ ] Iteration loop: Explorer -> Worker -> Reviewers (2) + Challengers (2) + Forensic Auditor -> Gate Verification
