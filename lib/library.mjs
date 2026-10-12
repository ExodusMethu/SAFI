export function playlistTracks(playlist, library = [], order = 'newest') {
  return [...(playlist?.playlist_tracks || [])]
    .sort((a, b) => order === 'oldest' ? a.position - b.position : b.position - a.position)
    .map(entry => library.find(track => track.id === entry.track_id) || entry.tracks)
    .filter(Boolean);
}

export function selectTracks(tracks, { search = '', order = 'newest', downloadsOnly = false, downloadedIds = new Set() } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return tracks.filter(track =>
    (!downloadsOnly || downloadedIds.has(track.id)) &&
    (!query || [track.title, track.artist, track.album].some(value => value?.toLocaleLowerCase().includes(query)))
  ).sort((a, b) => {
    if (order === 'title' || order === 'artist') return (a[order] || '').localeCompare(b[order] || '') || a.title.localeCompare(b.title);
    const delta = new Date(b.created_at || 0) - new Date(a.created_at || 0);
    return order === 'oldest' ? -delta : delta;
  });
}

export function groupAlbums(tracks) {
  const albums = new Map();
  for (const track of tracks) {
    if (!track.album?.trim()) continue;
    const key = `${track.artist || ''}\u0000${track.album}`;
    if (!albums.has(key)) albums.set(key, { key, name: track.album, artist: track.artist, tracks: [] });
    albums.get(key).tracks.push(track);
  }
  return [...albums.values()];
}

export function formatTime(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
