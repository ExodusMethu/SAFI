import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

function getUserFromRequest(request) {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  return auth.replace('Bearer ', '');
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const token = getUserFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Delete the playlist
  // (Assuming cascade delete is enabled for playlist_tracks in the db schema,
  // or we need to delete them manually. Let's assume Supabase handles cascade).
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // Ensure user owns the playlist

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
