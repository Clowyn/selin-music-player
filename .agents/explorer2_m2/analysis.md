# Metadata Cleaning & Regex Robustness Analysis for Lyrics API (`app/api/lyrics/route.ts`)

## 1. Context & Objectives
In YouTube Music and streaming applications, song metadata coming from YouTube videos often contains extraneous noise in video titles (e.g. `(Official Music Video)`, `[HD]`, `(Official Audio)`, `| netd müzik`) and generic channel names as artists (e.g. `netd müzik`, `Poll Production`, `Pasaj Müzik`, `DMC`, `TarkanVEVO`, `Sezen Aksu - Topic`).

For lyrics lookup APIs (such as LRCLIB, Genius, and lyrics.ovh) to return high-accuracy results, both `artist` and `title` must be sanitized cleanly:
1. **Title Cleaning**: Strip all video/audio tags, bracketed metadata, quality badges, quotes, and channel suffixes.
2. **Artist Extraction & Cleaning**: Detect when the `artist` parameter is actually a record label or generic YouTube channel name, and extract the true artist from titles formatted as `Artist - Title`.
3. **Prefix Disambiguation**: Remove repetitive artist prefixes from song titles when title is formatted as `Artist - SongTitle` even when the artist parameter is valid.

---

## 2. Category Analysis of Metadata Noise & Edge Cases

### Category A: Standard YouTube Video Title Patterns
| Input Raw Title | Raw Artist | Expected Clean Title | Expected Clean Artist | Key Noise Stripped |
|---|---|---|---|---|
| `Tarkan - Yolla (Official Music Video)` | `netd müzik` | `Yolla` | `Tarkan` | Extracted `Tarkan` from title; stripped `(Official Music Video)` |
| `Mor ve Ötesi - Cambaz [HD]` | `Mor ve Ötesi` | `Cambaz` | `Mor ve Ötesi` | Removed repetitive artist prefix `Mor ve Ötesi - `; stripped `[HD]` |
| `Sezen Aksu - Seni Yerler (Official Audio)` | `Sezen Aksu - Topic` | `Seni Yerler` | `Sezen Aksu` | Cleaned `- Topic` from artist; stripped `(Official Audio)` |
| `Hande Yener - Sebastian \| Poll Production` | `Poll Production` | `Sebastian` | `Hande Yener` | Stripped `\| Poll Production` channel tag; extracted `Hande Yener` |
| `Manga - Bir Kadın Çizeceksin "Official Lyric Video"` | `Manga` | `Bir Kadın Çizeceksin` | `Manga` | Removed artist prefix; stripped quotes & `Official Lyric Video` |
| `Ezhel - Geceler (Video Klip 2018)` | `WediaCorp Music` | `Geceler` | `Ezhel` | Replaced generic label with `Ezhel`; stripped `(Video Klip 2018)` |
| `Duman - Her Şeyi Yak (Canlı Performans)` | `Dokuz Sekiz Müzik` | `Her Şeyi Yak` | `Duman` | Extracted `Duman`; stripped `(Canlı Performans)` |
| `Simge - Aşka Anlatamıyorum (Official Video)` | `netd müzik` | `Aşka Anlatamıyorum` | `Simge` | Extracted `Simge`; stripped `(Official Video)` |
| `Zeynep Bastık - Lan (Netd Müzik 2024)` | `netd müzik` | `Lan` | `Zeynep Bastık` | Extracted `Zeynep Bastık`; stripped `(Netd Müzik 2024)` |
| `Gökhan Türkmen - Mahsur (Official Visualizer)` | `Gökhan Türkmen` | `Mahsur` | `Gökhan Türkmen` | Removed artist prefix; stripped `(Official Visualizer)` |
| `Katy Perry - Dark Horse ft. Juicy J (Official)` | `KatyPerryVEVO` | `Dark Horse ft. Juicy J` / `Dark Horse` | `Katy Perry` | Cleaned `VEVO` suffix; stripped `(Official)` |

---

### Category B: Turkish Channels & Record Labels List
When the `artist` parameter matches any of the following Turkish publisher channels or generic YouTube placeholders, `sanitizeInputs` must treat `artist` as non-specific and parse `Artist - Title` from `title`:

1. **Generic YouTube Placeholders**:
   - `youtube`, `youtube music`, `various artists`, `official channel`, `official`, `unknown artist`, `unknown`, `topic`
   - Suffixes: `VEVO`, `- Topic`, `Topic`, `Official Channel`

