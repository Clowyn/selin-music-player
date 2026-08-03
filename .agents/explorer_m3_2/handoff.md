# Handoff Report: LyricsSheet UI Specification & Architectural Design

## 1. Summary
This report provides a technical investigation and comprehensive architectural specification for `components/LyricsSheet.tsx` (Milestone 3). The component renders a glassmorphic slide-up drawer containing time-synced (karaoke) or static lyrics fetched from `/api/lyrics`. It integrates with `usePlayerStore` (`currentSong`, `currentTime`, `isPlaying`, `seekTo`) and follows existing design language and Framer Motion animation patterns established in `PlaylistDrawer.tsx` and `SearchDrawer.tsx`.

---

## 2. Observation

### 2.1 Existing UI Drawer & Framer Motion Patterns
1. **Backdrop Overlay (`SearchDrawer.tsx:219-225`)**:
   ```tsx
   <motion.div
     initial={{ opacity: 0 }}
     animate={{ opacity: 1 }}
     exit={{ opacity: 0 }}
     onClick={() => setSearchDrawerOpen(false)}
     className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
   />
   ```
2. **Slide-Up Sheet Container (`SearchDrawer.tsx:228-234`)**:
   ```tsx
   <motion.div
     initial={{ y: '100%' }}
     animate={{ y: 0 }}
     exit={{ y: '100%' }}
     transition={{ type: 'spring', damping: 25, stiffness: 220 }}
     className="fixed inset-x-0 bottom-0 z-50 h-[85vh] max-w-3xl mx-auto bg-gray-950/90 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(236,72,153,0.15)] flex flex-col overflow-hidden"
   >
   ```
3. **Header Styling (`SearchDrawer.tsx:236-257`, `PlaylistDrawer.tsx:211-259`)**:
   - Header container: `p-4 border-b border-white/10 flex items-center justify-between bg-white/5`
   - Gradient icon pill: `w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-md`
   - Close button: `p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition` with `<X size={20} />` icon.

### 2.2 Store Consumption from `store/playerStore.ts`
- **Current State Properties (`playerStore.ts:5-18`)**:
  - `currentSong: Song | null` (`id`, `title`, `artist`, `cover_url`, `youtube_id`, `duration`)
  - `currentTime: number` (live playback elapsed time in seconds, updated by `AudioEngine.tsx`)
  - `isPlaying: boolean`
- **Actions (`playerStore.ts:32, 36`)**:
  - `seekTo: (time: number) => void` (seeks audio element or YouTube iFrame player to target timestamp)
  - `searchDrawerOpen: boolean` & `setSearchDrawerOpen: (open: boolean) => void` (pattern for global drawer open state)

### 2.3 Controls Trigger & Page Placement (`PlayerControls.tsx:34-113`, `app/page.tsx:58-61`)
- `PlayerControls.tsx` has horizontal action buttons (`Search`, `Shuffle`, `SkipBack`, `Play/Pause`, `SkipForward`, `Repeat`, `Heart`, `ListPlus`).
- `app/page.tsx` renders drawer triggers at bottom:
  ```tsx
  <div className="px-6 mb-6 flex items-center justify-center gap-4">
    <PlaylistDrawer />
    <SearchDrawer />
  </div>
  ```

---

## 3. Logic Chain & Architectural Design Specification

### 3.1 Component Architecture Overview
`components/LyricsSheet.tsx` will be a React Client Component (`'use client'`).

```
[ PlayerControls / Bottom Bar ] (♪ MicVocal Icon Button)
              │
              ▼
    [ LyricsSheet Component ] (Zustand: lyricsSheetOpen)
              │
    ┌─────────┴────────────────────────────────────────┐
    │                                                  │
[ Fetch /api/lyrics?title=X&artist=Y ]       [ Listen to currentTime & currentSong ]
    │                                                  │
    ├──────────────────────┬───────────────────────────┤
    │ (synced === true)    │ (synced === false)        │ (No lyrics / Error)
    ▼                      ▼                           ▼
[ Karaoke Sync View ]    [ Static Text View ]    [ Empty State View ]
 - Binary search active   - Pre-formatted text    - "Şarkı sözü bulunamadı"
   line index             - Scrollable block      - Music icon & retry
 - Pink glow styling
 - Auto-center scroll
 - Interactive seek
```

---

### 3.2 Detailed Step-by-Step Specification for `LyricsSheet.tsx`

