'use client';

export const dynamic = 'force-dynamic';


import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, PlayerProvider, useAuth } from '@/components/Providers';
import Player from '@/components/Player';
import Sidebar from '@/components/Sidebar';
import TrackCard from '@/components/TrackCard';
import UploadForm from '@/components/UploadForm';
import ContextMenu from '@/components/ContextMenu';

// ─── Login Screen ──────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🎵</div>
          <div className="login-logo-name">SAFI</div>
          <div className="login-sub">Your personal music stream</div>
        </div>

        <form onSubmit={handleLogin}>
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
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" style={{ marginTop:8 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Track List View ───────────────────────────────────────────────────────
function TrackListView({ tracks, onContextMenu }) {
  return (
    <div className="track-grid">
      {tracks.map(track => (
        <TrackCard
          key={track.id}
          track={track}
          allTracks={tracks}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

// ─── Playlist View ─────────────────────────────────────────────────────────
function PlaylistView({ playlist, allTracks, onContextMenu }) {
  const tracks = (playlist.playlist_tracks ?? [])
    .sort((a, b) => a.position - b.position)
    .map(pt => pt.tracks)
    .filter(Boolean);

  if (tracks.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🎶</span>
        <div className="empty-title">Playlist is empty</div>
        <div className="empty-sub">Right-click any track and add it to this playlist</div>
      </div>
    );
  }

  return (
    <div className="track-grid">
      {tracks.map(track => (
        <TrackCard
          key={track.id}
          track={track}
          allTracks={tracks}
          onContextMenu={(e, t) => onContextMenu(e, t, playlist)}
        />
      ))}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
function App() {
  const { user, loading } = useAuth();
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [view, setView] = useState('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { x, y, track, playlistCtx }
  const [tracksLoading, setTracksLoading] = useState(true);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  const fetchTracks = useCallback(async () => {
    setTracksLoading(true);
    const res = await fetch(`/api/tracks?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) setTracks(await res.json());
    setTracksLoading(false);
  }, []);

  const fetchPlaylists = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`/api/playlists?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (res.ok) setPlaylists(await res.json());
  }, []);

  useEffect(() => {
    if (user) {
      fetchTracks();
      fetchPlaylists();
    }
  }, [user, fetchTracks, fetchPlaylists]);

  async function handleCreatePlaylist(name) {
    const token = await getToken();
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) fetchPlaylists();
  }

  async function handleDeletePlaylist(playlistId) {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    const token = await getToken();
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
    const token = await getToken();
    await fetch(`/api/tracks/${track.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setTracks(prev => prev.filter(t => t.id !== track.id));
  }

  async function handleAddToPlaylist(track, playlist) {
    const token = await getToken();
    await fetch(`/api/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ track_id: track.id }),
    });
    fetchPlaylists();
  }

  async function handleRemoveFromPlaylist(track, playlist) {
    const token = await getToken();
    await fetch(`/api/playlists/${playlist.id}/tracks?track_id=${track.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchPlaylists();
    if (selectedPlaylist?.id === playlist.id) {
      setSelectedPlaylist(prev => ({
        ...prev,
        playlist_tracks: prev.playlist_tracks.filter(pt => pt.track_id !== track.id),
      }));
    }
  }

  function buildContextMenuItems(track, playlistCtx) {
    const items = [
      { label: '▶ Play', icon: '▶', action: () => {} }, // handled by TrackCard itself
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
        items.push({
          label: `Add to "${pl.name}"`,
          icon: '🎶',
          action: () => handleAddToPlaylist(track, pl),
        });
      });
      if (playlists.length > 0) items.push({ divider: true });
    }

    items.push({
      label: 'Delete track',
      danger: true,
      icon: '🗑',
      action: () => handleDeleteTrack(track),
    });

    return items;
  }

  function openContextMenu(e, track, playlistCtx = null) {
    setContextMenu({ x: e.clientX, y: e.clientY, track, playlistCtx });
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const filteredTracks = search
    ? tracks.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.artist ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : tracks;

  const recentTracks = tracks;

  return (
    <PlayerProvider>
      <div className="app-shell">
        {/* Sidebar */}
        <Sidebar
          view={view}
          setView={setView}
          playlists={playlists}
          onCreatePlaylist={handleCreatePlaylist}
          onSelectPlaylist={setSelectedPlaylist}
          selectedPlaylist={selectedPlaylist}
        />

        {/* Main */}
        <div className="main-content">
          {/* Topbar */}
          <header className="topbar">
            <span className="topbar-title">
              {view === 'home' && 'Home'}
              {view === 'library' && 'My Library'}
              {view === 'upload' && 'Upload Music'}
              {view === 'playlist' && (selectedPlaylist?.name ?? 'Playlist')}
            </span>

            <div className="search-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search tracks, artists…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </header>

          {/* Content area */}
          <main className="scroll-area">
            {view === 'home' && (
              <>
                {tracksLoading ? (
                  <div className="empty-state">
                    <span className="empty-icon" style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span>
                  </div>
                ) : tracks.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">🎵</span>
                    <div className="empty-title">Your library is empty</div>
                    <div className="empty-sub">Upload some music to get started</div>
                    <button className="btn btn-primary" onClick={() => setView('upload')}>Upload Music</button>
                  </div>
                ) : (
                  <>
                    {search && (
                      <section className="mb-24">
                        <div className="section-header">
                          <h1 className="section-title">Search results for "{search}"</h1>
                        </div>
                        {filteredTracks.length === 0 ? (
                          <div className="text-secondary text-sm">No tracks match your search.</div>
                        ) : (
                          <div className="track-grid">
                            {filteredTracks.map(t => (
                              <TrackCard key={t.id} track={t} allTracks={filteredTracks} onContextMenu={openContextMenu} />
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {!search && (
                      <>
                        <section className="mb-24">
                          <div className="section-header">
                            <h1 className="section-title">Recently Added</h1>
                          </div>
                          <div className="track-grid">
                            {recentTracks.map(t => (
                              <TrackCard key={t.id} track={t} allTracks={recentTracks} onContextMenu={openContextMenu} />
                            ))}
                          </div>
                        </section>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {view === 'library' && (
              <>
                <div className="section-header">
                  <h1 className="section-title">All Tracks</h1>
                  <span className="text-secondary text-sm">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
                </div>
                {tracks.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">🎵</span>
                    <div className="empty-title">No tracks yet</div>
                    <button className="btn btn-primary" onClick={() => setView('upload')}>Upload Music</button>
                  </div>
                ) : (
                  <div className="track-grid">
                    {filteredTracks.map(t => (
                      <TrackCard key={t.id} track={t} allTracks={filteredTracks} onContextMenu={openContextMenu} />
                    ))}
                  </div>
                )}
              </>
            )}

            {view === 'upload' && (
              <>
                <div className="section-header">
                  <h1 className="section-title">Upload Music</h1>
                </div>
                <UploadForm onUploaded={track => {
                  setTracks(prev => [track, ...prev]);
                  fetchTracks();
                }} />
              </>
            )}

            {view === 'playlist' && selectedPlaylist && (
              <>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h1 className="section-title">{selectedPlaylist.name}</h1>
                    {selectedPlaylist.description && (
                      <span className="text-secondary text-sm">{selectedPlaylist.description}</span>
                    )}
                  </div>
                  <button 
                    className="btn" 
                    style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30' }}
                    onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
                  >
                    Delete Playlist
                  </button>
                </div>
                <PlaylistView
                  playlist={playlists.find(p => p.id === selectedPlaylist.id) ?? selectedPlaylist}
                  allTracks={tracks}
                  onContextMenu={openContextMenu}
                />
              </>
            )}
          </main>

          {/* Player */}
          <Player />
        </div>

        {/* Mobile bottom nav */}
        <nav className="mobile-nav">
          <button className={`mobile-nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            Home
          </button>
          <button className={`mobile-nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            Library
          </button>
          <button className={`mobile-nav-item ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
            Upload
          </button>
        </nav>

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={buildContextMenuItems(contextMenu.track, contextMenu.playlistCtx)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </PlayerProvider>
  );
}

// Root export wraps with Auth context
export default function Page() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
