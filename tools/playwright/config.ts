import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import path from 'node:path';

const REPO_ROOT = process.env['PWD'] || `${__dirname}/../../..`;

const SERVER_START_SCRIPT = process.env.INTEGRATION_SERVER_START_SCRIPT;
if (!SERVER_START_SCRIPT) {
  throw new Error('missing required env var: INTEGRATION_SERVER_START_SCRIPT');
}

const PORT = process.env['PORT'];
if (!PORT) {
  throw new Error('missing required env var: PORT');
}

const VIEWPORT_HEIGHT = process.env['VIEWPORT_HEIGHT'];
if (!VIEWPORT_HEIGHT) {
  throw new Error('missing required env var: VIEWPORT_HEIGHT');
}

const VIEWPORT_WIDTH = process.env['VIEWPORT_WIDTH'];
if (!VIEWPORT_WIDTH) {
  throw new Error('missing required env var: VIEWPORT_WIDTH');
}

const BASE_URL = `http://localhost:${PORT}`;

const OUTPUT_DIR_RELATIVE =
  process.env['TEST_UNDECLARED_OUTPUTS_DIR'] || './test-results';
const outputDir = path.join(REPO_ROOT, OUTPUT_DIR_RELATIVE);

dotenvExpand.expand(
  dotenv.config({
    path: path.join(
      REPO_ROOT,
      process.env.DOTENV_EXECUTION_ROOT || '.',
      '.env'
    ),
  })
);
dotenvExpand.expand(dotenv.config({ path: path.join(REPO_ROOT, '.env') }));

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: path.join(
    REPO_ROOT,
    process.env.INTEGRATION_PACKAGE_PATH || '.',
    process.env.INTEGRATION_TEST_DIR || '.'
  ),
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,

  outputDir,
  /* All test suites use shared server, so they cannot run in parallel */
  workers: 1,
  /* Opt out of parallel tests due to shared global state like Java card mocking. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env['CI'],
  /* Retry on CI only */
  retries: process.env['CI'] ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      'junit',
      {
        outputFile:
          process.env['XML_OUTPUT_FILE'] || path.join(outputDir, 'results.xml'),
      },
    ],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        viewport: {
          height: Number.parseInt(VIEWPORT_HEIGHT, 10),
          width: Number.parseInt(VIEWPORT_WIDTH, 10),
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: SERVER_START_SCRIPT,
    reuseExistingServer: !process.env['CI'],
    stderr: 'pipe',
    stdout: 'pipe',
    url: BASE_URL,
  },
});
