/**
 * Einstiegspunkt des lokalen Quizservers (`pnpm server`).
 *
 * Der Server laeuft vollstaendig offline. Internet oder WLAN sind nicht erforderlich;
 * LAN-Clients sind eine optionale Ergaenzung.
 */
import { startServer } from './startServer.ts'

const running = await startServer()

console.log('')
console.log('  Live-Quiz - lokaler Server laeuft')
console.log(`  Quizpaket:        ${running.service.content.contentVersion}`)
console.log(`  Veranstaltungstag: ${running.service.eventDayId}`)
console.log('')
console.log(`  Operator:    http://localhost:${running.port}/operator   (nur auf diesem Rechner)`)
console.log(`  Buehne:      http://localhost:${running.port}/stage`)
console.log(`  Vorschau:    http://localhost:${running.port}/preview    (nur Entwicklung)`)
console.log('')
console.log(`  Session-Code fuer den Moderator: ${running.sessionCode}`)
for (const url of running.lanUrls) {
  console.log(`  Moderator im LAN: ${url}/moderator`)
}
if (running.lanUrls.length === 0) {
  console.log('  (Kein LAN gefunden - der Ein-Laptop-Betrieb funktioniert unveraendert.)')
}
console.log('')

const shutdown = async (signal: string) => {
  console.log(`\n${signal} empfangen, Server wird beendet.`)
  await running.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
