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

    // Express 5 exposes `req.query` as a getter-only property on the request
    // prototype. A direct assignment throws at runtime even though the
    // Express TypeScript surface still permits it. Shadow the getter with the
    // parsed value so downstream handlers receive Zod defaults/transforms in
    // exactly the same way as body and params validation.
    if (source === 'query') {
      Object.defineProperty(req, 'query', {
        configurable: true,
        enumerable: true,
        value: result.data,
        writable: true,
      });
    } else {
      req[source] = result.data;
    }
    next();
  };
}
