# Handoff Report: SearchDrawer Default Recommendation State Design

## 1. Observation

- **Target Component**: `components/SearchDrawer.tsx`
- **Lines 365–377 (Static Placeholder)**:
  ```tsx
  ) : (
    <div className="flex flex-col items-center justify-center h-56 gap-3 text-gray-400">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-600/10 border border-pink-500/20 flex items-center justify-center">
        <Search size={32} className="text-pink-400" />
      </div>
      <p className="text-base font-semibold text-white">
        YouTube&apos;da Şarkı Ara
      </p>
      <p className="text-xs text-purple-200/60 text-center max-w-xs">
        Şarkı veya sanatçı adı yazarak arama yapabilirsiniz.
      </p>
    </div>
  )
  ```
- **Existing `usePlayerStore` usage (lines 11–19)**: Currently retrieves `searchDrawerOpen`, `setSearchDrawerOpen`, `setCurrentSong`, `play`, `addToQueue`, `favorites`, `toggleFavorite`. `currentSong` state is already present in Zustand store (`store/playerStore.ts`), just needs destructuring.
- **Existing Action Handlers (lines 103–135)**: `handlePlayNow`, `handleAddToQueue`, `handleToggleFavorite`, `handleAddToPlaylist`, and `isFavorited` all accept `item: YouTubeSearchResult` and execute `convertToSong(item)` internally.
- **Recommendations API Endpoint**: `GET /api/recommendations?title={title}&artist={artist}&limit={limit}` returns `{ recommendations: Song[] }`. Passing no title and artist returns HTTP 400, so fallback query parameters `title=Yolla&artist=Tarkan` are required when `currentSong` is null.

---

## 2. Logic Chain

1. **Problem Statement**: In `components/SearchDrawer.tsx`, opening the search drawer shows a static placeholder image and text when no search query is typed. Requirement R2 item 2 calls for replacing this with a dynamic `"🎵 Sana Özel Öneriler"` section displaying 5–8 recommended tracks.
2. **Context-Aware Fetching**: Access `currentSong` from `usePlayerStore()`. When `searchDrawerOpen` is set to `true` (or when `currentSong` changes):
   - If `currentSong` exists: Call `/api/recommendations?title=${title}&artist=${artist}&limit=6`.
   - If `currentSong` is null: Call `/api/recommendations?title=Yolla&artist=Tarkan&limit=6` (default mix fallback).
3. **Data Type Adapter (`songToYouTubeSearchResult`)**: `/api/recommendations` returns `Song[]` items. Converting each `Song` to `YouTubeSearchResult` format ensures that:
   - Card rendering logic matches `results.map` exactly.
   - `handlePlayNow(item)`, `handleAddToQueue(item)`, `handleToggleFavorite(item)`, `handleAddToPlaylist(item)`, and `isFavorited(item.id)` work seamlessly without modifying any handler logic.
4. **UX Integration**:
   - Section header: `"🎵 Sana Özel Öneriler"` with pulsing `Sparkles` icon and badge (e.g. `"${currentSong.artist}" tarzında` or `'Öne Çıkanlar'`).
   - Loading skeleton (6 pulse rows) during fetch.
   - Smooth transition when user types a search query: typing immediately hides recommendations and displays search results. Clearing search returns to recommendation state.

---

## 3. Caveats

- If `LASTFM_API_KEY` is missing in `.env.local`, `/api/recommendations` automatically falls back to YouTube search mix, ensuring 5–8 recommendations are always returned.
- If network error occurs during recommendation fetch, `recsError` state handles it by displaying a friendly fallback notice without crashing the UI.

---

## 4. Conclusion

The proposed design replaces the static placeholder in `components/SearchDrawer.tsx` with a dynamic 6-track recommendation section (`"🎵 Sana Özel Öneriler"`). It integrates seamlessly with `usePlayerStore`, leverages the `/api/recommendations` route, uses `songToYouTubeSearchResult` adapter to enable out-of-the-box action handlers, and preserves all dark glassmorphic styling and Framer Motion animations.

---

## 5. Verification Method

1. **Inspection**:
   - Inspect `components/SearchDrawer.tsx` line 365–377 before and after changes.
   - Verify `Sparkles` icon import and state declarations (`recommendations`, `isRecsLoading`, `recsError`).
2. **Build & Lint Verification**:
   - Run `npm run lint` to verify zero ESLint errors.
   - Run `npm run build` to verify Next.js page compilation.
