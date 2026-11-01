import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    // Console output only for failing tests.
    silent: 'passed-only',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-tenderpulse-e2e-specs-001',
      INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY || 'tenderpulse-internal-secret-2026',
      ALLOW_MOCK_SERVICES: 'true',
      QUEUE_PROVIDER: 'mock',
      STORAGE_PROVIDER: 'mock',
      PGLITE_DATA_DIR: 'memory://',
    },
  },
});
