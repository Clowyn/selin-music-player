# Milestone 3 — Lyrics Viewer Integration & Architectural Design Handoff

## 1. Observation

Direct code examination of `components/PlayerControls.tsx`, `store/playerStore.ts`, `app/page.tsx`, `components/PlaylistDrawer.tsx`, and `components/SearchDrawer.tsx` revealed the following structural details:

### A. `components/PlayerControls.tsx` (126 lines)
- **Current layout & container** (Line 36):
  ```tsx
  <div className="flex items-center justify-center gap-4 sm:gap-6 p-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
  ```
- **Current 8 buttons (in sequential order)**:
  1. `Search` (Lines 37-43) — calls `setSearchDrawerOpen(true)`
  2. `Shuffle` (Lines 45-51) — toggles shuffle state; active class: `'text-pink-400 bg-white/10'`
  3. `SkipBack` (Lines 53-59) — size 28
  4. `Play / Pause` (Lines 61-67) — central main button (`w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600`)
  5. `SkipForward` (Lines 69-75) — size 28
  6. `Repeat` (Lines 77-83) — cycles repeat mode; active class: `'text-pink-400 bg-white/10'`
  7. `Heart` (Lines 85-98) — toggles favorites; active class: `'text-[#ec4899] bg-white/10'`
  8. `ListPlus` (Lines 100-112) — opens `AddToPlaylistModal`
- **Imports** (Line 4): `import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, Search, Heart, ListPlus } from 'lucide-react';`

### B. `store/playerStore.ts` (220 lines)
- Currently holds global player state and `searchDrawerOpen` visibility:
  - `searchDrawerOpen: boolean` (Line 17)
  - `setSearchDrawerOpen: (open: boolean) => void` (Line 36)
  - Implementation (Line 159): `setSearchDrawerOpen: (open: boolean) => set({ searchDrawerOpen: open })`
- Does NOT currently have lyrics drawer state (`isLyricsOpen` / `setLyricsOpen`).

### C. `app/page.tsx` (67 lines)
- Main view layout structure:
  - Lines 52-55: `<div className="px-6 mb-3"><PlayerControls /></div>`
  - Lines 57-61: `<div className="px-6 mb-6 flex items-center justify-center gap-4"><PlaylistDrawer /><SearchDrawer /></div>`
- Mounting structure: Currently mounts `<AudioEngine />`, `<BackgroundSlideshow />`, `<FloatingSprites />`, `<BirthdayGreeting />`, `<NowPlaying />`, `<UpNextRow />`, `<CustomSeekbar />`, `<PlayerControls />`, `<PlaylistDrawer />`, `<SearchDrawer />`.

### D. Existing Drawer Behaviors (`PlaylistDrawer.tsx` & `SearchDrawer.tsx`)
- Both drawers use Framer Motion slide-up animations (`initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}`).
- Both render fixed backdrops with `z-40` (`fixed inset-0 bg-black/70 backdrop-blur-md` or `bg-black/60 backdrop-blur-sm`).
- Both render fixed slide-up sheet panels with `z-50` (`fixed inset-x-0 bottom-0 z-50 max-h-[80vh]` / `h-[85vh]`).

---

## 2. Logic Chain

1. **Button Placement & Visual Balance in `PlayerControls.tsx`**:
   - Adding a 9th button (`MicVocal` icon from `lucide-react`) to `PlayerControls.tsx` requires careful placement to maintain layout symmetry and avoid mobile layout clipping.
   - Positioning `MicVocal` at the far left or immediately beside `Search` creates a 4 - 1 - 4 symmetrical structure:
     - Left (4 buttons): `MicVocal` (Lyrics Drawer), `Search` (Search Drawer), `Shuffle` (Mode), `SkipBack` (Nav)
     - Center (1 button): `Play / Pause`
     - Right (4 buttons): `SkipForward` (Nav), `Repeat` (Mode), `Heart` (Favorite), `ListPlus` (Add to Playlist)
   - Using `MicVocal` (size 20) with active state styling matching the design language (`text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]` when open vs `text-gray-300 hover:text-white hover:bg-white/10` when closed) provides clear visual feedback.
   - Responsive adjustments (e.g., `gap-1.5 min-[380px]:gap-2.5 sm:gap-6 p-3 sm:p-4`) prevent horizontal overflow on smaller mobile viewports (360px–390px).

2. **State Management Architecture for Lyrics Drawer**:
   - `searchDrawerOpen` is already globally managed in `store/playerStore.ts`.
   - Managing `isLyricsOpen` in `store/playerStore.ts` maintains single-source-of-truth state architecture.
   - Store actions:
     ```typescript
     isLyricsOpen: boolean;
     setLyricsOpen: (open: boolean) => void;
     toggleLyricsOpen: () => void;
     ```
   - Store-level handling enables mutual exclusion: calling `setLyricsOpen(true)` automatically sets `searchDrawerOpen: false`, preventing multiple slide-up drawers from overlapping visually.

3. **`app/page.tsx` Integration & Drawer Stacking**:
   - `<LyricsSheet />` should be mounted at the root level of `app/page.tsx` alongside `SearchDrawer` and `PlaylistDrawer`.
   - All drawers use `z-40` for backdrop overlay and `z-50` for sheet container.
   - With store-level drawer state coordination, opening `LyricsSheet` automatically closes `SearchDrawer`, guaranteeing clean visual hierarchy and preventing duplicate backdrop blurs.

