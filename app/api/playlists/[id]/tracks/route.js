import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

function getToken(request) {
  const auth = request.headers.get('authorization');
  return auth ? auth.replace('Bearer ', '') : null;
}

// POST /api/playlists/[id]/tracks - add track to playlist
export async function POST(request, { params }) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { track_id } = await request.json();
  const { id: playlist_id } = await params;

  // Get current max position
  const { data: existing } = await supabase
    .from('playlist_tracks')
    .select('position')
    .eq('playlist_id', playlist_id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = existing?.length ? existing[0].position + 1 : 0;

  const { error } = await supabase
    .from('playlist_tracks')
    .insert({ playlist_id, track_id, position: nextPos });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/playlists/[id]/tracks?track_id=xxx
export async function DELETE(request, { params }) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const track_id = searchParams.get('track_id');
  const { id: playlist_id } = await params;

  const { error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('playlist_id', playlist_id)
    .eq('track_id', track_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
