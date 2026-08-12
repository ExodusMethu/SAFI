import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase-server';

// POST /api/upload/presign
// Returns a presigned URL so the browser can upload directly to R2
export async function POST(request) {
  const supabase = createServerSupabase();

  // Verify auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fileName, fileType, isCover } = await request.json();

  const ext = fileName.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const key = isCover
    ? `covers/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`
    : `audio/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: fileType,
  });

  const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

  return NextResponse.json({ presignedUrl, key });
}
