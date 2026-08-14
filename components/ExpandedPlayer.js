'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from './Providers';

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function IconChevronDown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  );
}

function IconPrev() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
    </svg>
  );
}

function IconShuffle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>
  );
}

function IconRepeat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    </svg>
  );
}

function IconRepeatOne() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v6H13z"/>
    </svg>
  );
}

function IconLyrics() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c1.1 0 2 .9 2 2v7.18c.61-.35 1.3-.58 2-.66V6h3V4h-5V2h-2zm-1 9c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.1c-.62-.57-1.42-.9-2.3-.9-1.07 0-2.03.48-2.7 1.25V11z"/>
      <path d="M19 12v7c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3h6v2H6c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-7h2z"/>
    </svg>
  );
}

function IconArt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
    </svg>
  );
}

function IconVolumeMute() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
    </svg>
  );
}

export default function ExpandedPlayer() {
  const {
    currentTrack, isPlaying, progress, duration,
    volume, setVolume, shuffle, setShuffle,
    repeat, cycleRepeat, togglePlay, nextTrack, prevTrack, seekTo,
    getCoverUrl,
    isExpanded, setIsExpanded,
    playerViewMode, setPlayerViewMode,
    lyricsData, lyricsLoading, activeLyricIndex,
    downloadedIds, handleDownloadTrack, handleRemoveDownload,
  } = usePlayer();

  const lyricsContainerRef = useRef(null);
  const activeLineRef = useRef(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);

  // Auto-scroll the active lyric line to center unless user is manually scrolling
  useEffect(() => {
    if (!isExpanded || playerViewMode === 'art') return;
    if (userIsScrolling) return;

    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex, isExpanded, playerViewMode, userIsScrolling]);

  // Handle user manual scroll detection
  function handleLyricsScroll() {
    setUserIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setUserIsScrolling(false);
    }, 2500);
  }

  // Handle keyboard shortcuts when expanded
  useEffect(() => {
    if (!isExpanded) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      } else if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' && e.target.tagName !== 'INPUT') {
        seekTo(Math.min(duration, progress + 5));
      } else if (e.key === 'ArrowLeft' && e.target.tagName !== 'INPUT') {
        seekTo(Math.max(0, progress - 5));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, togglePlay, seekTo, duration, progress, setIsExpanded]);

  if (!isExpanded || !currentTrack) return null;

  const coverUrl = getCoverUrl(currentTrack);
  const seekPct = duration > 0 ? (progress / duration) * 100 : 0;
  const hasSynced = lyricsData?.parsedLyrics && lyricsData.parsedLyrics.length > 0;
  const hasPlain = Boolean(lyricsData?.plainLyrics);
  const hasAnyLyrics = hasSynced || hasPlain;
  const isDownloaded = downloadedIds?.has(currentTrack.id);

  return (
    <div className="spotify-player-overlay">
      {/* Dynamic ambient backdrop */}
      <div 
        className="spotify-player-bg" 
        style={{ 
          backgroundImage: coverUrl ? `url(${coverUrl})` : undefined 
        }} 
      />
      <div className="spotify-player-gradient" />

      {/* Main Container */}
      <div className="spotify-player-content">
        {/* Top Header */}
        <header className="spotify-header">
          <button 
            className="spotify-icon-btn" 
            onClick={() => setIsExpanded(false)} 
            title="Minimize player (Esc)"
          >
            <IconChevronDown />
          </button>

          <div className="spotify-header-title">
            <span className="spotify-header-tag">PLAYING FROM LIBRARY</span>
            <span className="spotify-header-track">{currentTrack.album || currentTrack.title}</span>
          </div>

          <div className="spotify-view-toggle">
            <button
              className={`spotify-toggle-btn ${playerViewMode === 'art' ? 'active' : ''}`}
              onClick={() => setPlayerViewMode('art')}
              title="Album Cover View"
            >
              <IconArt />
              <span className="toggle-label">Cover</span>
            </button>
            <button
              className={`spotify-toggle-btn ${playerViewMode === 'lyrics' ? 'active' : ''}`}
              onClick={() => setPlayerViewMode('lyrics')}
              title="Lyrics View"
            >
              <IconLyrics />
              <span className="toggle-label">Lyrics</span>
            </button>
          </div>
        </header>

        {/* Center Display Area */}
        <div className="spotify-main-display">
          {/* ── 1. Cover Art View ── */}
          {playerViewMode === 'art' && (
            <div className="spotify-art-view">
              <div className="spotify-art-container">
                {coverUrl ? (
                  <img src={coverUrl} alt={currentTrack.title} className="spotify-art-image" />
                ) : (
                  <div className="spotify-art-placeholder">🎵</div>
                )}
              </div>

              {/* Track Title and Artist Info */}
              <div className="spotify-info-row">
                <div className="spotify-meta">
                  <h1 className="spotify-title" title={currentTrack.title}>
                    {currentTrack.title}
                  </h1>
                  <p className="spotify-artist">
                    {currentTrack.artist || 'Unknown Artist'}
                    {currentTrack.album && <span className="spotify-album"> • {currentTrack.album}</span>}
                  </p>
                </div>

                <div className="spotify-info-actions">
                  <button
                    className={`spotify-icon-btn ${isDownloaded ? 'active-green' : ''}`}
                    onClick={() => isDownloaded ? handleRemoveDownload(currentTrack.id) : handleDownloadTrack(currentTrack)}
                    title={isDownloaded ? 'Remove from Offline' : 'Download for Offline'}
                  >
                    {isDownloaded ? '✅' : '⬇️'}
                  </button>
                </div>
              </div>

              {/* Mini Lyrics Preview Card underneath Cover */}
              {lyricsLoading ? (
                <div className="spotify-lyrics-preview loading">
                  <span className="preview-indicator">🎤 Finding lyrics…</span>
                </div>
              ) : hasSynced ? (
                <div 
                  className="spotify-lyrics-preview" 
                  onClick={() => setPlayerViewMode('lyrics')}
                  title="Click to expand full synchronized lyrics"
                >
                  <div className="preview-header">
                    <span className="preview-badge">LYRICS</span>
                    <span className="preview-expand-hint">Tap to expand ↗</span>
                  </div>
                  <div className="preview-lines">
                    {activeLyricIndex >= 0 && lyricsData.parsedLyrics[activeLyricIndex] ? (
                      <>
                        <p className="preview-line active">{lyricsData.parsedLyrics[activeLyricIndex]?.text}</p>
                        {lyricsData.parsedLyrics[activeLyricIndex + 1] && (
                          <p className="preview-line next">{lyricsData.parsedLyrics[activeLyricIndex + 1]?.text}</p>
                        )}
                      </>
                    ) : (
                      <p className="preview-line next">{lyricsData.parsedLyrics[0]?.text || 'Lyrics available'}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ── 2. Lyrics View (Spotify Synchronized Karaoke) ── */}
          {playerViewMode === 'lyrics' && (
            <div className="spotify-lyrics-view">
              {lyricsLoading ? (
                <div className="spotify-lyrics-state">
                  <div className="spotify-spinner" />
                  <p>Searching lyrics…</p>
                </div>
              ) : hasSynced ? (
                <div 
                  className="spotify-lyrics-container" 
                  ref={lyricsContainerRef}
                  onScroll={handleLyricsScroll}
                >
                  <div className="spotify-lyrics-scroll">
                    <div className="lyrics-spacer" />
                    {lyricsData.parsedLyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIndex;
                      const isPast = idx < activeLyricIndex;

                      return (
                        <div
                          key={`${line.time}-${idx}`}
                          ref={isActive ? activeLineRef : null}
                          className={`spotify-lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : 'upcoming'}`}
                          onClick={() => seekTo(line.time)}
                          title={`Jump to ${formatTime(line.time)}`}
                        >
                          <span className="lyric-text">{line.text || '♪'}</span>
                        </div>
                      );
                    })}
                    <div className="lyrics-spacer" />
                    <div className="lyrics-attribution">
                      <span>Lyrics provided by LRCLIB</span>
                    </div>
                  </div>
                </div>
              ) : hasPlain ? (
                <div className="spotify-lyrics-container plain-lyrics-wrap">
                  <div className="plain-lyrics-content">
                    <p className="plain-lyrics-text">{lyricsData.plainLyrics}</p>
                    <div className="lyrics-attribution">
                      <span>Lyrics provided by LRCLIB</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Graceful Fallback / Skip when no lyrics found ── */
                <div className="spotify-lyrics-state empty">
                  <div className="empty-lyrics-icon">🎤</div>
                  <h3>No lyrics available</h3>
                  <p>We couldn't find synchronized lyrics for "{currentTrack.title}".</p>
                  <button 
                    className="btn btn-primary btn-sm" 
                    style={{ marginTop: 16 }}
                    onClick={() => setPlayerViewMode('art')}
                  >
                    Back to Cover Art
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom Song Navigation & Controls (Spotify Style) ── */}
        <footer className="spotify-controls-footer">
          {/* Progress Seek Bar */}
          <div className="spotify-seek-container">
            <span className="spotify-time">{formatTime(progress)}</span>
            <div className="spotify-slider-wrap">
              <input
                type="range"
                className="spotify-seek-bar"
                min={0}
                max={duration || 0}
                value={progress}
                step={0.25}
                onChange={e => seekTo(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, var(--accent-bright) ${seekPct}%, rgba(255,255,255,0.2) ${seekPct}%)`
                }}
              />
            </div>
            <span className="spotify-time">{formatTime(duration)}</span>
          </div>

          {/* Controls Row */}
          <div className="spotify-controls-row">
            {/* Left helper tools */}
            <div className="spotify-ctrl-col left">
              <button
                className={`spotify-ctrl-btn ${shuffle ? 'active' : ''}`}
                onClick={() => setShuffle(s => !s)}
                title={shuffle ? 'Shuffle is on' : 'Shuffle is off'}
              >
                <IconShuffle />
                {shuffle && <span className="active-dot" />}
              </button>
            </div>

            {/* Center playback buttons */}
            <div className="spotify-playback-btns">
              <button 
                className="spotify-ctrl-btn skip-btn" 
                onClick={prevTrack} 
                title="Previous track"
              >
                <IconPrev />
              </button>

              <button 
                className="spotify-main-play-btn" 
                onClick={togglePlay} 
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>

              <button 
                className="spotify-ctrl-btn skip-btn" 
                onClick={nextTrack} 
                title="Next track"
              >
                <IconNext />
              </button>
            </div>

            {/* Right helper tools */}
            <div className="spotify-ctrl-col right">
              <button
                className={`spotify-ctrl-btn ${repeat !== 'none' ? 'active' : ''}`}
                onClick={cycleRepeat}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <IconRepeatOne /> : <IconRepeat />}
                {repeat !== 'none' && <span className="active-dot" />}
              </button>
            </div>
          </div>

          {/* Extra Secondary Bar (Volume & Mini Meta) */}
          <div className="spotify-extra-bar">
            <div className="spotify-extra-left">
              {coverUrl && (
                <img src={coverUrl} alt="" className="spotify-extra-thumb" />
              )}
              <div className="spotify-extra-text">
                <span className="spotify-extra-title">{currentTrack.title}</span>
                <span className="spotify-extra-artist">{currentTrack.artist || 'Unknown Artist'}</span>
              </div>
            </div>

            <div className="spotify-extra-right">
              {/* Volume Slider */}
              <div className="spotify-volume-group">
                <button
                  className="spotify-ctrl-btn mini"
                  onClick={() => setVolume(v => v === 0 ? 1 : 0)}
                  title={volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {volume === 0 ? <IconVolumeMute /> : <IconVolume />}
                </button>
                <input
                  type="range"
                  className="spotify-volume-bar"
                  min={0}
                  max={1}
                  step={0.02}
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #ffffff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
                  }}
                />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
