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

function IconLyrics() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c1.1 0 2 .9 2 2v7.18c.61-.35 1.3-.58 2-.66V6h3V4h-5V2h-2zm-1 9c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.1c-.62-.57-1.42-.9-2.3-.9-1.07 0-2.03.48-2.7 1.25V11z"/>
      <path d="M19 12v7c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3h6v2H6c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-7h2z"/>
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    </svg>
  );
}

export default function Player() {
  const {
    currentTrack, isPlaying, progress, duration,
    volume, setVolume, shuffle, setShuffle,
    repeat, cycleRepeat, togglePlay, nextTrack, prevTrack, seekTo,
    getCoverUrl,
    isExpanded, openPlayer, openLyrics,
    lyricsData,
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
  const hasLyrics = Boolean(lyricsData?.syncedLyrics || lyricsData?.plainLyrics);

  return (
    <div className="player-bar">
      {/* Track info - click to open Spotify full player */}
      <div 
        className="player-track-info clickable" 
        onClick={() => openPlayer('art')}
        title="Open full player"
      >
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

      {/* Volume & Right Quick Actions */}
      <div className="player-right">
        {/* Lyrics shortcut button */}
        <button
          className={`ctrl-btn lyrics-shortcut-btn ${hasLyrics ? 'has-lyrics' : ''}`}
          onClick={openLyrics}
          title={hasLyrics ? 'Show Lyrics' : 'Check Lyrics'}
        >
          <IconLyrics />
        </button>

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

        {/* Expand modal button */}
        <button 
          className="ctrl-btn" 
          onClick={() => openPlayer('art')} 
          title="Full screen player"
        >
          <IconExpand />
        </button>
      </div>
    </div>
  );
}
