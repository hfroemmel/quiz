/**
 * Zusammenbau der Anwendungsschicht: Inhalt, Persistenz und Befehlsverarbeitung.
 *
 * Diese Funktion kennt bewusst weder HTTP noch WebSocket. Sie ist der gemeinsame
 * Einstieg aller Kontexte:
 *   - der Buehnenbetrieb haengt in `@quiz/server` einen HTTP- und WebSocket-Adapter
 *     davor, damit Operator, Moderator und weitere Praesentationsclients im LAN
 *     denselben Zustand sehen;
 *   - Kiosk und Multigame-Einbettung starten dieselbe Laufzeit lokal.
 *
 * Reihenfolge beim Start (Spezifikation 23.3):
 *   1. Quizpaket laden
 *   2. Datenbank oeffnen und migrieren
 *   3. gespeicherte Hotfixes als Overlay anwenden
 *   4. Veranstaltungstag ermitteln und ein unvollstaendiges Spiel vorbereiten
 */
import { QuizStore } from '@quiz/persistence'
import { ContentService } from './contentService'
import { QuizService } from './quizService'

export interface QuizRuntimeOptions {
  /** Verzeichnis des gebauten Quizpakets. */
  packageDir: string
  /** SQLite-Datei. Sie wird angelegt, wenn sie fehlt. */
  databaseFile: string
  /** Zusaetzliche Wurzeln fuer die Medienaufloesung (Entwicklung). */
  mediaFallbackDirs?: string[]
  /** Session-Code fuer Clients im LAN. Ohne Netzbetrieb nicht noetig. */
  sessionCode?: string
  /** Injizierbar fuer Tests. */
  now?: () => number
  random?: () => number
}

export interface QuizRuntime {
  service: QuizService
  store: QuizStore
  content: ContentService
  /** Timer beenden und Datenbank schliessen. */
  close(): void
}

/**
 * Pfade kommen VOLLSTAENDIG vom Aufrufer. Frueher rieten Paket und Server die
 * Monorepo-Wurzel aus ihrer eigenen Dateilage - als installierte Pakete zeigte
 * das ins Leere. Umgebungsvariablen wertet der jeweilige Einstiegspunkt aus,
 * nicht diese Bibliothek.
 */
export function createQuizRuntime(options: QuizRuntimeOptions): QuizRuntime {
  const { packageDir, databaseFile } = options

  const store = new QuizStore(databaseFile)
  const content = new ContentService(packageDir, [], options.mediaFallbackDirs ?? [])
  // Bereits gespeicherte Live-Hotfixes sofort als Overlay anwenden.
  content.applyPatchOverlay(store.loadPatches())

  const service = new QuizService({
    store,
    content,
    ...(options.sessionCode === undefined ? {} : { sessionCode: options.sessionCode }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.random === undefined ? {} : { random: options.random }),
  })

  return {
    service,
    store,
    content,
    close() {
      service.stopTimers()
      store.close()
    },
  }
}
