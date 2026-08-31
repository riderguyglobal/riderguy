import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { StringValue } from 'ms';

// Load .env from monorepo root (Turbo runs from apps/api/).
// PM2 can preserve stale env vars across reloads; keep the deploy .env authoritative.
dotenvConfig({ path: resolve(__dirname, '../../../../.env'), override: true });

// ============================================================
// Centralised configuration – reads from environment once,
// validates, and exports typed values used across the API.
// ============================================================

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // Server
  port: parseInt(optionalEnv('PORT', '4000'), 10) || 4000,
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',

  // Auth
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue,
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '30d') as StringValue,
  },

  // Database (handled by Prisma via DATABASE_URL)
  databaseUrl: requireEnv('DATABASE_URL'),

  // Redis
  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  },

  // S3 / Cloudflare R2
  s3: {
    endpoint: optionalEnv('S3_ENDPOINT', ''),
    region: optionalEnv('S3_REGION', 'auto'),
    accessKeyId: optionalEnv('S3_ACCESS_KEY_ID', ''),
    secretAccessKey: optionalEnv('S3_SECRET_ACCESS_KEY', ''),
    bucketName: optionalEnv('S3_BUCKET_NAME', 'riderguy-uploads'),
  },

  // Payment Gateways
  paystack: {
    secretKey: optionalEnv('PAYSTACK_SECRET_KEY', ''),
    publicKey: optionalEnv('PAYSTACK_PUBLIC_KEY', ''),
    webhookSecret: optionalEnv('PAYSTACK_WEBHOOK_SECRET', ''),
  },

  // External Services
  // Gmail/Workspace SMTP — authenticates as GMAIL_USER (an app password, not the
  // account password), sends with the From address in fromEmail (must be GMAIL_USER
  // itself or a verified "Send mail as" alias on that account).
  email: {
    user: optionalEnv('GMAIL_USER', ''),
    appPassword: optionalEnv('GMAIL_APP_PASSWORD', ''),
    fromEmail: optionalEnv('EMAIL_FROM', 'noreply@myriderguy.com'),
  },
  // mNotify SMS (Ghana)
  mnotify: {
    apiKey: optionalEnv('MNOTIFY_API_KEY', ''),
    senderId: optionalEnv('MNOTIFY_SENDER_ID', 'RiderGuy'),
  },

  // Sentry
  sentry: {
    dsn: optionalEnv('SENTRY_DSN', ''),
  },

  // Firebase Cloud Messaging (push notifications)
  firebase: {
    // Legacy single-project settings are retained for non-native integrations,
    // but native push delivery is routed through the explicit Rider/Client
    // projects below. Never guess a target project from an FCM token.
    projectId: optionalEnv('FIREBASE_PROJECT_ID', ''),
    clientEmail: optionalEnv('FIREBASE_CLIENT_EMAIL', ''),
    privateKey: optionalEnv('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
    rider: {
      projectId: optionalEnv('FIREBASE_RIDER_PROJECT_ID', ''),
      clientEmail: optionalEnv('FIREBASE_RIDER_CLIENT_EMAIL', ''),
      privateKey: optionalEnv('FIREBASE_RIDER_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
    },
    client: {
      projectId: optionalEnv('FIREBASE_CLIENT_PROJECT_ID', ''),
      clientEmail: optionalEnv('FIREBASE_CLIENT_CLIENT_EMAIL', ''),
      privateKey: optionalEnv('FIREBASE_CLIENT_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
    },
  },

  // Google Maps
  google: {
    clientId: optionalEnv('GOOGLE_CLIENT_ID', ''),
    // Rider and Client are separate Android apps and therefore use separate
    // OAuth Web client IDs. GOOGLE_CLIENT_IDS is the preferred comma-separated
    // allowlist; GOOGLE_CLIENT_ID remains a backwards-compatible fallback.
    clientIds: optionalEnv('GOOGLE_CLIENT_IDS', optionalEnv('GOOGLE_CLIENT_ID', ''))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    mapsApiKey: optionalEnv('GOOGLE_MAPS_API_KEY', ''),
  },

  // CORS
  cors: {
    origins: optionalEnv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003').split(',').map(s => s.trim()),
  },

  // WebAuthn (biometric login)
  webauthn: {
    rpName: optionalEnv('WEBAUTHN_RP_NAME', 'RiderGuy'),
    rpID: optionalEnv('WEBAUTHN_RP_ID', 'localhost'),
    origin: optionalEnv('WEBAUTHN_ORIGIN', 'http://localhost:3002').split(',').map(s => s.trim()),
  },
} as const;

// Production safety checks
if (process.env.NODE_ENV === 'production') {
  if (!process.env.WEBAUTHN_RP_ID || config.webauthn.rpID === 'localhost') {
    console.warn('[CONFIG] WARNING: WEBAUTHN_RP_ID is not set or is "localhost" in production. Biometric login will fail.');
  }
  if (!process.env.WEBAUTHN_ORIGIN || config.webauthn.origin.some(o => o.includes('localhost'))) {
    console.warn('[CONFIG] WARNING: WEBAUTHN_ORIGIN contains localhost in production. Biometric login will fail.');
  }

  // Warn about critical services that will silently fail if unconfigured
  const criticalServices: [string, string, string][] = [
    ['PAYSTACK_SECRET_KEY', config.paystack.secretKey, 'Payment processing'],
    ['MNOTIFY_API_KEY', config.mnotify.apiKey, 'SMS/OTP delivery'],
    ['GMAIL_APP_PASSWORD', config.email.appPassword, 'Email delivery'],
    ['FIREBASE_RIDER_PROJECT_ID', config.firebase.rider.projectId, 'Rider push notifications'],
    ['FIREBASE_RIDER_CLIENT_EMAIL', config.firebase.rider.clientEmail, 'Rider push notifications'],
    ['FIREBASE_RIDER_PRIVATE_KEY', config.firebase.rider.privateKey, 'Rider push notifications'],
    ['FIREBASE_CLIENT_PROJECT_ID', config.firebase.client.projectId, 'Client push notifications'],
    ['FIREBASE_CLIENT_CLIENT_EMAIL', config.firebase.client.clientEmail, 'Client push notifications'],
    ['FIREBASE_CLIENT_PRIVATE_KEY', config.firebase.client.privateKey, 'Client push notifications'],
    ['REDIS_URL', process.env.REDIS_URL ?? '', 'Session store / rate limiting / queues'],
    ['S3_ENDPOINT', config.s3.endpoint, 'File uploads (S3/R2)'],
    ['GOOGLE_MAPS_API_KEY', config.google.mapsApiKey, 'Maps / geocoding'],
    ['GOOGLE_CLIENT_IDS', config.google.clientIds.join(','), 'Google Sign-In'],
  ];
  const missing = criticalServices.filter(([, val]) => !val);
  if (missing.length > 0) {
    console.warn('[CONFIG] WARNING: The following production services are UNCONFIGURED:');
    for (const [key, , desc] of missing) {
      console.warn(`  - ${key} (${desc})`);
    }
  }
}
