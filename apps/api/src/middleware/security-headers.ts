import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// ============================================================
// Security Headers Middleware
//
// Adds CSP, HSTS, and other hardening headers beyond what
// helmet provides by default. Applied in production mode.
// ============================================================

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // ---- Content Security Policy ----
  // In development, allow localhost connections; in production, restrict to the API domain.
  const connectSrc =
    config.nodeEnv === 'production'
      ? "'self' https://api.myriderguy.com wss://api.myriderguy.com"
      : "'self' http://localhost:* ws://localhost:*";

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );

  // ---- Permissions Policy (formerly Feature-Policy) ----
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)',
  );

  // ---- Prevent MIME type sniffing ----
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // ---- Referrer Policy ----
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ---- Prevent clickjacking ----
  res.setHeader('X-Frame-Options', 'DENY');

  // ---- HTTP Strict Transport Security ----
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // ── HTTP Parameter Pollution Protection ──
  // Strip duplicate query params (keep last value)
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (Array.isArray(val)) {
        req.query[key] = val[val.length - 1];
      }
    }
  }

  next();
}
