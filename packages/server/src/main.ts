/**
 * Einstiegspunkt des lokalen Quizservers (`pnpm server`).
 *
 * Der Server laeuft vollstaendig offline. Internet oder WLAN sind nicht erforderlich;
 * LAN-Clients sind eine optionale Ergaenzung.
 */
import { join } from 'node:path'
import { startServer } from './startServer'

/*
 * Der Entwicklungs-Einstieg wird aus der Repository-Wurzel aufgerufen
 * (`pnpm server`, `pnpm dev`, Playwright). Pfade folgen deshalb dem
 * Arbeitsverzeichnis; Umgebungsvariablen gewinnen, damit Testlaeufe eine
 * frische Datenbank unterschieben koennen.
 */
const wurzel = process.cwd()
const running = await startServer({
  packageDir: process.env['QUIZ_PACKAGE_DIR'] ?? join(wurzel, 'content', 'dist'),
  databaseFile: process.env['QUIZ_DB'] ?? join(wurzel, 'runtime', 'quiz.sqlite'),
  webDistDir: process.env['QUIZ_WEB_DIST'] ?? join(wurzel, 'apps', 'web', 'dist'),
  mediaFallbackDirs: [join(wurzel, 'content', 'source')],
})

console.log('')
console.log('  Live-Quiz - lokaler Server läuft')
console.log(`  Quizpaket:        ${running.service.content.contentVersion}`)
console.log(`  Veranstaltungstag: ${running.service.eventDayId}`)
console.log('')
console.log(`  Operator:    http://localhost:${running.port}/operator   (nur auf diesem Rechner)`)
console.log(`  Bühne:      http://localhost:${running.port}/stage`)
console.log(`  Vorschau:    http://localhost:${running.port}/preview    (nur Entwicklung)`)
console.log('')
console.log(`  Session-Code für den Moderator: ${running.sessionCode}`)
for (const url of running.lanUrls) {
  console.log(`  Moderator im LAN: ${url}/moderator`)
}
if (running.lanUrls.length === 0) {
  console.log('  (Kein LAN gefunden - der Ein-Laptop-Betrieb funktioniert unverändert.)')
}
console.log('')

const shutdown = async (signal: string) => {
  console.log(`\n${signal} empfangen, Server wird beendet.`)
  await running.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
