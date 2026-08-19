import { defineConfig } from '@playwright/test'

/**
 * Interface tests drive the built application, so `npm run build` must have run first.
 * They are kept out of the Vitest suite because they start a real Electron process.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    video: 'off'
  }
})
