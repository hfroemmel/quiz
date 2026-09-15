import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

/**
 * End-to-end tests against the test rig of the packages.
 *
 * There is no longer a server here: the quiz runs via a `LocalQuizRuntime` in
 * the browser, and the development server only serves the files and the
 * built quiz package. Stage operation with a server and SQLite is checked in
 * `hfroemmel/quiz-live`.
 *
 * The preview is deliberately only reachable in development mode
 * (specification 22.6); the reference images are therefore generated against
 * the development server.
 */
const containerChromium = '/opt/pw-browsers/chromium'
const chromiumPath = process.env['CHROMIUM_PATH'] ?? (existsSync(containerChromium) ? containerChromium : undefined)
const PORT = 5180

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  /*
   * ONE project, and it is still called `preview`: Playwright carries the
   * project name in the file name of every reference image. A different name
   * would mean re-recording every single baseline - and thereby replacing
   * exactly the guard that protects against regressions in the interface
   * extraction.
   */
  projects: [{ name: 'preview' }],
  webServer: {
    command: `pnpm --filter @quiz/harness dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/preview`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
