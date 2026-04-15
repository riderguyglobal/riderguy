import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler, globalRateLimit, securityHeaders } from './middleware';
import { logger } from './lib/logger';
import { StatusCodes } from 'http-status-codes';

// ============================================================
// Express Application
// ============================================================

const app = express();

// ---------- Proxy trust (required for correct req.ip behind reverse proxy) ----------
app.set('trust proxy', 1);

// ---------- Security ----------
app.use(helmet({
  contentSecurityPolicy: false,    // Managed by securityHeaders middleware
  xContentTypeOptions: false,      // Managed by securityHeaders middleware
  frameguard: false,               // Managed by securityHeaders middleware
  referrerPolicy: false,           // Managed by securityHeaders middleware
}));
app.use(securityHeaders);
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ---------- Body parsing ----------
// Capture raw body buffer for Paystack webhook HMAC verification
app.use(express.json({
  limit: '2mb',
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ---------- Compression ----------
app.use(compression());

// ---------- Rate limiting ----------
app.use(globalRateLimit);

// ---------- Request logging ----------
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// ---------- Health check ----------
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  // Database check
  try {
    const { prisma } = await import('@riderguy/database');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Redis check
  try {
    const { getRedisClient } = await import('./lib/redis');
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'not_configured';
    }
  } catch {
    checks.redis = 'error';
  }

  const allHealthy = Object.values(checks).every(v => v === 'ok' || v === 'not_configured');

  res.status(allHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    ...(config.nodeEnv !== 'production' && {
      uptime: process.uptime(),
      environment: config.nodeEnv,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    }),
  });
});

// ---------- Authenticated file serving (PII-sensitive uploads) ----------
// Files are served via API routes with auth checks instead of static middleware.
// See: GET /api/v1/documents/:id for document file access.

// ---------- API routes ----------
app.use('/api/v1', apiRouter);

// ---------- 404 ----------
app.use((_req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist' },
  });
});

// ---------- Global error handler (must be last) ----------
app.use(errorHandler);

export { app };
