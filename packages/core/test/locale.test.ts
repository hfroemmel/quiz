/**
 * Die Sprachauflösung - die eine Stelle, die entscheidet, welcher Text gilt.
 *
 * Stuende diese Regel an drei Stellen, faellt eine davon irgendwann anders aus,
 * und im Saal stuende eine Frage auf Deutsch mit englischen Antworten.
 */
import { describe, expect, it } from 'vitest'
import { beschriftung, fragenTextFuer, grundsprache, gueltigeSprache, oberflaechenTexte } from '../src/contracts/locale'
import type { Question, QuizConfig } from '../src/contracts/content'

const frage: Question = {
  id: 'q1',
  poolIds: ['bundestag'],
  audiences: ['adults'],
  difficulty: 'easy',
  categories: ['institution'],
  tags: [],
  locale: 'de-DE',
  prompt: 'Wie viele Abgeordnete?',
  questionType: 'text-choice',
  evaluationMode: 'option-comparison',
  options: [
    { id: 'a', text: 'Fünfhundert' },
    { id: 'b', text: 'Sechshundert' },
  ],
  correctOptionId: 'b',
  media: { imageAssetId: 'bild-de' },
  explanation: { summary: 'Stand 2021.', source: 'Bundestag' },
  enabled: true,
  translations: {
    'en-GB': {
      prompt: 'How many members?',
      options: [{ id: 'b', text: 'Six hundred' }],
      media: { imageAssetId: 'bild-en' },
      explanation: { summary: 'As of 2021.' },
    },
  },
}

const config = { locales: [{ id: 'de-DE', label: 'Deutsch' }, { id: 'en-GB', label: 'English' }] } as QuizConfig

describe('gueltigeSprache', () => {
  it('holt eine unbekannte Sprache auf die Grundsprache zurueck', () => {
    // Der Wunsch kommt aus einem Config File; ein Tippfehler darf kein Geraet lahmlegen.
    expect(gueltigeSprache(config, 'kl-KL')).toBe('de-DE')
    expect(gueltigeSprache(config, 'en-GB')).toBe('en-GB')
    expect(gueltigeSprache(config, undefined)).toBe('de-DE')
  })

  it('nimmt Deutsch, wenn gar keine Sprachen konfiguriert sind', () => {
    expect(grundsprache({} as QuizConfig)).toBe('de-DE')
  })
})

describe('fragenTextFuer', () => {
  it('ersetzt Text, Medium und Erklaerung', () => {
    const englisch = fragenTextFuer(frage, 'en-GB')
    expect(englisch.prompt).toBe('How many members?')
    expect(englisch.media?.imageAssetId).toBe('bild-en')
    expect(englisch.explanation).toEqual({ summary: 'As of 2021.', source: 'Bundestag' })
  })

  it('ersetzt Optionen EINZELN und laesst die Wertung unberuehrt', () => {
    /*
     * Eine Uebersetzung, die eine Option vergisst, darf sie nicht verschwinden
     * lassen - sonst fehlte womoeglich genau die, gegen die verglichen wird.
     */
    const englisch = fragenTextFuer(frage, 'en-GB')
    expect(englisch.options).toEqual([
      { id: 'a', text: 'Fünfhundert' },
      { id: 'b', text: 'Six hundred' },
    ])
    expect(englisch.correctOptionId).toBe('b')
    expect(englisch.id).toBe(frage.id)
  })

  it('gibt das Original zurueck, wenn es keine Uebersetzung gibt', () => {
    expect(fragenTextFuer(frage, 'fr-FR')).toBe(frage)
    expect(fragenTextFuer(frage, undefined)).toBe(frage)
  })
})

describe('beschriftung', () => {
  it('nimmt die uebersetzte Beschriftung, sonst die des Originals', () => {
    const eintrag = { label: 'Leicht', labels: { 'en-GB': 'Easy' } }
    expect(beschriftung(eintrag, 'en-GB')).toBe('Easy')
    expect(beschriftung(eintrag, 'fr-FR')).toBe('Leicht')
    expect(beschriftung({ label: 'Leicht' }, 'en-GB')).toBe('Leicht')
  })
})

describe('oberflaechenTexte', () => {
  it('legt die gewaehlte Sprache ueber die Grundsprache', () => {
    /*
     * Ein Eintrag, den nur die Grundsprache kennt, bleibt lesbar - statt als
     * Schluessel auf dem Bildschirm zu stehen.
     */
    const mitTexten = {
      ...config,
      interfaceStrings: {
        'de-DE': { 'kiosk.start': "Los geht's", 'kiosk.back': 'Zurück' },
        'en-GB': { 'kiosk.start': "Let's go" },
      },
    } as QuizConfig
    expect(oberflaechenTexte(mitTexten, 'en-GB')).toEqual({ 'kiosk.start': "Let's go", 'kiosk.back': 'Zurück' })
  })

  it('bleibt leer, wenn der Inhalt keine Texte mitbringt', () => {
    expect(oberflaechenTexte(config, 'en-GB')).toEqual({})
  })
})
