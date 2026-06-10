import path from 'path';
import fs from 'fs/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

const RECEIPT_SUBDIR = 'feed-receipts';

function r2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME,
  );
}

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function objectKey(farmId: string, purchaseId: string, ext: string): string {
  return `${RECEIPT_SUBDIR}/${farmId}/${purchaseId}${ext}`;
}

function mimeForExt(ext: string): string {
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function localPathForKey(receiptKey: string): string {
  return path.join(process.cwd(), 'uploads', receiptKey);
}

export class ObjectStorageService {
  static isR2Enabled(): boolean {
    return r2Configured();
  }

  static async saveReceipt(
    farmId: string,
    purchaseId: string,
    buffer: Buffer,
    originalName: string,
  ): Promise<{ receiptKey: string; mime: string }> {
    const ext = path.extname(originalName).toLowerCase();
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.bin';
    const mime = mimeForExt(safeExt);
    const receiptKey = path.join(RECEIPT_SUBDIR, farmId, `${purchaseId}${safeExt}`).replace(/\\/g, '/');

    if (r2Configured()) {
      const key = objectKey(farmId, purchaseId, safeExt);
      await getS3().send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: mime,
        }),
      );
      return { receiptKey: key, mime };
    }

    const full = localPathForKey(receiptKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return { receiptKey, mime };
  }

  static async readReceipt(receiptKey: string): Promise<{ buffer: Buffer; mime: string }> {
    const ext = path.extname(receiptKey).toLowerCase();
    const mime = mimeForExt(ext);

    if (r2Configured() && !receiptKey.includes('..')) {
      const res = await getS3().send(
        new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: receiptKey.replace(/\\/g, '/'),
        }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new Error('Empty object from storage');
      return { buffer: Buffer.from(bytes), mime: res.ContentType || mime };
    }

    const full = localPathForKey(receiptKey);
    const buffer = await fs.readFile(full);
    return { buffer, mime };
  }

  /** Signed URL for direct browser access (R2 only). */
  static async getReceiptSignedUrl(receiptKey: string, expiresInSec = 300): Promise<string | null> {
    if (!r2Configured()) return null;
    return getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: receiptKey.replace(/\\/g, '/'),
      }),
      { expiresIn: expiresInSec },
    );
  }
}
