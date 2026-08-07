import { defineConfig, devices } from '@playwright/test';

/**
 * The app opens straight from disk (file://), so no webServer is needed.
 * Tests cover the browser UI; the node unit tests live next to these specs
 * but play under `node --test` only (see `testMatch` below).
 */
export default defineConfig({
  testDir: './tests',
  /* Only our spec files - the node `*.test.js` unit tests stay outside Playwright. */
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});