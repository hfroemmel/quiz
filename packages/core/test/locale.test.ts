/**
 * The locale resolution - the one place that decides which text applies.
 *
 * If this rule stood in three places, one of them would eventually differ, and
 * the hall would see a German question with English answers.
 */
import { describe, expect, it } from 'vitest'
import { labelFor, questionTextFor, baseLocale, validLocale, interfaceTexts } from '../src/contracts/locale'
import type { Question, QuizConfig } from '../src/contracts/content'

const question: Question = {
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

describe('validLocale', () => {
  it('falls an unknown locale back to the base locale', () => {
    // The wish comes from a config file; a typo must not disable a device.
    expect(validLocale(config, 'kl-KL')).toBe('de-DE')
    expect(validLocale(config, 'en-GB')).toBe('en-GB')
    expect(validLocale(config, undefined)).toBe('de-DE')
  })

  it('takes German when no locales are configured at all', () => {
    expect(baseLocale({} as QuizConfig)).toBe('de-DE')
  })
})

describe('questionTextFor', () => {
  it('replaces text, medium and explanation', () => {
    const english = questionTextFor(question, 'en-GB')
    expect(english.prompt).toBe('How many members?')
    expect(english.media?.imageAssetId).toBe('bild-en')
    expect(english.explanation).toEqual({ summary: 'As of 2021.', source: 'Bundestag' })
  })

  it('replaces options INDIVIDUALLY and leaves the scoring untouched', () => {
    /*
     * A translation that forgets an option must not make it disappear -
     * otherwise exactly the one compared against might be missing.
     */
    const english = questionTextFor(question, 'en-GB')
    expect(english.options).toEqual([
      { id: 'a', text: 'Fünfhundert' },
      { id: 'b', text: 'Six hundred' },
    ])
    expect(english.correctOptionId).toBe('b')
    expect(english.id).toBe(question.id)
  })

  it('returns the original when there is no translation', () => {
    expect(questionTextFor(question, 'fr-FR')).toBe(question)
    expect(questionTextFor(question, undefined)).toBe(question)
  })
})

describe('label', () => {
  it("takes the translated label, otherwise the original's", () => {
    const entry = { label: 'Leicht', labels: { 'en-GB': 'Easy' } }
    expect(labelFor(entry, 'en-GB')).toBe('Easy')
    expect(labelFor(entry, 'fr-FR')).toBe('Leicht')
    expect(labelFor({ label: 'Leicht' }, 'en-GB')).toBe('Leicht')
  })
})

describe('uiTexts', () => {
  it('layers the chosen locale over the base locale', () => {
    /*
     * An entry known only to the base locale stays readable - instead of
     * standing on the screen as a key.
     */
    const withTexts = {
      ...config,
      interfaceStrings: {
        'de-DE': { 'kiosk.start': "Los geht's", 'kiosk.back': 'Zurück' },
        'en-GB': { 'kiosk.start': "Let's go" },
      },
    } as QuizConfig
    expect(interfaceTexts(withTexts, 'en-GB')).toEqual({ 'kiosk.start': "Let's go", 'kiosk.back': 'Zurück' })
  })

  it('stays empty when the content brings no texts', () => {
    expect(interfaceTexts(config, 'en-GB')).toEqual({})
  })
})
