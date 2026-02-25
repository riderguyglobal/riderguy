import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
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
  // Already an ApiError — use its status + code directly
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

  // ---- Prisma errors — convert to meaningful HTTP responses ----

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ err, prismaCode: err.code, meta: err.meta }, 'Prisma known request error');

    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (err.meta?.target as string[])?.join(', ') ?? 'field';
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: `A record with this ${target} already exists`,
          },
        });
        return;
      }
      case 'P2025': {
        // Record not found
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Record not found' },
        });
        return;
      }
      case 'P2003': {
        // Foreign key constraint failure
        res.status(400).json({
          success: false,
          error: { code: 'RELATION_ERROR', message: 'Related record not found' },
        });
        return;
      }
      default: {
        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: config.isProduction
              ? `A database error occurred (${err.code})`
              : `Prisma error ${err.code}: ${err.message}`,
          },
        });
        return;
      }
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error({ err }, 'Prisma validation error');
    res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_VALIDATION_ERROR',
        message: config.isProduction
          ? 'Invalid data provided'
          : err.message,
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ err }, 'Prisma initialisation error — DB connection failed');
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is temporarily unavailable. Please try again.',
      },
    });
    return;
  }

  // ---- Unknown / programmer error ----
  logger.error(
    { err, errName: err?.name, errMessage: err?.message, stack: err?.stack },
    'Unhandled error',
  );

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
