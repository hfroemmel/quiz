/**
 * Gemeinsame Laufzeit-Schnittstelle aller Quiz-Kontexte.
 *
 * Ein `QuizRuntime` ist die EINZIGE Sicht einer Oberflaeche auf das Spiel:
 * Snapshot lesen, Aenderungen abonnieren, Befehle geben, aufraeumen. Ob dahinter
 * ein Server im LAN steht (`RemoteQuizRuntime`) oder dieselbe Engine im eigenen
 * Prozess (`LocalQuizRuntime`), sieht die Oberflaeche nicht.
 *
 * Der Envelope (commandId, actor, expectedRevision) ist Sache der Runtime -
 * Komponenten geben nackte Befehle.
 */
import type { Command } from './commands'

export interface QuizRuntimeRejection {
  reason: string
  message: string
  atMs: number
}

export interface QuizRuntimeConnection {
  connected: boolean
  /** Nur ein Kontext spielt Sounds ab; die Runtime traegt die Entscheidung. */
  audioMaster: boolean
}

export interface QuizSnapshot<TView> {
  /** Rollenspezifisches View-Modell, unveraendert projiziert. */
  view: TView | null
  revision: number
  /** Serverzeit im Moment dieses Snapshots. Fortlaufend: `serverNow()`. */
  serverTimeMs: number
  connection: QuizRuntimeConnection
  lastRejection: QuizRuntimeRejection | null
}

export interface QuizRuntime<TView = unknown> {
  getSnapshot(): QuizSnapshot<TView>
  subscribe(listener: (snapshot: QuizSnapshot<TView>) => void): () => void
  dispatch(command: Command): void | Promise<void>
  /** Fortlaufende Serverzeit fuer lokale Interpolationen (Enthuellungsuhr). */
  serverNow(): number
  /** Meldet, dass dieser Kontext hoerbar Ton ausgeben darf. */
  notifyAudioReady(): void
  clearRejection(): void
  /** Verbindung bzw. Timer beenden. Danach ist die Runtime nicht mehr benutzbar. */
  dispose(): void
}
