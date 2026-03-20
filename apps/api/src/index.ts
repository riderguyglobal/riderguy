import { createServer } from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from '@riderguy/database';
import { initSocketServer } from './socket';
import { startWorkers, stopWorkers } from './jobs/workers';
import { startPresenceManager, stopPresenceManager } from './services/presence.service';
import { recoverStuckDispatches } from './services/auto-dispatch.service';
import { expireStaleUnpaidOrders, escalateStaleDeliveries, cleanupOldBreadcrumbs } from './services/order.service';
import { closeRedis } from './lib/redis';

// ============================================================
// Server bootstrap
// ============================================================

const httpServer = createServer(app);

// Initialise Socket.IO on the same HTTP server
initSocketServer(httpServer);

// Start BullMQ workers (payouts, receipts, commissions)
startWorkers();

// Start rider presence manager (heartbeat tracking, stale-rider cleanup)
startPresenceManager();

let staleOrderTimer: ReturnType<typeof setInterval> | undefined;
let slaTimer: ReturnType<typeof setInterval> | undefined;
let breadcrumbCleanupTimer: ReturnType<typeof setInterval> | undefined;

const server = httpServer.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    `RiderGuy API server running on http://localhost:${config.port}`
  );

  // Recover any orders stuck in SEARCHING_RIDER from previous crash/restart
  recoverStuckDispatches().catch((err) => {
    logger.error({ err }, 'Failed to recover stuck dispatches on startup');
  });

  // Expire stale unpaid orders on startup and every 5 minutes
  expireStaleUnpaidOrders()
    .then((n) => n > 0 && logger.info({ count: n }, 'Expired stale unpaid orders on startup'))
    .catch((err) => logger.error({ err }, 'Failed to expire stale orders on startup'));
  staleOrderTimer = setInterval(() => {
    expireStaleUnpaidOrders()
      .then((n) => n > 0 && logger.info({ count: n }, 'Expired stale unpaid orders'))
      .catch((err) => logger.error({ err }, 'Stale order cleanup failed'));
  }, 5 * 60 * 1000);

  // D-03: Check for stale deliveries every 10 minutes
  escalateStaleDeliveries()
    .then((n) => n > 0 && logger.warn({ count: n }, 'Flagged stale deliveries on startup'))
    .catch((err) => logger.error({ err }, 'Stale delivery check failed on startup'));
  slaTimer = setInterval(() => {
    escalateStaleDeliveries()
      .then((n) => n > 0 && logger.warn({ count: n }, 'Flagged stale deliveries'))
      .catch((err) => logger.error({ err }, 'Stale delivery SLA check failed'));
  }, 10 * 60 * 1000);

  // D-04: Clean up old location breadcrumbs once per day
  cleanupOldBreadcrumbs().catch((err) => logger.error({ err }, 'Breadcrumb cleanup failed on startup'));
  breadcrumbCleanupTimer = setInterval(() => {
    cleanupOldBreadcrumbs().catch((err) => logger.error({ err }, 'Breadcrumb cleanup failed'));
  }, 24 * 60 * 60 * 1000);
});

// ---------- Graceful shutdown ----------

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, () => {
    logger.info({ signal }, 'Received shutdown signal');
    server.close(async () => {
      logger.info('HTTP server closed');
      if (staleOrderTimer) clearInterval(staleOrderTimer);
      if (slaTimer) clearInterval(slaTimer);
      if (breadcrumbCleanupTimer) clearInterval(breadcrumbCleanupTimer);
      await stopPresenceManager();
      logger.info('Presence manager stopped');
      await stopWorkers();
      logger.info('BullMQ workers stopped');
      await closeRedis();
      logger.info('Redis connections closed');
      await prisma.$disconnect();
      logger.info('Database connections closed');
      process.exit(0);
    });

    // Force-close after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  });
}

// ---------- Unhandled errors ----------

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
