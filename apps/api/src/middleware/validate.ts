import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../lib/api-error';

// ============================================================
// validate – Express middleware factory.
// Pass a Zod schema and which part of the request to validate
// ('body' | 'query' | 'params'). If validation fails the
// global error handler will respond with 400.
// ============================================================

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      throw ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', formattedErrors);
    }

    // Overwrite with parsed (and possibly transformed) data
    req[source] = result.data;
    next();
  };
}
