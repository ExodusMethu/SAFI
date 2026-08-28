'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchITunesMetadata } from '@/lib/metadata';
import { fetchTrackLyrics, fetchOnlineLyrics } from '@/lib/lyrics';

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 2v3h3v2H7v3H5V7H2V5h3V2h2zm10 0l2.5 5.5L25 10l-5.5 2.5L17 18l-2.5-5.5L9 10l5.5-2.5L17 2zm-5 13l1.5 3.5L17 20l-3.5 1.5L12 25l-1.5-3.5L7 20l3.5-1.5L12 15z"/>
    </svg>
  );
}

function IconLyrics() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c1.1 0 2 .9 2 2v7.18c.61-.35 1.3-.58 2-.66V6h3V4h-5V2h-2zm-1 9c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.1c-.62-.57-1.42-.9-2.3-.9-1.07 0-2.03.48-2.7 1.25V11z"/>
      <path d="M19 12v7c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3h6v2H6c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-7h2z"/>
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  );
}

export default function EditTrackModal({ track, isOpen, onClose, onSave, getCoverUrl, initialTab = 'details' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [coverKey, setCoverKey] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [error, setError] = useState(null);
  const [lyricsNotice, setLyricsNotice] = useState(null);

  const titleInputRef = useRef(null);

  useEffect(() => {
    if (track && isOpen) {
      setActiveTab(initialTab);
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setCoverKey(track.cover_key || null);
      setError(null);
      setLyricsNotice(null);
      setSaving(false);
      setSearching(false);
      setFetchingLyrics(false);

      // Load initial lyrics: check track.lyrics first, otherwise fetch cached
      if (track.lyrics !== undefined && track.lyrics !== null) {
        setLyrics(track.lyrics);
      } else {
        setLyrics('');
        fetchTrackLyrics(track).then(res => {
          if (res?.plainLyrics) {
            setLyrics(res.plainLyrics);
          }
        }).catch(() => {});
      }
      
      // Auto-focus title input if on details tab
      setTimeout(() => {
        if (initialTab === 'details') {
          titleInputRef.current?.focus();
          titleInputRef.current?.select();
        }
      }, 100);
    }
  }, [track, isOpen, initialTab]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !track) return null;

  const currentCover = coverKey ? (coverKey.startsWith('http') ? coverKey : getCoverUrl?.({ cover_key: coverKey })) : null;

  async function handleAutoSearch() {
    const query = `${title} ${artist}`.trim();
    if (!query) return;

    setSearching(true);
    setError(null);

    try {
      const meta = await fetchITunesMetadata(query);
      if (meta) {
        if (meta.title) setTitle(meta.title);
        if (meta.artist) setArtist(meta.artist);
        if (meta.album) setAlbum(meta.album);
        if (meta.cover_url) setCoverKey(meta.cover_url);
      } else {
        setError('No metadata match found on iTunes.');
      }
    } catch (err) {
      setError('Failed to fetch metadata.');
    } finally {
      setSearching(false);
    }
  }

  async function handleFetchOnlineLyrics() {
    const currentTitle = title.trim();
    if (!currentTitle) {
      setError('Song title is required to search lyrics.');
      return;
    }

    setFetchingLyrics(true);
    setLyricsNotice(null);
    setError(null);

    try {
      const res = await fetchOnlineLyrics({
        title: currentTitle,
        artist: artist.trim(),
        album: album.trim(),
        duration: track.duration,
      });

      if (res?.plainLyrics) {
        setLyrics(res.plainLyrics);
        setLyricsNotice('Fetched latest lyrics from LRCLIB.');
      } else if (res?.isInstrumental) {
        setLyricsNotice('This track is marked as instrumental in LRCLIB.');
      } else {
        setLyricsNotice('No online lyrics found for this track.');
      }
    } catch (err) {
      setError('Failed to fetch online lyrics.');
    } finally {
      setFetchingLyrics(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Song title is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        id: track.id,
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        cover_key: coverKey,
        lyrics: lyrics.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Failed to save track:', err);
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  const lineCount = lyrics.split(/\r?\n/).filter(l => l.trim().length > 0).length;

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card edit-track-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">SONG & LYRICS EDITOR</span>
            <h2 className="modal-title">Edit Song Details</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">
            <IconClose />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="edit-modal-tabs">
          <button
            type="button"
            className={`edit-modal-tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <IconMusic />
            <span>Metadata</span>
          </button>
          <button
            type="button"
            className={`edit-modal-tab ${activeTab === 'lyrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('lyrics')}
          >
            <IconLyrics />
            <span>Lyrics</span>
            {lineCount > 0 && <span className="tab-pill">{lineCount} lines</span>}
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error-alert">{error}</div>}
          {lyricsNotice && <div className="modal-notice-alert">{lyricsNotice}</div>}

          {/* TAB 1: METADATA */}
          {activeTab === 'details' && (
            <>
              {/* Top Preview Banner */}
              <div className="edit-track-preview-row">
                <div className="edit-track-thumb-box">
                  {currentCover ? (
                    <img src={currentCover} alt="" className="edit-track-thumb" />
                  ) : (
                    <div className="edit-track-thumb-placeholder">🎵</div>
                  )}
                </div>
                <div className="edit-track-preview-info">
                  <span className="preview-label">Editing File</span>
                  <p className="preview-filename" title={track.file_key || track.title}>
                    {track.title || 'Untitled Track'}
                  </p>
                  <button
                    type="button"
                    className="btn-auto-search"
                    onClick={handleAutoSearch}
                    disabled={searching}
                    title="Search iTunes for official title, artist, album, and artwork"
                  >
                    <IconSparkles />
                    <span>{searching ? 'Searching…' : 'Auto-Fill Official Info'}</span>
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="modal-form-fields">
                <div className="modal-field-group">
                  <label className="modal-label" htmlFor="edit-track-title">
                    Song Title <span className="required-star">*</span>
                  </label>
                  <input
                    id="edit-track-title"
                    ref={titleInputRef}
                    type="text"
                    className="modal-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Blinding Lights"
                    required
                  />
                </div>

                <div className="modal-field-group">
                  <label className="modal-label" htmlFor="edit-track-artist">
                    Artist Name
                  </label>
                  <input
                    id="edit-track-artist"
                    type="text"
                    className="modal-input"
                    value={artist}
                    onChange={e => setArtist(e.target.value)}
                    placeholder="e.g. The Weeknd"
                  />
                </div>

                <div className="modal-field-group">
                  <label className="modal-label" htmlFor="edit-track-album">
                    Album Name
                  </label>
                  <input
                    id="edit-track-album"
                    type="text"
                    className="modal-input"
                    value={album}
                    onChange={e => setAlbum(e.target.value)}
                    placeholder="e.g. After Hours"
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: LYRICS */}
          {activeTab === 'lyrics' && (
            <div className="modal-lyrics-section">
              <div className="modal-lyrics-toolbar">
                <div className="lyrics-meta-counts">
                  <span className="lyrics-count-badge">
                    {lineCount} {lineCount === 1 ? 'line' : 'lines'} • {lyrics.trim().length} chars
                  </span>
                </div>
                <div className="lyrics-quick-actions">
                  <button
                    type="button"
                    className="lyrics-action-btn"
                    onClick={handleFetchOnlineLyrics}
                    disabled={fetchingLyrics}
                    title="Fetch official lyrics from LRCLIB"
                  >
                    <IconSparkles />
                    <span>{fetchingLyrics ? 'Searching…' : 'Fetch from LRCLIB'}</span>
                  </button>
                  {lyrics && (
                    <button
                      type="button"
                      className="lyrics-action-btn danger"
                      onClick={() => setLyrics('')}
                      title="Clear all lyrics"
                    >
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              <textarea
                className="modal-lyrics-textarea"
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Paste or type lyrics here... (supports plain text and timestamped LRC)"
                rows={12}
                spellCheck={false}
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
