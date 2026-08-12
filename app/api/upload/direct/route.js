import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase-server';

// POST /api/upload/direct - Fallback endpoint when direct browser R2 upload fails due to CORS
export async function POST(request) {
  const supabase = createServerSupabase();

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title');
    const artist = formData.get('artist');
    const album = formData.get('album');

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const key = `audio/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload to R2 from server (no CORS restrictions)
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'audio/mpeg',
      })
    );

    // Save to Supabase DB
    const { data: track, error: dbError } = await supabase
      .from('tracks')
      .insert({
        title: title || file.name,
        artist: artist || null,
        album: album || null,
        file_key: key,
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    console.error('Server upload error:', err);
    return NextResponse.json({ error: err.message || 'Server upload failed' }, { status: 500 });
  }
}
