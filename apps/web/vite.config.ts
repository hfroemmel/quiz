import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Ein einziger Web-Build bedient alle Rollen. Die Rolle ergibt sich aus dem Pfad
 * (`/operator`, `/stage`, `/moderator`, `/preview`); ausgeliefert wird alles vom
 * lokalen Quizserver, damit der Betrieb ohne Internet funktioniert.
 */
// Port des lokalen Quizservers. Im Entwicklungsmodus leitet Vite dorthin weiter.
const serverPort = process.env['QUIZ_PORT'] ?? '4319'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/ws': { target: `ws://localhost:${serverPort}`, ws: true },
      '/media': `http://localhost:${serverPort}`,
      '/api': `http://localhost:${serverPort}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keine externen CDN-Abhaengigkeiten: der Offline-Betrieb ist Pflicht.
    assetsInlineLimit: 0,
  },
})
