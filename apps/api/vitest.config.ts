import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    alias: {
      '@riderguy/database': path.resolve(__dirname, 'src/__mocks__/database.ts'),
      '@riderguy/utils': path.resolve(__dirname, '../../packages/utils/src/index.ts'),
      '../lib/logger': path.resolve(__dirname, 'src/__mocks__/logger.ts'),
      './dispatch.service': path.resolve(__dirname, 'src/__mocks__/dispatch.service.ts'),
      '../socket': path.resolve(__dirname, 'src/__mocks__/socket.ts'),
      './sms.service': path.resolve(__dirname, 'src/__mocks__/sms.service.ts'),
    },
  },
});
