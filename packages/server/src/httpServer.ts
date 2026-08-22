/**
 * HTTP-Auslieferung: Clients, Medien und wenige Diagnose-Endpunkte.
 *
 * SICHERHEIT: Dateipfade aus den Quizdaten werden niemals direkt aufgeloest. Ein
 * Medium wird ueber seine Asset-ID angefragt; der Server schlaegt den Dateinamen im
 * Paketmanifest nach und prueft anschliessend, dass der aufgeloeste Pfad innerhalb
 * des Asset-Verzeichnisses liegt.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolveAssetPath } from '@quiz/content'
import type { QuizService } from '@quiz/runtime'
import { placeholderSvg } from './placeholderMedia.ts'
import { isLoopback } from './network.ts'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

/** Routen der Single-Page-Anwendung. Alles andere wird als Datei gesucht. */
const SPA_ROUTES = new Set(['/', '/operator', '/stage', '/moderator', '/preview', '/play', '/shell'])

export interface HttpOptions {
  service: QuizService
  /** Verzeichnis mit dem gebauten Web-Client. */
  webDistDir: string
  sessionCode: string
  port: number
}

export function createRequestHandler(options: HttpOptions) {
  return function handle(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)

    try {
      if (pathname === '/api/health') {
        return sendJson(response, 200, {
          ok: true,
          contentVersion: options.service.content.contentVersion,
          eventDayId: options.service.eventDayId,
          revision: options.service.currentRevision,
        })
      }

      // Der Session-Code wird nur lokal ausgegeben - er ist der Schluessel fuer den
      // Moderatorzugriff im LAN.
      if (pathname === '/api/session') {
        if (!isLoopback(request.socket.remoteAddress)) return sendJson(response, 403, { error: 'Nur lokal verfuegbar.' })
        return sendJson(response, 200, { sessionCode: options.sessionCode, port: options.port })
      }

      // Aenderungsbericht der Live-Hotfixes zum Export nach der Veranstaltung.
      if (pathname === '/api/export/changes') {
        if (!isLoopback(request.socket.remoteAddress)) return sendJson(response, 403, { error: 'Nur lokal verfuegbar.' })
        return sendJson(response, 200, {
          contentVersion: options.service.content.contentVersion,
          entries: options.service.changeReport(),
        })
      }

      if (pathname.startsWith('/media/')) {
        return serveMedia(options.service, pathname.slice('/media/'.length), response)
      }

      if (SPA_ROUTES.has(pathname)) {
        return serveFile(join(options.webDistDir, 'index.html'), response, options)
      }

      // Statische Dateien des Web-Clients. `..` ist durch die Pruefung unten ausgeschlossen.
      const candidate = join(options.webDistDir, pathname)
      if (!candidate.startsWith(options.webDistDir)) return sendText(response, 403, 'Verboten')
      if (existsSync(candidate) && statSync(candidate).isFile()) return serveFile(candidate, response, options)

      return sendText(response, 404, 'Nicht gefunden')
    } catch (error) {
      // Technische Details landen im Log, nicht ungefiltert beim Client.
      options.service.addWarning(`HTTP-Fehler bei ${pathname}: ${(error as Error).message}`)
      return sendText(response, 500, 'Interner Fehler. Details stehen im Operatorprotokoll.')
    }
  }
}

function serveMedia(service: QuizService, assetId: string, response: ServerResponse): void {
  const filename = service.content.assetFilename(assetId)
  if (!filename) return sendText(response, 404, 'Medium unbekannt')

  const path = resolveAssetPath(service.content.rootDir, filename)
  if (!path || !existsSync(path)) {
    // Die Warnung bleibt: Der Operator muss wissen, dass hier kein echtes Bild
    // haengt. Statt eines kaputten Bildsymbols kommt ein lesbares Ersatzbild,
    // damit sich die Frage trotzdem spielen laesst.
    service.addWarning(`Mediendatei fehlt: ${filename} (Asset ${assetId}). Es wird ein Ersatzbild gezeigt.`)
    const svg = placeholderSvg(filename)
    response.writeHead(200, {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-length': Buffer.byteLength(svg),
      'cache-control': 'no-store',
    })
    return void response.end(svg)
  }

  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': statSync(path).size,
    'cache-control': 'public, max-age=3600',
  })
  createReadStream(path).pipe(response)
}

function serveFile(path: string, response: ServerResponse, options: HttpOptions): void {
  if (!existsSync(path)) {
    return sendText(
      response,
      503,
      'Der Web-Client ist noch nicht gebaut.\n\nBitte "pnpm --filter @quiz/web build" ausfuehren oder im Entwicklungsmodus "pnpm dev" verwenden.',
    )
  }
  void options
  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=3600',
  })
  createReadStream(path).pipe(response)
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) })
  response.end(payload)
}

function sendText(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  response.end(body)
}
