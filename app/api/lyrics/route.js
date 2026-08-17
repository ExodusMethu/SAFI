import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 86400; // Cache for 1 day

function cleanNoise(str) {
  if (!str) return '';
  return str
    .replace(/\s*\(feat\..*?\)/gi, '')
    .replace(/\s*\[feat\..*?\]/gi, '')
    .replace(/\s*\(ft\..*?\)/gi, '')
    .replace(/\s*\[ft\..*?\]/gi, '')
    .replace(/\s*\(with.*?\)/gi, '')
    .replace(/\s*\[with.*?\]/gi, '')
    .replace(/\s*\(official.*?\)/gi, '')
    .replace(/\s*\[official.*?\]/gi, '')
    .replace(/\s*\(video.*?\)/gi, '')
    .replace(/\s*\[video.*?\]/gi, '')
    .replace(/\s*\(audio.*?\)/gi, '')
    .replace(/\s*\[audio.*?\]/gi, '')
    .replace(/\s*\(remastered.*?\)/gi, '')
    .replace(/\s*\[remastered.*?\]/gi, '')
    .replace(/\s*\(deluxe.*?\)/gi, '')
    .replace(/\s*\[deluxe.*?\]/gi, '')
    .replace(/\s*\(bonus track.*?\)/gi, '')
    .replace(/\s*\[bonus track.*?\]/gi, '')
    .replace(/\s*\(live.*?\)/gi, '')
    .replace(/\s*\[live.*?\]/gi, '')
    .replace(/\.mp3|\.m4a|\.wav|\.flac|\.ogg|\.opus|\.aac/gi, '')
    .trim();
}

function extractCleanLyrics(lrc) {
  if (!lrc || typeof lrc !== 'string') return null;
  const clean = lrc
    .split(/\r?\n/)
    .filter(line => !/^\[[a-z]{2,8}:/i.test(line.trim()))
    .map(line => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
    .join('\n')
    .trim();
  return clean.length > 0 ? clean : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get('title') || '';
  const rawArtist = searchParams.get('artist') || '';
  const rawAlbum = searchParams.get('album') || '';
  const rawDuration = searchParams.get('duration');

  if (!rawTitle.trim()) {
    return NextResponse.json(
      { notFound: true, isInstrumental: false, plainLyrics: null, syncedLyrics: null, message: 'Title is required' },
      { status: 400 }
    );
  }

  const cleanTitle = cleanNoise(rawTitle);
  const cleanArtist = cleanNoise(rawArtist);
  const cleanAlbum = cleanNoise(rawAlbum);

  const headers = {
    'User-Agent': 'SAFI-Music-Player/1.0 (https://github.com/ExodusMethu/SAFI)',
    'Accept': 'application/json',
  };

  try {
    // 1. First attempt: Direct match via /api/get
    const getParams = new URLSearchParams();
    getParams.set('track_name', cleanTitle || rawTitle);
    if (cleanArtist || rawArtist) getParams.set('artist_name', cleanArtist || rawArtist);
    if (cleanAlbum) getParams.set('album_name', cleanAlbum);
    if (rawDuration && !isNaN(parseFloat(rawDuration))) {
      getParams.set('duration', Math.round(parseFloat(rawDuration)).toString());
    }

    let response = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
      headers,
      next: { revalidate: 86400 },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && (data.syncedLyrics || data.plainLyrics || data.instrumental)) {
        const plainLyrics = data.plainLyrics || extractCleanLyrics(data.syncedLyrics);
        return NextResponse.json(
          {
            id: data.id,
            title: data.trackName || data.name,
            artist: data.artistName,
            album: data.albumName,
            duration: data.duration,
            isInstrumental: Boolean(data.instrumental),
            plainLyrics: plainLyrics || null,
            syncedLyrics: null,
            notFound: !plainLyrics && !data.instrumental,
          },
          {
            headers: {
              'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
            },
          }
        );
      }
    }

    // 2. Second attempt: Search with query string
    const searchQuery = `${cleanTitle} ${cleanArtist}`.trim();
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
    
    response = await fetch(searchUrl, {
      headers,
      next: { revalidate: 86400 },
    });

    if (response.ok) {
      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best match with lyrics
        const matched = results.find(r => r.plainLyrics || r.syncedLyrics) || results[0];
        const plainLyrics = matched.plainLyrics || extractCleanLyrics(matched.syncedLyrics);
        return NextResponse.json(
          {
            id: matched.id,
            title: matched.trackName || matched.name,
            artist: matched.artistName,
            album: matched.albumName,
            duration: matched.duration,
            isInstrumental: Boolean(matched.instrumental),
            plainLyrics: plainLyrics || null,
            syncedLyrics: null,
            notFound: !plainLyrics && !matched.instrumental,
          },
          {
            headers: {
              'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
            },
          }
        );
      }
    }

    // 3. Fallback: No lyrics found
    return NextResponse.json(
      {
        notFound: true,
        isInstrumental: false,
        plainLyrics: null,
        syncedLyrics: null,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch (error) {
    console.error('Lyrics API fetch error:', error);
    return NextResponse.json(
      {
        notFound: true,
        isInstrumental: false,
        plainLyrics: null,
        syncedLyrics: null,
        error: error.message,
      },
      { status: 200 }
    );
  }
}
