import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// GET /api/tracks - list all tracks
export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
