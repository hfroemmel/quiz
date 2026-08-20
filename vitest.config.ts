import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /*
     * Nur Node-Tests: Domain, Content-Pipeline, Persistenz und Server.
     * UI-Verhalten wird ueber Playwright (test/e2e) geprueft.
     *
     * `apps/web/test` enthaelt deshalb kein Bauteil, sondern Quelltextpruefungen -
     * etwa, dass alle Farbwerte in der Palette stehen.
     */
    include: ['packages/*/test/**/*.test.ts', 'apps/web/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
})
