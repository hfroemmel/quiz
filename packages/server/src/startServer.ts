/**
 * Zusammenbau des lokalen Quizservers: die Laufzeit aus `@quiz/runtime` plus
 * HTTP-Auslieferung und WebSocket-Verteilung.
 *
 * Reihenfolge beim Start (Spezifikation 23.3):
 *   1. bis 4. uebernimmt `createQuizRuntime`: Quizpaket, Datenbank,
 *      Veranstaltungstag und ein unvollstaendiges Spiel
 *   5. Clients ausliefern und Verbindungen annehmen
 */
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { repositoryRoot } from '@quiz/content'
import type { QuizStore } from '@quiz/persistence'
import { createQuizRuntime, type QuizService } from '@quiz/runtime'
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
  const webDistDir = options.webDistDir ?? join(repositoryRoot, 'apps', 'web', 'dist')
  const sessionCode = options.sessionCode ?? createSessionCode()

  const runtime = createQuizRuntime({
    ...(options.packageDir === undefined ? {} : { packageDir: options.packageDir }),
    ...(options.databaseFile === undefined ? {} : { databaseFile: options.databaseFile }),
    sessionCode,
  })
  const { service, store, content } = runtime
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
      closeWebSockets()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
      runtime.close()
    },
  }
}
