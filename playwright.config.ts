import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.EDV_PORT ?? 3000);
const BASE_URL = process.env.EDV_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.EDV_E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run start',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          EDV_PORT: String(PORT),
        },
      },
});
