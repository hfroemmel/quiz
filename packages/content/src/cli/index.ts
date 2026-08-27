#!/usr/bin/env node
/**
 * Einstiegspunkt der Kommandozeile: `quiz-content <befehl> [optionen]`.
 *
 * Die Unterbefehle sind eigenstaendige Module - sie laufen beim Import los und
 * werten `process.argv` selbst aus. Dieser Dispatcher waehlt nur aus und haelt
 * die Hilfe an einer Stelle.
 *
 * WARUM EIN GEBUENDELTES CLI: Das Inhalte-Repository hat keinen eigenen Code.
 * Was es zum Pruefen, Bauen und Laden braucht, kommt aus diesem Paket - ein
 * einziges Werkzeug, dieselbe Verzeichniskonvention (`<cwd>/content/...`).
 */
const befehle: Record<string, () => Promise<unknown>> = {
  validate: () => import('./validate'),
  build: () => import('./build'),
  pull: () => import('./pull'),
  fetch: () => import('./fetch'),
  'demo-assets': () => import('./generate-demo-assets'),
  'migrate-legacy': () => import('./migrate-legacy'),
  'migrate-v2': () => import('./migrate-v2'),
}

const [befehl] = process.argv.slice(2)

if (!befehl || befehl === '--help' || befehl === '-h') {
  console.log('quiz-content <befehl> [optionen]')
  console.log('')
  console.log('Befehle:')
  console.log('  validate [--profile no-video] [--placeholder-media]  Inhalte pruefen (Pflicht vor dem Bau)')
  console.log('  build    [--profile no-video] [--out <dir>]          Quizpaket bauen')
  console.log('  pull     [--lock <datei>]                            Gebautes Paket aus einem Release laden')
  console.log('  fetch                                                Redaktionelle Rohdaten abrufen (optional)')
  console.log('  demo-assets                                          Platzhaltermedien erzeugen')
  console.log('  migrate-legacy                                       Altbestand importieren')
  console.log('  migrate-v2                                           Quelle von Schema v1 auf v2 heben')
  console.log('')
  console.log('Pfade folgen der Konvention <cwd>/content/{source,dist,reports};')
  console.log('--source, --out und --report weichen davon ab.')
  process.exit(befehl ? 0 : 1)
}

const gewaehlt = befehle[befehl]
if (!gewaehlt) {
  console.error(`Unbekannter Befehl "${befehl}". "quiz-content --help" zeigt die Liste.`)
  process.exit(1)
}

// Die Unterbefehle lesen `process.argv` selbst - ohne den Befehlsnamen davor.
process.argv = [process.argv[0]!, process.argv[1]!, ...process.argv.slice(3)]
await gewaehlt()

export {}
