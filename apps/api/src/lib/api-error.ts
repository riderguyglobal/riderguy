import { StatusCodes } from 'http-status-codes';

// ============================================================
// Custom API Error class used throughout the application.
// Thrown from services / controllers and caught by the
// global error handler middleware.
// ============================================================

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // ---------- Factory helpers ----------

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(StatusCodes.BAD_REQUEST, message, code, true, details);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(StatusCodes.UNAUTHORIZED, message, code);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(StatusCodes.FORBIDDEN, message, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(StatusCodes.NOT_FOUND, message, code);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new ApiError(StatusCodes.CONFLICT, message, code);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new ApiError(StatusCodes.TOO_MANY_REQUESTS, message, code);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message, 'INTERNAL_ERROR', false);
  }
}
