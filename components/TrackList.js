'use client';

import { usePlayer } from './Providers';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TrackList({ tracks, onContextMenu }) {
  const { playTrack, currentTrack, isPlaying, getCoverUrl, downloadedIds } = usePlayer();

  return (
    <div className="track-list">
      {tracks.map((track, i) => {
        const isActive = currentTrack?.id === track.id;
        const coverUrl = getCoverUrl(track);

        return (
          <div
            key={track.id}
            className={`track-list-item ${isActive ? 'playing' : ''}`}
            onClick={() => playTrack(track, tracks)}
            onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, track); }}
          >
            <div className="track-list-num">
              {isActive && isPlaying ? (
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '14px', justifyContent: 'flex-end' }}>
                  <div className="playing-bar" style={{ animationDelay: '0s', background: 'var(--accent-bright)' }} />
                  <div className="playing-bar" style={{ animationDelay: '0.2s', background: 'var(--accent-bright)' }} />
                  <div className="playing-bar" style={{ animationDelay: '0.4s', background: 'var(--accent-bright)' }} />
                </div>
              ) : (
                i + 1
              )}
            </div>

            <div className="track-list-info">
              {coverUrl ? (
                <img src={coverUrl} alt={track.title} className="track-list-thumb" loading="lazy" />
              ) : (
                <div className="track-list-thumb-placeholder">🎵</div>
              )}
              <div className="track-list-meta">
                <div className="track-list-name">
                  {track.title}
                  {downloadedIds?.has(track.id) && <span style={{ marginLeft: 4, color: 'var(--green)' }}>⬇</span>}
                </div>
                <div className="track-list-artist">{track.artist ?? 'Unknown Artist'}</div>
              </div>
            </div>

            <div className="track-list-album">
              {track.album ?? ''}
            </div>

            <div className="track-list-duration" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
              <span>{formatDuration(0)}</span>
              {onContextMenu && (
                <button
                  className="icon-btn"
                  onClick={e => { e.stopPropagation(); onContextMenu(e, track); }}
                  title="More options"
                  style={{ background: 'transparent' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
