import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const mode = process.env.ASSET_STORAGE === 's3' ? 's3' : 'local';
const localRoot = path.resolve(process.cwd(), process.env.ASSET_LOCAL_DIR || 'uploads');
const bucket = process.env.S3_BUCKET || '';
const s3 =
  mode === 's3'
    ? new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      })
    : null;

function localPath(key: string): string {
  return path.join(localRoot, key);
}

export async function putAsset(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  if (s3) {
    if (!bucket) throw new Error('S3_BUCKET is required when ASSET_STORAGE=s3');
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return;
  }

  const target = localPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
}

export async function readAsset(key: string): Promise<Readable> {
  if (s3) {
    if (!bucket) throw new Error('S3_BUCKET is required when ASSET_STORAGE=s3');
    const result = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    return result.Body as Readable;
  }
  return createReadStream(localPath(key));
}

export async function removeAsset(key: string): Promise<void> {
  if (s3) {
    if (!bucket) throw new Error('S3_BUCKET is required when ASSET_STORAGE=s3');
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await unlink(localPath(key)).catch(() => {});
}
