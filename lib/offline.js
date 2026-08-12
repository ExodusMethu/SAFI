import { get, set, keys, del } from 'idb-keyval';

// Prefix for track keys in IDB to distinguish from other potential data
const PREFIX = 'track_';

export async function downloadTrackForOffline(track, audioUrl, onProgress) {
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error('Failed to fetch audio file');
    
    // Optional: read stream to report progress if content-length is present
    const contentLength = res.headers.get('content-length');
    if (!contentLength || !onProgress) {
      const blob = await res.blob();
      await set(PREFIX + track.id, blob);
      return true;
    }

    const total = parseInt(contentLength, 10);
    let loaded = 0;
    const reader = res.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(Math.round((loaded / total) * 100));
    }

    const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'audio/mpeg' });
    await set(PREFIX + track.id, blob);
    return true;
  } catch (err) {
    console.error('Failed to download track', err);
    return false;
  }
}

export async function removeTrackFromOffline(trackId) {
  await del(PREFIX + trackId);
}

export async function getOfflineTrackBlobUrl(trackId) {
  const blob = await get(PREFIX + trackId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function getDownloadedTrackIds() {
  const allKeys = await keys();
  return allKeys
    .filter(k => typeof k === 'string' && k.startsWith(PREFIX))
    .map(k => k.replace(PREFIX, ''));
}
