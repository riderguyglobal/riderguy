import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './validate';

describe('validate middleware', () => {
  it('shadows the Express 5 getter-only query property with parsed query data', () => {
    const request = {} as Request;
    Object.defineProperty(request, 'query', {
      configurable: true,
      get: () => ({ page: '2', includeArchived: 'true' }),
    });
    const next = vi.fn() as NextFunction;

    validate(z.object({
      page: z.coerce.number().int().positive(),
      includeArchived: z.enum(['true', 'false']).transform((value) => value === 'true'),
    }), 'query')(request, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.query).toEqual({ page: 2, includeArchived: true });
    expect(Object.getOwnPropertyDescriptor(request, 'query')).toMatchObject({
      configurable: true,
      enumerable: true,
      value: { page: 2, includeArchived: true },
      writable: true,
    });
  });

  it('does not replace a getter-only query when validation fails', () => {
    const originalQuery = { page: 'not-a-number' };
    const request = {} as Request;
    Object.defineProperty(request, 'query', {
      configurable: true,
      get: () => originalQuery,
    });

    expect(() => validate(
      z.object({ page: z.coerce.number().int().positive() }),
      'query',
    )(request, {} as Response, vi.fn())).toThrow('Validation failed');
    expect(request.query).toBe(originalQuery);
  });
});
