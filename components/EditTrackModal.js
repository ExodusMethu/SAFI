'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchITunesMetadata } from '@/lib/metadata';

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

export default function EditTrackModal({ track, isOpen, onClose, onSave, getCoverUrl }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [coverKey, setCoverKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const titleInputRef = useRef(null);

  useEffect(() => {
    if (track && isOpen) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setCoverKey(track.cover_key || null);
      setError(null);
      setSaving(false);
      setSearching(false);
      
      // Auto-focus title input
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    }
  }, [track, isOpen]);

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
      });
      onClose();
    } catch (err) {
      console.error('Failed to save track:', err);
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card edit-track-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">METADATA EDITOR</span>
            <h2 className="modal-title">Edit Song Details</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-form">
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

          {error && <div className="modal-error-alert">{error}</div>}

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
