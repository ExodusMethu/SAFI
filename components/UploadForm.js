'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const ACCEPTED = '.mp3,.m4a,.wav,.ogg,.flac,.aac,.opus,.wma,.mp4,.m4b';

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

async function extractMeta(file) {
  // Browser-side ID3/metadata extraction attempt
  // Fallback to filename parsing
  const name = file.name.replace(/\.[^.]+$/, '');
  const parts = name.split(' - ');
  return {
    title: parts.length >= 2 ? parts[1].trim() : name,
    artist: parts.length >= 2 ? parts[0].trim() : '',
    album: '',
  };
}

export default function UploadForm({ onUploaded }) {
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function addFiles(files) {
    const newItems = Array.from(files).map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      title: '',
      artist: '',
      album: '',
      status: 'pending', // pending | uploading | done | error
      progress: 0,
      error: null,
    }));

    // Extract metadata for each
    Promise.all(newItems.map(async (item) => {
      const meta = await extractMeta(item.file);
      return { ...item, title: meta.title, artist: meta.artist, album: meta.album };
    })).then(enriched => {
      setItems(prev => [...prev, ...enriched]);
    });
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function updateField(id, field, value) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function uploadItem(item) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not authenticated');

    try {
      // 1. Get presigned URL from API
      const res = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: item.file.name,
          fileType: item.file.type || 'audio/mpeg',
          isCover: false,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to get upload URL');
      }

      const { presignedUrl, key } = await res.json();

      // 2. Upload directly to R2
      await uploadWithProgress(presignedUrl, item.file, item.file.type || 'audio/mpeg', (pct) => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress: pct } : i));
      });

      // 3. Save metadata to DB
      const metaRes = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: item.title || item.file.name,
          artist: item.artist || null,
          album: item.album || null,
          file_key: key,
          file_size: item.file.size,
        }),
      });

      if (!metaRes.ok) throw new Error('Failed to save track metadata');
      return await metaRes.json();
    } catch (directErr) {
      console.warn('Direct R2 upload failed (CORS or network), trying server fallback:', directErr);
      
      // Fallback: Upload through server API endpoint (bypasses browser CORS)
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('title', item.title || item.file.name);
      if (item.artist) formData.append('artist', item.artist);
      if (item.album) formData.append('album', item.album);

      const serverRes = await fetch('/api/upload/direct', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!serverRes.ok) {
        const serverErr = await serverRes.json().catch(() => ({}));
        throw new Error(serverErr.error || directErr.message || 'Upload failed');
      }

      return await serverRes.json();
    }
  }

  async function uploadWithProgress(url, file, contentType, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  }

  async function uploadAll() {
    const pending = items.filter(i => i.status === 'pending');
    for (const item of pending) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
      try {
        const track = await uploadItem(item);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' } : i));
        onUploaded?.(track);
      } catch (err) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message } : i));
      }
    }
  }

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <div>
      {/* Drop zone */}
      <div
        className={`upload-area ${dragging ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <span className="upload-icon">🎵</span>
        <div className="upload-title">Drop audio files here</div>
        <div className="upload-sub">or click to browse your computer</div>
        <div className="upload-formats">MP3 · M4A · WAV · FLAC · AAC · OGG · OPUS · Podcasts supported</div>
        <input
          ref={inputRef}
          type="file"
          className="upload-input"
          accept={ACCEPTED}
          multiple
          onChange={e => addFiles(e.target.files)}
          onClick={e => e.stopPropagation()}
        />
      </div>

      {/* Queue */}
      {items.length > 0 && (
        <div className="upload-queue">
          <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="text-sm text-secondary">{items.length} file{items.length !== 1 ? 's' : ''} queued</span>
            {pendingCount > 0 && (
              <button className="btn btn-primary btn-sm" onClick={uploadAll}>
                Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {items.map(item => (
            <div key={item.id} className="upload-item">
              <div>
                <div className="upload-item-name">{item.file.name} <span className="text-muted text-xs">({formatBytes(item.file.size)})</span></div>
                {item.status === 'pending' && (
                  <div className="upload-fields">
                    <input
                      className="field-input"
                      placeholder="Title"
                      value={item.title}
                      onChange={e => updateField(item.id, 'title', e.target.value)}
                    />
                    <input
                      className="field-input"
                      placeholder="Artist"
                      value={item.artist}
                      onChange={e => updateField(item.id, 'artist', e.target.value)}
                    />
                    <input
                      className="field-input"
                      placeholder="Album"
                      value={item.album}
                      onChange={e => updateField(item.id, 'album', e.target.value)}
                    />
                  </div>
                )}
                {item.status === 'uploading' && (
                  <>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-fill" style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className="upload-status status-uploading">Uploading... {item.progress}%</div>
                  </>
                )}
                {item.status === 'done' && <div className="upload-status status-done">✓ Uploaded successfully</div>}
                {item.status === 'error' && <div className="upload-status status-error">✗ {item.error}</div>}
              </div>
              {item.status === 'pending' && (
                <button className="icon-btn" onClick={() => removeItem(item.id)} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
