# Project: Selin Music Player PWA

## Architecture
- Framework: Next.js App Router (TypeScript, Tailwind CSS, Framer Motion, Zustand)
- Backend API: Next.js Route Handlers (`app/api/...`)
- External DB: Supabase (`@supabase/supabase-js`)
- Icons: Lucide React (`lucide-react`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Wider Control Bar | Increase vertical padding (~5px e.g. p-3 to p-4/py-4) in components/PlayerControls.tsx | M1 | ORIGINAL_REQUEST |
| 2 | R2: Compact UpNext Strip | Redesign components/UpNextRow.tsx into single-line horizontal strip (~50px height max) with title, play, queue buttons | M1 | ORIGINAL_REQUEST |
| 3 | R3: Lyrics Genius Fallback | Add Genius search + scrape fallback as 3rd provider between LRCLIB and lyrics.ovh in app/api/lyrics/route.ts | M2 | ORIGINAL_REQUEST |
| 4 | R3: YouTube Title/Artist Cleaning | Improve metadata cleaning for YouTube titles/artists in app/api/lyrics/route.ts | M2 | ORIGINAL_REQUEST |
| 5 | R4: Now Playing Queue Drawer UI | Slide-out/modal drawer listing queue & playlist tracks, highlight playing song, tap to jump | M3 | ORIGINAL_REQUEST |
| 6 | R4: Playlist Editing & Drag Reorder | Edit mode toggle, drag reorder (Framer Motion Reorder), delete song, rename playlist | M3 | ORIGINAL_REQUEST |
| 7 | R4: Supabase Sync | Sync track order, track deletion, and playlist rename back to Supabase | M3 | ORIGINAL_REQUEST |
| 8 | R5: Build & Lint Verification | Ensure npm run lint & npm run build exit code 0 | M4 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | UI Adjustments | R1 Wider Control Bar & R2 Compact UpNext Strip | none | DONE |
| M2 | Lyrics API Overhaul | R3 Genius Fallback & YouTube Metadata Cleaning | none | DONE |
| M3 | Queue Drawer & Playlist Editing | R4 Now Playing Drawer, Reorder, Delete, Rename & Supabase Sync | M1 | DONE |
| M4 | Build & Lint Verification | R5 Clean Lint & Production Build Verification | M1, M2, M3 | DONE |

## Interface Contracts
### PlayerControls ↔ PlayerStore
- `PlayerControls` provides toggle button for Queue Drawer (`toggleQueueDrawer` or `isQueueOpen`).
- `PlayerControls` height expanded vertically with `py-4 sm:py-5`.

### QueueDrawer ↔ PlayerStore & Supabase
- Store state: `isQueueOpen: boolean`, `setQueueOpen: (open: boolean) => void`, `reorderQueue: (newOrder: Song[]) => void`.
- Supabase sync: `updatePlaylistTrackOrder(playlistId, songs)`, `deleteSongFromPlaylist(playlistId, songId)`, `renamePlaylist(playlistId, newName)`.

### Lyrics Route ↔ LRCLIB / Genius / lyrics.ovh
- Request: GET `/api/lyrics?artist=...&title=...`
- Strategy: LRCLIB direct -> LRCLIB search -> Genius search & scrape -> lyrics.ovh
- Output: `{ lyrics: string, syncedLyrics?: string, source: string }`

## Code Layout
- `components/PlayerControls.tsx` — Player bar UI
- `components/UpNextRow.tsx` — Recommended / up next strip UI
- `components/QueueDrawer.tsx` — Now Playing queue and playlist editing drawer UI
- `components/NowPlaying.tsx` — Fullscreen now playing view
- `app/api/lyrics/route.ts` — Lyrics API route
- `store/playerStore.ts` — Zustand player state store
- `lib/supabase.ts` — Supabase client and database operations
