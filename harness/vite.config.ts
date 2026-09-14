import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The packages' harness - scene preview, touch device and example collection.
 *
 * It is never shipped. What ships are the five libraries; the applications
 * live in their own repositories.
 */
const hier = dirname(fileURLToPath(import.meta.url))
const paketVerzeichnis = join(hier, '..', 'content', 'dist')

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

/**
 * Serves the built quiz package - the job the quiz server has during a
 * live stage show.
 *
 * Two routes, no more needed: `/quizpaket/<file>` for manifest,
 * configuration and questions, `/media/<id>` for the media files. The
 * second one is defined by the core itself - so it must be named exactly
 * that.
 *
 * The file name ALWAYS comes from the manifest, never from the URL: this
 * way a request can never reach anything that isn't part of the quiz
 * package.
 */
function quizpaketAusliefern(): Plugin {
  const dateinamen = new Map<string, string>()

  const manifestLesen = () => {
    const datei = join(paketVerzeichnis, 'manifest.json')
    if (!existsSync(datei)) return
    const manifest = JSON.parse(readFileSync(datei, 'utf8')) as { assets: { id: string; filename: string }[] }
    dateinamen.clear()
    for (const asset of manifest.assets) dateinamen.set(asset.id, asset.filename)
  }

  const senden = (antwort: import('node:http').ServerResponse, datei: string) => {
    if (!existsSync(datei)) {
      antwort.statusCode = 404
      antwort.end('Nicht gefunden')
      return
    }
    antwort.setHeader('Content-Type', MIME[extname(datei).toLowerCase()] ?? 'application/octet-stream')
    antwort.end(readFileSync(datei))
  }

  return {
    name: 'quizpaket-ausliefern',
    configureServer(server) {
      manifestLesen()
      server.middlewares.use((anfrage, antwort, weiter) => {
        const pfad = (anfrage.url ?? '').split('?')[0] ?? ''

        if (pfad.startsWith('/quizpaket/')) {
          const name = pfad.slice('/quizpaket/'.length)
          // Only the package's three files, no arbitrary paths.
          if (!['manifest.json', 'config.json', 'questions.json'].includes(name)) {
            antwort.statusCode = 404
            antwort.end('Nicht gefunden')
            return
          }
          if (name === 'manifest.json') manifestLesen()
          senden(antwort, join(paketVerzeichnis, name))
          return
        }

        if (pfad.startsWith('/media/')) {
          const dateiname = dateinamen.get(decodeURIComponent(pfad.slice('/media/'.length)))
          if (!dateiname) {
            antwort.statusCode = 404
            antwort.end('Unbekanntes Medium')
            return
          }
          senden(antwort, join(paketVerzeichnis, 'assets', dateiname))
          return
        }

        weiter()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), quizpaketAusliefern()],
  server: {
    port: 5180,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
})
