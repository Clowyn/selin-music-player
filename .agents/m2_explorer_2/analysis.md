# Analysis: SearchDrawer Default Recommendation State Design

## 1. Executive Summary

This report presents the complete architectural design and implementation specification for replacing the static empty placeholder in `components/SearchDrawer.tsx` (lines 365-377) with a dynamic **"🎵 Sana Özel Öneriler"** recommendation section.

When a user opens the search drawer without entering a search query (`query.trim()` is empty and `hasSearched` is false), the drawer will now display 5–8 personalized song suggestions fetched from `/api/recommendations`. Recommendations are contextually driven by `currentSong` (title and artist) from `usePlayerStore`. If no song is currently playing, a top default mix is fetched.

To maintain zero code duplication and full compatibility with existing action handlers (`handlePlayNow`, `handleAddToQueue`, `handleToggleFavorite`, `handleAddToPlaylist`, and `isFavorited`), recommended tracks (returned as `Song` objects) are mapped into `YouTubeSearchResult` items via a clean `songToYouTubeSearchResult` adapter. When action buttons are clicked, `convertToSong` converts them back out-of-the-box.

---

## 2. Codebase Audit & Inspection

### 2.1 File: `components/SearchDrawer.tsx`

- **Lines 365–377 (Current Empty State)**:
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
  *Finding*: This is a static fallback placeholder rendered when `isLoading` is false, `results.length === 0`, and `hasSearched` is false.

