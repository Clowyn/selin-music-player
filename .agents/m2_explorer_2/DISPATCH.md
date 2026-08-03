## 2026-08-03T21:19:01Z
<USER_REQUEST>
Read d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md and d:\Projeler\Selin\selin-player\.agents\PROJECT.md.
Your assigned working directory is d:\Projeler\Selin\selin-player\.agents\m2_explorer_2.

Task: Design default recommendation state in `components/SearchDrawer.tsx`:
- Inspect existing empty placeholder in `components/SearchDrawer.tsx` (lines 365-377).
- Design replacement dynamic section `"🎵 Sana Özel Öneriler"` showing 5-8 suggested songs when `query.trim()` is empty and `hasSearched` is false.
- Fetch recommendations based on `currentSong` (or top default mix if no current song).
- Map recommended tracks using `convertToSong` helper so Play, Queue, Favorite, and Add to Playlist actions work out-of-the-box.

Write your findings to `d:\Projeler\Selin\selin-player\.agents\m2_explorer_2\analysis.md` and `handoff.md`. Report back via `send_message`.
</USER_REQUEST>
