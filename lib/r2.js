import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID ?? 'placeholder'}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? 'placeholder',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? 'placeholder',
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'safi-audio';
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