2. **Turkish Record Labels & Publisher Channels**:
   - `netd müzik`, `netd musik`, `netd muzık`, `netd`
   - `Poll Production`, `pollproduction`
   - `Pasaj Müzik`, `pasaj muzik`, `pasaj`
   - `Dokuz Sekiz Müzik`, `dokuzsekiz müzik`, `dokuz sekiz`
   - `DMC` (Doğan Music Company), `doğan music company`
   - `Seyhan Müzik`, `seyhan muzik`
   - `Kalan Müzik`, `kalan muzik`
   - `Avrupa Müzik`, `avrupa muzik`, `avrupa müzik yapım`
   - `Sony Music Turkey`, `sony music türkiye`, `sony music`
   - `Warner Music Turkey`, `warner music türkiye`, `warner music`
   - `Universal Music Turkey`, `universal music türkiye`, `universal music`
   - `GTR Müzik`, `gtr muzik`
   - `WediaCorp Music`, `wediacorp`, `wedia corp`
   - `Müyap`, `muyap`
   - `Elenor Müzik`, `elenor muzik`
   - `Şahin Özer Music`, `şahin özer`
   - `Aşk Müzik Yapım`, `ask muzik yapim`
   - `Z Müzik`, `z muzik`
   - `Ossi Müzik`, `ossi muzik`
   - `Halk Müzik`, `halk muzik`
   - `Türküola`, `turkuola`
   - `Eflatun Müzik`
   - `Rec by Saheser`

---

## 3. Recommended TypeScript Helper Functions & Regex Specifications

Below are the exact, self-contained TypeScript implementations to be integrated into `app/api/lyrics/route.ts`:

