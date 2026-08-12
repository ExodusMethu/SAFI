'use client';

export default function AlbumCard({ albumName, tracks, onClick }) {
  // Use the cover from the first track that has one
  const trackWithCover = tracks.find(t => t.cover_key);
  let coverUrl = null;
  if (trackWithCover) {
    if (trackWithCover.cover_key.startsWith('http')) {
      coverUrl = trackWithCover.cover_key;
    } else {
      coverUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${trackWithCover.cover_key}`;
    }
  }

  return (
    <div className="track-card" onClick={onClick}>
      <div className="track-art-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt={albumName} className="track-art" loading="lazy" />
        ) : (
          <div className="track-art-placeholder">💿</div>
        )}
      </div>
      <div className="track-card-name">{albumName || 'Unknown Album'}</div>
      <div className="track-card-artist">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</div>
    </div>
  );
}
