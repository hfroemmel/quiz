/**
 * Netzwerk- und Zugriffsregeln des lokalen Servers (Spezifikation 30).
 *
 * Grundhaltung: Der Ein-Laptop-Betrieb braucht keine Anmeldung. Sobald Steuerclients
 * im LAN zugelassen werden, gilt:
 *  - Operatorbefehle nur vom lokalen Rechner (Loopback);
 *  - Moderatorzugriff nur mit dem beim Start angezeigten Session-Code;
 *  - Buehnenclients bekommen ausschliesslich oeffentliche Daten und duerfen keine
 *    Steuerbefehle senden.
 */
import { networkInterfaces } from 'node:os'
import { randomInt } from 'node:crypto'
import type { ClientRole } from '@hfroemmel/quiz-core'

/** Sechsstelliger Code, der beim Start im Operatorfenster angezeigt wird. */
export function createSessionCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

export function isLoopback(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false
  const address = remoteAddress.replace(/^::ffff:/, '')
  return address === '127.0.0.1' || address === '::1' || address === 'localhost'
}

/** URLs, unter denen Moderator und weitere Praesentationsclients den Server erreichen. */
export function localNetworkUrls(port: number): string[] {
  const urls: string[] = []
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue
      urls.push(`http://${address.address}:${port}`)
    }
  }
  return urls
}

export interface AccessDecision {
  allowed: boolean
  message?: string
}

export function checkAccess(input: {
  role: ClientRole
  code: string | null
  sessionCode: string
  remoteAddress: string | undefined
}): AccessDecision {
  const local = isLoopback(input.remoteAddress)

  if (input.role === 'operator') {
    // Der Operator besitzt die vollstaendige technische Kontrolle und arbeitet
    // ausschliesslich am Laptop. Ein Fernzugriff ist bewusst nicht vorgesehen.
    return local
      ? { allowed: true }
      : { allowed: false, message: 'Die Operatoransicht ist nur auf dem Veranstaltungslaptop verfügbar.' }
  }

  if (input.role === 'player') {
    // Die Spielersicht gehoert zum Geraet, auf dem gespielt wird. Ueber das Netz
    // waere sie ein zweiter, unbeaufsichtigter Zugang zum laufenden Spiel.
    return local
      ? { allowed: true }
      : { allowed: false, message: 'Die Spieleransicht ist nur auf dem Gerät selbst verfügbar.' }
  }

  if (input.role === 'moderator') {
    return input.code === input.sessionCode
      ? { allowed: true }
      : { allowed: false, message: 'Falscher oder fehlender Session-Code.' }
  }

  // Buehnenclients spiegeln nur oeffentliche Informationen.
  return { allowed: true }
}
