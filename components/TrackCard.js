'use client';
import { usePlayer } from './Providers';
import Cover from './Cover';
import Icon from './Icon';
export default function TrackCard({ track, allTracks, onContextMenu }) {
  const { playTrack, togglePlay, currentTrack, isPlaying, getCoverUrl } = usePlayer();
  const active = currentTrack?.id === track.id;
  return <div className={`music-track-card ${active ? 'is-playing' : ''}`} onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, track); }}>
    <button className="card-play-target" onClick={() => active ? togglePlay() : playTrack(track, allTracks)} aria-label={`${active && isPlaying ? 'Pause' : 'Play'} ${track.title}`}>
      <Cover src={getCoverUrl(track)} title={track.album || track.title} /><span className="card-play"><Icon name={active && isPlaying ? 'pause' : 'play'} size={22} /></span>
      <strong>{track.title}</strong><span className="card-artist">{track.artist || 'Unknown artist'}</span>
    </button>
    {onContextMenu && <button className="card-options icon-btn" aria-label={`Options for ${track.title}`} onClick={e => onContextMenu(e, track)}><Icon name="more" size={18} /></button>}
  </div>;
}
