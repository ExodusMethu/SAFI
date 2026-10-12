'use client';
import { useAuth, usePlayer } from './Providers';
import Icon from './Icon';
import Cover from './Cover';
import { playlistTracks } from '@/lib/library.mjs';

export default function Sidebar({ view, setView, playlists, onSelectPlaylist, selectedPlaylist }) {
  const { user, signOut, openAuthModal } = useAuth();
  const { getCoverUrl } = usePlayer();
  return <aside className="sidebar">
    <button className="brand" aria-label="SAFI home" onClick={() => setView('home')}><span className="brand-mark"><i /><i /><i /><i /></span>SAFI<span className="brand-caption">MUSIC</span></button>
    <nav className="sidebar-navigation" aria-label="Main navigation">
      {[['home', 'home', 'Home'], ['library', 'library', 'Your library'], ['playlists', 'music', 'Playlists']].map(([id, icon, label]) => <button key={id} className={`nav-item ${view === id || (id === 'playlists' && view === 'playlist') ? 'active' : ''}`} onClick={() => setView(id)}><Icon name={icon} />{label}</button>)}
    </nav>
    <div className="sidebar-section-label"><span>YOUR PLAYLISTS</span><button className="icon-btn" aria-label="Manage playlists" onClick={() => setView('playlists')}><Icon name="plus" size={18} /></button></div>
    <div className="sidebar-playlists">{playlists.map(pl => <button key={pl.id} className={`playlist-item ${view === 'playlist' && selectedPlaylist?.id === pl.id ? 'active' : ''}`} onClick={() => { onSelectPlaylist(pl); setView('playlist'); }}><Cover src={getCoverUrl(playlistTracks(pl).find(t => t.cover_key))} title={pl.name} /><div><strong>{pl.name}</strong><span>{pl.playlist_tracks?.length || 0} songs</span></div></button>)}{!playlists.length && <p className="sidebar-hint">Your playlists live here.<br />Make one for any mood.</p>}</div>
    <button className={`sidebar-upload nav-item ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}><Icon name="upload" />Add music</button>
    <div className="user-area"><div className="user-avatar">{user?.email?.slice(0, 1).toUpperCase() || 'S'}</div><div className="user-account"><span className="user-email">{user?.isOffline ? 'Offline listening' : user?.email || 'Your personal collection'}</span><button className="logout-btn" onClick={user && !user.isOffline ? signOut : openAuthModal}>{user && !user.isOffline ? 'Sign out' : 'Sign in'}</button></div></div>
  </aside>;
}
