/**
 * Bibliotheksbau der React-Buehne (Vite lib mode).
 *
 * BEWUSST DIESELBE PIPELINE wie die Anwendung: CSS-Module, Asset-Emission und
 * `new URL(...)`-Aufloesung verhalten sich im Paket exakt wie im Monorepo -
 * das geringste Risiko fuer die Screenshot-Baselines. `cssCodeSplit: false`
 * ergibt genau EIN styles.css je Paket.
 */
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  plugins: [dts({ tsconfigPath: './tsconfig.json', rollupTypes: true })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'quiz-react' },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, '@hfroemmel/quiz-core', '@hfroemmel/quiz-themes'],
    },
  },
})
