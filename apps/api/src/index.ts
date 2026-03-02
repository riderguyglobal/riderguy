import { createServer } from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from '@riderguy/database';
import { initSocketServer } from './socket';
import { startWorkers, stopWorkers } from './jobs/workers';
import { startPresenceManager, stopPresenceManager } from './services/presence.service';

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

const server = httpServer.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    `RiderGuy API server running on http://localhost:${config.port}`
  );
});

// ---------- Graceful shutdown ----------

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, () => {
    logger.info({ signal }, 'Received shutdown signal');
    server.close(async () => {
      logger.info('HTTP server closed');
      await stopPresenceManager();
      logger.info('Presence manager stopped');
      await stopWorkers();
      logger.info('BullMQ workers stopped');
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