- **Existing `convertToSong` helper (lines 93-101)**:
  ```tsx
  const convertToSong = (yt: YouTubeSearchResult): Song => ({
    id: `yt-${yt.id}`,
    title: yt.title,
    artist: yt.channelTitle,
    audio_url: `https://www.youtube.com/watch?v=${yt.id}`,
    youtube_id: yt.id,
    duration: yt.durationSeconds || 210,
    cover_url: yt.thumbnail,
  });
  ```

- **Action Handlers (lines 103–135)**:
  - `handlePlayNow(item: YouTubeSearchResult)`
  - `handleAddToQueue(item: YouTubeSearchResult)`
  - `handleToggleFavorite(item: YouTubeSearchResult)`
  - `handleAddToPlaylist(item: YouTubeSearchResult)`
  - `isFavorited(ytId: string)`
  *Finding*: All existing card actions accept `YouTubeSearchResult`.

---

## 3. Detailed Component & Data Flow Design

### 3.1 Store Integration
Extract `currentSong` from `usePlayerStore()`:
```tsx
const {
  searchDrawerOpen,
  setSearchDrawerOpen,
  currentSong,
  setCurrentSong,
  play,
  addToQueue,
  favorites,
  toggleFavorite,
} = usePlayerStore();
```

### 3.2 State Management
Add recommendation states to `SearchDrawer`:
```tsx
const [recommendations, setRecommendations] = useState<YouTubeSearchResult[]>([]);
const [isRecsLoading, setIsRecsLoading] = useState(false);
const [recsError, setRecsError] = useState(false);
```

### 3.3 Data Adapter: `songToYouTubeSearchResult`
Converts `Song` objects from `/api/recommendations` to `YouTubeSearchResult` items:
```tsx
const songToYouTubeSearchResult = (song: Song): YouTubeSearchResult => {
  const ytId = song.youtube_id || song.id.replace(/^yt-/, '');
  const mins = Math.floor((song.duration || 0) / 60);
  const secs = Math.floor((song.duration || 0) % 60);
  const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return {
    id: ytId,
    title: song.title,
    channelTitle: song.artist,
    thumbnail: song.cover_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
    duration: durationStr,
    durationSeconds: song.duration || 210,
  };
};
```

### 3.4 Recommendation Fetch Effect
Triggers when `searchDrawerOpen` is true or when `currentSong` changes:
```tsx
useEffect(() => {
  if (!searchDrawerOpen) return;

  let isMounted = true;
  const fetchRecommendations = async () => {
    setIsRecsLoading(true);
    setRecsError(false);

    try {
      let url = '/api/recommendations?limit=6';
      if (currentSong?.title && currentSong?.artist) {
        url += `&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
      } else if (currentSong?.title) {
        url += `&title=${encodeURIComponent(currentSong.title)}`;
      } else {
        // Top default fallback mix when no current song is playing
        url += `&title=Yolla&artist=Tarkan`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Öneriler yüklenemedi');
      const data = await res.json();

      if (isMounted && data.recommendations && Array.isArray(data.recommendations)) {
        const mapped: YouTubeSearchResult[] = data.recommendations.map((s: Song) =>
          songToYouTubeSearchResult(s)
        );
        setRecommendations(mapped);
      }
    } catch (err) {
      console.error('Error fetching recommendations in SearchDrawer:', err);
      if (isMounted) setRecsError(true);
    } finally {
      if (isMounted) setIsRecsLoading(false);
    }
  };

  fetchRecommendations();

  return () => {
    isMounted = false;
  };
}, [searchDrawerOpen, currentSong?.title, currentSong?.artist]);
```

### 3.5 UI Layout Design for `"🎵 Sana Özel Öneriler"`
Replaces lines 365–377 with:
```tsx
) : (
  <div className="space-y-4 pt-2">
    {/* Section Header */}
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-pink-400 animate-pulse" />
        <h3 className="text-sm font-bold text-white tracking-wide">
          🎵 Sana Özel Öneriler
        </h3>
      </div>
      <span className="text-[11px] text-purple-300/70 font-medium bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
        {currentSong?.artist ? `"${currentSong.artist}" tarzında` : 'Öne Çıkanlar'}
      </span>
    </div>

    {/* List / Skeleton / Empty State */}
    {isRecsLoading ? (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-20 bg-white/5 border border-white/5 rounded-2xl animate-pulse flex items-center p-3 gap-3"
          >
            <div className="w-14 h-14 bg-white/10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    ) : recommendations.length > 0 ? (
      <div className="space-y-3">
        {recommendations.map((item) => {
          const favorited = isFavorited(item.id);
          return (
            <div
              key={`rec-${item.id}`}
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all duration-200 shadow-sm"
            >
              {/* Thumbnail & Video Info */}
              <div
                onClick={() => handlePlayNow(item)}
                className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-pink-600/30 transition-colors flex items-center justify-center">
                    <Play
                      size={22}
                      className="text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform"
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-pink-300 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-400 truncate mt-0.5 font-medium">
                    {item.channelTitle}
                  </p>
                  {item.duration && (
                    <span className="inline-block mt-1 text-[11px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                      {item.duration}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handlePlayNow(item)}
                  className="px-3 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white border border-pink-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                  title="Hemen Oynat"
                >
                  <Play size={14} className="fill-current" />
                  <span className="hidden sm:inline">▶ Oynat</span>
                </button>

                <button
                  onClick={() => handleAddToQueue(item)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
                  title="Sıraya Ekle"
                >
                  <Plus size={14} />
                  <span className="hidden sm:inline">+ Sıraya Ekle</span>
                </button>

                <button
                  onClick={() => handleToggleFavorite(item)}
                  className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                    favorited
                      ? 'bg-pink-500/30 text-pink-400 border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.3)]'
                      : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-pink-400 border-white/10'
                  }`}
                  title={favorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                >
                  <Heart
                    size={16}
                    className={favorited ? 'fill-pink-400 text-pink-400' : ''}
                  />
                </button>

                <button
                  onClick={() => handleAddToPlaylist(item)}
                  className="p-2.5 rounded-xl border border-white/10 bg-white/10 hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 transition-all active:scale-95"
                  title="Listeye Ekle"
                >
                  <ListPlus size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-600/10 border border-pink-500/20 flex items-center justify-center">
          <Sparkles size={28} className="text-pink-400" />
        </div>
        <p className="text-sm font-semibold text-white">
          {recsError ? 'Öneriler Yüklenemedi' : 'Öneri Bulunamadı'}
        </p>
        <p className="text-xs text-purple-200/60 text-center max-w-xs">
          Arama kutusuna şarkı veya sanatçı adı yazarak keşfetmeye başlayabilirsiniz.
        </p>
      </div>
    )}
  </div>
)
```

---

## 4. Verification Checklist

1. **Empty Search Box State**: Opening `SearchDrawer` with an empty search box displays `"🎵 Sana Özel Öneriler"` with 6 recommendations.
2. **Context-Aware Recommendations**: When `currentSong` is set, recommendations match the playing artist/track. When no song is active, fallback top mix is shown.
3. **Action Support**: Play (▶), Queue (+ Queue), Favorite (💖), and Add to Playlist (ListPlus) work out-of-the-box.
4. **Transition to Active Search**: Typing a search query hides recommendations and displays live YouTube search results. Clearing query returns to recommendations.
