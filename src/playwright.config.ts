import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '.env.local') });
loadEnv({ path: resolve(__dirname, '.env') });
loadEnv({ path: resolve(__dirname, '..', '.env.local') });

/** Dedicated port avoids clashing with a dev server already on 3000. */
const e2ePort = process.env.E2E_PORT || '3333';
const defaultBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Limit parallel UI hits against a single `next dev` instance (cold compile + HMR).
  workers: 1,
  timeout: 180_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || defaultBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Use `next dev` directly so `-p` is not swallowed by npm on Windows.
        command: `npx next dev -p ${e2ePort}`,
        url: defaultBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: {
          ...process.env,
          RELAX_ENV_VALIDATION: '1',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