---

## 3. Caveats

- `LyricsSheet.tsx` component implementation is part of Milestone 3 and may be developed concurrently. This handoff provides the explicit integration interface contract that `LyricsSheet.tsx` should consume (`usePlayerStore((state) => state.isLyricsOpen)` and `setLyricsOpen`).
- `PlaylistDrawer.tsx` currently manages its `isOpen` state locally via React `useState`. If `PlaylistDrawer` is opened, opening `LyricsSheet` or `SearchDrawer` via `PlayerControls` will overlay on top (z-index 50). If strict single-drawer enforcement is required across all 3 drawers, `PlaylistDrawer` can also subscribe to store events or check store drawer state.

---

## 4. Conclusion & Architectural Design

### Recommendation 1: `store/playerStore.ts` State Extension
Add the following fields and actions to `PlayerState` in `store/playerStore.ts`:

```typescript
// Add to PlayerState interface:
isLyricsOpen: boolean;
setLyricsOpen: (open: boolean) => void;
toggleLyricsOpen: () => void;

// Add to store implementation:
isLyricsOpen: false,

setLyricsOpen: (open: boolean) => set((state) => ({
  isLyricsOpen: open,
  searchDrawerOpen: open ? false : state.searchDrawerOpen,
})),

toggleLyricsOpen: () => set((state) => ({
  isLyricsOpen: !state.isLyricsOpen,
  searchDrawerOpen: !state.isLyricsOpen ? false : state.searchDrawerOpen,
})),
```
Also update `setSearchDrawerOpen` in `store/playerStore.ts`:
```typescript
setSearchDrawerOpen: (open: boolean) => set((state) => ({
  searchDrawerOpen: open,
  isLyricsOpen: open ? false : state.isLyricsOpen,
})),
```

### Recommendation 2: `components/PlayerControls.tsx` Updates
1. Import `MicVocal` from `lucide-react`.
2. Extract `isLyricsOpen` and `toggleLyricsOpen` (or `setLyricsOpen`) from `usePlayerStore()`.
3. Add the `MicVocal` icon button as the 1st button in the control bar for optimal 4-1-4 layout symmetry:

```tsx
<button
  onClick={toggleLyricsOpen}
  className={`p-2 rounded-full transition-all ${
    isLyricsOpen
      ? 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
      : 'text-gray-300 hover:text-white hover:bg-white/10'
  }`}
  aria-label="Şarkı Sözleri"
  title="Şarkı Sözleri (Karaoke)"
>
  <MicVocal size={20} />
</button>
```

4. Adjust container styles to handle 9 buttons responsively:
```tsx
<div className="flex items-center justify-center gap-1.5 min-[380px]:gap-2.5 sm:gap-6 p-3 sm:p-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
```

### Recommendation 3: `app/page.tsx` Integration
Mount `<LyricsSheet />` at the bottom of `app/page.tsx`:

```tsx
// app/page.tsx
import LyricsSheet from '@/components/LyricsSheet';

export default function Home() {
  return (
    <main className="relative flex flex-col h-[100dvh] w-full overflow-hidden">
      {/* Hidden audio engine */}
      <AudioEngine />
      {/* Background & Visuals */}
      <BackgroundSlideshow />
      <FloatingSprites />
      <BirthdayGreeting />

      {/* Main player layout */}
      <div className="relative z-10 flex flex-col h-full justify-end pb-safe">
        <div className="pt-safe" />
        <div className="flex-1" />
        <div className="px-6 mb-2"><NowPlaying /></div>
        <div className="px-6 mb-3"><UpNextRow /></div>
        <div className="px-6 mb-3"><CustomSeekbar /></div>
        <div className="px-6 mb-3"><PlayerControls /></div>
        <div className="px-6 mb-6 flex items-center justify-center gap-4">
          <PlaylistDrawer />
          <SearchDrawer />
        </div>
      </div>

      {/* Slide-up Lyrics Sheet */}
      <LyricsSheet />
    </main>
  );
}
```

---

## 5. Verification Method

1. **Codebase Inspection**:
   - Check `store/playerStore.ts` for `isLyricsOpen`, `setLyricsOpen`, and `toggleLyricsOpen`.
   - Check `components/PlayerControls.tsx` for `MicVocal` import, toggle listener, and pink glow active styling.
   - Check `app/page.tsx` for `<LyricsSheet />` component mount.

2. **Lint and Build Verification**:
   - Run `npm run lint` to ensure zero ESLint errors across all files.
   - Run `npm run build` to verify Next.js TypeScript compilation and routing.

3. **UI & Behavioral Verification**:
   - Open app on desktop and mobile viewports (375px width).
   - Verify `PlayerControls` renders 9 buttons without wrapping or horizontal overflow.
   - Click ♪ / `MicVocal` icon in `PlayerControls`: verify icon activates pink glow indicator and `LyricsSheet` slides up from bottom.
   - Click `Search` icon while lyrics sheet is open: verify `LyricsSheet` closes and `SearchDrawer` opens without backdrop stacking issues.
