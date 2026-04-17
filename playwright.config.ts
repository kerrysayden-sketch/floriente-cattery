import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests run against `astro preview` (the built `dist/` served locally).
 * One browser (chromium headless) is enough for smoke — no cross-browser matrix.
 *
 * Run:
 *   npm run build && npm run test:smoke
 *
 * CI-equivalent:
 *   CI=1 npm run test:smoke   // failFast, retries
 */
export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
