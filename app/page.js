'use client';

export const dynamic = 'force-dynamic';


import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, PlayerProvider, useAuth, usePlayer } from '@/components/Providers';
import Player from '@/components/Player';
import ExpandedPlayer from '@/components/ExpandedPlayer';
import Sidebar from '@/components/Sidebar';
import MusicViews from '@/components/MusicViews';
import Icon from '@/components/Icon';
import { playlistTracks } from '@/lib/library.mjs';
import ContextMenu from '@/components/ContextMenu';
import EditTrackModal from '@/components/EditTrackModal';
import { fetchITunesMetadata } from '@/lib/metadata';
import { get, set } from 'idb-keyval';

// ─── Login Screen ──────────────────────────────────────────────────────────
function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        if (!data?.session) {
          setMessage('Account created! Please check your email to verify or sign in.');
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"><Icon name="music" size={32} /></div>
          <div className="login-logo-name">SAFI</div>
          <div className="login-sub">Your personal music stream</div>
        </div>

        <div className="auth-tabs" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(false); setError(''); setMessage(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(true); setError(''); setMessage(''); }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {message && <div className="auth-success-msg" style={{ marginBottom: 16 }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" style={{ marginTop:8 }} disabled={loading}>
            {loading ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Track List View ───────────────────────────────────────────────────────
function App() {
  const { user, loading, openAuthModal, getToken } = useAuth();
  const {
    handleDownloadTrack, handleRemoveDownload, downloadedIds,
    playTrack, currentTrack, openLyrics, getCoverUrl,
    editingTrack, editingTab, openEditModal, closeEditModal, updateTrack,
    saveLyricsForTrack,
  } = usePlayer();
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [view, setView] = useState('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [search, setSearch] = useState('');
  function navigate(nextView) {
    setSearch('');
    setView(nextView);
  }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, track, playlistCtx }
  const [tracksLoading, setTracksLoading] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // 1. Listen for network status changes
  useEffect(() => {
    function handleOnline() { setIsOffline(false); }
    function handleOffline() { setIsOffline(true); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Instant 0ms hydration from IndexedDB on startup (vital for offline launch on iOS)
  useEffect(() => {
    let mounted = true;
    get('cached_tracks').then(cached => {
      if (mounted && cached && cached.length > 0) {
        setTracks(cached);
      }
    });
    get('cached_playlists').then(cached => {
      if (mounted && cached && cached.length > 0) {
        setPlaylists(cached);
      }
    });
    return () => { mounted = false; };
  }, []);

  async function handleDownloadPlaylist(playlistId) {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const plTracks = playlistTracks(pl, tracks);

    // Download them all (sequentially or in parallel, sequential is safer for IndexedDB)
    let failed = 0;
    for (const [index, track] of plTracks.entries()) {
      if (!downloadedIds.has(track.id)) {
        setNotice(`Downloading ${index + 1} of ${plTracks.length} songs…`);
        if (!await handleDownloadTrack(track)) failed++;
      }
    }
    setNotice(failed ? `${failed} songs could not be downloaded. Try again while online.` : 'Playlist ready for offline listening.');
  }

  async function handleAutoTagMissing() {
    const token = await getToken();
    if (!token) {
      openAuthModal();
      return;
    }
    const missing = tracks.filter(t => !t.cover_key);
    if (missing.length === 0) {
      alert("No tracks are missing artwork.");
      return;
    }

    // Process sequentially so we don't spam iTunes API
    for (const t of missing) {
      const query = `${t.title} ${t.artist || ''}`.trim();
      const meta = await fetchITunesMetadata(query);
      if (meta && meta.cover_url) {
        const updates = {};
        if (meta.cover_url) updates.cover_key = meta.cover_url;
        if (meta.album && !t.album) updates.album = meta.album;
        if (meta.title) updates.title = meta.title;
        if (meta.artist && !t.artist) updates.artist = meta.artist;

        await fetch(`/api/tracks/${t.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });
      }
    }
    // Refresh tracks after done
    fetchTracks();
  }

  const fetchTracks = useCallback(async () => {
    // If device is offline, read from IndexedDB directly without waiting on network
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await get('cached_tracks');
      if (cached && cached.length > 0) setTracks(cached);
      setTracksLoading(false);
      return;
    }

    try {
      setTracksLoading(true);
      const library = [];
      let more = true;
      while (more) {
        const res = await fetch(`/api/tracks?offset=${library.length}&t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error('Could not load your library');
        const data = await res.json();
        library.push(...data);
        more = data.length > 0 && res.headers.get('X-Has-More') === 'true';
      }
      const unique = [...new Map(library.map(t => [t.id, t])).values()];
      setTracks(unique);
      await set('cached_tracks', unique);
    } catch (err) {
      console.warn('Fetch tracks failed (offline fallback active):', err);
      setNotice('Could not refresh your library. Showing saved songs.');
      const cached = await get('cached_tracks');
      if (cached && cached.length > 0) setTracks(cached);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await get('cached_playlists');
      if (cached && cached.length > 0) setPlaylists(cached);
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/playlists?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
        await set('cached_playlists', data);
      } else {
        throw new Error('Network response was not ok');
      }
    } catch (err) {
      console.warn('Fetch playlists failed (offline fallback active):', err);
      const cached = await get('cached_playlists');
      if (cached && cached.length > 0) setPlaylists(cached);
    }
  }, [getToken]);

  useEffect(() => {
    if (user || isOffline) {
      fetchTracks();
      fetchPlaylists();
    }
  }, [user, isOffline, fetchTracks, fetchPlaylists]);

  async function handleCreatePlaylist(name) {
    const token = await getToken();
    if (!token) {
      openAuthModal();
      return;
    }
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Could not create playlist');
    }
    const created = await res.json();
    await fetchPlaylists();
    return created;
  }

  async function handleDeletePlaylist(playlistId) {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    const token = await getToken();
    if (!token) {
      openAuthModal();
      return;
    }
    const res = await fetch(`/api/playlists/${playlistId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      setView('home');
      setSelectedPlaylist(null);
    }
  }

  async function handleDeleteTrack(track) {
    if (!confirm(`Are you sure you want to delete "${track.title}"?`)) return;
    const token = await getToken();
    if (!token) {
      openAuthModal();
      return;
    }
    const res = await fetch(`/api/tracks/${track.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setNotice('Could not delete this song. Please try again.'); return; }
    setTracks(prev => prev.filter(t => t.id !== track.id));
    fetchTracks();
    fetchPlaylists();
  }

  async function handleAddToPlaylist(track, playlist) {
    const token = await getToken();
    if (!token) {
      openAuthModal();
      return;
    }
    const res = await fetch(`/api/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ track_id: track.id }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      setNotice(error.error || 'Could not add song to playlist.');
      return;
    }
    setNotice(`Added to ${playlist.name}`);
    fetchPlaylists();
  }

  async function handleRemoveFromPlaylist(track, playlist) {
    const token = await getToken();
    if (!token) {
      openAuthModal();
      return;
    }
    const res = await fetch(`/api/playlists/${playlist.id}/tracks?track_id=${track.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setNotice('Could not remove song. Please try again.'); return; }
    fetchPlaylists();
    if (selectedPlaylist?.id === playlist.id) {
      setSelectedPlaylist(prev => ({
        ...prev,
        playlist_tracks: prev.playlist_tracks.filter(pt => pt.track_id !== track.id),
      }));
    }
  }

  async function handleSaveTrack(updatedData) {
    const token = await getToken();
    if (!token) {
      openAuthModal();
      throw new Error('Please sign in to update track details');
    }
    const res = await fetch(`/api/tracks/${updatedData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: updatedData.title,
        artist: updatedData.artist,
        album: updatedData.album,
        cover_key: updatedData.cover_key,
        lyrics: updatedData.lyrics,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to update track details');
    }

    const savedTrack = await res.json();
    const finalTrack = {
      ...savedTrack,
      lyrics: updatedData.lyrics !== undefined ? updatedData.lyrics : savedTrack.lyrics,
    };

    // 1. If lyrics were updated, sync to lyrics cache & memory
    if (updatedData.lyrics !== undefined) {
      await saveLyricsForTrack(finalTrack, updatedData.lyrics);
    }

    // 2. Update tracks array in state & offline cache
    setTracks(prev => {
      const next = prev.map(t => (t.id === finalTrack.id ? { ...t, ...finalTrack } : t));
      set('cached_tracks', next).catch(() => {});
      return next;
    });

    // 3. Update active playlist view if open
    if (selectedPlaylist) {
      setSelectedPlaylist(prev => ({
        ...prev,
        playlist_tracks: (prev.playlist_tracks || []).map(pt =>
          pt.track_id === finalTrack.id ? { ...pt, track: { ...pt.track, ...finalTrack } } : pt
        ),
      }));
    }

    // 4. Update player queue and current playing track
    updateTrack(finalTrack);
  }

  function buildContextMenuItems(track, playlistCtx) {
    const items = [
      { label: 'Play', icon: <Icon name="play" size={16} />, action: () => playTrack(track, (playlistCtx ? playlistTracks(playlistCtx, tracks) : tracks).filter(t => !isOffline || downloadedIds.has(t.id))) },
      {
        label: 'Lyrics',
        action: () => {
          if (currentTrack?.id !== track.id) {
            playTrack(track, tracks);
          }
          openLyrics();
        }
      },
      {
        label: 'Edit song details',
        action: () => openEditModal(track, 'details'),
      },
      { divider: true },
    ];

    if (playlistCtx) {
      items.push({
        label: 'Remove from playlist',
        danger: true,
        action: () => handleRemoveFromPlaylist(track, playlistCtx),
      });
    } else {
      // Add to playlist submenu items
      playlists.forEach(pl => {
        const alreadyAdded = pl.playlist_tracks?.some(entry => entry.track_id === track.id);
        items.push({
          label: alreadyAdded ? `Already in "${pl.name}"` : `Add to "${pl.name}"`,
          disabled: alreadyAdded,
          action: () => handleAddToPlaylist(track, pl),
        });
      });
      if (playlists.length > 0) items.push({ divider: true });
    }
    if (downloadedIds.has(track.id)) {
      items.push({
        label: 'Remove from Offline',

        action: () => handleRemoveDownload(track.id),
      });
    } else {
      items.push({
        label: 'Download for Offline',

        action: async () => {
          setNotice(`Downloading ${track.title}…`);
          const success = await handleDownloadTrack(track);
          setNotice(success ? `${track.title} is ready for offline listening.` : 'Download failed. Check your connection and available storage.');
        },
      });
    }

    items.push({ divider: true });

    items.push({
      label: 'Delete track',
      danger: true,

      action: () => handleDeleteTrack(track),
    });

    return items;
  }

  function openContextMenu(e, track, playlistCtx = null) {
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: e.clientX || rect.left, y: e.clientY || rect.bottom, track, playlistCtx });
  }

  // If loading and we don't even have cached tracks yet, show a sleek loading screen
  if (loading && tracks.length === 0) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-logo"><Icon name="music" size={32} /></div>
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Loading SAFI…</span>
      </div>
    );
  }

  // Only force login if online, no user session exists, and no cached/downloaded library is available
  if (!user && !isOffline && tracks.length === 0 && downloadedIds.size === 0) {
    return <LoginScreen />;
  }

  return (
      <div className="app-shell">
        {/* Sidebar */}
        <Sidebar
          view={view}
          setView={navigate}
          playlists={playlists}
          onCreatePlaylist={handleCreatePlaylist}
          onSelectPlaylist={setSelectedPlaylist}
          selectedPlaylist={selectedPlaylist}
        />

        {/* Main */}
        <div className="main-content">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-left-group">
              <span className="topbar-title">
                {view === 'home' && 'Home'}
                {view === 'library' && 'Your library'}
                {view === 'playlists' && 'Playlists'}
                {view === 'album' && 'Album'}
                {view === 'upload' && 'Upload Music'}
                {view === 'playlist' && (selectedPlaylist?.name ?? 'Playlist')}
              </span>
              {isOffline && (
                <div className="topbar-offline-badge" title="No internet connection • Playing downloaded songs from device">
                  <span className="offline-pulse-dot" />
                  <span>Offline</span>
                </div>
              )}
            </div>

            <div className="topbar-right-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {(!user || user.isOffline) && !isOffline && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm topbar-signin-btn"
                  onClick={openAuthModal}
                >
                  Sign In
                </button>
              )}

              <div className="search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  className="search-input"
                  aria-label="Search music" placeholder="Search songs, artists, albums"
                  value={search}
                  onChange={e => { setSearch(e.target.value); if (['upload', 'playlists', 'album'].includes(view)) setView('library'); }}
                />
              </div>
            </div>
          </header>

          <main className="scroll-area">
            <MusicViews view={view} setView={navigate} tracks={tracks} playlists={playlists}
              selectedPlaylist={selectedPlaylist} setSelectedPlaylist={setSelectedPlaylist}
              search={search} isOffline={isOffline} loading={tracksLoading} onContextMenu={openContextMenu}
              onCreatePlaylist={handleCreatePlaylist} onDeletePlaylist={handleDeletePlaylist}
              onDownloadPlaylist={handleDownloadPlaylist} onAutoTag={handleAutoTagMissing}
              onUploaded={() => { fetchTracks(); fetchPlaylists(); }} />
          </main>

          {/* Player */}
          <Player />
        </div>

        {/* Mobile bottom nav */}
        <nav className="mobile-nav">
          <button className={`mobile-nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            Home
          </button>
          <button className={`mobile-nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => navigate('library')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            Library
          </button>
          <button className={`mobile-nav-item ${view === 'upload' ? 'active' : ''}`} onClick={() => navigate('upload')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
            Upload
          </button>
          <button className={`mobile-nav-item ${view === 'playlists' || view === 'playlist' ? 'active' : ''}`} onClick={() => navigate('playlists')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
            Playlists
          </button>
        </nav>

        {/* Context menu */}
        {notice && <div className="music-toast" role="status">{notice}</div>}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={buildContextMenuItems(contextMenu.track, contextMenu.playlistCtx)}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Edit Track Metadata Modal */}
        <EditTrackModal
          track={editingTrack}
          isOpen={Boolean(editingTrack)}
          onClose={closeEditModal}
          onSave={handleSaveTrack}
          getCoverUrl={getCoverUrl}
          initialTab={editingTab || 'details'}
        />

        {/* Spotify-style Expanded Player with Album Art, Lyrics, and Bottom Navigation */}
        <ExpandedPlayer />
      </div>
  );
}

// Root export wraps with Auth context
export default function Page() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <App />
      </PlayerProvider>
    </AuthProvider>
  );
}
