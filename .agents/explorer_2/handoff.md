# Handoff Report — Explorer 2: UI Component Architecture & Integration Points

## 1. Observation
Direct observations gathered from codebase analysis:
- **`app/page.tsx`**: Renders fixed viewport shell (`h-[100dvh] w-full overflow-hidden flex flex-col justify-end pb-safe`). Top-to-bottom layout stacks `<AudioEngine />`, `<BackgroundSlideshow />` (z-0), `<FloatingSprites />` (z-30), `<BirthdayGreeting />` (z-50), and main player components `<NowPlaying />`, `<CustomSeekbar />`, `<PlayerControls />`, and drawer trigger buttons (`<PlaylistDrawer />`, `<SearchDrawer />`) at z-10.
- **`components/PlaylistDrawer.tsx`**: Tab state is currently defined at line 15: `const [activeTab, setActiveTab] = useState<'playlists' | 'favorites'>('playlists');`. Header tab buttons are rendered at lines 121-148 inside a pill container (`bg-black/30 p-1 rounded-xl`).
- **`components/SearchDrawer.tsx`**: State open toggle is controlled by Zustand store `searchDrawerOpen` (`line 12`). Initial empty query state is rendered at lines 365-377 showing a static empty placeholder icon and text `"YouTube'da Şarkı Ara"`.
- **`components/PlayerControls.tsx`**: Horizontal glass bar (`flex items-center justify-center gap-4 sm:gap-6 p-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg`) containing `Search`, `Shuffle`, `SkipBack`, `Play/Pause`, `SkipForward`, `Repeat`, `Heart`, and `ListPlus` action buttons. Currently lacks a lyrics trigger button.
- **`components/AudioEngine.tsx`**: Contains dual player engine (HTML5 `<audio id="player-audio">` + YouTube iFrame `window.YT.Player`). Periodically polls YouTube current time every 500ms at lines 202-223: `setCurrentTime(time); setDuration(dur);`.
- **`store/playerStore.ts`**: Zustand store exporting `usePlayerStore`. Holds `currentSong`, `isPlaying`, `currentTime`, `duration`, `favorites`, `queue`, `searchDrawerOpen`, `setCurrentSong`, `play`, `addToQueue`, `toggleFavorite`.
- **`package.json`**: Dependencies include `framer-motion` (v12.43.0), `lucide-react` (v1.27.0), `zustand` (v5.0.14), `next` (v16.2.12), `react` (v19.2.4).

## 2. Logic Chain
1. **Observation 1 & 5**: `AudioEngine.tsx` periodically updates `currentTime` in the Zustand `usePlayerStore` every 500ms during playback.
   - **Reasoning**: This store state provides continuous, low-overhead timestamp updates accessible by any component in the app.
   - **Deduction**: `LyricsSheet.tsx` can consume `usePlayerStore((state) => state.currentTime)` directly to highlight active LRC timestamped lines without needing custom event listeners or audio engine modifications.
2. **Observation 2**: `PlaylistDrawer.tsx` manages tabs via `activeTab` state union `'playlists' | 'favorites'`.
   - **Reasoning**: Extending `activeTab` to `'playlists' | 'favorites' | 'discover'` allows seamless addition of the "Keşfet" tab without disrupting existing playlist loading or favorites display logic.
   - **Deduction**: Adding a third button in the header pill container and a conditional rendering block for `'discover'` integrates the 10-15 recommended songs UI cleanly.
3. **Observation 3**: `SearchDrawer.tsx` currently displays a static empty placeholder when `query` is empty and `hasSearched` is false.
   - **Reasoning**: Replacing lines 365-377 with a dynamic recommendation list ("🎵 Sana Özel Öneriler") provides immediate value when the user opens the search drawer.
   - **Deduction**: Reusing the `YouTubeSearchResult` mapping pattern from `SearchDrawer` (`convertToSong`) ensures recommendation tracks can immediately leverage existing `handlePlayNow`, `handleAddToQueue`, and `handleToggleFavorite` handlers.
4. **Observation 1**: `app/page.tsx` stacks `<NowPlaying />`, `<CustomSeekbar />`, and `<PlayerControls />` vertically inside a flex column layout.
   - **Reasoning**: Placing a horizontal scrollable row (`UpNextRow`) directly below `NowPlaying` fits into the visual hierarchy without overflowing the screen height.
   - **Deduction**: A compact horizontal row card design (`w-40 flex-shrink-0`) preserves the mobile-first non-scrollable shell height while enabling quick song queuing.
5. **Observation 4 & 5**: `PlayerControls.tsx` has action buttons for search, shuffle, play/pause, repeat, favorite, and add-to-playlist, but no lyrics button.
   - **Reasoning**: Adding a `MicVocal` or ♪ button in `PlayerControls.tsx` toggles a `isLyricsOpen` state (or store flag).
   - **Deduction**: Opening `LyricsSheet.tsx` via this button provides instant slide-up access to synced karaoke lyrics using the exact glassmorphic design language of existing drawers.

## 3. Caveats
- `AudioEngine.tsx` updates YouTube time at 500ms intervals; while sufficient for karaoke line sync, rapid sub-second timestamp transitions might have up to a ~500ms latency.
- Recommended songs rely on `currentSong` metadata (`title` & `artist`). If `currentSong` is null, components must render graceful empty state placeholders.

## 4. Conclusion
The UI architecture of Selin Music Player is modular, glassmorphic, and well-structured around Zustand state. All 4 target integration points ("Keşfet" tab in `PlaylistDrawer`, default recommendations state in `SearchDrawer`, "Up Next" horizontal row on `app/page.tsx`, and `MicVocal` lyrics button triggering `LyricsSheet.tsx`) can be seamlessly integrated into the existing component tree without breaking the current responsive layout or player engine. Detailed technical blueprints and component designs have been documented in `.agents/explorer_2/analysis.md`.

## 5. Verification Method
1. Inspect `.agents/explorer_2/analysis.md` to verify all required UI component architectures, styling tokens, and integration points are documented.
2. Verify target component files exist and match line numbers noted:
   - `components/PlaylistDrawer.tsx`
   - `components/SearchDrawer.tsx`
   - `components/PlayerControls.tsx`
   - `components/AudioEngine.tsx`
   - `app/page.tsx`
3. Run project lint check to ensure project structure remains sound:
   - Command: `npm run lint` (or `npx eslint`)
