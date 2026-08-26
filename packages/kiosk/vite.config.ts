/**
 * Bibliotheksbau des spielbaren Quiz (Vite lib mode) - siehe quiz-react.
 */
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  plugins: [dts({ tsconfigPath: './tsconfig.json', rollupTypes: true })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'quiz-kiosk' },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        '@hfroemmel/quiz-core',
        '@hfroemmel/quiz-react',
        '@hfroemmel/quiz-themes',
      ],
    },
  },
})
