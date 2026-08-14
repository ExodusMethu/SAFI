'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getDownloadedTrackIds, getOfflineTrackBlobUrl, downloadTrackForOffline, removeTrackFromOffline } from '@/lib/offline';
import { fetchTrackLyrics, findActiveLyricIndex } from '@/lib/lyrics';

const AuthContext = createContext(null);

function createSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !url.startsWith('http')) return null;
  url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  return createClient(url, key);
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = createSupabaseClient();
  return _supabase;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }

    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Player Context ────────────────────────────────────────────────────
const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none'); // none | one | all
  const [downloadedIds, setDownloadedIds] = useState(new Set());

  // Spotify-style Expanded Player & Lyrics State
  const [isExpanded, setIsExpanded] = useState(false);
  const [playerViewMode, setPlayerViewMode] = useState('art'); // 'art' | 'lyrics' | 'split'
  const [lyricsData, setLyricsData] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    getDownloadedTrackIds().then(ids => setDownloadedIds(new Set(ids)));
  }, []);

  const currentTrack = queue[currentIndex] ?? null;

  // Build audio URL from R2
  function getAudioUrl(track) {
    if (!track) return null;
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${track.file_key}`;
  }

  function getCoverUrl(track) {
    if (!track?.cover_key) return null;
    if (track.cover_key.startsWith('http')) return track.cover_key;
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${track.cover_key}`;
  }

  // Fetch lyrics whenever current track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      setLyricsLoading(false);
      return;
    }

    let active = true;
    setLyricsLoading(true);

    fetchTrackLyrics(currentTrack)
      .then(res => {
        if (!active) return;
        setLyricsData(res);
      })
      .catch(err => {
        if (!active) return;
        console.error('Lyrics fetch error:', err);
        setLyricsData({ notFound: true, syncedLyrics: null, parsedLyrics: [], plainLyrics: null, isInstrumental: false });
      })
      .finally(() => {
        if (active) setLyricsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist]);

  // Compute active lyric line index from progress
  const activeLyricIndex = useMemo(() => {
    if (!lyricsData?.parsedLyrics || lyricsData.parsedLyrics.length === 0) return -1;
    return findActiveLyricIndex(lyricsData.parsedLyrics, progress);
  }, [lyricsData?.parsedLyrics, progress]);

  // Load new track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    let active = true;

    async function loadAudio() {
      let url = null;
      if (downloadedIds.has(currentTrack.id)) {
        url = await getOfflineTrackBlobUrl(currentTrack.id);
      }
      if (!url) url = getAudioUrl(currentTrack);

      if (!active) return;
      if (!url) return;

      audio.src = url;
      audio.load();

      if (isPlaying) {
        audio.play().catch(console.error);
      }
    }

    loadAudio();

    // Media Session API (lock screen controls)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist ?? 'Unknown Artist',
        album: currentTrack.album ?? '',
        artwork: currentTrack.cover_key
          ? [{ src: getCoverUrl(currentTrack), sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audio.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) audio.currentTime = details.seekTime;
      });
    }
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, queue]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function playQueue(tracks, startIndex = 0) {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
    }, 100);
  }

  function playTrack(track, allTracks) {
    const idx = allTracks ? allTracks.findIndex(t => t.id === track.id) : 0;
    playQueue(allTracks ?? [track], idx >= 0 ? idx : 0);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(console.error);
      setIsPlaying(true);
    }
  }

  function nextTrack() {
    if (!queue.length) return;
    if (repeat === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    let next;
    if (shuffle) {
      next = Math.floor(Math.random() * queue.length);
    } else {
      next = currentIndex + 1;
      if (next >= queue.length) {
        if (repeat === 'all') next = 0;
        else { setIsPlaying(false); return; }
      }
    }
    setCurrentIndex(next);
    setIsPlaying(true);
  }

  function prevTrack() {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prev = currentIndex - 1;
    if (prev < 0) prev = repeat === 'all' ? queue.length - 1 : 0;
    setCurrentIndex(prev);
    setIsPlaying(true);
  }

  function seekTo(time) {
    if (audioRef.current) audioRef.current.currentTime = time;
  }

  function cycleRepeat() {
    setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');
  }

  function toggleExpanded() {
    setIsExpanded(prev => !prev);
  }

  function openLyrics() {
    setPlayerViewMode('lyrics');
    setIsExpanded(true);
  }

  function openPlayer(mode = 'art') {
    setPlayerViewMode(mode);
    setIsExpanded(true);
  }

  async function handleDownloadTrack(track, onProgress) {
    const url = getAudioUrl(track);
    const success = await downloadTrackForOffline(track, url, onProgress);
    if (success) {
      setDownloadedIds(prev => new Set([...prev, track.id]));
    }
  }

  async function handleRemoveDownload(trackId) {
    await removeTrackFromOffline(trackId);
    setDownloadedIds(prev => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  }

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, currentIndex,
      isPlaying, progress, duration,
      volume, setVolume,
      shuffle, setShuffle,
      repeat, cycleRepeat,
      playTrack, playQueue, togglePlay,
      nextTrack, prevTrack, seekTo,
      getCoverUrl,
      downloadedIds, handleDownloadTrack, handleRemoveDownload,
      // Spotify player & lyrics states
      isExpanded, setIsExpanded, toggleExpanded, openLyrics, openPlayer,
      playerViewMode, setPlayerViewMode,
      lyricsData, lyricsLoading, activeLyricIndex,
    }}>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={e => setProgress(e.target.currentTime)}
        onDurationChange={e => setDuration(e.target.duration)}
        onEnded={nextTrack}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
