/**
 * Zusammenbau des lokalen Quizservers.
 *
 * Reihenfolge beim Start (Spezifikation 23.3):
 *   1. aktive Quizpaketversion pruefen und laden
 *   2. Datenbank oeffnen und migrieren
 *   3. letzten aktiven Veranstaltungstag ermitteln
 *   4. unvollstaendiges Spiel erkennen und vorbereiten
 *   5. Clients ausliefern und Verbindungen annehmen
 */
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { contentPackageDir, repositoryRoot, runtimeDir } from '@quiz/content'
import { QuizStore } from '@quiz/persistence'
import { ContentService } from './contentService.ts'
import { QuizService } from './quizService.ts'
import { createRequestHandler } from './httpServer.ts'
import { attachWebSocketServer } from './wsServer.ts'
import { createSessionCode, localNetworkUrls } from './network.ts'

export interface StartOptions {
  port?: number
  /** `0.0.0.0` macht Moderator und weitere Praesentationsclients im LAN erreichbar. */
  host?: string
  packageDir?: string
  databaseFile?: string
  webDistDir?: string
  sessionCode?: string
}

export interface RunningServer {
  server: Server
  service: QuizService
  store: QuizStore
  port: number
  sessionCode: string
  lanUrls: string[]
  close(): Promise<void>
}

export async function startServer(options: StartOptions = {}): Promise<RunningServer> {
  const port = options.port ?? Number(process.env['QUIZ_PORT'] ?? 4319)
  const host = options.host ?? process.env['QUIZ_HOST'] ?? '0.0.0.0'
  const packageDir = options.packageDir ?? process.env['QUIZ_PACKAGE_DIR'] ?? contentPackageDir
  const databaseFile = options.databaseFile ?? process.env['QUIZ_DB'] ?? join(runtimeDir, 'quiz.sqlite')
  const webDistDir = options.webDistDir ?? join(repositoryRoot, 'apps', 'web', 'dist')
  const sessionCode = options.sessionCode ?? createSessionCode()

  const store = new QuizStore(databaseFile)
  const content = new ContentService(packageDir, [])
  // Bereits gespeicherte Live-Hotfixes sofort als Overlay anwenden.
  content.applyPatchOverlay(store.loadPatches())

  const service = new QuizService({ store, content, sessionCode })
  store.appendAudit({
    atMs: Date.now(),
    actorRole: 'system',
    category: 'system',
    message: `Server gestartet. Quizpaket ${content.contentVersion}, Veranstaltungstag ${service.eventDayId}.`,
  })

  const httpServer = createServer(createRequestHandler({ service, webDistDir, sessionCode, port }))
  const closeWebSockets = attachWebSocketServer(httpServer, service, sessionCode)

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject)
      resolve()
    })
  })

  const actualPort = (httpServer.address() as { port: number }).port
  const lanUrls = localNetworkUrls(actualPort)
  service.setLanUrls(lanUrls)

  return {
    server: httpServer,
    service,
    store,
    port: actualPort,
    sessionCode,
    lanUrls,
    async close() {
      service.stopTimers()
      closeWebSockets()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
      store.close()
    },
  }
}
