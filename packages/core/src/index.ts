/**
 * @hfroemmel/quiz-core - der gemeinsame Kern des Quiz-Systems.
 *
 * Drei Schichten, ein Paket:
 *   contracts  Typen, Laufzeitschemas, Befehle, View-Modelle, Runtime-Vertrag
 *   engine     Zustandsmaschine, Auswahl, Projektion, Ereignisableitung
 *   runtime    Befehlsverarbeitung hinter dem Speicher-Port, lokale und
 *              entfernte QuizRuntime, In-Memory-Store, Hotfix-Overlay
 *
 * Hier gibt es KEIN Dateisystem und KEINE nativen Module: Alles laeuft im
 * Browser, im Renderer und in Node. Datei-IO liefert `@hfroemmel/quiz-content`,
 * SQLite der Buehnenbetrieb (quiz-live).
 */
export * from './contracts'
export * from './engine'
export * from './runtime'