#### Step 1: Store Integration & State Definitions
Add `lyricsSheetOpen: boolean` and `setLyricsSheetOpen: (open: boolean) => void` to `store/playerStore.ts` (matching `searchDrawerOpen`).

**Interface for Lyrics Response Data**:
```typescript
export interface LyricLine {
  time: number; // In seconds (e.g. 12.5)
  text: string;
}

export interface LyricsData {
  lyrics: string | null;
  synced: boolean;
  lines?: LyricLine[];
  error?: string;
}
```

**Local State in `LyricsSheet.tsx`**:
- `lyricsData: LyricsData | null`
- `isLoading: boolean`
- `error: string | null`
- `isUserScrolling: boolean` (manual scroll override state)
- `scrollTimeoutRef: useRef<NodeJS.Timeout | null>(null)`
- `containerRef: useRef<HTMLDivElement | null>(null)`
- `activeLineRef: useRef<HTMLDivElement | null>(null)`

---

#### Step 2: Lyrics Fetching Logic (`useEffect`)
Trigger fetch when `lyricsSheetOpen` is `true` OR when `currentSong` changes while sheet is open:
```typescript
useEffect(() => {
  if (!lyricsSheetOpen || !currentSong?.title) {
    if (!lyricsSheetOpen) setLyricsData(null);
    return;
  }

  let isMounted = true;
  setIsLoading(true);
  setError(null);

  const title = encodeURIComponent(currentSong.title);
  const artist = encodeURIComponent(currentSong.artist || '');
  const url = `/api/lyrics?title=${title}&artist=${artist}`;

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Şarkı sözleri alınamadı');
      return res.json();
    })
    .then((data: LyricsData) => {
      if (isMounted) {
        setLyricsData(data);
        setIsLoading(false);
      }
    })
    .catch((err) => {
      if (isMounted) {
        console.error('Fetch lyrics error:', err);
        setError('Şarkı sözleri yüklenirken bir hata oluştu');
        setIsLoading(false);
      }
    });

  return () => {
    isMounted = false;
  };
}, [lyricsSheetOpen, currentSong?.id, currentSong?.title, currentSong?.artist]);
```

---

#### Step 3: Karaoke Binary Search Algorithm
To find the active line index `i` given current timestamp `currentTime`:
```typescript
function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
  if (!lines || lines.length === 0) return -1;
  if (currentTime < lines[0].time) return -1;

  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}
```

---

#### Step 4: Line Highlighting & Interactive Seek
- **Active Line (`index === activeIndex`)**:
  ```tsx
  <div
    ref={index === activeIndex ? activeLineRef : null}
    onClick={() => seekTo(line.time)}
    className="py-3 px-6 my-1 rounded-2xl bg-pink-500/15 border border-pink-500/40 text-pink-300 font-bold text-lg sm:text-xl text-center scale-105 shadow-[0_0_20px_rgba(236,72,153,0.25)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
  >
    <MicVocal size={18} className="text-pink-400 animate-pulse flex-shrink-0" />
    <span>{line.text || '♪'}</span>
  </div>
  ```
- **Inactive Past Line (`index < activeIndex`)**:
  ```tsx
  <div
    onClick={() => seekTo(line.time)}
    className="py-2 px-4 my-1 text-gray-400 font-medium text-base text-center scale-95 opacity-70 hover:opacity-100 hover:text-white transition-all cursor-pointer"
  >
    {line.text || '♪'}
  </div>
  ```
- **Inactive Future Line (`index > activeIndex`)**:
  ```tsx
  <div
    onClick={() => seekTo(line.time)}
    className="py-2 px-4 my-1 text-gray-500 font-normal text-base text-center scale-95 opacity-50 hover:opacity-100 hover:text-gray-300 transition-all cursor-pointer"
  >
    {line.text || '♪'}
  </div>
  ```

---

#### Step 5: Smooth Auto-Scroll & Manual Override Handling
- **Auto-scroll Effect**:
  ```typescript
  useEffect(() => {
    if (isUserScrolling || activeIndex === -1) return;
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isUserScrolling]);
  ```

- **Manual Scroll Override Detection**:
  Attach `onWheel`, `onTouchMove` or `onScroll` to the scrollable `containerRef` div.
  When user manually scrolls, set `isUserScrolling = true`.
  Reset `isUserScrolling = false` after 5 seconds of inactivity or when user taps a floating button:
  ```tsx
  {isUserScrolling && (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={() => {
        setIsUserScrolling(false);
        if (activeLineRef.current) {
          activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-xs font-semibold shadow-lg backdrop-blur-md border border-white/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all z-10"
    >
      <Target size={14} />
      <span>Canlı Sözlere Dön</span>
    </motion.button>
  )}
  ```

