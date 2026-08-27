import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

/**
 * End-to-End gegen den Pruefstand der Pakete.
 *
 * Es gibt hier keinen Server mehr: Das Quiz laeuft ueber eine
 * `LocalQuizRuntime` im Browser, und der Entwicklungsserver liefert nur die
 * Dateien und das gebaute Quizpaket aus. Der Buehnenbetrieb mit Server und
 * SQLite wird in `hfroemmel/quiz-live` geprueft.
 *
 * Die Vorschau ist bewusst nur im Entwicklungsmodus erreichbar (Spezifikation
 * 22.6); die Referenzbilder entstehen deshalb gegen den Entwicklungsserver.
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
   * EIN Projekt, und es heisst weiterhin `preview`: Playwright fuehrt den
   * Projektnamen im Dateinamen jedes Referenzbildes. Ein anderer Name hiesse,
   * saemtliche Baselines neu abzulegen - und damit genau den Waechter
   * auszutauschen, der die Extraktion der Oberflaeche absichert.
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
