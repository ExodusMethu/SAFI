'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './Providers';

const ACTIVE = new Set(['queued', 'fetching', 'downloading']);

export default function PlaylistImport({ onUploaded }) {
  const { user, getToken, openAuthModal } = useAuth();
  const [url, setUrl] = useState('');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const callback = useRef(onUploaded);
  const progress = useRef('');
  callback.current = onUploaded;

  useEffect(() => {
    if (!user?.id || user.isOffline) { setJob(null); return; }
    let stopped = false;
    let timer;
    progress.current = '';
    async function poll() {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch('/api/music-imports', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const data = await response.json();
        if (stopped) return;
        if (!response.ok) throw new Error(data.error || 'Could not check import progress.');
        setJob(data);
        const marker = data ? `${data.id}:${data.completed}:${data.reused}:${data.status}` : '';
        if (marker !== progress.current && data) {
          progress.current = marker;
          callback.current?.();
        }
        setError('');
      } catch (err) {
        if (!stopped) setError(err.message);
      } finally {
        if (!stopped) timer = setTimeout(poll, 4000);
      }
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [user?.id, user?.isOffline, getToken]);

  async function start(event) {
    event.preventDefault();
    const token = await getToken();
    if (!token) { openAuthModal?.(); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/music-imports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start the import.');
      setJob(data);
      setUrl('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const active = job && ACTIVE.has(job.status);
  const processed = job ? job.completed + job.reused + job.failed : 0;
  return (
    <section className="playlist-import">
      <h2>Import a YouTube Music playlist</h2>
      <p className="page-subtitle">Paste a public or unlisted playlist link. Imported songs join the shared library and a playlist in your account. With PC imports, open Start SAFI Importer on your PC when you are ready.</p>
      <form onSubmit={start}>
        <label className="form-label" htmlFor="music-playlist-url">Playlist link</label>
        <div className="playlist-import-input">
          <input id="music-playlist-url" className="form-input" type="url" required maxLength={2048}
            placeholder="https://music.youtube.com/playlist?list=…" value={url}
            onChange={event => setUrl(event.target.value)} disabled={busy || active} />
          <button className="btn btn-primary" disabled={busy || active} type="submit">
            {busy ? 'Starting…' : active ? 'Importing…' : 'Import playlist'}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="playlist-import-error">{error}</p>}
      {job && <div className="playlist-import-progress" role="status" aria-live="polite">
        <strong>{job.title || 'Playlist import'}</strong>
        <p>{job.status === 'queued' ? 'Waiting to start. For PC imports, open Start SAFI Importer on your PC.' : active ? (job.current_track || 'Reading playlist…') : job.status === 'complete' ? 'Import finished' : 'Import stopped'}</p>
        {job.total > 0 && <><progress value={processed} max={job.total} aria-label="Playlist import progress" />
          <p>{processed} / {job.total} processed · {job.completed} added · {job.reused} already in library · {job.failed} failed</p></>}
        {job.error && <p className="playlist-import-error">{job.error}</p>}
        {job.errors?.length > 0 && <details><summary>Tracks that could not be imported</summary>
          <ul>{job.errors.map((item, index) => <li key={index}>{item.title}: {item.error}</li>)}</ul>
        </details>}
        {active && <p>For PC imports, keep the importer window open until finished; you can leave this screen. For cloud imports, keep this screen open. Saved songs stay available after the importer is switched off.</p>}
      </div>}
    </section>
  );
}
