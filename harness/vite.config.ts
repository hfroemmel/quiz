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
const here = dirname(fileURLToPath(import.meta.url))
const packageDir = join(here, '..', 'content', 'dist')

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
 * Two routes, no more needed: `/quiz-package/<file>` for manifest,
 * configuration and questions, `/media/<id>` for the media files. The
 * second one is defined by the core itself - so it must be named exactly
 * that.
 *
 * The file name ALWAYS comes from the manifest, never from the URL: this
 * way a request can never reach anything that isn't part of the quiz
 * package.
 */
function serveQuizPackage(): Plugin {
  const fileNames = new Map<string, string>()

  const readManifest = () => {
    const file = join(packageDir, 'manifest.json')
    if (!existsSync(file)) return
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as { assets: { id: string; filename: string }[] }
    fileNames.clear()
    for (const asset of manifest.assets) fileNames.set(asset.id, asset.filename)
  }

  const send = (response: import('node:http').ServerResponse, file: string) => {
    if (!existsSync(file)) {
      response.statusCode = 404
      response.end('Not found')
      return
    }
    response.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
    response.end(readFileSync(file))
  }

  return {
    name: 'serve-quiz-package',
    configureServer(server) {
      readManifest()
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0] ?? ''

        if (path.startsWith('/quiz-package/')) {
          const name = path.slice('/quiz-package/'.length)
          // Only the package's three files, no arbitrary paths.
          if (!['manifest.json', 'config.json', 'questions.json'].includes(name)) {
            response.statusCode = 404
            response.end('Not found')
            return
          }
          if (name === 'manifest.json') readManifest()
          send(response, join(packageDir, name))
          return
        }

        if (path.startsWith('/media/')) {
          const fileName = fileNames.get(decodeURIComponent(path.slice('/media/'.length)))
          if (!fileName) {
            response.statusCode = 404
            response.end('Unknown medium')
            return
          }
          send(response, join(packageDir, 'assets', fileName))
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveQuizPackage()],
  server: {
    port: 5180,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
})
