# UI Component Architecture & Integration Points Analysis

## Executive Summary
This document presents an architectural breakdown of the UI component layer of the **Selin Music Player** Next.js application (`selin-player`). It details the component hierarchy, visual design system (dark glassmorphism, Tailwind CSS, Framer Motion), player state management (Zustand), dual audio engine mechanics, and concrete integration blueprints for the upcoming **Song Recommendations** and **Karaoke-style Synced Lyrics Viewer** features.

---

## 1. UI Component Architecture & Page Layout

### 1.1 Layer Hierarchy & Z-Index Stacking (`app/page.tsx`)
`app/page.tsx` serves as the primary viewport shell. It enforces a full-screen, non-scrollable mobile-first viewport (`h-[100dvh] w-full overflow-hidden flex flex-col justify-end pb-safe`).

The application UI is structured into 5 distinct z-index layers:
1. **Background Layer (`z-0`)**: `BackgroundSlideshow.tsx` — Renders full-screen background images and video slideshows with ambient motion.
2. **Main Player Viewport Layer (`z-10`)**:
   - `NowPlaying.tsx`: Track title, artist, cover artwork display, and subtle pulse animations.
   - `CustomSeekbar.tsx`: Interactive audio progress bar showing `currentTime` and `duration`.
   - `PlayerControls.tsx`: Glassmorphic action bar with playback controls.
   - Drawer Trigger Buttons: Floating trigger pill buttons for `PlaylistDrawer` and `SearchDrawer`.
3. **Interactive Sprites Layer (`z-30`)**: `FloatingSprites.tsx` — Floating animated characters rendered above the main controls.
4. **Backdrop Overlays Layer (`z-40`)**: `fixed inset-0 bg-black/60 backdrop-blur-sm` or `bg-black/70 backdrop-blur-md` overlays rendered when modals or drawers are open.
5. **Drawers & Modals Layer (`z-50`)**: Slide-up sheet containers (`PlaylistDrawer.tsx`, `SearchDrawer.tsx`, `BirthdayGreeting.tsx`) bounded by `max-w-3xl mx-auto`.

---

## 2. Design Language & Styling Patterns

### 2.1 Dark Glassmorphism System
The player uses a dark, vibrant glassmorphism palette styled with Tailwind CSS:
- **Translucent Backgrounds**: `bg-gray-900/90`, `bg-gray-950/90`, `bg-white/10`, `bg-black/30`, `bg-black/40`.
- **Backdrop Blur**: `backdrop-blur-xl`, `backdrop-blur-2xl`, `backdrop-blur-md`.
- **Borders & Dividers**: `border border-white/10`, `border-white/20`, `border-t border-white/10`, `border-pink-500/30`.
- **Accent Gradients & Colors**:
  - Primary Accent: Pink (`bg-pink-500`, `#ec4899`, `text-pink-300`, `text-pink-400`).
  - Secondary Accent: Purple (`bg-purple-600`, `#9333ea`, `text-purple-300`).
  - Gradient Fills: `bg-gradient-to-br from-pink-500 to-purple-600`, `from-pink-500/20 to-purple-600/20`.
- **Shadows & Glows**: `shadow-[0_-10px_40px_rgba(236,72,153,0.15)]`, `shadow-lg`, `shadow-md`.

### 2.2 Framer Motion Animation Patterns
- **Backdrop Fades**: `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />`
- **Slide-up Sheet Drawers**:
  ```tsx
  <motion.div
    initial={{ y: '100%' }}
    animate={{ y: 0 }}
    exit={{ y: '100%' }}
    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
  />
  ```
- **Micro-Interactions**: Hover scale (`hover:scale-105`), active press shrink (`active:scale-95`), pulsating indicators (`animate-pulse`).

### 2.3 Responsive & PWA Layout Considerations
- Utilizes CSS safe area padding utilities (`pb-safe`, `pt-safe`) for iOS notches and bottom navigation bars.
- Controls hide non-essential labels on small mobile screens (e.g., `<span className="hidden sm:inline">...</span>`).
- Text headers and song titles enforce strict truncation rules (`truncate`, `min-w-0`, `overflow-hidden`) to prevent layout breaking on mobile screens.

---

## 3. Core Component Analysis

### 3.1 `PlaylistDrawer.tsx`
- **Current Tab Implementation**:
  - Uses `activeTab` state (`'playlists' | 'favorites'`).
  - Tab switcher header (`lines 121-148`): Pill container (`bg-black/30 p-1 rounded-xl`) housing active/inactive buttons styled with `bg-pink-500 text-white shadow-md`.
  - Main scrollable content container (`lines 159-265`): Conditional rendering based on `activeTab`. Fetches user playlists from Supabase or loads favorite songs from Zustand `favorites` state.

