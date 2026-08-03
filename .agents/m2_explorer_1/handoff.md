# Handoff Report — M2 "Keşfet" (Discover) 3rd Tab Integration Design

## 1. Observation
- Target Component: `components/PlaylistDrawer.tsx` (Lines 1 to 291).
- Current State: `activeTab` is defined on line 15 as `useState<'playlists' | 'favorites'>('playlists')`.
- Header Container: Lines 121-148 contain `<div className="flex items-center gap-2 bg-black/30 p-1 rounded-xl">` with buttons for "Çalma Listeleri" and "💖 Favorilerim".
- Store Integration: `usePlayerStore` (imported from `@/store/playerStore` on line 7) provides `currentSong`, `favorites`, `fetchFavorites`, `play`, `setCurrentSong`, `addToQueue`, and `toggleFavorite`.
- API Endpoint: `app/api/recommendations/route.ts` accepts `GET /api/recommendations?title=X&artist=Y&limit=15` and returns `{ recommendations: Song[] }`.
- Build Status: Executed `npm run build` — compiled successfully with exit code 0.

## 2. Logic Chain
1. **State Extension**: Extending `activeTab` to `'playlists' | 'favorites' | 'discover'` enables 3-tab navigation within `PlaylistDrawer.tsx` while preserving existing playlist and favorites tab logic.
2. **UI Consistency**: Adding a 3rd pill button with icon `Sparkles` from `lucide-react` maintains the existing glassmorphic styling (`bg-pink-500 text-white shadow-md` when active, `text-gray-400 hover:text-white` when inactive).
3. **Data Fetching**: When `activeTab === 'discover'` and `isOpen` is true, recommendations are fetched from `/api/recommendations` using `currentSong?.title` and `currentSong?.artist`.
4. **State Management**:
   - `recommendations`: `Song[]` stores fetched recommended songs.
   - `loadingRecommendations`: `boolean` drives the loading skeleton UI.
   - `recommendationsError`: `string | null` drives the error state and retry mechanism.
   - `toastMessage`: `string | null` displays animated feedback when queue or favorite actions complete.
5. **Action Handlers**:
   - **Play**: Calls `setCurrentSong(song)`, `play()`, and closes drawer (`setIsOpen(false)`).
   - **+Queue**: Calls `addToQueue(song)` and shows a toast notification.
   - **Favorite**: Calls `toggleFavorite(song)` and updates pink heart highlight state based on `favorites`.

## 3. Caveats
- Read-only investigation: Source code (`components/PlaylistDrawer.tsx`) was NOT edited directly by this explorer agent.
- Complete proposed component replacement code is provided in `analysis.md` for implementer.
- If `currentSong` has no artist or title (e.g. initial player state), an explicit friendly empty state ("Şu Anda Çalan Şarkı Yok") is displayed.

## 4. Conclusion
The design for the "Keşfet" (Discover) 3rd tab integration in `components/PlaylistDrawer.tsx` is completely specified, fully styled in Tailwind CSS + Framer Motion matching Selin Music Player's glassmorphic pink/purple theme, and ready for immediate implementation.

## 5. Verification Method
1. **Source Inspection**: Check `components/PlaylistDrawer.tsx` after implementation against the design in `analysis.md`.
2. **Build Verification**:
   ```bash
   npm run lint
   npm run build
   ```
   Both commands must exit with code 0.
3. **Functional Verification**:
   - Open PlaylistDrawer and tap "Keşfet".
   - Verify empty state when no song is playing.
   - Play a song and tap "Keşfet" -> verify skeleton loading and recommendation cards (10-15 items).
   - Test Play (starts playback), +Queue (adds to queue), and Heart (toggles favorite status).
