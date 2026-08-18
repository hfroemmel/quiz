import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Nur Node-Tests: Domain, Content-Pipeline, Persistenz und Server.
    // UI-Verhalten wird ueber Playwright (test/e2e) geprueft.
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
})
