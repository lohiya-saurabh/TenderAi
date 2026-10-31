import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the clause workspace (e2e/*.spec.ts). They start their own API (mock
 * queue and storage, fresh in-memory demo database) and the Vite dev server, and seed tenders
 * through the real extraction-completed webhook with the golden AI event.
 *
 *   npx playwright test
 *   E2E_API_PORT=3002 E2E_WEB_PORT=5175 npx playwright test   # when dev servers hold 3000/5173
 */
// Throwaway secrets for the test API, generated once per run (workers inherit the env).
process.env.E2E_JWT_SECRET ??= randomBytes(24).toString('hex');
process.env.E2E_INTERNAL_KEY ??= randomBytes(24).toString('hex');
const API_PORT = Number(process.env.E2E_API_PORT ?? 3000);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5173);

const API_ENV = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  JWT_SECRET: process.env.E2E_JWT_SECRET,
  INTERNAL_SERVICE_KEY: process.env.E2E_INTERNAL_KEY,
  ALLOW_MOCK_SERVICES: 'true',
  QUEUE_PROVIDER: 'mock',
  STORAGE_PROVIDER: 'mock',
  SEED_DEMO_DATA: 'true',
  LOG_LEVEL: 'warn',
  // Throwaway in-memory database per run; the dev and production API use DATABASE_URL.
  PGLITE_DATA_DIR: 'memory://',
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
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command:
        'npm run build -w @tenderpulse/shared-types && npm run build -w @tenderpulse/api && ' +
        'rm -rf .e2e/api && mkdir -p .e2e/api && cd .e2e/api && node ../../apps/api/dist/main.js',
      port: API_PORT,
      env: API_ENV,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -w @tenderpulse/web -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
