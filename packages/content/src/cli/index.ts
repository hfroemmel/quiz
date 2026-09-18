#!/usr/bin/env node
/**
 * Command line entry point: `quiz-content <command> [options]`.
 *
 * The subcommands are standalone modules - they start on import and evaluate
 * `process.argv` themselves. This dispatcher only selects and keeps the help
 * in one place.
 *
 * WHY A BUNDLED CLI: The content repository has no code of its own. What it
 * needs for validating, building and loading comes from this package - one
 * single tool, the same directory convention (`<cwd>/content/...`).
 */
const commands: Record<string, () => Promise<unknown>> = {
  validate: () => import('./validate'),
  build: () => import('./build'),
  pull: () => import('./pull'),
  fetch: () => import('./fetch'),
  'import-sheet': () => import('./import-sheet'),
  'demo-assets': () => import('./generate-demo-assets'),
  'migrate-legacy': () => import('./migrate-legacy'),
  'migrate-v2': () => import('./migrate-v2'),
}

const [command] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  console.log('quiz-content <befehl> [optionen]')
  console.log('')
  console.log('Befehle:')
  console.log('  validate [--placeholder-media]  Inhalte pruefen (Pflicht vor dem Bau)')
  console.log('  build    [--out <dir>]          Quizpaket bauen')
  console.log('  pull     [--lock <datei>]                            Gebautes Paket aus einem Release laden')
  console.log('  fetch                                                Redaktionelle Rohdaten abrufen (optional)')
  console.log('  import-sheet --url <adresse> [--mapping <datei>]     Redaktionstabelle zu questions.json')
  console.log('  demo-assets                                          Platzhaltermedien erzeugen')
  console.log('  migrate-legacy                                       Altbestand importieren')
  console.log('  migrate-v2                                           Quelle von Schema v1 auf v2 heben')
  console.log('')
  console.log('Pfade folgen der Konvention <cwd>/content/{source,dist,reports};')
  console.log('--source, --out und --report weichen davon ab.')
  process.exit(command ? 0 : 1)
}

const chosen = commands[command]
if (!chosen) {
  console.error(`Unbekannter Befehl "${command}". "quiz-content --help" zeigt die Liste.`)
  process.exit(1)
}

// The subcommands read `process.argv` themselves - without the command name in front.
process.argv = [process.argv[0]!, process.argv[1]!, ...process.argv.slice(3)]
await chosen()

export {}