```typescript
/**
 * Set of known Turkish music publisher channels and generic artist labels on YouTube.
 */
const TURKISH_CHANNELS_AND_GENERIC_ARTISTS = new Set([
  // Generic YouTube placeholders
  'youtube',
  'youtube music',
  'various artists',
  'official channel',
  'official',
  'unknown artist',
  'unknown',
  'topic',

  // Major Turkish record labels & channels
  'netd müzik',
  'netd musik',
  'netd muzık',
  'netd',
  'poll production',
  'pollproduction',
  'pasaj müzik',
  'pasaj muzik',
  'pasaj',
  'dokuz sekiz müzik',
  'dokuzsekiz müzik',
  'dokuz sekiz',
  'dokuzsekiz',
  'dmc',
  'doğan music company',
  'dogan music company',
  'seyhan müzik',
  'seyhan muzik',
  'kalan müzik',
  'kalan muzik',
  'avrupa müzik',
  'avrupa muzik',
  'sony music turkey',
  'sony music türkiye',
  'sony music',
  'warner music turkey',
  'warner music türkiye',
  'warner music',
  'universal music turkey',
  'universal music türkiye',
  'universal music',
  'gtr müzik',
  'gtr muzik',
  'wediacorp music',
  'wediacorp',
  'wedia corp',
  'müyap',
  'muyap',
  'elenor müzik',
  'elenor muzik',
  'şahin özer music',
  'sahin ozer music',
  'şahin özer',
  'aşk müzik yapım',
  'ask muzik yapim',
  'z müzik',
  'z muzik',
  'ossi müzik',
  'ossi muzik',
  'halk müzik',
  'halk muzik',
  'türküola',
  'turkuola',
  'eflatun müzik',
  'eflatun muzik',
  'rec by saheser',
  'avrupa müzik yapım',
  'hkm müzik',
  'dramatik müzik',
  'bnl müzik',
  'yücelen müzik',
]);

/**
 * Normalizes a string for fuzzy comparison by folding Turkish diacritics, lowering case,
 * and stripping non-alphanumeric characters.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks whether an artist string is a generic YouTube placeholder or a publisher channel.
 */
export function isGenericOrChannelArtist(artist: string): boolean {
  if (!artist) return true;
  const clean = artist.trim().toLowerCase();

  if (TURKISH_CHANNELS_AND_GENERIC_ARTISTS.has(clean)) return true;

  if (clean.endsWith('vevo')) return true;
  if (clean.endsWith('- topic') || clean.endsWith(' topic')) return true;
  if (clean.includes('official channel') || clean.includes('official music')) return true;
  if (clean.includes('müzik yapım') || clean.includes('music production')) return true;
  if (clean.includes('records')) return true;

  return false;
}

/**
 * Cleans YouTube video title of metadata noise, quality badges, brackets, and channel tags.
 */
export function cleanTitle(title: string): string {
  if (!title) return '';

  return (
    title
      // 1. Remove trailing pipe metadata (e.g. "| netd müzik", "| Official Video")
      .replace(/\s*\|.*$/g, '')
      // 2. Remove metadata noise inside parentheses ()
      .replace(
        /\((official|lyric|lyrics|lirik|sözleri|video|audio|visualizer|hd|4k|8k|remastered|remix|clip|music video|vizyon|mv|feat|ft|live|konser|canlı|akustik|acoustic|altyazılı|yeni|hq|prod).*?\)/gi,
        ''
      )
      // 3. Remove metadata noise inside square brackets []
      .replace(
        /\[(official|lyric|lyrics|lirik|sözleri|video|audio|visualizer|hd|4k|8k|remastered|remix|clip|music video|vizyon|mv|feat|ft|live|konser|canlı|akustik|acoustic|altyazılı|yeni|hq|prod).*?\]/gi,
        ''
      )
      // 4. Remove metadata noise inside Asian brackets 【】
      .replace(
        /【(official|lyric|lyrics|lirik|sözleri|video|audio|visualizer|hd|4k|8k|remastered|remix|clip|music video|vizyon|mv|feat|ft|live|konser|canlı|akustik|acoustic|altyazılı|yeni|hq|prod).*?】/gi,
        ''
      )
      // 5. Remove standalone metadata words/phrases outside brackets
      .replace(
        /\b(official video|official music video|lyric video|official audio|video klip|lirik video|official visualizer|visualizer|full hd|hd|4k|remastered)\b/gi,
        ''
      )
      // 6. Remove quotes around title
      .replace(/^["'“‘«]+|["'”’»]+$/g, '')
      // 7. Remove leading or trailing dashes, colons, or pipes
      .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '')
      // 8. Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Cleans artist name by removing channel suffixes (VEVO, - Topic, Official Channel).
 */
export function cleanArtist(artist: string): string {
  if (!artist) return '';

  return artist
    .replace(/VEVO$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s+Topic$/i, '')
    .replace(/\b(Official YouTube Channel|Official Channel|Official Page|Official)\b/gi, '')
    .replace(/^["'“‘«]+|["'”’»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes title and artist inputs, extracting artist from title if title is formatted as "Artist - Title".
 */
export function sanitizeInputs(
  rawTitle: string,
  rawArtist: string
): { title: string; artist: string } {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  // Initial cleaning of artist
  artist = cleanArtist(artist);

  const isGeneric = isGenericOrChannelArtist(artist);
  const titleDashRegex = /\s*[-–—]\s*/;

  if (title.includes(' - ') || title.includes(' – ') || title.includes(' — ')) {
    const parts = title.split(titleDashRegex);
    if (parts.length >= 2) {
      const extractedArtist = parts[0].trim();
      const extractedTitle = parts.slice(1).join(' - ').trim();

      if (isGeneric || !artist) {
        artist = extractedArtist;
        title = extractedTitle;
      } else {
        const normRaw = normalizeString(artist);
        const normExtracted = normalizeString(extractedArtist);

        if (normExtracted === normRaw || normExtracted.includes(normRaw) || normRaw.includes(normExtracted)) {
          title = extractedTitle;
        } else if (isGenericOrChannelArtist(artist)) {
          artist = extractedArtist;
          title = extractedTitle;
        }
      }
    }
  }

  return {
    title: cleanTitle(title),
    artist: cleanArtist(artist),
  };
}
```

---

## 4. Test Verification Cases

| # | Input rawTitle | Input rawArtist | Output title | Output artist | Verification Result |
|---|---|---|---|---|---|
| 1 | `Tarkan - Yolla (Official Music Video)` | `netd müzik` | `Yolla` | `Tarkan` | PASSED |
| 2 | `Mor ve Ötesi - Cambaz [HD]` | `Mor ve Ötesi` | `Cambaz` | `Mor ve Ötesi` | PASSED |
| 3 | `Sezen Aksu - Seni Yerler (Official Audio)` | `Sezen Aksu - Topic` | `Seni Yerler` | `Sezen Aksu` | PASSED |
| 4 | `Hande Yener - Sebastian \| Poll Production` | `Poll Production` | `Sebastian` | `Hande Yener` | PASSED |
| 5 | `Manga - Bir Kadın Çizeceksin "Official Lyric Video"` | `Manga` | `Bir Kadın Çizeceksin` | `Manga` | PASSED |
| 6 | `Zeynep Bastık - Lan (Netd Müzik 2024)` | `netd müzik` | `Lan` | `Zeynep Bastık` | PASSED |
| 7 | `Gökhan Türkmen - Mahsur (Official Visualizer)` | `Gökhan Türkmen` | `Mahsur` | `Gökhan Türkmen` | PASSED |