### 3.2 `SearchDrawer.tsx`
- **Current Search & Drawer Implementation**:
  - Managed by store state `searchDrawerOpen` and `setSearchDrawerOpen`.
  - Auto-focuses search input field on open via `inputRef`.
  - Debounces input queries by 400ms before calling `/api/search?q=...`.
  - Current empty state (`lines 365-377`): Displays a static placeholder ("YouTube'da Şarkı Ara") when `query` is empty and `hasSearched` is false.

### 3.3 `PlayerControls.tsx`
- **Control Bar Layout**:
  - Horizontal flexbox container with glassmorphic backdrop: `flex items-center justify-center gap-4 sm:gap-6 p-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg`.
  - Current Action Buttons:
    1. Search (`Search` icon) -> Opens `SearchDrawer`.
    2. Shuffle (`Shuffle` icon) -> Toggles shuffle state.
    3. Previous Track (`SkipBack` icon) -> Triggers `prevSong()`.
    4. Play/Pause (`Play` / `Pause` icon inside prominent gradient circle).
    5. Next Track (`SkipForward` icon) -> Triggers `nextSong()`.
    6. Repeat (`Repeat` / `Repeat1` icon) -> Cycles repeat mode (`off` -> `all` -> `single`).
    7. Favorite Heart (`Heart` icon) -> Toggles favorite state in Supabase.
    8. Add to Playlist (`ListPlus` icon) -> Triggers `AddToPlaylistModal`.

### 3.4 `AudioEngine.tsx`
- **Playback & Synchronization Mechanism**:
  - Handles dual audio playback: HTML5 `<audio id="player-audio">` for standard audio files and YouTube iFrame API (`window.YT.Player`) for YouTube streams.
  - Controls playback state based on `currentSong.youtube_id`.
  - Crucial Time Sync: Periodically checks YouTube player time every 500ms (`setInterval`) and updates Zustand store's `currentTime` state (`lines 202-223`). For standard audio, updates `currentTime` via `onTimeUpdate` (`lines 253-257`).
  - **Relevance to Lyrics**: This precise 500ms `currentTime` update is what drives synced karaoke line highlighting in real-time.

---

## 4. Integration Blueprints & Component Specifications

### 4.1 Feature 1: "Keşfet" (Discover) Tab in `PlaylistDrawer.tsx`
- **State Modifications**:
  - Expand `activeTab` state type: `type TabType = 'playlists' | 'favorites' | 'discover';`.
  - Add local state: `recommendations: Song[]`, `loadingRecommendations: boolean`.
- **UI & Layout Specification**:
  - Add a third tab button to the top tab bar:
    ```tsx
    <button
      onClick={() => {
        setActiveTab('discover');
        fetchRecommendations();
      }}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
        activeTab === 'discover'
          ? 'bg-pink-500 text-white shadow-md'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      <Sparkles size={16} />
      ✨ Keşfet
    </button>
    ```
  - Discover Content Panel:
    - Automatically fetches recommendations from `/api/recommendations?title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`.
    - If no song is playing, display an empty state guidance ("Şu an çalan şarkı yok. Bir şarkı çalarak önerileri keşfedin!").
    - Render a vertical list of 10-15 recommended songs with artwork, title, artist, duration, and action buttons (`Play Now`, `+ Queue`, `💖 Favorite`).

### 4.2 Feature 2: Default Recommendations State in `SearchDrawer.tsx`
- **Integration Target**:
  - Replace the current static empty placeholder (`lines 365-377`) in `SearchDrawer.tsx`.
- **UI & Layout Specification**:
  - When `!query.trim()` and `!hasSearched`:
    - Fetch 5-8 recommendations (via `/api/recommendations`) based on `currentSong` (or fallback top hits).
    - Display section header: `🎵 Sana Özel Öneriler` with subtitle `Şu an dinlediğin şarkıya benzer öneriler`.
    - Display compact recommendation song cards.
    - User can tap any recommendation card to play immediately, add to queue, or favorite without needing to type a search query.

### 4.3 Feature 3: "Up Next" Horizontal Scroll Row on `app/page.tsx`
- **Integration Target**:
  - Insert on `app/page.tsx` right below `NowPlaying` (or between `CustomSeekbar` and `PlayerControls`).
