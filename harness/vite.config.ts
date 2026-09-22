import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
 * configuration and questions, `/media/<name>` for the media files. The
 * second one is defined by the core itself - so it must be named exactly
 * that.
 *
 * AND IT ANSWERS TO BOTH NAMES A MEDIUM HAS. The core used to build that route
 * from the asset's id and builds it from its FILE NAME now, because a
 * question carries its file rather than an id (`mediaUrl`). A route that only
 * knew ids answered 404 to every branding image - the motif of the start menu
 * was simply missing in the preview, and a layout built around it could not be
 * looked at.
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
    for (const asset of manifest.assets) {
      fileNames.set(asset.id, asset.filename)
      fileNames.set(asset.filename, asset.filename)
    }
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

/**
 * The routes the harness answers under - the switch in `main.tsx`.
 *
 * They are real paths, not fragments, so a static host has to be told that
 * they all mean the one document. Anything not listed here stays a 404, which
 * is what a mistyped link should be.
 */
const ROUTES = ['/play', '/shell', '/pair']

/**
 * Packs the built quiz into a folder that needs no server.
 *
 * The development server serves the quiz package out of `content/dist`
 * through a middleware - a static host has no middleware, so the same files
 * have to lie IN the build:
 *
 *   /quiz-package/*.json   manifest, configuration, questions
 *   /media/<filename>      the media files, under their own names - the
 *                          route the core itself builds (`mediaUrl`), and one
 *                          a host can answer without looking anything up
 *   /_redirects            the routes above, for Cloudflare Pages
 */
function bundleQuizPackage(): Plugin {
  let outDir = 'dist'

  return {
    name: 'bundle-quiz-package',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const target = join(here, outDir)

      /*
       * A build without a quiz package would deploy quietly and then show
       * the customer a loading error. Better it fails here.
       */
      if (!existsSync(join(packageDir, 'manifest.json'))) {
        throw new Error('Kein Quizpaket in content/dist - erst "pnpm content:build:dev" laufen lassen.')
      }

      mkdirSync(join(target, 'quiz-package'), { recursive: true })
      for (const name of ['manifest.json', 'config.json', 'questions.json']) {
        cpSync(join(packageDir, name), join(target, 'quiz-package', name))
      }

      const assets = join(packageDir, 'assets')
      if (existsSync(assets)) cpSync(assets, join(target, 'media'), { recursive: true })

      const redirects = ROUTES.map((route) => `${route}  /index.html  200`).join('\n')
      writeFileSync(join(target, '_redirects'), `${redirects}\n`, 'utf8')
    },
  }
}

export default defineConfig({
  plugins: [react(), serveQuizPackage(), bundleQuizPackage()],
  server: {
    port: 5180,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
})
