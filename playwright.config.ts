import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ override: false, path: '.env.test' });
const MINUTES = 10;

export default defineConfig({
  timeout: MINUTES * 60 * 1000,
  testDir: './tests',
  expect: {
    timeout: 5000
  },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  //workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    /*
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    }
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Microsoft Edge',
      use: { channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { channel: 'chrome' },
    },
    */
  ],
  /*outputDir: 'test-results/'*/
  webServer: {
    command: 'pnpm dev clean',
    port: 8000,
  },
  globalSetup: './tests/global-setup.ts',
  use: {
    storageState: './tests/storageState.json',
  },
});
