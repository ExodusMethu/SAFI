import { get, set } from 'idb-keyval';

// In-memory cache for ultra-fast lookup during the session
const lyricsMemoryCache = new Map();

/**
 * Parses standard LRC timestamped lyrics into a sorted array of lines
 * Format: [mm:ss.xx] Lyrics text
 * @param {string} lrcText
 * @returns {Array<{ time: number, text: string }>}
 */
export function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split(/\r?\n/);
  const parsed = [];
  // Regex to match [00:12.34] or [00:12] or [01:23.456]
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip metadata tags like [ti:...], [ar:...], [length:...]
    if (/^\[[a-z]{2,8}:/i.test(trimmed)) continue;

    timeRegex.lastIndex = 0;
    const timestamps = [];
    let match;

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      timestamps.push(minutes * 60 + seconds + millis);
    }

    if (timestamps.length > 0) {
      const text = trimmed.replace(timeRegex, '').trim();
      for (const time of timestamps) {
        parsed.push({ time, text });
      }
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Finds the index of the current active lyric line based on playback time
 * @param {Array<{ time: number, text: string }>} parsedLyrics
 * @param {number} currentTime (seconds)
 * @returns {number} Index of active line, or -1 if before the first line
 */
export function findActiveLyricIndex(parsedLyrics, currentTime) {
  if (!parsedLyrics || parsedLyrics.length === 0) return -1;
  
  let active = -1;
  for (let i = 0; i < parsedLyrics.length; i++) {
    if (parsedLyrics[i].time <= currentTime) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Fetches lyrics for a given track from the API, with IDB & memory caching
 * @param {object} track
 * @returns {Promise<{ syncedLyrics: string|null, parsedLyrics: Array, plainLyrics: string|null, isInstrumental: boolean, notFound: boolean }>}
 */
export async function fetchTrackLyrics(track) {
  if (!track || !track.title) {
    return { syncedLyrics: null, parsedLyrics: [], plainLyrics: null, isInstrumental: false, notFound: true };
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
      lyricsMemoryCache.set(cacheKey, cached);
      return cached;
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
    const parsedLyrics = data.syncedLyrics ? parseLRC(data.syncedLyrics) : [];

    const result = {
      id: data.id || null,
      syncedLyrics: data.syncedLyrics || null,
      parsedLyrics,
      plainLyrics: data.plainLyrics || null,
      isInstrumental: Boolean(data.isInstrumental),
      notFound: Boolean(data.notFound) || (!data.syncedLyrics && !data.plainLyrics && !data.isInstrumental),
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
    const fallback = {
      syncedLyrics: null,
      parsedLyrics: [],
      plainLyrics: null,
      isInstrumental: false,
      notFound: true,
      error: err.message,
    };
    return fallback;
  }
}
