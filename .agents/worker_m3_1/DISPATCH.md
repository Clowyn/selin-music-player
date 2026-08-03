## 2026-08-03T21:28:18Z

You are worker_m3_1 for Milestone 3 (Synced Lyrics API & Viewer).
Your working directory is d:\Projeler\Selin\selin-player\.agents\worker_m3_1. Please create this directory if it doesn't exist yet, and put all your metadata/handoff files there.

Objective: Implement Milestone 3 (Synced Lyrics API & Viewer) in accordance with the specifications in the Explorer handoff reports.

Authoritative Project Files & Explorer Specs (READ ALL FIRST):
- `d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md`
- `d:\Projeler\Selin\selin-player\.agents\PROJECT.md`
- `d:\Projeler\Selin\selin-player\.agents\explorer_m3_1\handoff.md` (Synced Lyrics API spec)
- `d:\Projeler\Selin\selin-player\.agents\explorer_m3_2\handoff.md` (LyricsSheet UI spec)
- `d:\Projeler\Selin\selin-player\.agents\explorer_m3_3\handoff.md` (Integration & state spec)

Write Ownership & Scope:
1. `store/playerStore.ts`:
   - Add `isLyricsOpen: boolean` (default `false`), `setLyricsOpen: (open: boolean) => void`, and `toggleLyricsOpen: () => void`.
   - Update `setSearchDrawerOpen` and `setLyricsOpen` so opening one automatically closes the other.
2. `app/api/lyrics/route.ts`:
   - Create route handler for `GET /api/lyrics?title={title}&artist={artist}`.
   - Clean song title/artist strings (strip common clutter like `(Official Video)`, `[MV]`, `feat.`, etc.).
   - Primary source: LRCLIB (`https://lrclib.net/api/get?track_name=...&artist_name=...` and search fallback `https://lrclib.net/api/search?q=...`).
   - Tertiary fallback: `lyrics.ovh` (`https://api.lyrics.ovh/v1/{artist}/{title}`).
   - LRC parser: Parse timestamp format `[mm:ss.xx]` and `[mm:ss.xxx]` to float seconds, extract text, filter metadata header lines (`[ar:]`, etc.), and sort lines ascending by `time`.
   - Return `{ lyrics: string, synced: boolean, lines?: Array<{ time: number, text: string }> }`.
3. `components/LyricsSheet.tsx`:
   - Build slide-up glassmorphic drawer component (`bg-gray-900/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(236,72,153,0.15)]`).
   - Subscribe to `currentSong`, `currentTime`, `isPlaying`, `seekTo`, `isLyricsOpen`, `setLyricsOpen` from `playerStore`.
   - Karaoke sync: Find active line index using binary search or `findIndex`, highlight active line in pink (`text-pink-400 font-bold scale-105 shadow-[0_0_20px_rgba(236,72,153,0.25)]`). Mute inactive lines.
   - Auto-centering scroll using `scrollIntoView({ behavior: 'smooth', block: 'center' })` or `containerRef`.
   - Interactive tap-to-seek: clicking line calls `seekTo(line.time)`.
   - Static fallback display for plain text lyrics (`synced === false`).
   - Friendly empty state UI: "Şarkı Sözü Bulunamadı" with glowing music icon and retry option.
4. `components/PlayerControls.tsx`:
   - Add `MicVocal` icon button (from `lucide-react`) at the far left of the control bar.
   - Highlight button in pink glow when `isLyricsOpen` is true.
   - Clicking toggles `isLyricsOpen`.
5. `app/page.tsx`:
   - Mount `<LyricsSheet />` at the root page level.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Verification Steps (MANDATORY):
- After implementing all changes, run `npm run lint` and `npm run build` using terminal tools.
- Verify 0 lint errors and exit code 0 build success.
- Document all modified files, features implemented, and build/lint results in `d:\Projeler\Selin\selin-player\.agents\worker_m3_1\handoff.md`.
- Report back via send_message when done.
