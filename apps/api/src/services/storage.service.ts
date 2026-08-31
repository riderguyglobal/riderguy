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

export type PrivateUploadFolder =
  | 'documents'
  | 'vehicles'
  | 'packages'
  | 'proofs'
  | 'failures';

export interface StoredObject {
  buffer: Buffer;
  contentType?: string;
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

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (supports video uploads)

const PRIVATE_UPLOAD_FOLDERS = new Set<PrivateUploadFolder>([
  'documents',
  'vehicles',
  'packages',
  'proofs',
  'failures',
]);

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]{1,160}$/;

// --------------- helpers ----------------------------------------------

function isS3Configured(): boolean {
  return !!(config.s3.endpoint && config.s3.accessKeyId && config.s3.secretAccessKey);
}

function generateKey(folder: string, originalName: string): string {
  const normalizedFolder = normalizeStorageFolder(folder);
  if (!normalizedFolder) {
    throw new Error('Invalid upload folder');
  }
  const folderSegments = normalizedFolder.split('/');
  if (
    PRIVATE_UPLOAD_FOLDERS.has(folderSegments[0] as PrivateUploadFolder)
    && folderSegments.length < 2
  ) {
    throw new Error('Private uploads must be owner-scoped');
  }
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  return `${normalizedFolder}/${randomUUID()}${ext}`;
}

function normalizeStorageFolder(value: string): string | null {
  const normalized = value.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('\\')) return null;

  const segments = normalized.split('/');
  if (segments.some((segment) => !SAFE_PATH_SEGMENT.test(segment))) return null;
  return segments.join('/');
}

function normalizeStorageKey(value: string): string | null {
  const withoutQuery = value.split(/[?#]/, 1)[0]?.replace(/^\/+|\/+$/g, '');
  if (!withoutQuery || withoutQuery.includes('\\')) return null;

  const segments = withoutQuery.split('/');
  if (
    segments.length < 2
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }

  return segments.join('/');
}

// --------------- service class ----------------------------------------

export class StorageService {
  /** Build a private, owner-scoped folder without trusting caller-supplied paths. */
  static ownerFolder(folder: PrivateUploadFolder, ownerUserId: string): string {
    if (!PRIVATE_UPLOAD_FOLDERS.has(folder) || !SAFE_PATH_SEGMENT.test(ownerUserId)) {
      throw new Error('Invalid private upload owner');
    }
    return `${folder}/${ownerUserId}`;
  }

  static isPrivateKey(key: string): boolean {
    const normalized = normalizeStorageKey(key);
    if (!normalized) return false;
    return PRIVATE_UPLOAD_FOLDERS.has(normalized.split('/')[0] as PrivateUploadFolder);
  }

  static isAllowedUploadFolder(folder: string): boolean {
    return folder === 'avatars' || PRIVATE_UPLOAD_FOLDERS.has(folder as PrivateUploadFolder);
  }

  /**
   * Convert a stored upload reference to its storage key. Absolute URLs are
   * accepted only for the configured S3/R2 endpoint; API-managed uploads are
   * exchanged as relative `/uploads/...` references.
   */
  static extractKey(reference: string): string | null {
    const value = reference.trim();
    if (!value) return null;

    if (/^https?:\/\//i.test(value)) {
      let parsed: URL;
      let endpoint: URL;
      try {
        parsed = new URL(value);
        endpoint = new URL(config.s3.endpoint);
      } catch {
        return null;
      }

      if (!config.s3.endpoint || parsed.origin !== endpoint.origin) return null;

      const endpointPath = endpoint.pathname.replace(/\/+$/, '');
      const bucketPrefix = `${endpointPath}/${config.s3.bucketName}/`.replace(/\/{2,}/g, '/');
      if (!parsed.pathname.startsWith(bucketPrefix)) return null;

      try {
        return normalizeStorageKey(decodeURIComponent(parsed.pathname.slice(bucketPrefix.length)));
      } catch {
        return null;
      }
    }

    const relative = value.replace(/^\/+/, '');
    const withoutApiPrefix = relative.startsWith('api/v1/uploads/')
      ? relative.slice('api/v1/uploads/'.length)
      : relative.startsWith('uploads/')
        ? relative.slice('uploads/'.length)
        : relative;

    try {
      return normalizeStorageKey(decodeURIComponent(withoutApiPrefix));
    } catch {
      return null;
    }
  }

  static urlCandidates(key: string): string[] {
    const normalized = normalizeStorageKey(key);
    if (!normalized) return [];

    const candidates = [normalized, `/uploads/${normalized}`, `/api/v1/uploads/${normalized}`];
    if (config.s3.endpoint) {
      candidates.push(
        `${config.s3.endpoint.replace(/\/+$/, '')}/${config.s3.bucketName}/${normalized}`,
      );
    }
    return candidates;
  }

  static privateReferencesBelongTo(
    references: string,
    folder: PrivateUploadFolder,
    ownerUserId: string,
  ): boolean {
    if (!SAFE_PATH_SEGMENT.test(ownerUserId)) return false;

    const values = references.split(',').map((value) => value.trim());
    if (values.length === 0 || values.some((value) => !value)) return false;

    return values.every((value) => {
      const key = StorageService.extractKey(value);
      if (!key) return false;
      const segments = key.split('/');
      return segments.length >= 3 && segments[0] === folder && segments[1] === ownerUserId;
    });
  }

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

    try {
      return await StorageService.upload(buffer, originalName, mimeType, folder);
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
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
    const extractedKey = StorageService.extractKey(fileUrlOrKey);
    if (!extractedKey) return;
    let key = extractedKey;

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

  /** Read an object from configured S3/R2 for the authenticated API proxy. */
  static async downloadFromS3(key: string): Promise<StoredObject | null> {
    const normalized = normalizeStorageKey(key);
    if (!normalized || !isS3Configured()) return null;

    const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });

    try {
      const result = await client.send(new GetObjectCommand({
        Bucket: config.s3.bucketName,
        Key: normalized,
      }));
      if (!result.Body) return null;

      const bytes = await result.Body.transformToByteArray();
      return {
        buffer: Buffer.from(bytes),
        ...(result.ContentType ? { contentType: result.ContentType } : {}),
      };
    } catch (error) {
      const storageError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        storageError.name === 'NoSuchKey'
        || storageError.name === 'NotFound'
        || storageError.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
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

    // Private objects are always retrieved through the authenticated API
    // proxy. Avatars retain their existing cross-user/public URL behaviour.
    const url = StorageService.isPrivateKey(key)
      ? `/uploads/${key}`
      : `${config.s3.endpoint.replace(/\/+$/, '')}/${config.s3.bucketName}/${key}`;

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
    const fullPath = path.resolve(uploadsRoot, key);

    if (!fullPath.startsWith(uploadsRoot)) {
      throw new Error('Invalid upload path');
    }

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
