import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  config: {
    s3: {
      endpoint: 'https://storage.example.test/root',
      region: 'auto',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucketName: 'riderguy-uploads',
    },
  },
}));

import { StorageService } from './storage.service';

describe('StorageService private upload references', () => {
  it('builds owner-scoped folders and rejects path-like owner IDs', () => {
    expect(StorageService.ownerFolder('documents', 'user_123')).toBe('documents/user_123');
    expect(() => StorageService.ownerFolder('documents', '../other-user')).toThrow(
      'Invalid private upload owner',
    );
  });

  it('accepts one or several package photos only when every key belongs to the owner', () => {
    expect(StorageService.privateReferencesBelongTo(
      '/uploads/packages/client-1/a.jpg,/uploads/packages/client-1/b.jpg',
      'packages',
      'client-1',
    )).toBe(true);

    expect(StorageService.privateReferencesBelongTo(
      '/uploads/packages/client-1/a.jpg,/uploads/packages/client-2/b.jpg',
      'packages',
      'client-1',
    )).toBe(false);
  });

  it('rejects external, legacy-flat, malformed, and traversal references for new bindings', () => {
    expect(StorageService.privateReferencesBelongTo(
      'https://attacker.example/uploads/packages/client-1/a.jpg',
      'packages',
      'client-1',
    )).toBe(false);
    expect(StorageService.privateReferencesBelongTo(
      '/uploads/packages/legacy-flat.jpg',
      'packages',
      'client-1',
    )).toBe(false);
    expect(StorageService.privateReferencesBelongTo(
      '/uploads/packages/client-1/a.jpg,',
      'packages',
      'client-1',
    )).toBe(false);
    expect(StorageService.privateReferencesBelongTo(
      '/uploads/packages/client-1/../client-2/a.jpg',
      'packages',
      'client-1',
    )).toBe(false);
  });

  it('recognizes a configured legacy S3 URL without trusting another origin', () => {
    expect(StorageService.extractKey(
      'https://storage.example.test/root/riderguy-uploads/documents/legacy.jpg',
    )).toBe('documents/legacy.jpg');
    expect(StorageService.extractKey(
      'https://other.example.test/root/riderguy-uploads/documents/legacy.jpg',
    )).toBeNull();
  });
});