---

#### Step 6: Static Fallback Display (`synced === false`)
When `synced === false` and plain lyrics exist:
```tsx
<div className="flex-1 overflow-y-auto px-6 py-6">
  {/* Non-synced Badge */}
  <div className="flex items-center justify-center gap-2 mb-6 text-xs text-purple-300/80 bg-purple-500/10 py-1.5 px-4 rounded-full border border-purple-500/20 max-w-fit mx-auto">
    <FileText size={14} />
    <span>Statik Şarkı Sözleri (Zaman Senkronizasyonu Yok)</span>
  </div>

  {/* Formatted Text Block */}
  <div className="text-gray-200 text-base sm:text-lg leading-relaxed text-center font-medium whitespace-pre-wrap select-text max-w-xl mx-auto space-y-2">
    {lyricsData.lyrics}
  </div>
</div>
```

---

#### Step 7: Empty State UI ("Şarkı sözü bulunamadı")
When `!isLoading` and no lyrics or lines are available:
```tsx
<div className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center">
  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(236,72,153,0.15)]">
    <Music size={40} className="text-pink-400 opacity-80 animate-pulse" />
  </div>
  <h3 className="text-lg font-bold text-white mb-2">
    Şarkı Sözü Bulunamadı
  </h3>
  <p className="text-xs text-gray-400 max-w-xs mb-6">
    {currentSong?.title
      ? `"${currentSong.title}" için zaman senkronizasyonlu veya statik şarkı sözü bulunamadı.`
      : 'Şu anda çalan bir şarkı bulunmuyor.'}
  </p>
  {currentSong?.title && (
    <button
      onClick={fetchLyrics}
      className="px-4 py-2.5 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 rounded-xl text-xs font-semibold border border-pink-500/30 transition-all flex items-center gap-2"
    >
      <RefreshCw size={14} />
      <span>Tekrar Deneyin</span>
    </button>
  )}
</div>
```

---

#### Step 8: Trigger Button Integration in `PlayerControls.tsx`
Add a ♪ (`MicVocal` icon from `lucide-react`) toggle button to `PlayerControls.tsx`:
```tsx
<button
  onClick={() => setLyricsSheetOpen(true)}
  disabled={!currentSong}
  className={`p-2 rounded-full transition-all ${
    !currentSong
      ? 'opacity-40 cursor-not-allowed text-gray-400'
      : lyricsSheetOpen
      ? 'text-pink-400 bg-pink-500/20 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
      : 'text-gray-300 hover:text-white hover:bg-white/10'
  }`}
  aria-label="Şarkı Sözlerini Göster"
  title="Şarkı Sözleri (Karaoke)"
>
  <MicVocal size={20} />
</button>
```

---

## 4. Caveats
1. **LRCLIB Search Variations**: Song titles on YouTube may contain extra descriptors like `(Official Music Video)` or `[HD]`. The API route (`app/api/lyrics/route.ts`) handled by `explorer_m3_1` must clean title strings before querying LRCLIB.
2. **Fast Forwarding / Seeking**: When user manual seeks via seekbar or progress bar, `currentTime` jumps instantly. Binary search handles arbitrary timestamp jumps smoothly without state corruption.
3. **Container Heights**: Using `h-[80vh]` ensures lyrics sheet fits well on both mobile screens and desktop browsers with `max-w-3xl`.

---

## 5. Conclusion
`components/LyricsSheet.tsx` completes Milestone 3's frontend requirement by offering a smooth, dark glassmorphic slide-up sheet with real-time karaoke active line highlighting (`text-pink-400 font-bold scale-105`), smooth centering auto-scroll, manual scroll overrides, static text fallbacks, and a friendly empty state.

---

## 6. Verification Method
1. **Code Inspection**:
   - Check `store/playerStore.ts` for `lyricsSheetOpen` and `setLyricsSheetOpen`.
   - Check `components/LyricsSheet.tsx` for `bg-gray-900/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl`.
   - Verify binary search algorithm implementation for `activeIndex`.
   - Verify `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
2. **Build Verification**:
   - Execute `npm run lint` (must pass with 0 errors).
   - Execute `npm run build` (must complete with exit code 0).
