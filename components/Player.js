'use client';

import { usePlayer } from './Providers';

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
    </svg>
  );
}

function IconShuffle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>
  );
}

function IconRepeat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    </svg>
  );
}

function IconRepeatOne() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v6H13z"/>
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
    </svg>
  );
}

export default function Player() {
  const {
    currentTrack, isPlaying, progress, duration,
    volume, setVolume, shuffle, setShuffle,
    repeat, cycleRepeat, togglePlay, nextTrack, prevTrack, seekTo,
    getCoverUrl,
  } = usePlayer();

  if (!currentTrack) {
    return (
      <div className="player-bar" style={{ justifyContent: 'center', opacity: 0.3 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          🎵 Select a track to start playing
        </span>
      </div>
    );
  }

  const coverUrl = getCoverUrl(currentTrack);
  const seekPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="player-bar">
      {/* Track info */}
      <div className="player-track-info">
        {coverUrl ? (
          <img src={coverUrl} alt={currentTrack.title} className="player-art" />
        ) : (
          <div className="player-art-placeholder">🎵</div>
        )}
        <div className="player-meta">
          <div className="player-title">{currentTrack.title}</div>
          <div className="player-artist">{currentTrack.artist ?? 'Unknown Artist'}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="player-controls">
        <div className="player-btns">
          <button
            className={`ctrl-btn ${shuffle ? 'active' : ''}`}
            onClick={() => setShuffle(s => !s)}
            title="Shuffle"
          >
            <IconShuffle />
          </button>

          <button className="ctrl-btn" onClick={prevTrack} title="Previous">
            <IconPrev />
          </button>

          <button className="play-pause-btn" onClick={togglePlay} title="Play/Pause">
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>

          <button className="ctrl-btn" onClick={nextTrack} title="Next">
            <IconNext />
          </button>

          <button
            className={`ctrl-btn ${repeat !== 'none' ? 'active' : ''}`}
            onClick={cycleRepeat}
            title={`Repeat: ${repeat}`}
          >
            {repeat === 'one' ? <IconRepeatOne /> : <IconRepeat />}
          </button>
        </div>

        <div className="seek-wrap">
          <span className="time-label">{formatTime(progress)}</span>
          <input
            type="range"
            className="seek-bar"
            min={0}
            max={duration || 0}
            value={progress}
            step={0.5}
            onChange={e => seekTo(parseFloat(e.target.value))}
            style={{
              background: `linear-gradient(to right, var(--accent-bright) ${seekPct}%, var(--bg-overlay) ${seekPct}%)`
            }}
          />
          <span className="time-label">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="player-right">
        <div className="volume-wrap">
          <button className="ctrl-btn" onClick={() => setVolume(v => v === 0 ? 1 : 0)} title="Mute">
            <IconVolume />
          </button>
          <input
            type="range"
            className="volume-bar"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{
              background: `linear-gradient(to right, var(--text-secondary) ${volume * 100}%, var(--bg-overlay) ${volume * 100}%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
