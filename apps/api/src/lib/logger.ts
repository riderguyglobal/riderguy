import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  redact: config.isProduction
    ? {
        paths: ['phone', 'email', 'to', '*.phone', '*.email', '*.to'],
        censor: '[REDACTED]',
      }
    : undefined,
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});
