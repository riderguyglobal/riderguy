import type { Request, Response, NextFunction, RequestHandler } from 'express';

// ============================================================
// asyncHandler — wraps an async route handler so that any
// rejected promise is automatically forwarded to Express's
// error-handling middleware.
// ============================================================

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
