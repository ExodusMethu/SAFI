export async function fetchITunesMetadata(query) {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const track = data.results[0];
      return {
        title: track.trackName,
        artist: track.artistName,
        album: track.collectionName,
        cover_url: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null,
      };
    }
  } catch (err) {
    console.error('iTunes API error:', err);
  }
  return null;
}
