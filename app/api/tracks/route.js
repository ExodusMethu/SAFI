import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/tracks - list all tracks
export async function GET(request) {
  const supabase = createServerSupabase();
  const offset = Number(new URL(request.url).searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: 'Invalid offset' }, { status: 400 });
  }
  const pageSize = 200;
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Has-More': String(data.length === pageSize),
    },
  });
}

// POST /api/tracks - save track metadata after upload
export async function POST(request) {
  const supabase = createServerSupabase();
  const body = await request.json();

  const { title, artist, album, duration, file_key, cover_key, file_size } = body;

  if (!title || !file_key) {
    return NextResponse.json({ error: 'title and file_key are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tracks')
    .insert({ title, artist, album, duration, file_key, cover_key, file_size })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
