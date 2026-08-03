# Forensic Audit Report: Milestone 3 (Synced Lyrics API & Viewer)

**Work Product**: Milestone 3 Synced Lyrics API & Viewer (`app/api/lyrics/route.ts`, `components/LyricsSheet.tsx`, `components/PlayerControls.tsx`, `store/playerStore.ts`, `app/page.tsx`)  
**Profile**: General Project / Development Mode  
**Verdict**: CLEAN  
**Auditor**: `auditor_m3_1`  
**Date**: 2026-08-03  

---

## 1. Observation

1. **Hardcoded Test Results / Mock Data Check**:
   - `app/api/lyrics/route.ts`: No hardcoded lyrics array, mock strings, or fake test responses. Returns genuine 404 JSON response when lyrics are not found.
   - `components/LyricsSheet.tsx`: No pre-populated lyrics data. Dynamically fetches lyrics using `fetch('/api/lyrics?title=...&artist=...')`.

2. **Network Request Dynamics & Fallbacks**:
   - `app/api/lyrics/route.ts` implements a dynamic 3-stage fallback pipeline:
     1. Primary: LRCLIB direct API (`https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`).
     2. Secondary: LRCLIB search API (`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`).
     3. Tertiary: `lyrics.ovh` fallback (`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`).
   - Title and artist are dynamically sanitized via `sanitizeInputs()`, `cleanTitle()`, and `cleanArtist()` to remove YouTube clutter (`(Official Video)`, `[MV]`, `feat.`, etc.).

3. **LRC Regex Parsing & Timestamp Logic**:
   - `parseLrc` in `app/api/lyrics/route.ts` uses regex `/\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g` to extract timestamp components.
   - Converts minutes, seconds, and milliseconds/centiseconds into floating-point seconds using `parseFloat((minutes * 60 + seconds + frac).toFixed(3))`.
   - Filters metadata headers (`/^\[(ar|ti|al|by|offset|length|re|ve):.*\]$/i`), supports multi-timestamp lines, and sorts lines in ascending order (`a.time - b.time`).
   - `components/LyricsSheet.tsx` uses binary search (`findActiveLineIndex`) for real-time $O(\log N)$ karaoke sync.

4. **Lint & Build Verification**:
   - `npm run lint` executed cleanly with 0 errors (4 minor warnings in non-milestone admin/sprite files).
   - `npm run build` executed cleanly with exit code 0, compiling Next.js 16 App Router with Turbopack including dynamic route `ƒ /api/lyrics`.

---

## 2. Logic Chain

1. **Source Code Integrity**: Source code examination confirms no hardcoding or facade implementations exist. All responses are derived dynamically from live API queries or proper error handling.
2. **Algorithmic Correctness**: The LRC parser accurately calculates floating-point seconds and handles complex LRC formats (headers, multi-timestamps, centiseconds/milliseconds).
3. **Build Stability**: Verified via direct terminal execution of `npm run lint` and `npm run build`, showing zero lint errors and successful production build generation.

---

## 3. Caveats

- **No Caveats**: All audited files passed all integrity checks without any exceptions or violations.

---

## 4. Conclusion

**Verdict**: `CLEAN`

Milestone 3 (Synced Lyrics API & Viewer) strictly complies with all integrity requirements. Code is genuine, external network requests to LRCLIB and lyrics.ovh are dynamic and robust, LRC timestamp calculation and line sorting are mathematically accurate, and the application passes both linting and compilation with zero errors.

---

## 5. Verification Method

To independently verify the audit findings:

1. **Execute Lint Check**:
   ```bash
   npm run lint
   ```
   *Expected Output*: 0 errors.

2. **Execute Build Check**:
   ```bash
   npm run build
   ```
   *Expected Output*: Exit code 0, successful Turbopack production build.

3. **Inspect Target Files**:
   - `app/api/lyrics/route.ts` (LRC parser regex & 3-stage fetch logic)
   - `components/LyricsSheet.tsx` (Dynamic fetch, binary search karaoke sync, empty/plain states)
   - `components/PlayerControls.tsx` (`MicVocal` ♪ button toggle)
   - `store/playerStore.ts` (`isLyricsOpen`, `setLyricsOpen`, `toggleLyricsOpen`, mutual exclusion with search)
   - `app/page.tsx` (`<LyricsSheet />` root mounting)
