'use client';
import { usePlayer } from './Providers';
import { formatTime } from '@/lib/library.mjs';
import Cover from './Cover';
import Icon from './Icon';

export default function TrackList({ tracks, onContextMenu }) {
  const { playTrack, togglePlay, currentTrack, isPlaying, getCoverUrl, downloadedIds } = usePlayer();
  return <div className="song-list">
    <div className="song-list-header"><span>#</span><span>Title</span><span>Album</span><span>Time</span></div>
    {tracks.map((track, i) => {
      const active = currentTrack?.id === track.id;
      return <div key={track.id} className={`song-row ${active ? 'is-playing' : ''}`} onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, track); }}>
        <button className="song-number" aria-label={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`} onClick={() => active ? togglePlay() : playTrack(track, tracks)}><span>{active && isPlaying ? <Icon name="pause" size={16} /> : i + 1}</span><Icon className="row-play-icon" name={active && isPlaying ? 'pause' : 'play'} size={16} /></button>
        <button className="song-main" onClick={() => active ? togglePlay() : playTrack(track, tracks)} aria-label={`Play ${track.title} by ${track.artist || 'Unknown artist'}`}>
          <Cover src={getCoverUrl(track)} title={track.album || track.title} /><div><strong>{track.title}</strong><span>{downloadedIds.has(track.id) && <Icon name="download" size={12} />}{track.artist || 'Unknown artist'}</span></div>
        </button>
        <span className="song-album">{track.album || '—'}</span>
        <div className="song-actions"><span>{formatTime(track.duration)}</span>{onContextMenu && <button className="icon-btn" aria-label={`Options for ${track.title}`} onClick={e => onContextMenu(e, track)}><Icon name="more" size={19} /></button>}</div>
      </div>;
    })}
  </div>;
}
