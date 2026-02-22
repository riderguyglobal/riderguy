import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { config } from '../config';

// ============================================================
// Global error handler – must be the LAST middleware registered
// on the Express app.
// ============================================================

export const errorHandler: ErrorRequestHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Already an ApiError
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error({ err }, 'Non-operational API error');
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unexpected / programmer error
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction
        ? 'An unexpected error occurred'
        : err.message || 'An unexpected error occurred',
    },
  });
};
