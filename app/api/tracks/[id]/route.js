import { NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase-server';

// DELETE /api/tracks/[id]
export async function DELETE(request, { params }) {
  const { id } = await params;
  const supabase = createServerSupabase();

  // Fetch the track to get its file keys
  const { data: track, error: fetchError } = await supabase
    .from('tracks')
    .select('file_key, cover_key')
    .eq('id', id)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

  // Delete from R2
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: track.file_key }));
    if (track.cover_key) {
      await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: track.cover_key }));
    }
  } catch (e) {
    console.error('R2 delete error:', e);
  }

  // Delete from DB
  const { error } = await supabase.from('tracks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
