import { get, set } from 'idb-keyval';

// In-memory cache for ultra-fast lookup during the session
const lyricsMemoryCache = new Map();

/**
 * Extracts clean plain text lyrics from raw LRC format or multiline string
 * by removing timestamps [mm:ss.xx] and metadata headers [ti:...], [ar:...]
 * @param {string} lrcText
 * @returns {string}
 */
export function extractPlainLyrics(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return '';
  return lrcText
    .split(/\r?\n/)
    .filter(line => !/^\[[a-z]{2,8}:/i.test(line.trim()))
    .map(line => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
    .join('\n')
    .trim();
}

/**
 * Fetches static lyrics for a given track from the API, with IDB & memory caching
 * @param {object} track
 * @returns {Promise<{ plainLyrics: string|null, isInstrumental: boolean, notFound: boolean }>}
 */
export async function fetchTrackLyrics(track) {
  if (!track || !track.title) {
    return { plainLyrics: null, isInstrumental: false, notFound: true };
  }

  const cacheKey = `lyrics_${track.id || `${track.title}_${track.artist || ''}`}`.toLowerCase();

  // 1. Check in-memory cache
  if (lyricsMemoryCache.has(cacheKey)) {
    return lyricsMemoryCache.get(cacheKey);
  }

  // 2. Check IndexedDB cache for offline or fast reload
  try {
    const cached = await get(cacheKey);
    if (cached) {
      // Normalize if cached from older version
      const normalized = {
        id: cached.id || null,
        plainLyrics: cached.plainLyrics || (cached.syncedLyrics ? extractPlainLyrics(cached.syncedLyrics) : null),
        isInstrumental: Boolean(cached.isInstrumental),
        notFound: Boolean(cached.notFound) || (!cached.plainLyrics && !cached.syncedLyrics && !cached.isInstrumental),
      };
      lyricsMemoryCache.set(cacheKey, normalized);
      return normalized;
    }
  } catch (e) {
    console.warn('IDB cache lookup failed:', e);
  }

  // 3. Fetch from /api/lyrics
  try {
    const params = new URLSearchParams();
    params.set('title', track.title);
    if (track.artist) params.set('artist', track.artist);
    if (track.album) params.set('album', track.album);
    if (track.duration) params.set('duration', track.duration);

    const res = await fetch(`/api/lyrics?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Lyrics API responded with status ${res.status}`);
    }

    const data = await res.json();
    const plainLyrics = data.plainLyrics || (data.syncedLyrics ? extractPlainLyrics(data.syncedLyrics) : null);

    const result = {
      id: data.id || null,
      plainLyrics: plainLyrics || null,
      isInstrumental: Boolean(data.isInstrumental),
      notFound: Boolean(data.notFound) || (!plainLyrics && !data.isInstrumental),
    };

    // Store in caches
    lyricsMemoryCache.set(cacheKey, result);
    try {
      await set(cacheKey, result);
    } catch (e) {
      // Ignore IDB write failures
    }

    return result;
  } catch (err) {
    console.error('Failed to fetch lyrics:', err);
    return {
      plainLyrics: null,
      isInstrumental: false,
      notFound: true,
      error: err.message,
    };
  }
}
