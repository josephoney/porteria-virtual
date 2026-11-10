import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://127.0.0.1:3003';
const PASS_WEB_URL = 'http://localhost:5177';

export default defineConfig({
  testDir: './tests/passes',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: PASS_WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @porteria/api dev',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        API_PORT: '3003',
        API_HOST: '127.0.0.1',
        DYNAMIC_QR_ENABLED: 'true',
        PASS_QR_SECRET: 'e2e-pass-secret',
        PASS_WEB_URL,
        OUTBOX_WORKER_ENABLED: 'false',
      },
    },
    {
      command: 'pnpm --filter @porteria/pass-web dev',
      url: PASS_WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        PASS_WEB_PORT: '5177',
        API_PROXY_TARGET: API_URL,
      },
    },
  ],
});
