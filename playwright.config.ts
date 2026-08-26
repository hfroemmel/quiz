import { defineConfig, devices } from '@playwright/test'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * End-to-End-Tests gegen den echten lokalen Server mit dem echten Quizpaket.
 *
 * Jeder Lauf bekommt eine frische SQLite-Datei, damit die Wiederholungshistorie
 * vorheriger Laeufe die Fragenauswahl nicht beeinflusst.
 */
const databaseFile = join(mkdtempSync(join(tmpdir(), 'quiz-e2e-')), 'quiz.sqlite')

/*
 * Chromium der Umgebung: explizit per CHROMIUM_PATH, sonst der vorinstallierte
 * Browser der Entwicklungsumgebung, sonst der Playwright-eigene. So laeuft
 * dieselbe Konfiguration lokal und im CI-Container, ohne dass eine Umgebung
 * den Pfad der anderen kennen muss.
 */
const containerChromium = '/opt/pw-browsers/chromium'
const chromiumPath = process.env['CHROMIUM_PATH'] ?? (existsSync(containerChromium) ? containerChromium : undefined)
const PORT = 4321
const DEV_PORT = 5180

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    {
      name: 'live',
      testMatch: /(game-flows|live-presentation|touch-play)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORT}` },
    },
    {
      /**
       * Die Entwicklungsvorschau ist bewusst nur im Entwicklungsmodus erreichbar
       * (Spezifikation 22.6). Szenen- und Animationstests laufen deshalb gegen den
       * Vite-Entwicklungsserver, nicht gegen den Produktionsbuild.
       *
       * Dasselbe gilt fuer die Beispielsammlung unter `/shell`: Sie ist der
       * Pruefstand des Einbettungsvertrags und kein Teil der Auslieferung. Ihre
       * Befehle gehen ueber den Proxy an denselben Testserver.
       */
      name: 'preview',
      testMatch: /[/\\](presentation|kids-quiz|embedding)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @quiz/web build && npx tsx packages/server/src/main.ts',
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        QUIZ_PORT: String(PORT),
        QUIZ_DB: databaseFile,
        QUIZ_HOST: '127.0.0.1',
      },
    },
    {
      command: `pnpm --filter @quiz/web dev -- --port ${DEV_PORT} --strictPort`,
      // Die Vorschau braucht keinen Server; der Proxy zeigt trotzdem auf den Testserver.
      env: { QUIZ_PORT: String(PORT) },
      url: `http://localhost:${DEV_PORT}/preview`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
