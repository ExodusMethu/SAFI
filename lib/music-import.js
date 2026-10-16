import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { queuedImport } from '@/lib/music-import-queue.mjs';

export async function forwardImport(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Please sign in to import music.' }, { status: 401 });
  }
  try {
    const db = createServerSupabase();
    const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const workerUrl = process.env.MUSIC_IMPORT_WORKER_URL;
    const secret = process.env.MUSIC_IMPORT_WORKER_SECRET;
    const mode = process.env.MUSIC_IMPORT_MODE || (workerUrl ? 'cloud' : 'local');
    const id = new URL(request.url).searchParams.get('id');
    if (request.method === 'GET' && id && !/^[a-f0-9]{32}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid import ID.' }, { status: 400 });
    }
    let body;
    if (request.method === 'POST') {
      try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
      }
    }
    if (mode === 'local') {
      const result = await queuedImport(db, user.id, request.method, id, body);
      return NextResponse.json(result.data, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
    }
    if (mode !== 'cloud' || !workerUrl || !secret) {
      return NextResponse.json({ error: 'Playlist imports are not configured. Check the import settings.' }, { status: 503 });
    }
    if (request.method === 'POST') body = JSON.stringify({ url: body?.url, user_id: user.id });
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
    return NextResponse.json({ error: 'Playlist imports are unavailable. Check the import settings and database migrations.' }, { status: 502 });
  }
}
