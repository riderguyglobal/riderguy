// ============================================================
// StorageService — S3/R2 file upload with local fallback
//
// Uses @aws-sdk/client-s3 when configured, otherwise falls
// back to local disk storage under uploads/.
// ============================================================

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config';

// --------------- types ------------------------------------------------

export interface UploadResult {
  key: string;       // storage key (e.g. documents/abc-123.jpg)
  url: string;       // public URL to access the file
  sizeBytes: number;
}

export interface SignedUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

// --------------- constants --------------------------------------------

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// --------------- helpers ----------------------------------------------

function isS3Configured(): boolean {
  return !!(config.s3.endpoint && config.s3.accessKeyId && config.s3.secretAccessKey);
}

function generateKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  return `${folder}/${randomUUID()}${ext}`;
}

// --------------- service class ----------------------------------------

export class StorageService {
  // ---- Upload a buffer ----
  static async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = 'documents',
  ): Promise<UploadResult> {
    // Validate
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${buffer.length} exceeds maximum of ${MAX_FILE_SIZE} bytes`);
    }

    const key = generateKey(folder, originalName);

    if (isS3Configured()) {
      return StorageService.uploadToS3(buffer, key, mimeType);
    }

    return StorageService.uploadToLocal(buffer, key, mimeType);
  }

  // ---- Upload from disk path (multer temp file) ----
  static async uploadFromPath(
    filePath: string,
    originalName: string,
    mimeType: string,
    folder: string = 'documents',
  ): Promise<UploadResult> {
    const buffer = await fs.readFile(filePath);

    if (buffer.length > MAX_FILE_SIZE) {
      await fs.unlink(filePath).catch(() => {});
      throw new Error(`File size ${buffer.length} exceeds maximum of ${MAX_FILE_SIZE} bytes`);
    }

    const result = await StorageService.upload(buffer, originalName, mimeType, folder);

    // Clean up temp file
    await fs.unlink(filePath).catch(() => {});

    return result;
  }

  // ---- Get signed upload URL (for direct client upload) ----
  static async getSignedUploadUrl(
    originalName: string,
    mimeType: string,
    folder: string = 'documents',
  ): Promise<SignedUploadUrl> {
    const key = generateKey(folder, originalName);

    if (isS3Configured()) {
      // In production, generate a presigned PUT URL via @aws-sdk/s3-request-presigner
      // For now, return the API upload endpoint as the URL
      return {
        uploadUrl: `${config.s3.endpoint}/${config.s3.bucketName}/${key}`,
        key,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      };
    }

    // Local fallback — return API upload endpoint
    return {
      uploadUrl: `/api/v1/documents/upload`,
      key,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  // ---- Delete a file ----
  static async delete(fileUrlOrKey: string): Promise<void> {
    // Callers typically pass the stored URL — extract the storage key.
    let key = fileUrlOrKey;

    // Local URLs: /uploads/documents/uuid.jpg → documents/uuid.jpg
    if (key.startsWith('/uploads/')) {
      key = key.slice('/uploads/'.length);
    }

    // S3 URLs: https://endpoint/bucket/documents/uuid.jpg → documents/uuid.jpg
    if (key.startsWith('http')) {
      try {
        const url = new URL(key);
        // Remove leading slash and bucket prefix
        const parts = url.pathname.split('/').filter(Boolean);
        // Skip bucket name (first segment) if it matches config
        if (parts[0] === config.s3.bucketName) {
          parts.shift();
        }
        key = parts.join('/');
      } catch {
        // If URL parsing fails, use as-is
      }
    }

    if (!key) return;

    // Path traversal guard
    if (key.includes('..') || key.startsWith('/')) return;

    if (isS3Configured()) {
      return StorageService.deleteFromS3(key);
    }
    return StorageService.deleteFromLocal(key);
  }

  // ---- Validate MIME type ----
  static isAllowedImageType(mimeType: string): boolean {
    return ALLOWED_IMAGE_TYPES.has(mimeType);
  }

  static isAllowedDocumentType(mimeType: string): boolean {
    return ALLOWED_DOCUMENT_TYPES.has(mimeType);
  }

  // ================================================================
  // S3 Operations
  // ================================================================

  private static async uploadToS3(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadResult> {
    // Dynamic import so we don't crash if @aws-sdk isn't installed
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });

    await client.send(new PutObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));

    const url = `${config.s3.endpoint}/${config.s3.bucketName}/${key}`;

    return { key, url, sizeBytes: buffer.length };
  }

  private static async deleteFromS3(key: string): Promise<void> {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });

    await client.send(new DeleteObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    }));
  }

  // ================================================================
  // Local Disk Operations (development fallback)
  // ================================================================

  private static async uploadToLocal(
    buffer: Buffer,
    key: string,
    _mimeType: string,
  ): Promise<UploadResult> {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const fullPath = path.join(uploadsRoot, key);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    const url = `/uploads/${key}`;

    return { key, url, sizeBytes: buffer.length };
  }

  private static async deleteFromLocal(key: string): Promise<void> {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const fullPath = path.resolve(uploadsRoot, key);

    // Path traversal guard
    if (!fullPath.startsWith(uploadsRoot)) return;

    await fs.unlink(fullPath).catch(() => {});
  }
}
