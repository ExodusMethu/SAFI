'use client';

import { usePlayer } from './Providers';

export default function TrackCard({ track, allTracks, onContextMenu }) {
  const { playTrack, currentTrack, isPlaying, getCoverUrl, downloadedIds } = usePlayer();
  const isActive = currentTrack?.id === track.id;
  const coverUrl = getCoverUrl(track);

  return (
    <div
      className={`track-card ${isActive ? 'playing' : ''}`}
      onClick={() => playTrack(track, allTracks)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, track); }}
    >
      {/* Album art */}
      <div className="track-art-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt={track.title} className="track-art" loading="lazy" />
        ) : (
          <div className="track-art-placeholder">🎵</div>
        )}

        <div className="play-overlay">
          <div className="play-btn-overlay">
            {isActive && isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </div>
        </div>

        {isActive && isPlaying && (
          <div style={{ position:'absolute', bottom:6, right:6 }}>
            <div className="playing-bars">
              <div className="playing-bar" />
              <div className="playing-bar" />
              <div className="playing-bar" />
            </div>
          </div>
        )}
      </div>

      <div className="track-card-name">
        {track.title}
        {downloadedIds?.has(track.id) && <span style={{ marginLeft: 4, color: 'var(--green)' }}>⬇</span>}
      </div>
      <div className="track-card-artist">{track.artist ?? 'Unknown Artist'}</div>

      {onContextMenu && (
        <button
          className="track-card-menu icon-btn"
          onClick={e => { e.stopPropagation(); onContextMenu(e, track); }}
          title="More options"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      )}
    </div>
  );
}
