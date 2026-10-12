'use client';

import { useState } from 'react';
import { usePlayer } from './Providers';
import TrackList from './TrackList';
import TrackCard from './TrackCard';
import UploadForm from './UploadForm';
import Cover from './Cover';
import Icon from './Icon';
import { groupAlbums, playlistTracks, selectTracks } from '@/lib/library.mjs';

function Empty({ title, description, children }) {
  return <div className="music-empty"><Icon name="music" size={36} /><h2>{title}</h2><p>{description}</p>{children}</div>;
}

export default function MusicViews({ view, setView, tracks, playlists, selectedPlaylist, setSelectedPlaylist, search, isOffline, loading, onContextMenu, onCreatePlaylist, onDeletePlaylist, onDownloadPlaylist, onAutoTag, onUploaded }) {
  const { getCoverUrl, downloadedIds, recentIds, playQueue } = usePlayer();
  const [sort, setSort] = useState('newest');
  const [playlistSort, setPlaylistSort] = useState('newest');
  const [downloadsOnly, setDownloadsOnly] = useState(false);
  const [album, setAlbum] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState(false);
  const library = selectTracks(tracks, { search, order: sort, downloadsOnly: downloadsOnly || isOffline, downloadedIds });
  const available = isOffline ? tracks.filter(t => downloadedIds.has(t.id)) : tracks;
  const albums = groupAlbums(available);
  const recent = recentIds.map(id => available.find(t => t.id === id)).filter(Boolean).slice(0, 6);
  const currentPlaylist = playlists.find(p => p.id === selectedPlaylist?.id) || selectedPlaylist;
  const playlistSongs = playlistTracks(currentPlaylist, tracks, playlistSort).filter(t =>
    (!isOffline || downloadedIds.has(t.id)) && (!search.trim() || [t.title, t.artist, t.album].some(v => v?.toLowerCase().includes(search.trim().toLowerCase())))
  );
  const openPlaylist = playlist => { setSelectedPlaylist(playlist); setView('playlist'); };
  const openAlbum = item => { setAlbum(item); setView('album'); };
  const songCards = songs => <div className="music-card-grid">{songs.map(track => <TrackCard key={track.id} track={track} allTracks={songs} onContextMenu={onContextMenu} />)}</div>;
  const playlistCard = pl => {
    const songs = playlistTracks(pl, tracks);
    return <button key={pl.id} className="collection-card" onClick={() => openPlaylist(pl)}>
      <Cover src={getCoverUrl(songs.find(t => t.cover_key))} title={pl.name} />
      <strong>{pl.name}</strong><span>Playlist · {songs.length} songs</span>
    </button>;
  };
  const toolbar = <div className="library-toolbar">
    <div className="filter-pills">
      <button disabled={isOffline} className={!downloadsOnly && !isOffline ? 'selected' : ''} onClick={() => setDownloadsOnly(false)}>All songs</button>
      <button className={downloadsOnly || isOffline ? 'selected' : ''} onClick={() => setDownloadsOnly(true)}><Icon name="download" size={15} /> Downloaded</button>
    </div>
    <label className="sort-label">Sort by <select aria-label="Sort songs" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Recently added</option><option value="oldest">Oldest first</option><option value="title">Title</option><option value="artist">Artist</option></select></label>
  </div>;
  async function createPlaylist(e) {
    e.preventDefault();
    if (!newName.trim() || busy) return;
    setBusy(true); setCreateError('');
    try {
      const created = await onCreatePlaylist(newName.trim());
      if (created) { setCreating(false); setNewName(''); openPlaylist(created); }
    } catch (err) { setCreateError(err.message); } finally { setBusy(false); }
  }

  if (loading && !tracks.length && ['home', 'library'].includes(view)) return <div className="music-empty" role="status"><div className="app-loading-spinner" /><p>Loading your collection…</p></div>;

  return <>
    {view === 'home' && !search.trim() && <>
      <div className="page-heading"><div><p className="eyebrow">YOUR DAILY SOUNDTRACK</p><h1>Welcome back.</h1><p className="page-subtitle">Find your next listen.</p></div><button className="quiet-button" onClick={() => setView('upload')}><Icon name="plus" size={18} /> Add music</button></div>
      <div className="quick-links">
        <button onClick={() => setView('library')}><span className="quick-icon"><Icon name="library" /></span><div><strong>Your collection</strong><span>{tracks.length} songs</span></div><Icon name="arrow" size={18} /></button>
        <button onClick={() => { setDownloadsOnly(true); setView('library'); }}><span className="quick-icon"><Icon name="download" /></span><div><strong>Ready for offline</strong><span>{downloadedIds.size} downloaded songs</span></div><Icon name="arrow" size={18} /></button>
        {playlists.slice(0, 2).map(pl => <button key={pl.id} onClick={() => openPlaylist(pl)}><Cover src={getCoverUrl(playlistTracks(pl, tracks).find(t => t.cover_key))} title={pl.name} /><div><strong>{pl.name}</strong><span>Jump back into your playlist</span></div><Icon name="arrow" size={18} /></button>)}
      </div>
      {recent.length > 0 && <section className="music-section"><div className="section-heading"><h2>Recently played</h2><span>Pick up where you left off</span></div>{songCards(recent)}</section>}
      <section className="music-section"><div className="section-heading"><h2>Your playlists</h2><button onClick={() => setView('playlists')}>View all <Icon name="arrow" size={16} /></button></div>{playlists.length ? <div className="music-card-grid">{playlists.slice(0, 6).map(playlistCard)}</div> : <div className="create-banner"><div><h3>A place for every mood.</h3><p>Bring your favourite songs together in a playlist.</p></div><button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={17} /> Create playlist</button></div>}</section>
      {albums.length > 0 && <section className="music-section"><div className="section-heading"><h2>In your rotation</h2><span>Albums from your collection</span></div><div className="music-card-grid">{albums.slice(0, 6).map(item => <button className="collection-card" key={item.key} onClick={() => openAlbum(item)}><Cover src={getCoverUrl(item.tracks.find(t => t.cover_key))} title={item.name} /><strong>{item.name}</strong><span>{item.artist || 'Unknown artist'} · Album</span></button>)}</div></section>}
      <section className="music-section"><div className="section-heading"><h2>Fresh in your library</h2><button onClick={() => setView('library')}>View all <Icon name="arrow" size={16} /></button></div>{available.length ? <TrackList tracks={available.slice(0, 8)} onContextMenu={onContextMenu} /> : <Empty title={isOffline ? 'No downloaded songs yet' : 'Your collection starts here'} description={isOffline ? 'Go online to download music for your next offline session.' : 'Add your first songs to start listening.'}><button className="btn btn-primary" onClick={() => setView('upload')}>Add music</button></Empty>}</section>
    </>}

    {(view === 'library' || (view === 'home' && search.trim())) && <>
      <div className="page-heading"><div><p className="eyebrow">YOUR COLLECTION</p><h1>{search.trim() ? 'Search your music' : 'Your library'}</h1><p className="page-subtitle">{library.length} {library.length === 1 ? 'song' : 'songs'}{isOffline ? ' available offline' : ' · All your music in one place'}</p></div>{!isOffline && <button className="quiet-button" onClick={onAutoTag}>Find missing artwork</button>}</div>
      {toolbar}
      {library.length ? <TrackList tracks={library} onContextMenu={onContextMenu} /> : <Empty title="No songs found" description={search.trim() ? 'Try a different song, artist or album.' : downloadsOnly || isOffline ? 'Download songs from their options menu while online.' : 'Add some music to fill your library.'} />}
    </>}

    {view === 'playlists' && <>
      <div className="page-heading"><div><p className="eyebrow">YOUR COLLECTION</p><h1>Your playlists</h1><p className="page-subtitle">A little order for every kind of day.</p></div><button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New playlist</button></div>
      {playlists.length ? <div className="music-card-grid">{playlists.filter(pl => !search.trim() || pl.name.toLowerCase().includes(search.trim().toLowerCase())).map(playlistCard)}</div> : <Empty title="Make it your own" description="Create a playlist, then add songs using their options menu." />}
    </>}

    {((view === 'playlist' && currentPlaylist) || (view === 'album' && album)) && (() => {
      const songs = view === 'album' ? selectTracks(available.filter(t => album.tracks.some(a => a.id === t.id)), { search, order: 'oldest' }) : playlistSongs;
      const name = view === 'album' ? album.name : currentPlaylist.name;
      return <>
        <div className="collection-heading"><Cover src={getCoverUrl(songs.find(t => t.cover_key))} title={name} /><div><p className="eyebrow">{view === 'album' ? 'ALBUM' : 'YOUR PLAYLIST'}</p><h1>{name}</h1><p>{view === 'album' ? album.artist : currentPlaylist.description || 'Made by you'}<span> · {songs.length} songs</span></p></div></div>
        <div className="collection-toolbar"><button className="round-play" aria-label={`Play ${name}`} disabled={!songs.length} onClick={() => playQueue(songs)}><Icon name="play" size={25} /></button>
          {view === 'playlist' && <><button className="quiet-button" disabled={isOffline} onClick={() => onDownloadPlaylist(currentPlaylist.id)}><Icon name="download" size={18} /> Download</button><button className="quiet-button delete-playlist" disabled={isOffline} onClick={() => onDeletePlaylist(currentPlaylist.id)}>Delete playlist</button><label className="sort-label">Order <select aria-label="Playlist order" value={playlistSort} onChange={e => setPlaylistSort(e.target.value)}><option value="newest">Newest additions first</option><option value="oldest">Original order</option></select></label></>}
        </div>
        {songs.length ? <TrackList tracks={songs} onContextMenu={(e, t) => onContextMenu(e, t, view === 'playlist' ? currentPlaylist : null)} /> : <Empty title={search.trim() ? 'No songs found' : isOffline ? 'No downloaded songs in this playlist' : 'Room for your next favourite'} description={search.trim() ? 'Try a different search.' : 'Open your library and use a song’s options menu to add it here.'}><button className="quiet-button" onClick={() => setView('library')}>Browse library <Icon name="arrow" size={16} /></button></Empty>}
      </>;
    })()}

    {view === 'upload' && <><div className="page-heading"><div><p className="eyebrow">GROW YOUR COLLECTION</p><h1>Add your music</h1><p className="page-subtitle">Your favourite files, ready to play anywhere.</p></div></div><UploadForm playlists={playlists} existingTracks={tracks} onUploaded={onUploaded} /></>}
    {creating && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setCreating(false); }}><form className="modal-card create-playlist-modal" role="dialog" aria-modal="true" aria-labelledby="new-playlist-title" onSubmit={createPlaylist} onKeyDown={e => { if (e.key === 'Escape') setCreating(false); }}><div className="modal-header"><h2 id="new-playlist-title">New playlist</h2><button type="button" className="icon-btn" aria-label="Close" onClick={() => setCreating(false)}><Icon name="close" /></button></div><div className="modal-form"><label htmlFor="playlist-name">Give it a name</label><input id="playlist-name" className="modal-input" autoFocus maxLength={100} required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Late night listening" />{createError && <p role="alert">{createError}</p>}<button className="btn btn-primary" disabled={busy || !newName.trim()}>{busy ? 'Creating…' : 'Create playlist'}</button></div></form></div>}
  </>;
}
