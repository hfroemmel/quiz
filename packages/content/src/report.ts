/**
 * Menschenlesbarer Validierungsbericht (Spezifikation 24.5).
 *
 * Der Bericht ist bewusst Text und kein JSON: Die Redaktion soll ihn ohne Werkzeuge
 * lesen koennen. Maschinenlesbar bleibt das `ValidationResult` selbst.
 */
import type { ValidationResult } from './validate.ts'

export interface ReportOptions {
  title: string
  contentVersion?: string
  /** Statistik der vorherigen Paketversion fuer den Vergleich. */
  previous?: { contentVersion: string; totalQuestions: number }
}

export function formatValidationReport(result: ValidationResult, options: ReportOptions): string {
  const lines: string[] = []
  const push = (line = '') => lines.push(line)

  push(`# ${options.title}`)
  if (options.contentVersion) push(`Inhaltsversion: ${options.contentVersion}`)
  push(`Ergebnis: ${result.ok ? 'BESTANDEN' : 'FEHLGESCHLAGEN'} (${result.errors.length} Fehler, ${result.warnings.length} Warnungen)`)
  push()

  push('## Gesamtzahlen')
  push(`- Fragen gesamt: ${result.statistics.totalQuestions} (aktiv: ${result.statistics.enabledQuestions})`)
  push(`- Wiederholungsgruppen: ${result.statistics.repetitionGroups}`)
  push(`- Medien: ${result.statistics.mediaAssets}`)
  push(`- Nach Modus: ${formatCounts(result.statistics.byMode)}`)
  push(`- Nach Schwierigkeit: ${formatCounts(result.statistics.byDifficulty)}`)
  push(`- Nach Praesentationstyp: ${formatCounts(result.statistics.byPresentationType)}`)
  push(`- Nach Kategorie: ${formatCounts(result.statistics.byCategory)}`)
  if (options.previous) {
    const delta = result.statistics.totalQuestions - options.previous.totalQuestions
    push(
      `- Vergleich zu Version ${options.previous.contentVersion}: ${delta >= 0 ? '+' : ''}${delta} Fragen`,
    )
  }
  push()

  push('## Poolabdeckung pro Fragenplatz')
  for (const preset of result.coverage) {
    push(`### Modus "${preset.modeId}" / Preset "${preset.presetId}"`)
    push(`Spiele ohne Wiederholung: ${preset.gamesWithoutRepetition}`)
    push(
      preset.selfServiceCapable
        ? 'Fuer das Touchgeraet geeignet: ja'
        : 'Fuer das Touchgeraet geeignet: nein (enthaelt Fragen, die ein Mensch bewerten muss)',
    )
    for (const slot of preset.slots) {
      const competing = slot.competingSlotIds.length
        ? ` | konkurriert mit: ${slot.competingSlotIds.join(', ')}`
        : ''
      push(
        `- Platz ${slot.slotIndex + 1} "${slot.slotId}": ${slot.candidateCount} Kandidaten, ` +
          `${slot.repetitionGroupCount} Wiederholungsgruppen${competing}`,
      )
    }
    push()
  }

  if (result.errors.length) {
    push('## Fehler (Build bricht ab)')
    for (const issue of result.errors) push(`- [${issue.code}] ${subject(issue.subject)}${issue.message}`)
    push()
  }

  if (result.warnings.length) {
    push('## Warnungen (bewusste Freigabe erforderlich)')
    for (const issue of result.warnings) push(`- [${issue.code}] ${subject(issue.subject)}${issue.message}`)
    push()
  }

  if (!result.errors.length && !result.warnings.length) {
    push('Keine Auffaelligkeiten.')
    push()
  }

  return lines.join('\n')
}

function subject(value: string | undefined): string {
  return value ? `${value}: ` : ''
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (!entries.length) return '-'
  return entries.map(([key, value]) => `${key}=${value}`).join(', ')
}
