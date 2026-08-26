/**
 * Form des gebauten Quizpakets.
 *
 * Das Paket traegt eine Pruefsumme ueber seinen Inhalt, und die laeuft ueber
 * `JSON.stringify` - dort zaehlt die REIHENFOLGE der Schluessel. Der Ladeweg
 * sortiert Felder ueber das Schema an ihren Platz; das Paket muss deshalb beim
 * Schreiben und Wiederlesen zeichengleich bleiben, sonst wird es beim Start
 * abgewiesen, obwohl inhaltlich nichts fehlt.
 *
 * Der Fehler ist beim ersten Mal erst im End-to-End-Lauf aufgefallen, weil er
 * sich weder im Typsystem noch im Inhaltsbericht zeigt. Deshalb steht er hier.
 *
 * Seit Schema v2 traegt das Paket ausserdem KEINE Farben und Schriften mehr -
 * Darstellung ist Sache des Gastgebers. Auch das haelt dieser Test fest.
 */
import { describe, expect, it } from 'vitest'
import { quizConfigSchema } from '@hfroemmel/quiz-core'

const config = {
  questionsPerGame: 1,
  difficulties: [{ id: 'easy', label: 'Leicht' }],
  categories: [{ id: 'allgemein', label: 'Allgemein' }],
  pools: [
    { id: 'bundestag', label: 'Bundestag' },
    { id: 'saarbruecken', label: 'Saarbrücken' },
  ],
  themes: [
    { id: 'default', label: 'Standard' },
    { id: 'kids', label: 'Kinder', skin: 'kids', presentationAnimationSetId: 'standard' },
  ],
  presets: [{ id: 'standard', label: 'Standard', slots: [{ id: 'text', filters: {} }] }],
  audiences: [{ id: 'adults', label: 'Erwachsene', themeId: 'default', allowedPresetIds: ['standard'] }],
}

describe('Gebautes Quizpaket', () => {
  it('streift Darstellungsfelder eines Themes ab - Farben gehoeren dem Gastgeber', () => {
    const parsed = quizConfigSchema.parse({
      ...config,
      themes: [{ id: 'default', label: 'Standard', colors: { accent: '#123456' }, typography: { headingFont: 'X' } }],
    })
    expect(parsed.themes[0]).toEqual({ id: 'default', label: 'Standard' })
  })

  it('bleibt beim Schreiben und Wiederlesen zeichengleich - sonst kippt die Pruefsumme', () => {
    const built = quizConfigSchema.parse(config)
    const reloaded = quizConfigSchema.parse(JSON.parse(JSON.stringify(built)))
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(built))
  })
})
