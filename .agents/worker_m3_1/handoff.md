# Handoff Report: Milestone 3 (Synced Lyrics API & Viewer)

**Agent**: `worker_m3_1`  
**Milestone**: Milestone 3 (Synced Lyrics API & Viewer)  
**Working Directory**: `d:\Projeler\Selin\selin-player\.agents\worker_m3_1`  
**Date**: 2026-08-03  

---

## 1. Observation

### 1.1 Core Scope & Files Modified/Created
1. `store/playerStore.ts`:
   - Extended `PlayerState` interface with `isLyricsOpen: boolean`, `setLyricsOpen: (open: boolean) => void`, and `toggleLyricsOpen: () => void`.
   - Implemented state actions with mutual exclusivity: opening `isLyricsOpen` closes `searchDrawerOpen`, and opening `searchDrawerOpen` closes `isLyricsOpen`.
2. `app/api/lyrics/route.ts`:
   - Created route handler for `GET /api/lyrics?title={title}&artist={artist}`.
   - Implemented title & artist sanitization (`cleanTitle`, `cleanArtist`, `sanitizeInputs`) to strip YouTube clutter like `(Official Video)`, `[MV]`, `feat.`, etc.
   - Implemented `parseLrc` engine: parses `[mm:ss.xx]` and `[mm:ss.xxx]` timestamp formats into float seconds, extracts line text, ignores metadata headers (`[ar:]`, `[ti:]`, etc.), and sorts lines ascending by timestamp.
   - Connected primary LRCLIB direct endpoint (`https://lrclib.net/api/get`), secondary LRCLIB search fallback (`https://lrclib.net/api/search`), and tertiary lyrics.ovh fallback (`https://api.lyrics.ovh/v1`).
3. `components/LyricsSheet.tsx`:
   - Created slide-up glassmorphic drawer component with styling `bg-gray-900/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(236,72,153,0.15)]`.
   - Connected store state (`currentSong`, `currentTime`, `seekTo`, `isLyricsOpen`, `setLyricsOpen`).
   - Implemented binary search algorithm (`findActiveLineIndex`) for real-time karaoke sync.
   - Styled active karaoke line with pink glow (`text-pink-400 font-bold scale-105 shadow-[0_0_20px_rgba(236,72,153,0.25)] bg-pink-500/15 border border-pink-500/40 rounded-2xl`) and muted inactive past/future lines.
   - Implemented smooth auto-centering scroll using `scrollIntoView({ behavior: 'smooth', block: 'center' })` with manual scroll override detection and floating "Canlı Sözlere Dön" button.
   - Implemented interactive tap-to-seek calling `seekTo(line.time)`.
   - Implemented static fallback display for plain text lyrics (`synced === false`).
   - Implemented friendly empty state UI ("Şarkı Sözü Bulunamadı") with glowing music icon and retry action.
4. `components/PlayerControls.tsx`:
   - Added `MicVocal` icon button at the far left of the control bar.
   - Added pink glow active styling (`text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]`) when `isLyricsOpen` is true.
   - Connected toggle listener to `toggleLyricsOpen()`.
5. `app/page.tsx`:
   - Imported and mounted `<LyricsSheet />` at root page level.

---

## 2. Logic Chain

1. **State Coordination & Mutual Exclusion**:
   - `store/playerStore.ts` centralizes `isLyricsOpen` alongside `searchDrawerOpen`. When `setLyricsOpen(true)` or `toggleLyricsOpen()` opens the lyrics sheet, `searchDrawerOpen` is set to `false`. Conversely, when `setSearchDrawerOpen(true)` opens search, `isLyricsOpen` is set to `false`. This guarantees only one slide-up drawer is active at any time, preventing overlay clutter.

2. **Lyrics API Fetch & Fallback Pipeline**:
   - `app/api/lyrics/route.ts` first sanitizes song metadata. It queries LRCLIB direct `GET /api/get?track_name={title}&artist_name={artist}`.
   - If direct lookup fails or yields no synced lyrics, it queries LRCLIB search `GET /api/search?q={artist}+{title}`.
   - If LRCLIB search yields no lyrics, it falls back to `lyrics.ovh`.
   - `parseLrc` converts LRC timestamp tags (`[mm:ss.xx]`) to float seconds, removes metadata header lines, handles multi-timestamp lines, and sorts lines strictly by timestamp.

3. **Karaoke Viewer UX & Performance**:
   - `components/LyricsSheet.tsx` uses $O(\log N)$ binary search to find the active line based on high-frequency `currentTime` updates from `playerStore`.
   - When the active line changes, `scrollIntoView({ behavior: 'smooth', block: 'center' })` keeps the current lyric centered.
   - User touch/wheel events pause auto-scroll so users can freely browse lyrics without being forcefully scrolled back, with a floating button allowing 1-click return to active line sync.

---

## 3. Caveats

- **No Caveats**: All 5 scope items were fully implemented, tested against Next.js 16 React Compiler ESLint rules, and compiled via Turbopack build without errors.

---

## 4. Conclusion

Milestone 3 (Synced Lyrics API & Viewer) is 100% complete and fully integrated into Selin Music Player. The implementation provides genuine LRC parsing, 3-tier external API fallbacks, karaoke sync with tap-to-seek, static text fallback, empty state handling, and zero build/lint regressions.

---

## 5. Verification Method

To independently verify the implementation:

### 1. Run Linter
```bash
npm run lint
```
**Expected Outcome**: 0 errors, exit code 0.

### 2. Run Production Build
```bash
npm run build
```
**Expected Outcome**: Exit code 0, successful Turbopack compilation including dynamic route `ƒ /api/lyrics`.

### 3. File Inspection
- `store/playerStore.ts`: Verify `isLyricsOpen`, `setLyricsOpen`, `toggleLyricsOpen`, and updated `setSearchDrawerOpen`.
- `app/api/lyrics/route.ts`: Verify `parseLrc`, title/artist cleaning, LRCLIB direct/search, and lyrics.ovh fallbacks.
- `components/LyricsSheet.tsx`: Verify `bg-gray-900/95 backdrop-blur-2xl border-t border-white/10`, binary search `findActiveLineIndex`, `scrollIntoView`, active pink highlight (`text-pink-400 font-bold scale-105`), tap-to-seek `seekTo`, static fallback, and empty state.
- `components/PlayerControls.tsx`: Verify `MicVocal` icon button with pink glow.
- `app/page.tsx`: Verify `<LyricsSheet />` mounting.
