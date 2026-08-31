import { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AUTHENTICATED_UPLOAD_ROUTE, isPublicAvatarUploadPath } from './route-paths';

describe('API route patterns', () => {
  it('registers the authenticated upload wildcard under Express 5', () => {
    const router = Router();

    expect(() => router.get(AUTHENTICATED_UPLOAD_ROUTE, vi.fn())).not.toThrow();
  });

  it('exempts only safe avatar paths from upload authentication', () => {
    expect(isPublicAvatarUploadPath(['avatars', 'abc-123.jpg'])).toBe(true);
    expect(isPublicAvatarUploadPath(['documents', 'user-1', 'abc-123.jpg'])).toBe(false);
    expect(isPublicAvatarUploadPath(['avatars', '..', 'documents', 'secret.pdf'])).toBe(false);
    expect(isPublicAvatarUploadPath(['avatars', 'nested/path.jpg'])).toBe(false);
  });
});
