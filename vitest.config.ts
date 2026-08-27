import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /*
     * Nur Node-Tests: Kern, Inhalts-Pipeline und die Quelltextpruefungen der
     * Oberflaechenpakete - etwa, dass alle Farbwerte in der Palette stehen.
     * Was der Browser zeigt, prueft Playwright unter test/e2e.
     */
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
})
