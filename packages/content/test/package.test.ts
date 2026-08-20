/**
 * Form des gebauten Quizpakets.
 *
 * Beim Bauen werden die Themefarben ergaenzt. Das Paket traegt eine Pruefsumme
 * ueber genau diesen Inhalt, und die laeuft ueber `JSON.stringify` - dort zaehlt
 * die REIHENFOLGE der Schluessel. Wird ein Feld nachtraeglich angehaengt, steht
 * es am Ende des Objekts, waehrend der Ladeweg es ueber das Schema an seinen
 * Platz sortiert. Das Paket wuerde beim Start abgewiesen, obwohl inhaltlich
 * nichts fehlt.
 *
 * Der Fehler ist beim ersten Mal erst im End-to-End-Lauf aufgefallen, weil er
 * sich weder im Typsystem noch im Inhaltsbericht zeigt. Deshalb steht er hier.
 */
import { describe, expect, it } from 'vitest'
import { quizConfigSchema, resolveThemeColors, stagePalettes } from '@quiz/contracts'

const config = {
  questionsPerGame: 1,
  difficulties: [{ id: 'easy', label: 'Leicht' }],
  categories: [{ id: 'allgemein', label: 'Allgemein' }],
  /*
   * `typography` steht im Schema HINTER `colors` und ist der Grund, warum der
   * Fehler ueberhaupt sichtbar wird: Ohne ein Feld dahinter landet ein
   * angehaengtes `colors` zufaellig an derselben Stelle wie im Schema, und die
   * Pruefung ginge ins Leere.
   */
  themes: [
    { id: 'default', label: 'Standard', typography: { headingFont: 'Melior' } },
    { id: 'kids', label: 'Kinder', skin: 'kids', colors: { accent: '#123456' }, presentationAnimationSetId: 'standard' },
  ],
  presets: [{ id: 'standard', label: 'Standard', slots: [{ id: 'text', filters: {} }] }],
  modes: [{ id: 'adults', label: 'Erwachsene', questionFilter: {}, themeId: 'default', allowedPresetIds: ['standard'] }],
}

/** Wie `buildPackage` das Paket zusammensetzt. */
function packaged() {
  const parsed = quizConfigSchema.parse(config)
  return quizConfigSchema.parse({
    ...parsed,
    themes: parsed.themes.map((theme) => ({ ...theme, colors: resolveThemeColors(theme) })),
  })
}

describe('Gebautes Quizpaket', () => {
  it('ergaenzt die Farben eines Themes aus seiner Gestaltungswelt', () => {
    const [adults, kids] = packaged().themes
    expect(adults?.colors).toEqual(stagePalettes.default)
    /* Die genannte Abweichung gewinnt, alles Uebrige kommt aus der Welt. */
    expect(kids?.colors?.['accent']).toBe('#123456')
    expect(kids?.colors?.['text']).toBe(stagePalettes.kids.text)
  })

  it('bleibt beim Schreiben und Wiederlesen zeichengleich - sonst kippt die Pruefsumme', () => {
    const built = packaged()
    const reloaded = quizConfigSchema.parse(JSON.parse(JSON.stringify(built)))
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(built))
  })
})