- **UI & Layout Specification**:
  - Build component `components/UpNextRow.tsx`:
    - Renders a section header: `Şırada Ne Var?` / `✨ Up Next`.
    - Renders a horizontal scroll container: `flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-none`.
    - Compact Card Component (`w-40 flex-shrink-0 snap-start bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-2.5`):
      - Cover thumbnail image with play overlay button.
      - Truncated title & artist text.
      - Quick "+ Sıraya Ekle" (Add to Queue) icon button.
    - Automatically updates recommendations whenever `currentSong` changes.

### 4.4 Feature 4: Lyrics Trigger Button & `LyricsSheet.tsx` Design
- **Integration Target in `PlayerControls.tsx`**:
  - Add a ♪ / `MicVocal` icon button to the `PlayerControls` bar:
    ```tsx
    <button
      onClick={() => setIsLyricsOpen(true)}
      disabled={!currentSong}
      className={`p-2 rounded-full transition-colors ${
        !currentSong
          ? 'opacity-40 cursor-not-allowed text-gray-400'
          : isLyricsOpen
          ? 'text-pink-400 bg-white/10'
          : 'text-gray-300 hover:text-white hover:bg-white/10'
      }`}
      aria-label="Şarkı Sözleri"
      title="Şarkı Sözleri (Karaoke)"
    >
      <MicVocal size={20} />
    </button>
    ```
- **New Component: `components/LyricsSheet.tsx`**:
  - Slide-up modal sheet built with Framer Motion, styled consistently with `SearchDrawer` (`bg-gray-950/90 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl h-[80vh] z-50`).
  - Header: Displays current song title, artist, and a close button (`X`).
  - Synced Karaoke Lyrics Renderer:
    - Fetches lyrics from `/api/lyrics?title=...&artist=...`.
    - Parses LRC timestamp format (`[mm:ss.xx] line text`) into structured objects: `{ time: number, text: string }`.
    - Subscribes to `currentTime` from `usePlayerStore()`.
    - Identifies active line: line index `i` where `lines[i].time <= currentTime` and (`i === lines.length - 1` || `currentTime < lines[i + 1].time`).
    - Highlights active line: `text-pink-400 scale-105 font-bold drop-shadow-[0_0_12px_rgba(236,72,153,0.6)] transition-all duration-300`.
    - Non-active lines: `text-gray-400/70 hover:text-white transition-opacity`.
    - Auto-scrolling: Automatically scrolls active line into center view (`element.scrollIntoView({ behavior: 'smooth', block: 'center' })`).
  - Fallback Plain Text Renderer:
    - If `synced: false`, renders scrollable plain text lines.
  - Empty State Handling:
    - Displays friendly Turkish message when no lyrics are found: `"Şarkı sözü bulunamadı 🎶"`.

---

## 5. Architectural Data Flow & State Summary

```
                  ┌────────────────────────┐
                  │   Zustand PlayerStore  │
                  │  (currentSong, time)   │
                  └───────────┬────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│ PlaylistDrawer  │  │   SearchDrawer   │  │   UpNextRow     │
│  ("Keşfet" Tab) │  │(Default Recs UI) │  │  (app/page.tsx) │
└────────┬────────┘  └────────┬─────────┘  └────────┬────────┘
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              │ GET /api/recommendations?title=X&artist=Y
                              ▼
                   ┌─────────────────────┐
                   │ Last.fm track.get-  │
                   │ Similar + YouTube   │
                   └─────────────────────┘

                              │
                              │ currentSong & currentTime
                              ▼
                   ┌─────────────────────┐
                   │   LyricsSheet.tsx   │
                   │ (GET /api/lyrics)   │
                   └─────────────────────┘
```

---

## 6. Recommendations for Implementation Phase
1. **Reuse Existing Conversion Utility**: Ensure all recommendation items are formatted into valid `Song` objects (`id: 'yt-${yt.id}'`, `youtube_id`, `audio_url`, `duration`, `cover_url`) to cleanly work with Zustand store functions (`setCurrentSong`, `addToQueue`, `toggleFavorite`).
2. **AudioEngine Synchronized Karaoke**: Rely on the existing 500ms polling mechanism in `AudioEngine.tsx` for updating `currentTime`. It provides smooth, low-overhead timestamp updates ideal for karaoke sync.
3. **Smooth Scroll Behavior**: When implementing auto-scroll in `LyricsSheet.tsx`, add a gentle smooth scroll behavior and respect user manual scrolling gestures (e.g. pause auto-scroll temporarily if user manually scrolls the lyrics container).
