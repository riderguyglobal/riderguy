import { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AUTHENTICATED_UPLOAD_ROUTE } from './route-paths';

describe('API route patterns', () => {
  it('registers the authenticated upload wildcard under Express 5', () => {
    const router = Router();

    expect(() => router.get(AUTHENTICATED_UPLOAD_ROUTE, vi.fn())).not.toThrow();
  });
});
