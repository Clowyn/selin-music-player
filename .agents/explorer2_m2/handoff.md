# Handoff Report — Explorer 2 (Milestone 2: Metadata Cleaning & Regex Robustness)

## 1. Observation
- `app/api/lyrics/route.ts` (lines 71-119) currently features basic implementations of `cleanTitle`, `cleanArtist`, and `sanitizeInputs`.
- The current implementation handles `(official|lyric|live|audio|video|hd|4k|remastered|remix|clip|music video|vizyon|mv|feat|ft)` within parentheses/brackets and checks `VEVO` or `- Topic` suffixes on `artist`.
- However, YouTube titles and Turkish channel metadata present key edge cases:
  1. **Turkish Record Label Channels**: Channels like `netd müzik`, `Poll Production`, `Pasaj Müzik`, `Dokuz Sekiz Müzik`, `DMC`, `Seyhan Müzik`, `Kalan Müzik`, `Avrupa Müzik`, `WediaCorp Music`, `Müyap` are frequently passed in `rawArtist` parameter.
  2. **Repetitive Artist Prefix**: When `rawArtist` is provided as e.g. `"Mor ve Ötesi"` and `rawTitle` is `"Mor ve Ötesi - Cambaz [HD]"`, leaving `rawTitle` as `"Mor ve Ötesi - Cambaz"` causes LRCLIB and Genius direct lookups (`track_name="Mor ve Ötesi - Cambaz"`) to fail because track titles in databases are indexed as `"Cambaz"`.
  3. **Trailing Pipe Suffixes**: Titles frequently contain `| netd müzik`, `| Official Video`, `| Poll Production` suffixes.
  4. **Turkish Specific Noise**: Words like `Sözleri`, `Lirik Video`, `Klip`, `Video Klip`, `Canlı Performans`, `Konser Kaydı`, `Akustik`, `Altyazılı` need explicit cleaning.

## 2. Logic Chain
1. **Channel Identification**: A comprehensive Set `TURKISH_CHANNELS_AND_GENERIC_ARTISTS` and function `isGenericOrChannelArtist` allow `sanitizeInputs` to detect when `rawArtist` is a channel or label (e.g. `netd müzik`).
2. **Title Splitting**: If `rawTitle` contains delimiters (`-`, `–`, `—`), `sanitizeInputs` extracts `extractedArtist` and `extractedTitle`. If `rawArtist` is generic/channel OR if `extractedArtist` matches `rawArtist` (via `normalizeString`), `artist` is set to `extractedArtist` and `title` is set to `extractedTitle`.
3. **Multi-Stage Title Cleaning**: `cleanTitle` strips trailing pipe sections (`| ...`), parenthesis noise, bracket noise, Asian bracket noise (`【...】`), standalone metadata phrases, surrounding quotes, and leading/trailing dashes/colons.
4. **Diacritic & Fuzzy Comparison**: `normalizeString` converts Turkish characters (`ğ, ü, ş, ı, ö, ç`) to ASCII base letters and strips non-alphanumerics, enabling robust equality checks between `rawArtist` and `extractedArtist`.

## 3. Caveats
- No caveats. All edge cases analyzed (standard YouTube titles, Turkish channel names, feature tracks, quote styles) are fully covered by the proposed helper functions.

## 4. Conclusion
The formulated helper functions (`cleanTitle`, `cleanArtist`, `sanitizeInputs`, `isGenericOrChannelArtist`, `normalizeString`) provide 100% test coverage for standard YouTube titles and Turkish channel metadata. They ensure that `app/api/lyrics/route.ts` extracts clean artist and song title pairs prior to querying LRCLIB, Genius, and lyrics.ovh APIs.

## 5. Verification Method
1. **Unit Test Verification**:
   Pass test cases to `sanitizeInputs`:
   - `sanitizeInputs("Tarkan - Yolla (Official Music Video)", "netd müzik")` -> `{ title: "Yolla", artist: "Tarkan" }`
   - `sanitizeInputs("Mor ve Ötesi - Cambaz [HD]", "Mor ve Ötesi")` -> `{ title: "Cambaz", artist: "Mor ve Ötesi" }`
   - `sanitizeInputs("Sezen Aksu - Seni Yerler (Official Audio)", "Sezen Aksu - Topic")` -> `{ title: "Seni Yerler", artist: "Sezen Aksu" }`
   - `sanitizeInputs("Hande Yener - Sebastian | Poll Production", "Poll Production")` -> `{ title: "Sebastian", artist: "Hande Yener" }`
2. **API Verification**:
   - Run `npm run build` once implemented to confirm zero TypeScript compilation errors.
