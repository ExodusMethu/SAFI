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
 * Helper to get consistent cache key for a track's lyrics
 * @param {object} track
 * @returns {string}
 */
export function getLyricsCacheKey(track) {
  if (!track) return 'lyrics_unknown';
  return `lyrics_${track.id || `${track.title || ''}_${track.artist || ''}`}`.toLowerCase();
}

/**
 * Fetches static lyrics for a given track from track metadata, cache, or the API
 * @param {object} track
 * @returns {Promise<{ plainLyrics: string|null, isInstrumental: boolean, notFound: boolean, isCustom?: boolean }>}
 */
export async function fetchTrackLyrics(track) {
  if (!track || !track.title) {
    return { plainLyrics: null, isInstrumental: false, notFound: true };
  }

  // 1. If track object itself has custom lyrics saved
  if (track.lyrics !== undefined && track.lyrics !== null) {
    const trimmed = typeof track.lyrics === 'string' ? track.lyrics.trim() : '';
    const result = {
      id: track.id || null,
      plainLyrics: trimmed.length > 0 ? track.lyrics : null,
      isInstrumental: false,
      notFound: trimmed.length === 0,
      isCustom: true,
    };
    const cacheKey = getLyricsCacheKey(track);
    lyricsMemoryCache.set(cacheKey, result);
    return result;
  }

  const cacheKey = getLyricsCacheKey(track);

  // 2. Check in-memory cache
  if (lyricsMemoryCache.has(cacheKey)) {
    return lyricsMemoryCache.get(cacheKey);
  }

  // 3. Check IndexedDB cache for offline or fast reload
  try {
    const cached = await get(cacheKey);
    if (cached) {
      const normalized = {
        id: cached.id || null,
        plainLyrics: cached.plainLyrics || (cached.syncedLyrics ? extractPlainLyrics(cached.syncedLyrics) : null),
        isInstrumental: Boolean(cached.isInstrumental),
        notFound: Boolean(cached.notFound) || (!cached.plainLyrics && !cached.syncedLyrics && !cached.isInstrumental),
        isCustom: Boolean(cached.isCustom),
      };
      lyricsMemoryCache.set(cacheKey, normalized);
      return normalized;
    }
  } catch (e) {
    console.warn('IDB cache lookup failed:', e);
  }

  // 4. Fetch from online API (/api/lyrics)
  return await fetchOnlineLyrics(track);
}

/**
 * Fetches online lyrics directly from the /api/lyrics endpoint (bypassing custom cache)
 * Useful for "Auto-fetch / Reset from LRCLIB" action in the lyrics editor
 * @param {object} track
 * @returns {Promise<{ plainLyrics: string|null, isInstrumental: boolean, notFound: boolean }>}
 */
export async function fetchOnlineLyrics(track) {
  if (!track || !track.title) {
    return { plainLyrics: null, isInstrumental: false, notFound: true };
  }

  const cacheKey = getLyricsCacheKey(track);

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
      isCustom: false,
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
    console.error('Failed to fetch online lyrics:', err);
    return {
      plainLyrics: null,
      isInstrumental: false,
      notFound: true,
      error: err.message,
    };
  }
}

/**
 * Saves edited lyrics to local in-memory and IndexedDB caches
 * @param {object} track
 * @param {string|null} lyricsText
 * @returns {Promise<{ plainLyrics: string|null, isInstrumental: boolean, notFound: boolean, isCustom: boolean }>}
 */
export async function saveTrackLyrics(track, lyricsText) {
  if (!track) return null;

  const trimmed = typeof lyricsText === 'string' ? lyricsText.trim() : '';
  const result = {
    id: track.id || null,
    plainLyrics: trimmed.length > 0 ? lyricsText : null,
    isInstrumental: false,
    notFound: trimmed.length === 0,
    isCustom: true,
  };

  const cacheKey = getLyricsCacheKey(track);
  lyricsMemoryCache.set(cacheKey, result);

  try {
    await set(cacheKey, result);
  } catch (e) {
    console.warn('Failed to write lyrics to IDB:', e);
  }

  // Also update cached_tracks in IDB if it exists
  try {
    const cachedTracks = await get('cached_tracks');
    if (Array.isArray(cachedTracks) && track.id) {
      const updated = cachedTracks.map(t =>
        t.id === track.id ? { ...t, lyrics: result.plainLyrics } : t
      );
      await set('cached_tracks', updated);
    }
  } catch (e) {}

  return result;
}

/**
 * Clears lyrics cache for a track
 * @param {object} track
 */
export async function clearTrackLyricsCache(track) {
  if (!track) return;
  const cacheKey = getLyricsCacheKey(track);
  lyricsMemoryCache.delete(cacheKey);
  try {
    const { del } = await import('idb-keyval');
    await del(cacheKey);
  } catch (e) {}
}
