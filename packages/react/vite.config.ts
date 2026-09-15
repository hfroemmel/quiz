/**
 * Library build of the React stage (Vite lib mode).
 *
 * DELIBERATELY THE SAME PIPELINE as the application: CSS modules, asset
 * emission and `new URL(...)` resolution behave exactly the same in the
 * package as in the monorepo - the lowest risk for the screenshot baselines.
 * `cssCodeSplit: false` yields exactly ONE styles.css per package.
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
