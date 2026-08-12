'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './Providers';

export default function Sidebar({ view, setView, playlists, onCreatePlaylist, onSelectPlaylist, selectedPlaylist }) {
  const { user, signOut } = useAuth();
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    await onCreatePlaylist(newName.trim());
    setNewName('');
    setShowNewPlaylist(false);
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="logo">
        <div className="logo-icon">🎵</div>
        <span className="logo-text">SAFI</span>
      </div>

      {/* Main nav */}
      <nav className="nav-section">
        <div className="nav-section-label">Menu</div>
        <button className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          Home
        </button>
        <button className={`nav-item ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          My Library
        </button>
        <button className={`nav-item ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
          </svg>
          Upload
        </button>
      </nav>

      {/* Playlists */}
      <div className="nav-section">
        <div className="nav-section-label" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          Playlists
          <button
            onClick={() => setShowNewPlaylist(s => !s)}
            style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', lineHeight:1 }}
            title="New playlist"
          >+</button>
        </div>
        {showNewPlaylist && (
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <input
              className="field-input"
              placeholder="Playlist name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>Add</button>
          </div>
        )}
      </div>

      <div className="sidebar-playlists">
        {playlists.map(pl => (
          <button
            key={pl.id}
            className={`playlist-item ${selectedPlaylist?.id === pl.id && view === 'playlist' ? 'active' : ''}`}
            onClick={() => { onSelectPlaylist(pl); setView('playlist'); }}
          >
            <div className="playlist-thumb-placeholder">🎶</div>
            <span className="playlist-item-name">{pl.name}</span>
          </button>
        ))}
        {playlists.length === 0 && (
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', padding:'8px' }}>
            No playlists yet
          </div>
        )}
      </div>

      {/* User area */}
      <div className="user-area">
        <div className="user-avatar">{initials}</div>
        <span className="user-email">{user?.email}</span>
        <button className="logout-btn" onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}
