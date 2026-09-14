import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /*
     * Node tests only: the core, the content pipeline and the source checks
     * of the interface packages - for instance, that every colour value sits
     * in the palette. What the browser shows is checked by Playwright under
     * test/e2e.
     */
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
})
