import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET } from '@/lib/r2';

export const runtime = 'nodejs';

function authorized(request) {
  const secret = process.env.MUSIC_IMPORT_WORKER_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get('authorization') || '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { size } = await request.json();
    if (!Number.isSafeInteger(size) || size < 1 || size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Invalid audio file size.' }, { status: 400 });
    }
    const key = `audio/imports/${randomUUID().replaceAll('-', '')}.mp3`;
    const url = await getSignedUrl(r2Client, new PutObjectCommand({
      Bucket: R2_BUCKET, Key: key, ContentType: 'audio/mpeg', ContentLength: size,
    }), { expiresIn: 900 });
    return NextResponse.json({ key, url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not prepare the audio upload.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { key } = await request.json();
    if (typeof key !== 'string' || !/^audio\/imports\/[a-f0-9]{32}\.mp3$/.test(key)) {
      return NextResponse.json({ error: 'Invalid import file key.' }, { status: 400 });
    }
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not clean up the upload.' }, { status: 500 });
  }
}
