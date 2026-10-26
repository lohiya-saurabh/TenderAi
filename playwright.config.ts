import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the clause workspace (e2e/*.spec.ts). They start their own API (mock
 * queue and storage, fresh demo database in .e2e/) and the Vite dev server, and seed tenders
 * through the real extraction-completed webhook with the golden AI event.
 *
 *   npx playwright test
 */
// Throwaway secrets for the test API, generated once per run (workers inherit the env).
process.env.E2E_JWT_SECRET ??= randomBytes(24).toString('hex');
process.env.E2E_INTERNAL_KEY ??= randomBytes(24).toString('hex');

const API_ENV = {
  NODE_ENV: 'development',
  PORT: '3000',
  JWT_SECRET: process.env.E2E_JWT_SECRET,
  INTERNAL_SERVICE_KEY: process.env.E2E_INTERNAL_KEY,
  ALLOW_MOCK_SERVICES: 'true',
  QUEUE_PROVIDER: 'mock',
  STORAGE_PROVIDER: 'mock',
  SEED_DEMO_DATA: 'true',
  LOG_LEVEL: 'warn',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '.e2e/report' }]],
  outputDir: '.e2e/results',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command:
        'npm run build -w @tenderpulse/shared-types && npm run build -w @tenderpulse/api && ' +
        'rm -rf .e2e/api && mkdir -p .e2e/api && cd .e2e/api && node ../../apps/api/dist/main.js',
      port: 3000,
      env: API_ENV,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -w @tenderpulse/web -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
