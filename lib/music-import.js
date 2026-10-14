import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function forwardImport(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Please sign in to import music.' }, { status: 401 });
  }
  try {
    const { data: { user }, error } = await createServerSupabase().auth.getUser(authorization.slice(7));
    if (error || !user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const workerUrl = process.env.MUSIC_IMPORT_WORKER_URL;
    const secret = process.env.MUSIC_IMPORT_WORKER_SECRET;
    if (!workerUrl || !secret) {
      return NextResponse.json({ error: 'Playlist imports are not configured yet. Set up the music import worker.' }, { status: 503 });
    }
    const id = new URL(request.url).searchParams.get('id');
    if (request.method === 'GET' && id && !/^[a-f0-9]{32}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid import ID.' }, { status: 400 });
    }
    let body;
    if (request.method === 'POST') {
      try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
      }
      body = JSON.stringify({ url: body.url, user_id: user.id });
    }
    const path = request.method === 'POST' ? '/imports' : `/imports${id ? `/${id}` : ''}?user_id=${encodeURIComponent(user.id)}`;
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}${path}`, {
      method: request.method,
      headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Music import gateway:', error.name);
    return NextResponse.json({ error: 'The music import service is unavailable. Try again shortly.' }, { status: 502 });
  }
}
